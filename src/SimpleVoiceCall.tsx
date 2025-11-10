import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Clock, CheckCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import io from 'socket.io-client';
import { useUserStore } from './stores/userStore';
import { Order } from './types';
import toast from 'react-hot-toast';

const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : (window.location.protocol === 'https:' ? 'https://localhost:5000' : 'http://localhost:5000');

// Simple ICE servers - only the most reliable ones
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

type CallStatus = 'idle' | 'initiating' | 'ringing' | 'active' | 'ended';
type CallState = 'disconnected' | 'connecting' | 'connected' | 'failed';

export default function SimpleVoiceCall() {
  const { user } = useUserStore();
  const [userId, setUserId] = useState(user?.address || '');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [connectionState, setConnectionState] = useState<CallState>('disconnected');
  const [callDuration, setCallDuration] = useState(0);
  const [currentCall, setCurrentCall] = useState<{
    targetAddress: string;
    targetName: string;
    context: string;
  } | null>(null);
  
  const socketRef = useRef<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const currentTargetRef = useRef<string | null>(null);
  const callDurationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update userId when user changes
  useEffect(() => {
    if (user?.address) {
      setUserId(user.address);
    }
  }, [user]);

  // Fetch orders
  const fetchOrders = async () => {
    if (!user?.address) return;
    
    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken') || '';
      const response = await fetch('/api/orders/my-orders', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const ordersData = data.data || [];
        
        // Map DB fields to frontend Order shape
        const mappedOrders: Order[] = ordersData.map((r: any) => ({
          id: String(r.id),
          adId: String(r.ad_id),
          buyerAddress: r.buyer_address,
          sellerAddress: r.seller_address,
          amount: Number(r.amount),
          token: r.token,
          priceInr: Number(r.price_inr ?? 0),
          state: r.state,
          agentBranch: r.agent_branch || r.branch_name || '',
          agentNumber: r.agent_number || r.agent_mobile || '',
          agentAddress: r.agent_address || '',
          createdAt: r.created_at,
          acceptedAt: r.accepted_at,
          lockExpiresAt: r.lock_expires_at,
          txHash: r.tx_hash || undefined,
          adOwnerAddress: r.ad_owner_address
        }));
        
        setOrders(mappedOrders);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.address) {
      fetchOrders();
    }
  }, [user?.address]);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to signaling server');
      if (userId) {
        socketRef.current.emit('register', userId);
        setIsRegistered(true);
      }
    });

    socketRef.current.on('offer', async ({ offer, from }) => {
      console.log('Received offer from', from);
      setCallStatus('ringing');
      currentTargetRef.current = from;
      await handleReceiveOffer(offer, from);
    });

    socketRef.current.on('answer', async ({ answer, from }) => {
      console.log('Received answer from', from);
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        setCallStatus('active');
        setConnectionState('connected');
        startCallTimer();
      }
    });

    socketRef.current.on('ice-candidate', ({ candidate, from }) => {
      console.log('Received ICE candidate from', from);
      if (peerConnectionRef.current && candidate) {
        peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
      }
    });

    socketRef.current.on('call-ended', ({ from }) => {
      console.log('Call ended by', from);
      endCall();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Auto-register when user is available
  useEffect(() => {
    if (userId && socketRef.current && !isRegistered) {
      socketRef.current.emit('register', userId);
      setIsRegistered(true);
    }
  }, [userId, isRegistered]);

  const createPeerConnection = () => {
    console.log('Creating peer connection');
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = (event) => {
      if (event.candidate && currentTargetRef.current) {
        console.log('Sending ICE candidate to', currentTargetRef.current);
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          to: currentTargetRef.current
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams && event.streams[0] && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(err => console.log('Audio play error:', err));
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState as CallState);
      
      if (pc.connectionState === 'connected') {
        setCallStatus('active');
        setConnectionState('connected');
        startCallTimer();
        toast.success('Call connected!');
      } else if (pc.connectionState === 'disconnected' || 
                 pc.connectionState === 'failed') {
        setCallStatus('ended');
        setConnectionState('disconnected');
        stopCallTimer();
        endCall();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallStatus('active');
        setConnectionState('connected');
        startCallTimer();
      }
    };

    return pc;
  };

  const startCallTimer = () => {
    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current);
    }
    
    setCallDuration(0);
    callDurationIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const stopCallTimer = () => {
    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = null;
    }
    setCallDuration(0);
  };

  const startCall = async (targetAddress: string, targetName: string, context: string) => {
    if (!targetAddress.trim()) {
      toast.error('Please enter target user ID');
      return;
    }

    try {
      setCallStatus('initiating');
      setCurrentCall({ targetAddress, targetName, context });
      currentTargetRef.current = targetAddress;
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }, 
        video: false 
      });
      
      console.log('Got local stream');
      localStreamRef.current = stream;
      setIsInCall(true);
      setCallStatus('ringing');

      peerConnectionRef.current = createPeerConnection();

      // Add audio tracks
      stream.getAudioTracks().forEach(track => {
        peerConnectionRef.current!.addTrack(track, stream);
      });

      setCallStatus('ringing');
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      socketRef.current.emit('offer', {
        offer,
        to: targetAddress
      });

      setCallStatus('ringing');

    } catch (err) {
      console.error('Error starting call:', err);
      setCallStatus('ended');
      endCall();
      toast.error('Failed to start call: ' + (err as Error).message);
    }
  };

  const handleReceiveOffer = async (offer: RTCSessionDescriptionInit, from: string) => {
    try {
      setCallStatus('ringing');
      currentTargetRef.current = from;
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }, 
        video: false 
      });
      
      console.log('Got local stream for answer');
      localStreamRef.current = stream;
      setIsInCall(true);
      setCallStatus('ringing');

      peerConnectionRef.current = createPeerConnection();

      // Add audio tracks
      stream.getAudioTracks().forEach(track => {
        peerConnectionRef.current!.addTrack(track, stream);
      });

      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      socketRef.current.emit('answer', {
        answer,
        to: from
      });

      setCallStatus('active');

    } catch (err) {
      console.error('Error handling offer:', err);
      setCallStatus('ended');
      endCall();
      toast.error('Failed to answer call: ' + (err as Error).message);
    }
  };

  const endCall = () => {
    if (isInCall && currentTargetRef.current) {
      socketRef.current.emit('end-call', { to: currentTargetRef.current });
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    setIsInCall(false);
    setCallStatus('idle');
    setIsMuted(false);
    setConnectionState('disconnected');
    setCurrentCall(null);
    stopCallTimer();
    currentTargetRef.current = null;
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        toast(isMuted ? 'Microphone unmuted' : 'Microphone muted', { 
          icon: isMuted ? '🎤' : '🔇' 
        });
      }
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = !isSpeakerOn ? 1 : 0;
    }
    toast(isSpeakerOn ? 'Speaker off' : 'Speaker on', { 
      icon: isSpeakerOn ? '🔇' : '🔊' 
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'initiating':
        return 'Connecting...';
      case 'ringing':
        return 'Ringing...';
      case 'active':
        return formatDuration(callDuration);
      case 'ended':
        return 'Call ended';
      default:
        return 'Ready to call';
    }
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'initiating':
        return 'text-yellow-400';
      case 'ringing':
        return 'text-blue-400';
      case 'active':
        return 'text-green-400';
      case 'ended':
        return 'text-gray-400';
      default:
        return 'text-white';
    }
  };

  const getOrderStatusColor = (state: string) => {
    switch (state) {
      case 'CREATED':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'ACCEPTED':
        return 'text-blue-400 bg-blue-500/20';
      case 'LOCKED':
        return 'text-purple-400 bg-purple-500/20';
      case 'RELEASED':
        return 'text-green-400 bg-green-500/20';
      case 'CANCELLED':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getTargetUserForOrder = (order: Order) => {
    const isBuyer = order.buyerAddress.toLowerCase() === user?.address?.toLowerCase();
    const isSeller = order.sellerAddress.toLowerCase() === user?.address?.toLowerCase();
    
    if (isBuyer) {
      return {
        address: order.sellerAddress,
        name: 'Seller',
        context: `Order #${order.id.slice(0, 8)} - ${order.amount} ${order.token}`
      };
    } else if (isSeller) {
      return {
        address: order.buyerAddress,
        name: 'Buyer',
        context: `Order #${order.id.slice(0, 8)} - ${order.amount} ${order.token}`
      };
    }
    
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            Voice Calls - Orders
          </h1>

          {!isRegistered ? (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  {user ? 'Connecting to voice service...' : 'Please connect your wallet first'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Call Status */}
              {isInCall && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl p-6 text-white"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold">
                        {currentCall?.targetName || 'Calling...'}
                      </h3>
                      <p className="text-blue-100 text-sm">
                        {currentCall?.context}
                      </p>
                      <p className={`text-sm font-medium ${getStatusColor()}`}>
                        {getStatusText()}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {callStatus === 'active' && (
                        <>
                          <motion.button
                            onClick={toggleMute}
                            className={`p-3 rounded-full ${
                              isMuted 
                                ? 'bg-red-500/20 text-red-300' 
                                : 'bg-white/10 text-white'
                            }`}
                            whileTap={{ scale: 0.95 }}
                          >
                            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                          </motion.button>

                          <motion.button
                            onClick={toggleSpeaker}
                            className={`p-3 rounded-full ${
                              isSpeakerOn 
                                ? 'bg-green-500/20 text-green-300' 
                                : 'bg-white/10 text-white'
                            }`}
                            whileTap={{ scale: 0.95 }}
                          >
                            {isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                          </motion.button>
                        </>
                      )}

                      <motion.button
                        onClick={endCall}
                        className="p-3 rounded-full bg-red-500 text-white"
                        whileTap={{ scale: 0.95 }}
                      >
                        <PhoneOff size={20} />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Orders List */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800">Your Orders</h2>
                
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-gray-100 rounded-xl p-4 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
                      <Clock size={32} className="text-gray-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-gray-600">No Orders Yet</h3>
                      <p className="text-gray-500 text-sm">
                        Your order requests will appear here
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => {
                      const targetUser = getTargetUserForOrder(order);
                      
                      if (!targetUser) return null;

                      return (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-3">
                                <span className="text-lg font-semibold text-gray-800">
                                  {order.amount} {order.token}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getOrderStatusColor(order.state)}`}>
                                  {order.state}
                                </span>
                              </div>
                              <p className="text-gray-600 text-sm">
                                {targetUser.name}: {targetUser.address.slice(0, 8)}...{targetUser.address.slice(-6)}
                              </p>
                              <p className="text-gray-500 text-xs">
                                {targetUser.context}
                              </p>
                            </div>
                            
                            <motion.button
                              onClick={() => startCall(targetUser.address, targetUser.name, targetUser.context)}
                              disabled={isInCall}
                              className="p-3 rounded-full bg-green-500 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                              whileTap={{ scale: 0.95 }}
                            >
                              <Phone size={20} />
                            </motion.button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hidden Audio Elements */}
          <audio 
            ref={remoteAudioRef} 
            autoPlay 
            style={{ display: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}