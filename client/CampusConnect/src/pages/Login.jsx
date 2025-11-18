import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { setAccessToken } from "../api/auth";


export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const navigate = useNavigate(); // ✅ add this

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // send/receive cookies
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok) {
        // ✅ Save access token in memory only & redirect
        setAccessToken(data.accessToken);
        setMessage("Login successful! Redirecting...");
        navigate("/dashboard", { replace: true });
      } else {
        setMessage(data.error || "Login failed");
      }
    } catch (err) {
      setMessage("Something went wrong. Please try again.");
    }
  };


  return (
    <div className="flex min-h-screen bg-gray-100">
      <div className="hidden lg:flex w-1/2 bg-cover bg-center" style={{ backgroundImage: "url('https://rishihood.edu.in/wp-content/uploads/2022/08/Rishihood_University_Campus.jpg')" }}>
        <div className="flex items-center justify-center bg-black bg-opacity-50 w-full">
          <h1 className="text-white text-5xl font-bold">Welcome Back</h1>
        </div>
      </div>

      <div className="flex w-full lg:w-1/2 items-center justify-center px-8 py-12">
        <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md">
          <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">Login</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <input
              type="email"
              name="email"
              placeholder="College Email"
              value={form.email}
              onChange={handleChange}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
            <button
              type="submit"
              className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition"
            >
              Login
            </button>
          </form>
          {message && <p className="mt-4 text-center text-sm text-red-600">{message}</p>}
          <p className="text-center text-sm text-gray-600 mt-6">
            Don’t have an account?{" "}
            <a href="/signup" className="text-red-600 hover:underline">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
