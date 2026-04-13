package main

import (
	"log"
	"net/http"
	_ "net/http/pprof"
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

func main() {
	logger := log.New(os.Stdout, "[blog-server] ", log.LstdFlags|log.Lshortfile)

	dsn := getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/blog?sslmode=disable")
	jwtSecret := getenv("JWT_SECRET", "change-me-in-production")
	clientURL := getenv("CLIENT_URL", "http://localhost:5173")
	addr := getenv("SERVER_ADDR", ":8080")
	pprofAddr := getenv("PPROF_ADDR", ":6060")

	store, err := db.Connect(dsn)
	if err != nil {
		logger.Fatalf("db connect: %v", err)
	}
	defer store.Close()

	srv := api.NewServer(store, jwtSecret, 24*time.Hour, 30*time.Minute, clientURL, logger)

	go func() {
		logger.Printf("pprof listening on %s", pprofAddr)
		if err := http.ListenAndServe(pprofAddr, http.DefaultServeMux); err != nil {
			logger.Printf("pprof stopped: %v", err)
		}
	}()

	logger.Printf("listening on %s", addr)
	if err := http.ListenAndServe(addr, srv.Router()); err != nil {
		logger.Fatalf("server stopped: %v", err)
	}
}
