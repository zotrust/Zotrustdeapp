
import React, { useState, useEffect, useRef } from 'react';
import {X, PhoneOff, Mic, MicOff, Volume2, VolumeX, Clock} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ad } from '../types';
import { audioService } from '../services/audioService';
import MicrophonePermissionModal from './MicrophonePermissionModal';
import toast from 'react-hot-toast';
import io from 'socket.io-client';
import { useUserStore } from '../stores/userStore';
import { useParams } from 'react-router-dom';
import { useWalletStore } from '../stores/walletStore';
import { WS_URL } from '../config/env';

// Extend RTCPeerConnection to include queuedCandidates
interface ExtendedRTCPeerConnection extends RTCPeerConnection {
  queuedCandidates?: RTCIceCandidate[];
}


interface CallModalProps {
  isOpen: boolean;
  ad: Ad | null;
  onClose: () => void;
}

type CallStatus = 'initiating' | 'ringing' | 'connecting' | 'active' | 'ended';

// Enhanced ICE servers for better connectivity
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.ekiga.net' },
    { urls: 'stun:stun.ideasip.com' },
    { urls: 'stun:stun.schlund.de' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.voiparound.com' },
    { urls: 'stun:stun.voipbuster.com' },
    { urls: 'stun:stun.voipstunt.com' },
    { urls: 'stun:stun.counterpath.com' },
    { urls: 'stun:stun.1und1.de' },
    { urls: 'stun:stun.gmx.net' },
    { urls: 'stun:stun.callwithus.com' },
    { urls: 'stun:stun.counterpath.net' },
    { urls: 'stun:stun.1und1.de' },
    { urls: 'stun:stun.sipgate.net' },
    { urls: 'stun:stun.voip.aebc.com' }
  ],
  iceCandidatePoolSize: 10
};

