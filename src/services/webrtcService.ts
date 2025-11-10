// WebRTC Service for Voice Calls
import { permissionService } from './permissionService';
import { getICEServers } from '../config/iceServers';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  audio: boolean;
  video: boolean;
}

export interface CallState {
  isConnected: boolean;
  isMuted: boolean;
  isSpeakerOn: boolean;
  callDuration: number;
  connectionState: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed';
  networkQuality?: 'good' | 'fair' | 'poor';
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private callState: CallState = {
    isConnected: false,
    isMuted: false,
    isSpeakerOn: true,
    callDuration: 0,
    connectionState: 'new'
  };
  
  private callStateCallbacks: ((state: CallState) => void)[] = [];
  private durationInterval: NodeJS.Timeout | null = null;
  private networkMonitorInterval: NodeJS.Timeout | null = null;
  private iceRestartAttempts: number = 0;
  private maxIceRestarts: number = 3; // Maximum ICE restart attempts
  private iceRestartTimeout: NodeJS.Timeout | null = null;
  private connectionRecoveryAttempts: number = 0;
  private maxConnectionRecoveryAttempts: number = 3;

  constructor() {
    this.setupPeerConnection();
  }

  private setupPeerConnection(): void {
    // Close existing connection if any
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    const config: RTCConfiguration = {
      iceServers: getICEServers(),
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    this.peerConnection = new RTCPeerConnection(config);

    // Handle incoming audio stream
    this.peerConnection.ontrack = (event) => {
      console.log('📞 Received remote track event:', {
        kind: event.track.kind,
        streamCount: event.streams.length,
        trackId: event.track.id,
        enabled: event.track.enabled,
        readyState: event.track.readyState
      });
      
      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        console.log('📞 Remote stream received:', {
          id: stream.id,
          active: stream.active,
          trackCount: stream.getTracks().length
        });
        
        // Log track details
        stream.getTracks().forEach((track, index) => {
          console.log(`📞 Remote track ${index}:`, {
            kind: track.kind,
            id: track.id,
            enabled: track.enabled,
            readyState: track.readyState,
            muted: track.muted
          });
        });
        
        this.remoteStream = stream;
      this.updateCallState({ isConnected: true, connectionState: 'connected' });
      this.startCallTimer();
        console.log('✅ Remote stream set successfully and call state updated');
        
        // Emit event for components to attach stream to audio elements
        if (this.onRemoteStream) {
          this.onRemoteStream(stream);
        }
      } else {
        console.warn('⚠️ Received track event without stream');
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('📞 WebRTC Connection state changed:', state);
      
      if (state === 'connected') {
        // Only update to connected if ICE connection is also ready
        const iceState = this.peerConnection?.iceConnectionState;
        if (iceState === 'connected' || iceState === 'completed') {
        console.log('📞 WebRTC Connection established successfully!');
          // Reset restart attempts on successful connection
          this.iceRestartAttempts = 0;
          this.connectionRecoveryAttempts = 0;
        this.updateCallState({ isConnected: true, connectionState: 'connected' });
        this.startCallTimer();
        this.monitorNetworkQuality();
        } else {
          console.log('📞 Connection state is connected, but ICE not ready yet:', iceState);
        }
      } else if (state === 'disconnected') {
        console.log('📞 WebRTC Connection disconnected (temporary - attempting recovery)');
        // Don't immediately mark as disconnected - try to recover first
        // Only update UI if recovery attempts are exhausted
        if (this.connectionRecoveryAttempts >= this.maxConnectionRecoveryAttempts) {
        this.updateCallState({ 
          isConnected: false, 
            connectionState: 'disconnected',
          callDuration: 0
        });
        this.stopCallTimer();
        this.stopNetworkMonitor();
        } else {
          // Attempt recovery
          this.attemptConnectionRecovery();
        }
      } else if (state === 'failed') {
        console.log('📞 WebRTC Connection failed - attempting ICE restart');
        // Attempt ICE restart with retry limit
        if (this.iceRestartAttempts < this.maxIceRestarts) {
          // Clear any existing restart timeout
          if (this.iceRestartTimeout) {
            clearTimeout(this.iceRestartTimeout);
          }
          
          // Wait before restarting to avoid rapid retries (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, this.iceRestartAttempts), 5000);
          console.log(`📞 Scheduling ICE restart attempt ${this.iceRestartAttempts + 1}/${this.maxIceRestarts} after ${delay}ms`);
          
          this.iceRestartAttempts++;
          this.iceRestartTimeout = setTimeout(() => {
            this.restartIce();
          }, delay);
        } else {
          // Max restart attempts reached - mark as failed
          console.error('❌ Max ICE restart attempts reached - connection failed');
          this.updateCallState({ 
            isConnected: false, 
            connectionState: 'failed',
            callDuration: 0
          });
          this.stopCallTimer();
          this.stopNetworkMonitor();
        }
      } else if (state === 'connecting') {
        console.log('📞 WebRTC Connection in progress...');
        this.updateCallState({ connectionState: 'connecting' });
        
        // Set a timeout to force connection if stuck
        setTimeout(() => {
          if (this.peerConnection?.connectionState === 'connecting') {
            console.log('⚠️ WebRTC connection stuck in connecting state, forcing connection check...');
            this.forceConnectionCheck();
          }
        }, 5000); // 5 seconds timeout
      } else if (state === 'new') {
        console.log('📞 WebRTC Connection in new state');
        this.updateCallState({ connectionState: 'new' });
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      console.log('📞 ICE Connection state changed:', iceState);
      
      if (iceState === 'connected' || iceState === 'completed') {
        console.log('📞 ICE Connection established!');
        // Also check connection state before updating
        const connState = this.peerConnection?.connectionState;
        if (connState === 'connected' || connState === 'connecting') {
        this.updateCallState({ 
          isConnected: true, 
          connectionState: 'connected' 
        });
        this.startCallTimer();
          console.log('✅ Call fully connected - both ICE and connection state ready');
        } else {
          console.log('📞 ICE ready but connection state not ready yet:', connState);
        }
      } else if (iceState === 'disconnected') {
        console.log('📞 ICE Connection disconnected (temporary - may recover)');
        // Don't immediately update state - wait for connection state change
        // ICE disconnected doesn't always mean call is over
      } else if (iceState === 'failed') {
        console.log('📞 ICE Connection failed - attempting ICE restart');
        // Attempt ICE restart with retry limit
        if (this.iceRestartAttempts < this.maxIceRestarts) {
          // Clear any existing restart timeout
          if (this.iceRestartTimeout) {
            clearTimeout(this.iceRestartTimeout);
          }
          
          // Wait before restarting to avoid rapid retries (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, this.iceRestartAttempts), 5000);
          console.log(`📞 Scheduling ICE restart attempt ${this.iceRestartAttempts + 1}/${this.maxIceRestarts} after ${delay}ms`);
          
          this.iceRestartAttempts++;
          this.iceRestartTimeout = setTimeout(() => {
          this.restartIce();
          }, delay);
        } else {
          // Max restart attempts reached - update state
          console.error('❌ Max ICE restart attempts reached - ICE connection failed');
          this.updateCallState({ 
            isConnected: false, 
            connectionState: 'failed',
            callDuration: 0
          });
          this.stopCallTimer();
        }
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      // Chrome bug: event.candidate can be null/undefined (end-of-candidates indication)
      // This is expected behavior per spec, but Chrome incorrectly throws errors
      if (event.candidate) {
        console.log('📞 ICE candidate generated:', event.candidate);
        console.log('📞 Candidate type:', event.candidate.type);
        console.log('📞 Candidate protocol:', event.candidate.protocol);
        // Send this to the other peer via signaling server
        this.onIceCandidate?.(event.candidate);
      } else {
        // Null candidate means end-of-candidates - this is normal, not an error
        console.log('📞 ICE candidate gathering completed (end-of-candidates indication)');
        // Don't send null candidate - it's just an indication that gathering is done
      }
    };

    // Handle ICE gathering state changes
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('📞 ICE gathering state:', this.peerConnection?.iceGatheringState);
    };

    // Handle negotiation needed (for ICE restart and renegotiation)
    this.peerConnection.onnegotiationneeded = async () => {
      console.log('📞 Negotiation needed - connection parameters changed');
      // This is typically triggered when:
      // - ICE restart is initiated
      // - Media streams are added/removed
      // - Connection needs to be renegotiated
      
      try {
        // Only create offer if we're in stable state and we're the caller
        if (this.peerConnection?.signalingState === 'stable') {
          console.log('📞 Creating new offer for renegotiation...');
          const offer = await this.peerConnection.createOffer();
          await this.peerConnection.setLocalDescription(offer);
          
          // Send the new offer via signaling
          if (this.onOffer && offer) {
            console.log('📞 Sending renegotiation offer via signaling');
            this.onOffer(offer);
          }
        } else {
          console.log('📞 Negotiation needed but signaling state is:', this.peerConnection?.signalingState);
        }
      } catch (error) {
        console.error('❌ Error during negotiation:', error);
      }
    };
  }

  private forceConnectionCheck(): void {
    if (this.peerConnection) {
      const connState = this.peerConnection.connectionState;
      const iceState = this.peerConnection.iceConnectionState;
      
      if (connState === 'failed' || iceState === 'failed') {
        console.log('Connection failed, attempting recovery...');
        this.restartIce();
      }
    }
  }

  private attemptConnectionRecovery(): void {
    if (this.connectionRecoveryAttempts >= this.maxConnectionRecoveryAttempts) {
      console.log('❌ Max connection recovery attempts reached');
      return;
    }
    
    this.connectionRecoveryAttempts++;
    console.log(`📞 Attempting connection recovery (${this.connectionRecoveryAttempts}/${this.maxConnectionRecoveryAttempts})...`);
    
    // Wait before attempting recovery (exponential backoff)
    const delay = Math.min(2000 * Math.pow(2, this.connectionRecoveryAttempts - 1), 10000);
    
    setTimeout(() => {
      if (this.peerConnection) {
        const state = this.peerConnection.connectionState;
        const iceState = this.peerConnection.iceConnectionState;
        
        if (state === 'failed' || iceState === 'failed') {
          // Reset ICE restart attempts when starting new recovery
          if (this.iceRestartAttempts >= this.maxIceRestarts) {
            this.iceRestartAttempts = 0;
          }
          this.restartIce();
        } else if (state === 'disconnected' && iceState !== 'failed') {
          // Try to trigger reconnection by checking if we can restart
          if (this.peerConnection.restartIce && this.iceRestartAttempts < this.maxIceRestarts) {
        this.restartIce();
      }
        }
      }
    }, delay);
  }

  private restartIce(): void {
    if (!this.peerConnection) {
      console.warn('⚠️ Cannot restart ICE: peer connection not initialized');
      return;
    }

    if (!this.peerConnection.restartIce) {
      console.warn('⚠️ restartIce() not supported by browser');
      // Fallback: Try to create new offer with ICE restart flag
      this.createOfferWithIceRestart();
      return;
    }

    console.log(`🔄 Restarting ICE (attempt ${this.iceRestartAttempts}/${this.maxIceRestarts})...`);
    
    try {
      this.peerConnection.restartIce();
      console.log('✅ ICE restart initiated');
      
      // Create a new offer with ICE restart (for signaling)
      this.createOfferWithIceRestart();
    } catch (error) {
      console.error('❌ Error restarting ICE:', error);
      // Fallback to creating offer with ICE restart flag
      this.createOfferWithIceRestart();
    }
  }

  private async createOfferWithIceRestart(): Promise<void> {
    try {
      if (!this.peerConnection) return;
      
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      
      console.log('ICE restart offer created');
      this.onOffer?.(offer);
    } catch (error) {
      console.error('Error creating ICE restart offer:', error);
    }
  }

  private monitorNetworkQuality(): void {
    // Clear any existing monitor
    this.stopNetworkMonitor();
    
    if (!this.peerConnection) return;
    
    this.networkMonitorInterval = setInterval(async () => {
      if (!this.peerConnection) {
        this.stopNetworkMonitor();
        return;
      }
      
      try {
        const stats = await this.peerConnection.getStats();
        let totalRtt = 0;
        let rttCount = 0;
        let packetsLost = 0;
        let packetsReceived = 0;
        
        stats.forEach(report => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime) {
              totalRtt += report.currentRoundTripTime;
              rttCount++;
              
              console.log('Current RTT:', report.currentRoundTripTime);
            }
          } else if (report.type === 'inbound-rtp' && report.mediaType === 'audio') {
            packetsLost = report.packetsLost || 0;
            packetsReceived = report.packetsReceived || 0;
          }
        });
        
        // Calculate network quality based on RTT and packet loss
        if (rttCount > 0) {
          const avgRtt = totalRtt / rttCount;
          const packetLossRate = packetsReceived > 0 
            ? (packetsLost / (packetsLost + packetsReceived)) * 100 
            : 0;
          
          let quality: 'good' | 'fair' | 'poor' = 'good';
          
          if (avgRtt > 0.5 || packetLossRate > 5) {
            quality = 'poor';
          } else if (avgRtt > 0.3 || packetLossRate > 2) {
            quality = 'fair';
          }
          
          this.updateCallState({ networkQuality: quality });
          
          if (avgRtt > 1.0) {
            console.warn('High latency detected:', avgRtt, 'seconds');
          }
        }
      } catch (error) {
        console.error('Error monitoring network quality:', error);
      }
    }, 3000); // Check every 3 seconds
  }

  private stopNetworkMonitor(): void {
    if (this.networkMonitorInterval) {
      clearInterval(this.networkMonitorInterval);
      this.networkMonitorInterval = null;
    }
  }

  // Callbacks for signaling
  public onIceCandidate: ((candidate: RTCIceCandidate) => void) | null = null;
  public onOffer: ((offer: RTCSessionDescriptionInit) => void) | null = null;
  public onAnswer: ((answer: RTCSessionDescriptionInit) => void) | null = null;

  // Initialize call (caller)
  async initiateCall(): Promise<void> {
    try {
      this.updateCallState({ connectionState: 'connecting' });
      
      // Ensure peer connection is set up
      if (!this.peerConnection) {
        console.log('Recreating peer connection for new call');
        this.setupPeerConnection();
      }
      
      // Check WebRTC support and permissions with fallback
      if (!permissionService.isWebRTCSupported()) {
        console.error('WebRTC Support Check Failed:', {
          RTCPeerConnection: !!window.RTCPeerConnection,
          webkitRTCPeerConnection: !!(window as any).webkitRTCPeerConnection,
          mozRTCPeerConnection: !!(window as any).mozRTCPeerConnection,
          mediaDevices: !!navigator.mediaDevices,
          getUserMedia: !!navigator.mediaDevices?.getUserMedia,
          navigatorGetUserMedia: !!(navigator as any).getUserMedia,
          userAgent: navigator.userAgent
        });
        
        // Try to create a peer connection anyway as a fallback
        try {
          const testConnection = new RTCPeerConnection();
          testConnection.close();
          console.log('WebRTC is actually supported, proceeding with call...');
        } catch (fallbackError) {
          console.error('WebRTC fallback test failed:', fallbackError);
          throw new Error('WebRTC is not supported in this browser. Please use Chrome, Firefox, Safari, or Edge.');
        }
      }

      if (!permissionService.isSecureContext()) {
        const hostname = window.location.hostname;
        
        if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
          throw new Error('Local network access detected. Please enable microphone permissions in your browser settings for this IP address, or use localhost instead.');
        } else {
          throw new Error('Voice calls require HTTPS. Please use a secure connection.');
        }
      }

      // Step 1: Get media stream (like working code - direct approach)
      console.log('🎤 Getting microphone access...');
        this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        },
          video: false
        });
      console.log('✅ Got local stream with tracks:', this.localStream.getTracks().length);
      
      // Step 2: Create peer connection if not exists
      if (!this.peerConnection) {
        console.log('Creating peer connection for new call');
        this.setupPeerConnection();
      }

      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }
      
      // Step 3: Add tracks immediately (like working code)
      this.localStream.getTracks().forEach(track => {
        console.log('🎤 Adding track to peer connection:', track.kind, track.label);
        this.peerConnection!.addTrack(track, this.localStream!);
      });
      console.log('✅ Tracks added to peer connection');
      
      // Step 4: Create offer
      console.log('📞 Creating offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      // Step 5: Set local description
      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ Offer created and local description set');
      
      // Step 6: Trigger callback to send via socket
      this.onOffer?.(offer);
      
    } catch (error) {
      console.error('Error initiating call:', error);
      this.updateCallState({ connectionState: 'failed' });
      throw error;
    }
  }

  // Prepare for incoming call (receiver)
  async prepareForIncomingCall(): Promise<void> {
    try {
      console.log('📞 Preparing WebRTC service for incoming call...');
      this.updateCallState({ connectionState: 'connecting' });
      
      // Ensure peer connection is set up
      if (!this.peerConnection) {
        console.log('Setting up peer connection for incoming call');
        this.setupPeerConnection();
      }

      // Check microphone permission for incoming calls
      console.log('🎤 Checking microphone permission for incoming call...');
      const micPermission = await permissionService.checkMicrophonePermission();
      console.log('🎤 Microphone permission status:', micPermission);

      // If microphone permission is not granted, we'll proceed in listen-only mode
      if (!micPermission.granted) {
        console.log('🎤 Microphone permission not granted, proceeding in listen-only mode');
        this.updateCallState({ isMuted: true }); // Automatically mute in listen-only mode
      }

      // Get user media (audio only) - only if microphone permission is granted
      if (micPermission.granted) {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: false
          });
          console.log('✅ Microphone stream obtained successfully for incoming call');
        } catch (mediaError) {
          console.error('Failed to get user media:', mediaError);
          const err = mediaError as DOMException;
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            console.log('🎤 Microphone permission denied, continuing in listen-only mode');
            this.localStream = null; // No local stream in listen-only mode
          } else if (err.name === 'NotFoundError') {
            throw new Error('No microphone found. Please connect a microphone and try again.');
          } else {
            throw new Error(`Failed to access microphone: ${err.message}`);
          }
        }
      } else {
        console.log('🎤 No microphone permission, proceeding in listen-only mode');
        this.localStream = null; // No local stream in listen-only mode
      }

      // Add audio tracks to peer connection (only if we have a local stream)
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          if (this.peerConnection) {
            this.peerConnection.addTrack(track, this.localStream!);
          }
        });
      } else {
        console.log('🎤 No local stream available, call will be listen-only');
      }

      console.log('📞 WebRTC service prepared for incoming call, waiting for offer...');
      
    } catch (error) {
      console.error('Error preparing for incoming call:', error);
      this.updateCallState({ connectionState: 'failed' });
      throw error;
    }
  }

  // Answer call (receiver) - simplified to match working pattern
  async answerCall(offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      if (!offer || !offer.type || !offer.sdp) {
        throw new Error('Invalid offer: offer is required');
      }
      
      console.log('📞 Answering call with offer (working pattern)');
      this.updateCallState({ connectionState: 'connecting' });
      
      // Step 1: Get media stream (like working code - direct approach)
      console.log('🎤 Getting microphone access for answering...');
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
      console.log('✅ Got local stream for answer with tracks:', this.localStream.getTracks().length);
      
      // Step 2: Create peer connection
      this.setupPeerConnection();
      if (!this.peerConnection) {
        throw new Error('Failed to create peer connection');
      }

      // Step 3: Add tracks immediately (like working code)
        this.localStream.getTracks().forEach(track => {
        console.log('🎤 Adding track to peer connection for answer:', track.kind, track.label);
        this.peerConnection!.addTrack(track, this.localStream!);
        });
      console.log('✅ Tracks added to peer connection');
      
      // Step 4: Set remote description (offer)
      console.log('📞 Setting remote description (offer)...');
      await this.peerConnection.setRemoteDescription(offer);
      console.log('✅ Remote description set');
      
      // Process pending ICE candidates after setting remote description
      if (this.pendingIceCandidates.length > 0) {
        console.log('📞 Processing pending ICE candidates:', this.pendingIceCandidates.length);
        for (const candidate of this.pendingIceCandidates) {
          try {
            await this.addIceCandidate(candidate);
          } catch (error) {
            console.error('❌ Error adding pending ICE candidate:', error);
          }
        }
        this.pendingIceCandidates = [];
      }
      
      // Step 5: Create answer
      console.log('📞 Creating answer...');
      const answer = await this.peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      // Step 6: Set local description
      await this.peerConnection.setLocalDescription(answer);
      console.log('✅ Answer created and local description set');
      
      // Step 7: Trigger callback to send via socket
      if (this.onAnswer) {
        this.onAnswer(answer);
      } else {
        throw new Error('onAnswer callback not set - cannot send answer');
      }
      
    } catch (error) {
      console.error('❌ Error answering call:', error);
      this.updateCallState({ connectionState: 'failed' });
      
      // Cleanup on error
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      
      throw error;
    }
  }

  // Handle incoming answer
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }
      
      await this.peerConnection.setRemoteDescription(answer);
      console.log('📞 Answer received and set');
      
      // Process pending ICE candidates
      if (this.pendingIceCandidates.length > 0) {
        console.log('📞 Processing pending ICE candidates after answer:', this.pendingIceCandidates.length);
        for (const candidate of this.pendingIceCandidates) {
          try {
            // Use our wrapper method which handles Chrome bugs
            await this.addIceCandidate(candidate);
          } catch (error) {
            console.error('❌ Error adding pending ICE candidate after answer:', error);
          }
        }
        this.pendingIceCandidates = [];
      }
    } catch (error) {
      console.error('❌ Error handling answer:', error);
      throw error;
    }
  }

  // Handle incoming offer
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      console.log('📞 handleOffer called with offer:', offer);
      
      // Validate offer format
      if (!offer.type || !offer.sdp) {
        console.error('❌ Invalid offer format in handleOffer:', offer);
        throw new Error('Invalid offer format: missing type or sdp');
      }
      
      // If peer connection is not set up, prepare for incoming call first
      if (!this.peerConnection) {
        console.log('📞 Peer connection not ready, preparing for incoming call...');
        await this.prepareForIncomingCall();
      }
      
      if (!this.peerConnection) {
        throw new Error('Failed to initialize peer connection');
      }
      
      // Set the remote offer
      console.log('📞 Setting remote offer description in handleOffer...');
      await this.peerConnection.setRemoteDescription(offer);
      console.log('✅ Remote offer description set successfully in handleOffer');
      
      // Process pending ICE candidates after setting remote description
      if (this.pendingIceCandidates.length > 0) {
        console.log('📞 Processing pending ICE candidates after setting remote offer:', this.pendingIceCandidates.length);
        const candidates = [...this.pendingIceCandidates];
        this.pendingIceCandidates = [];
        
        for (const candidate of candidates) {
          try {
            if (this.peerConnection && this.peerConnection.remoteDescription) {
              // Use our wrapper method which handles Chrome bugs
              await this.addIceCandidate(candidate);
            } else {
              console.warn('⚠️ Remote description not set, re-queuing ICE candidate');
              this.pendingIceCandidates.push(candidate);
            }
          } catch (error) {
            console.error('❌ Error adding pending ICE candidate in handleOffer:', error);
            // Don't re-queue failed candidates to prevent infinite loops
          }
        }
      }
      
      // Create and set the answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('📞 Answer created and set');
      
      // Update connection state
      this.updateCallState({ 
        isConnected: true, 
        connectionState: 'connected' 
      });
      console.log('📞 Call connection established');
      
      // Debug: Check if we have local stream
      console.log('📞 Local stream after answer:', !!this.localStream);
      if (this.localStream) {
        console.log('📞 Local stream tracks:', this.localStream.getTracks().length);
      }
      
      // Trigger the answer callback
      this.onAnswer?.(answer);
      
    } catch (error) {
      console.error('Error handling offer:', error);
      this.updateCallState({ connectionState: 'failed' });
      throw error;
    }
  }

  // Add ICE candidate
  async addIceCandidate(candidate: RTCIceCandidateInit | null | undefined): Promise<void> {
    try {
      // Chrome bug fix: Handle null/undefined candidates gracefully
      // According to WebRTC spec, null candidate is an end-of-candidates indication
      // Chrome incorrectly throws errors for this, so we ignore null candidates
      if (!candidate || candidate === null || candidate === undefined) {
        console.log('📞 Received null/undefined ICE candidate (end-of-candidates) - ignoring per WebRTC spec');
        return;
      }

      // Validate candidate has required fields (Chrome bug workaround)
      if (!candidate.candidate && !candidate.sdpMid && candidate.sdpMLineIndex === undefined) {
        console.warn('⚠️ Invalid ICE candidate missing both sdpMid and sdpMLineIndex - this is a Chrome bug, ignoring');
        return;
      }

      if (!this.peerConnection) {
        console.warn('⚠️ Cannot add ICE candidate: peer connection not initialized');
        // Store candidate for later use
        this.pendingIceCandidates.push(candidate);
        console.log('📞 ICE candidate queued for later (no peer connection)');
        return;
      }
      
      // If remote description is not set, queue the candidate
      if (!this.peerConnection.remoteDescription) {
        console.warn('⚠️ Cannot add ICE candidate: remote description not set yet');
        this.pendingIceCandidates.push(candidate);
        console.log('📞 ICE candidate queued for later (remote description pending)');
        return;
      }
      
      try {
      await this.peerConnection.addIceCandidate(candidate);
        console.log('✅ ICE candidate added successfully');
      } catch (error: any) {
        // Chrome bug: Sometimes throws errors even for valid end-of-candidates
        // Check if it's the known Chrome bug error message
        if (error?.message?.includes('Candidate missing values for both sdpMid and sdpMLineIndex')) {
          console.log('⚠️ Chrome bug: Ignoring expected end-of-candidates error');
          return;
        }
      console.error('❌ Error adding ICE candidate:', error);
        // If adding fails, don't re-queue to prevent infinite loops
        // But don't throw - let the connection continue
      }
    } catch (error) {
      console.error('❌ Unexpected error in addIceCandidate:', error);
      // Don't throw - allow connection to continue
    }
  }

  // Mute/unmute microphone
  toggleMute(): boolean {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      
      const isMuted = !audioTracks[0]?.enabled;
      this.updateCallState({ isMuted });
      return isMuted;
    }
    // If no local stream, we're already muted
    return true;
  }

  // Toggle speaker (for mobile devices)
  toggleSpeaker(): boolean {
    const isSpeakerOn = !this.callState.isSpeakerOn;
    this.updateCallState({ isSpeakerOn });
    return isSpeakerOn;
  }

  // Reset connection state and cleanup
  private resetConnectionState(): void {
    this.iceRestartAttempts = 0;
    this.connectionRecoveryAttempts = 0;
    if (this.iceRestartTimeout) {
      clearTimeout(this.iceRestartTimeout);
      this.iceRestartTimeout = null;
    }
  }

  // End call
  endCall(): void {
    console.log('Ending call');
    
    // Reset connection state counters
    this.resetConnectionState();
    
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Reset state
    this.updateCallState({
      isConnected: false,
      isMuted: false,
      isSpeakerOn: true,
      callDuration: 0,
      connectionState: 'disconnected'
    });

    this.stopCallTimer();
  }

  // Get call state
  getCallState(): CallState {
    return { ...this.callState };
  }

  // Manual connection check
  checkConnection(): boolean {
    const hasLocalStream = !!this.localStream;
    const hasRemoteStream = !!this.remoteStream;
    const peerConnectionState = this.peerConnection?.connectionState;
    const iceConnectionState = this.peerConnection?.iceConnectionState;
    
    console.log('📞 Connection check:', {
      hasLocalStream,
      hasRemoteStream,
      peerConnectionState,
      iceConnectionState,
      currentState: this.callState.connectionState
    });
    
    // Force connection if we have local stream and peer connection is stable
    const isConnected = hasLocalStream && (
      hasRemoteStream || 
      peerConnectionState === 'connected' || 
      iceConnectionState === 'connected' ||
      iceConnectionState === 'completed'
    );
    
    if (isConnected && this.callState.connectionState !== 'connected') {
      console.log('📞 Manual connection check: forcing connected state');
      this.updateCallState({ 
        isConnected: true, 
        connectionState: 'connected' 
      });
      this.startCallTimer();
    }
    
    return isConnected;
  }

  // Subscribe to call state changes
  onCallStateChange(callback: (state: CallState) => void): void {
    this.callStateCallbacks.push(callback);
  }

  // Unsubscribe from call state changes
  offCallStateChange(callback: (state: CallState) => void): void {
    const index = this.callStateCallbacks.indexOf(callback);
    if (index > -1) {
      this.callStateCallbacks.splice(index, 1);
    }
  }

  // Get local stream (for UI display)
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Get remote stream (for UI display)
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  private updateCallState(updates: Partial<CallState>): void {
    this.callState = { ...this.callState, ...updates };
    this.callStateCallbacks.forEach(callback => callback(this.callState));
  }

  private startCallTimer(): void {
    console.log('⏰ Starting call timer...');
    this.stopCallTimer();
    this.durationInterval = setInterval(() => {
      const newDuration = this.callState.callDuration + 1;
      console.log('⏰ Call duration:', newDuration);
      this.updateCallState({ 
        callDuration: newDuration 
      });
    }, 1000);
  }

  private stopCallTimer(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  // Format call duration
  static formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

// Singleton instance
export const webrtcService = new WebRTCService();
