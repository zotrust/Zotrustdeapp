import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {Clock, CheckCircle, XCircle, Phone, Plus, Edit, Trash2, AlertCircle, X, PhoneCall, Lock, FileText, Gavel} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Order, Ad } from '../types';
import { useWalletStore } from '../stores/walletStore';
import { useUserStore } from '../stores/userStore';
import { useNotificationStore } from '../stores/notificationStore';
import { APP_CONFIG } from '../config/constants';
import CallModal from '../components/CallModal';
import DisputeResolution from '../components/DisputeResolution';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import io from 'socket.io-client';
import { blockchainService } from '../services/blockchainService';
import { useNavigate, useLocation } from 'react-router-dom';
import { TOKENS, ERC20_ABI } from '../config/contracts';
import { ethers } from 'ethers';

// ─── WALLET PROVIDER DETECTION (TrustWallet / MetaMask / BNB) ────────────────
/**
 * Returns the best available Ethereum-compatible provider.
 * TrustWallet on Android/iOS injects window.trustwallet AND window.ethereum.
 * Some builds only inject window.trustwallet, so we check both.
 */
const getEthereumProvider = (): any => {
  if (typeof window === 'undefined') return null;

  // 1. TrustWallet's own namespace (highest priority on TW builds)
  if ((window as any).trustwallet) return (window as any).trustwallet;

  // 2. Standard EIP-1193 provider (MetaMask, TW injected as ethereum, etc.)
  if ((window as any).ethereum) return (window as any).ethereum;

  // 3. Legacy web3 shim
  if ((window as any).web3?.currentProvider) return (window as any).web3.currentProvider;

  return null;
};

/**
 * Attempt to get the currently connected wallet address directly from the provider,
 * without requiring a user prompt.  Falls back to eth_requestAccounts if needed.
 */
