import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface LocalNetworkPermissionHelperProps {
  isOpen: boolean;
  onClose: () => void;
}

const LocalNetworkPermissionHelper: React.FC<LocalNetworkPermissionHelperProps> = ({
  isOpen,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  const currentUrl = window.location.origin;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  if (!isOpen) return null;

  return (
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
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-yellow-600 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Local Network Access</h3>
            <p className="text-sm text-gray-400">Microphone permission setup</p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-6">
          <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-200 text-sm">
              <strong>Issue:</strong> Browsers require special permission for local network IP addresses to access microphone.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-white font-medium">Solution Options:</h4>
            
            <div className="space-y-2">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">1</div>
                <div>
                  <p className="text-white text-sm font-medium">Use localhost instead</p>
                  <p className="text-gray-400 text-xs">Access via: <code className="bg-slate-700 px-1 rounded">https://localhost:5000</code> (HTTPS enabled)</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">2</div>
                <div>
                  <p className="text-white text-sm font-medium">Enable microphone for this IP</p>
                  <p className="text-gray-400 text-xs">In Chrome: Settings → Privacy → Site Settings → Microphone</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">3</div>
                <div>
                  <p className="text-white text-sm font-medium">Use Chrome flags (Advanced)</p>
                  <p className="text-gray-400 text-xs">Enable: <code className="bg-slate-700 px-1 rounded">--unsafely-treat-insecure-origin-as-secure</code></p>
                </div>
              </div>
            </div>
          </div>

          {/* Current URL */}
          <div className="p-3 bg-slate-700/50 rounded-lg">
            <p className="text-gray-300 text-sm mb-2">Current URL:</p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 bg-slate-800 px-2 py-1 rounded text-xs text-gray-300 break-all">
                {currentUrl}
              </code>
              <button
                onClick={copyToClipboard}
                className="p-2 bg-slate-600 hover:bg-slate-500 rounded text-white transition-colors"
                title="Copy URL"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
          >
            Got It
          </button>
          <button
            onClick={() => {
              window.location.href = 'https://localhost:5000';
            }}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Try Localhost
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default LocalNetworkPermissionHelper;
