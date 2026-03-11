import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/http";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      async login(username, password) {
        const data = await api.login({ username, password });
        setToken(data.token);
        setUser(data.user);
      },
      async register(username, email, password) {
        const data = await api.register({ email, password, displayName: username });
        setToken(data.token);
        setUser(data.user);
      },
      async refreshProfile() {
        if (!token) return;
        const me = await api.getMe(token);
        setUser(me);
      },
      logout() {
        setToken("");
        setUser(null);
      },
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
