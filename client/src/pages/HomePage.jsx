import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/http";

export default function HomePage() {
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    api.getPosts().then(setPosts).catch((err) => setError(err.message));
  }, []);

  const showCommentSuccess = searchParams.get("commentAdded") === "1";
  const showPostSuccess = searchParams.get("postAdded") === "1";
  const showProfileSuccess = searchParams.get("profileUpdated") === "1";
  const showRegistrationSuccess = searchParams.get("registered") === "1";

  return (
    <section className="page">
      <h1>Posts</h1>
      <div className="page-actions">
        <Link className="btn-secondary" to="/new-post">Add New Post</Link>
      </div>
      {showCommentSuccess && <p className="alert success">Comment added to the Post successfully!</p>}
      {showPostSuccess && <p className="alert success">Blog Post posted successfully!</p>}
      {showProfileSuccess && <p className="alert success">Profile updated successfully!</p>}
      {showRegistrationSuccess && <p className="alert success">Congrats! Your registration has been successful.</p>}
      {error && <p className="error">{error}</p>}
      <div className="list">
        {posts.length === 0 && !error && (
          <article className="card empty">
            <h2>No posts yet</h2>
            <p>Create your first blog post to populate the homepage.</p>
          </article>
        )}
        {posts.map((post) => (
          <article className="card" key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.description}</p>
            <p className="meta">By {post.authorName}</p>
            <p>{post.content.slice(0, 180)}{post.content.length > 180 ? "..." : ""}</p>
            <div className="meta-row">
              <p className="meta">Comments: {post.commentCount || 0}</p>
              <Link className="link-strong" to={`/posts/${post.id}`}>Blog listing</Link>
            </div>
            {post.latestComment && (
              <p className="meta">
                Latest comment by {post.latestCommentAuthor}: {post.latestComment}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
