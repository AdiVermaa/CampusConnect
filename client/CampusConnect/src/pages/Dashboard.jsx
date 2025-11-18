import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { API, getAccessToken, clearAccessToken } from "../api/auth";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      navigate("/login");
      return;
    }

    const fetchData = async () => {
      try {
        const res = await API.get("/me");
        setUser(res.data);
      } catch (err) {
        console.error(err);
        clearAccessToken();
        navigate("/login");
      }
    };
    fetchData();
  }, [navigate]);

  // Debounced search
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await API.get(
          `/search?query=${encodeURIComponent(searchQuery)}`
        );
        setSearchResults(res.data.results || []);
      } catch (e) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const handleLogout = () => {
    clearAccessToken();
    navigate("/login");
  };

  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600 text-lg">
        Loading Dashboard...
      </div>
    );

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-white shadow px-6 py-3 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-red-600">CampusConnect</h1>
        <div className="flex-1 max-w-xl mx-6 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {searchQuery && (
            <div className="absolute mt-2 w-full bg-white border rounded-lg shadow max-h-72 overflow-auto">
              {isSearching ? (
                <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">No results</div>
              ) : (
                searchResults.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      navigate(`/profile/${u.id}`);
                      setSearchQuery("");
                    }}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="font-medium text-gray-800">{u.name}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
        >
          Logout
        </button>
      </nav>

      {/* Main content */}
      <div className="flex justify-center gap-6 mt-6 px-6">
        {/* Left Sidebar */}
        <div className="w-1/4 bg-white rounded-xl shadow p-5 h-fit sticky top-20">
          <div className="text-center">
            <img
              src={
                user.profile_photo
                  ? user.profile_photo
                  : "https://rishihood.edu.in/wp-content/uploads/2023/09/student-profile-placeholder.png"
              }
              alt="Profile"
              className="w-24 h-24 rounded-full mx-auto border-4 border-red-500 cursor-pointer object-cover"
              onClick={() => navigate(`/profile/${user.id}`)}
            />
            <h2
              className="text-xl font-semibold mt-3 cursor-pointer hover:text-red-600"
              onClick={() => navigate(`/profile/${user.id}`)}
            >
              {user.name}
            </h2>
            <p className="text-sm text-gray-500">{user.department || "Student"}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>

          <div className="border-t mt-4 pt-3">
            <p className="text-sm text-gray-700">
              Batch: <span className="font-medium">{user.year || "N/A"}</span>
            </p>
            <p className="text-sm text-gray-700">
              Connections: <span className="font-medium">{user.connections_count || 0}</span>
            </p>
          </div>
        </div>

        {/* Feed Section */}
        <div className="w-2/4">
          <div className="bg-white p-5 rounded-xl shadow mb-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Start a Post</h3>
            <textarea
              placeholder="Share an update or opportunity..."
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none resize-none"
              rows="3"
            ></textarea>
            <button className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition">
              Post
            </button>
          </div>

          {/* Example post */}
          <div className="bg-white p-5 rounded-xl shadow mb-5">
            <div className="flex items-center gap-3 mb-3">
              <img
                src="https://rishihood.edu.in/wp-content/uploads/2023/09/student-profile-placeholder.png"
                alt="user"
                className="w-10 h-10 rounded-full"
              />
              <div>
                <h4 className="font-semibold text-gray-800">{user.name}</h4>
                <p className="text-xs text-gray-500">B.Tech CS & AI — Rishihood University</p>
              </div>
            </div>
            <p className="text-gray-700 mb-3">
              Excited to start building amazing projects this semester! 🚀
            </p>
            <div className="flex gap-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm font-medium text-gray-700">
                👍 Like
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm font-medium text-gray-700">
                💬 Comment
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm font-medium text-gray-700">
                ↗️ Share
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-1/4 bg-white rounded-xl shadow p-5 h-fit sticky top-20">
          <h3 className="text-lg font-semibold mb-3">Campus News</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>🎓 Upcoming Hackathon - 25th Nov</li>
            <li>📢 Internship Drive by Google</li>
            <li>🏆 Rajputana Clan wins Sports Fest!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
