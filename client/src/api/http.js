const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

async function request(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export const api = {
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  forgotPassword: (payload) => request("/auth/forgot-password", { method: "POST", body: payload }),
  resetPassword: (payload) => request("/auth/reset-password", { method: "POST", body: payload }),

  getPosts: () => request("/posts"),
  getPost: (id) => request(`/posts/${id}`),
  createPost: (payload, token) => request("/posts", { method: "POST", body: payload, token }),

  getComments: (postId) => request(`/posts/${postId}/comments`),
  createComment: (postId, payload, token) =>
    request(`/posts/${postId}/comments`, { method: "POST", body: payload, token }),

  getMe: (token) => request("/profile/me", { token }),
  updateMe: (payload, token) => request("/profile/me", { method: "PUT", body: payload, token }),
  getUserPosts: (userId) => request(`/users/${userId}/posts`),
};
