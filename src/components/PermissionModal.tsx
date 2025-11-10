import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, AlertCircle, CheckCircle, Settings, X } from 'lucide-react';
import { permissionService, PermissionStatus } from '../services/permissionService';
import toast from 'react-hot-toast';

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted: () => void;
  title?: string;
  description?: string;
}

const PermissionModal: React.FC<PermissionModalProps> = ({
  isOpen,
  onClose,
  onPermissionGranted,
  title = "Microphone Permission Required",
  description = "This app needs access to your microphone to make voice calls."
}) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    setPermissionStatus(null);

    try {
      const status = await permissionService.requestMicrophonePermission();
      setPermissionStatus(status);

      if (status.granted) {
        toast.success('Microphone permission granted!');
        onPermissionGranted();
        onClose();
      } else {
        toast.error(permissionService.getPermissionErrorMessage(status));
        if (status.denied) {
          setShowInstructions(true);
        }
      }
    } catch (error) {
      console.error('Permission request error:', error);
      toast.error('Failed to request microphone permission');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleOpenSettings = () => {
    setShowInstructions(true);
  };

  const renderPermissionStatus = () => {
    if (!permissionStatus) return null;

    if (permissionStatus.granted) {
      return (
        <div className="flex items-center space-x-2 text-green-400 bg-green-400/10 p-3 rounded-lg">
          <CheckCircle size={20} />
          <span>Microphone permission granted!</span>
        </div>
      );
    }

    if (permissionStatus.denied) {
      return (
        <div className="flex items-center space-x-2 text-red-400 bg-red-400/10 p-3 rounded-lg">
          <MicOff size={20} />
          <div className="flex-1">
            <p className="font-medium">Permission Denied</p>
            <p className="text-sm text-red-300 mt-1">
              {permissionService.getPermissionErrorMessage(permissionStatus)}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2 text-yellow-400 bg-yellow-400/10 p-3 rounded-lg">
        <AlertCircle size={20} />
        <div className="flex-1">
          <p className="font-medium">Permission Required</p>
          <p className="text-sm text-yellow-300 mt-1">
            {permissionService.getPermissionErrorMessage(permissionStatus)}
          </p>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
        style={{ touchAction: 'none' }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-full bg-blue-500/20">
                <Mic className="text-blue-400" size={24} />
              </div>
              <h3 className="text-xl font-semibold text-white">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Description */}
          <p className="text-gray-300 mb-6">{description}</p>

          {/* Permission Status */}
          {renderPermissionStatus()}

          {/* Instructions */}
          {showInstructions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-4 bg-gray-700/50 rounded-lg"
            >
              <h4 className="font-medium text-white mb-2 flex items-center">
                <Settings size={16} className="mr-2" />
                How to enable microphone access:
              </h4>
              <p className="text-sm text-gray-300 leading-relaxed">
                {permissionService.getPermissionInstructions()}
              </p>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 mt-6">
            {!permissionStatus?.granted && (
              <motion.button
                onClick={handleRequestPermission}
                disabled={isRequesting}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                whileTap={{ scale: 0.98 }}
              >
                {isRequesting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>Requesting...</span>
                  </>
                ) : (
                  <>
                    <Mic size={16} />
                    <span>Allow Microphone</span>
                  </>
                )}
              </motion.button>
            )}

            {permissionStatus?.denied && (
              <motion.button
                onClick={handleOpenSettings}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                whileTap={{ scale: 0.98 }}
              >
                <Settings size={16} />
                <span>Settings</span>
              </motion.button>
            )}

            <motion.button
              onClick={onClose}
              className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
              whileTap={{ scale: 0.98 }}
            >
              {permissionStatus?.granted ? 'Close' : 'Cancel'}
            </motion.button>
          </div>

          {/* Browser Support Warning */}
          {!permissionService.isWebRTCSupported() && (
            <div className="mt-4 p-3 bg-red-400/10 border border-red-400/20 rounded-lg">
              <div className="flex items-center space-x-2 text-red-400">
                <AlertCircle size={16} />
                <span className="text-sm font-medium">Browser Not Supported</span>
              </div>
              <p className="text-sm text-red-300 mt-1">
                Your browser doesn't support voice calls. Please use Chrome, Firefox, Safari, or Edge.
              </p>
            </div>
          )}

          {/* HTTPS Warning */}
          {!permissionService.isSecureContext() && (
            <div className="mt-4 p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
              <div className="flex items-center space-x-2 text-yellow-400">
                <AlertCircle size={16} />
                <span className="text-sm font-medium">Secure Connection Required</span>
              </div>
              <p className="text-sm text-yellow-300 mt-1">
                Voice calls require HTTPS. Please use a secure connection.
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PermissionModal;
