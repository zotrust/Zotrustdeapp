
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {ArrowUpRight, ArrowDownLeft, RefreshCw, CheckCircle, Loader2, AlertCircle, X, Star, MessageSquare, Plus, VideoIcon, Phone, FileText} from 'lucide-react';
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
  const [showSupportCallModal, setShowSupportCallModal] = useState<{isOpen: boolean, supportUrl: string}>({isOpen: false, supportUrl: ''});
  
  // Refs to prevent infinite loops
  const hasFetchedReviewsRef = useRef(false);
  const lastAddressRef = useRef<string | null>(null);
  
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
    debugWalletDetection,
    connectMetaMask,
    connectTrustWallet
  } = useWalletStore();
  
  const { user, refreshUserProfile } = useUserStore();
  const navigate = useNavigate();

  // Define fetchReviews before using it in useEffect
  const fetchReviews = React.useCallback(async () => {
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
  }, [isConnected, address]);

  // Separate effect for wallet connection and balance updates
  useEffect(() => {
    if (isConnected && address) {
      setIsRestoringWallet(false);
      
      // Only update balances if address changed
      const currentAddress = lastAddressRef.current;
      if (currentAddress !== address && !isUpdatingBalances) {
        const balanceTimer = setTimeout(() => {
          console.log('🔄 Dashboard: Fetching balances for connected wallet...');
          updateBalances();
        }, 500);
        lastAddressRef.current = address;
        return () => clearTimeout(balanceTimer);
      }
    } else {
      const timer = setTimeout(() => {
        setIsRestoringWallet(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, address, isUpdatingBalances, updateBalances]);

  // Separate effect for user profile refresh (only when address changes)
  useEffect(() => {
    if (isConnected && address) {
      const currentAddress = lastAddressRef.current;
      if (currentAddress !== address) {
        console.log('🔄 Dashboard: Wallet connected, refreshing user profile...');
        refreshUserProfile();
      }
    }
  }, [isConnected, address, refreshUserProfile]);

  // Separate effect for fetching reviews (only when address changes or first load)
  useEffect(() => {
    if (isConnected && address) {
      const currentAddress = lastAddressRef.current;
      // Only fetch if address changed or we haven't fetched yet
      if (currentAddress !== address || !hasFetchedReviewsRef.current) {
        hasFetchedReviewsRef.current = true;
        lastAddressRef.current = address;
        fetchReviews();
      }
    } else {
      // Reset when disconnected
      hasFetchedReviewsRef.current = false;
      lastAddressRef.current = null;
    }
  }, [isConnected, address, fetchReviews]);

  const handleConnectWallet = async () => {
    if (isConnected) {
      disconnect();
    } else {
      // Auto-detect and connect to available wallet
      if ((window as any).ethereum) {
        const isMetaMask = (window as any).ethereum.isMetaMask;
        const isTrustWallet = (window as any).ethereum.isTrust || 
                             (window as any).ethereum.isTrustWallet;
        
        try {
          if (isTrustWallet) {
            await handleConnectTrustWallet();
          } else if (isMetaMask) {
            await handleConnectMetaMask();
          } else {
            // Default to MetaMask if available
            await handleConnectMetaMask();
          }
        } catch (error) {
          console.error('Auto-connect failed:', error);
          // Fallback to modal if auto-connect fails
          setShowWalletModal(true);
        }
      } else {
        // No wallet detected, show modal
        setShowWalletModal(true);
      }
    }
  };

  // Connect Trust Wallet directly
  const handleConnectTrustWallet = async () => {
    try {
      await connectTrustWallet();
      if (chainId !== 56) {
        await switchToNetwork(56);
      }
      toast.success('Trust Wallet connected successfully!');
    } catch (error: any) {
      console.error('Trust Wallet connection error:', error);
      toast.error(error.message || 'Failed to connect Trust Wallet');
    }
  };

  // Connect MetaMask directly
  const handleConnectMetaMask = async () => {
    try {
      await connectMetaMask();
      if (chainId !== 56) {
        await switchToNetwork(56);
      }
      toast.success('MetaMask connected successfully!');
    } catch (error: any) {
      console.error('MetaMask connection error:', error);
      toast.error(error.message || 'Failed to connect MetaMask');
    }
  };

  const handleWalletSelect = async (walletType: 'metamask' | 'trustwallet' | 'walletconnect') => {
    try {
      if (walletType === 'metamask') {
        await handleConnectMetaMask();
      } else if (walletType === 'trustwallet') {
        await handleConnectTrustWallet();
      } else {
        await connect(walletType);
      }
      setShowWalletModal(false);
    } catch (error) {
      console.error('Wallet connection failed:', error);
    }
  };

  const handleRefreshBalances = () => {
    if (isConnected) {
      // Show toast only on manual refresh
      updateBalances(true);
    }
  };

  const handleClearError = () => {
    clearError();
  };

  const getNetworkName = () => {
    switch (chainId) {
      case 56: return 'BSC Mainnet';
      case 1: return 'Ethereum Mainnet';
      default: return `Network ${chainId}`;
    }
  };

  const isCorrectNetwork = () => {
    return chainId === 56;
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
    <div className=" space-y-4 max-w-sm mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl mt-3 font-bold text-white">Zotrust</h1>
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
              <li>
                <span className="font-bold underline px-2 py-0.5 rounded-md ">Cash to USDT</span>
                {' '}↔{' '}
                <span className=" underline font-bold px-2 py-0.5 rounded-md">USDT to Cash</span>
                , global access
              </li>
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
              {!isCorrectNetwork() && ' (Switch to BSC Mainnet)'}
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
                  <p className="text-red-400 text-xs mt-1">Please switch to BSC Mainnet</p>
                </div>
                <button
                  onClick={() => switchToNetwork(56)}
                  className="w-full bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Switch to BSC Mainnet
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
            
            {/* Direct wallet connection buttons */}
            {(window as any).ethereum && (
              <div className="space-y-2">
                {((window as any).ethereum.isMetaMask || !(window as any).ethereum.isTrust) && (
                  <button
                    onClick={handleConnectMetaMask}
                    disabled={isConnecting}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-2 px-3 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span>🦊</span>
                        <span>Connect MetaMask</span>
                      </>
                    )}
                  </button>
                )}
                
                {((window as any).ethereum.isTrust || (window as any).ethereum.isTrustWallet) && (
                  <button
                    onClick={handleConnectTrustWallet}
                    disabled={isConnecting}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2 px-3 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <span>🔷</span>
                        <span>Connect Trust Wallet</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
            
            {/* Fallback: Generic connect button or modal trigger */}
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

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-violet-500/10 backdrop-blur-lg rounded-lg p-3 border border-violet-500/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-violet-200 text-xs font-medium">BNB</span>
              <ArrowUpRight size={14} className="text-violet-400" />
            </div>
            <p className="text-white font-bold text-base">
              {isConnected ? `${parseFloat((balance as any).bnb || '0').toFixed(4)}` : '0.0000'}
            </p>
          </div>

          <div className="bg-violet-500/10 backdrop-blur-lg rounded-lg p-3 border border-violet-500/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-violet-200 text-xs font-medium">USDT</span>
              <ArrowUpRight size={14} className="text-violet-400" />
            </div>
            <p className="text-white font-bold text-base">
              {isConnected ? `${parseFloat(balance.usdt || '0').toFixed(4)}` : '0.0000'}
            </p>
          </div>

          <div className="bg-violet-500/10 backdrop-blur-lg rounded-lg p-3 border border-violet-500/20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-violet-200 text-xs font-medium">USDC</span>
              <ArrowDownLeft size={14} className="text-violet-400" />
            </div>
            <p className="text-white font-bold text-base">
              {isConnected ? `${parseFloat(balance.wbnb || '0').toFixed(4)}` : '0.0000'}
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
        <div className="bg-white rounded-xl p-4 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800 flex items-center space-x-2">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <span>Reviews</span>
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowOnlyApproved(!showOnlyApproved)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showOnlyApproved 
                    ? 'bg-violet-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
                className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
              >
                <Plus size={14} />
                <span>Add Review</span>
              </button>
            </div>
          </div>

          {/* Review Stats */}
          {reviewStats && (
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg p-4 border border-violet-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800">{reviewStats.total_reviews}</div>
                  <div className="text-xs text-gray-600 font-medium">Total Reviews</div>
                </div>
                <div className="text-center">
                  <div className="flex justify-center items-center space-x-1 mb-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={16}
                        className={i < Math.round(parseFloat(reviewStats.average_rating)) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}
                      />
                    ))}
                  </div>
                  <div className="text-sm font-semibold text-gray-800">
                    {reviewStats.average_rating} / 5.0
                  </div>
                  <div className="text-xs text-gray-600">Average Rating</div>
                </div>
              </div>
            </div>
          )}

          {/* Reviews List */}
          <div className="max-h-96 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {isLoadingReviews ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-violet-600" />
                <p className="text-gray-600 text-sm">Loading reviews...</p>
              </div>
            ) : reviews.length > 0 ? (
              reviews
                .filter(review => showOnlyApproved ? review.is_approved : true)
                .filter((review, index, self) => {
                  // Remove duplicates based on reviewer_name (case-insensitive)
                  const reviewerName = (review.reviewer_name || 'Anonymous User').toLowerCase().trim();
                  return index === self.findIndex(r => 
                    (r.reviewer_name || 'Anonymous User').toLowerCase().trim() === reviewerName
                  );
                })
                .map((review) => (
                <motion.div 
                  key={review.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="flex items-center space-x-0.5">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-gray-700">
                          {review.rating}.0
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-800">
                          {review.reviewer_name || 'Anonymous User'}
                        </span>
                        {review.is_approved && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                            ✓ Verified
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                      {new Date(review.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  {review.message && (
                    <p className="text-sm text-gray-700 leading-relaxed mt-2">{review.message}</p>
                  )}
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-700 font-medium text-sm">
                  {showOnlyApproved ? 'No approved reviews yet' : 'No reviews yet'}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {showOnlyApproved 
                    ? 'Reviews are pending admin approval' 
                    : 'Be the first to share your experience!'
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
        onClick={() => {
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

          // Construct support call URL with wallet address
          const currentUrl = window.location.origin;
          const supportUrl = `${currentUrl}/support-call/${address}`;
          
          // Always show modal (no redirect)
          setShowSupportCallModal({
            isOpen: true,
            supportUrl: supportUrl
          });
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

      {/* Chat Support Button */}
      <button
        onClick={() => {
          if (!isConnected || !address) {
            toast.error('Please connect your wallet first', {
              duration: 3000,
              icon: '🔐'
            });
            setShowWalletModal(true);
            return;
          }
          navigate('/chat');
        }}
        className="w-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-lg p-4 flex items-center justify-between hover:from-blue-500/30 hover:to-cyan-500/30 transition-all group"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
            <MessageSquare size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Chat Support</p>
            <p className="text-blue-300 text-xs">
              {!isConnected || !address 
                ? 'Connect wallet to chat' 
                : 'Chat with admin support'}
            </p>
          </div>
        </div>
        <ArrowUpRight size={16} className="text-blue-400 group-hover:text-blue-300 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
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

      {/* Support Call Modal - Shows support URL with copy option */}
      {showSupportCallModal.isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowSupportCallModal({ isOpen: false, supportUrl: '' })}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl w-full max-w-md border border-white/20 text-white overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                  <Phone size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Support Call</h3>
                  <p className="text-sm text-gray-400">Copy URL to Browser</p>
                </div>
              </div>
              <button
                onClick={() => setShowSupportCallModal({ isOpen: false, supportUrl: '' })}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Message */}
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm text-blue-300 text-center">
                  Copy and paste in browser to make support call
                </p>
              </div>

              {/* URL Display - Selectable */}
              <div className="bg-white/10 rounded-lg p-4 border border-white/10">
                <p className="text-sm text-gray-400 mb-2">Support Call URL</p>
                <p 
                  id="support-url-display"
                  className="text-sm font-mono text-white break-all bg-black/20 p-3 rounded border border-white/10 select-all cursor-text"
                  style={{ userSelect: 'all', WebkitUserSelect: 'all' }}
                  onClick={(e) => {
                    // Select all text when clicked
                    const range = document.createRange();
                    range.selectNodeContents(e.currentTarget);
                    const selection = window.getSelection();
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                  }}
                >
                  {showSupportCallModal.supportUrl}
                </p>
                <p className="text-xs text-gray-400 mt-2">Tap to select, then copy manually</p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Copy Button with Fallback */}
                <motion.button
                  onClick={async () => {
                    try {
                      // Try modern clipboard API first
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(showSupportCallModal.supportUrl);
                        toast.success('URL copied to clipboard! Copy and paste in browser.');
                      } else {
                        // Fallback: Select text manually
                        const urlElement = document.getElementById('support-url-display');
                        if (urlElement) {
                          const range = document.createRange();
                          range.selectNodeContents(urlElement);
                          const selection = window.getSelection();
                          selection?.removeAllRanges();
                          selection?.addRange(range);
                          toast('URL selected! Long press to copy', { 
                            icon: '📋',
                            duration: 3000
                          });
                        }
                      }
                    } catch (error) {
                      console.error('Failed to copy:', error);
                      // Fallback: Select text manually
                      const urlElement = document.getElementById('support-url-display');
                      if (urlElement) {
                        const range = document.createRange();
                        range.selectNodeContents(urlElement);
                        const selection = window.getSelection();
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                        toast('URL selected! Long press to copy', { 
                          icon: '📋',
                          duration: 4000
                        });
                      } else {
                        toast.error('Please manually select and copy the URL');
                      }
                    }
                  }}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white py-4 px-6 rounded-lg font-semibold text-lg flex items-center justify-center space-x-3 transition-all shadow-lg"
                  whileTap={{ scale: 0.98 }}
                >
                  <FileText size={24} />
                  <span>Copy URL</span>
                </motion.button>

                {/* Select All Button for Manual Copy */}
                <motion.button
                  onClick={() => {
                    const urlElement = document.getElementById('support-url-display');
                    if (urlElement) {
                      const range = document.createRange();
                      range.selectNodeContents(urlElement);
                      const selection = window.getSelection();
                      selection?.removeAllRanges();
                      selection?.addRange(range);
                      toast('URL selected! Long press to copy', { 
                        icon: '📋',
                        duration: 3000
                      });
                    }
                  }}
                  className="w-full bg-white/10 hover:bg-white/20 text-white py-4 px-6 rounded-lg font-medium flex items-center justify-center space-x-3 transition-all border border-white/20"
                  whileTap={{ scale: 0.98 }}
                >
                  <span>Select URL (Manual Copy)</span>
                </motion.button>

                {/* Open in Browser Button */}
                <motion.a
                  href={showSupportCallModal.supportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-white/10 hover:bg-white/20 text-white py-4 px-6 rounded-lg font-medium flex items-center justify-center space-x-3 transition-all border border-white/20"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    // Try to open in new tab
                    window.open(showSupportCallModal.supportUrl, '_blank');
                  }}
                >
                  <span>Open in Browser</span>
                </motion.a>
              </div>

              {/* Instructions */}
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 space-y-2">
                <p className="text-sm text-yellow-300 text-center">
                  💡 Copy the URL and paste it in your browser to make a support call
                </p>
                <p className="text-xs text-yellow-400 text-center">
                  If copy fails, tap the URL above to select it, then long press to copy
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Dashboard;
