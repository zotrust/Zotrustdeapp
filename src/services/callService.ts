// Call Service for managing P2P calls between users
import { signalingService } from './signalingService';
import { useWalletStore } from '../stores/walletStore';
import toast from 'react-hot-toast';

export interface CallRequest {
  callId: string;
  callerAddress: string;
  receiverAddress: string;
  context?: string;
  adId?: string;
  timestamp: number;
}

export interface CallParticipant {
  address: string;
  name?: string;
  isOnline: boolean;
}

export class CallService {
  private activeCall: CallRequest | null = null;
  private callHandlers: Map<string, (data: any) => void> = new Map();

  // Initiate call to another user
  async initiateCall(
    receiverAddress: string,
    context?: string,
    adId?: string,
    signalingData?: { callerAddress?: string; [key: string]: any }
  ): Promise<string> {
    // Use callerAddress from signalingData if provided, otherwise use connected wallet
    const { address } = useWalletStore.getState();
    const callerAddress = signalingData?.callerAddress || address;
    
    if (!callerAddress) {
      throw new Error('Wallet not connected or caller address not provided');
    }

    try {
      // Create call record in backend
      const token = localStorage.getItem('authToken');
      // Note: For support calls without auth, we might need to handle differently
      // For now, proceed without token if callerAddress is provided

      const requestBody = {
        receiver_address: receiverAddress,
        ad_id: adId,
        signaling_data: {
          context,
          callerAddress: callerAddress,
          ...signalingData
        }
      };
      
      console.log('📞 Sending call request:', requestBody);
      
      const response = await fetch('/api/calls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initiate call');
      }

      const data = await response.json();
      const callId = data.data.id.toString();

      // Store active call info
      this.activeCall = {
        callId,
        callerAddress: callerAddress,
        receiverAddress,
        context,
        adId,
        timestamp: Date.now()
      };

      // Use signaling service to establish WebRTC connection
      // Pass callerAddress to signaling service if provided
      await signalingService.initiateCall(receiverAddress, adId, callerAddress);

      console.log('✅ Call initiated:', callId);
      return callId;

    } catch (error) {
      console.error('❌ Call initiation failed:', error);
      throw error;
    }
  }

  // Answer incoming call
  async answerCall(callId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication required');
      }
      
      if (!this.activeCall) {
        throw new Error('No active call to answer');
      }

      // Update call status to active and include answer
      const response = await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'active',
          answer, // Include WebRTC answer
          signaling_data: {
            answer // Include answer in signaling data
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to answer call');
      }

      // Answer via signaling service with WebRTC answer
      await signalingService.answerCall(callId, answer);

      console.log('✅ Call answered:', callId);
      toast.success('Call connected!');

    } catch (error) {
      console.error('❌ Failed to answer call:', error);
      throw error;
    }
  }

  // Reject incoming call
  async rejectCall(callId: string): Promise<void> {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Authentication required');
      }

      // End call in backend
      await fetch(`/api/calls/${callId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('✅ Call rejected:', callId);
      toast('Call rejected', { icon: '📞' });

    } catch (error) {
      console.error('❌ Failed to reject call:', error);
      throw error;
    }
  }

  // End active call
  async endCall(): Promise<void> {
    if (!this.activeCall) return;

    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        await fetch(`/api/calls/${this.activeCall.callId}/end`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      }

      // End via signaling service
      signalingService.endCall();

      console.log('✅ Call ended:', this.activeCall.callId);
      this.activeCall = null;

    } catch (error) {
      console.error('❌ Failed to end call:', error);
    }
  }

  // Get active call info
  getActiveCall(): CallRequest | null {
    return this.activeCall;
  }

  // Check if user is available for calls
  async checkUserAvailability(address: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/auth/user-by-address?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        return data.success && data.data;
      }
      return false;
    } catch (error) {
      console.error('Failed to check user availability:', error);
      return false;
    }
  }

  // Get user info by address
  async getUserInfo(address: string): Promise<{ name?: string; verified?: boolean } | null> {
    try {
      const response = await fetch(`/api/auth/user-by-address?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return {
            name: data.data.name,
            verified: data.data.verified
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to get user info:', error);
      return null;
    }
  }

  // Register call event handler
  onCallEvent(event: string, handler: (data: any) => void): void {
    this.callHandlers.set(event, handler);
  }

  // Remove call event handler
  offCallEvent(event: string): void {
    this.callHandlers.delete(event);
  }

  // Emit call event
  private emitCallEvent(event: string, data: any): void {
    const handler = this.callHandlers.get(event);
    if (handler) {
      handler(data);
    }
  }

  // Initialize call service
  initialize(): void {
    // Set up signaling service event handlers
    signalingService.onCallEvent('call-answered', (data) => {
      console.log('📞 CallService: Received call-answered event:', data);
      this.emitCallEvent('call-answered', data);
    });

    signalingService.onCallEvent('call-ended', (data) => {
      console.log('📞 CallService: Received call-ended event:', data);
      this.emitCallEvent('call-ended', data);
      this.activeCall = null;
    });

    signalingService.onCallEvent('call-rejected', (data) => {
      console.log('📞 CallService: Received call-rejected event:', data);
      this.emitCallEvent('call-rejected', data);
      this.activeCall = null;
    });

    // Also listen for call status updates from the backend
    signalingService.onCallEvent('call-status-updated', (data: any) => {
      console.log('📞 CallService: Received call-status-updated event:', data);
      if (data.status === 'active') {
        this.emitCallEvent('call-answered', data);
      } else if (data.status === 'ended') {
        this.emitCallEvent('call-ended', data);
        this.activeCall = null;
      }
    });

    console.log('✅ Call service initialized');
  }

  // Cleanup
  cleanup(): void {
    this.activeCall = null;
    this.callHandlers.clear();
    console.log('✅ Call service cleaned up');
  }
}

// Singleton instance
export const callService = new CallService();

// Initialize on import
if (typeof window !== 'undefined') {
  callService.initialize();
}
