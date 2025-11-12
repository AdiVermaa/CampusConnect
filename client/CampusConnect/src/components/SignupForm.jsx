import { useState } from "react";
import { signup } from "../api/auth";
import { useNavigate, Link } from "react-router-dom"; // 👈 Add this import

export default function SignupForm() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const navigate = useNavigate(); // 👈 Initialize navigation

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await signup(form);
      setMessage(res.data.message);

      // 👇 If signup is successful, redirect to login
      if (res.data.message.includes("successful")) {
        setTimeout(() => navigate("/login"), 1500);
      }
    } catch (err) {
      const error = err.response?.data?.error || "Something went wrong";
      setMessage(error);

      // 👇 If user already registered, redirect to login automatically
      if (error.includes("already registered")) {
        setTimeout(() => navigate("/login"), 1500);
      }
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "auto", marginTop: 100, textAlign: "center" }}>
      <h2>CampusConnect Signup</h2>
      <form onSubmit={handleSubmit}>
        <input
          name="name"
          placeholder="Full Name"
          value={form.name}
          onChange={handleChange}
          required
        />
        <input
          name="email"
          placeholder="College Email"
          value={form.email}
          onChange={handleChange}
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
        />
        <button type="submit">Sign Up</button>
      </form>

      {/* 👇 This part is new */}
      <p style={{ marginTop: 10 }}>{message}</p>
      <p>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "blue" }}>
          Login here
        </Link>
      </p>
    </div>
  );
}
