import React, { useState } from 'react';
import { X, Smartphone, Monitor, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface WalletSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletSelect: (walletType: 'metamask' | 'trustwallet' | 'walletconnect') => void;
}

const WalletSelectionModal: React.FC<WalletSelectionModalProps> = ({
  isOpen,
  onClose,
  onWalletSelect
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Detect mobile and wallet availability
  const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const hasEthereum = !!window.ethereum;
  const isMetaMask = hasEthereum && window.ethereum?.isMetaMask;
  
  // Enhanced Trust Wallet detection
  const isTrustWallet = hasEthereum && (
    window.ethereum?.isTrust || 
    window.ethereum?.isTrustWallet ||
    (window.ethereum as any)?.isTrustWallet ||
    navigator.userAgent.includes('TrustWallet') ||
    navigator.userAgent.includes('Trust Wallet')
  );
  
  // Debug wallet detection
  console.log('🔍 Wallet Detection Debug:', {
    isMobileDevice,
    hasEthereum,
    isMetaMask,
    isTrustWallet,
    ethereum: window.ethereum,
    userAgent: navigator.userAgent
  });

  const handleWalletSelect = async (walletType: 'metamask' | 'trustwallet' | 'walletconnect') => {
    setIsConnecting(true);
    try {
      await onWalletSelect(walletType);
      onClose();
    } catch (error) {
      console.error('Wallet connection failed:', error);
      toast.error('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  // Remove duplicate mobile detection

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Connect Wallet</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 text-gray-400 hover:text-white transition-colors"
                disabled={isConnecting}
              >
                <X size={20} />
              </button>
            </div>

            {/* Wallet Options */}
            <div className="space-y-3">
              {/* Desktop Browser Wallets */}
              {!isMobileDevice && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleWalletSelect('metamask')}
                    disabled={isConnecting}
                    className="w-full p-4 bg-gradient-to-r from-orange-500/20 to-orange-600/20 border border-orange-500/30 rounded-lg text-left hover:from-orange-500/30 hover:to-orange-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                        <Monitor size={24} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">MetaMask</h3>
                        <p className="text-sm text-gray-400">Browser extension wallet</p>
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleWalletSelect('walletconnect')}
                    disabled={isConnecting}
                    className="w-full p-4 bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-lg text-left hover:from-blue-500/30 hover:to-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                        <QrCode size={24} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">WalletConnect</h3>
                        <p className="text-sm text-gray-400">Scan QR with mobile wallet</p>
                      </div>
                    </div>
                  </motion.button>
                </>
              )}

              {/* Mobile Wallets */}
              {isMobileDevice && (
                <>
                  {/* MetaMask Mobile */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleWalletSelect('metamask')}
                    disabled={isConnecting}
                    className="w-full p-4 bg-gradient-to-r from-orange-500/20 to-orange-600/20 border border-orange-500/30 rounded-lg text-left hover:from-orange-500/30 hover:to-orange-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                        <Smartphone size={24} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">MetaMask Mobile</h3>
                        <p className="text-sm text-gray-400">
                          {isMetaMask ? 'Detected - Open in MetaMask app' : 'Open in MetaMask app'}
                        </p>
                      </div>
                    </div>
                  </motion.button>

                  {/* Trust Wallet Mobile - Use WalletConnect */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleWalletSelect('walletconnect')}
                    disabled={isConnecting}
                    className="w-full p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-lg text-left hover:from-blue-500/30 hover:to-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                        <QrCode size={24} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Trust Wallet</h3>
                        <p className="text-sm text-gray-400">
                          Connect via WalletConnect (Universal)
                        </p>
                      </div>
                    </div>
                  </motion.button>
                </>
              )}

              {/* Universal WalletConnect Option */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleWalletSelect('walletconnect')}
                disabled={isConnecting}
                className="w-full p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg text-left hover:from-purple-500/30 hover:to-pink-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <QrCode size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Other Wallets</h3>
                    <p className="text-sm text-gray-400">
                      {isMobileDevice ? 'Connect with any other wallet' : 'Trust Wallet, Rainbow, Coinbase & more'}
                    </p>
                  </div>
                </div>
              </motion.button>
            </div>

            {/* Loading State */}
            {isConnecting && (
              <div className="mt-6 text-center">
                <div className="inline-flex items-center space-x-2 text-blue-400">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Connecting wallet...</span>
                </div>
              </div>
            )}

            {/* Help Text */}
            <div className="mt-6 p-3 bg-slate-800 rounded-lg">
        <p className="text-xs text-gray-400 text-center">
          {isMobileDevice
            ? "MetaMask या Trust Wallet app install करें, फिर connect करें"
            : "Desktop पर MetaMask extension install करें या mobile wallet से QR scan करें"
          }
        </p>
        
        {/* Debug info for mobile wallet issues */}
        {isMobileDevice && (
          <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-3 mt-4">
            <p className="text-xs text-gray-400 mb-2">🔍 Debug Info:</p>
            <div className="text-xs text-gray-500 space-y-1">
              <p>Mobile: {isMobileDevice ? 'Yes' : 'No'}</p>
              <p>Ethereum: {hasEthereum ? 'Detected' : 'Not detected'}</p>
              <p>MetaMask: {isMetaMask ? 'Yes' : 'No'}</p>
              <p>Trust Wallet: {isTrustWallet ? 'Yes' : 'No'}</p>
              <p>User Agent: {navigator.userAgent.slice(0, 50)}...</p>
            </div>
          </div>
        )}
              <p className="text-xs text-blue-400 text-center mt-2">
                📱 Connection modal will open - approve in your wallet app
              </p>
              <p className="text-xs text-yellow-400 text-center mt-1">
                🌐 Only BNB Smart Chain (BSC) network supported
              </p>
              <p className="text-xs text-gray-500 text-center mt-1">
                ⏱️ Connection may take up to 60 seconds
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WalletSelectionModal;