const getConnectedAddress = async (): Promise<string | null> => {
  const provider = getEthereumProvider();
  if (!provider) return null;

  try {
    // eth_accounts returns already-connected accounts without a popup
    const accounts: string[] = await provider.request({ method: 'eth_accounts' });
    if (accounts && accounts.length > 0) return accounts[0];
  } catch (_) {}

  try {
    // Try selectedAddress property (synchronous, works on most providers)
    const sel = provider.selectedAddress as string | undefined;
    if (sel) return sel;
  } catch (_) {}

  return null;
};
// ─────────────────────────────────────────────────────────────────────────────

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const [myAds, setMyAds] = useState<Ad[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'ads'>('orders');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CREATED' | 'ACCEPTED' | 'LOCKED' | 'RELEASED' | 'CANCELLED' | 'EXPIRED' | 'UNDER_DISPUTE' | 'UNDER_REVIEW' | 'APPEALED' | 'CONFIRMED' | 'REFUNDED'>('ALL');
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [serverTime, setServerTime] = useState<number>(Date.now());
  const [editForm, setEditForm] = useState({
    priceInr: '',
    minAmount: '',
    maxAmount: '',
    active: true
  });
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [adsError, setAdsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [callModal, setCallModal] = useState<{ isOpen: boolean; targetAddress: string; targetName?: string; context?: string }>({
    isOpen: false,
    targetAddress: '',
    targetName: undefined,
    context: undefined
  });
  const [isCallActive, setIsCallActive] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{
    from: string;
    offer: any;
    isOpen: boolean;
  } | null>(null);
  const [autoAcceptCalls] = useState(false);
  const [lastCallEndTime, setLastCallEndTime] = useState<number>(0);
  const [disputeData, setDisputeData] = useState<{[orderId: string]: any}>({});
  const [showDisputeModal, setShowDisputeModal] = useState<{isOpen: boolean, orderId: string}>({isOpen: false, orderId: ''});
  const [userInfoMap, setUserInfoMap] = useState<Record<string, { name?: string; mobile?: string }>>({});
  const [showFundLockedPopover, setShowFundLockedPopover] = useState<{isOpen: boolean, orderId: string}>({isOpen: false, orderId: ''});
  const [viewedLockedOrders, setViewedLockedOrders] = useState<Set<string>>(new Set());
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState<{isOpen: boolean, orderId: string}>({isOpen: false, orderId: ''});
  const [showPhoneCallModal, setShowPhoneCallModal] = useState<{isOpen: boolean, phoneNumber: string, userName: string}>({isOpen: false, phoneNumber: '', userName: ''});
  const [showAppealRedirectModal, setShowAppealRedirectModal] = useState<{isOpen: boolean, appealUrl: string, orderId: string}>({isOpen: false, appealUrl: '', orderId: ''});
  const [showLockAlertModal, setShowLockAlertModal] = useState<{isOpen: boolean, orderId: string, userRole: 'buyer' | 'seller'}>({isOpen: false, orderId: '', userRole: 'buyer'});

  // ── Wallet store (may not reflect TrustWallet immediately) ──────────────────
  const { address: storeAddress, connectionError, clearError } = useWalletStore();
  const { user } = useUserStore();
  const { setUnreadOrdersCount, clearUnreadOrdersCount } = useNotificationStore();

  // ── Resolved address: prefer store, fall back to direct provider query ──────
  const [resolvedAddress, setResolvedAddress] = useState<string | undefined>(storeAddress);

  useEffect(() => {
    // Immediately sync if store already has an address
    if (storeAddress) {
      setResolvedAddress(storeAddress);
      return;
    }

    // Otherwise query the provider directly (handles TrustWallet cold-start)
    (async () => {
      const addr = await getConnectedAddress();
      if (addr) {
        console.log('🔑 Orders: Resolved address from provider directly:', addr);
        setResolvedAddress(addr);
      }
    })();
  }, [storeAddress]);

  // Also listen for accountsChanged so we stay in sync
  useEffect(() => {
    const provider = getEthereumProvider();
    if (!provider) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        console.log('🔄 Orders: accountsChanged ->', accounts[0]);
        setResolvedAddress(accounts[0]);
      } else {
        setResolvedAddress(undefined);
      }
    };

    try {
      provider.on('accountsChanged', handleAccountsChanged);
    } catch (_) {}

    return () => {
      try {
        provider.removeListener('accountsChanged', handleAccountsChanged);
      } catch (_) {}
    };
  }, []);

  // Use resolvedAddress as the effective address throughout this component
  const address = resolvedAddress;
  // ─────────────────────────────────────────────────────────────────────────────

  const fetchingUsers = useRef(new Set<string>());
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const socketRef = useRef<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentTargetRef = useRef<string | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(iceServers);
    pc.onicecandidate = (event) => {
      if (event.candidate && currentTargetRef.current) {
        socketRef.current.emit('ice-candidate', { candidate: event.candidate, to: currentTargetRef.current });
      }
    };
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        console.log('📞 Orders: Remote audio stream received');
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setIsCallActive(true);
        toast.success('Call connected!');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setIsCallActive(false);
        setIncomingCall(null);
        toast('Call ended', { icon: '📞' });
      }
    };
    return pc;
  }, []);

  const cleanupCall = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setIsCallActive(false);
    setIncomingCall(null);
    setCallModal({ isOpen: false, targetAddress: '', targetName: undefined, context: undefined });
    currentTargetRef.current = null;
    setLastCallEndTime(Date.now());
  }, [address]);

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      localStreamRef.current = stream;
      currentTargetRef.current = incomingCall.from;
      peerConnectionRef.current = createPeerConnection();
      stream.getAudioTracks().forEach(track => peerConnectionRef.current!.addTrack(track, stream));
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      socketRef.current.emit('answer', { answer, to: incomingCall.from });
      setCallModal({ isOpen: true, targetAddress: incomingCall.from, targetName: `User ${incomingCall.from.slice(0, 8)}`, context: 'Incoming Call' });
      setIncomingCall(null);
      setIsCallActive(true);
      toast.success('Call accepted!');
    } catch (error) {
      console.error('📞 Orders: Error accepting call:', error);
      toast.error('Failed to accept call');
      setIncomingCall(null);
    }
  }, [incomingCall, createPeerConnection]);

  // Socket connection setup
  useEffect(() => {
    if (!user?.address) return;
    const SOCKET_URL = process.env.NODE_ENV === 'production'
      ? window.location.origin
      : (window.location.protocol === 'https:' ? 'https://localhost:5000' : 'http://localhost:5000');
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('disconnect', () => { setIsRegistered(false); });
    socketRef.current.on('reconnect', () => {
      if (user?.address && socketRef.current) {
        socketRef.current.emit('register', user.address);
        setIsRegistered(true);
      }
    });
    socketRef.current.on('connect', () => {
      if (user?.address && socketRef.current) {
        socketRef.current.emit('register', user.address);
        setIsRegistered(true);
      }
    });

    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current && socketRef.current.connected && user?.address) {
        socketRef.current.emit('ping');
      }
    }, 30000);

    const handleOffer = async ({ offer, from }: { offer: any; from: string }) => {
      toast.success(`Incoming call from ${from.slice(0, 8)}...`);
      if (autoAcceptCalls) {
        setIncomingCall({ from, offer, isOpen: true });
        setTimeout(() => { acceptIncomingCall(); }, 1000);
      } else {
        setIncomingCall({ from, offer, isOpen: true });
      }
    };
    const handleIceCandidate = ({ candidate, from }: { candidate: any; from: string }) => {
      if (peerConnectionRef.current && candidate) {
        peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => console.error('Error adding ICE candidate:', err));
      }
    };
    const handleAnswer = async ({ answer, from }: { answer: any; from: string }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        setIsCallActive(true);
        toast.success('Call connected!');
      }
    };
    const handleCallEnded = () => { cleanupCall(); toast('Call ended', { icon: '📞' }); };
    const handleUserNotFound = () => { toast.error('User not available for calling'); cleanupCall(); };

    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('ice-candidate', handleIceCandidate);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('call-ended', handleCallEnded);
    socketRef.current.on('user-not-found', handleUserNotFound);
    socketRef.current.on('registration-confirmed', ({ userId, socketId }: any) => { setIsRegistered(true); });
    socketRef.current.on('pong', () => {});

    return () => {
      if (socketRef.current) {
        socketRef.current.off('offer', handleOffer);
        socketRef.current.off('ice-candidate', handleIceCandidate);
        socketRef.current.off('answer', handleAnswer);
        socketRef.current.off('call-ended', handleCallEnded);
        socketRef.current.off('user-not-found', handleUserNotFound);
        socketRef.current.disconnect();
      }
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [user?.address, acceptIncomingCall, cleanupCall, autoAcceptCalls]);

  const rejectIncomingCall = useCallback(() => {
    setIncomingCall(null);
    toast('Call rejected', { icon: '📞' });
  }, [incomingCall]);

  const ensureUserRegistered = useCallback(async (): Promise<boolean> => {
    if (!socketRef.current || !user?.address) return false;
    if (!socketRef.current.connected) return false;
    if (!isRegistered) {
      socketRef.current.emit('register', user.address);
      setIsRegistered(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return isRegistered;
  }, [isRegistered, user?.address]);

  const checkUserStatus = useCallback((targetAddress: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socketRef.current) { resolve(false); return; }
      const timeout = setTimeout(() => { resolve(false); }, 3000);
      socketRef.current.once('user-status', ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
        clearTimeout(timeout);
        resolve(isOnline);
      });
      socketRef.current.emit('check-user-status', targetAddress);
    });
  }, []);

  useEffect(() => {
    if (address) {
      fetchOrders();
      fetchMyAds();
    }
  }, [address]);

  useEffect(() => {
    clearUnreadOrdersCount();
  }, [clearUnreadOrdersCount]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
      setServerTime(prev => prev + 1000);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!address) return;
    const refreshTimer = setInterval(() => {
      fetchOrders();
    }, 15000);
    return () => clearInterval(refreshTimer);
  }, [address]);

  // ── Auto-login helper (TrustWallet / any EIP-1193 provider) ─────────────────
  const attemptAutoLogin = async (): Promise<string> => {
    const provider = getEthereumProvider();
    if (!provider) {
      throw new Error('No wallet provider found. Please open in TrustWallet browser.');
    }

    // Ensure we have an address first
    let walletAddr = address;
    if (!walletAddr) {
      const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) throw new Error('No accounts returned from wallet');
      walletAddr = accounts[0];
      setResolvedAddress(walletAddr);
    }

    const message = 'Sign this message to authenticate with Zotrust';
    let signature: string;

    try {
      // personal_sign is the standard method
      signature = await provider.request({
        method: 'personal_sign',
        params: [message, walletAddr],
      });
    } catch (signErr: any) {
      // Some TrustWallet versions prefer eth_sign (less safe but fallback)
      console.warn('personal_sign failed, trying eth_sign:', signErr?.message);
      signature = await provider.request({
        method: 'eth_sign',
        params: [walletAddr, ethers.hashMessage(message)],
      });
    }

    const { loginWithWallet } = useUserStore.getState();
    const success = await loginWithWallet(walletAddr, signature, message);
    if (success) {
      return localStorage.getItem('authToken') || '';
    }
    return '';
  };

  const fetchOrders = async () => {
    setIsLoading(true);
    setOrdersError(null);
    const previousOrders = orders;
    try {
      let token = localStorage.getItem('authToken') || '';
      if (!token && address) {
        try {
          token = await attemptAutoLogin();
        } catch (loginError: any) {
          console.error('❌ Orders: Auto-login failed:', loginError);
        }
      }
      const response = await fetch(`/api/orders/my-orders`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        let details = '';
        try { const errJson = await response.json(); details = errJson?.error || errJson?.message || String(response.status); } catch (_) {}
        throw new Error(details || `HTTP ${response.status}`);
      }
      const json = await response.json();
      const rows = json.data || [];

      if (json.meta?.server_time) {
        const serverTimeMs = new Date(json.meta.server_time).getTime();
        setServerTime(serverTimeMs);
      }

      const mapped: Order[] = rows.map((r: any) => ({
        id: String(r.id),
        adId: String(r.ad_id),
        adType: r.ad_type,
        buyerAddress: r.buyer_address,
        sellerAddress: r.seller_address,
        amount: Number(r.amount),
        token: r.token,
        priceInr: Number(r.price_inr ?? 0),
        state: r.state,
        agentBranch: r.agent_branch || r.branch_name || '',
        agentNumber: r.agent_number || r.agent_mobile || '',
        agentAddress: r.agent_address || '',
        createdAt: r.created_at,
        startTime: r.start_time,
        timezone: r.timezone,
        startDatetimeString: r.start_datetime_string,
        acceptedAt: r.accepted_at,
        lockExpiresAt: r.lock_expires_at,
        txHash: r.tx_hash || undefined,
        adOwnerAddress: r.ad_owner_address,
        ...(r.blockchain_trade_id ? { blockchain_trade_id: r.blockchain_trade_id } : {}),
        ...(r.buyer_name ? { buyerName: r.buyer_name } : {}),
        ...(r.seller_name ? { sellerName: r.seller_name } : {}),
      }));

      setOrders(mapped);

      const unreadOrders = mapped.filter(order => order.state === 'CREATED' || order.state === 'LOCKED');
      if (unreadOrders.length > 0) {
        setUnreadOrdersCount(unreadOrders.length);
      } else {
        clearUnreadOrdersCount();
      }

      if (previousOrders.length > 0) {
        mapped.forEach(newOrder => {
          const previousOrder = previousOrders.find(prev => prev.id === newOrder.id);
          if (previousOrder && previousOrder.state === 'ACCEPTED' && newOrder.state === 'LOCKED') {
            const isBuyer = newOrder.buyerAddress.toLowerCase() === address?.toLowerCase();
            if (isBuyer && !viewedLockedOrders.has(newOrder.id)) {
              setShowFundLockedPopover({ isOpen: true, orderId: newOrder.id });
            }
          }
          if (previousOrder && previousOrder.state === 'LOCKED' && newOrder.state !== 'LOCKED') {
            if (showFundLockedPopover.isOpen && showFundLockedPopover.orderId === newOrder.id) {
              setShowFundLockedPopover({ isOpen: false, orderId: '' });
            }
          }
        });
      }
    } catch (error: any) {
      console.error('💥 fetchOrders:', error);
      setOrdersError(`Failed to load orders${error?.message ? `: ${error.message}` : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyAds = async () => {
    setIsLoadingAds(true);
    setAdsError(null);
    try {
      let token = localStorage.getItem('authToken') || '';
      if (!token && address) {
        try { token = await attemptAutoLogin(); } catch (_) {}
      }
      const response = await fetch(`/api/ads/my-ads`, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        let details = '';
        try { const errJson = await response.json(); details = errJson?.error || errJson?.message || String(response.status); } catch (_) {}
        throw new Error(details || `HTTP ${response.status}`);
      }
      const json = await response.json();
      const rows = json.data || [];
      const mapped: Ad[] = rows.map((ad: any) => ({
        id: ad.id.toString(),
        ownerAddress: ad.owner_address,
        ownerSelectedAgentId: ad.owner_selected_agent_id?.toString(),
        type: ad.type,
        token: ad.token,
        priceInr: ad.price_inr.toString(),
        minAmount: ad.min_amount.toString(),
        maxAmount: ad.max_amount.toString(),
        lockDurationSeconds: ad.lock_duration_seconds,
        city: ad.city,
        active: ad.active,
        createdAt: ad.created_at,
        agent: ad.branch_name ? {
          id: ad.owner_selected_agent_id?.toString() || '1',
          branchName: ad.branch_name,
          city: ad.city || 'Mumbai',
          address: ad.agent_address || '',
          mobile: ad.agent_mobile || '',
          verified: true,
          createdByAdmin: '1',
          createdAt: new Date().toISOString()
        } : undefined
      }));
      setMyAds(mapped);
    } catch (error: any) {
      setAdsError(`Failed to load ads${error?.message ? `: ${error.message}` : ''}`);
    } finally {
      setIsLoadingAds(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) { toast.error('Order not found'); return; }
    const expiryData = calculateOrderExpiry(order);
    if (expiryData.isExpired) {
      toast.error(`Order expired. Max wait time is ${APP_CONFIG.ACCEPT_TIMEOUT_MINUTES} minutes.`);
      return;
    }
    try {
      const token = localStorage.getItem('authToken') || '';
      toast.loading('Accepting order...', { id: 'accept-flow' });
      const acceptResponse = await fetch(`/api/orders/${orderId}/accept-simple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (!acceptResponse.ok) {
        const errorData = await acceptResponse.json();
        toast.error(errorData.error || 'Failed to accept order', { id: 'accept-flow' });
        return;
      }
      toast.success('Order accepted! Seller will now lock funds on blockchain.', { id: 'accept-flow', duration: 4000 });
      fetchOrders();
    } catch (error) {
      toast.error('Failed to accept order', { id: 'accept-flow' });
    }
  };

  // ── Balance check using resolved provider ────────────────────────────────────
  const checkBalanceBeforeLock = async (order: Order): Promise<{ hasEnoughBalance: boolean; message: string }> => {
    try {
      const provider = getEthereumProvider();
      if (!provider || !address) {
        return { hasEnoughBalance: false, message: 'Wallet not connected. Please open this app inside TrustWallet browser.' };
      }

      const ethersProvider = new ethers.BrowserProvider(provider);
      const tokenSymbol = order?.token || 'BNB';
      const tokenConfig = ((TOKENS as any)[tokenSymbol]) || TOKENS.BNB;
      const tokenAddress = tokenConfig.address;
      const isNativeBNB = tokenConfig.isNative || false;
      const requiredAmount = order?.amount || 0;

      if (isNativeBNB) {
        const balance = await ethersProvider.getBalance(address);
        const balanceBNB = parseFloat(ethers.formatEther(balance));
        const requiredBNB = parseFloat(requiredAmount.toString());
        const gasReserve = 0.001;
        const totalRequired = requiredBNB + gasReserve;
        if (balanceBNB < totalRequired) {
          const shortfall = totalRequired - balanceBNB;
          return {
            hasEnoughBalance: false,
            message: `Insufficient BNB balance!\n\nRequired: ${totalRequired.toFixed(6)} BNB\nYour Balance: ${balanceBNB.toFixed(6)} BNB\nShortfall: ${shortfall.toFixed(6)} BNB`
          };
        }
        return { hasEnoughBalance: true, message: '' };
      } else {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, ethersProvider);
        const balance = await tokenContract.balanceOf(address);
        const decimals = await tokenContract.decimals();
        const balanceFormatted = parseFloat(ethers.formatUnits(balance, decimals));
        const requiredAmountFormatted = parseFloat(requiredAmount.toString());
        const nativeBalance = await ethersProvider.getBalance(address);
        const nativeBalanceBNB = parseFloat(ethers.formatEther(nativeBalance));
        const minGasBNB = 0.001;
        if (balanceFormatted < requiredAmountFormatted) {
          const shortfall = requiredAmountFormatted - balanceFormatted;
          return {
            hasEnoughBalance: false,
            message: `Insufficient ${tokenSymbol} balance!\n\nRequired: ${requiredAmountFormatted.toFixed(6)} ${tokenSymbol}\nYour Balance: ${balanceFormatted.toFixed(6)} ${tokenSymbol}\nShortfall: ${shortfall.toFixed(6)} ${tokenSymbol}`
          };
        }
        if (nativeBalanceBNB < minGasBNB) {
          return {
            hasEnoughBalance: false,
            message: `Insufficient BNB for gas fees!\n\nYou need at least ${minGasBNB.toFixed(6)} BNB for transaction fees.\nYour BNB Balance: ${nativeBalanceBNB.toFixed(6)} BNB`
          };
        }
        return { hasEnoughBalance: true, message: '' };
      }
    } catch (error: any) {
      return { hasEnoughBalance: false, message: `Failed to check balance: ${error.message || 'Unknown error'}` };
    }
  };

  const handleLockFunds = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) { toast.error('Order not found'); return; }
    try {
      toast.loading('Checking balance...', { id: 'lock-flow' });
      const balanceCheck = await checkBalanceBeforeLock(order);
      if (!balanceCheck.hasEnoughBalance) {
        toast.error(balanceCheck.message, { id: 'lock-flow', duration: 10000 });
        return;
      }
      toast.dismiss('lock-flow');
      const token = localStorage.getItem('authToken') || '';
      toast.loading('Preparing fund lock...', { id: 'lock-flow' });
      const prepareResponse = await fetch(`/api/orders/${orderId}/prepare-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        throw new Error(errorData.error || 'Failed to prepare lock');
      }
      const prepareData = await prepareResponse.json();
      toast.success(`OTP: ${prepareData.data.otp} - SAVE THIS!`, { id: 'lock-flow', duration: 8000, icon: '🔐' });
      const walletInstructions = blockchainService.getWalletInstructions();
      const shouldProceed = window.confirm(
        `🔐 Your OTP: ${prepareData.data.otp}\n\n⚠️ SAVE THIS OTP!\n\nYour funds will be locked for 2 hours.\n\n💡 ${walletInstructions}\n\nClick OK to lock ${order?.amount} ${order?.token} on blockchain.`
      );
      if (!shouldProceed) { toast.error('Lock cancelled', { id: 'lock-flow' }); return; }
      toast.loading('Creating trade and locking funds on blockchain...', { id: 'lock-flow' });
      const tokenSymbol = order?.token || 'BNB';
      const tokenConfig = ((TOKENS as any)[tokenSymbol]) || TOKENS.BNB;
      const tokenAddress = tokenConfig.address;
      const isNativeBNB = tokenConfig.isNative || false;
      let counterParty = '';
      if (order?.adType === 'SELL') {
        counterParty = order.buyerAddress;
      } else {
        counterParty = order.adOwnerAddress || order.buyerAddress;
      }
      let blockchainTradeId: number;
      let createTradeTxHash: string;
      let lockFundsTxHash: string;
      try {
        const result = await blockchainService.createTradeAndLockFunds(
          { token: tokenAddress, amount: order?.amount?.toString() || '0', buyer: counterParty, isNativeBNB },
          tokenAddress,
          order?.amount?.toString() || '0'
        );
        blockchainTradeId = result.tradeId;
        createTradeTxHash = result.createTradeTxHash;
        lockFundsTxHash = result.lockFundsTxHash;
        toast.success(`Trade created and funds locked! ID: ${blockchainTradeId}`, { id: 'lock-flow', duration: 5000 });
      } catch (error: any) {
        toast.error(`Failed to create trade and lock funds: ${error.message}`, { id: 'lock-flow', duration: 8000 });
        return;
      }
      const tradeIdToSend = Number(blockchainTradeId);
      if (isNaN(tradeIdToSend) || tradeIdToSend <= 0) {
        toast.error('Invalid blockchain trade ID.', { id: 'lock-flow' });
        return;
      }
      toast.loading('Finalizing...', { id: 'lock-flow' });
      const finalizeResponse = await fetch(`/api/orders/${orderId}/lock-funds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ txHash: lockFundsTxHash, otpHash: prepareData.data.otpHash, blockchainTradeId: tradeIdToSend, createTradeTxHash })
      });
      if (finalizeResponse.ok) {
        toast.success(`Funds locked!\nOTP: ${prepareData.data.otp}\nTrade ID: ${blockchainTradeId}`, { id: 'lock-flow', duration: 10000, icon: '🎉' });
        fetchOrders();
      } else {
        const errorData = await finalizeResponse.json();
        toast.error(errorData.error || 'Failed to finalize', { id: 'lock-flow' });
      }
    } catch (error) {
      toast.error('Failed to lock funds', { id: 'lock-flow' });
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    try {
      const token = localStorage.getItem('authToken') || '';
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reason: 'Rejected by seller' }),
      });
      if (response.ok) {
        toast.success('Order rejected');
        fetchOrders();
      } else {
        let msg = 'Failed to reject order';
        try { const j = await response.json(); msg = j?.error || msg; } catch (_) {}
        toast.error(msg);
      }
    } catch (error) {
      toast.error('Failed to reject order');
    }
  };

  const handleEditAd = (ad: Ad) => {
    setEditingAd(ad);
    setEditForm({ priceInr: ad.priceInr, minAmount: ad.minAmount, maxAmount: ad.maxAmount, active: ad.active });
  };

  const handleUpdateAd = async () => {
    if (!editingAd) return;
    try {
      const token = localStorage.getItem('authToken') || '';
      const response = await fetch(`/api/ads/${editingAd.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ price_inr: parseFloat(editForm.priceInr), min_amount: parseFloat(editForm.minAmount), max_amount: parseFloat(editForm.maxAmount), active: editForm.active }),
      });
      if (response.ok) {
        toast.success('Ad updated successfully');
        setEditingAd(null);
        fetchMyAds();
      } else {
        let msg = 'Failed to update ad';
        try { const j = await response.json(); msg = j?.error || msg; } catch (_) {}
        toast.error(msg);
      }
    } catch (error) {
      toast.error('Failed to update ad');
    }
  };

  const handleDeleteAd = async (adId: string) => {
    if (!confirm('Are you sure you want to delete this ad? This action cannot be undone.')) return;
    try {
      const token = localStorage.getItem('authToken') || '';
      const response = await fetch(`/api/ads/${adId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        toast.success('Ad deleted successfully');
        fetchMyAds();
      } else {
        let msg = 'Failed to delete ad';
        try { const j = await response.json(); msg = j?.error || msg; } catch (_) {}
        toast.error(msg);
      }
    } catch (error) {
      toast.error('Failed to delete ad');
    }
  };

  const fetchDisputeStatus = async (orderId: string) => {
    try {
      const token = localStorage.getItem('authToken') || '';
      const response = await fetch(`/api/disputes/${orderId}/status`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setDisputeData(prev => ({ ...prev, [orderId]: data.data }));
        return data.data;
      }
    } catch (error) { console.error('Error fetching dispute status:', error); }
    return null;
  };

  const handleConfirmPayment = async (orderId: string, type: 'SENT' | 'RECEIVED') => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) { toast.error('Order not found'); return; }
      if (order.state !== 'LOCKED' && order.state !== 'UNDER_DISPUTE' && (order.state as string) !== 'APPEALED') {
        toast.error(`Order must be LOCKED to confirm payment. Current state: ${order.state}`);
        return;
      }
      let tradeId: number | undefined = (order as any)?.blockchain_trade_id || (order as any)?.blockchainTradeId;
      if (!tradeId) {
        const status = await fetchDisputeStatus(orderId);
        tradeId = Number(status?.blockchain_trade_id || status?.blockchainTradeId);
      }
      if (!tradeId || Number.isNaN(tradeId)) {
        toast.error('Missing blockchain trade id. Please wait for the seller to lock funds.');
        return;
      }
      if (type === 'RECEIVED') {
        await blockchainService.confirmReceived(tradeId);
      }
      const token = localStorage.getItem('authToken') || '';
      const endpoint = type === 'SENT'
        ? `/api/disputes/${orderId}/confirm-payment-sent`
        : `/api/disputes/${orderId}/confirm-payment-received`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(data.data.message || 'Payment confirmation recorded');
        fetchDisputeStatus(orderId);
        fetchOrders();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to confirm payment');
      }
    } catch (error: any) {
      if (error?.message?.includes('cancelled') || error?.message?.includes('rejected') || error?.code === 'ACTION_REJECTED' || error?.code === 4001) {
        toast('Payment confirmation cancelled.', { icon: 'ℹ️', duration: 4000 });
      } else {
        toast.error(error?.reason || error?.message || 'Failed to confirm payment');
      }
    }
  };

  const handleFileAppealRedirect = (orderId: string) => {
    if (!address) { toast.error('Please connect your wallet first'); return; }
    const currentUrl = window.location.href;
    const baseUrl = currentUrl.split('/#')[0];
    const appealUrl = baseUrl.includes('/orders')
      ? `${baseUrl}/appeal/${address}/${orderId}`
      : `${baseUrl}/orders/appeal/${address}/${orderId}`;
    setShowAppealRedirectModal({ isOpen: true, appealUrl, orderId });
  };

  const handleFileAppeal = async (orderId: string, appealData: any) => {
    try {
      const token = localStorage.getItem('authToken') || '';
      const response = await fetch(`/api/disputes/${orderId}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(appealData)
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(data.data.message || 'Appeal filed successfully');
        fetchDisputeStatus(orderId);
        setShowDisputeModal({isOpen: false, orderId: ''});
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to file appeal');
      }
    } catch (error) {
      toast.error('Failed to file appeal');
    }
  };

  const openDisputeModal = (orderId: string) => {
    setShowDisputeModal({isOpen: true, orderId});
    fetchDisputeStatus(orderId);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const testTimezoneConversion = () => {
    const testUTC = '2025-10-21T23:20:52.347Z';
    const utcDate = new Date(testUTC);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(utcDate.getTime() + istOffset);
    console.log('🧪 Timezone Test:', { inputUTC: testUTC, istDate: istDate.toISOString() });
  };
  useEffect(() => { testTimezoneConversion(); }, []);

  const formatISTDateTime = (date: Date): string => {
    return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const formatDateSimple = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);
    const day = istDate.getDate();
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = monthNames[istDate.getMonth()];
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${day} ${month} ${displayHours}:${displayMinutes} ${ampm}`;
  }, []);

  const calculateOrderExpiry = useCallback((order: Order) => {
    const startTimeUTC = new Date(order.startTime);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const startTimeIST = new Date(startTimeUTC.getTime() + istOffset);
    const expiryTimeIST = new Date(startTimeIST.getTime() + (APP_CONFIG.ACCEPT_TIMEOUT_MINUTES * 60 * 1000));
    const currentTimeUTC = new Date(serverTime);
    const currentTimeIST = new Date(currentTimeUTC.getTime() + istOffset);
    const timeRemainingMs = expiryTimeIST.getTime() - currentTimeIST.getTime();
    const timeRemainingSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
    return { isExpired: timeRemainingSeconds <= 0, timeRemainingSeconds, startTimeIST: formatISTDateTime(startTimeIST), expiryTimeIST: formatISTDateTime(expiryTimeIST) };
  }, [serverTime]);

  const calculateLockExpiry = useCallback((order: Order) => {
    if (!order.lockExpiresAt) return { isExpired: false, timeRemainingSeconds: 0, timeRemainingHours: 0, timeRemainingMinutes: 0, timeRemainingSecs: 0, lockExpiresAtIST: '' };
    const lockExpiresAtUTC = new Date(order.lockExpiresAt);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const lockExpiresAtIST = new Date(lockExpiresAtUTC.getTime() + istOffset);
    const currentTimeUTC = new Date(serverTime);
    const currentTimeIST = new Date(currentTimeUTC.getTime() + istOffset);
    const timeRemainingMs = lockExpiresAtIST.getTime() - currentTimeIST.getTime();
    const timeRemainingSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
    return {
      isExpired: timeRemainingSeconds <= 0,
      timeRemainingSeconds,
      timeRemainingHours: Math.floor(timeRemainingSeconds / 3600),
      timeRemainingMinutes: Math.floor((timeRemainingSeconds % 3600) / 60),
      timeRemainingSecs: timeRemainingSeconds % 60,
      lockExpiresAtIST: formatISTDateTime(lockExpiresAtIST)
    };
  }, [serverTime]);

  const formatLockTime = useCallback((hours: number, minutes: number, seconds: number): string => {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const getOrderStatusColor = useCallback((state: Order['state']) => {
    switch (state) {
      case 'CREATED': return 'text-yellow-400 bg-yellow-500/20';
      case 'ACCEPTED': return 'text-blue-400 bg-blue-500/20';
      case 'LOCKED': return 'text-purple-400 bg-purple-500/20';
      case 'RELEASED': return 'text-green-400 bg-green-500/20';
      case 'CANCELLED': return 'text-red-400 bg-red-500/20';
      case 'EXPIRED': return 'text-gray-500 bg-gray-600/20';
      case 'UNDER_DISPUTE': return 'text-orange-400 bg-orange-500/20';
      case 'REFUNDED': return 'text-gray-400 bg-gray-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  }, []);

  const isMobileDevice = useCallback(() => {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  const fetchUserInfo = useCallback(async (addr: string) => {
    const key = addr?.toLowerCase();
    if (!key) return undefined;
    if (userInfoMap[key]) return userInfoMap[key];
    if (fetchingUsers.current.has(key)) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (userInfoMap[key]) { clearInterval(checkInterval); resolve(userInfoMap[key]); }
          else if (!fetchingUsers.current.has(key)) { clearInterval(checkInterval); resolve(undefined); }
        }, 100);
      });
    }
    fetchingUsers.current.add(key);
    try {
      const res = await fetch(`/api/auth/user-by-address?address=${addr}`);
      if (res.ok) {
        const j = await res.json();
        const info = { name: j?.data?.name, mobile: j?.data?.mobile || j?.data?.phone };
        setUserInfoMap(prev => ({ ...prev, [key]: info }));
        return info;
      }
    } catch (error) {
      console.log('Error fetching user info:', error);
    } finally {
      fetchingUsers.current.delete(key);
    }
    return undefined;
  }, [userInfoMap]);

  const handleCallUser = useCallback(async (_targetAddress: string, order: Order) => {
    try {
      if (!address) { toast.error('Please connect your wallet first'); return; }
      const isSeller = order.sellerAddress.toLowerCase() === address?.toLowerCase();
      const targetAddress = isSeller ? order.buyerAddress : order.sellerAddress;
      const targetInfo = userInfoMap[targetAddress.toLowerCase()] || {};
      const targetPhone = targetInfo.mobile;
      const targetName = (isSeller ? (order as any).buyerName : (order as any).sellerName) || 'User';
      if (!targetPhone) {
        toast.loading('Fetching contact number...', { id: 'fetch-phone' });
        const info = await fetchUserInfo(targetAddress);
        if (info && typeof info === 'object' && 'mobile' in info && info.mobile) {
          toast.dismiss('fetch-phone');
          return handleCallUser(targetAddress, order);
        } else {
          toast.error('Phone number not available for this user', { id: 'fetch-phone' });
          return;
        }
      }
      setShowPhoneCallModal({ isOpen: true, phoneNumber: targetPhone, userName: targetName });
    } catch (error) {
      toast.error('Failed to initiate call');
    }
  }, [address, userInfoMap, fetchUserInfo]);

  const filteredOrders = useMemo(() => {
    return statusFilter === 'ALL' ? orders : orders.filter(o => o.state === statusFilter);
  }, [orders, statusFilter]);

  useEffect(() => {
    if (orders.length === 0) return;
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => {
      const uniqueAddresses = new Set<string>();
      orders.forEach(order => {
        uniqueAddresses.add(order.buyerAddress.toLowerCase());
        uniqueAddresses.add(order.sellerAddress.toLowerCase());
      });
      const addressesToFetch = Array.from(uniqueAddresses).filter(addr => !userInfoMap[addr] && !fetchingUsers.current.has(addr));
      if (addressesToFetch.length > 0) {
        addressesToFetch.forEach(async (addr) => {
          try { await fetchUserInfo(addr); } catch (error) {}
        });
      }
    }, 500);
    return () => { if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current); };
  }, [orders, fetchUserInfo]);

  useEffect(() => {
    if (showFundLockedPopover.isOpen && showFundLockedPopover.orderId) {
      const lockedOrder = orders.find(o => o.id === showFundLockedPopover.orderId);
      if (lockedOrder) {
        const isBuyer = lockedOrder.buyerAddress.toLowerCase() === address?.toLowerCase();
        const sellerAddress = lockedOrder.sellerAddress.toLowerCase();
        const sellerInfo = userInfoMap[sellerAddress] || {};
        if (isBuyer && !sellerInfo.mobile && sellerAddress) {
          fetchUserInfo(sellerAddress);
        }
      }
    }
  }, [showFundLockedPopover.isOpen, showFundLockedPopover.orderId, orders, address, userInfoMap, fetchUserInfo]);

  const calculateRedeemEligibility = useCallback((order: Order) => {
    if (!order.lockExpiresAt) return { canRedeem: false, timeRemainingSeconds: 0, timeRemainingHours: 0, timeRemainingMinutes: 0, timeRemainingSecs: 0, redeemEligibleAt: null, redeemEligibleAtIST: '' };
    const appealWindowStartMs = new Date(order.lockExpiresAt).getTime();
    const redeemEligibleAtMs = appealWindowStartMs + (48 * 60 * 60 * 1000);
    const currentTimeMs = serverTime;
    const timeRemainingMs = redeemEligibleAtMs - currentTimeMs;
    const timeRemainingSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
    const canRedeem = timeRemainingSeconds <= 0;
    const timeRemainingHours = Math.floor(timeRemainingSeconds / 3600);
    const timeRemainingMinutes = Math.floor((timeRemainingSeconds % 3600) / 60);
    const timeRemainingSecs = timeRemainingSeconds % 60;
    const redeemEligibleAtDate = canRedeem ? null : new Date(redeemEligibleAtMs);
    return { canRedeem, timeRemainingSeconds, timeRemainingHours, timeRemainingMinutes, timeRemainingSecs, redeemEligibleAt: redeemEligibleAtDate, redeemEligibleAtIST: redeemEligibleAtDate ? formatISTDateTime(redeemEligibleAtDate) : '' };
  }, [serverTime]);

  const handleRedeem = async (order: Order) => {
    try {
      const tradeId = Number((order as any)?.blockchain_trade_id || (order as any)?.blockchainTradeId);
      if (!tradeId || Number.isNaN(tradeId)) { toast.error('Missing blockchain trade id.'); return; }
      const redeemInfo = calculateRedeemEligibility(order);
      if (!redeemInfo.canRedeem) {
        toast.error(`Refund not yet available. Wait ${redeemInfo.timeRemainingHours}h ${redeemInfo.timeRemainingMinutes}m more.`, { duration: 6000 });
        return;
      }
      const shouldProceed = window.confirm(`💰 Claim Refund\n\nYou will receive:\n- Amount: ${order.amount} ${order.token}\n- Extra (1%): ${(parseFloat(order.amount.toString()) * 0.01).toFixed(6)} ${order.token}\n- Total: ${(parseFloat(order.amount.toString()) * 1.01).toFixed(6)} ${order.token}\n\nContinue?`);
      if (!shouldProceed) { toast('Refund cancelled', { id: 'redeem' }); return; }
      toast.loading('Claiming refund on blockchain...', { id: 'redeem' });
      const tx = await blockchainService.redeemAfterAppealWindow(tradeId);
      toast.success(`✅ Refund claimed! TX: ${tx.slice(0,10)}...`, { id: 'redeem', duration: 10000 });
      fetchOrders();
    } catch (e: any) {
      if (e?.reason?.includes('Appeal deadline not passed')) toast.error('Wait for 48 hours appeal window', { id: 'redeem', duration: 6000 });
      else toast.error(e?.reason || e?.message || 'Failed to claim refund', { id: 'redeem', duration: 6000 });
    }
  };

  const handleForceReleaseOnChain = async (order: Order) => {
    try {
      const isSeller = order.sellerAddress.toLowerCase() === (address || '').toLowerCase();
      if (!isSeller) { toast.error('Only seller can release funds on-chain'); return; }
      const tradeId = Number((order as any)?.blockchain_trade_id || (order as any)?.blockchainTradeId);
      if (!tradeId || Number.isNaN(tradeId)) { toast.error('Missing blockchain trade id.'); return; }
      toast.loading('Verifying on-chain status...', { id: 'force-release' });
      const verification = await blockchainService.verifyTradeStatus(tradeId);
      if (verification.isReleased) { toast.success('✅ Already released on-chain!', { id: 'force-release' }); fetchOrders(); return; }
      const shouldProceed = window.confirm(`⚠️ DB shows RELEASED but blockchain shows ${verification.blockchainStatusName}.\n\nRelease funds now?\n\nTrade ID: ${tradeId}\nAmount: ${verification.amount} ${verification.token}`);
      if (!shouldProceed) { toast.dismiss('force-release'); return; }
      toast.loading('Releasing funds on-chain...', { id: 'force-release' });
      const txHash = await blockchainService.confirmReceived(tradeId);
      try {
        const token = localStorage.getItem('authToken') || '';
        await fetch(`/api/disputes/${order.id}/confirm-payment-received`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } });
      } catch (_) {}
      toast.success(`✅ Funds released! TX: ${txHash.slice(0,10)}...`, { id: 'force-release', duration: 8000 });
      fetchOrders();
    } catch (e: any) {
      toast.error(e?.reason || e?.message || 'Failed to release on-chain', { id: 'force-release', duration: 8000 });
    }
  };

  const handleVerifyTradeStatus = async (order: Order) => {
    try {
      const tradeId = Number((order as any)?.blockchain_trade_id || (order as any)?.blockchainTradeId);
      if (!tradeId || Number.isNaN(tradeId)) { toast.error('Missing blockchain trade id.'); return; }
      toast.loading('Checking blockchain status...', { id: 'verify-status' });
      const verification = await blockchainService.verifyTradeStatus(tradeId);
      const dbState = order.state;
      const blockchainIsReleased = verification.isReleased || verification.blockchainStatus === 6;
      if (dbState !== 'RELEASED' && blockchainIsReleased) {
        toast.loading('Syncing order status with blockchain...', { id: 'verify-status' });
        try {
          const token = localStorage.getItem('authToken') || '';
          const syncResponse = await fetch(`/api/orders/${order.id}/sync-blockchain-status`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } });
          if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            setTimeout(() => { fetchOrders(); toast.success(syncResult.data?.synced ? `✅ Synced! ${syncResult.data.previousState} → ${syncResult.data.newState}` : `✅ Already in sync`, { id: 'verify-status', duration: 6000 }); }, 1000);
            return;
          }
        } catch (_) {}
      }
      toast.dismiss('verify-status');
      const synced = dbState === 'RELEASED' && blockchainIsReleased;
      if (synced) {
        toast.success(`✅ Status synced! Both show RELEASED.`, { id: 'verify-status', duration: 5000 });
      } else {
        toast(`📊 DB: ${dbState}, Chain: ${verification.blockchainStatusName}`, { id: 'verify-status', duration: 5000 });
      }
    } catch (error: any) {
      toast.error(`Failed to verify: ${error.message}`, { id: 'verify-status' });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // If no address resolved yet, show a connect prompt
  if (!address) {
    return (
      <div className="px-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 space-y-6"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
            <Lock size={36} className="text-white" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-white">Wallet Not Connected</h2>
            <p className="text-gray-300 text-sm max-w-xs">
              Please open this app inside your <strong className="text-blue-300">TrustWallet</strong> or <strong className="text-blue-300">MetaMask</strong> browser and connect your wallet.
            </p>
          </div>
          <motion.button
            onClick={async () => {
              try {
                const provider = getEthereumProvider();
                if (!provider) {
                  toast.error('No wallet provider found. Open inside TrustWallet browser.');
                  return;
                }
                const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
                if (accounts && accounts.length > 0) {
                  setResolvedAddress(accounts[0]);
                  toast.success('Wallet connected!');
                }
              } catch (err: any) {
                toast.error(err?.message || 'Failed to connect wallet');
              }
            }}
            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-8 rounded-xl font-semibold shadow-lg hover:from-blue-600 hover:to-purple-600 transition-all"
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.03 }}
          >
            Connect Wallet
          </motion.button>
          <p className="text-xs text-gray-500 text-center max-w-xs">
            BNB Smart Chain (BSC) supported. Make sure you are on the correct network.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-6 space-y-6">
      {/* Call Active Indicator */}
      {isCallActive && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-green-500 to-blue-500 rounded-lg p-3 mx-auto max-w-sm">
          <div className="flex items-center justify-center space-x-2 text-white">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Call Active</span>
          </div>
        </motion.div>
      )}

      {/* Incoming Call */}
      {incomingCall && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-green-500 to-blue-500 rounded-xl p-6 mx-auto max-w-sm text-white">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
              <Phone size={32} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Incoming Call</h3>
              <p className="text-sm opacity-90">From: {incomingCall.from.slice(0, 8)}...{incomingCall.from.slice(-6)}</p>
            </div>
            <div className="flex space-x-4">
              <motion.button onClick={rejectIncomingCall} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center space-x-2" whileTap={{ scale: 0.95 }}>
                <XCircle size={20} /><span>Reject</span>
              </motion.button>
              <motion.button onClick={acceptIncomingCall} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center space-x-2" whileTap={{ scale: 0.95 }}>
                <Phone size={20} /><span>Accept</span>
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Error Displays */}
      {connectionError && (
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <div className="flex-1"><p className="text-red-300 text-sm font-medium">Connection Error</p><p className="text-red-400 text-xs">{connectionError}</p></div>
          <button onClick={clearError} className="p-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"><X size={16} /></button>
        </motion.div>
      )}
      {ordersError && (
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <div className="flex-1"><p className="text-red-300 text-sm font-medium">Orders Error</p><p className="text-red-400 text-xs">{ordersError}</p></div>
          <button onClick={() => setOrdersError(null)} className="p-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"><X size={16} /></button>
        </motion.div>
      )}
      {adsError && (
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <div className="flex-1"><p className="text-red-300 text-sm font-medium">Ads Error</p><p className="text-red-400 text-xs">{adsError}</p></div>
          <button onClick={() => setAdsError(null)} className="p-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"><X size={16} /></button>
        </motion.div>
      )}
      {actionError && (
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <div className="flex-1"><p className="text-red-300 text-sm font-medium">Action Error</p><p className="text-red-400 text-xs">{actionError}</p></div>
          <button onClick={() => setActionError(null)} className="p-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"><X size={16} /></button>
        </motion.div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-1 border border-white/20">
        <div className="grid grid-cols-2 gap-1">
          {(['orders', 'ads'] as const).map((tab) => (
            <motion.button key={tab} onClick={() => setActiveTab(tab)}
              className={clsx('py-3 px-4 rounded-lg font-medium transition-all capitalize', activeTab === tab ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white' : 'text-gray-300 hover:text-white')}
              whileTap={{ scale: 0.98 }}>
              My {tab}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="right-0 top-0">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="text-white bg-slate-900 text-sm rounded-md px-3 py-2" title="Filter by status">
          {['ALL','CREATED','ACCEPTED','LOCKED','RELEASED','CANCELLED','EXPIRED','UNDER_DISPUTE','UNDER_REVIEW','APPEALED','CONFIRMED','REFUNDED'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' ? (
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white/10 rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-white/20 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-white/20 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12 space-y-4">
              <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto">
                <Clock size={32} className="text-gray-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">No Orders Yet</h3>
                <p className="text-gray-300 text-sm">Your order requests will appear here</p>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence>
              <div className="h-[400px] rounded-sm overflow-y-auto">
                {filteredOrders.map((order) => {
                  const expiryData = calculateOrderExpiry(order);
                  const isExpired = expiryData.isExpired;
                  const timeRemaining = expiryData.timeRemainingSeconds;
                  const isSeller = order.sellerAddress.toLowerCase() === address?.toLowerCase();
                  const isBuyer = order.buyerAddress.toLowerCase() === address?.toLowerCase();
                  const isAdOwner = order.adOwnerAddress?.toLowerCase() === address?.toLowerCase();

                  return (
                    <motion.div key={order.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                      className="bg-white/10 backdrop-blur-lg mb-2 rounded-xl p-4 border border-white/20 space-y-4">
                      {/* Order Header */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-white font-semibold">{order.amount} {order.token}</span>
                            <span className={clsx('px-2 py-1 rounded text-xs font-medium', getOrderStatusColor(order.state))}>{order.state}</span>
                          </div>
                          <p className="text-gray-300 text-sm">
                            {isSeller ? 'Buyer' : 'Seller'}: {(isSeller ? order.buyerAddress : order.sellerAddress).slice(0, 8) + '...' + (isSeller ? order.buyerAddress : order.sellerAddress).slice(-6)}
                          </p>
                          <p className="text-xs text-gray-400">Name: {(isSeller ? (order as any).buyerName : (order as any).sellerName) || '—'}</p>
                          <p className="text-xs text-gray-400">Mobile: {userInfoMap[(isSeller ? order.buyerAddress : order.sellerAddress).toLowerCase()]?.mobile || '—'}</p>
                          <p className="text-xs text-gray-400">
                            You are the {isSeller ? 'Seller' : 'Buyer'}
                            {isAdOwner && order.state === 'CREATED' && !isExpired && (
                              <span className="text-green-400 font-semibold"> - You can Accept/Reject (Ad Owner)</span>
                            )}
                          </p>
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1 mt-1 inline-block">
                            <p className="text-xs text-blue-300">📅 Created: <span className="font-semibold">{formatDateSimple(order.startTime)}</span></p>
                          </div>
                        </div>

                        {order.state === 'CREATED' && (
                          <div className="text-right space-y-1 ml-4">
                            <p className={`font-mono text-xl font-bold ${isExpired ? 'text-gray-500' : timeRemaining < 60 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                              {isExpired ? '0:00' : formatTime(timeRemaining)}
                            </p>
                            <p className="text-gray-400 text-xs">{isExpired ? 'expired' : 'remaining'}</p>
                            <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                              <div className={`h-1.5 rounded-full transition-all ${isExpired ? 'bg-gray-500' : timeRemaining < 60 ? 'bg-red-500' : 'bg-yellow-400'}`}
                                style={{ width: `${isExpired ? 0 : (timeRemaining / 300) * 100}%` }}></div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">of 5:00 min</p>
                          </div>
                        )}

                        <div className="flex space-x-2">
                          <motion.button
                            onClick={() => {
                              const targetAddress = isAdOwner
                                ? (isSeller ? order.buyerAddress : order.sellerAddress)
                                : order.adOwnerAddress || (isBuyer ? order.sellerAddress : order.buyerAddress);
                              handleCallUser(targetAddress, order);
                            }}
                            className="p-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 flex items-center space-x-2"
                            whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }} title="Call other party">
                            <PhoneCall size={18} /><span className="text-sm font-medium">Call</span>
                          </motion.button>
                        </div>
                      </div>

                      {/* Agent Info */}
                      <div className="bg-white/5 rounded-lg p-3 space-y-2">
                        <p className="text-white text-sm font-medium">{order.agentBranch}</p>
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-gray-300 text-xs">{order.agentAddress}</p>
                            <p className="text-gray-300 text-xs">{order.agentNumber}</p>
                          </div>
                        </div>
                      </div>

                      {/* Actions for Ad Owner */}
                      {order.state === 'CREATED' && isAdOwner && !isExpired && (
                        <div className="space-y-3">
                          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                            <div className="flex items-center space-x-2 text-green-400">
                              <CheckCircle size={16} />
                              <span className="text-sm font-medium">Action Required: Accept or Reject this order</span>
                            </div>
                          </div>
                          <div className="flex space-x-3">
                            <motion.button onClick={() => handleAcceptOrder(order.id)} disabled={isExpired}
                              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              whileTap={{ scale: 0.98 }}>
                              <CheckCircle size={16} /><span>Accept</span>
                            </motion.button>
                            <motion.button onClick={() => handleRejectOrder(order.id)}
                              className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center space-x-2"
                              whileTap={{ scale: 0.98 }}>
                              <XCircle size={16} /><span>Reject</span>
                            </motion.button>
                          </div>
                        </div>
                      )}

                      {/* Lock Funds Button for Seller */}
                      {order.state === 'ACCEPTED' && isSeller && (
                        <div className="space-y-3">
                          <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-3">
                            <div className="flex items-center space-x-2 text-orange-400">
                              <Lock size={16} />
                              <span className="text-sm font-medium">Action Required: Lock your funds on blockchain</span>
                            </div>
                            <p className="text-xs text-orange-300 mt-2">Order accepted! Lock {order.amount} {order.token} as escrow.</p>
                            <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">
                              💡 {blockchainService.getWalletInstructions()}
                            </div>
                          </div>
                          <motion.button onClick={() => handleLockFunds(order.id)}
                            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center space-x-2 shadow-lg hover:from-orange-600 hover:to-red-600 transition-all"
                            whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.02 }}>
                            <Lock size={18} /><span>🔒 Lock Funds on Blockchain</span>
                          </motion.button>
                        </div>
                      )}

                      {/* Status for Buyer */}
                      {isBuyer && (
                        <div className="space-y-3">
                          {order.state === 'ACCEPTED' && (
                            <div className="flex items-center space-x-2 text-blue-400 bg-blue-500/20 p-3 rounded-lg">
                              <CheckCircle size={16} />
                              <span className="text-sm font-medium">Order accepted! Contact the agent to complete payment</span>
                            </div>
                          )}

                          {order.state === 'LOCKED' && (() => {
                            const hasViewed = viewedLockedOrders.has(order.id);
                            const lockExpiry = calculateLockExpiry(order);
                            return (
                              <div className="space-y-3">
                                <div className="flex items-center space-x-2 text-purple-400 bg-purple-500/20 p-3 rounded-lg">
                                  <Lock size={16} />
                                  <span className="text-sm font-medium">⏰ Funds locked - Proceed to agent for payment</span>
                                </div>
                                {order.lockExpiresAt && (
                                  <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center space-x-2">
                                        <Clock size={18} className="text-purple-300" />
                                        <span className="text-sm font-semibold text-purple-300">Lock Expires In</span>
                                      </div>
                                      <div className="flex items-center space-x-3">
                                        {lockExpiry.isExpired ? (
                                          <span className="text-red-400 text-sm font-bold">EXPIRED</span>
                                        ) : (
                                          <span className={`font-mono text-xl font-bold ${lockExpiry.timeRemainingHours === 0 && lockExpiry.timeRemainingMinutes < 30 ? 'text-red-500 animate-pulse' : lockExpiry.timeRemainingHours === 0 ? 'text-orange-400' : 'text-green-400'}`}>
                                            {formatLockTime(lockExpiry.timeRemainingHours, lockExpiry.timeRemainingMinutes, lockExpiry.timeRemainingSecs)}
                                          </span>
                                        )}
                                        <motion.button onClick={() => setShowLockAlertModal({ isOpen: true, orderId: order.id, userRole: 'buyer' })}
                                          className="p-2 rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 transition-colors"
                                          whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.1 }} title="Important Instructions">
                                          <AlertCircle size={20} className="text-yellow-400" />
                                        </motion.button>
                                      </div>
                                    </div>
                                    {!lockExpiry.isExpired && (
                                      <div className="space-y-2">
                                        <div className="w-full bg-gray-700 rounded-full h-2">
                                          <div className={`h-2 rounded-full transition-all ${lockExpiry.timeRemainingHours === 0 && lockExpiry.timeRemainingMinutes < 30 ? 'bg-red-500' : lockExpiry.timeRemainingHours === 0 ? 'bg-orange-500' : 'bg-green-500'}`}
                                            style={{ width: `${Math.max(0, Math.min(100, (lockExpiry.timeRemainingSeconds / 7200) * 100))}%` }}></div>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-400">
                                          <span>Expires: {lockExpiry.lockExpiresAtIST}</span>
                                          <span>{lockExpiry.timeRemainingHours}h {lockExpiry.timeRemainingMinutes}m remaining</span>
                                        </div>
                                      </div>
                                    )}
                                    {lockExpiry.isExpired && <div className="text-red-400 text-sm mt-2">⚠️ Lock period has expired. Appeal window is now open.</div>}
                                  </div>
                                )}
                                <div className="flex space-x-2">
                                  <motion.button
                                    onClick={() => { setShowPaymentDetailsModal({ isOpen: true, orderId: order.id }); setViewedLockedOrders(prev => new Set(prev).add(order.id)); }}
                                    className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center space-x-2 shadow-lg hover:from-purple-600 hover:to-blue-600 transition-all"
                                    whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.02 }}>
                                    <span>📋 View Payment Details</span>
                                    {!hasViewed && <span className="ml-2 bg-yellow-400 text-yellow-900 text-xs px-2 py-0.5 rounded-full font-bold">New</span>}
                                  </motion.button>
                                  {isBuyer && (order as any)?.blockchain_trade_id && (
                                    <motion.button onClick={() => handleConfirmPayment(order.id, 'SENT')}
                                      className="bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                                      whileTap={{ scale: 0.98 }} title="Confirm payment sent (off-chain)">
                                      <CheckCircle size={18} /><span>Confirm</span>
                                    </motion.button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {order.state === 'RELEASED' && (
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2 text-green-400 bg-green-500/20 p-3 rounded-lg">
                                <CheckCircle size={16} /><span className="text-sm font-medium">Order completed successfully!</span>
                              </div>
                              {(order as any)?.blockchain_trade_id && (
                                <motion.button onClick={() => handleVerifyTradeStatus(order)}
                                  className="w-full bg-blue-500/20 border border-blue-500/30 text-blue-300 px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-500/30 transition-colors flex items-center justify-center space-x-2"
                                  whileTap={{ scale: 0.95 }}>
                                  <CheckCircle size={14} /><span>🔍 Verify Blockchain Status</span>
                                </motion.button>
                              )}
                              {(order as any)?.blockchain_trade_id && isSeller && (
                                <motion.button onClick={() => handleForceReleaseOnChain(order)}
                                  className="w-full bg-orange-500/20 border border-orange-500/30 text-orange-300 px-3 py-2 rounded-md text-sm font-medium hover:bg-orange-500/30 transition-colors flex items-center justify-center space-x-2"
                                  whileTap={{ scale: 0.95 }}>
                                  <Lock size={14} /><span>Release On-Chain (Seller)</span>
                                </motion.button>
                              )}
                            </div>
                          )}
                          {order.state === 'CANCELLED' && (
                            <div className="flex items-center space-x-2 text-red-400 bg-red-500/20 p-3 rounded-lg">
                              <XCircle size={16} /><span className="text-sm font-medium">Order was cancelled</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Status for Seller - LOCKED */}
                      {isSeller && order.state === 'LOCKED' && (() => {
                        const lockExpiry = calculateLockExpiry(order);
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2 text-purple-400 bg-purple-500/20 p-3 rounded-lg">
                              <Lock size={16} /><span className="text-sm font-medium">⏰ Funds locked - Wait for buyer to complete payment</span>
                            </div>
                            {order.lockExpiresAt && (
                              <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-2">
                                    <Clock size={18} className="text-purple-300" />
                                    <span className="text-sm font-semibold text-purple-300">Lock Expires In</span>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    {lockExpiry.isExpired ? (
                                      <span className="text-red-400 text-sm font-bold">EXPIRED</span>
                                    ) : (
                                      <span className={`font-mono text-xl font-bold ${lockExpiry.timeRemainingHours === 0 && lockExpiry.timeRemainingMinutes < 30 ? 'text-red-500 animate-pulse' : lockExpiry.timeRemainingHours === 0 ? 'text-orange-400' : 'text-green-400'}`}>
                                        {formatLockTime(lockExpiry.timeRemainingHours, lockExpiry.timeRemainingMinutes, lockExpiry.timeRemainingSecs)}
                                      </span>
                                    )}
                                    <motion.button onClick={() => setShowLockAlertModal({ isOpen: true, orderId: order.id, userRole: 'seller' })}
                                      className="p-2 rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 transition-colors"
                                      whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.1 }} title="Important Instructions">
                                      <AlertCircle size={20} className="text-yellow-400" />
                                    </motion.button>
                                  </div>
                                </div>
                                {!lockExpiry.isExpired && (
                                  <div className="space-y-2">
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                      <div className={`h-2 rounded-full transition-all ${lockExpiry.timeRemainingHours === 0 && lockExpiry.timeRemainingMinutes < 30 ? 'bg-red-500' : lockExpiry.timeRemainingHours === 0 ? 'bg-orange-500' : 'bg-green-500'}`}
                                        style={{ width: `${Math.max(0, Math.min(100, (lockExpiry.timeRemainingSeconds / 7200) * 100))}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400">
                                      <span>Expires: {lockExpiry.lockExpiresAtIST}</span>
                                      <span>{lockExpiry.timeRemainingHours}h {lockExpiry.timeRemainingMinutes}m remaining</span>
                                    </div>
                                  </div>
                                )}
                                {lockExpiry.isExpired && <div className="text-red-400 text-sm mt-2">⚠️ Lock period expired. Appeal window is now open.</div>}
                              </div>
                            )}

                            {/* Redeem eligibility after 48h */}
                            {lockExpiry.isExpired && (() => {
                              const redeemInfo = calculateRedeemEligibility(order);
                              return (
                                <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-2">
                                      <Clock size={18} className="text-orange-300" />
                                      <span className="text-sm font-semibold text-orange-300">
                                        {redeemInfo.canRedeem ? '✅ Ready to Claim Refund' : '⏳ Time Until Refund Available'}
                                      </span>
                                    </div>
                                    {!redeemInfo.canRedeem && (
                                      <span className={`font-mono text-xl font-bold ${redeemInfo.timeRemainingHours === 0 && redeemInfo.timeRemainingMinutes < 60 ? 'text-red-500 animate-pulse' : redeemInfo.timeRemainingHours < 6 ? 'text-orange-400' : 'text-yellow-400'}`}>
                                        {formatLockTime(redeemInfo.timeRemainingHours, redeemInfo.timeRemainingMinutes, redeemInfo.timeRemainingSecs)}
                                      </span>
                                    )}
                                    {redeemInfo.canRedeem && <span className="text-green-400 text-sm font-bold">ELIGIBLE</span>}
                                  </div>
                                  {redeemInfo.canRedeem && (
                                    <motion.button onClick={() => handleRedeem(order)}
                                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-4 rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center space-x-2 shadow-lg"
                                      whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.02 }}>
                                      <XCircle size={18} /><span>💰 Claim Refund (Amount + 1% Extra)</span>
                                    </motion.button>
                                  )}
                                </div>
                              );
                            })()}

                            {(order as any)?.blockchain_trade_id && (
                              <motion.button onClick={() => handleConfirmPayment(order.id, 'RECEIVED')}
                                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-4 rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center space-x-2 shadow-lg"
                                whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.02 }} title="Confirm payment received (on-chain)">
                                <CheckCircle size={18} /><span>✅ Confirm Payment Received</span>
                              </motion.button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Seller - RELEASED */}
                      {isSeller && order.state === 'RELEASED' && (
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2 text-green-400 bg-green-500/20 p-3 rounded-lg">
                            <CheckCircle size={16} /><span className="text-sm font-medium">✅ Funds released to buyer! Order completed.</span>
                          </div>
                          {(order as any)?.blockchain_trade_id && (
                            <div className="space-y-2">
                              <motion.button onClick={() => handleVerifyTradeStatus(order)}
                                className="w-full bg-blue-500/20 border border-blue-500/30 text-blue-300 px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-500/30 transition-colors flex items-center justify-center space-x-2"
                                whileTap={{ scale: 0.95 }}>
                                <CheckCircle size={14} /><span>🔍 Verify Blockchain Status</span>
                              </motion.button>
                              <motion.button onClick={() => handleForceReleaseOnChain(order)}
                                className="w-full bg-orange-500/20 border border-orange-500/30 text-orange-300 px-3 py-2 rounded-md text-sm font-medium hover:bg-orange-500/30 transition-colors flex items-center justify-center space-x-2"
                                whileTap={{ scale: 0.95 }}>
                                <Lock size={14} /><span>🔓 Release On-Chain (Seller)</span>
                              </motion.button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Dispute Resolution */}
                      {['LOCKED', 'UNDER_DISPUTE', 'APPEALED'].includes(order.state) && (() => {
                        if (order.state === 'LOCKED') {
                          const lockExpiry = calculateLockExpiry(order);
                          if (!lockExpiry.isExpired) return null;
                        }
                        return (
                          <div className="space-y-4">
                            <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <Gavel size={18} className="text-purple-400" />
                                  <span className="text-purple-300 font-medium">Dispute Resolution</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {(order as any)?.blockchain_trade_id && (
                                    <button onClick={() => handleVerifyTradeStatus(order)} className="text-blue-400 hover:text-blue-300 text-sm px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 transition-colors">🔍 Verify</button>
                                  )}
                                  <button onClick={() => openDisputeModal(order.id)} className="text-purple-400 hover:text-purple-300 text-sm">Details</button>
                                </div>
                              </div>
                              <div className="flex space-x-2 mt-3">
                                {order.state === 'LOCKED' && (
                                  <>
                                    {isBuyer && (order as any)?.blockchain_trade_id && (
                                      <motion.button onClick={() => handleConfirmPayment(order.id, 'SENT')} className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700" whileTap={{ scale: 0.95 }}>
                                        <CheckCircle size={14} className="inline mr-1" />Confirm Payment Sent
                                      </motion.button>
                                    )}
                                    {isSeller && (order as any)?.blockchain_trade_id && (
                                      <motion.button onClick={() => handleConfirmPayment(order.id, 'RECEIVED')} className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700" whileTap={{ scale: 0.95 }}>
                                        <CheckCircle size={14} className="inline mr-1" />Confirm Payment Received
                                      </motion.button>
                                    )}
                                  </>
                                )}
                                {['UNDER_DISPUTE'].includes(order.state) && (
                                  <motion.button onClick={() => handleFileAppealRedirect(order.id)} className="flex-1 bg-orange-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-orange-700" whileTap={{ scale: 0.95 }}>
                                    <FileText size={14} className="inline mr-1" />File Appeal
                                  </motion.button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </div>
      ) : (
        /* Ads Tab */
        <div className="space-y-4">
          {isLoadingAds ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white/10 rounded-xl p-4 animate-pulse">
                  <div className="h-4 bg-white/20 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-white/20 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : myAds.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12 space-y-4">
              <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto">
                <Plus size={32} className="text-gray-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">No Ads Yet</h3>
                <p className="text-gray-300 text-sm">Create your first P2P ad to start trading</p>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence>
              {myAds.map((ad) => (
                <motion.div key={ad.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                  className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-semibold text-lg">₹{ad.priceInr}</span>
                        <span className="text-gray-300 text-sm bg-white/10 px-2 py-1 rounded">{ad.token}</span>
                      </div>
                      <p className="text-gray-300 text-sm">Min: ₹{ad.minAmount} | Max: ₹{ad.maxAmount}</p>
                      <p className="text-gray-400 text-xs">Lock: {Math.floor(ad.lockDurationSeconds / 60)} min</p>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span className={clsx('px-2 py-1 rounded text-xs font-medium', ad.type === 'BUY' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300')}>{ad.type}</span>
                      <span className={clsx('px-2 py-1 rounded text-xs font-medium', ad.active ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300')}>{ad.active ? 'Active' : 'Inactive'}</span>
                    </div>
                  </div>
                  {ad.agent && (
                    <div className="bg-white/5 rounded-lg p-3 space-y-2">
                      <p className="text-white text-sm font-medium">{ad.agent.branchName}</p>
                      <p className="text-gray-300 text-xs">{ad.agent.city}</p>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-300 text-xs">{ad.agent.mobile}</span>
                        <motion.button onClick={() => window.open(`tel:${ad.agent?.mobile}`)} className="p-1 rounded bg-green-500/20 text-green-400" whileTap={{ scale: 0.95 }}>
                          <Phone size={12} />
                        </motion.button>
                      </div>
                    </div>
                  )}
                  <div className="flex space-x-2">
                    <motion.button onClick={() => handleEditAd(ad)}
                      className="flex-1 py-2 px-4 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors flex items-center justify-center space-x-2"
                      whileTap={{ scale: 0.95 }}>
                      <Edit size={16} /><span>Edit</span>
                    </motion.button>
                    <motion.button onClick={() => handleDeleteAd(ad.id)}
                      className="p-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                      whileTap={{ scale: 0.95 }}>
                      <Trash2 size={16} />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Edit Ad Modal */}
      <AnimatePresence>
        {editingAd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditingAd(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-white/20"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Edit Ad</h3>
                <button onClick={() => setEditingAd(null)} className="p-2 rounded-lg bg-white/10 text-gray-400 hover:text-white transition-colors"><XCircle size={20} /></button>
              </div>
              <div className="space-y-4">
                <div className="bg-white/5 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">{editingAd.type} {editingAd.token}</span>
                    <span className="text-gray-300 text-sm bg-white/10 px-2 py-1 rounded">{editingAd.city}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Price (USDT)</label>
                  <input type="number" value={editForm.priceInr} onChange={(e) => setEditForm({...editForm, priceInr: e.target.value})}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500" placeholder="Enter price in USDT" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Min Amount (USDT)</label>
                    <input type="number" value={editForm.minAmount} onChange={(e) => setEditForm({...editForm, minAmount: e.target.value})}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500" placeholder="Min amount" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Max Amount (USDT)</label>
                    <input type="number" value={editForm.maxAmount} onChange={(e) => setEditForm({...editForm, maxAmount: e.target.value})}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500" placeholder="Max amount" />
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <input type="checkbox" id="active" checked={editForm.active} onChange={(e) => setEditForm({...editForm, active: e.target.checked})}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                  <label htmlFor="active" className="text-sm font-medium text-gray-300">Ad is active</label>
                </div>
                <div className="flex space-x-3">
                  <motion.button onClick={() => setEditingAd(null)} className="flex-1 py-2 px-4 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors" whileTap={{ scale: 0.98 }}>Cancel</motion.button>
                  <motion.button onClick={handleUpdateAd} className="flex-1 py-2 px-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white" whileTap={{ scale: 0.98 }}>Update Ad</motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call Modal */}
      {callModal.isOpen && (
        <CallModal
          isOpen={callModal.isOpen}
          ad={{ id: 'order-call', ownerAddress: callModal.targetAddress, ownerSelectedAgentIds: ['1'], type: 'BUY', token: 'USDT', priceInr: '0', minAmount: '0', maxAmount: '0', lockDurationSeconds: 0, city: 'Mumbai', active: true, createdAt: new Date().toISOString(), agent: { id: '1', branchName: callModal.targetName || 'User', city: 'Mumbai', address: callModal.targetAddress, mobile: '', verified: true, createdByAdmin: '1', createdAt: new Date().toISOString(), locationId: '1', locationName: 'Mumbai' } }}
          onClose={() => { cleanupCall(); }}
        />
      )}

      {/* Dispute Resolution Modal */}
      {showDisputeModal.isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDisputeModal({isOpen: false, orderId: ''})}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-white/20"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6 p-6">
              <h3 className="text-xl font-bold text-white">Dispute Resolution</h3>
              <button onClick={() => setShowDisputeModal({isOpen: false, orderId: ''})} className="p-2 rounded-lg bg-white/10 text-gray-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            {disputeData[showDisputeModal.orderId] && (
              <DisputeResolution
                orderId={showDisputeModal.orderId}
                userRole={disputeData[showDisputeModal.orderId].userRole}
                orderState={disputeData[showDisputeModal.orderId].state}
                timeRemaining={disputeData[showDisputeModal.orderId].timeRemaining || 0}
                appealTimeRemaining={disputeData[showDisputeModal.orderId].appealTimeRemaining || 0}
                confirmations={disputeData[showDisputeModal.orderId].confirmations}
                dispute={disputeData[showDisputeModal.orderId].dispute}
                appeals={disputeData[showDisputeModal.orderId].appeals || []}
                onConfirmPayment={handleConfirmPayment}
                onFileAppeal={handleFileAppeal}
              />
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Fund Locked Popover for Buyers */}
      {showFundLockedPopover.isOpen && (() => {
        const lockedOrder = orders.find(o => o.id === showFundLockedPopover.orderId);
        if (!lockedOrder) return null;
        const isBuyer = lockedOrder.buyerAddress.toLowerCase() === address?.toLowerCase();
        const sellerAddress = lockedOrder.sellerAddress.toLowerCase();
        const sellerInfo = userInfoMap[sellerAddress] || {};
        const sellerName = (lockedOrder as any)?.sellerName || 'Seller';
        const sellerMobile = sellerInfo.mobile || 'Not available';
        const rate = Number((lockedOrder as any)?.priceInr || 0);
        const quantity = Number(lockedOrder.amount || 0);
        const totalAmount = (rate * quantity).toFixed(2);
        return (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowFundLockedPopover({ isOpen: false, orderId: '' }); if (lockedOrder) setViewedLockedOrders(prev => new Set(prev).add(lockedOrder.id)); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-green-500 to-blue-500 rounded-xl p-6 w-full max-w-lg border border-white/20 text-white overflow-y-auto max-h-[90vh] relative"
              onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setShowFundLockedPopover({ isOpen: false, orderId: '' }); if (lockedOrder) setViewedLockedOrders(prev => new Set(prev).add(lockedOrder.id)); }}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors z-10"><X size={20} /></button>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3"><Lock size={32} className="text-white" /></div>
                  <h3 className="text-xl font-bold mb-2">🔒 Funds Locked Successfully!</h3>
                  <p className="text-white/90 text-sm">The seller has locked their funds for 2 hours. You can now proceed with payment.</p>
                </div>
                <div className="bg-white/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2 mb-2"><Phone size={18} /><h4 className="font-semibold text-base">Agent Details</h4></div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start space-x-2"><span className="font-medium min-w-[80px]">Name:</span><span>{lockedOrder.agentBranch}</span></div>
                    <div className="flex items-start space-x-2"><span className="font-medium min-w-[80px]">Location:</span><span>{lockedOrder.agentAddress}</span></div>
                    <div className="flex items-center space-x-2"><span className="font-medium min-w-[80px]">Mobile:</span><a href={`tel:${lockedOrder.agentNumber}`} className="underline flex items-center space-x-1"><Phone size={14} /><span>{lockedOrder.agentNumber}</span></a></div>
                  </div>
                </div>
                {isBuyer && (
                  <div className="bg-white/20 rounded-lg p-4 space-y-3">
                    <div className="flex items-center space-x-2 mb-2"><span>👤</span><h4 className="font-semibold">Seller Details</h4></div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start space-x-2"><span className="font-medium min-w-[80px]">Name:</span><span>{sellerName}</span></div>
                      <div className="flex items-center space-x-2"><span className="font-medium min-w-[80px]">Mobile:</span>{sellerMobile !== 'Not available' ? <a href={`tel:${sellerMobile}`} className="underline flex items-center space-x-1"><Phone size={14} /><span>{sellerMobile}</span></a> : <span className="opacity-70 italic">Fetching...</span>}</div>
                    </div>
                  </div>
                )}
                <div className="bg-white/20 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2"><span>💰</span><h4 className="font-semibold">Payment Amount</h4></div>
                  <div className="flex justify-between items-center border-t border-white/30 pt-2 mt-2">
                    <span className="font-semibold">Total Amount to Pay:</span>
                    <span className="font-bold text-lg text-yellow-300">₹{totalAmount}</span>
                  </div>
                </div>
                <motion.button onClick={() => { setShowFundLockedPopover({ isOpen: false, orderId: '' }); setViewedLockedOrders(prev => new Set(prev).add(lockedOrder.id)); setShowPaymentDetailsModal({ isOpen: true, orderId: lockedOrder.id }); }}
                  className="w-full bg-white/20 hover:bg-white/30 text-white py-3 px-4 rounded-lg font-medium transition-colors" whileTap={{ scale: 0.95 }}>
                  Got It - View Details
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        );
      })()}

      {/* Payment Details Modal */}
      {showPaymentDetailsModal.isOpen && (() => {
        const order = orders.find(o => o.id === showPaymentDetailsModal.orderId);
        if (!order) return null;
        const isBuyer = order.buyerAddress.toLowerCase() === address?.toLowerCase();
        const sellerAddress = order.sellerAddress.toLowerCase();
        const sellerInfo = userInfoMap[sellerAddress] || {};
        const sellerName = (order as any)?.sellerName || 'Seller';
        const sellerMobile = sellerInfo.mobile || 'Not available';
        const rate = Number((order as any)?.priceInr || 0);
        const quantity = Number(order.amount || 0);
        const totalAmount = (rate * quantity).toFixed(2);
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
            onClick={() => setShowPaymentDetailsModal({ isOpen: false, orderId: '' })}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl w-full max-w-md sm:max-w-lg border border-white/20 text-white overflow-hidden shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center"><FileText size={20} className="text-white" /></div>
                  <h3 className="text-lg sm:text-xl font-bold text-white">📋 Payment Details</h3>
                </div>
                <button onClick={() => setShowPaymentDetailsModal({ isOpen: false, orderId: '' })} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"><X size={20} /></button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-4">
                <div className="bg-white/10 rounded-lg p-4 sm:p-5 space-y-3 border border-white/10">
                  <div className="flex items-center space-x-2 mb-3"><Phone size={18} className="text-blue-400" /><h4 className="font-semibold text-base sm:text-lg text-blue-300">Agent Details</h4></div>
                  <div className="space-y-2.5 text-sm sm:text-base">
                    <div className="flex flex-col sm:flex-row sm:items-start space-y-1 sm:space-y-0 sm:space-x-3"><span className="font-semibold min-w-[90px] text-gray-300">Name:</span><span className="text-white">{order.agentBranch}</span></div>
                    <div className="flex flex-col sm:flex-row sm:items-start space-y-1 sm:space-y-0 sm:space-x-3"><span className="font-semibold min-w-[90px] text-gray-300">Location:</span><span className="text-white">{order.agentAddress}</span></div>
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-3"><span className="font-semibold min-w-[90px] text-gray-300">Mobile:</span><a href={`tel:${order.agentNumber}`} className="text-blue-300 hover:text-blue-200 underline flex items-center space-x-2 text-base sm:text-lg font-medium"><Phone size={16} /><span>{order.agentNumber}</span></a></div>
                  </div>
                </div>
                {isBuyer && (
                  <div className="bg-white/10 rounded-lg p-4 sm:p-5 space-y-3 border border-white/10">
                    <div className="flex items-center space-x-2 mb-3"><span className="text-lg">👤</span><h4 className="font-semibold text-base sm:text-lg text-purple-300">Seller Details</h4></div>
                    <div className="space-y-2.5 text-sm sm:text-base">
                      <div className="flex flex-col sm:flex-row sm:items-start space-y-1 sm:space-y-0 sm:space-x-3"><span className="font-semibold min-w-[90px] text-gray-300">Name:</span><span className="text-white">{sellerName}</span></div>
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-3"><span className="font-semibold min-w-[90px] text-gray-300">Mobile:</span>{sellerMobile !== 'Not available' ? <a href={`tel:${sellerMobile}`} className="text-purple-300 hover:text-purple-200 underline flex items-center space-x-2 text-base sm:text-lg font-medium"><Phone size={16} /><span>{sellerMobile}</span></a> : <span className="text-gray-400 italic text-sm">Fetching...</span>}</div>
                    </div>
                  </div>
                )}
                <div className="bg-white/10 rounded-lg p-4 sm:p-5 space-y-3 border border-white/10">
                  <div className="flex items-center space-x-2 mb-3"><span className="text-lg">💰</span><h4 className="font-semibold text-base sm:text-lg text-green-300">Payment Amount</h4></div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2"><span className="text-gray-300">Rate (per {order.token}):</span><span className="font-semibold text-white text-base sm:text-lg">₹{rate.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center py-2"><span className="text-gray-300">Quantity ({order.token}):</span><span className="font-semibold text-white text-base sm:text-lg">{quantity.toFixed(6)}</span></div>
                    <div className="border-t border-white/20 pt-3 mt-3 flex justify-between items-center">
                      <span className="font-semibold text-base sm:text-lg">Total to Pay:</span>
                      <span className="font-bold text-xl sm:text-2xl text-yellow-300">₹{totalAmount}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white/10 rounded-lg p-4 sm:p-5 space-y-3 border border-white/10">
                  <div className="flex items-center space-x-2 mb-3"><span className="text-lg">📋</span><h4 className="font-semibold text-base sm:text-lg text-yellow-300">Next Steps</h4></div>
                  <ul className="text-sm sm:text-base text-gray-300 space-y-2 list-disc list-inside">
                    <li>Go to <strong className="text-white">{order.agentBranch}</strong> within 2 hours</li>
                    <li>Pay <strong className="text-yellow-300">₹{totalAmount}</strong> to the agent</li>
                    <li>Contact agent at <strong className="text-white">{order.agentNumber}</strong></li>
                    <li>Complete the transaction with the agent</li>
                  </ul>
                </div>
              </div>
              <div className="p-4 sm:p-6 border-t border-white/10 bg-white/5 flex-shrink-0">
                <motion.button onClick={() => setShowPaymentDetailsModal({ isOpen: false, orderId: '' })}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white py-3 px-4 rounded-lg font-medium transition-all text-base sm:text-lg"
                  whileTap={{ scale: 0.98 }}>Got It</motion.button>
              </div>
            </motion.div>
          </motion.div>
        );
      })()}

      {/* Phone Call Modal */}
      {showPhoneCallModal.isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowPhoneCallModal({ isOpen: false, phoneNumber: '', userName: '' })}>
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl w-full max-w-md border border-white/20 text-white overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center"><Phone size={24} className="text-white" /></div>
              <div><h3 className="text-xl font-bold text-white">Call {showPhoneCallModal.userName}</h3><p className="text-sm text-gray-400">Phone Number</p></div>
            </div>
            <button onClick={() => setShowPhoneCallModal({ isOpen: false, phoneNumber: '', userName: '' })} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-6">
            <div className="bg-white/10 rounded-lg p-6 text-center border border-white/10">
              <p className="text-sm text-gray-400 mb-2">Phone Number</p>
              <p id="phone-number-display" className="text-3xl font-bold text-white break-all select-all cursor-text"
                style={{ userSelect: 'all', WebkitUserSelect: 'all' } as any}
                onClick={(e) => { const range = document.createRange(); range.selectNodeContents(e.currentTarget); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range); }}>
                {showPhoneCallModal.phoneNumber}
              </p>
              <p className="text-xs text-gray-400 mt-2">Tap to select, then copy manually</p>
            </div>
            <div className="space-y-3">
              <motion.button
                onClick={async () => {
                  try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      await navigator.clipboard.writeText(showPhoneCallModal.phoneNumber);
                      toast.success('Phone number copied!');
                    } else {
                      const el = document.getElementById('phone-number-display');
                      if (el) { const range = document.createRange(); range.selectNodeContents(el); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range); toast('Number selected! Long press to copy', { icon: '📋', duration: 3000 }); }
                    }
                  } catch (_) {
                    const el = document.getElementById('phone-number-display');
                    if (el) { const range = document.createRange(); range.selectNodeContents(el); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range); toast('Number selected! Long press to copy', { icon: '📋', duration: 4000 }); }
                  }
                }}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white py-4 px-6 rounded-lg font-semibold text-lg flex items-center justify-center space-x-3 transition-all shadow-lg"
                whileTap={{ scale: 0.98 }}>
                <FileText size={24} /><span>Copy Number</span>
              </motion.button>
            </div>
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-300 text-center">💡 Dialog me jakar call kar lo</p>
            </div>
          </div>
          </motion.div>
        </motion.div>
      )}

      {/* Appeal Redirect Modal */}
      {showAppealRedirectModal.isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAppealRedirectModal({ isOpen: false, appealUrl: '', orderId: '' })}>
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl w-full max-w-md border border-white/20 text-white overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center"><FileText size={24} className="text-white" /></div>
              <div><h3 className="text-xl font-bold text-white">File Appeal</h3><p className="text-sm text-gray-400">Chrome Browser Required</p></div>
            </div>
            <button onClick={() => setShowAppealRedirectModal({ isOpen: false, appealUrl: '', orderId: '' })} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-6">
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-300 text-center">Ye link copy karke browser me open karo</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4 border border-white/10">
              <p className="text-sm text-gray-400 mb-2">Appeal URL</p>
              <p id="appeal-url-display" className="text-sm font-mono text-white break-all bg-black/20 p-3 rounded border border-white/10 select-all cursor-text"
                style={{ userSelect: 'all', WebkitUserSelect: 'all' } as any}
                onClick={(e) => { const range = document.createRange(); range.selectNodeContents(e.currentTarget); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range); }}>
                {showAppealRedirectModal.appealUrl}
              </p>
            </div>
            <motion.button
              onClick={async () => {
                try {
                  if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(showAppealRedirectModal.appealUrl); toast.success('URL copied! Paste in browser.'); }
                  else { const el = document.getElementById('appeal-url-display'); if (el) { const range = document.createRange(); range.selectNodeContents(el); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range); toast('URL selected! Long press to copy', { icon: '📋', duration: 3000 }); } }
                } catch (_) { const el = document.getElementById('appeal-url-display'); if (el) { const range = document.createRange(); range.selectNodeContents(el); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range); toast('URL selected! Long press to copy', { icon: '📋', duration: 4000 }); } }
              }}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white py-4 px-6 rounded-lg font-semibold text-lg flex items-center justify-center space-x-3 transition-all shadow-lg"
              whileTap={{ scale: 0.98 }}>
              <FileText size={24} /><span>Copy Link</span>
            </motion.button>
          </div>
          </motion.div>
        </motion.div>
      )}

      {/* Lock Alert Modal */}
      {showLockAlertModal.isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowLockAlertModal({ isOpen: false, orderId: '', userRole: 'buyer' })}>
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl w-full max-w-md border border-white/20 text-white overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center"><AlertCircle size={24} className="text-white" /></div>
              <div><h3 className="text-xl font-bold text-white">Important Instructions</h3><p className="text-sm text-gray-400">{showLockAlertModal.userRole === 'buyer' ? 'For Buyer' : 'For Seller'}</p></div>
            </div>
            <button onClick={() => setShowLockAlertModal({ isOpen: false, orderId: '', userRole: 'buyer' })} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"><X size={20} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
              {showLockAlertModal.userRole === 'buyer' ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 mb-2"><AlertCircle size={20} className="text-yellow-400" /><span className="font-semibold text-yellow-300">Buyer Instructions</span></div>
                  <p className="text-white text-base leading-relaxed"><strong>⚠️ Important:</strong> Agent branch me payment ke baad hi confirm karo.</p>
                  <p className="text-gray-300 text-sm mt-2">Please complete the payment at the agent branch first, then click "Confirm Payment Sent".</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 mb-2"><AlertCircle size={20} className="text-yellow-400" /><span className="font-semibold text-yellow-300">Seller Instructions</span></div>
                  <p className="text-white text-base leading-relaxed"><strong>⚠️ Important:</strong> Payment milne ke baad confirm button dabao.</p>
                  <p className="text-gray-300 text-sm mt-2">Only click "Confirm Payment Received" after you have actually received the payment.</p>
                </div>
              )}
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-blue-300 text-sm">💡 This action is important for the security of the transaction.</p>
            </div>
          </div>
          <div className="p-6 border-t border-white/10 bg-white/5">
            <motion.button onClick={() => setShowLockAlertModal({ isOpen: false, orderId: '', userRole: 'buyer' })}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white py-3 px-4 rounded-lg font-medium transition-all"
              whileTap={{ scale: 0.98 }}>Got It</motion.button>
          </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Orders;