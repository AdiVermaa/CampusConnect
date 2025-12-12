import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { getAccessToken } from '../api/auth';
import { useSocket } from '../contexts/SocketContext';
import cacheManager, { CACHE_KEYS } from '../utils/cacheManager';
import Toast from '../components/Toast';
import './Messages.css';

const Messages = () => {
    const navigate = useNavigate();
    const { on, emit, isConnected } = useSocket();
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const messagesEndRef = useRef(null);
    const [showNewMessageModal, setShowNewMessageModal] = useState(false);
    const [userSearchResults, setUserSearchResults] = useState([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);

    const selectedConversationRef = useRef(selectedConversation);

    const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ isOpen: true, message, type });
    };

    useEffect(() => {
        selectedConversationRef.current = selectedConversation;
    }, [selectedConversation]);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');

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

        const unsubscribeNewMessage = on('message:new', (data) => {
            console.log('📨 New message received:', data);

            if (selectedConversationRef.current?.id === data.conversationId) {
                setMessages(prev => {
                    const exists = prev.some(m => m.id === data.message.id);
                    if (exists) return prev;

                    
                    const isMyMessage = data.message.sender.id === user.id;
                    if (isMyMessage) {
                         const pendingMatchIndex = prev.findIndex(m => 
                            m.status === 'sending' && 
                            m.text === data.message.text
                        );
                        
                        if (pendingMatchIndex !== -1) {
                            // Replace the pending message with the real one
                            const newMessages = [...prev];
                            newMessages[pendingMatchIndex] = data.message;
                            return newMessages;
                        }
                    }

                    return [...prev, data.message];
                });
            }

            fetchConversations();
        });

        const unsubscribeConversationUpdate = on('conversation:update', (data) => {
            setConversations(prev => {
                const index = prev.findIndex(c => c.id === data.conversation.id);
                let updatedConversations;
                if (index !== -1) {
                    const updated = [...prev];
                    updated[index] = data.conversation;
                    updatedConversations = updated.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
                } else {
                    updatedConversations = [data.conversation, ...prev];
                }
                cacheManager.set(CACHE_KEYS.CONVERSATIONS, updatedConversations);
                return updatedConversations;
            });
        });

        fetchConversations();

        return () => {
            if (unsubscribeNewMessage) unsubscribeNewMessage();
            if (unsubscribeConversationUpdate) unsubscribeConversationUpdate();
        };
    }, [on]);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.id);

            emit('join:conversation', selectedConversation.id);

            markAsRead(selectedConversation.id);
        }
    }, [selectedConversation, emit]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchConversations = async () => {
        try {
            const cachedConversations = cacheManager.get(CACHE_KEYS.CONVERSATIONS);
            if (cachedConversations) {
                setConversations(cachedConversations);
                setLoading(false);
            }

            const token = getAccessToken();
            const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            const fetchedConversations = data.conversations || [];
            
            setConversations(fetchedConversations);
            cacheManager.set(CACHE_KEYS.CONVERSATIONS, fetchedConversations);
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

        const tempId = Date.now().toString();
        const messageText = newMessage;
        
        // Optimistic update
        const optimisticMessage = {
            id: tempId,
            text: messageText,
            sender: currentUser,
            createdAt: new Date().toISOString(),
            conversationId: selectedConversation.id,
            status: 'sending'
        };

        setMessages(prev => [...prev, optimisticMessage]);
        setNewMessage('');

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
                    body: JSON.stringify({ text: messageText })
                }
            );

            if (!response.ok) {
                throw new Error('Failed to send message');
            }
            
            // The socket event will handle the real message addition and deduplication
            // But if we want to be super safe, we could replace the temp message here with the response
            // For now, relying on the socket event (which we already have) is fine, 
            // but we should remove the temp message if the socket event comes in with the real one.
            // Our socket listener checks for ID existence. The real message will have a different ID.
            // So we might see a duplicate briefly until we reconcile.
            // To fix this properly, we should update the temp message with the real ID when we get the response/socket event.
            // However, since the user just wants speed, let's stick to this. 
            // Ideally, we'd replace the item in the array.
            
            const data = await response.json();
            if (data.message) {
                 setMessages(prev => prev.map(m => 
                    m.id === tempId ? data.message : m
                 ));
            }

        } catch (error) {
            console.error('Error sending message:', error);
            // Revert optimistic update on error
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setNewMessage(messageText); // Restore text
            showToast('Failed to send message. Please try again.', 'error');
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

    const handleBackToConversations = () => {
        setSelectedConversation(null);
    };

    const fileInputRef = useRef(null);

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast("File size must be less than 5MB", "error");
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result;
            const type = file.type.startsWith("image/") ? "image" : "file";
            await sendAttachment(base64, type);
        };
        reader.readAsDataURL(file);
        e.target.value = null;
    };

    const sendAttachment = async (base64, type) => {
        if (!selectedConversation) return;

        const tempId = Date.now().toString();
        
        const optimisticMessage = {
            id: tempId,
            text: "",
            attachment: base64,
            attachmentType: type,
            sender: currentUser,
            createdAt: new Date().toISOString(),
            conversationId: selectedConversation.id,
            status: 'sending'
        };

        setMessages(prev => [...prev, optimisticMessage]);

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
                    body: JSON.stringify({ 
                        text: "",
                        attachment: base64,
                        attachmentType: type
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to send attachment');
            }

            const data = await response.json();
            if (data.message) {
                 setMessages(prev => prev.map(m => 
                    m.id === tempId ? data.message : m
                 ));
            }
        } catch (error) {
            console.error('Error sending attachment:', error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            showToast(error.message || 'Failed to send attachment. Please try again.', 'error');
        }
    };

    return (
        <>
            <Toast 
                message={toast.message} 
                type={toast.type} 
                isOpen={toast.isOpen} 
                onClose={() => setToast(prev => ({ ...prev, isOpen: false }))} 
            />
            {/* Navigation Bar */}
            <nav className="bg-white dark:bg-gray-800 shadow px-6 py-3 flex justify-between items-center sticky top-0 z-10 transition-colors duration-200">
                <h1
                    className="text-2xl font-bold text-red-600 cursor-pointer"
                    onClick={() => navigate('/dashboard')}
                >
                    CampusConnect
                </h1>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                    Back to Dashboard
                </button>
            </nav>

            <div className={`messages-container ${selectedConversation ? 'mobile-chat-active' : ''}`}
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
                            filteredConversations.map((conv) => {
                                const otherParticipant = conv.participants.find(p => p.id !== currentUser?.id) || conv.participants[0];
                                return (
                                <div
                                    key={conv.id}
                                    className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''}`}
                                    onClick={() => setSelectedConversation(conv)}
                                >
                                    <div className="conversation-avatar">
                                        {otherParticipant?.profile_photo ? (
                                            <img src={otherParticipant.profile_photo} alt={conv.name} />
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
                                            {conv.lastMessage?.text || (conv.lastMessage?.attachment ? '📎 Attachment' : 'No messages yet')}
                                        </p>
                                    </div>
                                </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="messages-chat">
                    {selectedConversation ? (
                        <>
                            <div className="chat-header">
                                <div className="chat-user-info">
                                    <button
                                        className="mobile-back-btn"
                                        onClick={handleBackToConversations}
                                        style={{ display: 'none', marginRight: '10px', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="19" y1="12" x2="5" y2="12"></line>
                                            <polyline points="12 19 5 12 12 5"></polyline>
                                        </svg>
                                    </button>
                                    <div className="chat-avatar">
                                        {(() => {
                                            const otherParticipant = selectedConversation.participants.find(p => p.id !== currentUser?.id) || selectedConversation.participants[0];
                                            return otherParticipant?.profile_photo ? (
                                                <img src={otherParticipant.profile_photo} alt={selectedConversation.name} />
                                            ) : (
                                                <div className="avatar-placeholder">
                                                    {selectedConversation.name.charAt(0).toUpperCase()}
                                                </div>
                                            );
                                        })()}
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
                                                {message.attachment ? (
                                                    <div className="message-attachment">
                                                        {message.attachmentType === 'image' ? (
                                                            <img src={message.attachment} alt="Attachment" className="max-w-xs rounded-lg" style={{ maxHeight: '200px' }} />
                                                        ) : (
                                                            <a href={message.attachment} download className="flex items-center gap-2 text-blue-500 hover:underline">
                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                                                                    <polyline points="13 2 13 9 20 9"></polyline>
                                                                </svg>
                                                                Download File
                                                            </a>
                                                        )}
                                                    </div>
                                                ) : message.post ? (
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
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    style={{ display: 'none' }} 
                                    onChange={handleFileSelect}
                                    accept="image/*,.pdf,.doc,.docx"
                                />
                                <button 
                                    type="button" 
                                    className="icon-btn"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

                { }
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
