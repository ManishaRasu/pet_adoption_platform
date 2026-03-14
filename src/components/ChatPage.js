import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';
import './ChatPage.css';

export default function ChatPage() {
    const { id } = useParams(); // pet id
    const navigate = useNavigate();
    const { isAuthenticated, isAdmin, isOwner } = useAuth();
    const [pet, setPet] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const maxLen = 500;
    const endRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const pollRef = useRef(null);

    useEffect(() => {
        const isRegularUser = isAuthenticated && !isAdmin && !isOwner;
        if (!isRegularUser) {
            // If owner, send them to owner messages; otherwise ask for user login
            if (isOwner) navigate('/owner/messages'); else navigate('/user-login');
            return;
        }
        const fetchPet = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/pets/${id}`);
                setPet(res.data);
            } catch (e) {
                setError('Failed to load pet');
            }
        };
        fetchPet();
    }, [id, isAuthenticated, isAdmin, navigate, isOwner]);

    const loadMessages = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/pets/${id}/messages`);
            if (res.data?.success) setMessages(res.data.messages);
            // Mark any owner->user unread messages as read
            try { await axios.post(`http://localhost:5000/api/pets/${id}/messages/mark-read`); } catch (_) { }
        } catch (e) {
            // ignore transient errors
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMessages();
        pollRef.current = setInterval(loadMessages, 3000);
        return () => clearInterval(pollRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Auto-scroll when messages change
    useEffect(() => {
        if (endRef.current) {
            endRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const onSend = async (e) => {
        e.preventDefault();
        if (sending) return;
        setError('');
        const msg = text.trim();
        if (!msg) return;
        if (msg.length > maxLen) {
            setError(`Message too long (>${maxLen})`);
            return;
        }
        try {
            setSending(true);
            const res = await axios.post(`http://localhost:5000/api/pets/${id}/messages`, { text: msg });
            if (!res.data?.success) throw new Error(res.data?.message || 'Failed');
            setText('');
            await loadMessages();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to send');
        } finally {
            setSending(false);
        }
    };

    const remaining = maxLen - text.length;

    const onCloseChat = async () => {
        if (!window.confirm('Close this chat? This will clear the messages.')) return;
        try {
            await axios.delete(`http://localhost:5000/api/pets/${id}/messages`);
        } catch (_) { /* ignore */ }
        clearInterval(pollRef.current);
        setMessages([]);
        navigate(`/pets/${id}`);
    };

    if (loading && !pet) return <div className="chat-page"><div className="loading">Loading chat…</div></div>;
    if (error && !pet) return <div className="chat-page"><div className="error">{error}</div></div>;

    return (
        <div className="chat-page">
            <div className="chat-header" style={{ justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="icon-btn" onClick={() => navigate(-1)}>←</button>
                    <h3>Chat with owner {pet?.owner?.name ? `(${pet.owner.name})` : ''} — {pet?.name}</h3>
                </div>
                <button className="cancel-btn" onClick={onCloseChat} style={{ padding: '6px 12px' }}>Close Chat</button>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="chat-box">
                <div className="messages">
                    {messages.length === 0 && <div className="loading">No messages yet. Say hi!</div>}
                    {messages.map(m => {
                        const isMine = m.fromRole === 'user';
                        return (
                            <div key={m._id} className={`msg ${isMine ? 'from-user' : 'from-owner'}`}>
                                <div>{m.text}</div>
                                <div className="meta">{new Date(m.createdAt).toLocaleTimeString()}</div>
                                {isMine && (
                                    <div className="ticks">
                                        <span className={`tick ${m.read ? 'read' : ''}`}>✓</span>
                                        <span className={`tick ${m.read ? 'read' : ''}`}>{m.read ? '✓' : ''}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div ref={endRef} />
                </div>
                <form className="send-row" onSubmit={onSend}>
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Type a message"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                onSend(e);
                            }
                        }}
                        maxLength={maxLen + 1}
                    />
                    <button type="submit" disabled={sending || !text.trim()}>{sending ? 'Sending...' : 'Send'}</button>
                    <div style={{ fontSize: 11, color: remaining < 0 ? '#b00020' : '#555', alignSelf: 'center' }}>{remaining}</div>
                </form>
            </div>
        </div>
    );
}
