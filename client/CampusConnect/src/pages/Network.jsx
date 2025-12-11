import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API, ConnectionsAPI, getAccessToken, clearAccessToken } from "../api/auth";
import cacheManager, { CACHE_KEYS } from "../utils/cacheManager";

export default function Network() {
    const navigate = useNavigate();
    const [connections, setConnections] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("connections");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (!getAccessToken()) {
            navigate("/login");
            return;
        }
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const cachedConnections = cacheManager.get(CACHE_KEYS.USER_CONNECTIONS);
            if (cachedConnections) {
                 setConnections(cachedConnections);
                 
                 const searchRes = await API.get("/search", { params: { query: "" } });
                 const connectedIds = new Set(cachedConnections.map((c) => c.user.id));
                 const filtered = (searchRes.data.users || []).filter(
                    (user) => !connectedIds.has(user.id)
                 );
                 setSuggestions(filtered);
                 setLoading(false);
                 return;
            }

            setLoading(true);
            const [connectionsRes, searchRes] = await Promise.all([
                ConnectionsAPI.get("/"),
                API.get("/search", { params: { query: "" } }),
            ]);

            const fetchedConnections = connectionsRes.data.connections || [];
            setConnections(fetchedConnections);
            cacheManager.set(CACHE_KEYS.USER_CONNECTIONS, fetchedConnections);

            const connectedIds = new Set(
                fetchedConnections.map((c) => c.user.id)
            );
            const filtered = (searchRes.data.users || []).filter(
                (user) => !connectedIds.has(user.id)
            );
            setSuggestions(filtered);
        } catch (error) {
            console.error("Failed to fetch data:", error);
            if (error.response?.status === 401 || error.response?.status === 403) {
                clearAccessToken();
                navigate("/login");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async (userId) => {
        try {
            await ConnectionsAPI.post(`/${userId}`);
            await ConnectionsAPI.post(`/${userId}`);
            cacheManager.invalidatePattern(CACHE_KEYS.USER_CONNECTIONS);
            fetchData();
        } catch (error) {
            console.error("Failed to connect:", error);
            alert(error.response?.data?.error || "Failed to connect");
        }
    };

    const handleDisconnect = async (userId) => {
        if (!confirm("Are you sure you want to remove this connection?")) return;
        try {
            await ConnectionsAPI.delete(`/${userId}`);
            await ConnectionsAPI.delete(`/${userId}`);
            cacheManager.invalidatePattern(CACHE_KEYS.USER_CONNECTIONS);
            fetchData();
        } catch (error) {
            console.error("Failed to disconnect:", error);
            alert(error.response?.data?.error || "Failed to disconnect");
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) {
            fetchData();
            return;
        }

        try {
            const res = await API.get("/search", {
                params: { query: searchQuery },
            });

            const connectedIds = new Set(connections.map((c) => c.user.id));
            const filtered = (res.data.users || []).filter(
                (user) => !connectedIds.has(user.id)
            );
            setSuggestions(filtered);
        } catch (error) {
            console.error("Search failed:", error);
        }
    };

    const UserCard = ({ user, isConnected, onAction }) => (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group">
            <div className="p-6">
                <div className="flex items-start space-x-4">
                    <div
                        onClick={() => navigate(`/profile/${user.id}`)}
                        className="cursor-pointer"
                    >
                        {user.profile_photo ? (
                            <img
                                src={user.profile_photo}
                                alt={user.name}
                                className="w-16 h-16 rounded-full object-cover ring-4 ring-indigo-100 group-hover:ring-indigo-200 transition"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-indigo-100 group-hover:ring-indigo-200 transition">
                                {user.name?.charAt(0) || "?"}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                            {user.name}
                        </h3>
                        <p className="text-red-600 dark:text-red-400 text-sm font-medium mb-2">
                            {user.department || "Student"}
                        </p>
                        {user.bio && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                                {user.bio}
                            </p>
                        )}
                    </div>
                </div>
                <div className="mt-4 flex gap-2 w-full">
                    <button
                        onClick={() => navigate(`/profile/${user.id}`)}
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                        View Profile
                    </button>
                    {activeTab === "suggestions" ? (
                        <button
                            onClick={() => handleConnect(user.id)}
                            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition shadow-md hover:shadow-lg"
                        >
                            Connect
                        </button>
                    ) : (
                        <button
                            onClick={() => handleDisconnect(user.id)}
                            className="flex-1 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition"
                        >
                            Remove
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-200">
            { }
            <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm sticky top-0 z-10 transition-colors duration-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
                        <div className="flex items-center space-x-4 w-full sm:w-auto justify-between sm:justify-start">
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={() => navigate("/dashboard")}
                                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
                                >
                                    ← Back
                                </button>
                                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent truncate">
                                    My Network
                                </h1>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            { }
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex flex-wrap gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab("connections")}
                        className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${activeTab === "connections"
                            ? "bg-red-600 text-white shadow-lg transform scale-105"
                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            }`}
                    >
                        My Connections ({connections.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("suggestions")}
                        className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${activeTab === "suggestions"
                            ? "bg-red-600 text-white shadow-lg transform scale-105"
                            : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            }`}
                    >
                        Suggestions
                    </button>
                </div>

                { }
                {activeTab === "suggestions" && (
                    <form onSubmit={handleSearch} className="mb-6">
                        <div className="relative max-w-2xl">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search for people..."
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-none shadow-sm focus:ring-2 focus:ring-red-500 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm transition-all dark:text-white dark:placeholder-gray-400"
                            />
                            <svg
                                className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        </div>
                    </form>
                )}

                { }
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                    </div>
                ) : activeTab === "connections" ? (
                    connections.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center">
                                <svg
                                    className="w-12 h-12 text-red-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                    />
                                </svg>
                            </div>
                            <p className="text-gray-500 text-lg mb-2">No connections yet</p>
                            <p className="text-gray-400 text-sm mb-6">
                                Start building your network by connecting with people
                            </p>
                            <button
                                onClick={() => setActiveTab("suggestions")}
                                className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-full hover:shadow-lg transition transform hover:scale-105"
                            >
                                Find People to Connect
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {connections.map((connection) => (
                                <UserCard
                                    key={connection.id}
                                    user={connection.user}
                                    isConnected={true}
                                    onAction={handleDisconnect}
                                />
                            ))}
                        </div>
                    )
                ) : suggestions.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">No suggestions found</p>
                        <p className="text-gray-400 text-sm mt-2">
                            Try searching for specific people
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {suggestions.map((user) => (
                            <UserCard
                                key={user.id}
                                user={user}
                                isConnected={false}
                                onAction={handleConnect}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
