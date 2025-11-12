import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Send, ArrowLeft, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWalletStore } from '../stores/walletStore';
import { useUserStore } from '../stores/userStore';
import toast from 'react-hot-toast';
import { WS_URL } from '../config/env';
import io, { Socket } from 'socket.io-client';

interface ChatMessage {
  id: number;
  user_address: string;
  admin_id: number | null;
  message: string;
  sender_type: 'user' | 'admin';
  is_read: boolean;
  created_at: string;
  user_name?: string;
  admin_username?: string;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  
  const { address, isConnected } = useWalletStore();
  const { user } = useUserStore();
  const navigate = useNavigate();

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch messages
  const fetchMessages = async () => {
    if (!isConnected || !address) return;

    try {
      const token = localStorage.getItem('authToken') || '';
      const response = await fetch('/api/chat/messages', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    if (!isConnected || !address) return;

    try {
      const token = localStorage.getItem('authToken') || '';
      const response = await fetch('/api/chat/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.data.unread_count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // Setup Socket.IO connection
  useEffect(() => {
    if (!isConnected || !address) {
      navigate('/');
      return;
    }

    // Fetch initial messages
    fetchMessages();
    fetchUnreadCount();

    // Setup socket connection
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    socket.on('connect', () => {
      console.log('💬 Chat: Connected to socket');
      socket.emit('join-chat', address.toLowerCase());
    });

    // Listen for new messages (from admin or other sources)
    socket.on('new-chat-message', (data: { message: ChatMessage }) => {
      console.log('💬 Chat: New message received:', data);
      setMessages(prev => {
        // Check if message already exists to prevent duplicates
        const exists = prev.some(msg => msg.id === data.message.id);
        if (exists) {
          console.log('💬 Chat: Message already exists, skipping duplicate');
          return prev;
        }
        return [...prev, data.message];
      });
      if (data.message.sender_type === 'admin') {
        setUnreadCount(prev => prev + 1);
      }
      scrollToBottom();
    });

    // Listen for message sent confirmation (only for user's own messages)
    socket.on('chat-message-sent', (data: { message: ChatMessage }) => {
      console.log('💬 Chat: Message sent confirmation:', data);
      setMessages(prev => {
        // Check if message already exists to prevent duplicates
        const exists = prev.some(msg => msg.id === data.message.id);
        if (exists) {
          console.log('💬 Chat: Message already exists, skipping duplicate');
          return prev;
        }
        return [...prev, data.message];
      });
      scrollToBottom();
    });

    socket.on('chat-error', (error: { error: string }) => {
      console.error('💬 Chat error:', error);
      toast.error(error.error || 'Chat error occurred');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [isConnected, address, navigate]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !isConnected || !address || isSending) return;

    setIsSending(true);
    const messageText = newMessage.trim();
    setNewMessage(''); // Clear input immediately for better UX

    try {
      // Send via socket for real-time (socket will save to DB)
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('chat-message', {
          message: messageText,
          userAddress: address.toLowerCase()
        });
        // Don't add message here - wait for socket confirmation to avoid duplicates
      } else {
        // Fallback to API if socket not connected
        const token = localStorage.getItem('authToken') || '';
        const response = await fetch('/api/chat/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message: messageText })
        });

        if (!response.ok) {
          const errorData = await response.json();
          toast.error(errorData.error || 'Failed to send message');
          setNewMessage(messageText); // Restore message on error
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      setNewMessage(messageText); // Restore message on error
    } finally {
      setIsSending(false);
    }
  };

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages.length > 0 && isConnected && address) {
      const token = localStorage.getItem('authToken') || '';
      fetch('/api/chat/mark-read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).catch(err => console.error('Error marking as read:', err));
      
      setUnreadCount(0);
    }
  }, [messages, isConnected, address]);

  if (!isConnected || !address) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white text-lg mb-4">Please connect your wallet to use chat support</p>
          <button
            onClick={() => navigate('/')}
            className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2 rounded-lg"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-2xl flex flex-col h-[calc(100vh-2rem)]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-bold">Chat Support</h1>
              <p className="text-xs text-blue-100">
                {user?.name || 'User'} • {address.slice(0, 6)}...{address.slice(-4)}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageSquare size={48} className="mb-4" />
              <p className="text-center">No messages yet. Start a conversation!</p>
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.sender_type === 'user';
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg p-3 ${
                      isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {!isUser && (
                      <p className="text-xs font-semibold mb-1 text-gray-600">
                        {message.admin_username || 'Admin'}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
                    <p className={`text-xs mt-1 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                      {new Date(message.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 bg-white rounded-b-xl">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSending}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;

