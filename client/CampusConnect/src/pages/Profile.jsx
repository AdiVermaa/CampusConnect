import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { API, getAccessToken, clearAccessToken } from "../api/auth";

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    portfolio_link: "",
    linkedin_link: "",
    github_link: "",
    leetcode_link: "",
    bio: "",
    profile_photo: null,
  });
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      navigate("/login");
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await API.get(`/profile/${userId}`);
        const data = res.data;
        setProfile(data);
        setFormData({
          name: data.name || "",
          portfolio_link: data.portfolio_link || "",
          linkedin_link: data.linkedin_link || "",
          github_link: data.github_link || "",
          leetcode_link: data.leetcode_link || "",
          bio: data.bio || "",
          profile_photo: data.profile_photo || null,
        });
        setPhotoPreview(data.profile_photo || null);
      } catch (err) {
        console.error(err);
        setMessage("Failed to load profile");
        clearAccessToken();
        navigate("/login");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [userId, navigate]);

  const handleConnect = async () => {
    try {
      const res = await API.post(`/connect/${userId}`);
      const data = res.data;
      if (res.status === 200) {
        setMessage("Connected successfully!");
        // Refresh profile to update connection status
        const profileRes = await API.get(`/profile/${userId}`);
        setProfile(profileRes.data);
      } else {
        setMessage(data.error || "Failed to connect");
      }
    } catch (err) {
      setMessage("Failed to connect");
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setMessage("Please select an image file");
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage("Image size should be less than 5MB");
        return;
      }
      
      // Compress and resize image before converting to base64
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas to resize image
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = (height * MAX_WIDTH) / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = (width * MAX_HEIGHT) / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          // Draw and compress
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to base64 with compression (quality: 0.8)
          const base64String = canvas.toDataURL("image/jpeg", 0.8);
          setFormData({ ...formData, profile_photo: base64String });
          setPhotoPreview(base64String);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      const res = await API.put("/profile", formData);
      const data = res.data;
      if (res.status === 200) {
        setMessage("Profile updated successfully!");
        setIsEditing(false);
        // Refresh profile
        const profileRes = await API.get(`/profile/${userId}`);
        const profileData = profileRes.data;
        setProfile(profileData);
        setPhotoPreview(profileData.profile_photo || null);
      } else {
        setMessage(data.error || "Failed to update profile");
      }
    } catch (err) {
      setMessage("Failed to update profile");
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete your account? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const res = await API.delete("/delete-account");
      if (res.status === 200) {
        clearAccessToken();
        navigate("/login", { replace: true });
      } else if (res.data?.error) {
        setMessage(res.data.error || "Failed to delete account");
      }
    } catch (err) {
      setMessage("Failed to delete account");
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
              <div className="relative">
                <img
                  src={
                    isEditing && photoPreview
                      ? photoPreview
                      : profile.profile_photo
                      ? profile.profile_photo
                      : "https://rishihood.edu.in/wp-content/uploads/2023/09/student-profile-placeholder.png"
                  }
                  alt="Profile"
                  className="w-32 h-32 rounded-full border-4 border-red-500 object-cover"
                />
                {isEditing && profile.is_own_profile && (
                  <label className="absolute bottom-0 right-0 bg-red-600 text-white rounded-full p-2 cursor-pointer hover:bg-red-700 transition shadow-lg">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div>
                {isEditing && profile.is_own_profile ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="text-3xl font-bold text-gray-800 border-b-2 border-red-500 focus:outline-none bg-transparent"
                    placeholder="Your Name"
                  />
                ) : (
                  <h2 className="text-3xl font-bold text-gray-800">{profile.name}</h2>
                )}
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
        <div className="bg-white rounded-xl shadow p-6 mb-6">
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

        {/* Danger Zone */}
        {profile.is_own_profile && (
          <div className="bg-white rounded-xl shadow p-6 border border-red-200">
            <h3 className="text-xl font-semibold text-red-600 mb-2">
              Danger Zone
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Deleting your account will permanently remove your profile and
              connections. This action cannot be undone.
            </p>
            <button
              onClick={handleDeleteAccount}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Delete Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

