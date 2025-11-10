import React, { useState, useEffect, useRef } from 'react';
import { X, PhoneOff, Mic, MicOff, Volume2, VolumeX, Clock, PhoneCall } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import io from 'socket.io-client';
import { WS_URL } from '../config/env';
import { ADMIN_SUPPORT_ADDRESS } from '../constants/admin';

interface SupportCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callerAddress: string;
}

type CallStatus = 'initiating' | 'connecting' | 'connected' | 'ended' | 'failed';

// Simple ICE servers - only the most reliable ones (like realtime example)
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

const SupportCallModal: React.FC<SupportCallModalProps> = ({ isOpen, onClose, callerAddress }) => {
  const [callStatus, setCallStatus] = useState<CallStatus>('initiating');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionState, setConnectionState] = useState('disconnected');
  
  const socketRef = useRef<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callDurationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Socket connection and WebRTC setup (direct pattern like SimpleVoiceCall)
  useEffect(() => {
    if (!isOpen || !callerAddress) return;

    console.log('📞 SupportCallModal: Setting up socket and starting call');
    socketRef.current = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
      timeout: 20000
    });

    socketRef.current.on('connect', () => {
      console.log('📞 SupportCallModal: Connected to signaling server');
      // Register with caller address
      socketRef.current.emit('register', callerAddress);
      console.log('📞 SupportCallModal: Registered as:', callerAddress);
      
      // Send initiate-call notification (but don't send WebRTC offer yet)
      socketRef.current.emit('initiate-call', {
        callId: `support-call-${Date.now()}`,
        receiverAddress: ADMIN_SUPPORT_ADDRESS,
        callerAddress: callerAddress,
        timestamp: Date.now()
      });
      
      // Wait for admin to accept before starting WebRTC
      setCallStatus('connecting');
      toast('Waiting for admin to accept...', { icon: '📞' });
    });

    // Listen for admin acceptance
    socketRef.current.on('call-accepted-by-admin', (data: any) => {
      console.log('📞 SupportCallModal: Admin accepted call!', data);
      toast.success('Admin accepted! Connecting...');
      // Now start the WebRTC call
      startCall();
    });

    socketRef.current.on('call-waiting-for-acceptance', (data: any) => {
      console.log('📞 SupportCallModal: Call notification sent to admin, waiting for acceptance');
      setCallStatus('connecting');
    });

    socketRef.current.on('answer', async ({ answer, from }: { answer: RTCSessionDescriptionInit; from: string }) => {
      console.log('📞 SupportCallModal: Received answer from', from);
      if (peerConnectionRef.current && answer) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('✅ SupportCallModal: Remote description set');
          setCallStatus('connecting');
        } catch (error) {
          console.error('❌ SupportCallModal: Error setting remote description:', error);
        }
      }
    });

    socketRef.current.on('ice-candidate', async ({ candidate, from }: { candidate: RTCIceCandidateInit; from: string }) => {
      console.log('📞 SupportCallModal: Received ICE candidate from', from);
      if (peerConnectionRef.current && candidate && candidate.candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('❌ SupportCallModal: Error adding ICE candidate:', error);
        }
      }
    });

    socketRef.current.on('call-ended', ({ from }: { from: string }) => {
      console.log('📞 SupportCallModal: Call ended by', from);
      endCall();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [isOpen, callerAddress]);

  const createPeerConnection = () => {
    console.log('📞 SupportCallModal: Creating peer connection');
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log('📞 SupportCallModal: Sending ICE candidate to admin');
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          to: ADMIN_SUPPORT_ADDRESS
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('📞 SupportCallModal: Received remote track:', event.track.kind);
      if (event.streams && event.streams[0] && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(err => {
          console.error('❌ SupportCallModal: Audio play error:', err);
          // Retry after delay
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
      setConnectionState(state);
      console.log('📞 SupportCallModal: Connection state:', state);
      
      if (state === 'connected') {
        setCallStatus('connected');
        startCallTimer();
        toast.success('Call connected!');
      } else if (state === 'disconnected' || state === 'failed') {
        setCallStatus('ended');
        endCall();
      } else if (state === 'connecting') {
        setCallStatus('connecting');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('📞 SupportCallModal: ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallStatus('connected');
        startCallTimer();
      }
    };

    return pc;
  };

  const startCall = async () => {
    try {
      setCallStatus('connecting');
      console.log('📞 SupportCallModal: Starting call to admin...');
      
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
      
      console.log('✅ Got local stream');
      localStreamRef.current = stream;
      
      // Create peer connection
      peerConnectionRef.current = createPeerConnection();
      
      // Add audio tracks
      stream.getAudioTracks().forEach(track => {
        peerConnectionRef.current!.addTrack(track, stream);
      });
      
      // Create and send offer
      console.log('📞 Creating offer...');
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      
      await peerConnectionRef.current.setLocalDescription(offer);
      console.log('✅ Offer created and set');
      
      // Send offer to admin
      if (socketRef.current) {
        socketRef.current.emit('offer', {
          offer,
          to: ADMIN_SUPPORT_ADDRESS
        });
        console.log('📞 Offer sent to admin');
      }
      
    } catch (error: any) {
      console.error('❌ SupportCallModal: Error starting call:', error);
      setCallStatus('failed');
      toast.error(error.message || 'Failed to start call');
      endCall();
    }
  };

  const endCall = () => {
    console.log('📞 SupportCallModal: Ending call');
    
    // Stop call timer
    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = null;
    }

    // End call via socket
    if (socketRef.current) {
      socketRef.current.emit('end-call', {
        to: ADMIN_SUPPORT_ADDRESS
      });
    }

    // Cleanup WebRTC
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    setCallStatus('ended');
    setCallDuration(0);
    onClose();
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
      remoteAudioRef.current.muted = isSpeakerOn;
    }
    toast(isSpeakerOn ? 'Speaker off' : 'Speaker on', {
      icon: isSpeakerOn ? '🔇' : '🔊'
    });
  };

  const startCallTimer = () => {
    if (callDurationIntervalRef.current) return;
    
    const startTime = Date.now();
    callDurationIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setCallDuration(elapsed);
    }, 1000);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-2xl p-6 w-full max-w-md mx-4 border border-white/20 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Support Call</h2>
              <button
                onClick={endCall}
                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
              >
                <X size={20} className="text-red-400" />
              </button>
            </div>

            {/* Call Status */}
            <div className="text-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                <PhoneCall size={40} className="text-white" />
                {(callStatus === 'connecting' || callStatus === 'initiating') && (
                  <div className="absolute inset-0 rounded-full border-4 border-green-400 border-t-transparent animate-spin"></div>
                )}
              </div>
              
              <h3 className="text-lg font-semibold text-white mb-2">
                {callStatus === 'initiating' && 'Initiating call...'}
                {callStatus === 'connecting' && 'Connecting...'}
                {callStatus === 'connected' && 'Connected'}
                {callStatus === 'ended' && 'Call ended'}
                {callStatus === 'failed' && 'Call failed'}
              </h3>
              
              <p className="text-gray-400 text-sm">
                {callStatus === 'connected' && formatDuration(callDuration)}
                {callStatus !== 'connected' && 'Admin Support'}
              </p>
              
              {/* Connection State Indicator */}
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

            {/* Call Duration */}
            {callStatus === 'connected' && (
              <div className="text-center mb-6">
                <div className="flex items-center justify-center space-x-2 text-gray-400">
                  <Clock size={16} />
                  <span className="text-sm font-mono">{formatDuration(callDuration)}</span>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center space-x-6 mb-6">
              {/* Mute Button */}
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full transition-colors ${
                  isMuted 
                    ? 'bg-red-500/20 hover:bg-red-500/30' 
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {isMuted ? (
                  <MicOff size={24} className="text-red-400" />
                ) : (
                  <Mic size={24} className="text-white" />
                )}
              </button>

              {/* End Call Button */}
              <button
                onClick={endCall}
                className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
              >
                <PhoneOff size={24} className="text-white" />
              </button>

              {/* Speaker Button */}
              <button
                onClick={toggleSpeaker}
                className={`p-4 rounded-full transition-colors ${
                  !isSpeakerOn 
                    ? 'bg-yellow-500/20 hover:bg-yellow-500/30' 
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {isSpeakerOn ? (
                  <Volume2 size={24} className="text-white" />
                ) : (
                  <VolumeX size={24} className="text-yellow-400" />
                )}
              </button>
            </div>

            {/* Audio Elements */}
            <audio ref={remoteAudioRef} autoPlay />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SupportCallModal;
