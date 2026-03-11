import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const validate = () => {
    const uErr = username.trim() ? "" : "The username is required and cannot be empty";
    const pErr = password.trim() ? "" : "The Password is required and cannot be empty";
    setUsernameError(uErr);
    setPasswordError(pErr);
    return !uErr && !pErr;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  const isDisabled = !username.trim() || !password.trim();

  return (
    <section className="panel page narrow">
      <h1>Login</h1>
      <p className="muted">Use your username and password to access the dashboard.</p>
      <form onSubmit={onSubmit} className="form">
        <input
          placeholder="username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            if (usernameError) setUsernameError("");
          }}
        />
        {usernameError && <p className="error">{usernameError}</p>}
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordError) setPasswordError("");
          }}
        />
        {passwordError && <p className="error">{passwordError}</p>}
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="submit" disabled={isDisabled}>Log In</button>
          <Link className="link-strong" to="/forgot-password">Forgot password?</Link>
        </div>
      </form>
    </section>
  );
}
