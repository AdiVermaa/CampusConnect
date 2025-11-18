import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import { setAccessToken, refresh } from "./api/auth";

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);

  // On first load, try to get an access token using the refresh cookie
  useEffect(() => {
    (async () => {
      try {
        const res = await refresh();
        if (res.data?.accessToken) {
          setAccessToken(res.data.accessToken);
        }
      } catch {
        // Ignore errors; user will just be treated as logged out
      }
      setAuthChecked(true);
    })();
  }, []);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600 text-lg">
        Loading...
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile/:userId" element={<Profile />} />
      </Routes>
    </Router>
  );
}
