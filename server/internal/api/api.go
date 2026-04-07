package api

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"blog-server/internal/auth"
	"blog-server/internal/db"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"golang.org/x/crypto/bcrypt"
)

type contextKey string

const userIDKey contextKey = "userID"

type Server struct {
	Store     *db.Store
	JWTSecret string
	TokenTTL  time.Duration
	ClientURL string
	ResetTTL  time.Duration
	logger    *log.Logger
}

func NewServer(store *db.Store, jwtSecret string, tokenTTL, resetTTL time.Duration, clientURL string, logger *log.Logger) *Server {
	return &Server{Store: store, JWTSecret: jwtSecret, TokenTTL: tokenTTL, ResetTTL: resetTTL, ClientURL: clientURL, logger: logger}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(s.requestLogger)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{s.ClientURL, "http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api", func(api chi.Router) {
		api.Route("/auth", func(ar chi.Router) {
			ar.Post("/register", s.register)
			ar.Post("/login", s.login)
			ar.Post("/forgot-password", s.forgotPassword)
			ar.Post("/reset-password", s.resetPassword)
		})

		api.Get("/posts", s.listPosts)
		api.Get("/posts/{postID}", s.getPost)
		api.Get("/posts/{postID}/comments", s.listComments)
		api.Get("/users/{userID}/posts", s.listPostsByUser)

		api.Group(func(pr chi.Router) {
			pr.Use(s.authMiddleware)
			pr.Get("/profile/me", s.getProfile)
			pr.Put("/profile/me", s.updateProfile)
			pr.Post("/posts", s.createPost)
			pr.Post("/posts/{postID}/comments", s.createComment)
		})
	})

	return r
}

type loggingResponseWriter struct {
	http.ResponseWriter
	status int
}

func (lrw *loggingResponseWriter) WriteHeader(statusCode int) {
	lrw.status = statusCode
	lrw.ResponseWriter.WriteHeader(statusCode)
}

func (s *Server) requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		lrw := &loggingResponseWriter{
			ResponseWriter: w,
			status:         http.StatusOK,
		}

		next.ServeHTTP(lrw, r)

		s.logger.Printf(
			"request_id=%s method=%s path=%s status=%d duration_ms=%d ip=%s ua=%q",
			middleware.GetReqID(r.Context()),
			r.Method,
			r.URL.Path,
			lrw.status,
			time.Since(start).Milliseconds(),
			r.RemoteAddr,
			r.UserAgent(),
		)
	})
}

