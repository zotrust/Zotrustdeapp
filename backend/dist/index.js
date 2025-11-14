"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const winston_1 = __importDefault(require("winston"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const ngrok_1 = require("@ngrok/ngrok");
// Import configurations
const database_1 = require("./config/database");
const database_2 = __importDefault(require("./config/database"));
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const ads_1 = __importDefault(require("./routes/ads"));
const orders_1 = __importDefault(require("./routes/orders"));
const agents_1 = __importDefault(require("./routes/agents"));
const profile_1 = __importDefault(require("./routes/profile"));
const calls_1 = __importDefault(require("./routes/calls"));
const public_locations_1 = __importDefault(require("./routes/public-locations"));
const admin_1 = __importDefault(require("./routes/admin"));
const support_1 = __importDefault(require("./routes/support"));
const transactions_1 = __importDefault(require("./routes/transactions"));
const disputes_1 = __importDefault(require("./routes/disputes"));
const admin_disputes_1 = __importDefault(require("./routes/admin-disputes"));
const reviews_1 = __importDefault(require("./routes/reviews"));
const admin_reviews_1 = __importDefault(require("./routes/admin-reviews"));
const videos_1 = __importDefault(require("./routes/videos"));
const chat_1 = __importDefault(require("./routes/chat"));
const admin_chat_1 = __importDefault(require("./routes/admin-chat"));
// Import workers
const orderWorker_1 = require("./workers/orderWorker");
const disputeWorker_1 = require("./workers/disputeWorker");
dotenv_1.default.config();
// Configure Winston logger
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: { service: 'zotrust-backend' },
    transports: [
        new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'logs/combined.log' }),
    ],
});
if (process.env.LOG_CONSOLE === 'true' && process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.simple()
    }));
}
const app = (0, express_1.default)();
// Create HTTP server
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? process.env.FRONTEND_URL
            : true,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 20000,
    pingInterval: 10000,
    connectTimeout: 30000,
    allowEIO3: true
});
exports.io = io;
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Request logging with better debugging
app.use((req, res, next) => {
    const logData = {
        method: req.method,
        path: req.path,
        ip: req.ip,
        host: req.get('host'),
        origin: req.get('origin'),
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    };
    logger.info(`${req.method} ${req.path}`, logData);
    // Log API routes for debugging
    if (req.path.startsWith('/api/')) {
        console.log(`📡 ${req.method} ${req.path} from ${req.ip} (host: ${req.get('host')})`);
    }
    next();
});
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});
// API routes
app.use('/api/auth', auth_1.default);
app.use('/api/ads', ads_1.default);
app.use('/api/orders', orders_1.default);
app.use('/api/agents', agents_1.default);
app.use('/api/profile', profile_1.default);
app.use('/api/calls', calls_1.default);
app.use('/api/locations', public_locations_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/support', support_1.default);
app.use('/api/transactions', transactions_1.default);
app.use('/api/disputes', disputes_1.default);
app.use('/api/admin', admin_disputes_1.default);
app.use('/api/reviews', reviews_1.default);
app.use('/api/admin/reviews', admin_reviews_1.default);
app.use('/api/videos', videos_1.default);
app.use('/api/chat', chat_1.default);
app.use('/api/admin/chat', admin_chat_1.default);
// WebRTC Signaling - Store active users 
const users = new Map();
const rooms = new Map();
const connectionStates = new Map(); // Track connection states
const iceCandidateRates = new Map(); // Track ICE candidate rates
const adminSocket = new Map(); // Map admin identifier to socket ID 
// ICE Server Configuration
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.voiparound.com' },
    { urls: 'stun:stun.voipbuster.com' },
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    }
];
// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    // Cast socket to ExtendedSocket for userId property
    const extendedSocket = socket;
    // Register user
    socket.on('register', (userId, isAdmin = false) => {
        // Remove old registration if user was already registered
        if (extendedSocket.userId) {
            users.delete(extendedSocket.userId);
            connectionStates.delete(extendedSocket.userId);
            adminSocket.delete(extendedSocket.userId);
            console.log(`📞 Backend: Removed old registration for ${extendedSocket.userId}`);
        }
        users.set(userId, socket.id);
        connectionStates.set(userId, {
            status: 'connected',
            lastSeen: Date.now(),
            socketId: socket.id
        });
        // Register admin for support calls
        if (isAdmin || userId === 'ADMIN_SUPPORT') {
            adminSocket.set('ADMIN_SUPPORT', socket.id);
            console.log(`📞 Backend: Admin registered for support calls with socket ${socket.id}`);
        }
        extendedSocket.userId = userId;
        console.log(`📞 Backend: User ${userId} registered with socket ${socket.id}`);
        console.log(`📞 Backend: Total registered users: ${users.size}`);
        // Send registration confirmation
        socket.emit('registration-confirmed', { userId, socketId: socket.id });
    });
    // Join room for 1-on-1 call
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        if (!rooms.has(roomId)) {
            rooms.set(roomId, []);
        }
        const room = rooms.get(roomId);
        room.push(extendedSocket.userId);
        console.log(`User ${extendedSocket.userId} joined room ${roomId}`);
        // Notify other users in room
        socket.to(roomId).emit('user-joined', {
            userId: extendedSocket.userId,
            socketId: socket.id
        });
        // Send existing users to the new joiner
        const otherUsers = room.filter(id => id !== extendedSocket.userId);
        socket.emit('existing-users', otherUsers);
    });
    // WebRTC Signaling
    socket.on('offer', (data) => {
        const { offer, to } = data;
        if (!to) {
            console.log(`📞 Backend: Offer missing 'to' field`);
            return;
        }
        let targetSocket = users.get(to);
        const isAdminSupportCall = to === 'ADMIN_SUPPORT' || (typeof to === 'string' && to.toLowerCase() === 'admin_support');
        // Handle admin support calls
        if (isAdminSupportCall) {
            targetSocket = adminSocket.get('ADMIN_SUPPORT');
            console.log(`📞 Backend: Support call offer to admin, socket: ${targetSocket}`);
        }
        console.log(`📞 Backend: Offer from ${extendedSocket.userId} to ${to}`);
        if (targetSocket) {
            io.to(targetSocket).emit('offer', {
                offer,
                from: extendedSocket.userId,
                callerAddress: extendedSocket.userId, // Include caller address for admin calls
                isAdminSupportCall: isAdminSupportCall
            });
            console.log(`✅ Backend: Offer forwarded to ${to} with callerAddress: ${extendedSocket.userId}`);
        }
        else {
            console.log(`❌ Backend: Target user ${to} not found`);
            if (isAdminSupportCall) {
                console.log(`📞 Backend: Admin socket map:`, Array.from(adminSocket.entries()));
            }
            else {
                console.log(`📞 Backend: Available users:`, Array.from(users.keys()));
            }
            socket.emit('user-not-found', { target: to });
        }
    });
    socket.on('answer', (data) => {
        console.log('📞 Backend: Received answer event:', {
            from: extendedSocket.userId,
            hasAnswer: !!data.answer,
            to: data.to,
            answerType: data.answer?.type
        });
        const { answer, to } = data;
        if (!to) {
            console.log(`❌ Backend: Answer missing 'to' field`);
            return;
        }
        if (!answer) {
            console.log(`❌ Backend: Answer missing 'answer' field`);
            return;
        }
        let targetSocket = users.get(to);
        // Handle admin support calls
        if (to === 'ADMIN_SUPPORT' || (typeof to === 'string' && to.toLowerCase() === 'admin_support')) {
            targetSocket = adminSocket.get('ADMIN_SUPPORT');
            console.log(`📞 Backend: Answer is for admin support, socket: ${targetSocket}`);
        }
        console.log(`📞 Backend: Answer from ${extendedSocket.userId} to ${to} (target socket: ${targetSocket})`);
        if (targetSocket) {
            io.to(targetSocket).emit('answer', {
                answer,
                from: extendedSocket.userId
            });
            console.log(`✅ Backend: Answer forwarded to ${to} successfully`);
        }
        else {
            console.log(`❌ Backend: Target user ${to} not found for answer`);
            console.log(`📞 Backend: Available users:`, Array.from(users.keys()));
            console.log(`📞 Backend: Admin socket:`, adminSocket.get('ADMIN_SUPPORT'));
        }
    });
    socket.on('ice-candidate', (data) => {
        const { candidate, to } = data;
        if (!to) {
            console.log(`📞 Backend: ICE candidate missing 'to' field`);
            return;
        }
        let targetSocket = users.get(to);
        // Handle admin support calls
        if (to === 'ADMIN_SUPPORT' || (typeof to === 'string' && to.toLowerCase() === 'admin_support')) {
            targetSocket = adminSocket.get('ADMIN_SUPPORT');
        }
        // Rate limiting for ICE candidates (max 10 per second per user)
        if (extendedSocket.userId) {
            const now = Date.now();
            const userRate = iceCandidateRates.get(extendedSocket.userId) || { count: 0, resetTime: now + 1000 };
            if (now > userRate.resetTime) {
                userRate.count = 0;
                userRate.resetTime = now + 1000;
            }
            if (userRate.count >= 10) {
                console.log(`📞 Backend: Rate limit exceeded for ICE candidates from ${extendedSocket.userId}`);
                return;
            }
            userRate.count++;
            iceCandidateRates.set(extendedSocket.userId, userRate);
        }
        console.log(`📞 Backend: ICE candidate from ${extendedSocket.userId} to ${to}`);
        if (targetSocket) {
            io.to(targetSocket).emit('ice-candidate', {
                candidate,
                from: extendedSocket.userId
            });
            console.log(`📞 Backend: ICE candidate forwarded to ${to}`);
        }
        else {
            console.log(`📞 Backend: Target user ${to} not found for ICE candidate`);
            // Send error back to sender
            socket.emit('ice-candidate-error', {
                error: 'Target user not found',
                target: to
            });
        }
    });
    // End call
    socket.on('end-call', (data) => {
        const { to } = data;
        if (!to) {
            console.log(`📞 Backend: End call missing 'to' field`);
            return;
        }
        let targetSocket = users.get(to);
        // Handle admin support calls
        if (to === 'ADMIN_SUPPORT' || (typeof to === 'string' && to.toLowerCase() === 'admin_support')) {
            targetSocket = adminSocket.get('ADMIN_SUPPORT');
        }
        console.log(`📞 Backend: End call from ${extendedSocket.userId} to ${to}`);
        if (targetSocket) {
            io.to(targetSocket).emit('call-ended', {
                from: extendedSocket.userId
            });
            console.log(`📞 Backend: Call ended notification sent to ${to}`);
        }
        else {
            console.log(`📞 Backend: Target user ${to} not found for end call`);
        }
    });
    // Handle call state clear
    socket.on('clear-incoming-call', (data) => {
        if (data && data.callId) {
            socket.emit('incoming-call-cleared', {
                callId: data.callId,
                timestamp: Date.now()
            });
            console.log(`🧹 Incoming call cleared: ${data.callId}`);
        }
    });
    // Heartbeat to keep connection alive
    socket.on('ping', () => {
        if (extendedSocket.userId) {
            const connectionState = connectionStates.get(extendedSocket.userId);
            if (connectionState) {
                connectionState.lastSeen = Date.now();
                connectionStates.set(extendedSocket.userId, connectionState);
            }
        }
        socket.emit('pong');
    });
    // Handle initiate-call event (for support calls to admin)
    socket.on('initiate-call', (data) => {
        console.log('📞 Backend: Received initiate-call event:', data);
        const { callId, receiverAddress, callerAddress, adId, timestamp } = data;
        if (!receiverAddress) {
            console.log(`📞 Backend: Initiate call missing 'receiverAddress' field`);
            return;
        }
        // Check if this is a support call to admin
        if (receiverAddress === 'ADMIN_SUPPORT' || (typeof receiverAddress === 'string' && receiverAddress.toLowerCase() === 'admin_support')) {
            const adminSock = adminSocket.get('ADMIN_SUPPORT');
            console.log(`📞 Backend: Looking for admin socket. Registered admins:`, Array.from(adminSocket.keys()));
            console.log(`📞 Backend: Admin socket ID:`, adminSock);
            if (adminSock) {
                console.log(`📞 Backend: Support call from ${callerAddress} to admin (socket: ${adminSock})`);
                // Only send notification, NOT the offer yet - wait for admin to accept
                io.to(adminSock).emit('incoming-call', {
                    callId,
                    callerAddress,
                    adId: adId || 'admin-support',
                    timestamp: timestamp || Date.now(),
                    isAdminSupportCall: true
                });
                console.log(`📞 Backend: Support call notification sent to admin (waiting for acceptance)`);
                // Notify caller that admin was notified
                socket.emit('call-waiting-for-acceptance', {
                    callId,
                    adminNotified: true
                });
            }
            else {
                console.log(`📞 Backend: Admin not available for support call - no admin socket found`);
                console.log(`📞 Backend: Current admin sockets:`, Array.from(adminSocket.entries()));
                socket.emit('user-not-found', { target: 'ADMIN_SUPPORT' });
            }
        }
        else {
            // Regular call handling
            const targetSocket = users.get(receiverAddress);
            if (targetSocket) {
                io.to(targetSocket).emit('incoming-call', {
                    callId,
                    callerAddress,
                    adId,
                    timestamp: timestamp || Date.now()
                });
            }
        }
    });
    // Handle call-accepted event (admin accepts the call)
    socket.on('call-accepted', (data) => {
        console.log('📞 Backend: Received call-accepted event:', data);
        const { callId, callerAddress } = data;
        if (!callerAddress) {
            console.log(`❌ Backend: Call-accepted missing 'callerAddress' field`);
            return;
        }
        // Find caller's socket
        const callerSocket = users.get(callerAddress);
        if (callerSocket) {
            console.log(`📞 Backend: Admin accepted call from ${callerAddress}`);
            // Notify caller that admin has accepted - now they can send WebRTC offer
            io.to(callerSocket).emit('call-accepted-by-admin', {
                callId,
                accepted: true
            });
            console.log(`✅ Backend: Call acceptance notification sent to caller`);
        }
        else {
            console.log(`❌ Backend: Caller ${callerAddress} not found for call-accepted`);
            // Notify admin that caller is not available
            socket.emit('caller-not-found', { callerAddress });
        }
    });
    // Handle user status check
    socket.on('check-user-status', (targetUserId) => {
        if (!targetUserId) {
            console.log(`📞 Backend: Check user status missing 'targetUserId' field`);
            return;
        }
        // Check if checking admin support status
        if (targetUserId === 'ADMIN_SUPPORT' || (typeof targetUserId === 'string' && targetUserId.toLowerCase() === 'admin_support')) {
            const adminSock = adminSocket.get('ADMIN_SUPPORT');
            socket.emit('user-status', {
                userId: targetUserId,
                isOnline: !!adminSock,
                socketId: adminSock
            });
        }
        else {
            const targetSocket = users.get(targetUserId);
            console.log(`📞 Backend: Checking status for user ${targetUserId}: ${!!targetSocket ? 'online' : 'offline'}`);
            socket.emit('user-status', {
                userId: targetUserId,
                isOnline: !!targetSocket,
                socketId: targetSocket
            });
        }
    });
    // Handle user list request
    socket.on('get-online-users', () => {
        const onlineUsers = Array.from(users.keys());
        console.log(`📞 Backend: Sending online users list: ${onlineUsers.length} users`);
        socket.emit('online-users', onlineUsers);
    });
    // ============================================
    // CHAT HANDLERS
    // ============================================
    // User sends chat message
    socket.on('chat-message', async (data) => {
        try {
            const { message, userAddress } = data;
            console.log(`💬 Backend: Chat message from ${userAddress}`);
            if (!message || !userAddress) {
                socket.emit('chat-error', { error: 'Missing message or user address' });
                return;
            }
            // Save to database
            const result = await database_2.default.query(`INSERT INTO chat_messages (user_address, message, sender_type, is_read)
         VALUES ($1, $2, 'user', false)
         RETURNING *`, [userAddress.toLowerCase(), message]);
            const savedMessage = result.rows[0];
            // Notify all admins (broadcast to admin sockets)
            const adminSock = adminSocket.get('ADMIN_SUPPORT');
            if (adminSock) {
                io.to(adminSock).emit('new-chat-message', {
                    message: savedMessage,
                    userAddress: userAddress.toLowerCase()
                });
            }
            // Also broadcast to user's own chat room (for consistency)
            io.to(`chat:${userAddress.toLowerCase()}`).emit('new-chat-message', {
                message: savedMessage,
                userAddress: userAddress.toLowerCase()
            });
            // Confirm to sender (only once)
            socket.emit('chat-message-sent', { message: savedMessage });
        }
        catch (error) {
            console.error('Chat message error:', error);
            socket.emit('chat-error', { error: 'Failed to send message' });
        }
    });
    // Admin sends chat message
    socket.on('admin-chat-message', async (data) => {
        try {
            const { message, userAddress, adminId } = data;
            console.log(`💬 Backend: Admin chat message to ${userAddress}`);
            if (!message || !userAddress || !adminId) {
                socket.emit('chat-error', { error: 'Missing required fields' });
                return;
            }
            // Save to database
            const result = await database_2.default.query(`INSERT INTO chat_messages (user_address, admin_id, message, sender_type, is_read)
         VALUES ($1, $2, $3, 'admin', false)
         RETURNING *`, [userAddress.toLowerCase(), adminId, message]);
            const savedMessage = result.rows[0];
            // Send to user via socket (if connected)
            const userSock = users.get(userAddress.toLowerCase());
            if (userSock) {
                io.to(userSock).emit('new-chat-message', {
                    message: savedMessage,
                    fromAdmin: true
                });
            }
            // Also broadcast to user's chat room (for users who might be in the room)
            io.to(`chat:${userAddress.toLowerCase()}`).emit('new-chat-message', {
                message: savedMessage,
                fromAdmin: true
            });
            // Confirm to admin (only once)
            socket.emit('admin-chat-message-sent', { message: savedMessage });
        }
        catch (error) {
            console.error('Admin chat message error:', error);
            socket.emit('chat-error', { error: 'Failed to send message' });
        }
    });
    // User joins chat room
    socket.on('join-chat', (userAddress) => {
        if (userAddress) {
            const normalizedAddress = userAddress.toLowerCase();
            socket.join(`chat:${normalizedAddress}`);
            // Also register user in users map for direct messaging
            if (extendedSocket.userId !== normalizedAddress) {
                users.set(normalizedAddress, socket.id);
                extendedSocket.userId = normalizedAddress;
            }
            console.log(`💬 Backend: User ${normalizedAddress} joined chat room`);
        }
    });
    // Admin joins chat room for a user
    socket.on('admin-join-chat', (userAddress) => {
        if (userAddress) {
            socket.join(`chat:${userAddress.toLowerCase()}`);
            console.log(`💬 Backend: Admin joined chat for user ${userAddress}`);
        }
    });
    // Handle order updates
    socket.on('subscribe-order-updates', (orderId) => {
        socket.join(`order:${orderId}`);
        console.log(`📦 Socket ${socket.id} subscribed to order: ${orderId}`);
    });
    socket.on('unsubscribe-order-updates', (orderId) => {
        socket.leave(`order:${orderId}`);
        console.log(`📦 Socket ${socket.id} unsubscribed from order: ${orderId}`);
    });
    // Disconnect
    socket.on('disconnect', () => {
        console.log(`📞 Backend: User disconnected: ${socket.id}`);
        if (extendedSocket.userId) {
            console.log(`📞 Backend: Cleaning up user ${extendedSocket.userId}`);
            users.delete(extendedSocket.userId);
            connectionStates.delete(extendedSocket.userId);
            iceCandidateRates.delete(extendedSocket.userId);
            adminSocket.delete(extendedSocket.userId);
            // Remove from rooms and notify others
            rooms.forEach((userList, roomId) => {
                const index = userList.indexOf(extendedSocket.userId);
                if (index > -1) {
                    userList.splice(index, 1);
                    socket.to(roomId).emit('user-left', extendedSocket.userId);
                    console.log(`📞 Backend: User ${extendedSocket.userId} removed from room ${roomId}`);
                }
            });
            console.log(`📞 Backend: Total registered users after cleanup: ${users.size}`);
        }
    });
});
// Periodic cleanup of stale connections
setInterval(() => {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    // Clean up stale connections
    const staleUsers = [];
    connectionStates.forEach((state, userId) => {
        if (now - state.lastSeen > staleThreshold) {
            staleUsers.push(userId);
        }
    });
    staleUsers.forEach(userId => {
        console.log(`📞 Backend: Cleaning up stale connection for user ${userId}`);
        users.delete(userId);
        connectionStates.delete(userId);
        iceCandidateRates.delete(userId);
    });
    console.log(`📞 Backend: Active users: ${users.size}, Active rooms: ${rooms.size}, Cleaned up: ${staleUsers.length} stale connections`);
}, 30000); // Run every 30 seconds
// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
});
// Serve static files from the frontend build directory (only for non-API routes)
// Video streaming endpoint for appeals
app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../uploads', filename);
    // Security: Only allow files in uploads directory
    if (!filePath.startsWith(path.join(__dirname, '../uploads'))) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Video not found' });
    }
    // Detect content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'video/webm';
    if (ext === '.mp4') {
        contentType = 'video/mp4';
    }
    else if (ext === '.webm') {
        contentType = 'video/webm';
    }
    else if (ext === '.mov') {
        contentType = 'video/quicktime';
    }
    else if (ext === '.avi') {
        contentType = 'video/x-msvideo';
    }
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    if (range) {
        // Parse range header for video seeking (206 Partial Content)
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
        };
        res.writeHead(206, head);
        file.pipe(res);
    }
    else {
        // Full video stream (200 OK)
        const head = {
            'Content-Length': fileSize,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000',
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});
app.use((req, res, next) => {
    // Skip static file serving for API routes
    if (req.path.startsWith('/api/')) {
        return next();
    }
    express_1.default.static(path.join(__dirname, '../../dist'))(req, res, next);
});
// Catch-all handler: send back React's index.html file for client-side routing
// This should be LAST to avoid interfering with API routes
app.get('*', (req, res) => {
    // Skip catch-all for API routes - these should have been handled above
    if (req.path.startsWith('/api/')) {
        console.log(`❌ API endpoint not found: ${req.method} ${req.path}`);
        return res.status(404).json({
            success: false,
            error: 'API endpoint not found',
            path: req.path,
            method: req.method,
            hint: 'Make sure the route is registered in index.ts'
        });
    }
    // For non-API routes, serve the React app
    const indexPath = path.join(__dirname, '../../dist/index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    }
    else {
        res.status(404).json({
            success: false,
            error: 'Frontend build not found. Please build the frontend first.'
        });
    }
});
// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});
// Start server
const startServer = async () => {
    try {
        // Connect to databases
        await (0, database_1.connectDB)();
        // Start scheduled jobs
        (0, orderWorker_1.scheduleOTPCleanup)();
        (0, orderWorker_1.scheduleExpiredOrdersCheck)();
        (0, disputeWorker_1.scheduleDisputeProcessing)();
        // Start HTTP server (bind to all interfaces for LAN access)
        server.listen(Number(PORT), '0.0.0.0', async () => {
            logger.info('Server started successfully', {
                port: PORT,
                protocol: 'HTTP',
                environment: process.env.NODE_ENV || 'development',
                host: '0.0.0.0'
            });
            // Log local network addresses for convenience
            const networkInterfaces = os.networkInterfaces();
            const addresses = [];
            Object.keys(networkInterfaces).forEach(interfaceName => {
                networkInterfaces[interfaceName]?.forEach((networkInterface) => {
                    if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
                        addresses.push(`http://${networkInterface.address}:${PORT}`);
                    }
                });
            });
            if (addresses.length > 0) {
                logger.info('Backend accessible on local network:', { addresses });
                console.log(`\n🌐 Backend Server Local Network Access (HTTP):`);
                addresses.forEach(addr => console.log(`   ${addr}`));
                console.log(`   Health check: ${addresses[0]}/health`);
                console.log(`   API base: ${addresses[0]}/api`);
                console.log(`   WebSocket: ws://${addresses[0].replace('http://', '')}\n`);
            }
            // Setup ngrok tunnel for public access
            try {
                const ngrokAuthtoken = process.env.NGROK_AUTHTOKEN || '34V5baVtGJwAdOk3TbeOSZ84LtQ_3EgdmJHHvWKo5XpJmfjgV';
                const ngrokSubdomain = `zotrust-${Date.now()}`;
                console.log('🚀 Setting up ngrok tunnel...');
                const listener = await (0, ngrok_1.connect)({
                    addr: Number(PORT),
                    authtoken: ngrokAuthtoken,
                    // Remove subdomain to get a random ngrok URL
                });
                const publicUrl = listener.url();
                console.log(`\n🌍 Public Access via ngrok:`);
                console.log(`   Main URL: ${publicUrl}`);
                console.log(`   Health check: ${publicUrl}/health`);
                console.log(`   API base: ${publicUrl}/api`);
                console.log(`   WebSocket: ${publicUrl.replace('https://', 'wss://').replace('http://', 'ws://')}\n`);
                logger.info('ngrok tunnel established', { publicUrl });
            }
            catch (error) {
                // Check if it's the "endpoint already online" error
                if (error.errorCode === 'ERR_NGROK_334' || error.message?.includes('already online')) {
                    console.log('⚠️  ngrok tunnel already active - using existing tunnel');
                    console.log('   (This is normal if ngrok is running in another process)');
                    logger.warn('ngrok tunnel already exists', { error: error.message });
                }
                else {
                    console.error('❌ Failed to setup ngrok tunnel:', error);
                    logger.error('ngrok tunnel failed', { error: error.message });
                    console.log('   Server will continue running with local network access only');
                }
            }
        });
    }
    catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
