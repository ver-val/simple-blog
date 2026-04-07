package api

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"blog-server/internal/model"
)

type mockStore struct {
	createUserFn            func(ctx context.Context, email, passwordHash, displayName string) (model.User, error)
	getUserAuthByEmailFn    func(ctx context.Context, email string) (int64, string, error)
	getUserAuthByUsernameFn func(ctx context.Context, username string) (int64, string, error)
	getUserByIDFn           func(ctx context.Context, userID int64) (model.User, error)
	updateUserProfileFn     func(ctx context.Context, userID int64, firstName, lastName string, age int, gender, address, website, bio, avatarURL string) (model.User, error)
	createResetTokenFn      func(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time) error
	consumeResetTokenFn     func(ctx context.Context, tokenHash string) (int64, error)
	updatePasswordFn        func(ctx context.Context, userID int64, passwordHash string) error
	createPostFn            func(ctx context.Context, authorID int64, title, description, content string) (model.Post, error)
	listPostsFn             func(ctx context.Context) ([]model.Post, error)
	getPostFn               func(ctx context.Context, postID int64) (model.Post, error)
	listPostsByAuthorFn     func(ctx context.Context, authorID int64) ([]model.Post, error)
	createCommentFn         func(ctx context.Context, postID, authorID int64, authorName, content string) (model.Comment, error)
	listCommentsByPostFn    func(ctx context.Context, postID int64) ([]model.Comment, error)
}

func (m mockStore) CreateUser(ctx context.Context, email, passwordHash, displayName string) (model.User, error) {
	return m.createUserFn(ctx, email, passwordHash, displayName)
}

func (m mockStore) GetUserAuthByEmail(ctx context.Context, email string) (int64, string, error) {
	return m.getUserAuthByEmailFn(ctx, email)
}

func (m mockStore) GetUserAuthByUsername(ctx context.Context, username string) (int64, string, error) {
	return m.getUserAuthByUsernameFn(ctx, username)
}

func (m mockStore) GetUserByID(ctx context.Context, userID int64) (model.User, error) {
	return m.getUserByIDFn(ctx, userID)
}

func (m mockStore) UpdateUserProfile(ctx context.Context, userID int64, firstName, lastName string, age int, gender, address, website, bio, avatarURL string) (model.User, error) {
	return m.updateUserProfileFn(ctx, userID, firstName, lastName, age, gender, address, website, bio, avatarURL)
}

func (m mockStore) CreateResetToken(ctx context.Context, userID int64, tokenHash string, expiresAt time.Time) error {
	return m.createResetTokenFn(ctx, userID, tokenHash, expiresAt)
}

func (m mockStore) ConsumeResetToken(ctx context.Context, tokenHash string) (int64, error) {
	return m.consumeResetTokenFn(ctx, tokenHash)
}

func (m mockStore) UpdatePassword(ctx context.Context, userID int64, passwordHash string) error {
	return m.updatePasswordFn(ctx, userID, passwordHash)
}

func (m mockStore) CreatePost(ctx context.Context, authorID int64, title, description, content string) (model.Post, error) {
	return m.createPostFn(ctx, authorID, title, description, content)
}

func (m mockStore) ListPosts(ctx context.Context) ([]model.Post, error) {
	return m.listPostsFn(ctx)
}

func (m mockStore) GetPost(ctx context.Context, postID int64) (model.Post, error) {
	return m.getPostFn(ctx, postID)
}

func (m mockStore) ListPostsByAuthor(ctx context.Context, authorID int64) ([]model.Post, error) {
	return m.listPostsByAuthorFn(ctx, authorID)
}

func (m mockStore) CreateComment(ctx context.Context, postID, authorID int64, authorName, content string) (model.Comment, error) {
	return m.createCommentFn(ctx, postID, authorID, authorName, content)
}

func (m mockStore) ListCommentsByPost(ctx context.Context, postID int64) ([]model.Comment, error) {
	return m.listCommentsByPostFn(ctx, postID)
}

