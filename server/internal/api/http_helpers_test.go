package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestUserIDFromCtx(t *testing.T) {
	ctx := context.WithValue(context.Background(), userIDKey, int64(42))
	if got := userIDFromCtx(ctx); got != 42 {
		t.Fatalf("expected user id 42, got %d", got)
	}
}

func TestUserIDFromCtxMissingOrWrongType(t *testing.T) {
	if got := userIDFromCtx(context.Background()); got != 0 {
		t.Fatalf("expected zero for missing user id, got %d", got)
	}

	ctx := context.WithValue(context.Background(), userIDKey, "42")
	if got := userIDFromCtx(ctx); got != 0 {
		t.Fatalf("expected zero for wrong type, got %d", got)
	}
}

func TestParseID(t *testing.T) {
	rec := httptest.NewRecorder()

	id, ok := parseID(rec, "123")
	if !ok {
		t.Fatal("expected parseID to succeed")
	}
	if id != 123 {
		t.Fatalf("expected id 123, got %d", id)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

func TestParseIDInvalid(t *testing.T) {
	for _, raw := range []string{"abc", "0", "-1"} {
		rec := httptest.NewRecorder()

		id, ok := parseID(rec, raw)
		if ok {
			t.Fatalf("expected parseID to fail for %q", raw)
		}
		if id != 0 {
			t.Fatalf("expected id 0 for %q, got %d", raw, id)
		}
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected status %d for %q, got %d", http.StatusBadRequest, raw, rec.Code)
		}
		if body := strings.TrimSpace(rec.Body.String()); body != `{"error":"invalid id"}` {
			t.Fatalf("unexpected body for %q: %s", raw, body)
		}
	}
}

func TestDecodeJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"blog"}`))
	rec := httptest.NewRecorder()
	var dst struct {
		Name string `json:"name"`
	}

	if ok := decodeJSON(rec, req, &dst); !ok {
		t.Fatal("expected decodeJSON to succeed")
	}
	if dst.Name != "blog" {
		t.Fatalf("expected decoded name blog, got %q", dst.Name)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

func TestDecodeJSONInvalid(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":`))
	rec := httptest.NewRecorder()
	var dst map[string]any

	if ok := decodeJSON(rec, req, &dst); ok {
		t.Fatal("expected decodeJSON to fail")
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
	if body := strings.TrimSpace(rec.Body.String()); body != `{"error":"invalid JSON body"}` {
		t.Fatalf("unexpected body: %s", body)
	}
}

func TestWriteJSON(t *testing.T) {
	rec := httptest.NewRecorder()

	writeJSON(rec, http.StatusCreated, map[string]string{"status": "ok"})

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("expected Content-Type application/json, got %q", got)
	}
	if body := strings.TrimSpace(rec.Body.String()); body != `{"status":"ok"}` {
		t.Fatalf("unexpected body: %s", body)
	}
}

func TestWriteError(t *testing.T) {
	rec := httptest.NewRecorder()

	writeError(rec, http.StatusUnauthorized, "invalid token")

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("expected Content-Type application/json, got %q", got)
	}
	if body := strings.TrimSpace(rec.Body.String()); body != `{"error":"invalid token"}` {
		t.Fatalf("unexpected body: %s", body)
	}
}

func TestSecurityHeaders(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)

	handler := securityHeaders(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("expected X-Content-Type-Options nosniff, got %q", got)
	}
}
