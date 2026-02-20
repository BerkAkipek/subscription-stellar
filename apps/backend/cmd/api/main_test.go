package main

import (
	"encoding/json"
	"os"
	"testing"
)

func TestNormalizeTokenBalance(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		in   string
		want string
	}{
		{name: "empty", in: "", want: "0"},
		{name: "plain quoted string", in: `"975"`, want: "975"},
		{name: "plain number", in: `975`, want: "975"},
		{name: "whitespace", in: "  12  ", want: "12"},
		{name: "fallback trimmed quotes", in: `"not-json`, want: "not-json"},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := normalizeTokenBalance(tc.in)
			if got != tc.want {
				t.Fatalf("normalizeTokenBalance(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestParseEventsStream(t *testing.T) {
	t.Parallel()

	raw := `{"id":"1","type":"contract"}
{"id":"2","type":"contract"}`

	got, err := parseEventsStream(raw)
	if err != nil {
		t.Fatalf("parseEventsStream returned error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 events, got %d", len(got))
	}

	var first map[string]any
	if err := json.Unmarshal(got[0], &first); err != nil {
		t.Fatalf("failed to unmarshal first event: %v", err)
	}
	if first["id"] != "1" {
		t.Fatalf("first event id = %v, want 1", first["id"])
	}
}

func TestParseEventsStreamInvalid(t *testing.T) {
	t.Parallel()

	_, err := parseEventsStream(`{"id":"1"} garbage`)
	if err == nil {
		t.Fatal("expected parseEventsStream to fail on invalid stream")
	}
}

func TestToUint64(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		in      any
		want    uint64
		wantErr bool
	}{
		{name: "float64", in: float64(123), want: 123},
		{name: "string", in: "456", want: 456},
		{name: "bad string", in: "nope", wantErr: true},
		{name: "unsupported type", in: true, wantErr: true},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := toUint64(tc.in)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("toUint64(%v) expected error", tc.in)
				}
				return
			}
			if err != nil {
				t.Fatalf("toUint64(%v) returned error: %v", tc.in, err)
			}
			if got != tc.want {
				t.Fatalf("toUint64(%v) = %d, want %d", tc.in, got, tc.want)
			}
		})
	}
}

func TestEnvOrDefault(t *testing.T) {
	const key = "TEST_ENV_OR_DEFAULT_KEY"
	t.Cleanup(func() {
		_ = os.Unsetenv(key)
	})

	if err := os.Setenv(key, "configured"); err != nil {
		t.Fatalf("Setenv failed: %v", err)
	}
	if got := envOrDefault(key, "fallback"); got != "configured" {
		t.Fatalf("envOrDefault with set env = %q, want configured", got)
	}

	if err := os.Setenv(key, "   "); err != nil {
		t.Fatalf("Setenv failed: %v", err)
	}
	if got := envOrDefault(key, "fallback"); got != "fallback" {
		t.Fatalf("envOrDefault with blank env = %q, want fallback", got)
	}
}
