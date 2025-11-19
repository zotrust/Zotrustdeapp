
import React, { useState, useEffect } from 'react';
import { Plus, Phone, MessageCircleDashed as MessageCircle, Filter, RefreshCw, Loader2, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ad } from '../types';
import { useUserStore } from '../stores/userStore';
import { useWalletStore } from '../stores/walletStore';
import CreateAdModal from '../components/CreateAdModal';
import CallModal from '../components/CallModal';
import clsx from 'clsx';
import toast from 'react-hot-toast';


const P2P: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'BUY' | 'SELL'>('BUY');
  const [selectedToken, setSelectedToken] = useState<'USDT' | 'USDC'>('USDT');
  const [ads, setAds] = useState<Ad[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [callModal, setCallModal] = useState<{ isOpen: boolean; ad: Ad | null }>({
    isOpen: false,
    ad: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingAds, setIsFetchingAds] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState<string | null>(null);
  const [orderModal, setOrderModal] = useState<{ isOpen: boolean; ad: Ad | null }>({
    isOpen: false,
    ad: null
  });
  const [orderAmount, setOrderAmount] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [tradingSettings, setTradingSettings] = useState<{
    buyEnabled: boolean;
    sellEnabled: boolean;
    startTime: string;
    endTime: string;
  }>({
    buyEnabled: true,
    sellEnabled: true,
    startTime: '09:00',
    endTime: '18:00'
  });

  const { user, refreshUserProfile } = useUserStore();
  const { isConnected, address, connectionError, clearError } = useWalletStore();

  useEffect(() => {
    if (isConnected && user?.selectedAgentIds && user.selectedAgentIds.length > 0) {
      fetchAds();
    }
  }, [activeTab, selectedToken, isConnected, user?.selectedAgentIds]);



  // Refresh user profile when wallet connects to get latest verification status
  useEffect(() => {
    if (isConnected && address && user) {
      console.log('🔄 P2P: Wallet connected, refreshing user profile...');
      refreshUserProfile();
    }
  }, [isConnected, address, refreshUserProfile]);

  // Fetch trading hours from backend
  const fetchTradingHours = async () => {
    try {
      const response = await fetch('/api/admin/trading-hours');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setTradingSettings(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching trading hours:', error);
    }
  };

  // Fetch trading hours on mount
  useEffect(() => {
    fetchTradingHours();
  }, []);

  const fetchAds = async () => {
    if (isFetchingAds) {
      return;
    }
    setIsFetchingAds(true);
    setIsLoading(true);
    setFetchError(null);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        // Try to auto-login if user is connected but no token
        if (isConnected && address && window.ethereum) {
          console.log('🔄 P2P: No token but wallet connected, attempting auto-login...');
          try {
            const message = 'Sign this message to authenticate with Zotrust';
            const signature = await (window.ethereum as any).request({
              method: 'personal_sign',
              params: [message, address],
            });
            
            const { loginWithWallet } = useUserStore.getState();
            const success = await loginWithWallet(address, signature, message);
            if (success) {
              // Retry fetch with new token
              const newToken = localStorage.getItem('authToken');
              if (newToken) {
                return fetchAdsWithToken(newToken);
              }
            }
          } catch (loginError) {
            console.error('Auto-login failed:', loginError);
          }
        }
        setFetchError('Please login first');
        setAds([]);
        return;
      }

      await fetchAdsWithToken(token);
    } catch (error) {
      console.error('Failed to fetch ads:', error);
      setFetchError('Failed to load ads');
      setAds([]);
    } finally {
      setIsLoading(false);
      setIsFetchingAds(false);
    }
  };

  const fetchAdsWithToken = async (token: string) => {
    try {
      // Invert type: if I want to BUY, I need SELL ads from others; if I want to SELL, I need BUY ads
      const requestedType = activeTab === 'BUY' ? 'SELL' : 'BUY';
      const response = await fetch(
        `/api/ads?type=${requestedType}&token=${selectedToken}&limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Transform backend data to frontend format
          let transformedAds = (data.data || []).map((ad: any) => ({
            id: ad.id.toString(),
            ownerAddress: ad.owner_address,
            ownerSelectedAgentIds: ad.selected_agent_ids || [],
            owner_name: ad.owner_name || '',
            type: ad.type,
            token: ad.token,
            priceInr: ad.price_inr.toString(),
            minAmount: ad.min_amount.toString(),
            maxAmount: ad.max_amount.toString(),
            sellQuantity: ad.sell_quantity ? ad.sell_quantity.toString() : null,
            buyQuantity: ad.buy_quantity ? ad.buy_quantity.toString() : null,
            lockDurationSeconds: ad.lock_duration_seconds,
            city: ad.city,
            active: ad.active,
            createdAt: ad.created_at,
            // Use the first agent as primary for backward compatibility
            agent: ad.agents && ad.agents.length > 0 ? {
              id: ad.agents[0].id.toString(),
              branchName: ad.agents[0].branch_name,
              city: ad.agents[0].city || ad.city || 'Mumbai',
              address: ad.agents[0].address || '',
              mobile: ad.agents[0].mobile || '',
              verified: ad.agents[0].verified || true,
              createdByAdmin: '1',
              createdAt: new Date().toISOString()
            } : undefined,
            // Include all agents
            agents: ad.agents ? ad.agents.map((agent: any) => ({
              id: agent.id.toString(),
              branchName: agent.branch_name,
              city: agent.city,
              address: agent.address || '',
              mobile: agent.mobile || '',
              verified: agent.verified || true,
              createdByAdmin: '1',
              createdAt: new Date().toISOString()
            })) : []
          }));
          
          // Filter ads based on:
          // 1. Hide own ads
          // 2. Only show ads with common agents (backend already filters, but add safety check)
          // 3. Only show ads with available quantity > 0
          if (address) {
            transformedAds = transformedAds.filter((ad: any) => {
              // Filter 1: Hide own ads
              if (ad.ownerAddress.toLowerCase() === address.toLowerCase()) {
                return false;
              }
              
              // Filter 2: Backend already filters by common agent branch names
              // Frontend just ensures user has agents selected (basic validation)
              if (!user?.selectedAgentIds || user.selectedAgentIds.length === 0) {
                return false;
              }
              
              // Filter 3: Check available quantity
              if (ad.type === 'SELL') {
                // For SELL ads, check sell_quantity
                if (ad.sellQuantity !== null && parseFloat(ad.sellQuantity) <= 0) {
                  return false;
                }
              } else if (ad.type === 'BUY') {
                // For BUY ads, check buy_quantity
                if (ad.buyQuantity !== null && parseFloat(ad.buyQuantity) <= 0) {
                  return false;
                }
              }
              
              return true;
            });
          }
          
          setAds(transformedAds);
        } else {
          setFetchError(data.error || 'Failed to load ads');
          setAds([]);
        }
      } else {
        if (response.status === 401) {
          setFetchError('Session expired. Please login again.');
        } else {
          setFetchError('Failed to load ads');
        }
        setAds([]);
      }
    } catch (error) {
      console.error('Failed to fetch ads:', error);
      setFetchError('Failed to load ads');
      setAds([]);
    }
  };

  const handleOrderCreate = async (ad: Ad, amount: string) => {
    setCreatingOrder(ad.id);
    setOrderError(null);

    // Check if trading type is enabled
    if (ad.type === 'BUY' && !tradingSettings.sellEnabled) {
      setOrderError('SELL trading is currently disabled. Please try again later.');
      setCreatingOrder(null);
      return;
    }
    if (ad.type === 'SELL' && !tradingSettings.buyEnabled) {
      setOrderError('BUY trading is currently disabled. Please try again later.');
      setCreatingOrder(null);
      return;
    }


    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setOrderError('Please login first');
        return;
      }

      // Get user's timezone for display purposes
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Calcutta';
      
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ad_id: ad.id,
          amount: parseFloat(amount),
          selected_agent_id: selectedAgentId,
          timezone: timezone  // User's timezone for display
          // start_time is auto-generated on backend using server UTC time
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('Order created successfully');
          // Refresh ads to show updated status
          fetchAds();
        } else {
          setOrderError(data.error || 'Failed to create order');
        }
      } else {
        const errorData = await response.json();
        setOrderError(errorData.error || 'Failed to create order');
      }
    } catch (error) {
      console.error('Order creation error:', error);
      setOrderError('Failed to create order');
    } finally {
      setCreatingOrder(null);
    }
  };

  const handleCall = (ad: Ad) => {
    setCallModal({ isOpen: true, ad });
  };

  const handleOrderClick = (ad: Ad) => {
    const buttonInfo = getOrderButtonInfo(ad);
    if (!buttonInfo.disabled) {
      setOrderModal({ isOpen: true, ad });
      setOrderAmount('');
      // Set default selected agent (first agent or primary agent)
      if (ad.agents && ad.agents.length > 0) {
        setSelectedAgentId(ad.agents[0].id);
      } else if (ad.agent) {
        setSelectedAgentId(ad.agent.id);
      } else {
        setSelectedAgentId('');
      }
    }
  };

  const handleOrderSubmit = () => {
    if (!orderModal.ad) return;
    
    const numAmount = parseFloat(orderAmount);
    const minAmount = parseFloat(orderModal.ad.minAmount);
    const maxAmount = parseFloat(orderModal.ad.maxAmount);
    
    if (isNaN(numAmount)) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (numAmount < minAmount || numAmount > maxAmount) {
      toast.error(`Quantity must be between ${minAmount.toFixed(2)} and ${maxAmount.toFixed(2)} ${orderModal.ad.token}`);
      return;
    }
    
    handleOrderCreate(orderModal.ad, orderAmount);
    setOrderModal({ isOpen: false, ad: null });
    setOrderAmount('');
  };

  // Helper function to determine button text and behavior
  const getOrderButtonInfo = (ad: Ad) => {
    const isOwner = address?.toLowerCase() === ad.ownerAddress.toLowerCase();

    if (isOwner) {
      return {
        text: 'Your Ad',
        disabled: true,
        className: 'bg-gray-500/20 text-gray-400 cursor-not-allowed',
        action: null
      };
    }

    if (ad.type === 'BUY') {
      return {
        text: 'Sell',
        disabled: false,
        className: 'bg-gradient-to-r from-pink-500 to-red-500 text-white hover:from-red-600 hover:to-pink-600',
        action: 'sell'
      };
    } else {
      return {
        text: 'Buy',
        disabled: false,
        className: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600',
        action: 'buy'
      };
    }
  };

  const isVerified = Boolean(user?.verified);
  const hasAgent = Boolean(user?.selectedAgentIds && user.selectedAgentIds.length > 0);
  const canCreateAds = isVerified && hasAgent;
  const showEmptyState = !hasAgent || !isVerified;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold text-white">P2P Trading</h2>
        <p className="text-gray-300 text-xs sm:text-sm">BNB Smart Chain</p>
      </div>

      {/* Trading Status Notice */}
      {(!tradingSettings.buyEnabled || !tradingSettings.sellEnabled) && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3"
        >
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-300 text-sm font-medium">Trading Disabled</p>
            <p className="text-red-400 text-xs">
              {!tradingSettings.buyEnabled && !tradingSettings.sellEnabled 
                ? 'Both BUY and SELL trading are currently disabled.'
                : !tradingSettings.buyEnabled 
                  ? 'BUY trading is currently disabled.'
                  : 'SELL trading is currently disabled.'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Error Displays */}
      {connectionError && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3"
        >
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-300 text-sm font-medium">Connection Error</p>
            <p className="text-red-400 text-xs">{connectionError}</p>
          </div>
          <button
            onClick={clearError}
            className="p-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}

      {fetchError && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3"
        >
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-300 text-sm font-medium">Load Error</p>
            <p className="text-red-400 text-xs">{fetchError}</p>
          </div>
          <button
            onClick={() => setFetchError(null)}
            className="p-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}

      {orderError && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3"
        >
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-300 text-sm font-medium">Order Error</p>
            <p className="text-red-400 text-xs">{orderError}</p>
          </div>
          <button
            onClick={() => setOrderError(null)}
            className="p-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}

      {/* Buy/Sell Toggle */}
      <div className="bg-white/10 backdrop-blur-lg rounded-lg p-1 border border-white/20">
        <div className="grid grid-cols-2 gap-1">
          {(['BUY', 'SELL'] as const).map((tab) => (
            <motion.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'py-2 px-3 sm:py-3 sm:px-4 rounded-md font-medium transition-all text-sm sm:text-base',
                activeTab === tab
                  ? tab === 'BUY'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                    : 'bg-gradient-to-r from-red-500 to-pink-500 text-white'
                  : tab === 'BUY'
                    ? 'text-green-300 hover:text-green-200 hover:bg-green-500/10'
                    : 'text-red-300 hover:text-red-200 hover:bg-red-500/10'
              )}
              whileTap={{ scale: 0.98 }}
            >
              {tab}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Token Selection */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex space-x-1 sm:space-x-2">
          {(['USDT', 'USDC'] as const).map((token) => (
            <motion.button
              key={token}
              onClick={() => setSelectedToken(token)}
              className={clsx(
                'px-3 py-1.5 sm:px-4 sm:py-2 rounded-md font-medium transition-all text-sm',
                selectedToken === token
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/10 text-gray-300 border border-white/10'
              )}
              whileTap={{ scale: 0.95 }}
            >
              {token}
            </motion.button>
          ))}
        </div>

        <div className="flex items-center space-x-1 sm:space-x-2">
          <motion.button
            onClick={fetchAds}
            disabled={isLoading}
            className="p-1.5 sm:p-2 rounded-md bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
            whileTap={{ scale: 0.95 }}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin sm:w-4 sm:h-4" /> : <RefreshCw size={14} className="sm:w-4 sm:h-4" />}
          </motion.button>

          {canCreateAds && (
            <motion.button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md flex items-center space-x-1.5 sm:space-x-2"
              whileTap={{ scale: 0.95 }}
            >
              <Plus size={14} className="sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm font-medium">Create Ad</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {showEmptyState && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 space-y-4"
        >
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto">
            <Filter size={32} className="text-yellow-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">Profile Verification Required</h3>
            <p className="text-gray-300 text-sm max-w-xs mx-auto">
              Profile verify karein aur ek agent select karein — tabhi aapko local P2P ads dikhengi.
            </p>
          </div>
          <motion.button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2 px-6 rounded-lg"
            whileTap={{ scale: 0.98 }}
          >
            Complete Profile
          </motion.button>
        </motion.div>
      )}

      {/* Ads List */}
      {!showEmptyState && (
        <div className="space-y-4">
          <AnimatePresence>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white/10 rounded-xl p-4 animate-pulse">
                    <div className="h-4 bg-white/20 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-white/20 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : ads.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 text-gray-400"
              >
                <p>No {activeTab.toLowerCase()} ads available for {selectedToken}</p>
              </motion.div>
            ) : (
              ads.map((ad) => {
                const agentCity = ad.agents?.[0]?.city || ad.agent?.city || ad.city;
                const ownerName = ad.owner_name || '';
                // If buyQuantity/sellQuantity is available, use it; otherwise fallback to maxAmount
                const quantity = ad.type === 'BUY' 
                  ? (ad.buyQuantity || ad.maxAmount)
                  : (ad.sellQuantity || ad.maxAmount);
                
                return (
                  <motion.div
                    key={ad.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-white/5 backdrop-blur-lg rounded-lg p-3 border border-white/10 hover:border-white/20 transition-all"
                  >
                    {/* Compact Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                          {ownerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium text-xs">{ownerName}</p>

                        </div>
                      </div>
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold',
                        ad.type === 'BUY'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-red-500/20 text-red-300'
                      )}>
                        {ad.type}
                      </span>
                    </div>

                    {/* Price & Quantity Row */}
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="flex items-baseline space-x-1">
                          <span className="text-xl font-bold text-white">₹{parseFloat(ad.priceInr).toFixed(2)}</span>
                          <span className="text-xs text-gray-400">/{ad.token}</span>
                        </div>
                      </div>
                      <div className="bg-blue-500/10 px-2 py-1 rounded">
                        <p className="text-blue-300 text-[10px] font-medium">Qty: {parseFloat(quantity).toFixed(2)} {ad.token}</p>
                      </div>
                    </div>

                    {/* Compact Info Row */}
                    <div className="flex items-center justify-between text-[10px] mb-2 bg-white/5 rounded p-1.5">
                      <span className="text-gray-300">
                        Limit: ₹{(parseFloat(ad.minAmount) * parseFloat(ad.priceInr)).toLocaleString('en-IN', { maximumFractionDigits: 0 })} - ₹{(parseFloat(ad.maxAmount) * parseFloat(ad.priceInr)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-gray-400">
                        ⏱ {Math.floor(ad.lockDurationSeconds / 1800)}h
                      </span>
                    </div>

                    <div className="grid grid-cols-1 ">
                      <div className="flex items-center justify-between ">
                        <div className="text-gray-300 text-xs font-bold">Aagnya Branch  <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-[10px] font-bold">
                            {ad.agents?.length || 1}{(ad.agents?.length || 1) > 1 ? '' : ''}
                          </span></div>
                        <div className="flex items-center space-x-2">
                        
                          <div className={clsx(
                            'border rounded px-2 py-1',
                            ad.type === 'BUY' 
                              ? 'bg-red-500/10 border-red-500/20' 
                              : 'bg-green-500/10 border-green-500/20'
                          )}>
                            <span className={clsx(
                              'text-[10px] font-medium',
                              ad.type === 'BUY' ? 'text-red-300' : 'text-green-300'
                            )}>
                              {ad.type === 'BUY' ? 'Platform Fee' : 'Platform Fee'}
                            </span>
                            <span className={clsx(
                              'text-xs font-bold ml-2',
                              ad.type === 'BUY' ? 'text-red-400' : 'text-green-400'
                            )}>
                              {ad.type === 'BUY' ? '1.0%' : '0.8%'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2 ">
                          <span className="text-gray-400 text-[11px] font-extrabold">📍 {agentCity}</span>
                        </div>
                        <div className="text-gray-500 text-[10px]">
                          {ad.agents?.length || 1} location{(ad.agents?.length || 1) > 1 ? 's' : ''} available
                        </div>
                      </div>
                    </div>
                   

                    <div className="flex space-x-1.5">
                      {(() => {
                        const buttonInfo = getOrderButtonInfo(ad);
                        const isCreating = creatingOrder === ad.id;

                        // When ad.type === 'BUY', user is SELLING to the buyer, so check sellEnabled
                        // When ad.type === 'SELL', user is BUYING from the seller, so check buyEnabled
                        const isTradingDisabled = (ad.type === 'BUY' && !tradingSettings.sellEnabled) || 
                                                  (ad.type === 'SELL' && !tradingSettings.buyEnabled);
                        const isDisabled = buttonInfo.disabled || isCreating || isTradingDisabled;
                        
                        // Debug logging
                        if (process.env.NODE_ENV === 'development') {
                          console.log('Button State:', {
                            adId: ad.id,
                            adType: ad.type,
                            buttonText: buttonInfo.text,
                            sellEnabled: tradingSettings.sellEnabled,
                            buyEnabled: tradingSettings.buyEnabled,
                            isTradingDisabled,
                            buttonInfoDisabled: buttonInfo.disabled,
                            isCreating,
                            isDisabled
                          });
                        }
                        
                        return (
                          <motion.button
                            onClick={() => handleOrderClick(ad)}
                            disabled={isDisabled}
                            className={clsx(
                              'flex-1 py-2 px-3 rounded-lg font-semibold transition-all flex items-center justify-center space-x-1 text-xs',
                              buttonInfo.className,
                              isDisabled && 'opacity-50 cursor-not-allowed'
                            )}
                            whileTap={{ scale: isDisabled ? 1 : 0.95 }}
                            title={
                              isTradingDisabled 
                                ? `${ad.type === 'BUY' ? 'SELL' : 'BUY'} trading is currently disabled`
                                : undefined
                            }
                          >
                            {isCreating ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Creating...</span>
                              </>
                            ) : (
                              <span>{buttonInfo.text}</span>
                            )}
                          </motion.button>
                        );
                      })()}

                      <motion.button
                        onClick={() => handleCall(ad)}
                        className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
                        whileTap={{ scale: 0.95 }}
                      >
                        <MessageCircle size={16} />
                      </motion.button>
                    </div>
                  </motion.div>
                )
              })
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Create Ad Modal */}
      <CreateAdModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          fetchAds();
        }}
      />

      {/* Call Modal */}
      <CallModal
        isOpen={callModal.isOpen}
        ad={callModal.ad}
        onClose={() => setCallModal({ isOpen: false, ad: null })}
      />

      {/* Order Modal */}
      <AnimatePresence>
        {orderModal.isOpen && orderModal.ad && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
            onClick={() => setOrderModal({ isOpen: false, ad: null })}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={clsx(
                'bg-slate-900 rounded-lg p-4 sm:p-6 w-full max-w-md border-2 max-h-[90vh] overflow-y-auto',
                orderModal.ad.type === 'BUY'
                  ? 'border-red-500/50'
                  : 'border-green-500/50'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h3 className={clsx(
                  'text-lg sm:text-xl font-bold',
                  orderModal.ad.type === 'BUY' 
                    ? 'text-red-400' 
                    : 'text-green-400'
                )}>
                  {orderModal.ad.type === 'BUY' ? 'Sell Request' : 'Buy Request'}
                </h3>
                <button
                  onClick={() => setOrderModal({ isOpen: false, ad: null })}
                  className="p-1.5 sm:p-2 rounded-md bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={16} className="sm:w-5 sm:h-5" />
                </button>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {/* Trading Status Warning */}
                {(!tradingSettings.buyEnabled || !tradingSettings.sellEnabled) && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-md p-3">
                    <div className="flex items-center space-x-2">
                      <AlertCircle size={16} className="text-red-400" />
                      <div>
                        <p className="text-red-300 text-sm font-medium">Trading Disabled</p>
                        <p className="text-red-400 text-xs">
                          {!tradingSettings.buyEnabled && !tradingSettings.sellEnabled 
                            ? 'Both BUY and SELL trading are currently disabled.'
                            : !tradingSettings.buyEnabled 
                              ? 'BUY trading is currently disabled.'
                              : 'SELL trading is currently disabled.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ad Information */}
                <div className="bg-white/5 rounded-md p-3 space-y-1 sm:space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">₹{orderModal.ad.priceInr}</span>
                    <span className="text-gray-300 text-sm bg-white/10 px-2 py-1 rounded">{orderModal.ad.token}</span>
                  </div>
                  
                  {/* Quantity Information */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-300 text-sm font-medium">
                          {orderModal.ad.type === 'BUY' ? 'Want to Buy:' : 'Want to Sell:'}
                        </span>
                        <span className="text-blue-400 font-bold">
                          {orderModal.ad.type === 'BUY' 
                            ? `${parseFloat(orderModal.ad.buyQuantity || orderModal.ad.maxAmount).toFixed(2)} ${orderModal.ad.token}`
                            : `${parseFloat(orderModal.ad.sellQuantity || orderModal.ad.maxAmount).toFixed(2)} ${orderModal.ad.token}`
                          }
                        </span>
                      </div>
                      <p className="text-blue-200 text-xs mt-1">
                        Min: {parseFloat(orderModal.ad.minAmount).toFixed(2)} {orderModal.ad.token} | Max: {parseFloat(orderModal.ad.maxAmount).toFixed(2)} {orderModal.ad.token}
                      </p>
                    </div>
                  
                  <p className="text-gray-300 text-sm">
                    Min: ₹{(parseFloat(orderModal.ad.minAmount) * parseFloat(orderModal.ad.priceInr)).toFixed(2)} | Max: ₹{(parseFloat(orderModal.ad.maxAmount) * parseFloat(orderModal.ad.priceInr)).toFixed(2)}
                  </p>
                  <p className="text-gray-400 text-xs">
                    Lock Duration: 2 hours
                  </p>
                </div>

                {/* Agent Information - Show Selected Agent */}
                {(() => {
                  // Get the selected agent
                  let selectedAgent = null;
                  if (orderModal.ad.agents && orderModal.ad.agents.length > 1 && selectedAgentId) {
                    selectedAgent = orderModal.ad.agents.find(agent => agent.id === selectedAgentId);
                  } else if (orderModal.ad.agent) {
                    selectedAgent = orderModal.ad.agent;
                  }

                  return selectedAgent && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                        <h4 className="text-blue-300 font-medium text-sm">Selected Agent</h4>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium text-sm truncate">{selectedAgent.branchName}</span>
                          <span className="text-green-400 text-xs bg-green-500/20 px-1.5 py-0.5 rounded">
                            ✓ Verified
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400 text-xs">📍</span>
                            <span className="text-gray-300 text-xs">{selectedAgent.city}</span>
                          </div>
                          {selectedAgent.address && (
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-400 text-xs">🏢</span>
                              <span className="text-gray-300 text-xs truncate">{selectedAgent.address}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-400 text-xs">📞</span>
                            <span className="text-gray-300 text-xs">{selectedAgent.mobile}</span>
                            <button
                              onClick={() => selectedAgent?.mobile && window.open(`tel:${selectedAgent.mobile}`)}
                              className="p-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                            >
                              <Phone size={10} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Fee Calculation */}
                {orderAmount && parseFloat(orderAmount) > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3 space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                      <h4 className="text-yellow-300 font-medium text-sm">Fee Calculation</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Order Amount:</span>
                        <span className="text-white font-medium">{orderAmount} {orderModal.ad.token}</span>
                      </div>
                      {/* When ad type is BUY, I'm SELLING to them (seller pays 1% fee) */}
                      {/* When ad type is SELL, I'm BUYING from them (buyer pays 0.8% fee) */}
                      {orderModal.ad.type === 'BUY' ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-300">Platform Fee (1.0%):</span>
                            <span className="text-red-400">+{(parseFloat(orderAmount) * 0.01).toFixed(4)} {orderModal.ad.token}</span>
                          </div>
                          <div className="pt-2 border-t border-red-500/20">
                            <div className="flex justify-between">
                              <span className="text-red-300 font-medium">You need to lock:</span>
                              <span className="text-red-400 font-bold">{(parseFloat(orderAmount) * 1.01).toFixed(4)} {orderModal.ad.token}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-300">Platform Fee (0.8%):</span>
                            <span className="text-green-400">-{(parseFloat(orderAmount) * 0.008).toFixed(4)} {orderModal.ad.token}</span>
                          </div>
                          <div className="pt-2 border-t border-green-500/20">
                            <div className="flex justify-between">
                              <span className="text-green-300 font-medium">You will receive:</span>
                              <span className="text-green-400 font-bold">{(parseFloat(orderAmount) * 0.992).toFixed(4)} {orderModal.ad.token}</span>
                            </div>
                          </div>
                        </>
                      )}

                    </div>
                  </div>
                )}

                {/* Agent Selection */}
                {orderModal.ad.agents && orderModal.ad.agents.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Select Agent
                    </label>
                    <select
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                    >
                      {orderModal.ad.agents.map((agent) => (
                        <option key={agent.id} value={agent.id} className="bg-slate-800">
                          {agent.branchName} - {agent.city}
                        </option>
                      ))}
                    </select>
                    <p className="text-gray-400 text-xs mt-1">
                      Choose which agent you want to work with
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Qty ({orderModal.ad.token})
                  </label>
                  <input
                    type="number"
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(e.target.value)}
                    className={clsx(
                      'w-full border rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none text-sm',
                      orderAmount && parseFloat(orderAmount) > parseFloat(orderModal.ad.maxAmount)
                        ? 'bg-red-500/10 border-red-500/50 focus:border-red-500'
                        : 'bg-white/10 border-white/20 focus:border-blue-500'
                    )}
                    placeholder={`Enter qty between ${parseFloat(orderModal.ad.minAmount).toFixed(2)} - ${parseFloat(orderModal.ad.maxAmount).toFixed(2)} ${orderModal.ad.token}`}
                    min={orderModal.ad.minAmount}
                    max={orderModal.ad.maxAmount}
                  />
                  
                  {/* Error message for exceeding max quantity */}
                  {orderAmount && parseFloat(orderAmount) > parseFloat(orderModal.ad.maxAmount) && (
                    <p className="text-red-400 text-xs mt-1 flex items-center">
                      <span className="mr-1">⚠️</span>
                      Maximum quantity is {parseFloat(orderModal.ad.maxAmount).toFixed(2)} {orderModal.ad.token}
                    </p>
                  )}
                  
                  {/* Error message for below min quantity */}
                  {orderAmount && parseFloat(orderAmount) < parseFloat(orderModal.ad.minAmount) && parseFloat(orderAmount) > 0 && (
                    <p className="text-yellow-400 text-xs mt-1 flex items-center">
                      <span className="mr-1">⚠️</span>
                      Minimum quantity is {parseFloat(orderModal.ad.minAmount).toFixed(2)} {orderModal.ad.token}
                    </p>
                  )}
                  
                  <p className="text-gray-400 text-xs mt-1">
                    You will work with {(() => {
                      if (orderModal.ad.agents && orderModal.ad.agents.length > 1) {
                        const selectedAgent = orderModal.ad.agents.find(agent => agent.id === selectedAgentId);
                        return selectedAgent ? selectedAgent.branchName : 'selected agent';
                      }
                      return orderModal.ad.agent?.branchName || 'agent';
                    })()} agent for this {orderModal.ad.type === 'BUY' ? 'sell' : 'buy'} request
                  </p>
                </div>

                <div className="flex space-x-2">
                  <motion.button
                    onClick={() => setOrderModal({ isOpen: false, ad: null })}
                    className="flex-1 py-2 px-3 rounded-md bg-white/10 text-white hover:bg-white/20 transition-colors text-sm"
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleOrderSubmit}
                    disabled={
                      !orderAmount || 
                      creatingOrder === orderModal.ad.id ||
                      parseFloat(orderAmount) > parseFloat(orderModal.ad.maxAmount) ||
                      parseFloat(orderAmount) < parseFloat(orderModal.ad.minAmount) ||
                      (orderModal.ad.type === 'BUY' && !tradingSettings.sellEnabled) ||
                      (orderModal.ad.type === 'SELL' && !tradingSettings.buyEnabled)
                    }
                    className={clsx(
                      'flex-1 py-2 px-3 rounded-md text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm',
                      orderModal.ad.type === 'BUY'
                        ? 'bg-gradient-to-r from-red-500 to-pink-500'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500'
                    )}
                    whileTap={{ scale: 0.98 }}
                    title={
                      (orderModal.ad.type === 'BUY' && !tradingSettings.sellEnabled)
                        ? 'SELL trading is currently disabled'
                        : (orderModal.ad.type === 'SELL' && !tradingSettings.buyEnabled)
                          ? 'BUY trading is currently disabled'
                          : undefined
                    }
                  >
                    {creatingOrder === orderModal.ad.id ? 'Creating...' : (orderModal.ad.type === 'BUY' ? 'Sell Request' : 'Buy Request')}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default P2P;
