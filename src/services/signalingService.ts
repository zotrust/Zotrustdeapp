// Signaling Service for WebRTC Call Coordination
import { io, Socket } from 'socket.io-client';
import { webrtcService } from './webrtcService';
import { WS_URL } from '../config/env';
import { useWalletStore } from '../stores/walletStore';

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-initiated' | 'call-answered' | 'call-ended' | 'call-rejected';
  data: any;
  from: string;
  to: string;
  callId?: string;
}

export class SignalingService {
  private socket: Socket | null = null;
  private isConnected = false;
  private currentCallId: string | null = null;
  private callHandlers: Map<string, (message: SignalingMessage) => void> = new Map();
  private currentUserAddress: string | null = null;
  private receiverAddress: string | null = null;
  private callerSocketId: string | null = null;
  private callerAddress: string | null = null; // Track caller address for answering calls

  constructor() {
    this.setupWebRTCIntegration();
    // Auto-connect to signaling server when service is created
    this.autoConnect();
    
    // Listen for wallet address changes
    useWalletStore.subscribe((state) => {
      if (state.address && state.address !== this.currentUserAddress) {
        this.currentUserAddress = state.address;
        if (this.socket && this.isConnected) {
          this.socket.emit('join-user-room', { address: state.address });
        }
      }
    });
  }

  // Auto-connect to signaling server
  private autoConnect() {
    // Connect after a short delay to ensure the app is ready
    setTimeout(async () => {
      try {
        await this.ensureConnection();
        console.log('✅ Signaling service auto-connected');
      } catch (error) {
        console.log('⚠️ Signaling service auto-connect failed, will retry when needed');
      }
    }, 1000);
  }

  // Ensure connection to signaling server
  private async ensureConnection(): Promise<void> {
    if (!this.isConnected || !this.socket) {
      console.log('🔄 Not connected to signaling server, attempting to connect...');
      try {
        await this.connect();
      } catch (error) {
        console.error('❌ Failed to connect to signaling server:', error);
        throw new Error('Unable to connect to signaling server. Please check your internet connection and try again.');
      }
    }
  }

