import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import OwnerNavbar from './OwnerNavbar';
import './OwnerConversations.css';

export default function OwnerConversations() {
    const { isAuthenticated } = useAuth();
    const [items, setItems] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const pollRef = useRef(null);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/owner-login');
            return;
        }
        let cancelled = false;
        const load = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/owner/conversations');
                if (!cancelled && res.data?.success) setItems(res.data.conversations);
            } catch (e) {
                if (!cancelled) setError(e.response?.data?.message || 'Failed to load');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        pollRef.current = setInterval(load, 3000);
        return () => { cancelled = true; clearInterval(pollRef.current); };
    }, [isAuthenticated, navigate]);

    if (loading) return (
        <div>
            <OwnerNavbar />
            <div className="main-content">
                <div className="conversations-container">
                    <div className="conversations-loading">
                        <p>Loading conversations...</p>
                    </div>
                </div>
            </div>
        </div>
    );

    if (error) return (
        <div>
            <OwnerNavbar />
            <div className="main-content">
                <div className="conversations-container">
                    <div className="conversations-error">
                        <p>{error}</p>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <OwnerNavbar />
            <div className="main-content">
                <div className="conversations-container">
                    <div className="conversations-header">
                        <h2>Messages</h2>
                        <div className="conversations-stats">
                            <span className="stat-badge">
                                {items.length} conversation{items.length !== 1 ? 's' : ''}
                            </span>
                            {items.filter(c => c.unreadCount > 0).length > 0 && (
                                <span className="stat-badge">
                                    {items.filter(c => c.unreadCount > 0).length} unread
                                </span>
                            )}
                        </div>
                    </div>

                    {items.length === 0 ? (
                        <div className="empty-conversations">
                            <h3>No conversations yet</h3>
                            <p>When users inquire about your pets, their messages will appear here.</p>
                        </div>
                    ) : (
                        <ul className="conversations-list">
                            {items.map((c, idx) => (
                                <li key={idx} className={`conversation-item ${c.unreadCount > 3 ? 'priority' : ''}`}>
                                    <div className="conversation-content">
                                        <div className="conversation-info">
                                            <div className="conversation-header">
                                                <div className="pet-info">
                                                    Pet: {c.pet?.name}
                                                </div>
                                                {c.unreadCount > 0 && (
                                                    <span className="unread-badge">{c.unreadCount}</span>
                                                )}
                                            </div>

                                            <div className="user-info">
                                                <span className="user-name">{c.user?.name}</span>
                                                <span className="user-email">({c.user?.email})</span>
                                            </div>

                                            <div className="last-message">
                                                {c.lastMessage || 'No messages yet'}
                                            </div>

                                            <div className="conversation-meta">
                                                <div className="conversation-time">
                                                    {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : 'Recent'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="conversation-actions">
                                            <button
                                                className="open-chat-btn"
                                                onClick={() => navigate(`/owner/chat/${c.pet._id}?userId=${c.user._id}`)}
                                            >
                                                Open Chat
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </>
    );
}