const CallModal: React.FC<CallModalProps> = ({ isOpen, ad, onClose }) => {
  const { user } = useUserStore();
  const { walletAddress: urlWalletAddress } = useParams<{ walletAddress?: string }>();
  const { address: walletStoreAddress } = useWalletStore();
  
  // Priority: user.address > walletAddress from URL > walletStore.address
  const effectiveAddress = user?.address || urlWalletAddress || walletStoreAddress;
  
  console.log('📞 CallModal: Props received:', { isOpen, ad: !!ad, user: !!user, effectiveAddress });
  const [callStatus, setCallStatus] = useState<CallStatus>('initiating');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [callId, setCallId] = useState<string | null>(null);
  const [showMicrophoneModal, setShowMicrophoneModal] = useState(false);
  const [connectionState, setConnectionState] = useState('disconnected');
  const [isRegistered, setIsRegistered] = useState(false);
  const [reconnectionAttempts, setReconnectionAttempts] = useState(0);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callDurationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<any>(null);
  const peerConnectionRef = useRef<ExtendedRTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentTargetRef = useRef<string | null>(null);
  const reconnectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionLockRef = useRef<boolean>(false);
  const lastCallAttemptRef = useRef<number>(0);
  const iceCandidateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Socket connection setup
  useEffect(() => {
    if (!effectiveAddress) {
      console.log('📞 CallModal: No effective address available, skipping socket setup');
      return;
    }

    console.log('📞 CallModal: Setting up socket connection to:', WS_URL);
    console.log('📞 CallModal: Using address:', effectiveAddress);
    socketRef.current = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
      timeout: 20000
    });

    socketRef.current.on('connect', () => {
      console.log('📞 CallModal: Connected to signaling server');
      socketRef.current.emit('register', effectiveAddress);
      setIsRegistered(true);
      console.log('📞 CallModal: Registered with address:', effectiveAddress);
    });

    socketRef.current.on('disconnect', () => {
      console.log('📞 CallModal: Disconnected from signaling server');
      setIsRegistered(false);
    });

    // Removed: offer handler - CallModal only handles outgoing calls
    // Incoming calls are handled by IncomingCallModal/AdminLayout

    socketRef.current.on('answer', async ({ answer, from }: { answer: RTCSessionDescriptionInit; from: string }) => {
      console.log('📞 CallModal: Received answer from', from);
      
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
          
          // Process any queued ICE candidates
          await processQueuedIceCandidates();
          
          setCallStatus('active');
          setConnectionState('connected');
          startCallTimer();
        } catch (error) {
          console.error('📞 CallModal: Failed to set remote description:', error);
        }
      }
    });

    socketRef.current.on('ice-candidate', ({ candidate, from }: { candidate: RTCIceCandidateInit; from: string }) => {
      console.log('Received ICE candidate from', from);
      if (peerConnectionRef.current && candidate) {
        // Always queue ICE candidates first
        if (!peerConnectionRef.current.queuedCandidates) {
          peerConnectionRef.current.queuedCandidates = [];
        }
        peerConnectionRef.current.queuedCandidates.push(new RTCIceCandidate(candidate));
        
        // Try to process queued candidates if remote description is set
        if (peerConnectionRef.current.remoteDescription) {
          console.log('Processing queued ICE candidates immediately');
          processQueuedIceCandidates();
        } else {
          console.log('⚠️ Remote description not set, queuing ICE candidate for later');
          
          // Set a timeout to clear queued candidates if remote description doesn't arrive
          if (iceCandidateTimeoutRef.current) {
            clearTimeout(iceCandidateTimeoutRef.current);
          }
          iceCandidateTimeoutRef.current = setTimeout(() => {
            if (peerConnectionRef.current && peerConnectionRef.current.queuedCandidates) {
              console.log('⚠️ Clearing queued ICE candidates due to timeout');
              peerConnectionRef.current.queuedCandidates = [];
            }
          }, 10000); // 10 second timeout
        }
      } else {
        console.log('⚠️ No peer connection or candidate, ignoring ICE candidate');
      }
    });

    socketRef.current.on('call-ended', ({ from }: { from: string }) => {
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
  }, [effectiveAddress]);

  // Countdown timer functions
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

  const processQueuedIceCandidates = async () => {
    if (!peerConnectionRef.current || !peerConnectionRef.current.queuedCandidates) {
      return;
    }

    console.log('Processing queued ICE candidates:', peerConnectionRef.current.queuedCandidates.length);
    
    // Process candidates in batches to avoid overwhelming the connection
    const candidates = [...peerConnectionRef.current.queuedCandidates];
    peerConnectionRef.current.queuedCandidates = [];
    
    for (const candidate of candidates) {
      try {
        if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(candidate);
          console.log('✅ Successfully added queued ICE candidate');
        } else {
          console.log('⚠️ Remote description not set, re-queuing ICE candidate');
          if (!peerConnectionRef.current.queuedCandidates) {
            peerConnectionRef.current.queuedCandidates = [];
          }
          peerConnectionRef.current.queuedCandidates.push(candidate);
        }
      } catch (err) {
        console.error('❌ Failed to add queued ICE candidate:', err);
        // Don't re-queue failed candidates to prevent infinite loops
      }
    }
  };

  const createPeerConnection = () => {
    // Clean up existing connection first
    if (peerConnectionRef.current) {
      console.log('Cleaning up existing peer connection');
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    console.log('Creating peer connection');
    const pc = new RTCPeerConnection(iceServers) as ExtendedRTCPeerConnection;

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
      console.log('📞 Received remote track:', {
        kind: event.track.kind,
        streamCount: event.streams.length,
        trackId: event.track.id,
        enabled: event.track.enabled
      });
      
      if (event.streams && event.streams[0] && remoteAudioRef.current) {
        const stream = event.streams[0];
        console.log('📞 Setting remote audio stream:', {
          streamId: stream.id,
          trackCount: stream.getTracks().length
        });
        
        remoteAudioRef.current.srcObject = stream;
        
        // Try to play audio
        remoteAudioRef.current.play()
          .then(() => {
            console.log('✅ Remote audio playing successfully');
          })
          .catch(err => {
            console.error('❌ Audio play error:', err);
            // Retry playing after a short delay
            setTimeout(() => {
              if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
                remoteAudioRef.current.play().catch(e => {
                  console.error('❌ Audio play retry failed:', e);
                });
              }
            }, 500);
          });
      } else {
        console.warn('⚠️ Received track but missing stream or audio element');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        // Only show connected when ICE is also ready
        const iceState = pc.iceConnectionState;
        if (iceState === 'connected' || iceState === 'completed') {
        setCallStatus('active');
        setConnectionState('connected');
        setReconnectionAttempts(0); // Reset reconnection attempts
        startCallTimer();
          console.log('✅ Call fully connected - both connection and ICE ready');
        toast.success('Call connected!');
        } else {
          console.log('📞 Connection ready but ICE not ready yet:', iceState);
        }
      } else if (pc.connectionState === 'disconnected' || 
                 pc.connectionState === 'failed') {
        console.log('Connection lost, attempting to reconnect...');
        // Don't immediately end call, try to reconnect first
        if (callStatus === 'active' && reconnectionAttempts < 3) {
          setCallStatus('ringing'); // Go back to ringing state
          setReconnectionAttempts(prev => prev + 1);
          
          // Try to reconnect after a short delay
          reconnectionTimeoutRef.current = setTimeout(() => {
            if (currentTargetRef.current && socketRef.current && !isCallInProgress) {
              console.log('Attempting to reconnect...');
              // Re-send offer
              if (peerConnectionRef.current) {
                peerConnectionRef.current.createOffer().then(offer => {
                  peerConnectionRef.current!.setLocalDescription(offer);
                  socketRef.current.emit('offer', {
                    offer,
                    to: currentTargetRef.current
                  });
                }).catch(err => {
                  console.error('Failed to create reconnection offer:', err);
                  endCall();
                });
              }
            }
          }, 3000); // Increased delay to 3 seconds
        } else {
          console.log('Max reconnection attempts reached, ending call');
          endCall();
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallStatus('active');
        setConnectionState('connected');
        startCallTimer();
        toast.success('Voice connection established!');
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        console.log('ICE connection lost, connection may be unstable');
        // Don't end call immediately, let connection state handler deal with it
      }
    };

    return pc;
  };

  // Removed: handleReceiveOffer - CallModal only handles outgoing calls
  // Incoming calls are handled by IncomingCallModal/AdminLayout

  // Removed: WebRTC call state monitoring via webrtcService
  // CallModal handles its own WebRTC connection directly, not via webrtcService
  // This prevents conflicts with SupportCallModal which also uses webrtcService

  // Removed: Audio setup via webrtcService
  // CallModal uses its own localStreamRef and peerConnectionRef for audio streams
  // Audio is set up directly in createPeerConnection's ontrack handler

  useEffect(() => {
    if (isOpen && ad && isRegistered && !isCallInProgress && !isInitializing) {
      console.log('📞 CallModal: Starting call to:', ad.ownerAddress);
      // Add a small delay to ensure socket is ready
      setTimeout(() => {
        if (!connectionLockRef.current) {
          initiateCall();
        }
      }, 100);
    }
    
    return () => {
      if (callId) {
        endCall();
      }
    };
  }, [isOpen, ad, isRegistered]);

  const initiateCall = async () => {
    if (!ad || !user?.address) {
      console.log('📞 CallModal: Cannot initiate call - missing ad or user address');
      return;
    }

    if (isCallInProgress || isInitializing || connectionLockRef.current) {
      console.log('📞 CallModal: Call already in progress or initializing, skipping initiation');
      return;
    }

    // Debounce rapid call attempts (minimum 2 seconds between attempts)
    const now = Date.now();
    if (now - lastCallAttemptRef.current < 2000) {
      console.log('📞 CallModal: Call attempt too soon, debouncing...');
      return;
    }
    lastCallAttemptRef.current = now;

    if (!socketRef.current || !isRegistered) {
      console.log('📞 CallModal: Cannot initiate call - socket not connected or not registered');
      console.log('📞 CallModal: Socket ref:', !!socketRef.current, 'Registered:', isRegistered);
      // Retry after a short delay
      setTimeout(() => {
        if (socketRef.current && isRegistered && !isCallInProgress && !isInitializing) {
          console.log('📞 CallModal: Retrying call initiation');
          initiateCall();
        }
      }, 500);
      return;
    }

    console.log('📞 CallModal: Initiating call to:', ad.ownerAddress);

    try {
      connectionLockRef.current = true;
      setIsInitializing(true);
      setIsCallInProgress(true);
      setCallStatus('initiating');
      currentTargetRef.current = ad.ownerAddress;
      
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
      setCallStatus('ringing');

      peerConnectionRef.current = createPeerConnection();

      // Add audio tracks
      stream.getAudioTracks().forEach(track => {
        peerConnectionRef.current!.addTrack(track, stream);
      });

      setCallStatus('ringing');
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      console.log('📞 CallModal: Sending offer to:', ad.ownerAddress);
      socketRef.current.emit('offer', {
        offer,
        to: ad.ownerAddress
      });

      setCallStatus('ringing');
      console.log('📞 CallModal: Call status set to ringing');

      // Set timeout for unanswered calls
      callTimeoutRef.current = setTimeout(() => {
        if (callStatus === 'ringing') {
          setCallStatus('ended');
          toast.error('Call not answered');
          setTimeout(() => onClose(), 1000);
        }
      }, 30000); // 30 seconds timeout

    } catch (error) {
      console.error('Call initiation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to initiate call';
      
      // Check if it's a microphone permission error
      if (errorMessage.includes('Microphone permission required')) {
        console.log('🎤 Microphone permission required, showing permission modal');
        setShowMicrophoneModal(true);
        setCallStatus('initiating'); // Keep in initiating state
        return;
      }
      
      toast.error(errorMessage);
      setIsCallInProgress(false);
      setIsInitializing(false);
      connectionLockRef.current = false;
      onClose();
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      if (callDurationIntervalRef.current) {
        clearInterval(callDurationIntervalRef.current);
        callDurationIntervalRef.current = null;
      }
    if (reconnectionTimeoutRef.current) {
      clearTimeout(reconnectionTimeoutRef.current);
      reconnectionTimeoutRef.current = null;
    }
    
    if (iceCandidateTimeoutRef.current) {
      clearTimeout(iceCandidateTimeoutRef.current);
      iceCandidateTimeoutRef.current = null;
    }
    };
  }, []);

  const endCall = async () => {
    try {
      // Stop all sounds first
      audioService.stopAllSounds();
      
      // Stop call timer
      stopCallTimer();
      
      // End call through socket
      if (currentTargetRef.current && socketRef.current) {
        socketRef.current.emit('end-call', { to: currentTargetRef.current });
      }
      
      // Cleanup WebRTC
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      
    } catch (error) {
      console.error('Failed to end call:', error);
    }
    
    setCallStatus('ended');
    setCallDuration(0);
    setCallId(null);
    setConnectionState('disconnected');
    setIsCallInProgress(false);
    setIsInitializing(false);
    connectionLockRef.current = false;
    currentTargetRef.current = null;
    onClose();
  };

  // Microphone permission handlers
  const handleMicrophonePermissionGranted = () => {
    console.log('🎤 Microphone permission granted, retrying call initiation');
    setShowMicrophoneModal(false);
    // Retry the call initiation
    initiateCall();
  };

  const handleMicrophonePermissionDenied = () => {
    console.log('🎤 Microphone permission denied, closing call modal');
    setShowMicrophoneModal(false);
    setCallStatus('ended');
    toast.error('Microphone permission is required for voice calls');
    setTimeout(() => onClose(), 2000);
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


  const getStatusText = () => {
    switch (callStatus) {
      case 'initiating':
        return 'Connecting...';
      case 'ringing':
        return 'Ringing...';
      case 'active':
        const duration = formatDuration(callDuration);
        // Check if user is in listen-only mode (muted and no microphone permission)
        if (isMuted && !navigator.mediaDevices) {
          return `${duration} (Listen Only)`;
        }
        return duration;
      case 'ended':
        return 'Call ended';
      default:
        return '';
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

  console.log('📞 CallModal: Rendering with isOpen:', isOpen, 'ad:', !!ad);

  return (
    <>
    <AnimatePresence>
      {isOpen && ad && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-2xl p-6 w-full max-w-md border border-white/20 text-center shadow-2xl"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            {/* Call Info */}
            <div className="space-y-6 mb-8">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
                <span className="text-white font-bold text-2xl">
                  {ad.agent?.branchName.charAt(0) || 'A'}
                </span>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">
                  {ad.agent?.branchName || 'Agent'}
                </h3>
                <p className="text-gray-300 text-sm">{ad.agent?.city}</p>
                <p className="text-gray-400 text-xs">{ad.agent?.mobile}</p>
              </div>

              <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <Clock size={16} className="text-blue-400" />
                  <span className="text-blue-400 text-sm font-medium">Call Status</span>
                </div>
                <p className={`text-lg font-semibold ${getStatusColor()}`}>
                  {getStatusText()}
                </p>
                {connectionState !== 'disconnected' && (
                  <div className="flex items-center justify-center space-x-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${
                      connectionState === 'connected' ? 'bg-green-500' : 
                      connectionState === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-xs text-gray-400 capitalize">{connectionState}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Call Controls */}
            <div className="space-y-4">
              {callStatus === 'active' && (
                <div className="flex items-center justify-center space-x-4">
                  <motion.button
                    onClick={toggleMute}
                    className={`p-4 rounded-full shadow-lg ${
                      isMuted 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                        : 'bg-white/10 text-white border border-white/20'
                    }`}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.05 }}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </motion.button>

                  <motion.button
                    onClick={toggleSpeaker}
                    className={`p-4 rounded-full shadow-lg ${
                      isSpeakerOn 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                        : 'bg-white/10 text-white border border-white/20'
                    }`}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.05 }}
                    title={isSpeakerOn ? 'Turn off speaker' : 'Turn on speaker'}
                  >
                    {isSpeakerOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
                  </motion.button>
                </div>
              )}

              <motion.button
                onClick={endCall}
                className="p-5 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors"
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                title="End call"
              >
                <PhoneOff size={28} />
              </motion.button>
            </div>

            {/* Call Status Indicator */}
            {(callStatus === 'initiating' || callStatus === 'ringing') && (
              <div className="mt-6">
                <div className="flex justify-center space-x-1">
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-blue-400 rounded-full"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Hidden Audio Elements */}
      <audio 
        key="local-audio"
        ref={localAudioRef} 
        autoPlay 
        muted 
        style={{ display: 'none' }}
      />
      <audio 
        key="remote-audio"
        ref={remoteAudioRef} 
        autoPlay 
        style={{ display: 'none' }}
      />

    </AnimatePresence>

    {/* Microphone Permission Modal - Outside AnimatePresence to avoid key conflicts */}
    <MicrophonePermissionModal
      isOpen={showMicrophoneModal}
      onClose={() => setShowMicrophoneModal(false)}
      onPermissionGranted={handleMicrophonePermissionGranted}
      onPermissionDenied={handleMicrophonePermissionDenied}
    />
  </>
  );
};

export default CallModal;
