import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout({ children }) {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="brand">Simple Blog</Link>
        <nav className="nav">
          <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/">Posts</NavLink>
          {isAuthenticated && <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/dashboard">Dashboard</NavLink>}
          {isAuthenticated && <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/profile">My Profile</NavLink>}
          {isAuthenticated && <NavLink className={({ isActive }) => (isActive ? "active" : "")} to="/new-post">Add New Post</NavLink>}
        </nav>
        <div className="auth-block">
          {isAuthenticated ? (
            <>
              <span className="user-pill">{user?.displayName}</span>
              <Link className="chip-link" to="/login" onClick={logout}>Logout</Link>
            </>
          ) : (
            <>
              <Link className="chip-link" to="/login">Login</Link>
              <Link className="chip-link" to="/register">Register</Link>
            </>
          )}
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
