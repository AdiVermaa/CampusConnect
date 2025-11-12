import axios from "axios";
import { API_BASE_URL } from "../config";

const API = axios.create({
  baseURL: `${API_BASE_URL}/api/auth`,
});

export const signup = (data) => API.post("/signup", data);
export const login = (data) => API.post("/login", data);
