import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { getAccessToken } from '../api/auth';
import './MessagesWidget.css';

const MessagesWidget = ({ onOpenPopup }) => {
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConversations();
    }, []);

    const fetchConversations = async () => {
        try {
            const token = getAccessToken();
            const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setConversations((data.conversations || []).slice(0, 5));
            setLoading(false);
        } catch (error) {
            console.error('Error fetching conversations:', error);
            setLoading(false);
        }
    };

    const formatTime = (date) => {
        const now = new Date();
        const messageDate = new Date(date);
        const diffInHours = (now - messageDate) / (1000 * 60 * 60);

        if (diffInHours < 1) {
            const diffInMinutes = Math.floor((now - messageDate) / (1000 * 60));
            return diffInMinutes < 1 ? 'now' : `${diffInMinutes}m`;
        } else if (diffInHours < 24) {
            return `${Math.floor(diffInHours)}h`;
        } else {
            return `${Math.floor(diffInHours / 24)}d`;
        }
    };

    return (
        <div className="messages-widget">
            <div className="widget-header">
                <h3>Messages</h3>
                <button className="widget-icon-btn" onClick={onOpenPopup}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </div>

            <div className="widget-conversations">
                {loading ? (
                    <div className="widget-loading">Loading...</div>
                ) : conversations.length === 0 ? (
                    <div className="widget-empty">
                        <p>No messages yet</p>
                        <button className="widget-send-btn" onClick={() => navigate('/messages')}>
                            Send message
                        </button>
                    </div>
                ) : (
                    conversations.map((conv) => (
                        <div
                            key={conv.id}
                            className="widget-conversation"
                            onClick={() => navigate('/messages')}
                        >
                            <div className="widget-avatar">
                                {conv.participants[0]?.profile_photo ? (
                                    <img src={conv.participants[0].profile_photo} alt={conv.name} />
                                ) : (
                                    <div className="widget-avatar-placeholder">
                                        {conv.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="widget-online"></div>
                            </div>
                            <div className="widget-info">
                                <div className="widget-top">
                                    <h4>{conv.name}</h4>
                                    <span className="widget-time">{formatTime(conv.lastMessageAt)}</span>
                                </div>
                                <p className="widget-last-msg">
                                    {conv.lastMessage?.text || 'No messages yet'}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {conversations.length > 0 && (
                <button className="widget-view-all" onClick={() => navigate('/messages')}>
                    View all messages
                </button>
            )}
        </div>
    );
};

export default MessagesWidget;
