import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../config";

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    portfolio_link: "",
    linkedin_link: "",
    github_link: "",
    leetcode_link: "",
    bio: "",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setProfile(data);
        setFormData({
          portfolio_link: data.portfolio_link || "",
          linkedin_link: data.linkedin_link || "",
          github_link: data.github_link || "",
          leetcode_link: data.leetcode_link || "",
          bio: data.bio || "",
        });
      } catch (err) {
        console.error(err);
        setMessage("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [userId, navigate]);

  const handleConnect = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/connect/${userId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Connected successfully!");
        // Refresh profile to update connection status
        const profileRes = await fetch(`${API_BASE_URL}/api/auth/profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const profileData = await profileRes.json();
        if (profileRes.ok) {
          setProfile(profileData);
        }
      } else {
        setMessage(data.error || "Failed to connect");
      }
    } catch (err) {
      setMessage("Failed to connect");
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Profile updated successfully!");
        setIsEditing(false);
        // Refresh profile
        const profileRes = await fetch(`${API_BASE_URL}/api/auth/profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const profileData = await profileRes.json();
        if (profileRes.ok) {
          setProfile(profileData);
        }
      } else {
        setMessage(data.error || "Failed to update profile");
      }
    } catch (err) {
      setMessage("Failed to update profile");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600 text-lg">
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600 text-lg">
        Profile not found
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Navbar */}
      <nav className="bg-white shadow px-6 py-3 flex justify-between items-center sticky top-0 z-10">
        <h1
          className="text-2xl font-bold text-red-600 cursor-pointer"
          onClick={() => navigate("/dashboard")}
        >
          CampusConnect
        </h1>
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
        >
          Back to Dashboard
        </button>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        {/* Profile Header */}
        <div className="bg-white rounded-xl shadow p-8 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              <img
                src="https://rishihood.edu.in/wp-content/uploads/2023/09/student-profile-placeholder.png"
                alt="Profile"
                className="w-32 h-32 rounded-full border-4 border-red-500"
              />
              <div>
                <h2 className="text-3xl font-bold text-gray-800">{profile.name}</h2>
                <p className="text-gray-600 mt-1">{profile.department || "Student"}</p>
                <p className="text-sm text-gray-500 mt-1">{profile.email}</p>
                <p className="text-sm text-gray-500">Batch: {profile.year || "N/A"}</p>
                <p className="text-sm text-gray-700 mt-2">
                  Connections: <span className="font-semibold">{profile.connections_count}</span>
                </p>
              </div>
            </div>
            {profile.is_own_profile ? (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition"
              >
                {isEditing ? "Cancel" : "Edit Profile"}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={profile.is_connected}
                className={`px-6 py-2 rounded-lg transition ${
                  profile.is_connected
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {profile.is_connected ? "Connected" : "Connect"}
              </button>
            )}
          </div>
        </div>

        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {message}
          </div>
        )}

        {/* Bio Section */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">About</h3>
          {isEditing ? (
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Tell us about yourself..."
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none resize-none"
              rows="4"
            />
          ) : (
            <p className="text-gray-700">{profile.bio || "No bio added yet."}</p>
          )}
        </div>

        {/* Links Section */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Links</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Portfolio Link
              </label>
              {isEditing ? (
                <input
                  type="url"
                  value={formData.portfolio_link}
                  onChange={(e) => setFormData({ ...formData, portfolio_link: e.target.value })}
                  placeholder="https://yourportfolio.com"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                />
              ) : (
                <div>
                  {profile.portfolio_link ? (
                    <a
                      href={profile.portfolio_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:underline"
                    >
                      {profile.portfolio_link}
                    </a>
                  ) : (
                    <p className="text-gray-500">Not added</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
              {isEditing ? (
                <input
                  type="url"
                  value={formData.linkedin_link}
                  onChange={(e) => setFormData({ ...formData, linkedin_link: e.target.value })}
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                />
              ) : (
                <div>
                  {profile.linkedin_link ? (
                    <a
                      href={profile.linkedin_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:underline"
                    >
                      {profile.linkedin_link}
                    </a>
                  ) : (
                    <p className="text-gray-500">Not added</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GitHub</label>
              {isEditing ? (
                <input
                  type="url"
                  value={formData.github_link}
                  onChange={(e) => setFormData({ ...formData, github_link: e.target.value })}
                  placeholder="https://github.com/yourusername"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                />
              ) : (
                <div>
                  {profile.github_link ? (
                    <a
                      href={profile.github_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:underline"
                    >
                      {profile.github_link}
                    </a>
                  ) : (
                    <p className="text-gray-500">Not added</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LeetCode</label>
              {isEditing ? (
                <input
                  type="url"
                  value={formData.leetcode_link}
                  onChange={(e) => setFormData({ ...formData, leetcode_link: e.target.value })}
                  placeholder="https://leetcode.com/yourusername"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                />
              ) : (
                <div>
                  {profile.leetcode_link ? (
                    <a
                      href={profile.leetcode_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:underline"
                    >
                      {profile.leetcode_link}
                    </a>
                  ) : (
                    <p className="text-gray-500">Not added</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {isEditing && (
            <button
              onClick={handleSave}
              className="mt-6 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition"
            >
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

