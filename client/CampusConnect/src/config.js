const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5001";

// Ensure we don't end up with a trailing slash to keep fetch calls consistent
const API_BASE_URL = rawApiUrl.replace(/\/$/, "");

export { API_BASE_URL };


