import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { WS_URL } from '../config/env';
import { useWalletStore } from '../stores/walletStore';
import { useUserStore } from '../stores/userStore';
import IncomingCallModal from '../components/IncomingCallModal';
import CallModal from '../components/CallModal';
import { callService } from '../services/callService';
import { audioService } from '../services/audioService';
import { webrtcService } from '../services/webrtcService';
import { signalingService } from '../services/signalingService';
import { Ad } from '../types';
import toast from 'react-hot-toast';

interface IncomingCall {
  callId: string;
  callerAddress: string;
  callerName?: string;
  ad?: Ad;
  timestamp: number;
  offer?: RTCSessionDescriptionInit; // ADD THIS
}

interface CallNotificationContextType {
  isConnected: boolean;
  incomingCall: IncomingCall | null;
  activeCall: boolean;
  acceptCall: (callId: string) => void;
  rejectCall: (callId: string) => void;
}

const CallNotificationContext = createContext<CallNotificationContextType>({
  isConnected: false,
  incomingCall: null,
  activeCall: false,
  acceptCall: () => {},
  rejectCall: () => {}
});

export const useCallNotifications = () => {
  return useContext(CallNotificationContext);
};

interface CallNotificationProviderProps {
  children: React.ReactNode;
}

export const CallNotificationProvider: React.FC<CallNotificationProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState(false);
  const [activeCallAd, setActiveCallAd] = useState<Ad | null>(null);

  const { address } = useWalletStore();
  const { user } = useUserStore();

  // Connect to socket when user is authenticated
  useEffect(() => {
    if (address && user) {
      connectSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [address, user]);

  const connectSocket = () => {
    if (socket?.connected) return;

    console.log('🔌 Connecting to WebSocket:', WS_URL);

    const newSocket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      timeout: 10000,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
      query: {
        userAddress: address
      }
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to call notification service');
      setIsConnected(true);
      
      newSocket.emit('join-user-room', { address });
      console.log('📞 Joined user room for address:', address);

      // Signaling service manages its own connection
      // No need to initialize it here
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from call notification service:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      setIsConnected(false);
    });

    // ============ WEBRTC SIGNALING EVENTS ============

    // Handle incoming call with offer
    newSocket.on('incoming-call', async (data: any) => {
      console.log('📞 Incoming call received:', data);
      
      try {
        // Fetch ad details if needed
        let ad: Ad | undefined;
        if (data.adId && data.adId !== 'order-call' && !data.adId.startsWith('order-')) {
          const token = localStorage.getItem('authToken');
          if (token) {
            try {
              const response = await fetch(`/api/ads/${data.adId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              if (response.ok) {
                const adData = await response.json();
                if (adData.success) {
                  ad = adData.data;
                }
              }
            } catch (error) {
              console.error('❌ Failed to fetch ad:', error);
            }
          }
        }

        // Fetch caller info
        let callerName: string | undefined;
        try {
          const response = await fetch(`/api/auth/user-by-address?address=${data.callerAddress}`);
          if (response.ok) {
            const userData = await response.json();
            if (userData.success && userData.data.name) {
              callerName = userData.data.name;
            }
          }
        } catch (error) {
          console.error('❌ Could not fetch caller name:', error);
        }

        setIncomingCall({
          callId: data.callId,
          callerAddress: data.callerAddress,
          callerName,
          ad,
          timestamp: data.timestamp,
          offer: data.offer // STORE THE OFFER
        });

        audioService.playIncomingCall();
        toast('📞 Incoming call!', { duration: 5000, position: 'top-center' });

      } catch (error) {
        console.error('❌ Error handling incoming call:', error);
      }
    });

    // Handle WebRTC offer (for receiver)
    newSocket.on('call-offer', async (data: any) => {
      console.log('📝 Received WebRTC offer:', data);
      
      try {
        // Update incoming call with offer if not already set
        setIncomingCall(prev => {
          if (prev && prev.callId === data.callId) {
            return { ...prev, offer: data.offer };
          }
          return prev;
        });
      } catch (error) {
        console.error('❌ Error handling offer:', error);
      }
    });

    // Handle WebRTC answer (for caller)
    newSocket.on('call-answer', async (data: any) => {
      console.log('📝 Received WebRTC answer:', data);
      
      try {
        // Handle answer in WebRTC service
        await webrtcService.handleAnswer(data.answer);
        console.log('✅ Answer processed successfully');
        
      } catch (error) {
        console.error('❌ Error handling answer:', error);
      }
    });

    // Handle ICE candidates
    newSocket.on('ice-candidate', async (data: any) => {
      console.log('🧊 Received ICE candidate');
      
      try {
        await webrtcService.addIceCandidate(data.candidate);
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    });

    // Handle call answered event
    newSocket.on('call-answered', (data: any) => {
      console.log('📞 Call answered event received:', data);
      
      audioService.stopIncomingCall();
      audioService.stopOutgoingCall();
      audioService.playCallConnected();
      
      setActiveCall(true);
      setIncomingCall(null);
      
      toast.success('Call connected!');
    });

    // Handle call status updates
    newSocket.on('call-status-updated', (data: any) => {
      console.log('📊 Call status updated:', data);
      
      if (data.status === 'ended') {
        handleCallEnd();
      } else if (data.status === 'active') {
        audioService.stopIncomingCall();
        audioService.stopOutgoingCall();
        audioService.playCallConnected();
        setActiveCall(true);
        toast.success('Call connected!');
      }
    });

    // Handle call rejected
    newSocket.on('call-rejected', (data: any) => {
      console.log('📞 Call rejected:', data);
      handleCallEnd();
      toast.error('Call was rejected');
    });

    // Handle call ended
    newSocket.on('call-ended', (data: any) => {
      console.log('📞 Call ended:', data);
      handleCallEnd();
    });

    setSocket(newSocket);
  };

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  };

  const handleCallEnd = () => {
    audioService.stopAllSounds();
    audioService.playCallEnded();
    
    // End WebRTC call
    webrtcService.endCall();
    
    setIncomingCall(null);
    setActiveCall(false);
    setActiveCallAd(null);
    
    toast('Call ended', { icon: '📞' });
  };

  const acceptCall = async (callId: string) => {
    if (!incomingCall) {
      console.error('❌ No incoming call to accept');
      return;
    }

    try {
      console.log('📞 Accepting call:', callId);
      
      // Stop incoming call sound
      audioService.stopIncomingCall();

      // Prepare WebRTC for incoming call
      await webrtcService.prepareForIncomingCall();
      console.log('✅ WebRTC prepared for incoming call');

      // Answer call with the offer we received
      if (incomingCall.offer) {
        await webrtcService.answerCall(incomingCall.offer);
        console.log('✅ Call answered with offer');
      } else {
        // If no offer, just prepare for incoming call
        await webrtcService.answerCall();
        console.log('✅ Call answered without offer');
      }

      // Update call status in backend
      // Note: The answer will be handled by the signaling service
      // await callService.answerCall(callId);

      // Notify caller via socket
      if (socket) {
        socket.emit('call-answered', {
          callId,
          receiverAddress: address,
          callerAddress: incomingCall.callerAddress
        });
      }

      // Play call connected sound
      audioService.playCallConnected();

      // Set active call state
      setActiveCall(true);
      setActiveCallAd(incomingCall?.ad || null);
      setIncomingCall(null);
      
      toast.success('Call connected!');

    } catch (error) {
      console.error('❌ Error accepting call:', error);
      audioService.stopIncomingCall();
      toast.error('Failed to accept call');
      
      // Cleanup on error
      webrtcService.endCall();
      setIncomingCall(null);
    }
  };

  const rejectCall = async (callId: string) => {
    try {
      console.log('📞 Rejecting call:', callId);
      
      // Stop incoming call sound
      audioService.stopIncomingCall();
      
      // Reject call through call service
      await callService.rejectCall(callId);

      // Notify caller via socket
      if (socket && incomingCall) {
        socket.emit('call-rejected', {
          callId,
          receiverAddress: address,
          callerAddress: incomingCall.callerAddress
        });
      }

      // Play call ended sound
      audioService.playCallEnded();
      
      setIncomingCall(null);

    } catch (error) {
      console.error('❌ Error rejecting call:', error);
      audioService.stopIncomingCall();
    }
  };

  const contextValue: CallNotificationContextType = {
    isConnected,
    incomingCall,
    activeCall,
    acceptCall,
    rejectCall
  };

  return (
    <CallNotificationContext.Provider value={contextValue}>
      {children}
      
      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          isOpen={!!incomingCall}
          callerAddress={incomingCall.callerAddress}
          callerName={incomingCall.callerName}
          ad={incomingCall.ad}
          callId={incomingCall.callId}
          onAccept={() => acceptCall(incomingCall.callId)}
          onReject={() => rejectCall(incomingCall.callId)}
          onClose={() => setIncomingCall(null)}
        />
      )}

      {/* Active Call Modal */}
      {activeCall && (
        <CallModal
          isOpen={activeCall}
          ad={activeCallAd}
          onClose={() => {
            // End call when modal closes
            webrtcService.endCall();
            
            // Notify backend
            const callId = signalingService.getCurrentCallId();
            if (callId) {
              callService.endCall();
            }
            
            // Notify other party via socket
            if (socket && callId) {
              socket.emit('end-call', { callId });
            }
            
            handleCallEnd();
          }}
        />
      )}
    </CallNotificationContext.Provider>
  );
};

export default CallNotificationProvider;