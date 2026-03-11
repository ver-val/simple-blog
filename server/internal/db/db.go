package db

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"blog-server/internal/model"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type Store struct {
	DB *sql.DB
}

func Connect(dsn string) (*Store, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}

	return &Store{DB: db}, nil
}

func (s *Store) Close() error { return s.DB.Close() }

func (s *Store) CreateUser(ctx context.Context, email, passwordHash, displayName string) (model.User, error) {
	q := `INSERT INTO users(email, password_hash, display_name)
	      VALUES($1, $2, $3)
	      RETURNING id, email, display_name, COALESCE(bio, ''), COALESCE(avatar_url, ''),
	                COALESCE(first_name, ''), COALESCE(last_name, ''), COALESCE(age, 0),
	                COALESCE(gender, ''), COALESCE(address, ''), COALESCE(website, ''),
	                created_at, updated_at`
	var u model.User
	err := s.DB.QueryRowContext(ctx, q, email, passwordHash, displayName).Scan(
		&u.ID, &u.Email, &u.DisplayName, &u.Bio, &u.AvatarURL, &u.FirstName, &u.LastName, &u.Age, &u.Gender, &u.Address, &u.Website, &u.CreatedAt, &u.UpdatedAt,
	)
	return u, err
}

func (s *Store) GetUserAuthByEmail(ctx context.Context, email string) (id int64, hash string, err error) {
	err = s.DB.QueryRowContext(ctx, `SELECT id, password_hash FROM users WHERE email = $1`, email).Scan(&id, &hash)
	return
}

func (s *Store) GetUserAuthByUsername(ctx context.Context, username string) (id int64, hash string, err error) {
	err = s.DB.QueryRowContext(ctx,
		`SELECT id, password_hash FROM users WHERE LOWER(display_name) = LOWER($1) ORDER BY id ASC LIMIT 1`,
		username,
	).Scan(&id, &hash)
	return
}

