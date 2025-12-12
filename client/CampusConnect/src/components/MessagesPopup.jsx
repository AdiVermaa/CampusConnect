import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { getAccessToken } from '../api/auth';
import { useSocket } from '../contexts/SocketContext';
import cacheManager, { CACHE_KEYS } from '../utils/cacheManager';
import Toast from './Toast';
import './MessagesPopup.css';

const MessagesPopup = ({ isOpen, onClose }) => {
    const { on } = useSocket();
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const messagesEndRef = useRef(null);
    const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ isOpen: true, message, type });
    };

    useEffect(() => {
        if (isOpen) {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            setCurrentUser(user);

            const unsubscribe = on('message:new', (data) => {
                if (selectedConversation?.id === data.conversationId) {
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
            const cachedConversations = cacheManager.get(CACHE_KEYS.CONVERSATIONS);
            if (cachedConversations) {
                setConversations(cachedConversations);
            }

            const token = getAccessToken();
            const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            const fetchedConversations = data.conversations || [];
            
            setConversations(fetchedConversations);
            cacheManager.set(CACHE_KEYS.CONVERSATIONS, fetchedConversations);
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

            const data = await response.json();
            if (data.message) {
                 setMessages(prev => prev.map(m => 
                    m.id === tempId ? data.message : m
                 ));
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setNewMessage(messageText);
            showToast('Failed to send message. Please try again.', 'error');
        }
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

    const formatTime = (date) => {
        const messageDate = new Date(date);
        return messageDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    if (!isOpen) return null;

    return (
        <>
            <Toast 
                message={toast.message} 
                type={toast.type} 
                isOpen={toast.isOpen} 
                onClose={() => setToast(prev => ({ ...prev, isOpen: false }))} 
            />
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
                            conversations.map((conv) => {
                                const otherParticipant = conv.participants.find(p => p.id !== currentUser?.id) || conv.participants[0];
                                return (
                                <div
                                    key={conv.id}
                                    className="popup-conversation-item"
                                    onClick={() => setSelectedConversation(conv)}
                                >
                                    <div className="popup-avatar">
                                        {otherParticipant?.profile_photo ? (
                                            <img src={otherParticipant.profile_photo} alt={conv.name} />
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
                                        <p className="popup-last-msg">
                                            {conv.lastMessage?.text || (conv.lastMessage?.attachment ? '📎 Attachment' : 'No messages')}
                                        </p>
                                    </div>
                                </div>
                                );
                            })
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
                                    <div className="popup-msg-bubble">
                                        {message.attachment ? (
                                            <div className="popup-attachment">
                                                {message.attachmentType === 'image' ? (
                                                    <img src={message.attachment} alt="Attachment" className="popup-attachment-image" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                                                ) : (
                                                    <a href={message.attachment} download className="popup-attachment-file" style={{ color: 'inherit', textDecoration: 'underline' }}>
                                                        Download File
                                                    </a>
                                                )}
                                            </div>
                                        ) : (
                                            message.text
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <form className="popup-input" onSubmit={sendMessage}>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                style={{ display: 'none' }} 
                                onChange={handleFileSelect}
                                accept="image/*,.pdf,.doc,.docx"
                            />
                            <button 
                                type="button" 
                                className="popup-icon-btn"
                                onClick={() => fileInputRef.current?.click()}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px', color: '#666' }}
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
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
        </>
    );
};

export default MessagesPopup;
