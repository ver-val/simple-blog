import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/http";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const [myPosts, setMyPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([api.getUserPosts(user.id), api.getPosts()])
      .then(([mine, all]) => {
        setMyPosts(mine || []);
        setAllPosts(all || []);
      })
      .catch((err) => setError(err.message));
  }, [user?.id]);

  const summary = useMemo(() => {
    const commentsOnMine = myPosts.reduce((acc, post) => acc + (post.commentCount || 0), 0);
    return {
      posts: myPosts.length,
      commentsOnMine,
      totalPosts: allPosts.length,
    };
  }, [myPosts, allPosts]);

  return (
    <section className="page">
      <h1>Dashboard</h1>
      <p className="muted">Quick overview of your activity and shortcuts.</p>
      {error && <p className="error">{error}</p>}

      <div className="stats-grid">
        <article className="card stat-card">
          <p className="meta">My Posts</p>
          <h2>{summary.posts}</h2>
        </article>
        <article className="card stat-card">
          <p className="meta">Comments On My Posts</p>
          <h2>{summary.commentsOnMine}</h2>
        </article>
        <article className="card stat-card">
          <p className="meta">Total Posts In Blog</p>
          <h2>{summary.totalPosts}</h2>
        </article>
      </div>

      <div className="page-actions dashboard-actions">
        <Link className="btn-create" to="/new-post">
          <span className="btn-create-icon">+</span>
          <span>Create New Post</span>
        </Link>
        <Link className="btn-secondary" to="/profile">Edit Profile</Link>
      </div>

      <h2 className="section-title">Recent My Posts</h2>
      <div className="list">
        {myPosts.length === 0 && (
          <article className="card empty">
            <p>You have no posts yet. Start by creating one.</p>
          </article>
        )}
        {myPosts.slice(0, 5).map((post) => (
          <article className="card" key={post.id}>
            <h3>{post.title}</h3>
            <p className="meta">Comments: {post.commentCount || 0}</p>
            <p>{post.description}</p>
            <Link className="link-strong" to={`/posts/${post.id}`}>Open post</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
