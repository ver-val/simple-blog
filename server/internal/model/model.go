package model

import "time"

type User struct {
	ID          int64     `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"displayName"`
	Bio         string    `json:"bio,omitempty"`
	AvatarURL   string    `json:"avatarUrl,omitempty"`
	FirstName   string    `json:"firstName,omitempty"`
	LastName    string    `json:"lastName,omitempty"`
	Age         int       `json:"age,omitempty"`
	Gender      string    `json:"gender,omitempty"`
	Address     string    `json:"address,omitempty"`
	Website     string    `json:"website,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Post struct {
	ID                  int64     `json:"id"`
	AuthorID            int64     `json:"authorId"`
	AuthorName          string    `json:"authorName"`
	Title               string    `json:"title"`
	Description         string    `json:"description"`
	Content             string    `json:"content"`
	CommentCount        int64     `json:"commentCount"`
	LatestCommentAuthor string    `json:"latestCommentAuthor,omitempty"`
	LatestComment       string    `json:"latestComment,omitempty"`
	CreatedAt           time.Time `json:"createdAt"`
	UpdatedAt           time.Time `json:"updatedAt"`
}

type Comment struct {
	ID         int64     `json:"id"`
	PostID     int64     `json:"postId"`
	AuthorID   int64     `json:"authorId"`
	AuthorName string    `json:"authorName"`
	Content    string    `json:"content"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}
