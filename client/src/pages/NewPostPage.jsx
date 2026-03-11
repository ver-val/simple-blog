import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/http";
import { useAuth } from "../context/AuthContext";

export default function NewPostPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.createPost({ title, description, body }, token);
      navigate("/?postAdded=1");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="panel page">
      <h1>Add New Post</h1>
      <p className="muted">Share a clear title, short description and meaningful body text.</p>
      <form onSubmit={onSubmit} className="form">
        <input placeholder="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input
          placeholder="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <textarea placeholder="body" value={body} onChange={(e) => setBody(e.target.value)} rows={8} required />
        {error && <p className="error">{error}</p>}
        <button type="submit">Add Post</button>
      </form>
    </section>
  );
}
