import React, { useEffect, useState, useRef } from 'react';
import { MessageSquare, Send, Loader2, Search, User } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { WS_URL } from '../../config/env';
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

interface ChatUser {
  user_address: string;
  user_name: string | null;
  user_phone: string | null;
  unread_from_user: number;
  last_message_at: string | null;
  last_message: string | null;
}

const AdminChat: React.FC = () => {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const adminIdRef = useRef<number | null>(null); // Will be set from token

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch chat users
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('adminToken') || '';
      const response = await fetch('/api/admin/chat/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const usersList = data.data || [];
        setUsers(usersList);
        // Calculate total unread count
        const totalUnread = usersList.reduce((sum: number, user: ChatUser) => sum + (user.unread_from_user || 0), 0);
        setTotalUnreadCount(totalUnread);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch messages for selected user
  const fetchMessages = async (userAddress: string) => {
    try {
      const token = localStorage.getItem('adminToken') || '';
      const response = await fetch(`/api/admin/chat/messages/${userAddress}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.data || []);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // Get admin ID from token
  useEffect(() => {
    try {
      const token = localStorage.getItem('adminToken') || '';
      if (token) {
        // Decode JWT token to get adminId
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const decoded = JSON.parse(jsonPayload);
        adminIdRef.current = decoded.adminId || decoded.id || 1;
        console.log('💬 AdminChat: Admin ID from token:', adminIdRef.current);
      }
    } catch (error) {
      console.error('Error decoding admin token:', error);
      adminIdRef.current = 1; // Fallback
    }
  }, []);

  // Setup Socket.IO connection
  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    socket.on('connect', () => {
      console.log('💬 AdminChat: Connected to socket');
    });

    // Listen for new messages from users
    socket.on('new-chat-message', (data: { message: ChatMessage; userAddress: string }) => {
      console.log('💬 AdminChat: New message from user:', data);
      
      // If this user is currently selected, add message to view
      if (selectedUser === data.userAddress) {
        setMessages(prev => {
          // Check if message already exists to prevent duplicates
          const exists = prev.some(msg => msg.id === data.message.id);
          if (exists) {
            console.log('💬 AdminChat: Message already exists, skipping duplicate');
            return prev;
          }
          return [...prev, data.message];
        });
        scrollToBottom();
      }
      
      // Update users list to show unread count
      setUsers(prev => {
        const updated = prev.map(user => 
          user.user_address === data.userAddress
            ? { ...user, unread_from_user: (user.unread_from_user || 0) + 1, last_message: data.message.message, last_message_at: data.message.created_at }
            : user
        );
        // Calculate total unread count
        const totalUnread = updated.reduce((sum, user) => sum + (user.unread_from_user || 0), 0);
        setTotalUnreadCount(totalUnread);
        return updated;
      });
      
      // Show notification with user name
      const userData = users.find(u => u.user_address === data.userAddress);
      const userName = userData?.user_name || data.userAddress.slice(0, 6) + '...' + data.userAddress.slice(-4);
      
      // Only show notification if this user is not currently selected
      if (selectedUser !== data.userAddress) {
        toast(
          (t) => (
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <p className="font-semibold text-white">💬 New Message</p>
                <p className="text-sm text-gray-200">
                  From: <span className="font-medium">{userName}</span>
                </p>
                <p className="text-xs text-gray-300 mt-1 truncate max-w-xs">
                  {data.message.message.length > 50 
                    ? data.message.message.substring(0, 50) + '...' 
                    : data.message.message}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedUser(data.userAddress);
                  toast.dismiss(t.id);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
              >
                View
              </button>
            </div>
          ),
          {
            duration: 5000,
            icon: '💬',
            position: 'top-right',
            style: {
              background: '#1e293b',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              minWidth: '300px',
            },
          }
        );
        
        // Play notification sound if browser supports it
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2LwUZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2LwUZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2LwU=');
          audio.volume = 0.3;
          audio.play().catch(() => {}); // Ignore errors if autoplay is blocked
        } catch (e) {
          // Ignore audio errors
        }
      }
    });

    // Listen for admin message sent confirmation
    socket.on('admin-chat-message-sent', (data: { message: ChatMessage }) => {
      console.log('💬 AdminChat: Admin message sent confirmation:', data);
      if (selectedUser === data.message.user_address.toLowerCase()) {
        setMessages(prev => {
          // Check if message already exists to prevent duplicates
          const exists = prev.some(msg => msg.id === data.message.id);
          if (exists) {
            console.log('💬 AdminChat: Message already exists, skipping duplicate');
            return prev;
          }
          return [...prev, data.message];
        });
        scrollToBottom();
        
        // Update users list
        setUsers(prev => {
          const updated = prev.map(user => 
            user.user_address === selectedUser
              ? { ...user, last_message: data.message.message, last_message_at: data.message.created_at }
              : user
          );
          // Recalculate total unread count
          const totalUnread = updated.reduce((sum, user) => sum + (user.unread_from_user || 0), 0);
          setTotalUnreadCount(totalUnread);
          return updated;
        });
      }
    });

    socket.on('chat-error', (error: { error: string }) => {
      console.error('💬 AdminChat error:', error);
      toast.error(error.error || 'Chat error occurred');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [selectedUser]);

  // Load users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Load messages when user is selected and join chat room
  useEffect(() => {
    if (selectedUser && socketRef.current) {
      fetchMessages(selectedUser);
      // Join the user's chat room for real-time updates
      socketRef.current.emit('admin-join-chat', selectedUser);
      console.log('💬 AdminChat: Joined chat room for user:', selectedUser);
    }
  }, [selectedUser]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || isSending) return;
    
    // Ensure adminId is available
    if (!adminIdRef.current) {
      toast.error('Admin ID not found. Please refresh the page.');
      return;
    }

    setIsSending(true);
    const messageText = newMessage.trim();
    setNewMessage(''); // Clear input immediately

    try {
      // Send via socket for real-time (socket will save to DB)
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('admin-chat-message', {
          message: messageText,
          userAddress: selectedUser,
          adminId: adminIdRef.current
        });
        // Don't add message here - wait for socket confirmation to avoid duplicates
      } else {
        // Fallback to API if socket not connected
        const token = localStorage.getItem('adminToken') || '';
        const response = await fetch('/api/admin/chat/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_address: selectedUser,
            message: messageText
          })
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

  // Mark messages as read
  useEffect(() => {
    if (selectedUser) {
      const token = localStorage.getItem('adminToken') || '';
      fetch(`/api/admin/chat/mark-read/${selectedUser}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).catch(err => console.error('Error marking as read:', err));
      
      // Update users list to clear unread count
      setUsers(prev => prev.map(user => 
        user.user_address === selectedUser
          ? { ...user, unread_from_user: 0 }
          : user
      ));
    }
  }, [selectedUser, messages]);

  // Filter users by search
  const filteredUsers = users.filter(user =>
    user.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.user_address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedUserData = users.find(u => u.user_address === selectedUser);

  return (
      <div className="space-y-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2 flex items-center space-x-2">
                <MessageSquare className="w-6 h-6" />
                <span>Chat Support</span>
                {totalUnreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
                    {totalUnreadCount} new
                  </span>
                )}
              </h1>
              <p className="text-gray-300 text-sm">Manage user support chats in real-time</p>
            </div>
            {totalUnreadCount > 0 && (
              <div className="text-right">
                <p className="text-3xl font-bold text-red-400">{totalUnreadCount}</p>
                <p className="text-xs text-gray-400">Unread Messages</p>
              </div>
            )}
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-250px)]">
        {/* Users List */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 flex flex-col">
          <div className="p-4 border-b border-white/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MessageSquare size={32} className="mx-auto mb-2" />
                <p>No users found</p>
              </div>
            ) : (
              filteredUsers.map((user) => (
                <motion.button
                  key={user.user_address}
                  onClick={() => setSelectedUser(user.user_address)}
                  className={`w-full p-4 text-left border-b border-white/10 hover:bg-white/10 transition-colors ${
                    selectedUser === user.user_address ? 'bg-white/20' : ''
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <User size={18} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-white font-medium text-sm truncate">
                            {user.user_name || 'Anonymous User'}
                          </p>
                          {user.unread_from_user > 0 && (
                            <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                              {user.unread_from_user} {user.unread_from_user === 1 ? 'new message' : 'new messages'}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs font-mono truncate">
                          {user.user_address.slice(0, 6)}...{user.user_address.slice(-4)}
                        </p>
                      </div>
                    </div>
                  </div>
                  {user.last_message && (
                    <p className="text-gray-400 text-xs truncate mt-1">
                      {user.last_message}
                    </p>
                  )}
                </motion.button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-2 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 flex flex-col">
          {selectedUser ? (
            <>
              {/* Chat Header */}
              <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4 rounded-t-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="font-semibold">
                      {selectedUserData?.user_name || 'Anonymous User'}
                    </p>
                    <p className="text-xs text-blue-100 font-mono">
                      {selectedUser.slice(0, 6)}...{selectedUser.slice(-4)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 max-h-[300px]">
                {messages.map((message) => {
                  const isAdmin = message.sender_type === 'admin';
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg p-3 ${
                          isAdmin
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {!isAdmin && (
                          <p className="text-xs font-semibold mb-1 text-gray-600">
                            {message.user_name || 'User'}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
                        <p className={`text-xs mt-1 ${isAdmin ? 'text-blue-100' : 'text-gray-500'}`}>
                          {new Date(message.created_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-white/20 bg-white/5">
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
                    className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <MessageSquare size={48} className="mx-auto mb-4" />
                <p>Select a user to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminChat;

