import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { getAccessToken } from '../api/auth';
import { useSocket } from '../contexts/SocketContext';
import './MessagesPopup.css';

const MessagesPopup = ({ isOpen, onClose }) => {
    const { on } = useSocket();
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            setCurrentUser(user);

            const unsubscribe = on('message:new', (data) => {
                if (selectedConversation?.id === data.conversationId) {
                    setMessages(prev => [...prev, data.message]);
                }
                fetchConversations();
            });

            fetchConversations();

            return () => {
                if (unsubscribe) unsubscribe();
            };
        }
    }, [isOpen, on, selectedConversation]);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.id);
        }
    }, [selectedConversation]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchConversations = async () => {
        try {
            const token = getAccessToken();
            const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setConversations(data.conversations || []);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        }
    };

    const fetchMessages = async (conversationId) => {
        try {
            const token = getAccessToken();
            const response = await fetch(
                `${API_BASE_URL}/api/chat/conversations/${conversationId}/messages`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const data = await response.json();
            setMessages(data.messages || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedConversation) return;

        try {
            const token = getAccessToken();
            await fetch(
                `${API_BASE_URL}/api/chat/conversations/${selectedConversation.id}/messages`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text: newMessage })
                }
            );
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const formatTime = (date) => {
        const messageDate = new Date(date);
        return messageDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    if (!isOpen) return null;

    return (
        <div className="messages-popup-overlay" onClick={onClose}>
            <div className="messages-popup" onClick={(e) => e.stopPropagation()}>
                <div className="popup-header">
                    <button className="back-btn" onClick={() => setSelectedConversation(null)}>
                        {selectedConversation && (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    </button>
                    <h3>{selectedConversation ? selectedConversation.name : 'Messages'}</h3>
                    <button className="close-btn" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                {!selectedConversation ? (
                    <div className="popup-conversations">
                        {conversations.length === 0 ? (
                            <div className="popup-empty">No conversations yet</div>
                        ) : (
                            conversations.map((conv) => (
                                <div
                                    key={conv.id}
                                    className="popup-conversation-item"
                                    onClick={() => setSelectedConversation(conv)}
                                >
                                    <div className="popup-avatar">
                                        {conv.participants[0]?.profile_photo ? (
                                            <img src={conv.participants[0].profile_photo} alt={conv.name} />
                                        ) : (
                                            <div className="popup-avatar-placeholder">
                                                {conv.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="popup-online"></div>
                                    </div>
                                    <div className="popup-conv-info">
                                        <div className="popup-conv-top">
                                            <h4>{conv.name}</h4>
                                            <span className="popup-time">{formatTime(conv.lastMessageAt)}</span>
                                        </div>
                                        <p className="popup-last-msg">{conv.lastMessage?.text || 'No messages'}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <>
                        <div className="popup-messages">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`popup-message ${message.sender.id === currentUser?.id ? 'sent' : 'received'}`}
                                >
                                    {message.sender.id !== currentUser?.id && (
                                        <div className="popup-msg-avatar">
                                            {message.sender.profile_photo ? (
                                                <img src={message.sender.profile_photo} alt={message.sender.name} />
                                            ) : (
                                                <div className="popup-avatar-small">
                                                    {message.sender.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="popup-msg-bubble">{message.text}</div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <form className="popup-input" onSubmit={sendMessage}>
                            <input
                                type="text"
                                placeholder="Message..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                            />
                            <button type="submit" disabled={!newMessage.trim()}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default MessagesPopup;
