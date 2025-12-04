const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5001";

const API_BASE_URL = rawApiUrl.replace(/\/$/, "");

export { API_BASE_URL };
