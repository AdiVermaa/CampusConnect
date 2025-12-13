import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { API, ConnectionsAPI, getAccessToken, clearAccessToken } from "../api/auth";

import cacheManager, { CACHE_KEYS } from "../utils/cacheManager";
import ConfirmationModal from "../components/ConfirmationModal";
import Toast from "../components/Toast";

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);
  const [connectionsList, setConnectionsList] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: null,
    targetId: null,
    targetName: null,
    title: "",
    message: "",
    isDanger: false,
    confirmText: "Confirm"
  });
  const [toast, setToast] = useState({
    isOpen: false,
    message: "",
    type: "success"
  });

  const showToast = (message, type = "success") => {
    setToast({ isOpen: true, message, type });
  };

  const handleViewConnections = async () => {
    setShowConnectionsModal(true);
    setLoadingConnections(true);
    try {
      const res = await ConnectionsAPI.get(`/user/${userId}`);
      setConnectionsList(res.data.connections || []);
    } catch (err) {
      console.error("Failed to fetch connections:", err);
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleRemoveConnection = (targetUserId, userName) => {
    setModalConfig({
      isOpen: true,
      type: 'remove_connection',
      targetId: targetUserId,
      targetName: userName,
      title: "Remove Connection",
      message: `Are you sure you want to remove ${userName} from your connections?`,
      isDanger: true,
      confirmText: "Remove"
    });
  };

  const handleDeleteAccount = () => {
    setModalConfig({
      isOpen: true,
      type: 'delete_account',
      title: "Delete Account",
      message: "Are you sure you want to permanently delete your account? This action cannot be undone.",
      isDanger: true,
      confirmText: "Delete Account"
    });
  };

  const handleConfirmAction = async () => {
    const { type, targetId, targetName } = modalConfig;

    if (type === 'remove_connection') {
      try {
        await ConnectionsAPI.delete(`/${targetId}`);
        setConnectionsList(prev => prev.filter(conn => conn.user.id !== targetId));
        setProfile(prev => ({
          ...prev,
          connections_count: Math.max(0, (prev.connections_count || 0) - 1)
        }));
        
        if (profile.is_own_profile) {
            const cacheKey = CACHE_KEYS.USER_DATA(userId);
            const cachedData = cacheManager.get(cacheKey);
            if (cachedData) {
                cacheManager.set(cacheKey, {
                    ...cachedData,
                    connections_count: Math.max(0, (cachedData.connections_count || 0) - 1)
                });
            }
        }
        showToast(`Removed ${targetName} from connections`);
      } catch (err) {
        console.error("Failed to remove connection:", err);
        showToast("Failed to remove connection", "error");
      }
    } else if (type === 'delete_account') {
      try {
        const res = await API.delete("/delete-account");
        if (res.status === 200) {
          clearAccessToken();
          navigate("/login", { replace: true });
        } else if (res.data?.error) {
          showToast(res.data.error || "Failed to delete account", "error");
        }
      } catch (err) {
        showToast("Failed to delete account", "error");
      }
    }
    setModalConfig({ ...modalConfig, isOpen: false });
  };

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      navigate("/login");
      return;
    }

    const fetchProfile = async () => {
      try {
        const cacheKey = CACHE_KEYS.USER_DATA(userId);
        const cachedProfile = cacheManager.get(cacheKey);
        
        if (cachedProfile) {
          setProfile(cachedProfile);
          setFormData({
            name: cachedProfile.name || "",
            portfolio_link: cachedProfile.portfolio_link || "",
            linkedin_link: cachedProfile.linkedin_link || "",
            github_link: cachedProfile.github_link || "",
            leetcode_link: cachedProfile.leetcode_link || "",
            bio: cachedProfile.bio || "",
            profile_photo: cachedProfile.profile_photo || null,
          });
          setPhotoPreview(cachedProfile.profile_photo || null);
          setIsLoading(false);
          return;
        }

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
        cacheManager.set(cacheKey, data);
      } catch (err) {
        console.error(err);
        setMessage("Failed to load profile");
        if (err.response?.status === 401 || err.response?.status === 403) {
            clearAccessToken();
            navigate("/login");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [userId, navigate]);

  const handleConnect = async () => {
    try {
      const res = await ConnectionsAPI.post(`/${userId}`);
      if (res.status === 201) {
        showToast("Connection request sent!");
        setProfile(prev => ({ ...prev, connection_status: 'pending_sent' }));
      } else {
        showToast(res.data.error || "Failed to connect", "error");
      }
    } catch (err) {
      showToast("Failed to connect", "error");
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        showToast("Please select an image file", "error");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast("Image size should be less than 5MB", "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

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

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

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
        showToast("Profile updated successfully!");
        setIsEditing(false);
        const profileRes = await API.get(`/profile/${userId}`);
        const profileData = profileRes.data;
        setProfile(profileData);
        setPhotoPreview(profileData.profile_photo || null);
        cacheManager.set(CACHE_KEYS.USER_DATA(userId), profileData);
        // Also update current user profile if it's the own profile
        if (profile.is_own_profile) {
            cacheManager.set(CACHE_KEYS.USER_PROFILE, profileData);
        }
      } else {
        showToast(data.error || "Failed to update profile", "error");
      }
    } catch (err) {
      showToast("Failed to update profile", "error");
    }
  };



  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600 dark:text-gray-300 text-lg bg-gray-100 dark:bg-gray-900">
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600 dark:text-gray-300 text-lg bg-gray-100 dark:bg-gray-900">
        Profile not found
      </div>
    );
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-900 min-h-screen transition-colors duration-200">
      <nav className="bg-white dark:bg-gray-800 shadow px-4 sm:px-6 py-3 flex justify-between items-center sticky top-0 z-10 transition-colors duration-200">
        <h1
          className="text-2xl font-bold text-red-600 cursor-pointer"
          onClick={() => navigate("/dashboard")}
        >
          CampusConnect
        </h1>
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          Back to Dashboard
        </button>
      </nav>

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 sm:p-8 mb-6 transition-colors duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 w-full">
              <div className="relative">
                {(isEditing && photoPreview) || profile.profile_photo ? (
                  <img
                    src={
                      isEditing && photoPreview
                        ? photoPreview
                        : profile.profile_photo
                    }
                    alt="Profile"
                    className="w-32 h-32 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-red-600 dark:bg-red-400 flex items-center justify-center text-white text-4xl font-bold">
                    {profile.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
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
              <div className="text-center sm:text-left">
                {isEditing && profile.is_own_profile ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="text-3xl font-bold text-gray-800 dark:text-white border-b-2 border-red-500 focus:outline-none bg-transparent"
                    placeholder="Your Name"
                  />
                ) : (
                  <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{profile.name}</h2>
                )}
                <p className="text-gray-600 dark:text-gray-300 mt-1">{profile.department || "Student"}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{profile.email}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Batch: {profile.year || "N/A"}</p>
                <p
                  className="text-sm text-gray-700 dark:text-gray-300 mt-2 cursor-pointer hover:text-red-600 dark:hover:text-red-400 transition"
                  onClick={handleViewConnections}
                >
                  Connections: <span className="font-semibold">{profile.connections_count}</span>
                </p>
              </div>
            </div>
            <div className="w-full sm:w-auto flex justify-center sm:justify-end mt-4 sm:mt-0">
              {profile.is_own_profile ? (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition w-full sm:w-auto"
                >
                  {isEditing ? "Cancel" : "Edit Profile"}
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={profile.connection_status !== 'none'}
                  className={`px-6 py-2 rounded-lg transition w-full sm:w-auto ${
                    profile.connection_status === 'connected'
                      ? "bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                      : profile.connection_status === 'pending_sent'
                      ? "bg-yellow-100 text-yellow-700 cursor-not-allowed"
                      : profile.connection_status === 'pending_received'
                      ? "bg-blue-100 text-blue-700 cursor-not-allowed"
                      : "bg-red-600 text-white hover:bg-red-700"
                    }`}
                >
                  {profile.connection_status === 'connected' ? "Connected" 
                   : profile.connection_status === 'pending_sent' ? "Request Sent"
                   : profile.connection_status === 'pending_received' ? "Request Received"
                   : "Connect"}
                </button>
              )}
            </div>
          </div>
        </div>



        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-6 transition-colors duration-200">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">About</h3>
          {isEditing ? (
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Tell us about yourself..."
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none resize-none dark:bg-gray-700 dark:text-white dark:border-gray-600"
              rows="4"
            />
          ) : (
            <p className="text-gray-700 dark:text-gray-300">{profile.bio || "No bio added yet."}</p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-6 transition-colors duration-200">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Links</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Portfolio Link
              </label>
              {isEditing ? (
                <input
                  type="url"
                  value={formData.portfolio_link}
                  onChange={(e) => setFormData({ ...formData, portfolio_link: e.target.value })}
                  placeholder="https://yourportfolio.com"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
              ) : (
                <div>
                  {profile.portfolio_link ? (
                    <a
                      href={profile.portfolio_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      {profile.portfolio_link}
                    </a>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">Not added</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">LinkedIn</label>
              {isEditing ? (
                <input
                  type="url"
                  value={formData.linkedin_link}
                  onChange={(e) => setFormData({ ...formData, linkedin_link: e.target.value })}
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
              ) : (
                <div>
                  {profile.linkedin_link ? (
                    <a
                      href={profile.linkedin_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      {profile.linkedin_link}
                    </a>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">Not added</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GitHub</label>
              {isEditing ? (
                <input
                  type="url"
                  value={formData.github_link}
                  onChange={(e) => setFormData({ ...formData, github_link: e.target.value })}
                  placeholder="https://github.com/yourusername"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
              ) : (
                <div>
                  {profile.github_link ? (
                    <a
                      href={profile.github_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      {profile.github_link}
                    </a>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">Not added</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">LeetCode</label>
              {isEditing ? (
                <input
                  type="url"
                  value={formData.leetcode_link}
                  onChange={(e) => setFormData({ ...formData, leetcode_link: e.target.value })}
                  placeholder="https://leetcode.com/yourusername"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
              ) : (
                <div>
                  {profile.leetcode_link ? (
                    <a
                      href={profile.leetcode_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      {profile.leetcode_link}
                    </a>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">Not added</p>
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

        {profile.is_own_profile && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-red-200 dark:border-red-900 transition-colors duration-200">
            <h3 className="text-xl font-semibold text-red-600 mb-2">
              Danger Zone
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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

      {showConnectionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowConnectionsModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Connections</h3>
              <button onClick={() => setShowConnectionsModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto p-4 flex-1">
              {loadingConnections ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                </div>
              ) : connectionsList.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No connections found.
                </div>
              ) : (
                <div className="space-y-4">
                  {connectionsList.map((conn) => (
                    <div key={conn.id} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition group">
                      <div 
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => {
                          navigate(`/profile/${conn.user.id}`);
                          setShowConnectionsModal(false);
                        }}
                      >
                        {conn.user.profile_photo ? (
                          <img
                            src={conn.user.profile_photo}
                            alt={conn.user.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-red-600 dark:bg-red-400 flex items-center justify-center text-white text-sm font-bold">
                            {conn.user.name?.charAt(0).toUpperCase() || "?"}
                          </div>
                        )}
                        <div>
                          <h4 className="font-medium text-gray-800 dark:text-white">{conn.user.name}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{conn.user.department || "Student"}</p>
                        </div>
                      </div>
                      
                      {profile.is_own_profile && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveConnection(conn.user.id, conn.user.name);
                          }}
                          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Remove connection"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="8.5" cy="7" r="4"></circle>
                            <line x1="23" y1="11" x2="17" y2="11"></line>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onConfirm={handleConfirmAction}
        title={modalConfig.title}
        message={modalConfig.message}
        isDanger={modalConfig.isDanger}
        confirmText={modalConfig.confirmText}
      />

      <Toast
        isOpen={toast.isOpen}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />
    </div>
  );
}
