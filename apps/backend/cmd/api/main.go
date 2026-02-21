package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

type subscriptionState struct {
	PlanID    uint32 `json:"planId"`
	ExpiresAt uint64 `json:"expiresAt"`
}

type appStateResponse struct {
	User           string             `json:"user"`
	Subscription   *subscriptionState `json:"subscription"`
	TokenBalance   string             `json:"tokenBalance"`
	XLMBalance     string             `json:"xlmBalanceStroops"`
	RecentEvents   []json.RawMessage  `json:"recentEvents"`
	ObservedAt     string             `json:"observedAt"`
	Network        string             `json:"network"`
	SubscriptionID string             `json:"subscriptionContractId"`
	PaymentID      string             `json:"paymentContractId"`
}

func main() {
	addr := envOrDefault("BACKEND_ADDR", ":8080")
	mux := http.NewServeMux()

	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})
	mux.HandleFunc("/api/state", stateHandler)

	log.Printf("backend listening on %s", addr)
	if err := http.ListenAndServe(addr, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}

func stateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	user := strings.TrimSpace(r.URL.Query().Get("user"))
	if user == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing user query parameter"})
		return
	}

	network := envOrDefault("STELLAR_NETWORK", "testnet")
	source := strings.TrimSpace(os.Getenv("STELLAR_SOURCE"))
	subID := envOrDefault("SUBSCRIPTION_CONTRACT_ID", "subscription")
	tokenID := envOrDefault("PAYMENT_CONTRACT_ID", envOrDefault("TOKENIZATION_CONTRACT_ID", "tokenization"))

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	subscription, err := fetchSubscription(ctx, network, source, subID, user)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	tokenBalance, err := fetchTokenBalance(ctx, network, source, tokenID, user)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	events, err := fetchRecentEvents(ctx, network, subID, tokenID)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	resp := appStateResponse{
		User:           user,
		Subscription:   subscription,
		TokenBalance:   tokenBalance,
		XLMBalance:     tokenBalance,
		RecentEvents:   events,
		ObservedAt:     time.Now().UTC().Format(time.RFC3339),
		Network:        network,
		SubscriptionID: subID,
		PaymentID:      tokenID,
	}
	writeJSON(w, http.StatusOK, resp)
}

func fetchSubscription(ctx context.Context, network, source, contractID, user string) (*subscriptionState, error) {
	args := []string{
		"contract", "invoke",
		"--network", network,
	}
	args = append(args, readSourceArgs(source, user)...)
	args = append(args,
		"--id", contractID,
		"--send=no",
		"--",
		"get_subscription",
		"--user", user,
	)

	out, err := runStellar(ctx, args...)
	if err != nil {
		return nil, fmt.Errorf("fetch subscription: %w", err)
	}

	raw := strings.TrimSpace(out)
	if raw == "" || raw == "null" {
		return nil, nil
	}

	var parsed map[string]any
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, fmt.Errorf("parse subscription payload: %w", err)
	}

	planID, err := toUint64(parsed["plan_id"])
	if err != nil {
		return nil, fmt.Errorf("parse plan_id: %w", err)
	}
	expiresAt, err := toUint64(parsed["expires_at"])
	if err != nil {
		return nil, fmt.Errorf("parse expires_at: %w", err)
	}

	return &subscriptionState{
		PlanID:    uint32(planID),
		ExpiresAt: expiresAt,
	}, nil
}

func fetchTokenBalance(ctx context.Context, network, source, contractID, user string) (string, error) {
	baseArgs := []string{
		"contract", "invoke",
		"--network", network,
	}
	baseArgs = append(baseArgs, readSourceArgs(source, user)...)
	baseArgs = append(baseArgs,
		"--id", contractID,
		"--send=no",
	)

	var lastErr error
	paramAttempts := [][]string{
		{"--id", user},
		{"--user", user},
		{"--account", user},
	}

	for _, param := range paramAttempts {
		args := append([]string{}, baseArgs...)
		args = append(args,
			"--",
			"balance",
			param[0], param[1],
		)

		out, err := runStellar(ctx, args...)
		if err == nil {
			return normalizeTokenBalance(out), nil
		}
		lastErr = err
	}

	return "", fmt.Errorf("fetch token balance: %w", lastErr)
}

func fetchRecentEvents(ctx context.Context, network, subID, tokenID string) ([]json.RawMessage, error) {
	latestOutput, err := runStellar(ctx, "ledger", "latest", "--network", network, "--output", "json")
	if err != nil {
		return nil, fmt.Errorf("fetch latest ledger: %w", err)
	}

	var latest struct {
		Sequence uint64 `json:"sequence"`
	}
	if err := json.Unmarshal([]byte(latestOutput), &latest); err != nil {
		return nil, fmt.Errorf("parse latest ledger: %w", err)
	}

	start := uint64(1)
	if latest.Sequence > 200 {
		start = latest.Sequence - 200
	}

	out, err := runStellar(ctx,
		"events",
		"--network", network,
		"--output", "json",
		"--count", "30",
		"--start-ledger", strconv.FormatUint(start, 10),
		"--id", subID,
		"--id", tokenID,
	)
	if err != nil {
		return nil, fmt.Errorf("fetch events: %w", err)
	}

	raw := strings.TrimSpace(out)
	if raw == "" || raw == "No events" {
		return []json.RawMessage{}, nil
	}

	return parseEventsStream(raw)
}

func runStellar(ctx context.Context, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "stellar", args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	output, err := cmd.Output()
	if err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = strings.TrimSpace(string(output))
		}
		if msg == "" {
			msg = err.Error()
		}
		return "", errors.New(msg)
	}
	return strings.TrimSpace(string(output)), nil
}

func readSourceArgs(source, user string) []string {
	if trimmedSource := strings.TrimSpace(source); trimmedSource != "" {
		return []string{"--source", trimmedSource}
	}
	if trimmedUser := strings.TrimSpace(user); trimmedUser != "" {
		return []string{"--source-account", trimmedUser}
	}
	return nil
}

func toUint64(v any) (uint64, error) {
	switch t := v.(type) {
	case float64:
		return uint64(t), nil
	case string:
		return strconv.ParseUint(t, 10, 64)
	default:
		return 0, fmt.Errorf("unsupported type %T", v)
	}
}

func normalizeTokenBalance(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "0"
	}

	var asJSON any
	if err := json.Unmarshal([]byte(trimmed), &asJSON); err == nil {
		switch v := asJSON.(type) {
		case string:
			return v
		case float64:
			return strconv.FormatUint(uint64(v), 10)
		}
	}

	return strings.Trim(trimmed, "\"")
}

func parseEventsStream(raw string) ([]json.RawMessage, error) {
	events := make([]json.RawMessage, 0, 8)
	dec := json.NewDecoder(strings.NewReader(raw))
	for {
		var item json.RawMessage
		if err := dec.Decode(&item); err != nil {
			if errors.Is(err, context.Canceled) {
				return nil, err
			}
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, fmt.Errorf("parse events payload: %w", err)
		}
		if len(item) > 0 {
			events = append(events, item)
		}
	}
	return events, nil
}

func envOrDefault(key, fallback string) string {
	val := strings.TrimSpace(os.Getenv(key))
	if val == "" {
		return fallback
	}
	return val
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
