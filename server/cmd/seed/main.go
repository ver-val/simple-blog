package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"golang.org/x/crypto/bcrypt"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func atoiEnv(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			return parsed
		}
	}
	return fallback
}

func main() {
	logger := log.New(os.Stdout, "[blog-seed] ", log.LstdFlags)

	dsn := getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/blog?sslmode=disable")
	postsCount := atoiEnv("SEED_POSTS", 2000)
	commentsPerPost := atoiEnv("SEED_COMMENTS_PER_POST", 5)

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		logger.Fatalf("db open: %v", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		logger.Fatalf("db ping: %v", err)
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte("Asdf@1234"), bcrypt.DefaultCost)
	if err != nil {
		logger.Fatalf("hash password: %v", err)
	}

	var userID int64
	err = db.QueryRowContext(ctx, `
		INSERT INTO users(email, password_hash, display_name, first_name, last_name, age, gender, address, bio)
		VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
		RETURNING id
	`,
		"stress-seed@example.com",
		string(passwordHash),
		"stress_seed_user",
		"Stress",
		"Seeder",
		30,
		"female",
		"Warsaw",
		"Seed user for stress testing",
	).Scan(&userID)
	if err != nil {
		logger.Fatalf("upsert seed user: %v", err)
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		logger.Fatalf("begin tx: %v", err)
	}
	defer tx.Rollback()

	postStmt, err := tx.PrepareContext(ctx, `
		INSERT INTO posts(author_id, title, description, content)
		VALUES($1, $2, $3, $4)
		RETURNING id
	`)
	if err != nil {
		logger.Fatalf("prepare posts: %v", err)
	}
	defer postStmt.Close()

	commentStmt, err := tx.PrepareContext(ctx, `
		INSERT INTO comments(post_id, author_id, author_name, content)
		VALUES($1, $2, $3, $4)
	`)
	if err != nil {
		logger.Fatalf("prepare comments: %v", err)
	}
	defer commentStmt.Close()

	for i := 0; i < postsCount; i++ {
		title := fmt.Sprintf("Stress seed post %d", i+1)
		description := fmt.Sprintf("Stress seed description %d", i+1)
		content := fmt.Sprintf("Stress seed content %d", i+1)

		var postID int64
		if err := postStmt.QueryRowContext(ctx, userID, title, description, content).Scan(&postID); err != nil {
			logger.Fatalf("insert post %d: %v", i+1, err)
		}

		for j := 0; j < commentsPerPost; j++ {
			comment := fmt.Sprintf("Stress seed comment %d for post %d", j+1, i+1)
			if _, err := commentStmt.ExecContext(ctx, postID, userID, "stress_seed_user", comment); err != nil {
				logger.Fatalf("insert comment %d for post %d: %v", j+1, i+1, err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		logger.Fatalf("commit seed tx: %v", err)
	}

	logger.Printf("seed completed: posts=%d comments=%d", postsCount, postsCount*commentsPerPost)
}
