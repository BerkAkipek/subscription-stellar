package main

import (
	"encoding/json"
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
