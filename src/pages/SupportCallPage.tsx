
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Phone, AlertCircle, Loader2, X, PhoneCall, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWalletStore } from '../stores/walletStore';
import { callService } from '../services/callService';
import { ADMIN_SUPPORT_ADDRESS } from '../constants/admin';
import SupportCallModal from '../components/SupportCallModal';
import { generateRandomAddress } from '../utils/addressUtils';
import toast from 'react-hot-toast';

const SupportCallPage: React.FC = () => {
  const [isCheckingMetaMask, setIsCheckingMetaMask] = useState(true);
  const [isMetaMaskBrowser, setIsMetaMaskBrowser] = useState(false);
  const [adminAddress, setAdminAddress] = useState<string | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const navigate = useNavigate();
  const { walletAddress } = useParams<{ walletAddress?: string }>();

  const { address } = useWalletStore();

  // Use walletAddress from URL if available, otherwise use connected wallet, or generate random
  const callerAddress = walletAddress || address || generateRandomAddress();

  useEffect(() => {
    checkMetaMaskBrowser();
    fetchAdminSupportAddress();
    
    // Listen for call ended events to close modal
    const handleCallEnded = () => {
      setShowCallModal(false);
    };
    
    // Register event handler
    callService.onCallEvent('call-ended', handleCallEnded);
    
    return () => {
      // Cleanup
      callService.offCallEvent('call-ended');
    };
  }, []);

  const checkMetaMaskBrowser = () => {
    // Check if user agent contains MetaMask browser indicators
    const userAgent = navigator.userAgent.toLowerCase();
    const isMetaMaskUA = userAgent.includes('metamask') || 
                         userAgent.includes('mim') || // MetaMask mobile
                         (window.ethereum && (window.ethereum as any).isMetaMask && 
                          userAgent.includes('mobile'));
    
    setIsMetaMaskBrowser(isMetaMaskUA);
    setIsCheckingMetaMask(false);

    if (isMetaMaskUA) {
      // Show message to redirect to Chrome
      toast('Please open this page in Chrome browser for better call experience', {
        duration: 5000,
        icon: '🌐'
      });
    }
  };

  const fetchAdminSupportAddress = async () => {
    try {
      const response = await fetch('/api/admin/support-address');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.address) {
          // Use the actual address from API if available
          setAdminAddress(data.data.address);
        } else {
          // Fallback to fixed ADMIN_SUPPORT address (always works)
          console.log('📞 Using fixed ADMIN_SUPPORT address');
          setAdminAddress(ADMIN_SUPPORT_ADDRESS);
        }
      } else {
        // Fallback to fixed ADMIN_SUPPORT address if API fails
        console.log('📞 API failed, using fixed ADMIN_SUPPORT address');
        setAdminAddress(ADMIN_SUPPORT_ADDRESS);
      }
    } catch (error) {
      console.error('Error fetching admin address:', error);
      // Fallback to fixed ADMIN_SUPPORT address (no issues)
      console.log('📞 Using fixed ADMIN_SUPPORT address (fallback)');
      setAdminAddress(ADMIN_SUPPORT_ADDRESS);
    }
  };

  const handleCall = async () => {
    // callerAddress will always be available (from URL, wallet, or random)
    // SupportCallModal handles the call directly via WebRTC, no need for callService
    
    try {
      setIsCalling(true);
      setCallError(null);

      console.log('📞 Opening support call modal with address:', callerAddress);
      
      // Open SupportCallModal IMMEDIATELY - it will handle call initiation directly
      // This gives immediate feedback to user (like working pattern)
      setShowCallModal(true);
      toast.success('Connecting to admin support...');
      
      // SupportCallModal will:
      // 1. Register with socket using callerAddress
      // 2. Get microphone access
      // 3. Create peer connection
      // 4. Create and send offer to ADMIN_SUPPORT
      // 5. Handle answer and ICE candidates
      
    } catch (error: any) {
      console.error('Error opening support call:', error);
      setCallError(error.message || 'Failed to open call');
      toast.error(error.message || 'Failed to open call');
      setShowCallModal(false);
    } finally {
      setIsCalling(false);
    }
  };

  const handleOpenInChrome = () => {
    // Get current URL
    const currentUrl = window.location.href;
    
    // Try to open in Chrome
    // On Android, we can try chrome:// URL
    // On iOS, we can only show instructions
    if (navigator.userAgent.includes('Android')) {
      window.location.href = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    } else {
      // For iOS or desktop, show instructions
      toast('Please copy the URL and open it in Chrome browser', {
        duration: 5000
      });
    }
  };

  if (isCheckingMetaMask) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-violet-500" />
          <p className="text-gray-300">Checking browser...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">Support Call</h1>
          <div className="w-9"></div> {/* Spacer */}
        </div>

        {/* MetaMask Browser Warning */}
        {isMetaMaskBrowser && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mb-6"
          >
            <div className="flex items-start space-x-3">
              <AlertCircle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-yellow-300 font-medium text-sm mb-2">
                  MetaMask Browser Detected
                </p>
                <p className="text-yellow-400 text-xs mb-3">
                  For the best call experience, please open this page in Chrome browser.
                </p>
                <button
                  onClick={handleOpenInChrome}
                  className="text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Open in Chrome
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6"
        >
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <PhoneCall size={32} className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Contact Admin Support</h2>
            <p className="text-gray-300 text-sm">
              Get instant help from our admin team through voice call
            </p>
          </div>

          {/* Wallet Status */}
          {walletAddress && (
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2">
                <CheckCircle size={16} className="text-blue-400" />
                <p className="text-blue-300 text-sm">Wallet Address: {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</p>
              </div>
              <p className="text-blue-400 text-xs mt-2">
                Call will be made using wallet address from URL
              </p>
            </div>
          )}
          {!callerAddress && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2">
                <AlertCircle size={16} className="text-red-400" />
                <p className="text-red-300 text-sm">
                  {walletAddress ? 'Invalid wallet address in URL' : 'Please connect your wallet or provide wallet address in URL'}
                </p>
              </div>
              <button
                onClick={() => navigate('/')}
                className="mt-3 w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 py-2 px-4 rounded-lg font-medium transition-colors text-sm"
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {/* Error Display */}
          {callError && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2">
                <AlertCircle size={16} className="text-red-400" />
                <p className="text-red-300 text-sm">{callError}</p>
              </div>
            </div>
          )}

          {/* Call Button */}
          <button
            onClick={handleCall}
            disabled={!callerAddress || isCalling}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 disabled:opacity-50 text-white py-4 px-6 rounded-lg font-semibold transition-all flex items-center justify-center space-x-2"
          >
            {isCalling ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Phone size={20} />
                <span>Call Admin Support</span>
              </>
            )}
          </button>

          {adminAddress === null && (
            <p className="text-center text-gray-400 text-xs mt-4">
              Preparing admin support connection...
            </p>
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

      {/* Support Call Modal - Show when call is active */}
      {callerAddress && (
        <SupportCallModal
          isOpen={showCallModal}
          callerAddress={callerAddress}
          onClose={() => {
            setShowCallModal(false);
            // Call service will handle ending call
          }}
        />
      )}
    </div>
  );
};

export default SupportCallPage;

