import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';
import { getAccessToken } from '../api/auth';
import './Messages.css';

const Messages = () => {
    const navigate = useNavigate();
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const [showNewMessageModal, setShowNewMessageModal] = useState(false);
    const [userSearchResults, setUserSearchResults] = useState([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);

    const selectedConversationRef = useRef(selectedConversation);

    useEffect(() => {
        selectedConversationRef.current = selectedConversation;
    }, [selectedConversation]);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        // Ensure we have an id field (could be _id, id, or userId)
        if (!user.id) {
            user.id = user._id || user.userId;
        }
        console.log('Current user loaded:', {
            fullUser: user,
            hasId: !!user.id,
            id: user.id,
            _id: user._id,
            userId: user.userId
        });
        setCurrentUser(user);

        // Initialize Socket.IO
        const token = getAccessToken();
        socketRef.current = io(API_BASE_URL, {
            auth: { token }
        });

        socketRef.current.on('connect', () => {
            console.log('✅ Connected to WebSocket');
        });

        socketRef.current.on('message:new', (data) => {
            console.log('📨 New message received:', data);
            // Use ref to get current value
            if (selectedConversationRef.current?.id === data.conversationId) {
                setMessages(prev => {
                    // Check if message already exists to avoid duplicates
                    const exists = prev.some(m => m.id === data.message.id);
                    if (exists) return prev;
                    return [...prev, data.message];
                });
            }
            // Update conversation list
            fetchConversations();
        });

        socketRef.current.on('conversation:update', (data) => {
            setConversations(prev => {
                const index = prev.findIndex(c => c.id === data.conversation.id);
                if (index !== -1) {
                    const updated = [...prev];
                    updated[index] = data.conversation;
                    return updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
                }
                return [data.conversation, ...prev];
            });
        });

        fetchConversations();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.id);
            // Join conversation room
            if (socketRef.current) {
                socketRef.current.emit('join:conversation', selectedConversation.id);
            }
            // Mark messages as read
            markAsRead(selectedConversation.id);
        }
    }, [selectedConversation]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchConversations = async () => {
        try {
            const token = getAccessToken();
            const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            setConversations(data.conversations || []);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching conversations:', error);
            setLoading(false);
        }
    };

    const fetchMessages = async (conversationId) => {
        try {
            const token = getAccessToken();
            const response = await fetch(
                `${API_BASE_URL}/api/chat/conversations/${conversationId}/messages`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            const data = await response.json();
            setMessages(data.messages || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    const markAsRead = async (conversationId) => {
        try {
            const token = getAccessToken();
            await fetch(
                `${API_BASE_URL}/api/chat/conversations/${conversationId}/read`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedConversation) return;

        try {
            const token = getAccessToken();
            const response = await fetch(
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

            if (response.ok) {
                setNewMessage('');
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleUserSearch = async (query) => {
        if (!query.trim()) {
            setUserSearchResults([]);
            return;
        }
        setIsSearchingUsers(true);
        try {
            const token = getAccessToken();
            const response = await fetch(`${API_BASE_URL}/api/auth/search?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setUserSearchResults(data.results || []);
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setIsSearchingUsers(false);
        }
    };

    const startNewConversation = async (userId) => {
        try {
            const token = getAccessToken();
            const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ participantIds: [userId] })
            });
            const data = await response.json();

            if (data.conversation) {
                // Check if conversation already exists in list
                const exists = conversations.find(c => c.id === data.conversation.id);
                if (!exists) {
                    setConversations(prev => [data.conversation, ...prev]);
                }
                setSelectedConversation(data.conversation);
                setShowNewMessageModal(false);
                setUserSearchResults([]);
            }
        } catch (error) {
            console.error('Error creating conversation:', error);
        }
    };

    const filteredConversations = conversations.filter(conv =>
        conv.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatTime = (date) => {
        const now = new Date();
        const messageDate = new Date(date);
        const diffInHours = (now - messageDate) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return messageDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } else if (diffInHours < 168) {
            return messageDate.toLocaleDateString('en-US', { weekday: 'short' });
        } else {
            return messageDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    };

    return (
        <>
            {/* Navbar */}
            <nav className="bg-white shadow px-6 py-3 flex justify-between items-center sticky top-0 z-10">
                <h1
                    className="text-2xl font-bold text-red-600 cursor-pointer"
                    onClick={() => navigate('/dashboard')}
                >
                    CampusConnect
                </h1>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition"
                >
                    Back to Dashboard
                </button>
            </nav>

            <div className="messages-container"
                style={{ height: 'calc(100vh - 60px)' }}
            >
                {/* Sidebar */}
                <div className="messages-sidebar">
                    <div className="messages-header">
                        <div className="user-info">
                            <h2>{currentUser?.name || 'Messages'}</h2>
                            <button
                                className="new-message-btn"
                                title="New Message"
                                onClick={() => setShowNewMessageModal(true)}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M21 2L11 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    <path d="M21 2L14 22L11 12L2 9L21 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>

                        <div className="search-box">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
                                <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="messages-tabs">
                        <button className="tab active">Messages</button>
                        <button className="tab">Requests</button>
                    </div>

                    <div className="conversations-list">
                        {loading ? (
                            <div className="loading">Loading...</div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="empty-state">No conversations yet</div>
                        ) : (
                            filteredConversations.map((conv) => (
                                <div
                                    key={conv.id}
                                    className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''}`}
                                    onClick={() => setSelectedConversation(conv)}
                                >
                                    <div className="conversation-avatar">
                                        {conv.participants[0]?.profile_photo ? (
                                            <img src={conv.participants[0].profile_photo} alt={conv.name} />
                                        ) : (
                                            <div className="avatar-placeholder">
                                                {conv.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="online-indicator"></div>
                                    </div>
                                    <div className="conversation-info">
                                        <div className="conversation-top">
                                            <h4>{conv.name}</h4>
                                            <span className="time">{formatTime(conv.lastMessageAt)}</span>
                                        </div>
                                        <p className="last-message">
                                            {conv.lastMessage?.text || 'No messages yet'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="messages-chat">
                    {selectedConversation ? (
                        <>
                            <div className="chat-header">
                                <div className="chat-user-info">
                                    <div className="chat-avatar">
                                        {selectedConversation.participants[0]?.profile_photo ? (
                                            <img src={selectedConversation.participants[0].profile_photo} alt={selectedConversation.name} />
                                        ) : (
                                            <div className="avatar-placeholder">
                                                {selectedConversation.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3>{selectedConversation.name}</h3>
                                        <span className="status">Active now</span>
                                    </div>
                                </div>

                            </div>

                            <div className="chat-messages">
                                {messages.map((message) => {
                                    const sender = message.sender || { id: 'deleted', name: 'Deleted User', profile_photo: null };
                                    const isSent = String(sender.id) === String(currentUser?.id);

                                    return (
                                        <div
                                            key={message.id}
                                            className={`message ${isSent ? 'sent' : 'received'}`}
                                        >
                                            {!isSent && (
                                                <div className="message-avatar">
                                                    {sender.profile_photo ? (
                                                        <img src={sender.profile_photo} alt={sender.name} />
                                                    ) : (
                                                        <div className="avatar-placeholder-small">
                                                            {sender.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div className="message-bubble">
                                                {message.post ? (
                                                    <div className="shared-post">
                                                        <div className="shared-post-header">
                                                            <span className="shared-label">📤 Shared a post</span>
                                                        </div>
                                                        {message.post.image && (
                                                            <img
                                                                src={message.post.image}
                                                                alt="Shared post"
                                                                className="shared-post-image"
                                                            />
                                                        )}
                                                        <div className="shared-post-content">
                                                            <p>{message.post.content}</p>
                                                            {message.post.author && (
                                                                <span className="shared-post-author">
                                                                    - {message.post.author.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    message.text
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            <form className="chat-input" onSubmit={sendMessage}>
                                <button type="button" className="icon-btn">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                                        <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        <circle cx="9" cy="9" r="1" fill="currentColor" />
                                        <circle cx="15" cy="9" r="1" fill="currentColor" />
                                    </svg>
                                </button>
                                <input
                                    type="text"
                                    placeholder="Message..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                />
                                <button type="submit" disabled={!newMessage.trim()}>
                                    Send
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="empty-chat">
                            <div className="empty-icon">
                                <svg width="96" height="96" viewBox="0 0 24 24" fill="none">
                                    <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <h2>Your messages</h2>
                            <p>Send a message to start a chat.</p>
                            <button className="send-message-btn">Send message</button>
                        </div>
                    )}
                </div>


                {/* New Message Modal */}
                {
                    showNewMessageModal && (
                        <div className="modal-overlay" onClick={() => setShowNewMessageModal(false)}>
                            <div className="modal-content" onClick={e => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h3>New Message</h3>
                                    <button onClick={() => setShowNewMessageModal(false)}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="modal-body">
                                    <div className="user-search-input">
                                        <label>To:</label>
                                        <input
                                            type="text"
                                            placeholder="Search..."
                                            autoFocus
                                            onChange={(e) => handleUserSearch(e.target.value)}
                                        />
                                    </div>
                                    <div className="user-search-results">
                                        {isSearchingUsers ? (
                                            <div className="loading-small">Searching...</div>
                                        ) : userSearchResults.length > 0 ? (
                                            userSearchResults.map(user => (
                                                <div
                                                    key={user.id}
                                                    className="user-result-item"
                                                    onClick={() => startNewConversation(user.id)}
                                                >
                                                    <div className="user-avatar-small">
                                                        {user.profile_photo ? (
                                                            <img src={user.profile_photo} alt={user.name} />
                                                        ) : (
                                                            <span>{user.name.charAt(0).toUpperCase()}</span>
                                                        )}
                                                    </div>
                                                    <div className="user-info-small">
                                                        <h4>{user.name}</h4>
                                                        <span>{user.email}</span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="no-results">No users found</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>
        </>
    );
};

export default Messages;

