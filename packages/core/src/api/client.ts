import axios from "axios";

export const apiClient = axios.create({
  baseURL: process.env.VITE_API_URL || "http://localhost:3001",
});

apiClient.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("sb-token") : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
