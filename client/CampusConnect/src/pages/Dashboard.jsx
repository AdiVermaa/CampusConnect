import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../config";
import { API, PostsAPI, ChatAPI, getAccessToken, clearAccessToken } from "../api/auth";
import MessagesWidget from "../components/MessagesWidget";
import MessagesPopup from "../components/MessagesPopup";
import ConfirmationModal from "../components/ConfirmationModal";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState("");
  const [postImage, setPostImage] = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [showCommentInput, setShowCommentInput] = useState({});
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
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [deletePostId, setDeletePostId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
      const errorMessage = error.response?.data?.error || "Failed to create post";
      alert(errorMessage);
    } finally {
      setIsPosting(false);
    }
  };

  const updatePostInState = (updatedPost) => {
    setPosts((prev) =>
      prev.map((post) => (post.id === updatedPost.id ? updatedPost : post))
    );
  };

  const handleDeletePost = async (postId) => {
    setDeletePostId(postId);
    setShowDeleteConfirm(true);
  };

  const confirmDeletePost = async () => {
    if (!deletePostId) return;

    try {
      await PostsAPI.delete(`/${deletePostId}`);
      setPosts((prev) => prev.filter((post) => post.id !== deletePostId));
      setShowDeleteConfirm(false);
      setDeletePostId(null);
    } catch (error) {
      console.error("Failed to delete post", error);
      const errorMessage = error.response?.data?.error || "Failed to delete post";
      alert(errorMessage);
    }
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
      { }
      <nav className="bg-white dark:bg-gray-800 shadow px-4 sm:px-6 py-3 flex justify-between items-center sticky top-0 z-10 transition-colors duration-200">
        <h1 className="text-xl sm:text-2xl font-bold text-red-600 truncate">CampusConnect</h1>

        <div className="hidden md:flex flex-1 max-w-xl mx-6 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 transition-colors duration-200"
          />
          {searchQuery && (
            <div className="absolute mt-2 w-full bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow max-h-72 overflow-auto z-20 top-full">
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

        <div className="flex items-center space-x-2 sm:space-x-4">

          {user?.isAdmin && (
            <div className="flex items-center mr-2">
              <span className="text-sm font-medium mr-2 text-gray-700 dark:text-gray-300 hidden md:block">Admin</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  value=""
                  className="sr-only peer"
                  onChange={() => navigate("/admin")}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 dark:peer-focus:ring-red-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
              </label>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 transition text-sm sm:text-base"
          >
            Logout
          </button>
        </div>
      </nav>

      { }
      <div className="flex flex-col lg:flex-row justify-center gap-6 mt-6 px-4 sm:px-6">
        {/* Profile Sidebar - Hidden on Mobile */}
        <div className="hidden lg:block w-full lg:w-1/4 bg-white dark:bg-gray-800 rounded-xl shadow p-5 h-fit sticky top-20 transition-colors duration-200">
          <div className="text-center">
            {user.profile_photo ? (
              <img
                src={user.profile_photo}
                alt="Profile"
                className="w-24 h-24 rounded-full mx-auto cursor-pointer object-cover"
                onClick={() => navigate(`/profile/${user.id}`)}
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full mx-auto cursor-pointer bg-red-600 dark:bg-red-400 flex items-center justify-center text-white text-3xl font-bold"
                onClick={() => navigate(`/profile/${user.id}`)}
              >
                {user.name?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
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

        {/* Feed - Full width on mobile, centered on desktop */}
        <div className="w-full lg:w-2/4 max-w-2xl lg:max-w-none mx-auto flex flex-col gap-5">
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
              <div className="flex items-center gap-3">
                <label className="text-sm text-red-600 cursor-pointer font-medium hover:underline flex items-center gap-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Add Photo
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
                    Remove
                  </button>
                )}
              </div>
              <button
                onClick={handleCreatePost}
                disabled={isPosting || !newPost.trim()}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isPosting ? "Posting..." : "Post"}
              </button>
            </div>
          </div>

          {posts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow text-center text-gray-500 dark:text-gray-400 transition-colors duration-200">
              No posts yet. Be the first to share something!
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow transition-colors duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {post.author?.profile_photo ? (
                      <img
                        src={post.author.profile_photo}
                        alt={post.author?.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-red-600 dark:bg-red-400 flex items-center justify-center text-white text-lg font-bold">
                        {post.author?.name?.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-white">{post.author?.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(post.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {user && post.author?.id === user.id && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      title="Delete post"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  )}
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

                {/* Instagram-style Action Buttons */}
                <div className="flex items-center gap-4 py-2 border-t border-b dark:border-gray-700">
                  {/* Like Button */}
                  <button
                    onClick={() => handleToggleLike(post.id)}
                    className="p-2 hover:opacity-70 transition"
                    title={post.isLiked ? "Unlike" : "Like"}
                  >
                    {post.isLiked ? (
                      <svg className="w-6 h-6 text-red-600 fill-current" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    )}
                  </button>


                  <button
                    onClick={() => setShowCommentInput(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                    className="p-2 hover:opacity-70 transition"
                    title="Comment"
                  >
                    <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </button>


                  <button
                    onClick={() => openShareModal(post)}
                    className="p-2 hover:opacity-70 transition"
                    title="Share"
                  >
                    <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>


                <div className="py-2">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {post.likesCount} {post.likesCount === 1 ? 'like' : 'likes'}
                  </p>
                </div>

                {/* Comments Section */}
                <div className="space-y-3 mb-3">
                  {post.comments.slice(0, 3).map((comment) => (
                    <div key={comment.id} className="">
                      <p className="text-sm">
                        <span className="font-semibold text-gray-800 dark:text-gray-200 mr-2">
                          {comment.user?.name || "User"}
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">{comment.text}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(comment.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {post.commentsCount > 3 && (
                    <button className="text-sm text-gray-500 dark:text-gray-400">
                      View all {post.commentsCount} comments
                    </button>
                  )}
                </div>

                {/* Comment Input - Only show when clicked */}
                {showCommentInput[post.id] && (
                  <div className="flex gap-2 pt-3 border-t dark:border-gray-700">
                    <input
                      id={`comment-input-${post.id}`}
                      type="text"
                      placeholder="Add a comment..."
                      value={commentInputs[post.id] || ""}
                      onChange={(e) => handleCommentChange(post.id, e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment(post.id);
                        }
                      }}
                      className="flex-1 border-none focus:outline-none text-sm dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
                      autoFocus
                    />
                    <button
                      onClick={() => handleAddComment(post.id)}
                      disabled={!commentInputs[post.id]?.trim()}
                      className="text-red-600 font-semibold text-sm hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Post
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Right Sidebar (Messages/News) - Hidden on Mobile */}
        <div className="hidden lg:block w-full lg:w-1/4 space-y-5">
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
                      {connection.profile_photo ? (
                        <img
                          src={connection.profile_photo}
                          alt={connection.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-red-600 dark:bg-red-400 flex items-center justify-center text-white text-sm font-bold">
                          {connection.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                      )}
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

      {/* Mobile Bottom Navigation - Instagram Style */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 z-50">
        <div className="flex justify-around items-center py-2">
          {/* Home */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            title="Home"
          >
            <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9.464 1.286C10.294.803 11.092.5 12 .5c.908 0 1.707.303 2.537.786.795.462 1.7 1.142 2.815 1.977l2.232 1.675c1.391 1.042 2.359 1.766 2.888 2.826.53 1.059.53 2.268.528 4.006v4.3c0 1.355 0 2.471-.119 3.355-.124.928-.396 1.747-1.052 2.403-.657.657-1.476.928-2.404 1.053-.884.119-2 .119-3.354.119H7.93c-1.354 0-2.471 0-3.355-.119-.928-.125-1.747-.396-2.403-1.053-.656-.656-.928-1.475-1.053-2.403C1 18.541 1 17.425 1 16.07v-4.3c0-1.738-.002-2.947.528-4.006.53-1.06 1.497-1.784 2.888-2.826L6.65 3.263c1.114-.835 2.02-1.515 2.815-1.977zM10.5 13A1.5 1.5 0 009 14.5V21h6v-6.5a1.5 1.5 0 00-1.5-1.5h-3z" />
            </svg>
          </button>

          {/* Search */}
          <button
            onClick={() => setShowMobileSearch(true)}
            className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            title="Search"
          >
            <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Events */}
          <button
            onClick={() => navigate('/events')}
            className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            title="Events"
          >
            <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Network */}
          <button
            onClick={() => navigate('/network')}
            className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            title="Network"
          >
            <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>

          {/* Profile */}
          <button
            onClick={() => navigate(`/profile/${user?.id}`)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            title="Profile"
          >
            {user?.profile_photo ? (
              <img
                src={user.profile_photo}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-red-600 dark:bg-red-400 flex items-center justify-center text-white text-sm font-bold">
                {user?.name?.charAt(0).toUpperCase() || "?"}
              </div>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Search Modal */}
      {showMobileSearch && (
        <div className="md:hidden fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col">
          {/* Search Header */}
          <div className="flex items-center gap-3 p-4 border-b dark:border-gray-700">
            <button
              onClick={() => {
                setShowMobileSearch(false);
                setSearchQuery("");
                setSearchResults([]);
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
            >
              <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="flex-1 bg-gray-100 dark:bg-gray-800 border-none rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 dark:text-white dark:placeholder-gray-400"
              autoFocus
            />
          </div>

          {/* Search Results */}
          <div className="flex-1 overflow-y-auto">
            {searchQuery ? (
              isSearching ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  No users found
                </div>
              ) : (
                <div className="divide-y dark:divide-gray-700">
                  {searchResults.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => {
                        navigate(`/profile/${u.id}`);
                        setShowMobileSearch(false);
                        setSearchQuery("");
                      }}
                      className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition"
                    >
                      {u.profile_photo ? (
                        <img
                          src={u.profile_photo}
                          alt={u.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-red-600 dark:bg-red-400 flex items-center justify-center text-white font-bold">
                          {u.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 dark:text-white">{u.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                Search for users by name or email
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add padding to bottom on mobile to prevent content being hidden by nav */}
      <div className="md:hidden h-16"></div>

      {/* Delete Post Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletePostId(null);
        }}
        onConfirm={confirmDeletePost}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        isDanger={true}
      />
    </div>
  );
}
