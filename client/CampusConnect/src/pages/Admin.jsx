import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminAPI, API, getAccessToken, clearAccessToken } from "../api/auth";
import ConfirmationModal from "../components/ConfirmationModal";
import Toast from "../components/Toast";

export default function Admin() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [posts, setPosts] = useState([]);
    const [events, setEvents] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]);
    const [loginHistory, setLoginHistory] = useState([]);
    const [failedLogins, setFailedLogins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingUser, setEditingUser] = useState(null);
    const [usersPagination, setUsersPagination] = useState({ page: 1, totalPages: 1 });
    const [postsPagination, setPostsPagination] = useState({ page: 1, totalPages: 1 });
    const [logsPagination, setLogsPagination] = useState({ page: 1, totalPages: 1 });
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        type: null,
        targetId: null,
        title: "",
        message: "",
        isDanger: false
    });
    const [toast, setToast] = useState({
        isOpen: false,
        message: "",
        type: "success"
    });

    const showToast = (message, type = "success") => {
        setToast({ isOpen: true, message, type });
    };

    useEffect(() => {
        const token = getAccessToken();
        if (!token) {
            navigate("/login");
            return;
        }
        fetchData();
    }, [navigate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            if (activeTab === "dashboard") {
                await fetchStats();
            } else if (activeTab === "users") {
                await fetchUsers();
            } else if (activeTab === "posts") {
                await fetchPosts();
            } else if (activeTab === "events") {
                await fetchEvents();
            } else if (activeTab === "activity") {
                await fetchActivityLogs();
            } else if (activeTab === "logins") {
                await fetchLoginHistory();
            } else if (activeTab === "failed") {
                await fetchFailedLogins();
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            if (error.response?.status === 403) {
                showToast("Admin access required", "error");
                navigate("/dashboard");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchStats = async () => {
        const res = await AdminAPI.get("/stats");
        setStats(res.data.stats);
    };

    const fetchUsers = async (page = 1) => {
        const res = await AdminAPI.get(`/users?page=${page}&limit=20&search=${searchQuery}`);
        setUsers(res.data.users);
        setUsersPagination(res.data.pagination);
    };

    const fetchPosts = async (page = 1) => {
        const res = await AdminAPI.get(`/posts?page=${page}&limit=20`);
        setPosts(res.data.posts);
        setPostsPagination(res.data.pagination);
    };

    const fetchEvents = async () => {
        const res = await AdminAPI.get("/events");
        setEvents(res.data.events);
    };

    const fetchActivityLogs = async (page = 1) => {
        const res = await AdminAPI.get(`/activity-logs?page=${page}&limit=50`);
        setActivityLogs(res.data.logs);
        setLogsPagination(res.data.pagination);
    };

    const fetchLoginHistory = async (page = 1) => {
        const res = await AdminAPI.get(`/login-history?page=${page}&limit=50`);
        setLoginHistory(res.data.logs);
        setLogsPagination(res.data.pagination);
    };

    const fetchFailedLogins = async () => {
        const res = await AdminAPI.get("/failed-logins");
        setFailedLogins(res.data.logs);
    };

    const handleSuspendUser = (userId) => {
        setModalConfig({
            isOpen: true,
            type: 'suspend_user',
            targetId: userId,
            title: "Suspend User",
            message: "Are you sure you want to suspend this user?",
            isDanger: true
        });
    };

    const handleUnsuspendUser = async (userId) => {
        try {
            await AdminAPI.post(`/users/${userId}/unsuspend`);
            showToast("User unsuspended successfully");
            fetchUsers(usersPagination.page);
        } catch (error) {
            showToast(error.response?.data?.error || "Failed to unsuspend user", "error");
        }
    };

    const handleDeleteUser = (userId) => {
        setModalConfig({
            isOpen: true,
            type: 'delete_user',
            targetId: userId,
            title: "Delete User",
            message: "Are you sure you want to permanently delete this user? This action cannot be undone.",
            isDanger: true
        });
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            await AdminAPI.put(`/users/${editingUser.id}`, {
                name: editingUser.name,
                email: editingUser.email,
                bio: editingUser.bio,
                isAdmin: editingUser.isAdmin,
            });
            showToast("User updated successfully");
            setEditingUser(null);
            fetchUsers(usersPagination.page);
        } catch (error) {
            showToast(error.response?.data?.error || "Failed to update user", "error");
        }
    };

    const handleDeletePost = (postId) => {
        setModalConfig({
            isOpen: true,
            type: 'delete_post',
            targetId: postId,
            title: "Delete Post",
            message: "Are you sure you want to delete this post?",
            isDanger: true
        });
    };

    const handleDeleteEvent = (eventId) => {
        setModalConfig({
            isOpen: true,
            type: 'delete_event',
            targetId: eventId,
            title: "Delete Event",
            message: "Are you sure you want to delete this event?",
            isDanger: true
        });
    };

    const handleConfirmAction = async () => {
        const { type, targetId } = modalConfig;
        try {
            if (type === 'suspend_user') {
                await AdminAPI.post(`/users/${targetId}/suspend`);
                fetchUsers(usersPagination.page);
            } else if (type === 'delete_user') {
                await AdminAPI.delete(`/users/${targetId}`);
                fetchUsers(usersPagination.page);
            } else if (type === 'delete_post') {
                await AdminAPI.delete(`/posts/${targetId}`);
                fetchPosts(postsPagination.page);
            } else if (type === 'delete_event') {
                await AdminAPI.delete(`/events/${targetId}`);
                fetchEvents();
            }
        } catch (error) {
            console.error("Action failed:", error);
            showToast(error.response?.data?.error || "Action failed", "error");
        }
        setModalConfig({ ...modalConfig, isOpen: false });
    };

    const handleLogout = () => {
        clearAccessToken();
        navigate("/login");
    };

    const tabs = [
        { id: "dashboard", label: "📊 Dashboard", icon: "📊" },
        { id: "users", label: "👥 Users", icon: "👥" },
        { id: "posts", label: "📝 Posts", icon: "📝" },
        { id: "events", label: "📅 Events", icon: "📅" },
        { id: "activity", label: "📋 Activity Logs", icon: "📋" },
        { id: "logins", label: "🔐 Login History", icon: "🔐" },
        { id: "failed", label: "⚠️ Failed Logins", icon: "⚠️" },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            { }
            <header className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
                        <div className="text-center sm:text-left">
                            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                                Admin Dashboard
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Manage users, content, and monitor system activity
                            </p>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto justify-center">
                            <button
                                onClick={() => navigate("/dashboard")}
                                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                            >
                                Back to App
                            </button>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            { }
            <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex gap-2 overflow-x-auto py-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${activeTab === tab.id
                                    ? "bg-red-600 text-white shadow-lg"
                                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            { }
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                    </div>
                ) : (
                    <>
                        { }
                        {activeTab === "dashboard" && stats && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <StatCard title="Total Users" value={stats.totalUsers} icon="👥" color="blue" />
                                    <StatCard title="Active Today" value={stats.activeUsersToday} icon="🟢" color="green" />
                                    <StatCard title="Active This Week" value={stats.activeUsersWeek} icon="📅" color="purple" />
                                    <StatCard title="Total Posts" value={stats.totalPosts} icon="📝" color="orange" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <StatCard title="Total Events" value={stats.totalEvents} icon="🎉" color="pink" />
                                    <StatCard title="Connections" value={stats.totalConnections} icon="🔗" color="indigo" />
                                    <StatCard title="Suspended Users" value={stats.suspendedUsers} icon="🚫" color="red" />
                                </div>
                            </div>
                        )}

                        { }
                        {activeTab === "users" && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <input
                                        type="text"
                                        placeholder="Search users by name or email..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyPress={(e) => e.key === "Enter" && fetchUsers(1)}
                                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg w-full max-w-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                    <button
                                        onClick={() => fetchUsers(1)}
                                        className="ml-3 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                                    >
                                        Search
                                    </button>
                                </div>

                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50 dark:bg-gray-700">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Joined</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                {users.map((user) => (
                                                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                {user.profile_photo ? (
                                                                    <img
                                                                        src={user.profile_photo}
                                                                        alt={user.name}
                                                                        className="h-10 w-10 rounded-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="h-10 w-10 rounded-full bg-red-600 dark:bg-red-400 flex items-center justify-center text-white text-sm font-bold">
                                                                        {user.name?.charAt(0).toUpperCase() || "?"}
                                                                    </div>
                                                                )}
                                                                <div className="ml-4">
                                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                                                                    {user.isAdmin && <span className="text-xs text-red-600 font-semibold">ADMIN</span>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            {user.suspended ? (
                                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                                                    Suspended
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                                    Active
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                            {new Date(user.createdAt).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                                            <button
                                                                onClick={() => setEditingUser(user)}
                                                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                                            >
                                                                Edit
                                                            </button>
                                                            {user.suspended ? (
                                                                <button
                                                                    onClick={() => handleUnsuspendUser(user.id)}
                                                                    className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                                                >
                                                                    Unsuspend
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleSuspendUser(user.id)}
                                                                    className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300"
                                                                >
                                                                    Suspend
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDeleteUser(user.id)}
                                                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                            >
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <Pagination pagination={usersPagination} onPageChange={(page) => fetchUsers(page)} />
                                </div>
                            </div>
                        )}

                        { }
                        {activeTab === "posts" && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Content</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Author</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Engagement</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Created</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {posts.map((post) => (
                                                <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm text-gray-900 dark:text-white max-w-md truncate">
                                                            {post.content.substring(0, 100)}...
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {post.author?.name || "Unknown"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        👍 {post.likesCount} | 💬 {post.commentsCount}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {new Date(post.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                        <button
                                                            onClick={() => handleDeletePost(post.id)}
                                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination pagination={postsPagination} onPageChange={(page) => fetchPosts(page)} />
                            </div>
                        )}

                        { }
                        {activeTab === "events" && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Title</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Organizer</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Attendees</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {events.map((event) => (
                                                <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{event.title}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                            {event.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {event.organizer?.name || "Unknown"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {new Date(event.date).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {event.attendeesCount}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                        <button
                                                            onClick={() => handleDeleteEvent(event.id)}
                                                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        { }
                        {activeTab === "activity" && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Details</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">IP Address</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {activityLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                        {log.user?.name || "Unknown"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <ActionBadge action={log.action} />
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                        {JSON.stringify(log.details)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {log.ipAddress || "N/A"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {new Date(log.createdAt).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination pagination={logsPagination} onPageChange={(page) => fetchActivityLogs(page)} />
                            </div>
                        )}

                        { }
                        {activeTab === "logins" && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">IP Address</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User Agent</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {loginHistory.map((log) => (
                                                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                        {log.user?.name || "Unknown"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {log.action === "login_success" ? (
                                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                                Success
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                                                Failed
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {log.ipAddress || "N/A"}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                        {log.userAgent || "N/A"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {new Date(log.createdAt).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination pagination={logsPagination} onPageChange={(page) => fetchLoginHistory(page)} />
                            </div>
                        )}

                        { }
                        {activeTab === "failed" && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                                    <p className="text-sm text-red-800 dark:text-red-200">
                                        ⚠️ Showing last 100 failed login attempts. Monitor for suspicious activity.
                                    </p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Reason</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">IP Address</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {failedLogins.map((log) => (
                                                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                        {log.user?.name || log.details?.email || "Unknown"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {log.details?.reason || "Unknown"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {log.ipAddress || "N/A"}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {new Date(log.createdAt).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            { }
            {editingUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Edit User</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                                <input
                                    type="text"
                                    value={editingUser.name}
                                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                                <input
                                    type="email"
                                    value={editingUser.email}
                                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
                                <textarea
                                    value={editingUser.bio || ""}
                                    onChange={(e) => setEditingUser({ ...editingUser, bio: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white p-2 border"
                                    rows="3"
                                />
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={editingUser.isAdmin}
                                    onChange={(e) => setEditingUser({ ...editingUser, isAdmin: e.target.checked })}
                                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                                />
                                <label className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                    Admin Privileges
                                </label>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button
                                onClick={() => setEditingUser(null)}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateUser}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                            >
                                Save Changes
                            </button>
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

function StatCard({ title, value, icon, color }) {
    const colors = {
        blue: "from-blue-500 to-blue-600",
        green: "from-green-500 to-green-600",
        purple: "from-purple-500 to-purple-600",
        orange: "from-orange-500 to-orange-600",
        pink: "from-pink-500 to-pink-600",
        indigo: "from-indigo-500 to-indigo-600",
        red: "from-red-500 to-red-600",
    };

    return (
        <div className={`bg-gradient-to-br ${colors[color]} rounded-xl shadow-lg p-6 text-white`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm opacity-90">{title}</p>
                    <p className="text-3xl font-bold mt-2">{value}</p>
                </div>
                <div className="text-4xl opacity-80">{icon}</div>
            </div>
        </div>
    );
}

function Pagination({ pagination, onPageChange }) {
    if (!pagination || pagination.totalPages <= 1) return null;

    return (
        <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-600">
            <div className="flex-1 flex justify-between sm:hidden">
                <button
                    onClick={() => onPageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    Previous
                </button>
                <button
                    onClick={() => onPageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                    Next
                </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        Page <span className="font-medium">{pagination.page}</span> of{" "}
                        <span className="font-medium">{pagination.totalPages}</span>
                    </p>
                </div>
                <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                            onClick={() => onPageChange(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => onPageChange(pagination.page + 1)}
                            disabled={pagination.page === pagination.totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </nav>
                </div>
            </div>
        </div>
    );
}

function ActionBadge({ action }) {
    const badges = {
        login_success: { label: "Login Success", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
        login_failed: { label: "Login Failed", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
        post_create: { label: "Post Created", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
        post_delete: { label: "Post Deleted", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
        user_suspend: { label: "User Suspended", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
        user_unsuspend: { label: "User Unsuspended", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
        user_delete: { label: "User Deleted", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
        role_change: { label: "Role Changed", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
    };

    const badge = badges[action] || { label: action, color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200" };

    return (
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.color}`}>
            {badge.label}
        </span>
    );
}
