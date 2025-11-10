import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, AlertCircle, CheckCircle } from 'lucide-react';
import { permissionService } from '../services/permissionService';
import LocalNetworkPermissionHelper from './LocalNetworkPermissionHelper';

interface MicrophonePermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted: () => void;
  onPermissionDenied: () => void;
}

const MicrophonePermissionModal: React.FC<MicrophonePermissionModalProps> = ({
  isOpen,
  onClose,
  onPermissionGranted,
  onPermissionDenied
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLocalNetworkHelper, setShowLocalNetworkHelper] = useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    setError(null);

    try {
      console.log('🎤 Requesting microphone permission...');
      
      // First check current permission status
      const currentStatus = await permissionService.checkMicrophonePermission();
      console.log('🎤 Current microphone permission status:', currentStatus);

      if (currentStatus.granted) {
        console.log('✅ Microphone permission already granted');
        onPermissionGranted();
        return;
      }

      if (currentStatus.denied) {
        setError('Microphone permission was previously denied. Please enable it in your browser settings.');
        onPermissionDenied();
        return;
      }

      // Request permission
      const result = await permissionService.requestMicrophonePermission();
      console.log('🎤 Permission request result:', result);

      if (result.granted) {
        console.log('✅ Microphone permission granted');
        onPermissionGranted();
      } else {
        // Check if it's a local network access issue
        const hostname = window.location.hostname;
        const isLocalNetwork = hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.');
        
        if (isLocalNetwork && result.error?.includes('permission')) {
          setShowLocalNetworkHelper(true);
          return;
        }
        
        setError(result.error || 'Failed to get microphone permission');
        onPermissionDenied();
      }

    } catch (error: any) {
      console.error('❌ Microphone permission error:', error);
      setError(error.message || 'Failed to request microphone permission');
      onPermissionDenied();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSkip = () => {
    console.log('⏭️ User skipped microphone permission');
    onPermissionDenied();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4 border border-white/20"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Microphone Access Required</h3>
                <p className="text-sm text-gray-400">For voice calls</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-medium">Why do we need microphone access?</p>
                <p className="text-gray-300 text-sm mt-1">
                  To enable voice calls between traders, we need access to your microphone. 
                  This allows you to communicate directly with other users during P2P transactions.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-medium">Your privacy is protected</p>
                <p className="text-gray-300 text-sm mt-1">
                  • Audio is only transmitted during active calls<br/>
                  • No recording or storage of conversations<br/>
                  • You can revoke permission anytime in browser settings
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start space-x-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-400 font-medium">Permission Error</p>
                  <p className="text-red-300 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={handleSkip}
              className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
              disabled={isRequesting}
            >
              Listen Only
            </button>
            <button
              onClick={handleRequestPermission}
              disabled={isRequesting}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              {isRequesting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Requesting...</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Allow Microphone</span>
                </>
              )}
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
            <p className="text-xs text-gray-400 text-center">
              💡 <strong>Listen Only:</strong> You can join the call without microphone to hear the other person
            </p>
            <p className="text-xs text-gray-400 text-center mt-1">
              🎤 <strong>Full Access:</strong> Allow microphone to speak and listen
            </p>
            {window.location.hostname !== 'localhost' && !window.location.protocol.includes('https') && (
              <p className="text-xs text-yellow-400 text-center mt-2">
                ⚠️ <strong>Local Network:</strong> For local network access, you may need to enable microphone permissions in your browser settings for this IP address
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Local Network Permission Helper */}
      <LocalNetworkPermissionHelper
        isOpen={showLocalNetworkHelper}
        onClose={() => setShowLocalNetworkHelper(false)}
      />
    </AnimatePresence>
  );
};

export default MicrophonePermissionModal;