func (s *Store) GetUserByID(ctx context.Context, userID int64) (model.User, error) {
	q := `SELECT id, email, display_name, COALESCE(bio, ''), COALESCE(avatar_url, ''),
	             COALESCE(first_name, ''), COALESCE(last_name, ''), COALESCE(age, 0),
	             COALESCE(gender, ''), COALESCE(address, ''), COALESCE(website, ''),
	             created_at, updated_at
	      FROM users WHERE id = $1`
	var u model.User
	err := s.DB.QueryRowContext(ctx, q, userID).Scan(&u.ID, &u.Email, &u.DisplayName, &u.Bio, &u.AvatarURL, &u.FirstName, &u.LastName, &u.Age, &u.Gender, &u.Address, &u.Website, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

func (s *Store) UpdateUserProfile(ctx context.Context, userID int64, firstName, lastName string, age int, gender, address, website, bio, avatarURL string) (model.User, error) {
	q := `UPDATE users
	      SET first_name = $2, last_name = $3, age = $4, gender = $5, address = $6, website = $7, bio = $8, avatar_url = $9, updated_at = NOW()
	      WHERE id = $1
	      RETURNING id, email, display_name, COALESCE(bio, ''), COALESCE(avatar_url, ''),
	                COALESCE(first_name, ''), COALESCE(last_name, ''), COALESCE(age, 0),
	                COALESCE(gender, ''), COALESCE(address, ''), COALESCE(website, ''),
	                created_at, updated_at`
	var u model.User
	err := s.DB.QueryRowContext(ctx, q, userID, firstName, lastName, age, gender, address, website, bio, avatarURL).Scan(&u.ID, &u.Email, &u.DisplayName, &u.Bio, &u.AvatarURL, &u.FirstName, &u.LastName, &u.Age, &u.Gender, &u.Address, &u.Website, &u.CreatedAt, &u.UpdatedAt)
	return u, err
}

func (s *Store) CreateResetToken(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time) error {
	_, err := s.DB.ExecContext(ctx,
		`INSERT INTO password_reset_tokens(user_id, token_hash, expires_at) VALUES($1, $2, $3)`,
		userID, tokenHash, expiresAt,
	)
	return err
}

func (s *Store) ConsumeResetToken(ctx context.Context, tokenHash string) (int64, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	var userID int64
	err = tx.QueryRowContext(ctx,
		`SELECT user_id FROM password_reset_tokens
		 WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
		 ORDER BY id DESC LIMIT 1 FOR UPDATE`, tokenHash,
	).Scan(&userID)
	if err != nil {
		return 0, err
	}

	if _, err = tx.ExecContext(ctx,
		`UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1 AND used_at IS NULL`, tokenHash,
	); err != nil {
		return 0, err
	}

	if err = tx.Commit(); err != nil {
		return 0, err
	}
	return userID, nil
}

func (s *Store) UpdatePassword(ctx context.Context, userID int64, passwordHash string) error {
	_, err := s.DB.ExecContext(ctx, `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, userID, passwordHash)
	return err
}

func (s *Store) CreatePost(ctx context.Context, authorID int64, title, description, content string) (model.Post, error) {
	q := `INSERT INTO posts(author_id, title, description, content)
	      VALUES($1, $2, $3, $4)
	      RETURNING id, author_id, title, description, content, created_at, updated_at`
	var p model.Post
	err := s.DB.QueryRowContext(ctx, q, authorID, title, description, content).Scan(&p.ID, &p.AuthorID, &p.Title, &p.Description, &p.Content, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return p, err
	}
	err = s.DB.QueryRowContext(ctx, `SELECT display_name FROM users WHERE id = $1`, p.AuthorID).Scan(&p.AuthorName)
	return p, err
}

func (s *Store) ListPosts(ctx context.Context) ([]model.Post, error) {
	q := `SELECT p.id, p.author_id, u.display_name, p.title, p.description, p.content,
	             (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
	             COALESCE((SELECT c.author_name FROM comments c WHERE c.post_id = p.id ORDER BY c.created_at DESC LIMIT 1), '') AS latest_comment_author,
	             COALESCE((SELECT c.content FROM comments c WHERE c.post_id = p.id ORDER BY c.created_at DESC LIMIT 1), '') AS latest_comment,
	             p.created_at, p.updated_at
	      FROM posts p
	      JOIN users u ON u.id = p.author_id
	      ORDER BY p.created_at DESC`
	rows, err := s.DB.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	posts := make([]model.Post, 0)
	for rows.Next() {
		var p model.Post
		if err := rows.Scan(&p.ID, &p.AuthorID, &p.AuthorName, &p.Title, &p.Description, &p.Content, &p.CommentCount, &p.LatestCommentAuthor, &p.LatestComment, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}
	return posts, rows.Err()
}

func (s *Store) GetPost(ctx context.Context, postID int64) (model.Post, error) {
	q := `SELECT p.id, p.author_id, u.display_name, p.title, p.description, p.content,
	             (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
	             COALESCE((SELECT c.author_name FROM comments c WHERE c.post_id = p.id ORDER BY c.created_at DESC LIMIT 1), '') AS latest_comment_author,
	             COALESCE((SELECT c.content FROM comments c WHERE c.post_id = p.id ORDER BY c.created_at DESC LIMIT 1), '') AS latest_comment,
	             p.created_at, p.updated_at
	      FROM posts p
	      JOIN users u ON u.id = p.author_id
	      WHERE p.id = $1`
	var p model.Post
	err := s.DB.QueryRowContext(ctx, q, postID).Scan(&p.ID, &p.AuthorID, &p.AuthorName, &p.Title, &p.Description, &p.Content, &p.CommentCount, &p.LatestCommentAuthor, &p.LatestComment, &p.CreatedAt, &p.UpdatedAt)
	return p, err
}

func (s *Store) ListPostsByAuthor(ctx context.Context, authorID int64) ([]model.Post, error) {
	q := `SELECT p.id, p.author_id, u.display_name, p.title, p.description, p.content,
	             (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
	             COALESCE((SELECT c.author_name FROM comments c WHERE c.post_id = p.id ORDER BY c.created_at DESC LIMIT 1), '') AS latest_comment_author,
	             COALESCE((SELECT c.content FROM comments c WHERE c.post_id = p.id ORDER BY c.created_at DESC LIMIT 1), '') AS latest_comment,
	             p.created_at, p.updated_at
	      FROM posts p
	      JOIN users u ON u.id = p.author_id
	      WHERE p.author_id = $1
	      ORDER BY p.created_at DESC`
	rows, err := s.DB.QueryContext(ctx, q, authorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	posts := make([]model.Post, 0)
	for rows.Next() {
		var p model.Post
		if err := rows.Scan(&p.ID, &p.AuthorID, &p.AuthorName, &p.Title, &p.Description, &p.Content, &p.CommentCount, &p.LatestCommentAuthor, &p.LatestComment, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}
	return posts, rows.Err()
}

func (s *Store) CreateComment(ctx context.Context, postID, authorID int64, authorName, content string) (model.Comment, error) {
	if _, err := s.GetPost(ctx, postID); err != nil {
		return model.Comment{}, err
	}
	q := `INSERT INTO comments(post_id, author_id, author_name, content)
	      VALUES($1, $2, $3, $4)
	      RETURNING id, post_id, author_id, author_name, content, created_at, updated_at`
	var c model.Comment
	err := s.DB.QueryRowContext(ctx, q, postID, authorID, authorName, content).Scan(&c.ID, &c.PostID, &c.AuthorID, &c.AuthorName, &c.Content, &c.CreatedAt, &c.UpdatedAt)
	return c, err
}

func (s *Store) ListCommentsByPost(ctx context.Context, postID int64) ([]model.Comment, error) {
	q := `SELECT c.id, c.post_id, c.author_id, c.author_name, c.content, c.created_at, c.updated_at
	      FROM comments c
	      WHERE c.post_id = $1
	      ORDER BY c.created_at ASC`
	rows, err := s.DB.QueryContext(ctx, q, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	comments := make([]model.Comment, 0)
	for rows.Next() {
		var c model.Comment
		if err := rows.Scan(&c.ID, &c.PostID, &c.AuthorID, &c.AuthorName, &c.Content, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		comments = append(comments, c)
	}
	return comments, rows.Err()
}

func IsUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	var pgErr interface{ SQLState() string }
	if errors.As(err, &pgErr) {
		return pgErr.SQLState() == "23505"
	}
	return false
}
