import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Phone, AlertCircle, Loader2, X, PhoneCall, CheckCircle, PhoneOff, Mic, MicOff, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { generateRandomAddress } from '../utils/addressUtils';
import toast from 'react-hot-toast';
import io from 'socket.io-client';
import { WS_URL } from '../config/env';

interface Order {
  id: string;
  buyerAddress: string;
  sellerAddress: string;
  amount: string;
  token: string;
  state: string;
  buyerName?: string;
  sellerName?: string;
}

type CallStatus = 'idle' | 'connecting' | 'ringing' | 'active' | 'ended';

const OrderCallPage: React.FC = () => {
  const [isCheckingBrowser, setIsCheckingBrowser] = useState(true);
  const [isDAppBrowser, setIsDAppBrowser] = useState(false);
  const [hasMicrophoneAccess, setHasMicrophoneAccess] = useState<boolean | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isRegistered, setIsRegistered] = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [otherPartyOnline, setOtherPartyOnline] = useState(false);
  
  const navigate = useNavigate();
  const { orderId, walletAddress } = useParams<{ orderId: string; walletAddress: string }>();
  
  // Use walletAddress from URL - no wallet connection needed
  const callerAddress = walletAddress || generateRandomAddress();
  
  // Refs for WebRTC
  const socketRef = useRef<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callDurationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const targetAddressRef = useRef<string | null>(null);
  
  // ICE servers
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };
  
  const handleMicrophoneRedirect = useCallback(() => {
    if (!orderId || !walletAddress) return;
    
    const currentUrl = window.location.href;
    const baseUrl = currentUrl.split('/#')[0];
    const callUrl = `${baseUrl}/call/${orderId}/${walletAddress}`;
    
    const shouldRedirect = window.confirm(
      `🎤 Microphone Access Required!\n\n` +
      `To make voice calls, you need to open this in Chrome browser with microphone permissions.\n\n` +
      `Click OK to open in Chrome browser.\n\n` +
      `This will redirect you to: ${callUrl}\n\n` +
      `Wallet: ${walletAddress}\n` +
      `Order: ${orderId}`
    );
    
    if (shouldRedirect) {
      try {
        // Try to open in external browser
        window.open(callUrl, '_blank');
        
        // Copy to clipboard as fallback
        navigator.clipboard.writeText(callUrl).then(() => {
          toast.success('URL copied to clipboard! Paste it in Chrome browser.');
        }).catch(() => {
          toast.error('Please copy this URL and open in Chrome browser: ' + callUrl);
        });
      } catch (error) {
        console.error('Error opening external browser:', error);
        toast.error('Please copy this URL and open in Chrome browser: ' + callUrl);
      }
    }
  }, [orderId, walletAddress]);

  const handleDAppRedirect = useCallback(() => {
    if (!orderId || !walletAddress) return;
    
    const currentUrl = window.location.href;
    const baseUrl = currentUrl.split('/#')[0];
    const callUrl = `${baseUrl}/call/${orderId}/${walletAddress}`;
    
    const shouldRedirect = window.confirm(
      `📱 DApp Browser Detected!\n\n` +
      `To make voice calls, you need to open this in your default browser (Chrome, Safari, etc.).\n\n` +
      `Click OK to open in external browser.\n\n` +
      `This will redirect you to: ${callUrl}\n\n` +
      `Wallet: ${walletAddress}\n` +
      `Order: ${orderId}`
    );
    
    if (shouldRedirect) {
      try {
        window.open(callUrl, '_blank');
        navigator.clipboard.writeText(callUrl).then(() => {
          toast.success('URL copied to clipboard! Paste it in your browser.');
        }).catch(() => {
          toast.error('Please copy this URL and open in your browser: ' + callUrl);
        });
      } catch (error) {
        console.error('Error opening external browser:', error);
        toast.error('Please copy this URL and open in your browser: ' + callUrl);
      }
    }
  }, [orderId, walletAddress]);

  // Check microphone access on mount
  useEffect(() => {
    const checkMicrophoneAccess = async () => {
      try {
        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn('MediaDevices API not available');
          setHasMicrophoneAccess(false);
          setIsCheckingBrowser(false);
          return;
        }

        // Check current permission status
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName }).catch(() => null);
        
        if (permissionStatus?.state === 'denied') {
          console.warn('Microphone permission denied');
          setHasMicrophoneAccess(false);
          setIsCheckingBrowser(false);
          return;
        }

        // Try to get microphone access (this will prompt user if needed)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            } 
          });
          
          // If we got the stream, we have access
          stream.getTracks().forEach(track => track.stop()); // Stop immediately, we just needed to check
          setHasMicrophoneAccess(true);
        } catch (error: any) {
          console.warn('Failed to get microphone access:', error);
          setHasMicrophoneAccess(false);
        }
      } catch (error) {
        console.error('Error checking microphone:', error);
        setHasMicrophoneAccess(false);
      } finally {
        setIsCheckingBrowser(false);
      }
    };

    checkMicrophoneAccess();
  }, []);

  // Load order details after microphone check completes
  useEffect(() => {
    if (!isCheckingBrowser && hasMicrophoneAccess !== false) {
      fetchOrderDetails();
    }
  }, [isCheckingBrowser, hasMicrophoneAccess, orderId, walletAddress]);
  
  const fetchOrderDetails = async () => {
    try {
      setIsLoadingOrder(true);
      setOrderError(null);
      
      // Try to get auth token from localStorage (optional)
      const token = localStorage.getItem('authToken') || '';
      
      // Fetch user's orders and find the specific order
      const response = await fetch('/api/orders/my-orders', {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      
      if (!response.ok) {
        // If not authenticated, try to fetch order from public endpoint or show error
        throw new Error('Failed to fetch order details. Please login to access this feature.');
      }
      
      const json = await response.json();
      const orders = json.data || [];
      
      // Find the specific order
      const foundOrder = orders.find((o: any) => String(o.id) === String(orderId));
      
      if (!foundOrder) {
        throw new Error('Order not found');
      }
      
      // Map to Order interface
      const mappedOrder: Order = {
        id: String(foundOrder.id),
        buyerAddress: foundOrder.buyer_address,
        sellerAddress: foundOrder.seller_address,
        amount: foundOrder.amount,
        token: foundOrder.token,
        state: foundOrder.state,
        buyerName: (foundOrder as any).buyer_name,
        sellerName: (foundOrder as any).seller_name
      };
      
      setOrder(mappedOrder);
      
      // Determine target address (other party)
      const isBuyer = callerAddress.toLowerCase() === mappedOrder.buyerAddress.toLowerCase();
      const isSeller = callerAddress.toLowerCase() === mappedOrder.sellerAddress.toLowerCase();
      
      if (isBuyer) {
        targetAddressRef.current = mappedOrder.sellerAddress;
      } else if (isSeller) {
        targetAddressRef.current = mappedOrder.buyerAddress;
      } else {
        // If caller is neither buyer nor seller, use the other party from URL perspective
        // This handles cases where the URL has one party and we want to call the other
        targetAddressRef.current = isBuyer ? mappedOrder.sellerAddress : mappedOrder.buyerAddress;
      }
      
      // Check if other party is online
      if (targetAddressRef.current && socketRef.current?.connected) {
        checkOtherPartyStatus();
      }
      
    } catch (error: any) {
      console.error('Error fetching order:', error);
      setOrderError(error.message || 'Failed to fetch order details');
    } finally {
      setIsLoadingOrder(false);
    }
  };
  
  const checkOtherPartyStatus = () => {
    if (socketRef.current && targetAddressRef.current) {
      socketRef.current.emit('check-user-status', targetAddressRef.current);
    }
  };
  
  const createPeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    console.log('📞 OrderCallPage: Creating peer connection');
    const pc = new RTCPeerConnection(iceServers);
    
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && targetAddressRef.current) {
        console.log('📞 OrderCallPage: Sending ICE candidate');
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          to: targetAddressRef.current
        });
      }
    };
    
    pc.ontrack = (event) => {
      console.log('📞 OrderCallPage: Received remote track:', event.track.kind);
      if (event.streams && event.streams[0] && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(err => {
          console.error('❌ Audio play error:', err);
          setTimeout(() => {
            if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
              remoteAudioRef.current.play().catch(e => console.error('Retry failed:', e));
            }
          }, 500);
        });
      }
    };
    
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('📞 OrderCallPage: Connection state:', state);
      setConnectionState(state);
      
      if (state === 'connected') {
        setCallStatus('active');
        startCallTimer();
        toast.success('Call connected!');
      } else if (state === 'disconnected' || state === 'failed') {
        endCall();
      }
    };
    
    return pc;
  };
  
  const startCall = async () => {
    if (!targetAddressRef.current || !socketRef.current) {
      toast.error('Target user not available');
      return;
    }
    
    try {
      setCallStatus('connecting');
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      
      localStreamRef.current = stream;
      
      // Create peer connection
      peerConnectionRef.current = createPeerConnection();
      
      // Add local tracks
      stream.getAudioTracks().forEach(track => {
        peerConnectionRef.current!.addTrack(track, stream);
      });
      
      // Create and send offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      socketRef.current.emit('offer', {
        offer,
        to: targetAddressRef.current
      });
      
      setCallStatus('ringing');
      toast.success('Call initiated');
      
    } catch (error: any) {
      console.error('Error starting call:', error);
      toast.error(error.message || 'Failed to start call');
      setCallStatus('idle');
      cleanupWebRTC();
    }
  };
  
  const handleIncomingCall = async (offer: RTCSessionDescriptionInit, from: string) => {
    try {
      setCallStatus('ringing');
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      
      localStreamRef.current = stream;
      
      // Create peer connection
      peerConnectionRef.current = createPeerConnection();
      
      // Add local tracks
      stream.getAudioTracks().forEach(track => {
        peerConnectionRef.current!.addTrack(track, stream);
      });
      
      // Set remote description and create answer
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      // Send answer
      socketRef.current.emit('answer', {
        answer,
        to: from
      });
      
      setCallStatus('active');
      startCallTimer();
      toast.success('Call connected!');
      
    } catch (error: any) {
      console.error('Error handling incoming call:', error);
      toast.error(error.message || 'Failed to answer call');
      setCallStatus('idle');
      cleanupWebRTC();
    }
  };
  
  const endCall = () => {
    setCallStatus('idle');
    stopCallTimer();
    cleanupWebRTC();
    
    if (socketRef.current && targetAddressRef.current) {
      socketRef.current.emit('end-call', {
        to: targetAddressRef.current
      });
    }
    
    toast('Call ended', { icon: '📞' });
  };
  
  const cleanupWebRTC = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    setConnectionState('disconnected');
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
  
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (isCheckingBrowser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-violet-500" />
          <p className="text-gray-300">Checking microphone access...</p>
        </div>
      </div>
    );
  }
  
  // Show microphone access denied screen
  if (hasMicrophoneAccess === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 max-w-md text-center"
        >
          <MicOff className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Microphone Access Required</h2>
          <p className="text-gray-300 text-sm mb-4">
            To make voice calls, you need to grant microphone permissions. Please open this page in Chrome browser and allow microphone access.
          </p>
          <div className="space-y-2">
            <button
              onClick={handleMicrophoneRedirect}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Open in Chrome Browser
            </button>
            <button
              onClick={() => navigate('/orders')}
              className="w-full bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Go Back to Orders
            </button>
          </div>
        </motion.div>
      </div>
    );
  }
  
  if (isDAppBrowser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 max-w-md text-center"
        >
          <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">DApp Browser Detected</h2>
          <p className="text-gray-300 text-sm mb-4">
            Please open this page in Chrome or Safari browser for the best call experience.
          </p>
          <button
            onClick={() => navigate('/orders')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Go Back to Orders
          </button>
        </motion.div>
      </div>
    );
  }
  
  if (isLoadingOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-violet-500" />
          <p className="text-gray-300">Loading order details...</p>
        </div>
      </div>
    );
  }
  
  if (orderError || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 max-w-md text-center"
        >
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Order Not Found</h2>
          <p className="text-gray-300 text-sm mb-4">{orderError || 'Unable to load order details'}</p>
          <button
            onClick={() => navigate('/orders')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Go Back to Orders
          </button>
        </motion.div>
      </div>
    );
  }
  
  const isBuyer = callerAddress.toLowerCase() === order.buyerAddress.toLowerCase();
  const isSeller = callerAddress.toLowerCase() === order.sellerAddress.toLowerCase();
  const otherPartyAddress = isBuyer ? order.sellerAddress : order.buyerAddress;
  const otherPartyName = isBuyer ? order.sellerName : order.buyerName;
  const userRole = isBuyer ? 'Buyer' : isSeller ? 'Seller' : 'Unknown';
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/orders')}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">Order Call</h1>
          <div className="w-9"></div>
        </div>
        
        {/* Order Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <PhoneCall size={28} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Order #{order.id}</h2>
            <p className="text-gray-300 text-sm">
              {order.amount} {order.token}
            </p>
          </div>
          
          {/* User Info */}
          <div className="space-y-3 mb-6">
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <CheckCircle size={14} className="text-blue-400" />
                <p className="text-blue-300 text-sm font-medium">You ({userRole})</p>
              </div>
              <p className="text-blue-400 text-xs font-mono break-all">{callerAddress}</p>
              {isRegistered && (
                <div className="flex items-center space-x-1 mt-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-xs">Connected</span>
                </div>
              )}
            </div>
            
            <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <Phone size={14} className="text-purple-400" />
                <p className="text-purple-300 text-sm font-medium">
                  {isBuyer ? 'Seller' : 'Buyer'}
                  {otherPartyName && ` (${otherPartyName})`}
                </p>
              </div>
              <p className="text-purple-400 text-xs font-mono break-all">{otherPartyAddress}</p>
              <div className="flex items-center space-x-1 mt-2">
                {otherPartyOnline ? (
                  <>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-xs">Online</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-gray-400 text-xs">Offline</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Connection Status */}
          {!isRegistered && (
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <p className="text-yellow-300 text-sm">Connecting to call service...</p>
            </div>
          )}
          
          {/* Call Controls */}
          {isRegistered && (
            <div className="space-y-3">
              {callStatus === 'idle' && (
                <button
                  onClick={startCall}
                  disabled={!otherPartyOnline}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 disabled:opacity-50 text-white py-4 px-6 rounded-lg font-semibold transition-all flex items-center justify-center space-x-2"
                >
                  <Phone size={20} />
                  <span>{otherPartyOnline ? 'Call Other Party' : 'Other Party Offline'}</span>
                </button>
              )}
              
              {callStatus === 'connecting' && (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                  <p className="text-gray-300 text-sm">Connecting...</p>
                </div>
              )}
              
              {callStatus === 'ringing' && (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-yellow-400" />
                  <p className="text-gray-300 text-sm">Ringing...</p>
                </div>
              )}
              
              {callStatus === 'active' && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-center space-x-4 mb-4">
                    <div className="text-center">
                      <Clock size={24} className="text-green-400 mx-auto mb-2" />
                      <p className="text-green-300 font-mono text-lg">{formatDuration(callDuration)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-4">
                    <motion.button
                      onClick={toggleMute}
                      className={`p-3 rounded-full transition-colors ${
                        isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-green-400'
                      }`}
                      whileTap={{ scale: 0.95 }}
                    >
                      {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </motion.button>
                    
                    <motion.button
                      onClick={endCall}
                      className="p-3 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      whileTap={{ scale: 0.95 }}
                    >
                      <PhoneOff size={24} />
                    </motion.button>
                  </div>
                  
                  <p className="text-center text-green-300 text-sm mt-4">
                    Call Active
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Info */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="space-y-2 text-xs text-gray-400">
              <p className="flex items-center space-x-2">
                <Phone size={14} className="text-green-400" />
                <span>Voice call powered by WebRTC</span>
              </p>
              <p className="flex items-center space-x-2">
                <AlertCircle size={14} className="text-violet-400" />
                <span>Make sure microphone permissions are enabled</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Hidden audio element for remote audio */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
    </div>
  );
};

export default OrderCallPage;

