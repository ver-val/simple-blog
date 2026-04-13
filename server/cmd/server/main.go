package main

import (
	"log"
	"net/http"
	"net/http/pprof"
	"os"
	"time"

	"blog-server/internal/api"
	"blog-server/internal/db"
)

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getenvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		return v == "1" || v == "true" || v == "TRUE" || v == "yes" || v == "YES"
	}
	return fallback
}

func main() {
	logger := log.New(os.Stdout, "[blog-server] ", log.LstdFlags|log.Lshortfile)

	dsn := getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/blog?sslmode=disable")
	jwtSecret := getenv("JWT_SECRET", "change-me-in-production")
	clientURL := getenv("CLIENT_URL", "http://localhost:5173")
	addr := getenv("SERVER_ADDR", ":8080")
	pprofAddr := getenv("PPROF_ADDR", "127.0.0.1:6060")
	enablePprof := getenvBool("ENABLE_PPROF", false)

	store, err := db.Connect(dsn)
	if err != nil {
		logger.Fatalf("db connect: %v", err)
	}
	defer store.Close()

	srv := api.NewServer(store, jwtSecret, 24*time.Hour, 30*time.Minute, clientURL, logger)

	if enablePprof {
		go func() {
			pprofMux := http.NewServeMux()
			pprofMux.HandleFunc("/debug/pprof/", pprof.Index)
			pprofMux.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
			pprofMux.HandleFunc("/debug/pprof/profile", pprof.Profile)
			pprofMux.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
			pprofMux.HandleFunc("/debug/pprof/trace", pprof.Trace)
			pprofServer := &http.Server{
				Addr:              pprofAddr,
				Handler:           pprofMux,
				ReadHeaderTimeout: 5 * time.Second,
			}
			logger.Printf("pprof listening on %s", pprofAddr)
			if err := pprofServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				logger.Printf("pprof stopped: %v", err)
			}
		}()
	}

	httpServer := &http.Server{
		Addr:              addr,
		Handler:           srv.Router(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	logger.Printf("listening on %s", addr)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Fatalf("server stopped: %v", err)
	}
}
