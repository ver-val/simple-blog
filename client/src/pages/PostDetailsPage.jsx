import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/http";
import { useAuth } from "../context/AuthContext";

export default function PostDetailsPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, token, user } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [name, setName] = useState(user?.displayName || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.getPost(postId);
      setPost(data.post);
      setComments(data.comments || []);
    } catch (err) {
      setError(err.message);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const onComment = async (e) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    try {
      await api.createComment(postId, { name, message }, token);
      navigate("/?commentAdded=1");
    } catch (err) {
      setError(err.message);
    }
  };

  if (!post) return <p>{error || "Loading..."}</p>;

  return (
    <section className="page">
      <article className="panel card">
        <h1>{post.title}</h1>
        <p className="meta">By {post.authorName}</p>
        <p>{post.content}</p>
      </article>

      <h2>Comments</h2>
      <div className="list">
        {comments.length === 0 && (
          <article className="card empty">
            <p>No comments yet. Be the first to add one.</p>
          </article>
        )}
        {comments.map((comment) => (
          <article className="card" key={comment.id}>
            <p>{comment.content}</p>
            <p className="meta">{comment.authorName}</p>
          </article>
        ))}
      </div>

      {isAuthenticated && (
        <form onSubmit={onComment} className="form panel comment-form">
          <h3>Add Comment</h3>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="name"
            required
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="message"
            rows={4}
            required
          />
          <button type="submit">Add Comment</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
