const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Store active rooms and users
const rooms = new Map();
const users = new Map();

// ICE Server Configuration
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Free TURN servers (Metered.ca OpenRelay)
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

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room
  socket.on('join-room', (data) => {
    const { roomId, userId } = data;
    
    // Store user info
    users.set(socket.id, { userId, roomId });
    
    // Join socket room
    socket.join(roomId);
    
    // Store room info
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);
    
    console.log(`User ${userId} joined room ${roomId}`);
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', { userId, socketId: socket.id });
    
    // Also send back the socket ID to the connecting user
    socket.emit('user-joined', { userId, socketId: socket.id });
    
    // Send ICE servers to the client
    socket.emit('ice-servers', ICE_SERVERS);
  });

  // Handle WebRTC offer
  socket.on('offer', (data) => {
    const { offer, targetSocketId, roomId } = data;
    console.log('Offer received from', socket.id, 'to', targetSocketId);
    
    // Forward offer to target user
    socket.to(targetSocketId).emit('offer', {
      offer,
      fromSocketId: socket.id,
      roomId
    });
  });

  // Handle WebRTC answer
  socket.on('answer', (data) => {
    const { answer, targetSocketId, roomId } = data;
    console.log('Answer received from', socket.id, 'to', targetSocketId);
    
    // Forward answer to target user
    socket.to(targetSocketId).emit('answer', {
      answer,
      fromSocketId: socket.id,
      roomId
    });
  });

  // Handle ICE candidates
  socket.on('ice-candidate', (data) => {
    const { candidate, targetSocketId, roomId } = data;
    console.log('ICE candidate received from', socket.id, 'to', targetSocketId);
    
    // Forward ICE candidate to target user
    socket.to(targetSocketId).emit('ice-candidate', {
      candidate,
      fromSocketId: socket.id,
      roomId
    });
  });

  // Handle call initiation
  socket.on('initiate-call', (data) => {
    const { targetUserId, roomId, callerInfo } = data;
    console.log('Call initiated by', socket.id, 'to', targetUserId);
    
    // Find target user's socket
    const targetSocket = Array.from(users.entries())
      .find(([_, user]) => user.userId === targetUserId);
    
    if (targetSocket) {
      const [targetSocketId] = targetSocket;
      socket.to(targetSocketId).emit('incoming-call', {
        callerSocketId: socket.id,
        callerInfo,
        roomId
      });
    }
  });

  // Handle call answer
  socket.on('answer-call', (data) => {
    const { callerSocketId, roomId } = data;
    console.log('Call answered by', socket.id, 'to', callerSocketId);
    
    socket.to(callerSocketId).emit('call-answered', {
      answererSocketId: socket.id,
      roomId
    });
  });

  // Handle call rejection
  socket.on('reject-call', (data) => {
    const { callerSocketId, roomId } = data;
    console.log('Call rejected by', socket.id, 'to', callerSocketId);
    
    socket.to(callerSocketId).emit('call-rejected', {
      rejecterSocketId: socket.id,
      roomId
    });
  });

  // Handle call end
  socket.on('end-call', (data) => {
    const { targetSocketId, roomId } = data;
    console.log('Call ended by', socket.id, 'to', targetSocketId);
    
    socket.to(targetSocketId).emit('call-ended', {
      enderSocketId: socket.id,
      roomId
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const user = users.get(socket.id);
    if (user) {
      const { roomId } = user;
      
      // Remove from room
      if (rooms.has(roomId)) {
        rooms.get(roomId).delete(socket.id);
        if (rooms.get(roomId).size === 0) {
          rooms.delete(roomId);
        }
      }
      
      // Notify others in the room
      socket.to(roomId).emit('user-left', { socketId: socket.id });
      
      // Clean up
      users.delete(socket.id);
    }
  });
});

// API endpoints
app.get('/api/ice-servers', (req, res) => {
  res.json(ICE_SERVERS);
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.entries()).map(([roomId, sockets]) => ({
    roomId,
    userCount: sockets.size
  }));
  res.json(roomList);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`ICE Servers configured:`, ICE_SERVERS);
});
