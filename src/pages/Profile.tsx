import React, { useState, useEffect } from 'react';
import {User, MapPin, Phone, CheckCircle, AlertCircle, Wallet, Loader2, X} from 'lucide-react';
import { motion } from 'framer-motion';
import { useUserStore } from '../stores/userStore';
import { useWalletStore } from '../stores/walletStore';
import { ProfileData } from '../types';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const Profile: React.FC = () => {
  const { user, agents, locations, isLoading, updateProfile, fetchAgents, fetchLocations, fetchUserProfile, loginWithWallet, refreshUserProfile } = useUserStore();
  const { address, isConnected, connect, connectionError, clearError, chainId, switchToNetwork, connectMetaMask, connectTrustWallet } = useWalletStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [formData, setFormData] = useState<ProfileData>({
    name: '',
    phone: '',
    locationId: '',
    selectedAgentIds: [] // Changed to support multiple agents
  });

  // Ensure wallet auto-connects on mount and load profile after connect
  useEffect(() => {
    if (!isConnected) {
      connect();
    } else if (address) {
      fetchUserProfile(address);
    }
  }, [address, isConnected, fetchUserProfile, connect]);

  // Auto-generate token when user is verified but no token exists
  useEffect(() => {
    if (user && user.verified && !localStorage.getItem('authToken') && address) {
      console.log('🔄 Profile: User verified but no token, generating token...');
      handleWalletLogin();
    }
  }, [user, address]);

  // Refresh user profile when wallet connects to get latest verification status
  useEffect(() => {
    if (isConnected && address && user) {
      console.log('🔄 Profile: Wallet connected, refreshing user profile...');
      refreshUserProfile();
    }
  }, [isConnected, address, refreshUserProfile]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        locationId: user.locationId || '',
        selectedAgentIds: user.selectedAgentIds || [] // Changed to support multiple agents
      });
    }
  }, [user]);

  // Fetch locations on mount
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Fetch agents when location changes
  useEffect(() => {
    if (formData.locationId) {
      fetchAgents(formData.locationId);
    } else {
      fetchAgents(); // Fetch all agents if no location selected
    }
  }, [formData.locationId, fetchAgents]);

  const handleInputChange = (field: keyof ProfileData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Connect Trust Wallet directly
  const handleConnectTrustWallet = async () => {
    try {
      setIsConnecting(true);
      await connectTrustWallet();
      
      // Ensure BSC Mainnet
      if (chainId !== 56) {
        await switchToNetwork(56);
      }
      
      // Auto-authenticate after connection
      if (address) {
        await handleWalletLogin();
      } else {
        toast.success('Trust Wallet connected successfully!');
      }
    } catch (error: any) {
      console.error('Trust Wallet connection error:', error);
      toast.error(error.message || 'Failed to connect Trust Wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect MetaMask directly
  const handleConnectMetaMask = async () => {
    try {
      setIsConnecting(true);
      await connectMetaMask();
      
      // Ensure BSC Mainnet
      if (chainId !== 56) {
        await switchToNetwork(56);
      }
      
      // Auto-authenticate after connection
      if (address) {
        await handleWalletLogin();
      } else {
        toast.success('MetaMask connected successfully!');
      }
    } catch (error: any) {
      console.error('MetaMask connection error:', error);
      toast.error(error.message || 'Failed to connect MetaMask');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleWalletLogin = async () => {
    if (!address) return;

    setIsConnecting(true);
    try {
      // Generate a message for the user to sign
      const message = `Sign this message to authenticate with Zotrust P2P Platform.\n\nWallet: ${address}\nTimestamp: ${Date.now()}`;
      
      // Request signature from wallet
      const signature = await (window as any).ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      });

      const success = await loginWithWallet(address, signature, message);
      if (success) {
        toast.success('Wallet connected and authenticated successfully');
        await fetchUserProfile(address);
      } else {
        toast.error('Failed to authenticate wallet');
      }
    } catch (error: any) {
      console.error('Wallet login error:', error);
      if (error.code === 4001) {
        toast.error('User rejected the signature request');
      } else {
        toast.error('Failed to connect wallet');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!formData.name.trim() || !formData.phone.trim() || !formData.locationId || formData.selectedAgentIds.length === 0) {
      setSaveError('Please fill in all required fields and select at least one agent');
      return;
    }

    try {
    setSaveError(null);
    const success = await updateProfile(formData);
    if (success) {
        toast.success('Profile updated successfully');
      setIsEditing(false);
    } else {
        setSaveError('Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setSaveError('Failed to update profile');
    }
  };

  const selectedAgents = agents.filter(agent => formData.selectedAgentIds?.includes(String(agent.id)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-3">
      <div className="max-w-sm mx-auto space-y-4">
      {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center"
        >
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          <p className="text-violet-300 text-sm">Manage your account</p>
        </motion.div>

        {/* Connection Error */}
        {connectionError && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 flex items-center space-x-2"
          >
            <AlertCircle size={16} className="text-red-400" />
            <div className="flex-1">
              <p className="text-red-300 font-medium text-sm">Connection Error</p>
              <p className="text-red-400 text-xs">{connectionError}</p>
          </div>
          <button
              onClick={clearError}
              className="p-1 rounded bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
          >
              <X size={14} />
          </button>
        </motion.div>
      )}

        {/* Wallet Connection */}
        {!isConnected && (
        <motion.div
            initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
            className="bg-violet-500/10 backdrop-blur-lg rounded-lg p-4 border border-violet-500/20"
          >
            <div className="text-center space-y-3">
              <Wallet size={32} className="text-violet-400 mx-auto" />
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Connect Wallet</h3>
                <p className="text-violet-300 text-sm mb-3">
                  Connect to access P2P trading
                </p>
          </div>
          
          {/* Direct wallet connection buttons */}
          <div className="space-y-2">
            {(window as any).ethereum && (
              <>
                {((window as any).ethereum.isMetaMask || !(window as any).ethereum.isTrust) && (
                  <button
                    onClick={handleConnectMetaMask}
                    disabled={isConnecting}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
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
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
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
              </>
            )}
            
            {/* Fallback: Generic connect button */}
            <button
              onClick={handleWalletLogin}
              disabled={isConnecting}
              className="w-full bg-gradient-to-r from-violet-500 to-purple-500 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm"
            >
              {isConnecting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Wallet size={16} />
                  <span>Connect Wallet</span>
                </>
              )}
            </button>
          </div>
            </div>
        </motion.div>
      )}

        {/* Profile Content */}
        {isConnected && (
          <>
      {/* Verification Status */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={clsx(
          'p-3 rounded-lg border flex items-center space-x-2',
          user?.verified
            ? 'bg-violet-500/20 border-violet-500/30'
            : 'bg-yellow-500/20 border-yellow-500/30'
        )}
      >
        {user?.verified ? (
          <CheckCircle size={16} className="text-violet-400" />
        ) : (
          <AlertCircle size={16} className="text-yellow-400" />
        )}
        <div className="flex-1">
          <p className={clsx(
            'font-medium text-sm',
            user?.verified ? 'text-violet-300' : 'text-yellow-300'
          )}>
            {user?.verified ? 'Verified' : 'Not Verified'}
          </p>
          <p className={clsx(
            'text-xs',
            user?.verified ? 'text-violet-400' : 'text-yellow-400'
          )}>
            {user?.verified 
              ? 'Can access P2P trading'
              : 'Complete profile to trade'
            }
          </p>
        </div>
      </motion.div>

      {/* Wallet Connection */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-violet-500/10 backdrop-blur-lg rounded-lg p-3 border border-violet-500/20"
      >
        <div className="flex items-center space-x-2">
          <User size={16} className="text-violet-400" />
            <div>
            <p className="text-violet-300 text-xs">Wallet Address</p>
            <p className="text-white font-mono text-xs">
              {address ? `${address.slice(0, 6)}...${address.slice(-6)}` : 'Not connected'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Profile Form */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-violet-500/10 backdrop-blur-lg rounded-lg p-4 border border-violet-500/20"
        >
              <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-violet-300 mb-1">
                    Full Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={!isEditing}
                    className="w-full bg-white/10 border border-violet-500/20 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50"
                    placeholder="Enter your full name"
                    required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-violet-300 mb-1">
                    Phone Number *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              disabled={!isEditing}
                    className="w-full bg-white/10 border border-violet-500/20 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50"
              placeholder="Enter your phone number"
                    required
            />
          </div>

                {/* Location */}
          <div>
            <label className="block text-xs font-medium text-violet-300 mb-1">
                    Location *
            </label>
            <select
                    value={formData.locationId}
                    onChange={(e) => handleInputChange('locationId', e.target.value)}
              disabled={!isEditing}
              className="w-full bg-white/10 border border-violet-500/20 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50"
              required
            >
                    <option value="" className="bg-slate-800">Select location</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id} className="bg-slate-800">
                        {location.name}
                </option>
              ))}
            </select>
          </div>

                {/* Agent Selection - Multiple Selection with Checkboxes */}
          <div>
            <label className="block text-xs font-medium text-violet-300 mb-1">
                    Select Agents * (Multiple)
            </label>
                  
                  {!formData.locationId ? (
                    <div className="w-full bg-white/10 border border-violet-500/20 rounded px-2 py-1.5 text-violet-300 text-sm">
                      <p>Select location first</p>
                    </div>
                  ) : agents.length === 0 ? (
                    <div className="w-full bg-white/10 border border-violet-500/20 rounded px-2 py-1.5 text-violet-300 text-sm">
                      <p>No agents available</p>
                    </div>
                  ) : (
                    <div className="max-h-32 overflow-y-auto bg-white/10 border border-violet-500/20 rounded p-2 space-y-1">
                      {agents.map((agent) => (
                        <label
                          key={agent.id}
                          className="flex items-center space-x-2 p-1.5 rounded hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={formData.selectedAgentIds?.includes(String(agent.id)) || false}
                            onChange={(e) => {
                              const agentId = String(agent.id);
                              const currentIds = formData.selectedAgentIds || [];
                              
                              if (e.target.checked) {
                                // Add agent to selection
                                handleInputChange('selectedAgentIds', [...currentIds, agentId]);
                              } else {
                                // Remove agent from selection
                                handleInputChange('selectedAgentIds', currentIds.filter(id => id !== agentId));
                              }
                            }}
                            disabled={!isEditing}
                            className="w-3 h-3 text-violet-600 bg-white/10 border-violet-500/20 rounded focus:ring-violet-500 focus:ring-1 disabled:opacity-50"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium text-sm truncate">{agent.branchName}</p>
                            <p className="text-violet-300 text-xs truncate">{agent.locationName}</p>
                            <p className="text-violet-400 text-xs truncate">{agent.mobile}</p>
                          </div>
                          <div className="flex-shrink-0">
                            {agent.verified ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                                ✓
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
                                ⚠
                              </span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  
                  {/* Selected Agents Summary */}
                  {formData.selectedAgentIds && formData.selectedAgentIds.length > 0 && (
                    <div className="mt-2 p-2 bg-violet-500/20 border border-violet-500/30 rounded">
                      <p className="text-violet-300 text-xs font-medium">
                        Selected ({formData.selectedAgentIds.length}):
                      </p>
                      <div className="mt-1 space-y-0.5">
                        {selectedAgents.map((agent) => (
                          <p key={agent.id} className="text-violet-200 text-xs">
                            • {agent.branchName}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex space-x-2 pt-3">
                    <button
                      onClick={handleSaveProfile}
                disabled={isLoading}
                      className="flex-1 bg-gradient-to-r from-violet-500 to-purple-500 text-white py-2 px-3 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1 text-sm"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>Save</span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setSaveError(null);
                        // Reset form data to user data
                        if (user) {
                          setFormData({
                            name: user.name || '',
                            phone: user.phone || '',
                            locationId: user.locationId || '',
                            selectedAgentIds: user.selectedAgentIds || []
                          });
                        }
                      }}
                      className="px-3 py-2 border border-violet-500/20 text-white rounded hover:bg-white/10 transition-colors text-sm"
              >
                Cancel
                    </button>
            </div>
                )}

                {!isEditing && (
                  <button
                    onClick={() => setShowEditWarning(true)}
                    className="w-full bg-gradient-to-r from-violet-500 to-purple-500 text-white py-2 px-3 rounded font-medium text-sm"
                  >
                    Edit Profile
                  </button>
                )}

                {/* Error Message */}
                {saveError && (
                  <div className="p-2 bg-red-500/20 border border-red-500/30 rounded flex items-center space-x-2">
                    <AlertCircle size={14} className="text-red-400" />
                    <p className="text-red-300 text-xs">{saveError}</p>
            </div>
                )}
          </div>
        </motion.div>

            {/* Selected Agents Display */}
            {selectedAgents.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
                className="bg-violet-500/10 backdrop-blur-lg rounded-lg p-3 border border-violet-500/20"
              >
                <h3 className="text-base font-bold text-white mb-2 flex items-center space-x-1">
                  <MapPin size={16} className="text-violet-400" />
                  <span>Selected Agents</span>
                </h3>
              <div className="space-y-2">
                  {selectedAgents.map((agent) => (
                    <div key={agent.id} className="p-2 bg-white/5 rounded border border-white/10">
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <p className="text-white font-medium text-sm">{agent.branchName}</p>
                  <div className="flex items-center space-x-1">
                            <MapPin size={12} className="text-violet-400" />
                            <span className="text-violet-300 text-xs">{agent.locationName}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                            <Phone size={12} className="text-violet-400" />
                            <span className="text-violet-300 text-xs">{agent.mobile}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {agent.verified ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                              ✓
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
                              ⚠
                            </span>
                          )}
                        </div>
                      </div>
                  </div>
                  ))}
                </div>
        </motion.div>
      )}
          </>
        )}

        {/* Edit Profile Warning Popover */}
        {showEditWarning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3"
            onClick={() => setShowEditWarning(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-orange-500 to-red-500 rounded-lg p-4 w-full max-w-sm border border-white/20 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle size={24} className="text-white" />
                </div>
                
                <div>
                  <h3 className="text-lg font-bold mb-1">⚠️ Important Notice</h3>
                  <p className="text-white/90 text-sm mb-3">
                    Please fill all information correctly and accurately.
                  </p>
                  <div className="bg-white/20 rounded p-3 space-y-1">
                    <p className="text-white font-semibold text-xs">📋 Important:</p>
                    <p className="text-xs text-white/90">
                      • Name and mobile number must be correct
                    </p>
                    <p className="text-xs text-white/90">
                      • Aagnya Branch may verify your information
                    </p>
                    <p className="text-xs text-white/90">
                      • All other information should also be accurate
                    </p>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <motion.button
                    onClick={() => setShowEditWarning(false)}
                    className="flex-1 bg-white/20 hover:bg-white/30 text-white py-2 px-3 rounded font-medium transition-colors text-sm"
                    whileTap={{ scale: 0.95 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      setShowEditWarning(false);
                      setIsEditing(true);
                    }}
                    className="flex-1 bg-white text-orange-600 py-2 px-3 rounded font-medium hover:bg-white/90 transition-colors text-sm"
                    whileTap={{ scale: 0.95 }}
                  >
                    Continue
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Profile;