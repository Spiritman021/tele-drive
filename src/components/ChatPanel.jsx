import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Loader2, Info } from 'lucide-react';
import telegramService from '../services/telegram';
import './ChatPanel.css';

export default function ChatPanel({ activeDrive, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const subscriptionRef = useRef(null);

  // Resolve chat target ('me' for personal drive, entity for channels)
  const chatTarget = activeDrive && activeDrive.id !== 'personal' ? activeDrive.entity : 'me';
  const chatName = activeDrive ? activeDrive.title : 'My Drive';
  const isReadOnly = activeDrive ? !activeDrive.canPost : false;

  // Scroll to bottom helper
  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // Check if user is scrolled near bottom
  const isNearBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return false;
    const threshold = 150; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  };

  // Load message history
  const loadHistory = async (offsetId = 0, loadOlder = false) => {
    if (loadOlder) {
      setLoadingOlder(true);
    } else {
      setLoading(false); // don't show full spinner if already loaded, but set it for initial
      setLoading(true);
    }
    setError('');

    try {
      const history = await telegramService.getChatMessages(chatTarget, 40, offsetId);
      if (loadOlder) {
        // Prepend history
        setMessages((prev) => [...history, ...prev]);
      } else {
        setMessages(history);
        // Delay scroll to bottom to allow DOM update
        setTimeout(() => scrollToBottom('instant'), 50);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
      setError('Failed to load chat history.');
    } finally {
      setLoading(false);
      setLoadingOlder(false);
    }
  };

  // Load initial history on target change
  useEffect(() => {
    setMessages([]);
    loadHistory(0, false);

    // Subscribe to real-time updates
    if (subscriptionRef.current) {
      subscriptionRef.current(); // clean up previous
    }

    try {
      subscriptionRef.current = telegramService.subscribeToMessages(chatTarget, (newMsg) => {
        setMessages((prev) => {
          // Avoid duplicate messages
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          
          const nearBottom = isNearBottom();
          const updated = [...prev, newMsg];
          
          // Scroll if near bottom or outgoing
          if (nearBottom || newMsg.outgoing) {
            setTimeout(() => scrollToBottom('smooth'), 50);
          }
          return updated;
        });
      });
    } catch (err) {
      console.warn('Real-time updates subscription failed:', err);
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current();
      }
    };
  }, [activeDrive]);

  // Handle Send Message
  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending || isReadOnly) return;

    setSending(true);
    setError('');
    const textToSend = inputText.trim();
    setInputText('');

    try {
      await telegramService.sendMessage(chatTarget, textToSend);
      // Real-time handler will receive the NewMessage event and add it to state,
      // but in case it's a self-message and events are delayed, we can rely on GramJS's fast event emission.
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message.');
      setInputText(textToSend); // restore
    } finally {
      setSending(false);
    }
  };

  // Handle Enter Key in Textarea
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Helper to format timestamps
  const formatTime = (unixTimestamp) => {
    if (!unixTimestamp) return '';
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper to format date headers
  const formatDateHeader = (unixTimestamp) => {
    const date = new Date(unixTimestamp * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  // Render initials avatar helper
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Generate color palette based on name hash for avatar consistency
  const getAvatarBg = (name) => {
    if (!name) return '#a1a1aa';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', 
      '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  return (
    <div className="teledrive-chat-panel animate-slide-in">
      {/* Header */}
      <div className="chat-panel-header">
        <div className="chat-header-info">
          <MessageSquare className="chat-header-icon" size={20} />
          <div className="chat-title-group">
            <h3>{chatName} Chat</h3>
            <span className="chat-status-indicator">
              <span className="status-dot"></span>
              Live Channel Chat
            </span>
          </div>
        </div>
        <button className="chat-close-btn" onClick={onClose} title="Close Chat">
          <X size={20} />
        </button>
      </div>

      {/* Message Area */}
      <div className="chat-messages-container" ref={scrollContainerRef}>
        {messages.length > 0 && (
          <div className="chat-load-older-wrapper">
            <button 
              className="chat-load-older-btn"
              onClick={() => loadHistory(messages[0].id, true)}
              disabled={loadingOlder}
            >
              {loadingOlder ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  Loading...
                </>
              ) : (
                'Load older messages'
              )}
            </button>
          </div>
        )}

        {loading && messages.length === 0 ? (
          <div className="chat-loading-state">
            <Loader2 className="animate-spin chat-loading-spinner" size={32} />
            <p>Loading conversation...</p>
          </div>
        ) : error && messages.length === 0 ? (
          <div className="chat-error-state">
            <Info size={24} />
            <p>{error}</p>
            <button onClick={() => loadHistory(0, false)}>Retry</button>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty-state">
            <MessageSquare size={48} className="chat-empty-icon" />
            <h4>No chat messages yet</h4>
            <p>
              {isReadOnly 
                ? 'There are no messages in this channel chat.' 
                : 'Send a message below to start the conversation!'}
            </p>
          </div>
        ) : (
          <div className="chat-messages-list">
            {messages.map((msg, index) => {
              const prevMsg = messages[index - 1];
              const showDateHeader = !prevMsg || 
                new Date(prevMsg.date * 1000).toDateString() !== new Date(msg.date * 1000).toDateString();
              
              // Group messages by sender within the same minute
              const isGrouped = prevMsg && 
                prevMsg.senderId === msg.senderId && 
                !showDateHeader && 
                (msg.date - prevMsg.date < 60);

              return (
                <div key={msg.id || index}>
                  {showDateHeader && (
                    <div className="chat-date-header">
                      <span>{formatDateHeader(msg.date)}</span>
                    </div>
                  )}
                  
                  <div className={`chat-message-row ${msg.outgoing ? 'outgoing' : 'incoming'} ${isGrouped ? 'grouped' : ''}`}>
                    {!msg.outgoing && !isGrouped && (
                      <div 
                        className="chat-sender-avatar"
                        style={{ backgroundColor: getAvatarBg(msg.senderName) }}
                        title={msg.senderName}
                      >
                        {getInitials(msg.senderName)}
                      </div>
                    )}
                    {!msg.outgoing && isGrouped && <div className="chat-sender-avatar-placeholder" />}
                    
                    <div className="chat-bubble-wrapper">
                      {!msg.outgoing && !isGrouped && (
                        <span className="chat-sender-name">{msg.senderName}</span>
                      )}
                      
                      <div className="chat-bubble">
                        <p className="chat-message-text">{msg.text}</p>
                        <span className="chat-message-time">{formatTime(msg.date)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="chat-composer-container">
        {isReadOnly ? (
          <div className="chat-readonly-notice">
            <Info size={16} />
            <span>You have read-only access to this channel chat.</span>
          </div>
        ) : (
          <form className="chat-composer-form" onSubmit={handleSend}>
            <textarea
              className="chat-composer-textarea"
              placeholder="Type a message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              rows={1}
            />
            <button 
              type="submit" 
              className="chat-send-button" 
              disabled={!inputText.trim() || sending}
              title="Send Message"
            >
              {sending ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
