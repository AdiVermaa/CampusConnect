import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EventsAPI, getAccessToken, clearAccessToken } from "../api/auth";

export default function Events() {
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("upcoming");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newEvent, setNewEvent] = useState({
        title: "",
        description: "",
        type: "event",
        date: "",
        location: "",
        isVirtual: false,
        meetingLink: "",
        registrationLink: "",
        tags: "",
        maxAttendees: "",
        visibility: "public",
    });

    useEffect(() => {
        if (!getAccessToken()) {
            navigate("/login");
            return;
        }
        fetchEvents();
    }, [filter]);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const params = filter === "upcoming" ? { upcoming: "true" } : {};
            const res = await EventsAPI.get("/", { params });
            setEvents(res.data.events || []);
        } catch (error) {
            console.error("Failed to fetch events:", error);
            if (error.response?.status === 401 || error.response?.status === 403) {
                clearAccessToken();
                navigate("/login");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEvent = async (e) => {
        e.preventDefault();
        try {
            const eventData = {
                ...newEvent,
                tags: newEvent.tags ? newEvent.tags.split(",").map((t) => t.trim()) : [],
                maxAttendees: newEvent.maxAttendees ? parseInt(newEvent.maxAttendees) : null,
            };

            await EventsAPI.post("/", eventData);
            setShowCreateModal(false);
            setNewEvent({
                title: "",
                description: "",
                type: "event",
                date: "",
                location: "",
                isVirtual: false,
                meetingLink: "",
                registrationLink: "",
                tags: "",
                maxAttendees: "",
                visibility: "public",
            });
            fetchEvents();
        } catch (error) {
            console.error("Failed to create event:", error);
            alert(error.response?.data?.error || "Failed to create event");
        }
    };

    const handleRegister = async (eventId, isAttending) => {
        try {
            if (isAttending) {
                await EventsAPI.delete(`/${eventId}/register`);
            } else {
                await EventsAPI.post(`/${eventId}/register`);
            }
            fetchEvents();
        } catch (error) {
            console.error("Failed to register:", error);
            alert(error.response?.data?.error || "Failed to register");
        }
    };

    const handleDeleteEvent = async (eventId) => {
        if (!confirm("Are you sure you want to delete this event?")) return;
        try {
            await EventsAPI.delete(`/${eventId}`);
            fetchEvents();
        } catch (error) {
            console.error("Failed to delete event:", error);
            alert(error.response?.data?.error || "Failed to delete event");
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getTypeColor = (type) => {
        const colors = {
            event: "bg-blue-100 text-blue-800",
            internship: "bg-green-100 text-green-800",
            opportunity: "bg-purple-100 text-purple-800",
            workshop: "bg-orange-100 text-orange-800",
            competition: "bg-red-100 text-red-800",
            other: "bg-gray-100 text-gray-800",
        };
        return colors[type] || colors.other;
    };

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
                                    Events
                                </h1>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-full hover:shadow-lg transition transform hover:scale-105"
                        >
                            + Create Event
                        </button>
                    </div>
                </div>
            </header>

            { }
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setFilter("upcoming")}
                        className={`px-4 py-2 rounded-full transition ${filter === "upcoming"
                            ? "bg-red-600 text-white"
                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            }`}
                    >
                        Upcoming
                    </button>
                    <button
                        onClick={() => setFilter("")}
                        className={`px-4 py-2 rounded-full transition ${filter === ""
                            ? "bg-red-600 text-white"
                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            }`}
                    >
                        All Events
                    </button>
                </div>
            </div>

            { }
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                    </div>
                ) : events.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">No events found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.map((event) => (
                            <div
                                key={event.id}
                                className="bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
                            >
                                {event.image && (
                                    <div className="h-48 overflow-hidden">
                                        <img
                                            src={event.image}
                                            alt={event.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                        />
                                    </div>
                                )}
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-3">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(
                                                event.type
                                            )}`}
                                        >
                                            {event.type}
                                        </span>
                                        {event.isVirtual && (
                                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                                Virtual
                                            </span>
                                        )}
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                        {event.title}
                                    </h3>

                                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3">
                                        {event.description}
                                    </p>

                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                            <svg
                                                className="w-4 h-4 mr-2"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                />
                                            </svg>
                                            {formatDate(event.date)}
                                        </div>

                                        {event.location && (
                                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                                <svg
                                                    className="w-4 h-4 mr-2"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                                    />
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                                    />
                                                </svg>
                                                {event.location}
                                            </div>
                                        )}

                                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                            <svg
                                                className="w-4 h-4 mr-2"
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
                                            {event.attendeesCount} attending
                                            {event.maxAttendees && ` / ${event.maxAttendees}`}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700">
                                        <div className="flex items-center space-x-2">
                                            {event.organizer?.profile_photo ? (
                                                <img
                                                    src={event.organizer.profile_photo}
                                                    alt={event.organizer.name}
                                                    className="w-8 h-8 rounded-full"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center text-white text-sm font-semibold">
                                                    {event.organizer?.name?.charAt(0) || "?"}
                                                </div>
                                            )}
                                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                                {event.organizer?.name}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => handleRegister(event.id, event.isAttending)}
                                            className={`px-4 py-2 rounded-full text-sm font-semibold transition transform hover:scale-105 ${event.isAttending
                                                ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                                                : "bg-gradient-to-r from-red-600 to-orange-600 text-white hover:shadow-lg"
                                                }`}
                                        >
                                            {event.isAttending ? "Registered" : "Register"}
                                        </button>
                                    </div>

                                    {event.registrationLink && (
                                        <a
                                            href={event.registrationLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block mt-3 text-center text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
                                        >
                                            External Registration →
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            { }
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transition-colors duration-200">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Create New Event
                                </h2>
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    className="text-gray-400 hover:text-gray-600 transition"
                                >
                                    <svg
                                        className="w-6 h-6"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleCreateEvent} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Title *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={newEvent.title}
                                        onChange={(e) =>
                                            setNewEvent({ ...newEvent, title: e.target.value })
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Description *
                                    </label>
                                    <textarea
                                        required
                                        rows={4}
                                        value={newEvent.description}
                                        onChange={(e) =>
                                            setNewEvent({ ...newEvent, description: e.target.value })
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Type *
                                        </label>
                                        <select
                                            value={newEvent.type}
                                            onChange={(e) =>
                                                setNewEvent({ ...newEvent, type: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        >
                                            <option value="event">Event</option>
                                            <option value="internship">Internship</option>
                                            <option value="opportunity">Opportunity</option>
                                            <option value="workshop">Workshop</option>
                                            <option value="competition">Competition</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Date & Time *
                                        </label>
                                        <input
                                            type="datetime-local"
                                            required
                                            value={newEvent.date}
                                            onChange={(e) =>
                                                setNewEvent({ ...newEvent, date: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={newEvent.isVirtual}
                                            onChange={(e) =>
                                                setNewEvent({ ...newEvent, isVirtual: e.target.checked })
                                            }
                                            className="rounded text-red-600 focus:ring-red-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Virtual Event
                                        </span>
                                    </label>
                                </div>

                                {!newEvent.isVirtual && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Location
                                        </label>
                                        <input
                                            type="text"
                                            value={newEvent.location}
                                            onChange={(e) =>
                                                setNewEvent({ ...newEvent, location: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                                        />
                                    </div>
                                )}

                                {newEvent.isVirtual && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Meeting Link
                                        </label>
                                        <input
                                            type="url"
                                            value={newEvent.meetingLink}
                                            onChange={(e) =>
                                                setNewEvent({ ...newEvent, meetingLink: e.target.value })
                                            }
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Registration Link
                                    </label>
                                    <input
                                        type="url"
                                        value={newEvent.registrationLink}
                                        onChange={(e) =>
                                            setNewEvent({
                                                ...newEvent,
                                                registrationLink: e.target.value,
                                            })
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Max Attendees (optional)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={newEvent.maxAttendees}
                                        onChange={(e) =>
                                            setNewEvent({ ...newEvent, maxAttendees: e.target.value })
                                        }
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Tags (comma-separated)
                                    </label>
                                    <input
                                        type="text"
                                        value={newEvent.tags}
                                        onChange={(e) =>
                                            setNewEvent({ ...newEvent, tags: e.target.value })
                                        }
                                        placeholder="e.g. tech, networking, career"
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                                    />
                                </div>

                                <div>
                                    <label className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            checked={newEvent.visibility === "admins_only"}
                                            onChange={(e) =>
                                                setNewEvent({ ...newEvent, visibility: e.target.checked ? "admins_only" : "public" })
                                            }
                                            className="rounded text-red-600 focus:ring-red-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Admins Only
                                        </span>
                                    </label>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                                        Only administrators will be able to see this event
                                    </p>
                                </div>

                                <div className="flex space-x-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:shadow-lg transition transform hover:scale-105"
                                    >
                                        Create Event
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