func newTestServer(t *testing.T, store mockStore) *Server {
	t.Helper()

	noUser := func(context.Context, int64) (model.User, error) { return model.User{}, errors.New("unexpected call") }
	noUserAuth := func(context.Context, string) (int64, string, error) { return 0, "", errors.New("unexpected call") }
	noPostList := func(context.Context) ([]model.Post, error) { return nil, errors.New("unexpected call") }
	noPost := func(context.Context, int64) (model.Post, error) { return model.Post{}, errors.New("unexpected call") }
	noCommentList := func(context.Context, int64) ([]model.Comment, error) { return nil, errors.New("unexpected call") }

	if store.createUserFn == nil {
		store.createUserFn = func(context.Context, string, string, string) (model.User, error) {
			return model.User{}, errors.New("unexpected call")
		}
	}
	if store.getUserAuthByEmailFn == nil {
		store.getUserAuthByEmailFn = noUserAuth
	}
	if store.getUserAuthByUsernameFn == nil {
		store.getUserAuthByUsernameFn = noUserAuth
	}
	if store.getUserByIDFn == nil {
		store.getUserByIDFn = noUser
	}
	if store.updateUserProfileFn == nil {
		store.updateUserProfileFn = func(context.Context, int64, string, string, int, string, string, string, string, string) (model.User, error) {
			return model.User{}, errors.New("unexpected call")
		}
	}
	if store.createResetTokenFn == nil {
		store.createResetTokenFn = func(context.Context, int64, string, time.Time) error { return errors.New("unexpected call") }
	}
	if store.consumeResetTokenFn == nil {
		store.consumeResetTokenFn = func(context.Context, string) (int64, error) { return 0, errors.New("unexpected call") }
	}
	if store.updatePasswordFn == nil {
		store.updatePasswordFn = func(context.Context, int64, string) error { return errors.New("unexpected call") }
	}
	if store.createPostFn == nil {
		store.createPostFn = func(context.Context, int64, string, string, string) (model.Post, error) {
			return model.Post{}, errors.New("unexpected call")
		}
	}
	if store.listPostsFn == nil {
		store.listPostsFn = noPostList
	}
	if store.getPostFn == nil {
		store.getPostFn = noPost
	}
	if store.listPostsByAuthorFn == nil {
		store.listPostsByAuthorFn = func(context.Context, int64) ([]model.Post, error) { return nil, errors.New("unexpected call") }
	}
	if store.createCommentFn == nil {
		store.createCommentFn = func(context.Context, int64, int64, string, string) (model.Comment, error) {
			return model.Comment{}, errors.New("unexpected call")
		}
	}
	if store.listCommentsByPostFn == nil {
		store.listCommentsByPostFn = noCommentList
	}

	return NewServer(store, "test-secret", time.Hour, time.Hour, "http://localhost:5173", log.New(&strings.Builder{}, "", 0))
}

func TestCreatePostRejectsInvalidPayload(t *testing.T) {
	srv := newTestServer(t, mockStore{})
	req := httptest.NewRequest(http.MethodPost, "/api/posts", strings.NewReader(`{"title":"  ","description":"desc","body":"text"}`))
	req = req.WithContext(context.WithValue(req.Context(), userIDKey, int64(7)))
	rec := httptest.NewRecorder()

	srv.createPost(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
	if body := strings.TrimSpace(rec.Body.String()); body != `{"error":"title, description and body are required"}` {
		t.Fatalf("unexpected body: %s", body)
	}
}

func TestCreatePostUsesBodyAsContentAndCallsStore(t *testing.T) {
	var called bool
	var gotAuthorID int64
	var gotTitle, gotDescription, gotContent string
	now := time.Now()
	srv := newTestServer(t, mockStore{
		createPostFn: func(ctx context.Context, authorID int64, title, description, content string) (model.Post, error) {
			called = true
			gotAuthorID = authorID
			gotTitle = title
			gotDescription = description
			gotContent = content
			return model.Post{
				ID:          10,
				AuthorID:    authorID,
				Title:       title,
				Description: description,
				Content:     content,
				CreatedAt:   now,
				UpdatedAt:   now,
			}, nil
		},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/posts", strings.NewReader(`{"title":"  Title  ","description":"  Desc ","body":"  Body text  "}`))
	req = req.WithContext(context.WithValue(req.Context(), userIDKey, int64(42)))
	rec := httptest.NewRecorder()

	srv.createPost(rec, req)

	if !called {
		t.Fatal("expected CreatePost to be called")
	}
	if gotAuthorID != 42 || gotTitle != "Title" || gotDescription != "Desc" || gotContent != "Body text" {
		t.Fatalf("unexpected store args: authorID=%d title=%q description=%q content=%q", gotAuthorID, gotTitle, gotDescription, gotContent)
	}
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d", http.StatusCreated, rec.Code)
	}

	var post model.Post
	if err := json.Unmarshal(rec.Body.Bytes(), &post); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if post.ID != 10 || post.Content != "Body text" {
		t.Fatalf("unexpected response payload: %+v", post)
	}
}

func TestCreatePostReturnsInternalServerErrorOnStoreFailure(t *testing.T) {
	srv := newTestServer(t, mockStore{
		createPostFn: func(ctx context.Context, authorID int64, title, description, content string) (model.Post, error) {
			return model.Post{}, errors.New("db down")
		},
	})
	req := httptest.NewRequest(http.MethodPost, "/api/posts", strings.NewReader(`{"title":"Title","description":"Desc","content":"Body text"}`))
	req = req.WithContext(context.WithValue(req.Context(), userIDKey, int64(9)))
	rec := httptest.NewRecorder()

	srv.createPost(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected status %d, got %d", http.StatusInternalServerError, rec.Code)
	}
	if body := strings.TrimSpace(rec.Body.String()); body != `{"error":"failed to create post"}` {
		t.Fatalf("unexpected body: %s", body)
	}
}
