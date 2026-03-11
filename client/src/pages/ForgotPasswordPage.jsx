import { useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/http";

export default function ForgotPasswordPage() {
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const routeError = location.state?.error || "";

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setToken("");
    try {
      const data = await api.forgotPassword({ email });
      setMessage(data.message || "Request accepted");
      if (data.debugToken) setToken(data.debugToken);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="panel page narrow">
      <h1>Forgot Password</h1>
      <p className="muted">Enter your email to generate a password reset token.</p>
      <form onSubmit={onSubmit} className="form">
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {routeError && !error && <p className="error">{routeError}</p>}
        {error && <p className="error">{error}</p>}
        {message && <p className="alert success">{message}</p>}
        {token && <p className="hint">Debug reset token: <code>{token}</code></p>}
        <button type="submit">Submit</button>
      </form>
    </section>
  );
}
