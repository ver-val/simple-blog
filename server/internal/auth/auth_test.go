package auth

import (
	"testing"
	"time"
)

func TestGenerateAndParseJWT(t *testing.T) {
	secret := "test-secret"
	tok, err := GenerateJWT(42, secret, time.Hour)
	if err != nil {
		t.Fatalf("GenerateJWT error: %v", err)
	}

	claims, err := ParseJWT(tok, secret)
	if err != nil {
		t.Fatalf("ParseJWT error: %v", err)
	}

	if claims.UserID != 42 {
		t.Fatalf("expected userID 42, got %d", claims.UserID)
	}
}

func TestParseJWTWrongSecret(t *testing.T) {
	tok, err := GenerateJWT(7, "secret-a", time.Hour)
	if err != nil {
		t.Fatalf("GenerateJWT error: %v", err)
	}

	if _, err := ParseJWT(tok, "secret-b"); err == nil {
		t.Fatal("expected parse error with wrong secret")
	}
}

func TestGenerateAndHashResetToken(t *testing.T) {
	raw, hash, err := GenerateResetToken()
	if err != nil {
		t.Fatalf("GenerateResetToken error: %v", err)
	}
	if raw == "" || hash == "" {
		t.Fatal("expected non-empty token and hash")
	}
	if got := HashToken(raw); got != hash {
		t.Fatalf("expected hash %q, got %q", hash, got)
	}
}
