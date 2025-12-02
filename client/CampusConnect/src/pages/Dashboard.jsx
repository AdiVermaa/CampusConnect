import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../config";
import { API, PostsAPI, ChatAPI, getAccessToken, clearAccessToken } from "../api/auth";
import MessagesWidget from "../components/MessagesWidget";
import MessagesPopup from "../components/MessagesPopup";

import { useTheme } from "../context/ThemeContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [postImage, setPostImage] = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [shareModalPost, setShareModalPost] = useState(null);
  const [connections, setConnections] = useState([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareTarget, setShareTarget] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSelection, setNewChatSelection] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [newChatError, setNewChatError] = useState("");
  const [showMessagesPopup, setShowMessagesPopup] = useState(false);
  const socketRef = useRef(null);
  const selectedConversationRef = useRef(null);


  const sortConversations = (items) =>
    [...items].sort(
      (a, b) =>
        new Date(b?.lastMessageAt || 0).getTime() -
        new Date(a?.lastMessageAt || 0).getTime()
    );

  const joinConversationRooms = (conversationList) => {
    const socket = socketRef.current;
    if (!socket) return;
    conversationList.forEach((conversation) => {
      socket.emit("conversation:join", conversation.id);
    });
  };

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      navigate("/login");
      return;
    }

    const fetchData = async () => {
      try {
        const [userRes, postsRes] = await Promise.all([
          API.get("/me"),
          PostsAPI.get("/feed"),
        ]);
        setUser(userRes.data);
        setPosts(postsRes.data.posts || []);
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

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  const handleLogout = () => {
    clearAccessToken();
    socketRef.current?.disconnect();
    setConversations([]);
    setSelectedConversation(null);
    setMessages([]);
    navigate("/login");
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setPostImage(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPostImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => setPostImage(null);

  const handleCreatePost = async () => {
    if (!newPost.trim()) return;
    setIsPosting(true);
    try {
      const res = await PostsAPI.post("/", {
        content: newPost.trim(),
        image: postImage,
      });
      setPosts((prev) => [res.data.post, ...prev]);
      setNewPost("");
      setPostImage(null);
    } catch (error) {
      console.error("Failed to create post", error);
    } finally {
      setIsPosting(false);
    }
  };

  const updatePostInState = (updatedPost) => {
    setPosts((prev) =>
      prev.map((post) => (post.id === updatedPost.id ? updatedPost : post))
    );
  };

  const handleToggleLike = async (postId) => {
    try {
      const res = await PostsAPI.post(`/${postId}/like`);
      updatePostInState(res.data.post);
    } catch (error) {
      console.error("Failed to toggle like", error);
    }
  };

  const handleCommentChange = (postId, value) => {
    setCommentInputs((prev) => ({ ...prev, [postId]: value }));
  };

  const handleAddComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    try {
      const res = await PostsAPI.post(`/${postId}/comment`, { text });
      updatePostInState(res.data.post);
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    } catch (error) {
      console.error("Failed to add comment", error);
    }
  };

  const ensureConnectionsLoaded = async () => {
    if (connections.length > 0) return;
    setConnectionsLoading(true);
    try {
      const res = await API.get("/connections/list");
      setConnections(res.data.connections || []);
    } catch (error) {
      console.error("Failed to load connections", error);
    } finally {
      setConnectionsLoading(false);
    }
  };

  const openShareModal = async (post) => {
    setShareModalPost(post);
    setShareError("");
    await ensureConnectionsLoaded();
  };

  const closeShareModal = () => {
    setShareModalPost(null);
    setShareTarget(null);
    setShareError("");
  };

  const handleShareWithConnection = async (connectionId) => {
    if (!shareModalPost) return;
    setShareTarget(connectionId);
    setShareError("");
    try {
      const res = await PostsAPI.post(`/${shareModalPost.id}/share`, {
        targetUserId: connectionId,
      });
      updatePostInState(res.data.post);
      closeShareModal();
    } catch (error) {
      console.error("Failed to share post", error);
      setShareError("Failed to share. Please try again.");
    } finally {
      setShareTarget(null);
    }
  };

  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-600 text-lg">
        Loading Dashboard...
      </div>
    );

  return (
    <div className="bg-gray-100 dark:bg-gray-900 min-h-screen flex flex-col transition-colors duration-200">
      {/* Navbar */}
      <nav className="bg-white dark:bg-gray-800 shadow px-6 py-3 flex justify-between items-center sticky top-0 z-10 transition-colors duration-200">
        <h1 className="text-2xl font-bold text-red-600">CampusConnect</h1>
        <div className="flex-1 max-w-xl mx-6 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 transition-colors duration-200"
          />
          {searchQuery && (
            <div className="absolute mt-2 w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow max-h-72 overflow-auto z-20">
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
                    className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-200"
                  >
                    <div className="font-medium text-gray-800 dark:text-gray-200">{u.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === "light" ? (
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row justify-center gap-6 mt-6 px-6">
        {/* Left Sidebar */}
        <div className="w-full lg:w-1/4 bg-white dark:bg-gray-800 rounded-xl shadow p-5 h-fit sticky top-20 transition-colors duration-200">
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
              className="text-xl font-semibold mt-3 cursor-pointer hover:text-red-600 dark:text-white dark:hover:text-red-400 transition-colors duration-200"
              onClick={() => navigate(`/profile/${user.id}`)}
            >
              {user.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.department || "Student"}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{user.email}</p>
          </div>

          <div className="border-t dark:border-gray-700 mt-4 pt-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Batch: <span className="font-medium">{user.year || "N/A"}</span>
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Connections: <span className="font-medium">{user.connections_count || 0}</span>
            </p>
          </div>

          <div className="border-t dark:border-gray-700 mt-4 pt-3 space-y-2">
            <button
              onClick={() => navigate("/network")}
              className="w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition transform hover:scale-105 text-sm font-medium"
            >
              🌐 My Network
            </button>
            <button
              onClick={() => navigate("/events")}
              className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:shadow-lg transition transform hover:scale-105 text-sm font-medium"
            >
              📅 Events & Opportunities
            </button>
            <button
              onClick={() => navigate("/messages")}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
            >
              💬 Messages
            </button>
          </div>
        </div>

        {/* Feed Section */}
        <div className="w-full lg:w-2/4 flex flex-col gap-5">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow transition-colors duration-200">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Start a Post</h3>
            <textarea
              placeholder="Share an update or opportunity..."
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none resize-none dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 transition-colors duration-200"
              rows="3"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
            ></textarea>
            <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
              <label className="text-sm text-red-600 cursor-pointer font-medium hover:underline">
                + Add Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </label>
              {postImage && (
                <button
                  type="button"
                  onClick={removeImage}
                  className="text-sm text-gray-500 hover:text-red-600"
                >
                  Remove photo
                </button>
              )}
            </div>
            {postImage && (
              <div className="mt-3">
                <img
                  src={postImage}
                  alt="Selected post attachment"
                  className="w-full max-h-64 object-cover rounded-lg border"
                />
              </div>
            )}
            <button
              onClick={handleCreatePost}
              disabled={isPosting || !newPost.trim()}
              className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPosting ? "Posting..." : "Post"}
            </button>
          </div>

          {posts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow text-center text-gray-500 dark:text-gray-400 transition-colors duration-200">
              No posts yet. Be the first to share something!
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow transition-colors duration-200">
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={
                      post.author?.profile_photo ||
                      "https://rishihood.edu.in/wp-content/uploads/2023/09/student-profile-placeholder.png"
                    }
                    alt={post.author?.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white">{post.author?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(post.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-line">{post.content}</p>
                {post.image && (
                  <div className="mb-3">
                    <img
                      src={post.image}
                      alt="Post attachment"
                      className="w-full max-h-96 object-cover rounded-xl border"
                    />
                  </div>
                )}

                <div className="flex gap-3 text-sm text-gray-600 dark:text-gray-400 mb-3">
                  <span>👍 {post.likesCount}</span>
                  <span>💬 {post.commentsCount}</span>
                  <span>↗️ {post.sharesCount}</span>
                </div>

                <div className="flex gap-4 mb-4">
                  <button
                    onClick={() => handleToggleLike(post.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition text-sm font-medium ${post.isLiked
                      ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
                      }`}
                  >
                    👍 {post.isLiked ? "Liked" : "Like"}
                  </button>
                  <button
                    onClick={() =>
                      document.getElementById(`comment-input-${post.id}`)?.focus()
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm font-medium text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
                  >
                    💬 Comment
                  </button>
                  <button
                    onClick={() => openShareModal(post)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm font-medium text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
                  >
                    ↗️ Share
                  </button>
                </div>

                <div className="space-y-3">
                  {post.comments.slice(0, 3).map((comment) => (
                    <div key={comment.id} className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {comment.user?.name || "User"}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{comment.text}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(comment.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {post.commentsCount > 3 && (
                    <p className="text-xs text-gray-500">
                      View all {post.commentsCount} comments in a future update
                    </p>
                  )}
                </div>

                <div className="flex gap-2 mt-3">
                  <input
                    id={`comment-input-${post.id}`}
                    type="text"
                    placeholder="Write a comment..."
                    value={commentInputs[post.id] || ""}
                    onChange={(e) => handleCommentChange(post.id, e.target.value)}
                    className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                  />
                  <button
                    onClick={() => handleAddComment(post.id)}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
                  >
                    Post
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-full lg:w-1/4 space-y-5">
          <MessagesWidget onOpenPopup={() => setShowMessagesPopup(true)} />

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 transition-colors duration-200">
            <h3 className="text-lg font-semibold mb-3 dark:text-white">Campus News</h3>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>🎓 Upcoming Hackathon - 25th Nov</li>
              <li>📢 Internship Drive by Google</li>
              <li>🏆 Rajputana Clan wins Sports Fest!</li>
            </ul>
          </div>
        </div>
      </div>

      {shareModalPost && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 relative transition-colors duration-200">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={closeShareModal}
            >
              ✕
            </button>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Share with a connection
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Select a connection to share this post with.
            </p>

            {connectionsLoading ? (
              <div className="text-center py-6 text-gray-500">Loading connections...</div>
            ) : connections.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                You don't have any connections yet. Connect with others to share posts.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                {connections.map((connection) => (
                  <div
                    key={connection.id}
                    className="flex items-center justify-between border dark:border-gray-700 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          connection.profile_photo ||
                          "https://rishihood.edu.in/wp-content/uploads/2023/09/student-profile-placeholder.png"
                        }
                        alt={connection.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white">{connection.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{connection.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleShareWithConnection(connection.id)}
                      disabled={shareTarget === connection.id}
                      className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                    >
                      {shareTarget === connection.id ? "Sharing..." : "Share"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {shareError && (
              <p className="text-sm text-red-600 mt-3">{shareError}</p>
            )}
          </div>
        </div>
      )}

      <MessagesPopup
        isOpen={showMessagesPopup}
        onClose={() => setShowMessagesPopup(false)}
      />
    </div>
  );
}
