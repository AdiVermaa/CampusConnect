import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { getAccessToken, API } from '../api/auth';
import './MessagesWidget.css';

const MessagesWidget = ({ onOpenPopup }) => {
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = getAccessToken();
            const [convResponse, userResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/api/chat/conversations`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                API.get('/me')
            ]);

            const convData = await convResponse.json();
            setConversations((convData.conversations || []).slice(0, 5));
            setCurrentUser(userResponse.data);

            const conversationsWithUnread = (convData.conversations || []).filter(
                (conv) => (conv.unreadCount || 0) > 0
            ).length;
            setUnreadCount(conversationsWithUnread);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setLoading(false);
        }
    };

    return (
        <div className="messages-widget-dark" onClick={() => navigate('/messages')}>
            <div className="widget-dark-content">
                <div className="widget-dark-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {unreadCount > 0 && (
                        <div className="widget-dark-badge">{unreadCount}</div>
                    )}
                </div>
                <h3 className="widget-dark-title">Messages</h3>
                {currentUser && (
                    <div className="widget-dark-avatar">
                        {currentUser.profile_photo ? (
                            <img src={currentUser.profile_photo} alt={currentUser.name} />
                        ) : (
                            <div className="widget-dark-avatar-placeholder">
                                {currentUser.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessagesWidget;
