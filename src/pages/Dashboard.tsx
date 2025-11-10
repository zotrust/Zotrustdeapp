
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {ArrowUpRight, ArrowDownLeft, RefreshCw, CheckCircle, Loader2, AlertCircle, X, Star, MessageSquare, Plus, VideoIcon, Phone} from 'lucide-react';
import { motion } from 'framer-motion';
import { useWalletStore } from '../stores/walletStore';
import { useUserStore } from '../stores/userStore';
import WalletSelectionModal from '../components/WalletSelectionModal';
import ReviewModal from '../components/ReviewModal';
import toast from 'react-hot-toast';

interface Review {
  id: number;
  reviewer_address: string;
  reviewee_address: string;
  reviewer_name: string;
  reviewee_name: string;
  order_id: number;
  rating: number;
  message: string;
  created_at: string;
  is_approved: boolean;
  is_visible: boolean;
}

interface ReviewStats {
  total_reviews: number;
  average_rating: string;
  rating_breakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

const Dashboard: React.FC = () => {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isRestoringWallet, setIsRestoringWallet] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showOnlyApproved, setShowOnlyApproved] = useState(false);
  const [showDemoVideo, setShowDemoVideo] = useState(false);
  
  const { 
    address, 
    isConnected, 
    balance, 
    chainId, 
    isConnecting,
    isUpdatingBalances,
    connectionError,
    connect, 
    disconnect, 
    updateBalances,
    clearError,
    switchToNetwork,
    debugWalletDetection
  } = useWalletStore();
  
  const { user, refreshUserProfile } = useUserStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if wallet is being restored
    if (isConnected && address) {
      setIsRestoringWallet(false);
      updateBalances();
      fetchReviews();
      // Refresh user profile to get latest verification status
      console.log('🔄 Dashboard: Wallet connected, refreshing user profile...');
      refreshUserProfile();
    } else {
      // Wait a bit for wallet restoration to complete
      const timer = setTimeout(() => {
        setIsRestoringWallet(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, updateBalances, refreshUserProfile]);

  const fetchReviews = async () => {
    if (!isConnected || !address) return;
    
    setIsLoadingReviews(true);
    try {
      // Fetch all reviews instead of just user-specific reviews
      const response = await fetch(`/api/reviews/all`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.data);
      }
      
      // Fetch total stats (all reviews) instead of user-specific stats
      const statsResponse = await fetch(`/api/reviews/stats/total`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setReviewStats(statsData.data);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setIsLoadingReviews(false);
    }
  };

  const handleConnectWallet = async () => {
    if (isConnected) {
      disconnect();
    } else {
      setShowWalletModal(true);
    }
  };

  const handleWalletSelect = async (walletType: 'metamask' | 'trustwallet' | 'walletconnect') => {
    try {
      await connect(walletType);
      setShowWalletModal(false);
    } catch (error) {
      console.error('Wallet connection failed:', error);
    }
  };

  const handleRefreshBalances = () => {
    if (isConnected) {
      updateBalances();
    }
  };

  const handleClearError = () => {
    clearError();
  };

  const getNetworkName = () => {
    switch (chainId) {
      case 97: return 'BSC Testnet';
      case 56: return 'BSC Mainnet';
      case 1: return 'Ethereum Mainnet';
      default: return `Network ${chainId}`;
    }
  };

  const isCorrectNetwork = () => {
    return chainId === 97 ;
  };

  // Show loading state while restoring wallet
  if (isRestoringWallet) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-300">Restoring wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-sm mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Zotrust</h1>
        {user && (
          <div className="bg-violet-500/20 backdrop-blur-lg rounded-lg p-2 border border-violet-500/30 mt-2">
            <p className="text-xs text-violet-200">
              Welcome, <span className="text-white font-medium">{user.name || 'User'}</span>
            </p>
            {user.verified && (
              <div className="flex items-center justify-center space-x-1 mt-1">
                <CheckCircle size={12} className="text-violet-400" />
                <span className="text-xs text-violet-400">Verified</span>
              </div>
            )}
          </div>
        )}
        <div className="mt-2 space-x-2">
          <Link
            to="/benefits"
            className="inline-block text-[11px] text-violet-300 hover:text-violet-200 underline underline-offset-2"
          >
            View platform benefits
          </Link>
          <span className="text-[11px] text-violet-500">•</span>
          <Link
            to="/guide"
            className="inline-block text-[11px] text-violet-300 hover:text-violet-200 underline underline-offset-2"
          >
            User guide
          </Link>
          <span className="text-[11px] text-violet-500">•</span>
          <button
            onClick={() => setShowDemoVideo(true)}
            className="inline-block text-[11px] text-violet-300 hover:text-violet-200 underline underline-offset-2"
          >
            Watch demo video
          </button>
        </div>
      </div>

      {/* Benefits Banner + Guide Link */}
      <div className="bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 rounded-xl p-4">
        <div className="flex items-start justify-between">
          <div className="pr-2">
            <h3 className="text-white font-semibold text-base">Why trade with Zotrust?</h3>
            <ul className="mt-1 text-[11px] text-violet-200 space-y-1 list-disc list-inside">
              <li>No bank freeze risk, no middlemen</li>
              <li>Smart‑contract escrow, low fees</li>
              <li>Cash ↔ USDT, global access</li>
            </ul>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <Link
              to="/benefits"
              className="px-3 py-1 rounded-lg text-xs bg-violet-600 hover:bg-violet-700 text-white transition-colors"
            >
              View Benefits
            </Link>
            <Link
              to="/guide"
              className="px-3 py-1 rounded-lg text-xs bg-white/10 hover:bg-white/20 text-violet-100 border border-white/10 transition-colors"
            >
              Read Guide
            </Link>
            <p 
              onClick={() => setShowDemoVideo(true)}
              className="px-3 py-1 rounded-lg text-center text-xs cursor-pointer bg-white/10 hover:bg-white/20 text-violet-100 border border-white/10 transition-colors"
            >
              Platform Guide Video <VideoIcon className="w-4 h-4 inline-block" />
            </p>
          </div>
        </div>
      </div>

      {/* Demo Video Modal */}
      {showDemoVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md mx-auto bg-slate-900 border border-white/10 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Platform Demo</h3>
              <button
                onClick={() => setShowDemoVideo(false)}
                className="text-gray-300 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <div className="bg-black">
              <video
                controls
                playsInline
                className="w-full h-64 bg-black"
                src="/api/videos/stream/demo"
              />
            </div>
            <div className="p-3 flex items-center justify-end gap-2">
              <a
                href="/api/videos/stream/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white"
              >
                Open in new tab
              </a>
              <button
                onClick={() => setShowDemoVideo(false)}
                className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 border border-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Status */}
      {isConnected && user && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`p-3 rounded-lg border flex items-center space-x-2 ${
            user.verified
              ? 'bg-violet-500/20 border-violet-500/30'
              : 'bg-yellow-500/20 border-yellow-500/30'
          }`}
        >
          {user.verified ? (
            <CheckCircle size={16} className="text-violet-400" />
          ) : (
            <AlertCircle size={16} className="text-yellow-400" />
          )}
          <div className="flex-1">
            <p className={`font-medium text-sm ${
              user.verified ? 'text-violet-300' : 'text-yellow-300'
            }`}>
              {user.verified ? 'Verified' : 'Not Verified'}
            </p>
            <p className={`text-xs ${
              user.verified ? 'text-violet-400' : 'text-yellow-400'
            }`}>
              {user.verified 
                ? 'Can access P2P trading'
                : 'Complete profile to trade'
              }
            </p>
          </div>
        </motion.div>
      )}

      {/* Error Display */}
      {connectionError && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-300 text-sm font-medium">Connection Error</p>
            <p className="text-red-400 text-xs">{connectionError}</p>
          </div>
          <button
            onClick={handleClearError}
            className="p-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Wallet Connection Status */}
      <div className={`backdrop-blur-lg rounded-lg p-4 border ${
        isConnected 
          ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-violet-500/30' 
          : 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-500/30'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-white">
            {isConnected ? 'Wallet Connected' : 'Connect Wallet'}
          </h2>
          {isConnected && (
            <span className={`text-xs px-2 py-1 rounded-full ${
              isCorrectNetwork() 
                ? 'bg-violet-500/20 text-violet-300' 
                : 'bg-red-500/20 text-red-300'
            }`}>
              {getNetworkName()}
              {!isCorrectNetwork() && ' (Switch to BSC)'}
            </span>
          )}
        </div>
        
        {isConnected ? (
          <div className="space-y-2">
            <p className="text-gray-300 text-sm">
              Address: {address?.slice(0, 6)}...{address?.slice(-4)}
            </p>
            {!isCorrectNetwork() && (
              <div className="space-y-2">
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-300 text-sm font-medium">⚠️ Wrong Network</p>
                  <p className="text-red-400 text-xs">
                    {chainId === 1 ? 'Connected to Ethereum Mainnet' : 
                     chainId === 56 ? 'Connected to BSC Mainnet' : 
                     `Connected to Network ${chainId}`}
                  </p>
                  <p className="text-red-400 text-xs mt-1">Please switch to BSC Testnet</p>
                </div>
                <button
                  onClick={() => switchToNetwork(97)}
                  className="w-full bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Switch to BSC Testnet
                </button>
              </div>
            )}
            <button
              onClick={handleConnectWallet}
              className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Disconnect Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-300 text-sm">
              Connect your wallet to start trading
            </p>
            <button
              onClick={handleConnectWallet}
              disabled={isConnecting}
              className="w-full bg-gradient-to-r from-violet-500 to-purple-500 text-white py-2 px-3 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  <span>Connecting...</span>
                </>
              ) : (
                <span>Connect Wallet</span>
              )}
            </button>
            
            {/* Debug button for mobile wallet issues */}
            <button
              onClick={() => {
                const debugInfo = debugWalletDetection();
                console.log('🔍 Mobile Wallet Debug Info:', debugInfo);
                toast.success('Debug info logged to console');
              }}
              className="w-full bg-gray-500/20 hover:bg-gray-500/30 text-gray-300 py-2 px-4 rounded-lg font-medium transition-colors text-sm"
            >
              🔍 Debug Wallet Detection
            </button>
          </div>
        )}
      </div>

      {/* Balance Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Balances</h3>
          <button 
            onClick={handleRefreshBalances}
            disabled={!isConnected || isUpdatingBalances}
            className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isUpdatingBalances ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-violet-500/10 backdrop-blur-lg rounded-lg p-3 border border-violet-500/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-violet-200 text-xs font-medium">TBNB</span>
              <ArrowUpRight size={14} className="text-violet-400" />
            </div>
            <p className="text-white font-bold text-lg">
              {isConnected ? `${parseFloat(balance.usdt || '0').toFixed(4)}` : '0.0000'}
            </p>
          </div>

          <div className="bg-violet-500/10 backdrop-blur-lg rounded-lg p-3 border border-violet-500/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-violet-200 text-xs font-medium">USDT</span>
              <ArrowDownLeft size={14} className="text-violet-400" />
            </div>
            <p className="text-white font-bold text-lg">
              {isConnected ? `${parseFloat(balance.usdc || '0').toFixed(4)}` : '0.0000'}
            </p>
          </div>
        </div>

        {!isConnected && (
          <div className="text-center py-1">
            <p className="text-violet-300 text-xs">Connect wallet to view balances</p>
          </div>
        )}
      </div>

 
      {/* Reviews Section */}
      {isConnected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center space-x-2">
              <Star className="w-4 h-4 text-violet-400" />
              <span>Reviews</span>
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowOnlyApproved(!showOnlyApproved)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  showOnlyApproved 
                    ? 'bg-violet-500/20 text-violet-400' 
                    : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                {showOnlyApproved ? 'Approved' : 'All'}
              </button>
              <button
                onClick={() => {
                  if (!address) {
                    toast.error('Please connect your wallet first');
                    return;
                  }
                  setShowReviewModal(true);
                }}
                className="bg-violet-600 hover:bg-violet-700 text-white px-2 py-1 rounded text-xs transition-colors flex items-center space-x-1"
              >
                <Plus size={12} />
                <span>Review</span>
              </button>
            </div>
          </div>

          {/* Review Stats */}
          {reviewStats && (
            <div className="bg-violet-500/10 backdrop-blur-lg rounded-lg p-3 border border-violet-500/20">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{reviewStats.total_reviews}</div>
                  <div className="text-xs text-violet-300">Reviews</div>
                </div>
                <div className="text-center">
                  <div className="flex justify-center items-center space-x-1 mb-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i < Math.round(parseFloat(reviewStats.average_rating)) ? 'text-yellow-400 fill-current' : 'text-gray-400'}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-violet-300">
                    {reviewStats.average_rating} avg
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reviews List */}
          <div className="max-h-64 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-violet-500/30 scrollbar-track-transparent">
            {isLoadingReviews ? (
              <div className="text-center py-3">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-violet-500" />
                <p className="text-violet-300 text-xs">Loading...</p>
              </div>
            ) : reviews.length > 0 ? (
              reviews
                .filter(review => showOnlyApproved ? review.is_approved : true)
                .map((review) => (
                <div key={review.id} className="bg-violet-500/10 backdrop-blur-lg rounded-lg p-3 border border-violet-500/20">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center space-x-1">
                      <div className="flex">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            size={12}
                            className={i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-400'}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-violet-300">
                        by {review.reviewer_name || 'Unknown'}
                      </span>
                    </div>
                    <span className="text-xs text-violet-400">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {review.message && (
                    <p className="text-xs text-violet-200">{review.message}</p>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <MessageSquare className="w-8 h-8 text-violet-400 mx-auto mb-2" />
                <p className="text-violet-300 text-sm">
                  {showOnlyApproved ? 'No approved reviews' : 'No reviews yet'}
                </p>
                <p className="text-violet-400 text-xs mt-1">
                  {showOnlyApproved 
                    ? 'Pending approval' 
                    : 'Share your experience'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Card */}
      <div className="bg-violet-500/20 border-violet-500/30 text-violet-300 p-3 rounded-lg border flex items-center space-x-2">
        <CheckCircle size={16} className="text-violet-400" />
        <div className="flex-1">
          <p className="text-xs font-medium">System: Online</p>
          <p className="text-xs opacity-80">All services operational</p>
        </div>
      </div>

      {/* Support Call Button */}
      <button
        onClick={async () => {
          // First check if wallet is connected
          if (!isConnected || !address) {
            toast.error('Please connect your wallet first', {
              duration: 3000,
              icon: '🔐'
            });
            setShowWalletModal(true);
            return;
          }

          // Check if user is verified
          if (!user || !user.verified) {
            toast.error('Please complete your profile verification first', {
              duration: 4000,
              icon: '⚠️'
            });
            navigate('/profile');
            return;
          }

          // Check microphone permission
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Permission granted, stop the stream immediately (we just needed to check)
            stream.getTracks().forEach(track => track.stop());
            
            // Check if running in wallet browser
            const userAgent = navigator.userAgent.toLowerCase();
            const isWalletBrowser = userAgent.includes('metamask') || 
                                   userAgent.includes('trustwallet') ||
                                   userAgent.includes('tokenpocket') ||
                                   userAgent.includes('coinbase') ||
                                   (window.ethereum && (window.ethereum as any).isMetaMask && userAgent.includes('mobile'));
            
            if (isWalletBrowser) {
              // If in wallet browser, try to open in Chrome
              const currentUrl = window.location.origin + `/support-call/${address}`;
              
              // Try to open in Chrome
              if (navigator.userAgent.includes('Android')) {
                // Android: Try Chrome intent
                const chromeUrl = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
                window.location.href = chromeUrl;
              } else if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
                // iOS: Show instructions
                toast.error('Please copy the link and open in Chrome/Safari browser for best call experience', {
                  duration: 5000,
                  icon: '🌐'
                });
                // Copy URL to clipboard
                navigator.clipboard.writeText(currentUrl).then(() => {
                  toast.success('Link copied to clipboard!');
                });
              } else {
                // Desktop: Open in new window (might open default browser)
                toast('Opening in browser...', { icon: '🌐' });
                window.open(currentUrl, '_blank');
              }
            } else {
              // Normal browser, navigate normally with wallet address
              navigate(`/support-call/${address}`);
            }
          } catch (error: any) {
            // Microphone permission denied or not available
            console.error('Microphone permission error:', error);
            
            // Redirect to support call page where permission will be requested
            if (address) {
              toast('Microphone permission required. Redirecting to call page...', {
                duration: 3000,
                icon: '🎤'
              });
              navigate(`/support-call/${address}`);
            } else {
              toast.error('Please connect your wallet first', {
                duration: 3000,
                icon: '🔐'
              });
              setShowWalletModal(true);
            }
          }
        }}
        className="w-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg p-4 flex items-center justify-between hover:from-green-500/30 hover:to-emerald-500/30 transition-all group"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
            <Phone size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Support Call</p>
            <p className="text-green-300 text-xs">
              {!isConnected || !address 
                ? 'Connect wallet to call' 
                : !user || !user.verified 
                ? 'Verify profile to call' 
                : 'Get help from admin'}
            </p>
          </div>
        </div>
        <ArrowUpRight size={16} className="text-green-400 group-hover:text-green-300 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
      </button>

    
      
      {/* Wallet Selection Modal */}
      <WalletSelectionModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onWalletSelect={handleWalletSelect}
      />

      {/* Review Modal */}
      {address && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onReviewSubmitted={fetchReviews}
          userAddress={address} // Connected wallet address is the reviewer
        />
      )}
    </div>
  );
};

export default Dashboard;
