import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ad } from '../types';
import { signalingService } from '../services/signalingService';
import { webrtcService } from '../services/webrtcService';
import MicrophonePermissionModal from './MicrophonePermissionModal';
import toast from 'react-hot-toast';

interface IncomingCallModalProps {
  isOpen: boolean;
  callerAddress: string;
  callerName?: string;
  ad?: Ad;
  callId: string;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  isOpen,
  callerAddress,
  callerName,
  ad,
  callId,
  onAccept,
  onReject,
  onClose
}) => {
  const [isAnswering, setIsAnswering] = useState(false);
  const [callTimer, setCallTimer] = useState(30); // 30 seconds to answer
  const [showMicrophoneModal, setShowMicrophoneModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false); // Track connection state

  useEffect(() => {
    if (isOpen && callTimer > 0) {
      const timer = setInterval(() => {
        setCallTimer(prev => {
          if (prev <= 1) {
            // Auto-reject after timeout
            handleReject();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isOpen, callTimer]);

  const handleAccept = async () => {
    setIsAnswering(true);
    try {
      console.log('📞 IncomingCallModal: Accepting call with callId:', callId);
      
      // Immediately call onAccept() - parent (AdminLayout) will handle call acceptance
      // This closes IncomingCallModal and opens CallModal
      onAccept();
      
    } catch (error: any) {
      console.error('Failed to accept call:', error);
      const errorMessage = error?.message || 'Failed to accept call';
      
      // Check if it's a microphone permission error
      if (errorMessage.includes('Microphone permission required')) {
        console.log('🎤 Microphone permission required for answering call, showing permission modal');
        setShowMicrophoneModal(true);
        setIsAnswering(false);
        return;
      }
      
      toast.error(errorMessage);
      onReject();
    } finally {
      setIsAnswering(false);
    }
  };

  const handleReject = async () => {
    try {
      // Update call status to ended
      const token = localStorage.getItem('authToken');
      if (token) {
        await fetch(`/api/calls/${callId}/end`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      }
      
      onReject();
      toast('Call rejected', { icon: '📞' });
    } catch (error) {
      console.error('Failed to reject call:', error);
      onReject();
    }
  };

  // Microphone permission handlers
  const handleMicrophonePermissionGranted = () => {
    console.log('🎤 Microphone permission granted, retrying call acceptance');
    setShowMicrophoneModal(false);
    // Retry the call acceptance
    handleAccept();
  };

  const handleMicrophonePermissionDenied = () => {
    console.log('🎤 Microphone permission denied, rejecting call');
    setShowMicrophoneModal(false);
    toast.error('Microphone permission is required for voice calls');
    onReject();
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="incoming-call-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-container bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden"
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 sm:p-8 w-full max-w-sm mx-4 border border-white/20 text-center shadow-2xl relative"
            style={{
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            {/* Incoming Call Header */}
            <div className="mb-6">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <User size={40} className="text-white" />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2">
                Incoming Call
              </h3>
              
              <div className="space-y-1">
                <p className="text-gray-300 font-medium">
                  {callerName || formatAddress(callerAddress)}
                </p>
                <p className="text-gray-400 text-sm">
                  {formatAddress(callerAddress)}
                </p>
                {ad && (
                  <p className="text-blue-400 text-sm">
                    About: {ad.type} {ad.token} Ad
                  </p>
                )}
              </div>
            </div>

            {/* Call Timer */}
            <div className="mb-6">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
                <span className="text-red-400 text-sm font-medium">
                  {callTimer}s remaining
                </span>
              </div>
            </div>

            {/* Call Action Buttons or Connecting State */}
            {isConnecting ? (
              // Show connecting state - modal stays open
              <div className="flex flex-col items-center justify-center gap-4 py-4">
                <div className="animate-pulse">
                  <div className="w-20 h-20 sm:w-16 sm:h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                    <Phone size={40} className="text-green-400 sm:w-8 sm:h-8" />
                  </div>
                </div>
                <p className="text-green-400 text-base font-medium">Connecting...</p>
                <p className="text-gray-400 text-xs text-center max-w-xs">
                  Please wait while we establish the connection
                </p>
              </div>
            ) : (
            <div className="flex items-center justify-center space-x-8 sm:space-x-6">
              {/* Reject Button */}
              <motion.button
                onClick={handleReject}
                disabled={isAnswering}
                className="p-5 sm:p-4 rounded-full bg-red-500 text-white shadow-lg disabled:opacity-50 min-w-[64px] min-h-[64px] sm:min-w-[56px] sm:min-h-[56px] flex items-center justify-center"
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                title="Reject call"
                style={{ touchAction: 'manipulation' }}
              >
                <PhoneOff size={28} className="sm:w-6 sm:h-6" />
              </motion.button>

              {/* Accept Button */}
              <motion.button
                onClick={handleAccept}
                disabled={isAnswering}
                className="p-5 sm:p-4 rounded-full bg-green-500 text-white shadow-lg disabled:opacity-50 relative min-w-[64px] min-h-[64px] sm:min-w-[56px] sm:min-h-[56px] flex items-center justify-center"
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                title="Accept call"
                style={{ touchAction: 'manipulation' }}
              >
                {isAnswering ? (
                  <div className="animate-spin rounded-full h-7 w-7 sm:h-6 sm:w-6 border-2 border-white border-t-transparent" />
                ) : (
                  <Phone size={28} className="sm:w-6 sm:h-6" />
                )}
              </motion.button>
            </div>
            )}

            {/* Call Info */}
            {ad && (
              <div className="mt-6 p-4 bg-white/10 rounded-lg border border-white/20">
                <h4 className="text-white text-sm font-medium mb-2">Ad Details</h4>
                <div className="space-y-1 text-xs text-gray-300">
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <span className={ad.type === 'BUY' ? 'text-green-400' : 'text-red-400'}>
                      {ad.type}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Token:</span>
                    <span className="text-blue-400">{ad.token}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price:</span>
                    <span className="text-yellow-400">₹{ad.priceInr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Range:</span>
                    <span className="text-gray-300">
                      {ad.minAmount} - {ad.maxAmount} {ad.token}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Pulsing Animation */}
            <div className="absolute inset-0 rounded-2xl border-2 border-blue-500/30 animate-ping pointer-events-none"></div>
          </motion.div>
        </motion.div>
      )}

      {/* Microphone Permission Modal */}
      <MicrophonePermissionModal
        key="microphone-permission-modal"
        isOpen={showMicrophoneModal}
        onClose={() => setShowMicrophoneModal(false)}
        onPermissionGranted={handleMicrophonePermissionGranted}
        onPermissionDenied={handleMicrophonePermissionDenied}
      />
    </AnimatePresence>
  );
};

export default IncomingCallModal;