type registerReq struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"displayName"`
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	if req.Email == "" || len(req.Password) < 8 || req.DisplayName == "" {
		writeError(w, http.StatusBadRequest, "invalid registration payload")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	u, err := s.Store.CreateUser(r.Context(), req.Email, string(hash), req.DisplayName)
	if err != nil {
		if db.IsUniqueViolation(err) {
			writeError(w, http.StatusConflict, "email already registered")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	token, err := auth.GenerateJWT(u.ID, s.JWTSecret, s.TokenTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"token": token, "user": u})
}

type loginReq struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Password = strings.TrimSpace(req.Password)
	if (req.Username == "" && req.Email == "") || req.Password == "" {
		writeError(w, http.StatusBadRequest, "username and password are required")
		return
	}

	var (
		userID       int64
		passwordHash string
		err          error
	)
	if req.Username != "" {
		userID, passwordHash, err = s.Store.GetUserAuthByUsername(r.Context(), req.Username)
	} else {
		userID, passwordHash, err = s.Store.GetUserAuthByEmail(r.Context(), req.Email)
	}
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "Invalid username/password, Try again!")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to login")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "Invalid username/password, Try again!")
		return
	}

	u, err := s.Store.GetUserByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load user")
		return
	}

	token, err := auth.GenerateJWT(u.ID, s.JWTSecret, s.TokenTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": u})
}

type forgotReq struct {
	Email string `json:"email"`
}

func (s *Server) forgotPassword(w http.ResponseWriter, r *http.Request) {
	var req forgotReq
	if !decodeJSON(w, r, &req) {
		return
	}
	email := strings.TrimSpace(strings.ToLower(req.Email))
	if email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}

	userID, _, err := s.Store.GetUserAuthByEmail(r.Context(), email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "No account with that email address exists.")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to process forgot password request")
		return
	}

	raw, hash, err := auth.GenerateResetToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to process forgot password request")
		return
	}
	expiresAt := time.Now().Add(s.ResetTTL)
	if err := s.Store.CreateResetToken(r.Context(), userID, hash, expiresAt); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to process forgot password request")
		return
	}

	s.logger.Printf("password reset token for %s: %s", email, raw)
	writeJSON(w, http.StatusOK, map[string]any{
		"message":    "Reset token generated",
		"debugToken": raw,
	})
}

type resetReq struct {
	Token       string `json:"token"`
	NewPassword string `json:"newPassword"`
}

func (s *Server) resetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetReq
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" || len(req.NewPassword) < 8 {
		writeError(w, http.StatusBadRequest, "invalid reset payload")
		return
	}

	userID, err := s.Store.ConsumeResetToken(r.Context(), auth.HashToken(req.Token))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusBadRequest, "invalid or expired token")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to reset password")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}
	if err := s.Store.UpdatePassword(r.Context(), userID, string(hash)); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update password")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "password has been reset"})
}

func (s *Server) getProfile(w http.ResponseWriter, r *http.Request) {
	u, err := s.Store.GetUserByID(r.Context(), userIDFromCtx(r.Context()))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load profile")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

type updateProfileReq struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Age       int    `json:"age"`
	Gender    string `json:"gender"`
	Address   string `json:"address"`
	Website   string `json:"website"`
	Bio       string `json:"bio"`
	AvatarURL string `json:"avatarUrl"`
}

func (s *Server) updateProfile(w http.ResponseWriter, r *http.Request) {
	var req updateProfileReq
	if !decodeJSON(w, r, &req) {
		return
	}
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	req.Gender = strings.TrimSpace(req.Gender)
	req.Address = strings.TrimSpace(req.Address)
	req.Website = strings.TrimSpace(req.Website)
	req.Bio = strings.TrimSpace(req.Bio)
	req.AvatarURL = strings.TrimSpace(req.AvatarURL)

	if req.FirstName == "" || req.LastName == "" || req.Age <= 0 || req.Gender == "" || req.Address == "" {
		writeError(w, http.StatusBadRequest, "firstName, lastName, age, gender and address are required")
		return
	}

	u, err := s.Store.UpdateUserProfile(r.Context(), userIDFromCtx(r.Context()), req.FirstName, req.LastName, req.Age, req.Gender, req.Address, req.Website, req.Bio, req.AvatarURL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update profile")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

type createPostReq struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Body        string `json:"body"`
	Content     string `json:"content"`
}

func (s *Server) createPost(w http.ResponseWriter, r *http.Request) {
	var req createPostReq
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	req.Body = strings.TrimSpace(req.Body)
	req.Content = strings.TrimSpace(req.Content)
	if req.Content == "" {
		req.Content = req.Body // compatibility with current BDD naming
	}
	if req.Title == "" || req.Description == "" || req.Content == "" {
		writeError(w, http.StatusBadRequest, "title, description and body are required")
		return
	}
	p, err := s.Store.CreatePost(r.Context(), userIDFromCtx(r.Context()), req.Title, req.Description, req.Content)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create post")
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

func (s *Server) listPosts(w http.ResponseWriter, r *http.Request) {
	posts, err := s.Store.ListPosts(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list posts")
		return
	}
	writeJSON(w, http.StatusOK, posts)
}

func (s *Server) getPost(w http.ResponseWriter, r *http.Request) {
	postID, ok := parseID(w, chi.URLParam(r, "postID"))
	if !ok {
		return
	}
	post, err := s.Store.GetPost(r.Context(), postID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "post not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to load post")
		return
	}
	comments, err := s.Store.ListCommentsByPost(r.Context(), postID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load comments")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"post": post, "comments": comments})
}

func (s *Server) listPostsByUser(w http.ResponseWriter, r *http.Request) {
	userID, ok := parseID(w, chi.URLParam(r, "userID"))
	if !ok {
		return
	}
	posts, err := s.Store.ListPostsByAuthor(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list user posts")
		return
	}
	writeJSON(w, http.StatusOK, posts)
}

type createCommentReq struct {
	Name    string `json:"name"`
	Message string `json:"message"`
	Content string `json:"content"`
}

func (s *Server) createComment(w http.ResponseWriter, r *http.Request) {
	postID, ok := parseID(w, chi.URLParam(r, "postID"))
	if !ok {
		return
	}
	var req createCommentReq
	if !decodeJSON(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" {
		req.Message = strings.TrimSpace(req.Content) // backward compatibility for old client payloads
	}
	if req.Name == "" || req.Message == "" {
		writeError(w, http.StatusBadRequest, "name and message are required")
		return
	}
	comment, err := s.Store.CreateComment(r.Context(), postID, userIDFromCtx(r.Context()), req.Name, req.Message)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "post not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create comment")
		return
	}
	writeJSON(w, http.StatusCreated, comment)
}

func (s *Server) listComments(w http.ResponseWriter, r *http.Request) {
	postID, ok := parseID(w, chi.URLParam(r, "postID"))
	if !ok {
		return
	}
	comments, err := s.Store.ListCommentsByPost(r.Context(), postID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list comments")
		return
	}
	writeJSON(w, http.StatusOK, comments)
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authz := r.Header.Get("Authorization")
		parts := strings.SplitN(authz, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			writeError(w, http.StatusUnauthorized, "missing bearer token")
			return
		}
		claims, err := auth.ParseJWT(parts[1], s.JWTSecret)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid token")
			return
		}
		ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
