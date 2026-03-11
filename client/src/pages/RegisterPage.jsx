import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const validate = () => {
    const errors = {};
    if (!username.trim()) {
      errors.username = "The username is required and cannot be empty";
    } else if (!email.trim()) {
      errors.email = "The email is required and cannot be empty";
    } else if (!isValidEmail(email.trim())) {
      errors.email = "The email address is not valid";
    } else if (!confirmPassword.trim()) {
      errors.confirmPassword = "The confirm password is required and cannot be empty";
    } else if (password !== confirmPassword) {
      errors.password = "The password and its confirm are not the same";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    try {
      await register(username, email, password);
      navigate("/?registered=1");
    } catch (err) {
      setError(err.message);
    }
  };

  const isDisabled = !username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim();

  return (
    <section className="panel page narrow">
      <h1>Register</h1>
      <p className="muted">Create your account to publish posts and join discussions.</p>
      <form onSubmit={onSubmit} className="form">
        <input
          placeholder="username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            if (fieldErrors.username) setFieldErrors((prev) => ({ ...prev, username: "" }));
          }}
        />
        {fieldErrors.username && <p className="error">{fieldErrors.username}</p>}
        <input
          placeholder="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: "" }));
          }}
        />
        {fieldErrors.email && <p className="error">{fieldErrors.email}</p>}
        <input
          type="password"
          minLength={8}
          placeholder="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: "" }));
          }}
        />
        {fieldErrors.password && <p className="error">{fieldErrors.password}</p>}
        <input
          type="password"
          minLength={8}
          placeholder="confirm password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
          }}
        />
        {fieldErrors.confirmPassword && <p className="error">{fieldErrors.confirmPassword}</p>}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={isDisabled}>Register Now</button>
      </form>
    </section>
  );
}
