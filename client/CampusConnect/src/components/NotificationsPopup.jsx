import { useEffect, useState } from 'react';
import { NotificationsAPI, ConnectionsAPI } from '../api/auth';
import { useNavigate } from 'react-router-dom';

const NotificationsPopup = ({ isOpen, onClose }) => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen]);

    const fetchNotifications = async () => {
        try {
            const res = await NotificationsAPI.get('/');
            setNotifications(res.data.notifications);
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async (notification) => {
        try {
            await ConnectionsAPI.put(`/${notification.connectionId}/accept`);
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
        } catch (error) {
            console.error("Failed to accept", error);
        }
    };

    const handleReject = async (notification) => {
        try {
            await ConnectionsAPI.put(`/${notification.connectionId}/reject`);
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
        } catch (error) {
            console.error("Failed to reject", error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border dark:border-gray-700 z-50 overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                <h3 className="font-semibold dark:text-white">Notifications</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">✕</button>
            </div>
            <div className="max-h-96 overflow-y-auto">
                {loading ? (
                    <div className="p-4 text-center text-gray-500">Loading...</div>
                ) : notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">No notifications</div>
                ) : (
                    notifications.map(n => (
                        <div key={n.id} className="p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                            <div className="flex gap-3">
                                <div className="flex-shrink-0">
                                    {n.sender.profile_photo ? (
                                        <img src={n.sender.profile_photo} alt={n.sender.name} className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-sm">
                                            {n.sender.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-gray-800 dark:text-gray-200">
                                        <span className="font-semibold">{n.sender.name}</span>
                                        {n.type === 'connection_request' && " sent you a connection request."}
                                        {n.type === 'connection_accepted' && " accepted your connection request."}
                                        {n.type === 'connection_dismissed' && " dismissed your connection request."}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                                    
                                    {n.type === 'connection_request' && (
                                        <div className="flex gap-2 mt-2">
                                            <button 
                                                onClick={() => handleAccept(n)}
                                                className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-700 transition"
                                            >
                                                Accept
                                            </button>
                                            <button 
                                                onClick={() => handleReject(n)}
                                                className="bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 px-3 py-1 rounded-lg text-xs font-medium hover:bg-gray-300 transition"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default NotificationsPopup;
