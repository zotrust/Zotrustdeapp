class WebRTCCall {
    constructor() {
        this.socket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.iceServers = [];
        this.isConnected = false;
        this.isInCall = false;
        this.currentRoom = null;
        this.currentUserId = null;
        this.targetUserId = null;
        
        this.initializeElements();
        this.setupEventListeners();
    }
    
    initializeElements() {
        this.userIdInput = document.getElementById('userId');
        this.roomIdInput = document.getElementById('roomId');
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.startCallBtn = document.getElementById('startCallBtn');
        this.answerCallBtn = document.getElementById('answerCallBtn');
        this.rejectCallBtn = document.getElementById('rejectCallBtn');
        this.endCallBtn = document.getElementById('endCallBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.unmuteBtn = document.getElementById('unmuteBtn');
        this.toggleVideoBtn = document.getElementById('toggleVideoBtn');
        this.statusDiv = document.getElementById('status');
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
        this.logDiv = document.getElementById('log');
    }
    
    setupEventListeners() {
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.startCallBtn.addEventListener('click', () => this.startCall());
        this.answerCallBtn.addEventListener('click', () => this.answerCall());
        this.rejectCallBtn.addEventListener('click', () => this.rejectCall());
        this.endCallBtn.addEventListener('click', () => this.endCall());
        this.muteBtn.addEventListener('click', () => this.mute());
        this.unmuteBtn.addEventListener('click', () => this.unmute());
        this.toggleVideoBtn.addEventListener('click', () => this.toggleVideo());
    }
    
    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.logDiv.innerHTML += `[${timestamp}] ${message}\n`;
        this.logDiv.scrollTop = this.logDiv.scrollHeight;
        console.log(message);
    }
    
    updateStatus(status, className) {
        this.statusDiv.textContent = status;
        this.statusDiv.className = `status ${className}`;
    }
    
    async connect() {
        try {
            this.currentUserId = this.userIdInput.value;
            this.currentRoom = this.roomIdInput.value;
            
            if (!this.currentUserId || !this.currentRoom) {
                alert('Please enter User ID and Room ID');
                return;
            }
            
            this.log('Connecting to signaling server...');
            this.updateStatus('Connecting...', 'connecting');
            
            // Connect to socket.io server
            this.socket = io();
            
            this.socket.on('connect', () => {
                this.log('Connected to signaling server');
                this.log('My Socket ID: ' + this.socket.id);
                this.socket.emit('join-room', {
                    roomId: this.currentRoom,
                    userId: this.currentUserId
                });
            });
            
            this.socket.on('ice-servers', (servers) => {
                this.iceServers = servers;
                this.log('ICE servers received: ' + JSON.stringify(servers));
            });
            
            this.socket.on('user-joined', (data) => {
                this.log(`User joined: ${data.userId} (Socket ID: ${data.socketId})`);
            });
            
            this.socket.on('user-left', (data) => {
                this.log(`User left: ${data.socketId}`);
            });
            
            this.socket.on('incoming-call', (data) => {
                this.log('Incoming call from: ' + data.callerSocketId);
                this.answerCallBtn.disabled = false;
                this.rejectCallBtn.disabled = false;
                this.updateStatus('Incoming call...', 'connecting');
            });
            
            this.socket.on('call-answered', (data) => {
                this.log('Call answered by: ' + data.answererSocketId);
                this.startCallBtn.disabled = true;
                this.answerCallBtn.disabled = true;
                this.rejectCallBtn.disabled = true;
                this.endCallBtn.disabled = false;
                this.updateStatus('Call connected', 'connected');
            });
            
            this.socket.on('call-rejected', (data) => {
                this.log('Call rejected by: ' + data.rejecterSocketId);
                this.startCallBtn.disabled = false;
                this.answerCallBtn.disabled = true;
                this.rejectCallBtn.disabled = true;
                this.updateStatus('Call rejected', 'disconnected');
            });
            
            this.socket.on('call-ended', (data) => {
                this.log('Call ended by: ' + data.enderSocketId);
                this.cleanup();
                this.updateStatus('Call ended', 'disconnected');
            });
            
            this.socket.on('offer', async (data) => {
                this.log('Received offer from: ' + data.fromSocketId);
                await this.handleOffer(data.offer, data.fromSocketId);
            });
            
            this.socket.on('answer', async (data) => {
                this.log('Received answer from: ' + data.fromSocketId);
                await this.handleAnswer(data.answer);
            });
            
            this.socket.on('ice-candidate', async (data) => {
                this.log('Received ICE candidate from: ' + data.fromSocketId);
                await this.handleIceCandidate(data.candidate);
            });
            
            this.socket.on('disconnect', () => {
                this.log('Disconnected from signaling server');
                this.updateStatus('Disconnected', 'disconnected');
                this.cleanup();
            });
            
            // Get user media (with fallback)
            try {
                await this.getUserMedia();
            } catch (error) {
                this.log('Media access failed, continuing in audio-only mode...');
                // Continue without media for testing purposes
            }
            
            this.isConnected = true;
            this.connectBtn.disabled = true;
            this.disconnectBtn.disabled = false;
            this.startCallBtn.disabled = false;
            this.muteBtn.disabled = false;
            this.unmuteBtn.disabled = false;
            this.toggleVideoBtn.disabled = false;
            
            this.updateStatus('Connected', 'connected');
            this.log('Ready to make calls!');
            
        } catch (error) {
            this.log('Connection error: ' + error.message);
            this.updateStatus('Connection failed', 'disconnected');
        }
    }
    
    async getUserMedia() {
        try {
            // First, check if media devices are available
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasVideo = devices.some(device => device.kind === 'videoinput');
            const hasAudio = devices.some(device => device.kind === 'audioinput');
            
            this.log(`Available devices - Video: ${hasVideo}, Audio: ${hasAudio}`);
            
            if (!hasVideo && !hasAudio) {
                throw new Error('No camera or microphone found. Please connect media devices.');
            }
            
            // Try to get media with available devices
            const constraints = {
                video: hasVideo,
                audio: hasAudio
            };
            
            this.log('Requesting media with constraints:', constraints);
            
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            this.localVideo.srcObject = this.localStream;
            this.log('Local media stream obtained successfully');
            
            // Log stream info
            const tracks = this.localStream.getTracks();
            this.log(`Stream has ${tracks.length} tracks:`, tracks.map(t => t.kind));
            
        } catch (error) {
            this.log('Error getting user media: ' + error.message);
            
            // Provide helpful error messages
            if (error.name === 'NotFoundError') {
                this.log('No camera or microphone found. Please connect media devices and refresh the page.');
            } else if (error.name === 'NotAllowedError') {
                this.log('Camera/microphone access denied. Please allow access and refresh the page.');
            } else if (error.name === 'NotReadableError') {
                this.log('Camera/microphone is being used by another application.');
            } else if (error.name === 'OverconstrainedError') {
                this.log('Camera/microphone constraints cannot be satisfied.');
            }
            
            throw error;
        }
    }
    
    async createPeerConnection() {
        const config = {
            iceServers: this.iceServers,
            iceCandidatePoolSize: 10
        };
        
        this.peerConnection = new RTCPeerConnection(config);
        
        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }
        
        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            this.log('Received remote stream');
            this.remoteStream = event.streams[0];
            this.remoteVideo.srcObject = this.remoteStream;
        };
        
        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.log('Sending ICE candidate');
                this.socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    targetSocketId: this.targetSocketId,
                    roomId: this.currentRoom
                });
            }
        };
        
        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            this.log('Connection state: ' + this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                this.log('WebRTC connection established!');
            }
        };
        
        this.log('Peer connection created');
    }
    
    async startCall() {
        try {
            this.log('Starting call...');
            this.targetSocketId = prompt('Enter target socket ID:');
            if (!this.targetSocketId) return;
            
            await this.createPeerConnection();
            
            // Create offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            // Send offer
            this.socket.emit('offer', {
                offer: offer,
                targetSocketId: this.targetSocketId,
                roomId: this.currentRoom
            });
            
            this.socket.emit('initiate-call', {
                targetUserId: this.targetSocketId,
                roomId: this.currentRoom,
                callerInfo: { userId: this.currentUserId }
            });
            
            this.startCallBtn.disabled = true;
            this.endCallBtn.disabled = false;
            this.isInCall = true;
            this.updateStatus('Calling...', 'connecting');
            
        } catch (error) {
            this.log('Error starting call: ' + error.message);
        }
    }
    
    async answerCall() {
        try {
            this.log('Answering call...');
            await this.createPeerConnection();
            
            this.answerCallBtn.disabled = true;
            this.rejectCallBtn.disabled = true;
            this.endCallBtn.disabled = false;
            this.isInCall = true;
            this.updateStatus('Call connected', 'connected');
            
        } catch (error) {
            this.log('Error answering call: ' + error.message);
        }
    }
    
    async handleOffer(offer, fromSocketId) {
        try {
            this.log('Handling offer from: ' + fromSocketId);
            this.targetSocketId = fromSocketId;
            
            if (!this.peerConnection) {
                await this.createPeerConnection();
            }
            
            await this.peerConnection.setRemoteDescription(offer);
            
            // Create answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            // Send answer
            this.socket.emit('answer', {
                answer: answer,
                targetSocketId: fromSocketId,
                roomId: this.currentRoom
            });
            
        } catch (error) {
            this.log('Error handling offer: ' + error.message);
        }
    }
    
    async handleAnswer(answer) {
        try {
            this.log('Handling answer');
            await this.peerConnection.setRemoteDescription(answer);
            
        } catch (error) {
            this.log('Error handling answer: ' + error.message);
        }
    }
    
    async handleIceCandidate(candidate) {
        try {
            if (this.peerConnection) {
                await this.peerConnection.addIceCandidate(candidate);
                this.log('ICE candidate added');
            }
        } catch (error) {
            this.log('Error adding ICE candidate: ' + error.message);
        }
    }
    
    rejectCall() {
        this.log('Rejecting call');
        this.socket.emit('reject-call', {
            callerSocketId: this.targetSocketId,
            roomId: this.currentRoom
        });
        
        this.answerCallBtn.disabled = true;
        this.rejectCallBtn.disabled = true;
        this.startCallBtn.disabled = false;
        this.updateStatus('Call rejected', 'disconnected');
    }
    
    endCall() {
        this.log('Ending call');
        this.socket.emit('end-call', {
            targetSocketId: this.targetSocketId,
            roomId: this.currentRoom
        });
        
        this.cleanup();
        this.updateStatus('Call ended', 'disconnected');
    }
    
    cleanup() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }
        
        this.remoteVideo.srcObject = null;
        this.targetSocketId = null;
        this.isInCall = false;
        
        this.startCallBtn.disabled = false;
        this.answerCallBtn.disabled = true;
        this.rejectCallBtn.disabled = true;
        this.endCallBtn.disabled = true;
    }
    
    mute() {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = false;
            });
            this.log('Microphone muted');
        }
    }
    
    unmute() {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = true;
            });
            this.log('Microphone unmuted');
        }
    }
    
    toggleVideo() {
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            this.log('Video toggled');
        }
    }
    
    disconnect() {
        this.log('Disconnecting...');
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.cleanup();
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        this.localVideo.srcObject = null;
        this.isConnected = false;
        
        this.connectBtn.disabled = false;
        this.disconnectBtn.disabled = true;
        this.startCallBtn.disabled = true;
        this.answerCallBtn.disabled = true;
        this.rejectCallBtn.disabled = true;
        this.endCallBtn.disabled = true;
        this.muteBtn.disabled = true;
        this.unmuteBtn.disabled = true;
        this.toggleVideoBtn.disabled = true;
        
        this.updateStatus('Disconnected', 'disconnected');
    }
}

// Initialize the WebRTC call system
const webrtcCall = new WebRTCCall();
