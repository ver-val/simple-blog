import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/http";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromQuery = (searchParams.get("token") || "").trim();
  const [token, setToken] = useState(tokenFromQuery);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tokenFromQuery) {
      navigate("/forgot-password", {
        replace: true,
        state: { error: "Password reset token is invalid or has expired." },
      });
    }
  }, [navigate, tokenFromQuery]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = await api.resetPassword({ token, newPassword });
      setMessage(data.message);
      setToken("");
      setNewPassword("");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="panel page narrow">
      <h1>Reset Password</h1>
      <p className="muted">Use your token and set a new strong password.</p>
      <form onSubmit={onSubmit} className="form">
        <input placeholder="Reset token" value={token} onChange={(e) => setToken(e.target.value)} required />
        <input type="password" minLength={8} placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        {error && <p className="error">{error}</p>}
        {message && <p className="alert success">{message}</p>}
        <button type="submit">Reset password</button>
      </form>
    </section>
  );
}
