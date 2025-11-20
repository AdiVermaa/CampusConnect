import axios from "axios";
import { API_BASE_URL } from "../config";

// In-memory access token storage
let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const clearAccessToken = () => {
  accessToken = null;
};

export const getAccessToken = () => accessToken;

// If a request fails with 401, try to refresh the access token once
let isRefreshing = false;
let pendingRequests = [];

const processQueue = (error, token = null) => {
  pendingRequests.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  pendingRequests = [];
};

const attachInterceptors = (client) => {
  client.interceptors.request.use((config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (
        error.response &&
        error.response.status === 401 &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true;

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            pendingRequests.push({
              resolve: (token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(client(originalRequest));
              },
              reject,
            });
          });
        }

        isRefreshing = true;

        try {
          const res = await axios.post(
            `${API_BASE_URL}/api/auth/refresh`,
            {},
            { withCredentials: true }
          );
          const newToken = res.data.accessToken;
          setAccessToken(newToken);
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          clearAccessToken();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    }
  );
};

const createApiClient = (basePath) => {
  const instance = axios.create({
    baseURL: `${API_BASE_URL}${basePath}`,
    withCredentials: true,
  });
  attachInterceptors(instance);
  return instance;
};

export const API = createApiClient("/api/auth");
export const PostsAPI = createApiClient("/api/posts");

export const signup = (data) => API.post("/signup", data);
export const login = (data) => API.post("/login", data);
export const refresh = () =>
  axios.post(`${API_BASE_URL}/api/auth/refresh`, {}, { withCredentials: true });
