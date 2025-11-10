import React, { useState, useEffect } from 'react';
import {X, AlertCircle} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '../stores/userStore';
import { useWalletStore } from '../stores/walletStore';
// import { useZotrustContract } from '../hooks/useZotrustContract';
import { APP_CONFIG } from '../config/constants';
import clsx from 'clsx';
import toast from 'react-hot-toast';
// import { ethers } from 'ethers';

interface CreateAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  type: string;
  token: string;
  priceInr: string;
  minAmountInr: string;
  maxAmountInr: string;
  sellQuantity: string;
  buyQuantity: string;
  lockDurationSeconds: number;
  selectedAgentIds: string[];
}

const CreateAdModal: React.FC<CreateAdModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, agents, fetchAgents } = useUserStore();
  const { isConnected, balance, updateBalances } = useWalletStore();
  // const { createTrade } = useZotrustContract();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    type: 'BUY',
    token: 'TBNB',
    priceInr: '',
    minAmountInr: '500', // Default min amount
    maxAmountInr: '', // Will be auto-calculated
    sellQuantity: '',
    buyQuantity: '',
    lockDurationSeconds: APP_CONFIG.DEFAULT_LOCK_DURATION_HOURS * 3600,
    selectedAgentIds: []
  });

  // Get balance for selected token
  const getTokenBalance = () => {
    if (formData.token === 'TBNB') {
      return parseFloat(balance.usdt || '0'); // Using USDT balance for TBNB display
    } else if (formData.token === 'WBNB') {
      return parseFloat(balance.wbnb || '0');
    } else if (formData.token === 'USDT') {
      return parseFloat(balance.usdt || '0');
    } else if (formData.token === 'USDC') {
      return parseFloat(balance.usdc || '0');
    } else {
      return 0;
    }
  };

  const tokenBalance = getTokenBalance();

  // Get only the user's selected agents
  const userSelectedAgents = agents.filter(agent => 
    user?.selectedAgentIds?.includes(String(agent.id))
  );

  useEffect(() => {
    if (isOpen && user?.locationId) {
      fetchAgents(user.locationId);
    }
    // Update balance when modal opens for SELL ads
    if (isOpen && isConnected) {
      updateBalances();
    }
  }, [isOpen, user?.locationId, isConnected]);

  useEffect(() => {
    if (user?.selectedAgentIds && user.selectedAgentIds.length > 0) {
      setFormData(prev => ({ ...prev, selectedAgentIds: user.selectedAgentIds || [] }));
    }
  }, [user?.selectedAgentIds]);

  // Auto-calculate max amount when quantity or price changes
  useEffect(() => {
    const quantity = formData.type === 'BUY' ? formData.buyQuantity : formData.sellQuantity;
    const price = formData.priceInr;
    
    if (quantity && price && !isNaN(parseFloat(quantity)) && !isNaN(parseFloat(price))) {
      const calculatedMax = (parseFloat(quantity) * parseFloat(price)).toFixed(2);
      setFormData(prev => ({
        ...prev,
        maxAmountInr: calculatedMax
      }));
    }
  }, [formData.buyQuantity, formData.sellQuantity, formData.priceInr, formData.type]);

  // Auto-calculate min amount when max amount or price changes
  useEffect(() => {
    const maxAmount = formData.maxAmountInr;
    const price = formData.priceInr;
    
    if (maxAmount && price && !isNaN(parseFloat(maxAmount)) && !isNaN(parseFloat(price))) {
      const calculatedMin = (parseFloat(maxAmount) / parseFloat(price)).toFixed(2);
      setFormData(prev => ({
        ...prev,
        minAmountInr: calculatedMin
      }));
    }
  }, [formData.maxAmountInr, formData.priceInr]);

  // Reset form when type changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      priceInr: '',
      minAmountInr: '500', // Reset to default
      maxAmountInr: '', // Will be auto-calculated
      sellQuantity: '',
      buyQuantity: ''
    }));
  }, [formData.type, formData.token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Wallet connection required for SELL ads to check balance
    if (formData.type === 'SELL' && !isConnected) {
      toast.error('Please connect your wallet first to check your balance');
      return;
    }

    if (!user?.verified) {
      toast.error('Please verify your profile first');
      return;
    }

    if (!formData.selectedAgentIds || formData.selectedAgentIds.length === 0) {
      toast.error('Please select at least one agent');
      return;
    }

    // Validation
    const price = parseFloat(formData.priceInr);
    
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter valid price per token');
      return;
    }

    let minTokenAmount, maxTokenAmount;

    if (formData.type === 'SELL') {
      // SELL validation
      const sellQty = parseFloat(formData.sellQuantity);
      
      if (isNaN(sellQty) || sellQty <= 0) {
        toast.error('Please enter valid sell quantity');
        return;
      }

      // Check if user has sufficient balance for SELL ads
      if (sellQty > tokenBalance) {
        toast.error(`Insufficient balance. You only have ${tokenBalance.toFixed(6)} ${formData.token}`);
        return;
      }

      const minInr = parseFloat(formData.minAmountInr);
      const maxInr = parseFloat(formData.maxAmountInr);

      if (isNaN(minInr) || minInr <= 0 || isNaN(maxInr) || maxInr <= 0) {
        toast.error('Please enter valid min and max amounts in INR');
        return;
      }

      if (minInr > maxInr) {
        toast.error('Min amount cannot be greater than max amount');
        return;
      }

      // Calculate token amounts from INR
      minTokenAmount = minInr / price;
      maxTokenAmount = maxInr / price;

      // Check if max token amount exceeds sell quantity
      if (maxTokenAmount > sellQty) {
        toast.error(`Max amount (${maxTokenAmount.toFixed(6)} ${formData.token}) cannot exceed sell quantity (${sellQty} ${formData.token})`);
        return;
      }

    } else {
      // BUY validation - No balance check needed for BUY ads
      const buyQty = parseFloat(formData.buyQuantity);
      
      if (isNaN(buyQty) || buyQty <= 0) {
        toast.error('Please enter valid buy quantity');
        return;
      }

      const minInr = parseFloat(formData.minAmountInr);
      const maxInr = parseFloat(formData.maxAmountInr);

      if (isNaN(minInr) || minInr <= 0 || isNaN(maxInr) || maxInr <= 0) {
        toast.error('Please enter valid min and max amounts in INR');
        return;
      }

      if (minInr > maxInr) {
        toast.error('Min amount cannot be greater than max amount');
        return;
      }

      minTokenAmount = minInr / price;
      maxTokenAmount = maxInr / price;

      // Check if max token amount exceeds buy quantity
      if (maxTokenAmount > buyQty) {
        toast.error(`Max amount (${maxTokenAmount.toFixed(6)} ${formData.token}) cannot exceed buy quantity (${buyQty} ${formData.token})`);
        return;
      }
    }

    // Require auth token
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast.error('Please login first');
      return;
    }

    setIsLoading(true);
    try {
      // Create ad in backend database only (no blockchain integration)
      const backendData = {
        type: formData.type,
        token: formData.token,
        price_inr: price,
        min_amount: minTokenAmount,
        max_amount: maxTokenAmount,
        sell_quantity: formData.type === 'SELL' ? parseFloat(formData.sellQuantity) : null,
        buy_quantity: formData.type === 'BUY' ? parseFloat(formData.buyQuantity) : null,
        lock_duration_seconds: formData.lockDurationSeconds,
        city: user?.locationId || 'Mumbai',
        selected_agent_ids: formData.selectedAgentIds
      };

      const response = await fetch('/api/ads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(backendData),
      });

      if (response.ok) {
        toast.success('Ad created successfully!');
        onSuccess();
        // Reset form
        setFormData({
          type: 'BUY',
          token: 'TBNB',
          priceInr: '',
          minAmountInr: '500', // Default min amount
          maxAmountInr: '', // Will be auto-calculated
          sellQuantity: '',
          buyQuantity: '',
          lockDurationSeconds: APP_CONFIG.DEFAULT_LOCK_DURATION_HOURS * 3600,
          selectedAgentIds: user?.selectedAgentIds || []
        });
      } else {
        let errorMsg = 'Failed to create ad';
        try {
          const error = await response.json();
          errorMsg = error.error || error.message || errorMsg;
        } catch {}
        toast.error(errorMsg);
      }
    } catch (error: any) {
      console.error('Ad creation error:', error);
      toast.error(error.message || 'Failed to create ad');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-900 rounded-xl overflow-scroll h-[80vh] p-6 w-full max-w-md border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Create New Ad</h3>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {!user?.verified && (
              <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg flex items-center space-x-2">
                <AlertCircle size={16} className="text-yellow-400" />
                <p className="text-yellow-300 text-sm">
                  Please verify your profile to create ads
                </p>
              </div>
            )}
       

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Buy/Sell Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['BUY', 'SELL'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleInputChange('type', type)}
                      className={clsx(
                        'py-2 px-4 rounded-lg font-medium transition-all',
                        formData.type === type
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                          : 'bg-white/10 text-gray-300 border border-white/20'
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Token Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Token
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['TBNB', 'WBNB', 'USDT', 'USDC'].map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => handleInputChange('token', token)}
                      className={clsx(
                        'py-2 px-4 rounded-lg font-medium transition-all',
                        formData.token === token
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-white/10 text-gray-300 border border-white/20'
                      )}
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>

              {/* Available Balance - Only show for SELL ads */}
              {formData.type === 'SELL' && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-purple-300 text-sm font-medium">💰 Available Balance</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-bold text-lg">{tokenBalance.toFixed(6)}</span>
                      <span className="text-purple-300">{formData.token}</span>
                      <button
                        type="button"
                        onClick={() => updateBalances()}
                        className="p-1 rounded bg-purple-500/20 hover:bg-purple-500/30 transition-colors"
                        title="Refresh balance"
                      >
                        <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SELL: Quantity to Sell */}
              {formData.type === 'SELL' && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    📦 Quantity to Sell ({formData.token})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.sellQuantity}
                      onChange={(e) => handleInputChange('sellQuantity', e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 pr-20 py-3 text-white text-lg placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      placeholder="0.02"
                      max={tokenBalance}
                      required
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <button
                        type="button"
                        onClick={() => handleInputChange('sellQuantity', tokenBalance.toString())}
                        className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Available: {tokenBalance.toFixed(6)} {formData.token}
                  </p>
                  {parseFloat(formData.sellQuantity) > tokenBalance && (
                    <p className="mt-1 text-xs text-red-400">
                      ⚠️ Insufficient balance! You only have {tokenBalance.toFixed(6)} {formData.token}
                    </p>
                  )}
                </div>
              )}

              {/* BUY: Quantity to Buy */}
              {formData.type === 'BUY' && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    🛒 Quantity to Buy ({formData.token})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.buyQuantity}
                      onChange={(e) => handleInputChange('buyQuantity', e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-white text-lg placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      placeholder="10.0"
                      required
                    />
                  </div>
                 
                </div>
              )}

              {/* Rate in INR */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  💰 Price per 1 {formData.token}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={formData.priceInr}
                    onChange={(e) => handleInputChange('priceInr', e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 pr-12 py-3 text-white text-lg placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    placeholder="95"
                    required
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-medium">
                    ₹ INR
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Example: 1 {formData.token} = ₹95 INR
                </p>
              </div>

              {/* Min and Max Amount in INR */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  🔢 Order Limits (₹ INR)
                </label>
             
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Min ₹ INR
                    
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={formData.minAmountInr}
                        onChange={(e) => handleInputChange('minAmountInr', e.target.value)}
                        placeholder="500"
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 pr-8 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        required
                      />
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs font-medium">₹</div>
                    </div>
                    {formData.priceInr && formData.minAmountInr && (
                      <p className="mt-1 text-xs text-green-400">
                        = {(parseFloat(formData.minAmountInr) / parseFloat(formData.priceInr)).toFixed(6)} {formData.token}
                      
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Max ₹ INR
                    
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={formData.maxAmountInr}
                        onChange={(e) => handleInputChange('maxAmountInr', e.target.value)}
                        placeholder="5000"
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 pr-8 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                        required
                      />
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs font-medium">₹</div>
                    </div>
                    {formData.priceInr && formData.maxAmountInr && (
                      <p className="mt-1 text-xs text-green-400">
                        = {(parseFloat(formData.maxAmountInr) / parseFloat(formData.priceInr)).toFixed(6)} {formData.token}
                      
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Warning for SELL: if max exceeds sell quantity */}
                {formData.type === 'SELL' && formData.priceInr && formData.maxAmountInr && formData.sellQuantity && (
                  (() => {
                    const maxTokens = parseFloat(formData.maxAmountInr) / parseFloat(formData.priceInr);
                    const sellQty = parseFloat(formData.sellQuantity);
                    return maxTokens > sellQty ? (
                      <p className="mt-2 text-xs text-yellow-400">
                        ⚠️ Max limit ({maxTokens.toFixed(6)} {formData.token}) exceeds your sell quantity ({sellQty.toFixed(6)} {formData.token})
                      </p>
                    ) : null;
                  })()
                )}

                {/* Warning for BUY: if max exceeds buy quantity */}
                {formData.type === 'BUY' && formData.priceInr && formData.maxAmountInr && formData.buyQuantity && (
                  (() => {
                    const maxTokens = parseFloat(formData.maxAmountInr) / parseFloat(formData.priceInr);
                    const buyQty = parseFloat(formData.buyQuantity);
                    return maxTokens > buyQty ? (
                      <p className="mt-2 text-xs text-yellow-400">
                        ⚠️ Max limit ({maxTokens.toFixed(6)} {formData.token}) exceeds your buy quantity ({buyQty.toFixed(6)} {formData.token})
                      </p>
                    ) : null;
                  })()
                )}
              </div>

              {/* Agent Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Agents (from your profile)
                </label>
                
                {userSelectedAgents.length === 0 ? (
                  <div className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-gray-400">
                    <p>No agents selected in your profile</p>
                    <p className="text-sm">Please select agents in your profile first</p>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto bg-white/10 border border-white/20 rounded-lg p-3 space-y-2">
                    {userSelectedAgents.map((agent) => (
                      <label
                        key={agent.id}
                        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formData.selectedAgentIds?.includes(String(agent.id)) || false}
                          onChange={(e) => {
                            const agentId = String(agent.id);
                            const currentIds = formData.selectedAgentIds || [];
                            
                            if (e.target.checked) {
                              handleInputChange('selectedAgentIds', [...currentIds, agentId]);
                            } else {
                              handleInputChange('selectedAgentIds', currentIds.filter(id => id !== agentId));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{agent.branchName}</p>
                          <p className="text-gray-300 text-sm truncate">{agent.locationName}</p>
                          <p className="text-gray-400 text-xs truncate">{agent.mobile}</p>
                          {agent.address && (
                            <p className="text-gray-400 text-xs truncate">{agent.address}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {agent.verified ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                              ✓ Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                              ⚠ Unverified
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                
                {/* Selected Agents Summary */}
                {formData.selectedAgentIds && formData.selectedAgentIds.length > 0 && (
                  <div className="mt-2 p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                    <p className="text-blue-300 text-sm font-medium">
                      Selected Agents ({formData.selectedAgentIds.length}):
                    </p>
                    <div className="mt-1 space-y-1">
                      {formData.selectedAgentIds.map((agentId) => {
                        const agent = userSelectedAgents.find(a => String(a.id) === agentId);
                        return agent ? (
                          <p key={agentId} className="text-blue-200 text-xs">
                            • {agent.branchName} - {agent.locationName}
                          </p>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={
                  isLoading || 
                  !user?.verified || 
                  !formData.selectedAgentIds || 
                  formData.selectedAgentIds.length === 0 ||
                  (formData.type === 'SELL' && tokenBalance === 0)
                }
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? 'Creating...' : formData.type === 'SELL' && tokenBalance === 0 ? `No ${formData.token} to Sell` : 'Create Ad'}
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreateAdModal;