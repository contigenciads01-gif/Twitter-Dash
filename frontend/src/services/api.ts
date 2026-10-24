import axios from "axios";

export const api = axios.create({
  baseURL: "/api"
});

// Recupera ou inicializa token JWT
let authToken = localStorage.getItem("twitter_dash_jwt") || "";

export function setAuthToken(token: string) {
  authToken = token;
  localStorage.setItem("twitter_dash_jwt", token);
}

export function getAuthToken() {
  return authToken;
}

// Interceptor de Requisições: adiciona Header Authorization
api.interceptors.request.use(async (config) => {
  if (!authToken && !config.url?.includes("/auth/login")) {
    try {
      // Login automático para ambiente dashboard
      const res = await axios.post("/api/auth/login", { password: "admin123" });
      if (res.data?.token) {
        setAuthToken(res.data.token);
      }
    } catch (_) {}
  }

  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Interceptor de Respostas
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorData = error.response?.data?.error;
    const message = errorData?.message || error.message || "Erro de comunicação com o servidor";
    return Promise.reject(new Error(message));
  }
);
