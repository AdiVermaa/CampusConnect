import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Messages from "./pages/Messages";
import Events from "./pages/Events";
import Network from "./pages/Network";
import Admin from "./pages/Admin";
import { setAccessToken, refresh, getAccessToken } from "./api/auth";
import { ThemeProvider } from "./context/ThemeContext";
import { SocketProvider } from "./contexts/SocketContext";

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await refresh();
        if (res.data?.accessToken) {
          setAccessToken(res.data.accessToken);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
      setAuthChecked(true);
    })();
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      const token = getAccessToken();
      setIsAuthenticated(!!token);
    };

    checkAuth();
    window.addEventListener('storage', checkAuth);

    window.addEventListener('tokenUpdated', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('tokenUpdated', checkAuth);
    };
  }, []);

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600 text-lg">
        Loading...
      </div>
    );
  }

  return (
    <ThemeProvider>
      {isAuthenticated ? (
        <SocketProvider>
          <Router>
            <Routes>
              <Route
                path="/"
                element={<Navigate to="/dashboard" replace />}
              />
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile/:userId" element={<Profile />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/events" element={<Events />} />
              <Route path="/network" element={<Network />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </Router>
        </SocketProvider>
      ) : (
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      )}
    </ThemeProvider>
  );
}
