import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  CreditCard, 
  Gavel, 
  Users, 
  MapPin,
  Settings,
  Star,
  LogOut,
  Menu,
  X,
  Shield,
  Video,
  Phone,
  PhoneOff,
  Mic,
  MicOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { checkAdminAuth, clearExpiredToken } from '../utils/adminAuth';
import io, { Socket } from 'socket.io-client';
import { WS_URL } from '../config/env';
import IncomingCallModal from './IncomingCallModal';
// Removed CallModal - using inline call controls instead
import { callService } from '../services/callService';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [isCallActive, setIsCallActive] = useState(false); // Track if call is active (inline controls)
  const [callDuration, setCallDuration] = useState(0); // Call duration in seconds
  const [isMuted, setIsMuted] = useState(false); // Mute state
  const navigate = useNavigate();
  const location = useLocation();
  const socketRef = useRef<Socket | null>(null);
  const incomingCallRef = useRef<any>(null); // Ref to track incoming call for socket handlers
  const callDurationIntervalRef = useRef<NodeJS.Timeout | null>(null); // Timer for call duration
  
  // Direct WebRTC refs for support calls (like realtime pattern)
  const supportPeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const supportLocalStreamRef = useRef<MediaStream | null>(null);
  const supportRemoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const supportCallerAddressRef = useRef<string | null>(null);

  // Check if user is on login page
  const isLoginPage = location.pathname === '/admin/login';

  // Check token validity on component mount and setup socket for admin calls
  React.useEffect(() => {
    if (!isLoginPage) {
      checkAdminAuth().then(isValid => {
        if (!isValid) {
          navigate('/admin/login');
          toast.error('Session expired. Please login again.');
        }
      });
    }
  }, [navigate, isLoginPage]);

  // Track desktop vs mobile to keep sidebar always visible on desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Setup socket connection for admin to receive support calls
  // Admin is ALWAYS connected in fixed group - no issues with address
  useEffect(() => {
    if (isLoginPage) {
      // Don't connect on login page
      return;
    }

    console.log('📞 AdminLayout: Setting up socket connection for admin (ALWAYS CONNECTED)...');
    
    const newSocket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000, // Faster reconnection
      reconnectionAttempts: Infinity, // Always reconnect - never give up
      timeout: 20000,
      forceNew: false, // Reuse connection if possible
      autoConnect: true // Auto connect
    });

    let registrationInterval: NodeJS.Timeout | null = null;
    let statusCheckInterval: NodeJS.Timeout | null = null;

    const registerAdmin = () => {
      if (newSocket.connected) {
        console.log('📞 AdminLayout: Registering as ADMIN_SUPPORT (fixed address)');
        newSocket.emit('register', 'ADMIN_SUPPORT', true);
        console.log('📞 AdminLayout: ✅ Emitted register event for ADMIN_SUPPORT');
      }
    };

    const checkStatus = () => {
      if (newSocket.connected) {
        newSocket.emit('check-user-status', 'ADMIN_SUPPORT');
      }
    };

    newSocket.on('connect', () => {
      console.log('📞 AdminLayout: ✅ Connected to socket:', newSocket.id);
      console.log('📞 AdminLayout: Socket URL:', WS_URL);
      
      // Immediately register as admin for support calls (fixed address)
      registerAdmin();
      
      // Verify registration after a short delay
      setTimeout(() => {
        checkStatus();
      }, 500);
      
      // Setup periodic registration check to ensure admin stays registered
      // This ensures admin is ALWAYS in the group
      registrationInterval = setInterval(() => {
        if (newSocket.connected) {
          console.log('📞 AdminLayout: Periodic registration check...');
          registerAdmin();
        }
      }, 30000); // Re-register every 30 seconds to stay in group

      // Periodic status check
      statusCheckInterval = setInterval(() => {
        checkStatus();
      }, 60000); // Check status every minute
      
      toast.success('✅ Connected to support call service', { duration: 2000 });
    });

    newSocket.on('registration-confirmed', (data) => {
      console.log('📞 AdminLayout: ✅ Registration confirmed:', data);
      console.log('📞 AdminLayout: Admin is now in support call group');
    });

    newSocket.on('user-status', (data) => {
      console.log('📞 AdminLayout: User status check result:', data);
      if (data.userId === 'ADMIN_SUPPORT' && data.isOnline) {
        console.log('✅ AdminLayout: ✅ Admin is registered and online in support group');
      } else {
        console.warn('⚠️ AdminLayout: Admin not online, re-registering...');
        registerAdmin();
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('📞 AdminLayout: Disconnected from socket:', reason);
      console.log('📞 AdminLayout: Will automatically reconnect...');
      
      // Clear intervals on disconnect
      if (registrationInterval) {
        clearInterval(registrationInterval);
        registrationInterval = null;
      }
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
      }
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('📞 AdminLayout: ✅ Reconnected after', attemptNumber, 'attempts');
      // Re-register immediately on reconnect
      registerAdmin();
      
      // Restart intervals
      registrationInterval = setInterval(() => {
        if (newSocket.connected) {
          registerAdmin();
        }
      }, 30000);
      
      statusCheckInterval = setInterval(() => {
        checkStatus();
      }, 60000);
    });

    newSocket.on('connect_error', (error) => {
      console.error('📞 AdminLayout: Connection error:', error);
      console.log('📞 AdminLayout: Will retry connection automatically...');
    });

    // Handle incoming support calls
    newSocket.on('incoming-call', (data: any) => {
      console.log('📞 AdminLayout: Incoming support call:', data);
      
      // Fetch caller info
      fetch(`/api/auth/user-by-address?address=${data.callerAddress}`)
        .then(res => res.json())
        .then(userData => {
          const callerName = userData.success && userData.data?.name 
            ? userData.data.name 
            : undefined;

          const callData = {
            ...data,
            callerName,
            isAdminSupportCall: true
          };
          
          setIncomingCall(callData);
          incomingCallRef.current = callData; // Update ref

          // Show notification
          toast('📞 New support call incoming!', {
            duration: 5000,
            position: 'top-center',
            icon: '📞'
          });
        })
        .catch(err => {
          console.error('Error fetching caller info:', err);
          const callData = {
            ...data,
            isAdminSupportCall: true
          };
          setIncomingCall(callData);
          incomingCallRef.current = callData; // Update ref
          toast('📞 New support call incoming!', {
            duration: 5000,
            position: 'top-center',
            icon: '📞'
          });
        });
    });

      // Handle WebRTC offer - process immediately with direct WebRTC (realtime pattern)
    newSocket.on('offer', async (data: any) => {
      console.log('📞 AdminLayout: Received offer (direct WebRTC processing):', data);
      console.log('📞 AdminLayout: Offer data:', {
        hasOffer: !!data.offer,
        isAdminSupportCall: data.isAdminSupportCall,
        from: data.from,
        callerAddress: data.callerAddress,
        isCallActive: isCallActive,
        hasIncomingCallRef: !!incomingCallRef.current
      });
      
      // Handle admin support calls - check if offer exists and it's for admin
      if (data.offer && (data.isAdminSupportCall || data.from || data.callerAddress || supportCallerAddressRef.current)) {
        // Store caller address from offer or ref
        const callerAddress = data.callerAddress || data.from || supportCallerAddressRef.current || incomingCallRef.current?.callerAddress;
        if (callerAddress) {
          supportCallerAddressRef.current = callerAddress;
          console.log('📞 AdminLayout: Caller address set to:', callerAddress);
        }
        
        // If call is already active (call accepted), answer immediately with direct WebRTC
        if (isCallActive) {
          console.log('✅ AdminLayout: Call already active, answering with direct WebRTC...');
          await handleReceiveOfferDirectWebRTC(data.offer, callerAddress);
        } 
        // If IncomingCallModal is still open, update it with offer
        else if (incomingCallRef.current && incomingCallRef.current.callId) {
          console.log('📞 AdminLayout: IncomingCallModal still open, updating with offer');
          const updatedCall = {
            ...incomingCallRef.current,
            offer: data.offer
          };
          setIncomingCall(updatedCall);
          incomingCallRef.current = updatedCall;
          console.log('📞 AdminLayout: Updated IncomingCallModal with offer');
        } 
        // If no modal open but we got offer, auto-accept and answer
        else {
          console.log('⚠️ AdminLayout: No modal open but received offer, auto-accepting and answering...');
          setIsCallActive(true);
          await handleReceiveOfferDirectWebRTC(data.offer, callerAddress);
        }
      } else {
        console.warn('⚠️ AdminLayout: Received offer but missing required data:', data);
      }
    });

    // Handle ICE candidates for support calls
    newSocket.on('ice-candidate', async (data: any) => {
      const { candidate, from } = data;
      console.log('📞 AdminLayout: Received ICE candidate from', from);
      if (supportPeerConnectionRef.current && candidate && candidate.candidate) {
        try {
          await supportPeerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('❌ Error adding ICE candidate:', error);
        }
      }
    });

    // Handle call ended
    newSocket.on('call-ended', (data: any) => {
      console.log('📞 AdminLayout: Call ended:', data);
      setIncomingCall(null);
      incomingCallRef.current = null;
      endSupportCall();
      // Also end via call service
      callService.endCall().catch(err => {
        console.error('Error ending call via service:', err);
      });
    });

    // Handle call connected - start call timer
    newSocket.on('call-connected', (data: any) => {
      console.log('📞 AdminLayout: Call connected:', data);
      setIsCallActive(true);
      startCallTimer();
    });

    socketRef.current = newSocket;

    // Cleanup on unmount
    return () => {
      // Cleanup timer
      if (callDurationIntervalRef.current) {
        clearInterval(callDurationIntervalRef.current);
        callDurationIntervalRef.current = null;
      }
      console.log('📞 AdminLayout: Cleaning up socket connection...');
      
      // Clear intervals
      if (registrationInterval) {
        clearInterval(registrationInterval);
      }
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
      
      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isLoginPage]);

  const handleLogout = () => {
    // Disconnect socket before logout
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    clearExpiredToken();
    navigate('/admin/login');
    toast.success('Logged out successfully');
  };

  // Direct WebRTC handler for support calls (realtime pattern)
  const handleReceiveOfferDirectWebRTC = async (offer: RTCSessionDescriptionInit, callerAddress: string) => {
    try {
      console.log('📞 AdminLayout: Handling offer with direct WebRTC for:', callerAddress);
      
      // Get microphone access
      console.log('🎤 Getting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      
      console.log('✅ Got local stream for answer');
      supportLocalStreamRef.current = stream;
      
      // Create peer connection
      const iceServers = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      };
      
      supportPeerConnectionRef.current = new RTCPeerConnection(iceServers);
      
      // Add local tracks
      stream.getAudioTracks().forEach(track => {
        supportPeerConnectionRef.current!.addTrack(track, stream);
      });
      
      // Set up ICE candidate handler
      supportPeerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && socketRef.current && callerAddress) {
          console.log('📞 Sending ICE candidate to caller');
          socketRef.current.emit('ice-candidate', {
            candidate: event.candidate,
            to: callerAddress
          });
        }
      };
      
      // Set up remote track handler
      supportPeerConnectionRef.current.ontrack = (event) => {
        console.log('📞 Received remote track:', event.track.kind);
        if (event.streams && event.streams[0] && supportRemoteAudioRef.current) {
          supportRemoteAudioRef.current.srcObject = event.streams[0];
          supportRemoteAudioRef.current.play().catch(err => {
            console.error('❌ Audio play error:', err);
            setTimeout(() => {
              if (supportRemoteAudioRef.current && supportRemoteAudioRef.current.srcObject) {
                supportRemoteAudioRef.current.play().catch(e => console.error('Retry failed:', e));
              }
            }, 500);
          });
        }
      };

      // Track connection state changes
      supportPeerConnectionRef.current.onconnectionstatechange = () => {
        const state = supportPeerConnectionRef.current?.connectionState;
        console.log('📞 AdminLayout: Connection state changed:', state);
        
        if (state === 'connected') {
          setIsCallActive(true);
          startCallTimer();
          toast.success('Call connected!');
        } else if (state === 'disconnected' || state === 'failed') {
          console.log('📞 AdminLayout: Call disconnected, ending call');
          endSupportCall();
        }
      };

      supportPeerConnectionRef.current.oniceconnectionstatechange = () => {
        const iceState = supportPeerConnectionRef.current?.iceConnectionState;
        console.log('📞 AdminLayout: ICE connection state:', iceState);
        
        if (iceState === 'connected' || iceState === 'completed') {
          setIsCallActive(true);
          startCallTimer();
        } else if (iceState === 'disconnected' || iceState === 'failed') {
          console.log('📞 AdminLayout: ICE connection failed');
        }
      };
      
      // Set remote description (offer)
      console.log('📞 Setting remote description...');
      await supportPeerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Create answer
      console.log('📞 Creating answer...');
      const answer = await supportPeerConnectionRef.current.createAnswer();
      await supportPeerConnectionRef.current.setLocalDescription(answer);
      
      // Send answer
      console.log('📞 Sending answer to caller:', callerAddress);
      if (socketRef.current && callerAddress) {
        socketRef.current.emit('answer', {
          answer,
          to: callerAddress
        });
        console.log('✅ Answer sent to', callerAddress, 'connection establishing...');
      } else {
        console.error('❌ Cannot send answer - missing socket or callerAddress');
        console.error('Socket:', !!socketRef.current, 'CallerAddress:', callerAddress);
      }
      
      // Mark call as active and start timer
      setIsCallActive(true);
      startCallTimer();
      toast.success('Call connected!');
      
    } catch (error: any) {
      console.error('❌ Error handling offer with direct WebRTC:', error);
      toast.error(error.message || 'Failed to answer call');
      endSupportCall();
    }
  };

  const handleAcceptCall = async () => {
    if (!incomingCall || !socketRef.current) return;

    try {
      console.log('📞 Admin accepting call:', incomingCall.callId);
      console.log('📞 Incoming call data:', incomingCall);
      
      // FIRST: Emit call-accepted event to backend so caller knows to send offer
      console.log('📞 AdminLayout: Emitting call-accepted event to backend');
      socketRef.current.emit('call-accepted', {
        callId: incomingCall.callId,
        callerAddress: incomingCall.callerAddress
      });
      console.log('✅ AdminLayout: Call-accepted event sent');
      
      // Close IncomingCallModal and prepare for call (inline controls will show)
      setIncomingCall(null);
      incomingCallRef.current = null; // Clear ref too
      setIsCallActive(true); // Mark call as active - inline controls will appear
      
      toast.success('Call accepted, waiting for connection...');
      
      // Store caller address
      supportCallerAddressRef.current = incomingCall.callerAddress;
      
      // Check if offer is already available (unlikely but handle it)
      if (incomingCall.offer) {
        console.log('📞 Offer already available, answering immediately with direct WebRTC...');
        await handleReceiveOfferDirectWebRTC(incomingCall.offer, incomingCall.callerAddress);
      } else {
        console.log('📞 No offer yet, waiting for caller to send offer via socket...');
        console.log('📞 AdminLayout: Call is active, will handle offer when it arrives');
        // Offer will come via socket.on('offer') handler after caller receives call-accepted-by-admin
      }
      
      // Inline call controls are now active and will show connection status
      
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      toast.error('Failed to accept call');
      setIncomingCall(null);
      incomingCallRef.current = null;
      setIsCallActive(false); // Reset call state on error
    }
  };
  
  // Start call timer
  const startCallTimer = () => {
    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current);
    }
    setCallDuration(0);
    callDurationIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Stop call timer
  const stopCallTimer = () => {
    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = null;
    }
    setCallDuration(0);
  };

  // Format call duration
  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const endSupportCall = () => {
    console.log('📞 AdminLayout: Ending support call');
    
    // Stop call timer
    stopCallTimer();
    
    if (supportPeerConnectionRef.current) {
      supportPeerConnectionRef.current.close();
      supportPeerConnectionRef.current = null;
    }
    
    if (supportLocalStreamRef.current) {
      supportLocalStreamRef.current.getTracks().forEach(track => track.stop());
      supportLocalStreamRef.current = null;
    }
    
    if (socketRef.current && supportCallerAddressRef.current) {
      socketRef.current.emit('end-call', {
        to: supportCallerAddressRef.current
      });
    }
    
    setIsCallActive(false);
    supportCallerAddressRef.current = null;
    toast('Call ended', { icon: '📞' });
  };

  // Toggle mute
  const toggleMute = () => {
    if (supportLocalStreamRef.current) {
      const audioTrack = supportLocalStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        toast(isMuted ? 'Microphone unmuted' : 'Microphone muted', { 
          icon: isMuted ? '🎤' : '🔇' 
        });
      }
    }
  };

  const handleRejectCall = async () => {
    if (!incomingCall || !socketRef.current) {
      setIncomingCall(null);
      incomingCallRef.current = null;
      return;
    }

    try {
      socketRef.current.emit('call-rejected', {
        callId: incomingCall.callId,
        receiverAddress: 'ADMIN_SUPPORT',
        callerAddress: incomingCall.callerAddress
      });
      toast('Call rejected', { icon: '📞' });
    } catch (error) {
      console.error('Error rejecting call:', error);
    } finally {
      setIncomingCall(null);
      incomingCallRef.current = null;
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Orders', href: '/admin/orders', icon: ShoppingCart },
    { name: 'Transactions', href: '/admin/transactions', icon: CreditCard },
    { name: 'Disputes', href: '/admin/disputes', icon: Gavel },
    { name: 'Support Calls', href: '/admin/support-calls', icon: Phone },
    { name: 'Agents', href: '/admin/agents', icon: Users },
    { name: 'Locations', href: '/admin/locations', icon: MapPin },
    { name: 'Reviews', href: '/admin/reviews', icon: Star },
    { name: 'Videos', href: '/admin/videos', icon: Video },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const isCurrentPath = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Mobile sidebar overlay */}
      {!isDesktop && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Two Column Layout: Sidebar + Content */}
      <div className="flex h-screen overflow-hidden">
   
        <motion.div
          initial={false}
          animate={isDesktop ? { x: 0 } : { x: sidebarOpen ? 0 : '-100%' }}
          className="fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white/10 backdrop-blur-lg border-r border-white/20 flex flex-col h-full"
        >
         
          <div className="flex items-center justify-between p-6 border-b border-white/20 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Zotrust</h1>
                <p className="text-xs text-gray-400">Admin Panel</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = isCurrentPath(item.href);
              return (
                <motion.button
                  key={item.name}
                  onClick={() => {
                    navigate(item.href);
                    setSidebarOpen(false);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{item.name}</span>
                </motion.button>
              );
            })}
          </nav>

          {/* Call Controls (if active) */}
          {isCallActive && (
            <div className="p-4 border-t border-white/20 flex-shrink-0">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-300 text-xs font-medium">Call Active</span>
                  </div>
                  <span className="text-green-400 text-xs font-mono">{formatCallDuration(callDuration)}</span>
                </div>
                {supportCallerAddressRef.current && (
                  <div className="text-xs text-green-400 font-mono mb-2 truncate">
                    {supportCallerAddressRef.current.slice(0, 6)}...{supportCallerAddressRef.current.slice(-4)}
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <motion.button
                    onClick={toggleMute}
                    className={`flex-1 p-2 rounded-lg transition-colors flex items-center justify-center ${
                      isMuted 
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                        : 'bg-white/10 text-green-300 hover:bg-white/20'
                    }`}
                    whileTap={{ scale: 0.95 }}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                  </motion.button>
                  <motion.button
                    onClick={endSupportCall}
                    className="flex-1 p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors flex items-center justify-center"
                    whileTap={{ scale: 0.95 }}
                    title="End Call"
                  >
                    <PhoneOff size={16} />
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Logout */}
          <div className="p-4 border-t border-white/20 flex-shrink-0">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </motion.div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Mobile Menu Button */}
          <div className="lg:hidden fixed top-4 left-4 z-40">
            <button
              onClick={() => setSidebarOpen(true)}
              className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg p-2 text-gray-400 hover:text-white transition-colors"
            >
              <Menu size={24} />
            </button>
          </div>

          {/* Page content */}
          <main className="p-4 lg:p-6 min-h-full">
            {children}
          </main>
        </div>
      </div>

      {/* Incoming Call Modal - Shows when call is incoming */}
      {incomingCall && (
        <IncomingCallModal
          isOpen={!!incomingCall}
          callerAddress={incomingCall.callerAddress}
          callerName={incomingCall.callerName}
          callId={incomingCall.callId}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onClose={() => setIncomingCall(null)}
        />
      )}

      {/* Hidden audio element for support call remote audio */}
      <audio ref={supportRemoteAudioRef} autoPlay style={{ display: 'none' }} />
    </div>
  );
};

export default AdminLayout;