  // Connect to signaling server
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(WS_URL, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          autoConnect: true
        });

        this.socket.on('connect', () => {
          console.log('Connected to signaling server');
          this.isConnected = true;
          
          // Join user room after connection
          const { address } = useWalletStore.getState();
          if (address) {
            this.socket?.emit('join-user-room', { address });
            this.currentUserAddress = address;
          }
          
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('Disconnected from signaling server');
          this.isConnected = false;
        });

        this.socket.on('error', (error: any) => {
          console.error('Signaling server error:', error);
          reject(error);
        });

        // Handle incoming signaling messages
        this.socket.on('signaling-message', (message: SignalingMessage) => {
          this.handleSignalingMessage(message);
        });

        // Handle call events
        this.socket.on('call-initiated', (data: any) => {
          console.log('Call initiated:', data);
          this.handleCallInitiated(data);
        });

        this.socket.on('incoming-call', (data: any) => {
          console.log('📞 Incoming call received:', data);
          // Store caller address for sending answer back
          if (data.callerAddress) {
            this.callerAddress = data.callerAddress;
            console.log('📞 Stored caller address for answer:', this.callerAddress);
          }
          this.handleCallInitiated(data);
        });

        this.socket.on('call-answered', (data: any) => {
          console.log('📞 Call answered event received:', data);
          console.log('📞 Current call ID:', this.currentCallId);
          console.log('📞 Event call ID:', data.callId);
          
          // Handle call-answered event for both caller and receiver
          // The caller should receive this event when the receiver answers
          this.handleCallAnswered(data);
        });

        this.socket.on('call-ended', (data: any) => {
          console.log('Call ended:', data);
          this.handleCallEnded(data);
        });

        this.socket.on('call-rejected', (data: any) => {
          console.log('📞 Call rejected event received:', data);
          this.handleCallRejected(data);
        });

        this.socket.on('incoming-call-cleared', (data: any) => {
          console.log('📞 Incoming call cleared:', data);
          this.handleCallRejected(data);
        });

        // Handle WebRTC signaling - immediately answer (working pattern)
        this.socket.on('call-offer', async (data: any) => {
          console.log('📞 Received call offer (immediate processing):', data);
          if (data.offer) {
            // Store caller socket ID for ICE candidate exchange
            this.callerSocketId = data.callerSocketId;
            // Store caller address for sending answer back
            if (data.callerAddress) {
              this.callerAddress = data.callerAddress;
              console.log('📞 Stored caller address from call-offer:', this.callerAddress);
            } else if (data.from) {
              this.callerAddress = data.from;
            }
            
            // Immediately call answerCall with offer (working pattern - no delays)
            try {
              console.log('📞 Immediately calling webrtcService.answerCall with call-offer...');
              await webrtcService.answerCall(data.offer);
              console.log('✅ Answer created and sent via onAnswer callback');
            } catch (error) {
              console.error('❌ Error answering call-offer:', error);
            }
          }
        });

        // Handle standard 'offer' event from backend - immediately answer (working pattern)
        this.socket.on('offer', async (data: any) => {
          console.log('📞 Received offer via socket (immediate processing):', data);
          if (data.offer && data.from) {
            // Store caller info - when receiving an offer, 'from' is the caller
            this.callerSocketId = data.from;
            // Store caller address from offer data (this is who called us)
            if (data.callerAddress) {
              this.callerAddress = data.callerAddress;
              console.log('📞 Stored caller address from offer:', this.callerAddress);
            } else if (data.from) {
              // Use 'from' as caller address if not provided
              this.callerAddress = data.from;
              console.log('📞 Using from field as caller address:', this.callerAddress);
            }
            
            // Immediately call answerCall with offer (working pattern - no delays)
            try {
              console.log('📞 Immediately calling webrtcService.answerCall with offer...');
              await webrtcService.answerCall(data.offer);
              console.log('✅ Answer created and sent via onAnswer callback');
            } catch (error) {
              console.error('❌ Error answering call:', error);
            }
          }
        });

        this.socket.on('call-answer', (data: any) => {
          console.log('📞 Received call answer:', data);
          if (data.answer) {
            this.handleAnswer({
              type: 'answer',
              data: data.answer,
              from: '',
              to: this.currentUserAddress || '',
              callId: data.callId
            });
          }
        });

        this.socket.on('ice-candidate', (data: any) => {
          console.log('📞 Received ICE candidate:', data);
          if (data.candidate) {
            this.handleIceCandidate({
              type: 'ice-candidate',
              data: data.candidate,
              from: '',
              to: this.currentUserAddress || '',
              callId: data.callId
            });
          }
        });

      } catch (error) {
        console.error('Error connecting to signaling server:', error);
        reject(error);
      }
    });
  }

  // Disconnect from signaling server
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Initiate a call
  async initiateCall(receiverAddress: string, adId?: string, callerAddress?: string): Promise<string> {
    // Use provided callerAddress or get from wallet store
    const { address } = useWalletStore.getState();
    const finalCallerAddress = callerAddress || address;
    
    if (!finalCallerAddress) {
      throw new Error('Wallet not connected or caller address not provided');
    }

    this.currentUserAddress = finalCallerAddress;
    // Store receiver address for signaling (this is who we're calling)
    this.receiverAddress = receiverAddress;
    console.log('📞 Stored receiverAddress for call initiation:', this.receiverAddress);
    console.log('📞 Using caller address:', finalCallerAddress);

    try {
      // First, create call record in database (if not already created by callService)
      // Note: callService already creates the call record, so this might be redundant
      // But keeping for compatibility
      const token = localStorage.getItem('authToken');
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      // Add auth token only if available
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/calls', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          receiver_address: receiverAddress,
          ad_id: adId,
          signaling_data: {
            callerAddress: finalCallerAddress
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initiate call');
      }

      const data = await response.json();
      const callId = data.data.id.toString();
      this.currentCallId = callId;

      // Ensure connection to signaling server
      await this.ensureConnection();

      // Start WebRTC call
      await webrtcService.initiateCall();

      // Send call initiation message via socket
      if (this.socket) {
        this.socket.emit('initiate-call', {
          callId,
          receiverAddress,
          adId,
          callerAddress: finalCallerAddress,
          timestamp: Date.now()
        });
        
        console.log('📞 Call initiation sent to:', receiverAddress);
      }

      console.log('Call initiated:', callId);
      return callId;

    } catch (error) {
      console.error('Error initiating call:', error);
      throw error;
    }
  }

  // Answer a call
  async answerCall(callId: string, offer?: RTCSessionDescriptionInit, callerAddress?: string): Promise<void> {
    console.log('📞 signalingService.answerCall called:', { callId, hasOffer: !!offer, callerAddress });
    
    // Ensure connection to signaling server
    await this.ensureConnection();

    this.currentCallId = callId;
    
    // Store caller address if provided (needed for sending ICE candidates)
    if (callerAddress) {
      this.callerAddress = callerAddress;
      console.log('📞 Stored caller address in answerCall:', this.callerAddress);
    }

    try {
      // For incoming calls, we need to wait for the offer to be received
      // The offer will be handled by the WebRTC signaling message handlers
      if (offer) {
        console.log('📞 Answering call with provided offer');
        await webrtcService.answerCall(offer);
        console.log('✅ webrtcService.answerCall completed');
      } else {
        // For incoming calls without offer, wait for offer via socket
        // The socket.on('offer') handler will immediately process it
        console.log('📞 No offer provided, waiting for offer via socket.on("offer") handler...');
        console.log('📞 Offer will be processed immediately when received');
      }

      // Send call answered message (notification, not the WebRTC answer)
      if (this.socket) {
        console.log('📞 Sending call-answered notification');
        this.socket.emit('answer-call', {
          callId,
          timestamp: Date.now()
        });
      } else {
        console.warn('⚠️ Socket not connected, cannot send call-answered notification');
      }

      console.log('✅ Call answered successfully:', callId);

    } catch (error) {
      console.error('❌ Error answering call:', error);
      throw error;
    }
  }

  // End current call
  endCall(): void {
    if (this.currentCallId && this.socket) {
      this.socket.emit('end-call', {
        callId: this.currentCallId,
        timestamp: Date.now()
      });
    }

    webrtcService.endCall();
    this.currentCallId = null;
  }


  // Handle incoming signaling messages
  private handleSignalingMessage(message: SignalingMessage): void {
    console.log('Received signaling message:', message);

    switch (message.type) {
      case 'offer':
        this.handleOffer(message);
        break;
      case 'answer':
        this.handleAnswer(message);
        break;
      case 'ice-candidate':
        this.handleIceCandidate(message);
        break;
      default:
        console.log('Unknown signaling message type:', message.type);
    }
  }

  // Handle incoming offer
  private async handleOffer(message: SignalingMessage): Promise<void> {
    try {
      console.log('📞 Handling incoming offer:', message.data);
      await webrtcService.handleOffer(message.data);
      console.log('📞 Offer handled successfully');
    } catch (error) {
      console.error('❌ Error handling offer:', error);
    }
  }

  // Handle incoming answer
  private async handleAnswer(message: SignalingMessage): Promise<void> {
    try {
      console.log('📞 Handling incoming answer:', message.data);
      await webrtcService.handleAnswer(message.data);
      console.log('📞 Answer handled successfully');
    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  }

  // Handle incoming ICE candidate
  private async handleIceCandidate(message: SignalingMessage): Promise<void> {
    try {
      await webrtcService.addIceCandidate(message.data);
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  // Handle call initiated event
  private handleCallInitiated(data: any): void {
    const handler = this.callHandlers.get('call-initiated');
    if (handler) {
      handler({
        type: 'call-initiated',
        data,
        from: data.from,
        to: data.to,
        callId: data.callId
      });
    }
  }

  // Handle call answered event
  private handleCallAnswered(data: any): void {
    const handler = this.callHandlers.get('call-answered');
    if (handler) {
      handler({
        type: 'call-answered',
        data,
        from: data.from,
        to: data.to,
        callId: data.callId
      });
    }
  }

  // Handle call ended event
  private handleCallEnded(data: any): void {
    const handler = this.callHandlers.get('call-ended');
    if (handler) {
      handler({
        type: 'call-ended',
        data,
        from: data.from,
        to: data.to,
        callId: data.callId
      });
    }
  }

  // Handle call rejected event
  private handleCallRejected(data: any): void {
    const handler = this.callHandlers.get('call-rejected');
    if (handler) {
      handler({
        type: 'call-rejected',
        data,
        from: data.from,
        to: data.to,
        callId: data.callId
      });
    }
  }

  // Setup WebRTC integration
  private setupWebRTCIntegration(): void {
    // Handle WebRTC offer generation
    webrtcService.onOffer = (offer) => {
      if (this.currentCallId && this.currentUserAddress && this.receiverAddress && this.socket) {
        console.log('📞 Sending WebRTC offer to:', this.receiverAddress);
        this.socket.emit('call-offer', {
          receiverAddress: this.receiverAddress,
          offer: offer,
          callId: this.currentCallId,
          callerAddress: this.currentUserAddress
        });
      }
    };

    // Handle WebRTC answer generation
    webrtcService.onAnswer = (answer) => {
      console.log('📞 webrtcService.onAnswer callback triggered');
      console.log('📞 Answer details:', { 
        type: answer.type, 
        hasSdp: !!answer.sdp,
        sdpLength: answer.sdp?.length || 0,
        callerAddress: this.callerAddress,
        receiverAddress: this.receiverAddress,
        currentCallId: this.currentCallId
      });
      
      if (this.socket) {
        // Determine target address - use callerAddress if available (for incoming calls), otherwise use receiverAddress (for outgoing)
        const targetAddress = this.callerAddress || this.receiverAddress;
        
        if (targetAddress) {
          console.log('📞 Sending WebRTC answer to:', targetAddress);
          
          // Send answer via socket using the standard 'answer' event format that backend expects
          console.log('📞 Emitting answer event to socket with target:', targetAddress);
          this.socket.emit('answer', {
            answer: answer,
            to: targetAddress
          });
          console.log('✅ Answer event emitted via socket');
          
          // Also send call-answer event for compatibility
          if (this.currentCallId) {
            console.log('📞 Also emitting call-answer event for compatibility');
        this.socket.emit('call-answer', {
          answer: answer,
          callId: this.currentCallId
        });
          }
        } else {
          console.error('❌ Cannot send answer: no target address available');
          console.error('❌ callerAddress:', this.callerAddress);
          console.error('❌ receiverAddress:', this.receiverAddress);
        }
      } else {
        console.error('❌ Cannot send answer: socket not connected');
      }
    };

    // Handle ICE candidate generation
    webrtcService.onIceCandidate = (candidate) => {
      if (!this.socket) {
        console.warn('⚠️ Cannot send ICE candidate: socket not connected');
        return;
      }
      
      // Determine target address for ICE candidate
      // When answering a call: use callerAddress (the person who called us)
      // When initiating a call: use receiverAddress (the person we're calling)
      const targetAddress = this.callerAddress || this.receiverAddress;
      
      if (!targetAddress) {
        console.warn('⚠️ Cannot send ICE candidate: no target address (callerAddress or receiverAddress)');
        console.warn('📞 Current state:', {
          callerAddress: this.callerAddress,
          receiverAddress: this.receiverAddress,
          callerSocketId: this.callerSocketId,
          currentCallId: this.currentCallId
        });
        return;
      }
      
      console.log('📞 Sending ICE candidate to:', targetAddress);
        console.log('📞 Candidate details:', {
          type: candidate.type,
          protocol: candidate.protocol,
          address: candidate.address
        });
      
      // Send ICE candidate via socket
        this.socket.emit('ice-candidate', {
          candidate: candidate,
        to: targetAddress, // Use 'to' field that backend expects
        callId: this.currentCallId || undefined
        });
    };
  }

  // Register call event handlers
  onCallEvent(event: string, handler: (message: SignalingMessage) => void): void {
    this.callHandlers.set(event, handler);
  }

  // Get connection status
  isSignalingConnected(): boolean {
    return this.isConnected;
  }

  // Get current call ID
  getCurrentCallId(): string | null {
    return this.currentCallId;
  }
}

// Singleton instance
export const signalingService = new SignalingService();
