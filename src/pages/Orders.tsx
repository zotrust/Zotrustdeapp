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
import { TOKENS } from '../config/contracts';

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
  const [serverTime, setServerTime] = useState<number>(Date.now()); // Server time in milliseconds
  const [editForm, setEditForm] = useState({
    priceInr: '',
    minAmount: '',
    maxAmount: '',
    active: true
  });
  // const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
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
  const { address, connectionError, clearError } = useWalletStore();
  const { user } = useUserStore();
  const { setUnreadOrdersCount, clearUnreadOrdersCount } = useNotificationStore();
  
  // Track ongoing user info requests to prevent duplicates
  const fetchingUsers = useRef(new Set<string>());
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const socketRef = useRef<any>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentTargetRef = useRef<string | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ICE servers configuration
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // WebRTC functions for incoming calls - MUST BE DEFINED BEFORE useEffect
  const createPeerConnection = useCallback(() => {
    console.log('📞 Orders: Creating peer connection');
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = (event) => {
      if (event.candidate && currentTargetRef.current) {
        console.log('📞 Orders: Sending ICE candidate to', currentTargetRef.current);
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          to: currentTargetRef.current
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('📞 Orders: Received remote track:', event.track.kind);
      // Handle remote audio stream
      if (event.streams && event.streams[0]) {
        // You can add audio element handling here if needed
        console.log('📞 Orders: Remote audio stream received');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('📞 Orders: Connection state:', pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        console.log('📞 Orders: Call connected!');
        setIsCallActive(true);
        toast.success('Call connected!');
      } else if (pc.connectionState === 'disconnected' || 
                 pc.connectionState === 'failed') {
        console.log('📞 Orders: Call disconnected');
        setIsCallActive(false);
        setIncomingCall(null);
        toast('Call ended', { icon: '📞' });
      }
    };

    return pc;
  }, []);

  // Cleanup function to reset all call-related state - MUST BE DEFINED BEFORE useEffect
  const cleanupCall = useCallback(() => {
    console.log('📞 Orders: Cleaning up call state');
    
    // Cleanup WebRTC resources
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Reset all call-related state
    setIsCallActive(false);
    setIncomingCall(null);
    setCallModal({
      isOpen: false,
      targetAddress: '',
      targetName: undefined,
      context: undefined
    });
    currentTargetRef.current = null;
    
    // Set last call end time to prevent immediate re-calling
    setLastCallEndTime(Date.now());

    console.log('📞 Orders: Call state cleaned up');
  }, [address]);

  // Accept incoming call - MUST BE DEFINED BEFORE useEffect
  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      console.log('📞 Orders: Accepting incoming call from', incomingCall.from);
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }, 
        video: false 
      });
      
      localStreamRef.current = stream;
      currentTargetRef.current = incomingCall.from;

      // Create peer connection
      peerConnectionRef.current = createPeerConnection();

      // Add local audio tracks
      stream.getAudioTracks().forEach(track => {
        peerConnectionRef.current!.addTrack(track, stream);
      });

      // Set remote description and create answer
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      // Send answer back to caller
      socketRef.current.emit('answer', {
        answer,
        to: incomingCall.from
      });

      // Open call modal
      setCallModal({
        isOpen: true,
        targetAddress: incomingCall.from,
        targetName: `User ${incomingCall.from.slice(0, 8)}`,
        context: 'Incoming Call'
      });

      // Clear incoming call state
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

    socketRef.current.on('disconnect', () => {
      console.log('📞 Orders: Disconnected from signaling server');
      setIsRegistered(false);
    });

    socketRef.current.on('reconnect', () => {
      console.log('📞 Orders: Reconnected to signaling server');
      if (user?.address && socketRef.current) {
      socketRef.current.emit('register', user.address);
      setIsRegistered(true);
      }
    });

    // Handle connection state changes
    socketRef.current.on('connect', () => {
      console.log('📞 Orders: Connected to signaling server');
      // Always re-register on connect (handles both initial connect and reconnect)
      if (user?.address && socketRef.current) {
        socketRef.current.emit('register', user.address);
        setIsRegistered(true);
        console.log('📞 Orders: User re-registered:', user.address);
      }
    });

    // Start heartbeat to keep connection alive
    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current && socketRef.current.connected && user?.address) {
        socketRef.current.emit('ping');
      }
    }, 30000); // Send ping every 30 seconds

    const handleOffer = async ({ offer, from }: { offer: any; from: string }) => {
      console.log('📞 Orders: Received incoming call from', from);
      toast.success(`Incoming call from ${from.slice(0, 8)}...`);
      
      if (autoAcceptCalls) {
        // Auto-accept the call
        console.log('📞 Orders: Auto-accepting incoming call');
        setIncomingCall({
          from,
          offer,
          isOpen: true
        });
        // Auto-accept after a short delay
        setTimeout(() => {
          acceptIncomingCall();
        }, 1000);
      } else {
        // Show accept/reject interface
        setIncomingCall({
          from,
          offer,
          isOpen: true
        });
      }
    };

    const handleIceCandidate = ({ candidate, from }: { candidate: any; from: string }) => {
      console.log('📞 Orders: Received ICE candidate from', from);
      if (peerConnectionRef.current && candidate) {
        peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(candidate)
        ).catch(err => console.error('Error adding ICE candidate:', err));
      }
    };

    const handleAnswer = async ({ answer, from }: { answer: any; from: string }) => {
      console.log('📞 Orders: Received answer from', from);
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        setIsCallActive(true);
        toast.success('Call connected!');
      }
    };

    const handleCallEnded = ({ from }: { from: string }) => {
      console.log('📞 Orders: Call ended by', from);
      cleanupCall();
      toast('Call ended', { icon: '📞' });
    };

    const handleUserNotFound = ({ target }: { target: string }) => {
      console.log('📞 Orders: Target user not found:', target);
      toast.error('User not available for calling');
      cleanupCall();
    };

    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('ice-candidate', handleIceCandidate);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('call-ended', handleCallEnded);
    socketRef.current.on('user-not-found', handleUserNotFound);

    // Handle registration confirmation
    socketRef.current.on('registration-confirmed', ({ userId, socketId }: { userId: string; socketId: string }) => {
      console.log('📞 Orders: Registration confirmed:', { userId, socketId });
      setIsRegistered(true);
    });

    // Handle user status
    socketRef.current.on('user-status', ({ userId, isOnline, socketId }: { userId: string; isOnline: boolean; socketId: string }) => {
      console.log('📞 Orders: User status:', { userId, isOnline, socketId });
    });

    // Handle pong for heartbeat
    socketRef.current.on('pong', () => {
      console.log('📞 Orders: Heartbeat received');
    });

    // Handle online users list
    socketRef.current.on('online-users', (users: string[]) => {
      console.log('📞 Orders: Online users:', users);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off('offer', handleOffer);
        socketRef.current.off('ice-candidate', handleIceCandidate);
        socketRef.current.off('answer', handleAnswer);
        socketRef.current.off('call-ended', handleCallEnded);
        socketRef.current.off('user-not-found', handleUserNotFound);
        socketRef.current.disconnect();
      }
      // Clear heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [user?.address, acceptIncomingCall, cleanupCall, autoAcceptCalls]);

  const rejectIncomingCall = useCallback(() => {
    console.log('📞 Orders: Rejecting incoming call from', incomingCall?.from);
    setIncomingCall(null);
    toast('Call rejected', { icon: '📞' });
  }, [incomingCall]);

  // Function to ensure user is registered before making calls
  const ensureUserRegistered = useCallback(async (): Promise<boolean> => {
    if (!socketRef.current || !user?.address) {
      console.log('📞 Orders: No socket or user address');
      return false;
    }

    if (!socketRef.current.connected) {
      console.log('📞 Orders: Socket not connected, attempting to reconnect');
      return false;
    }

    if (!isRegistered) {
      console.log('📞 Orders: User not registered, re-registering');
      socketRef.current.emit('register', user.address);
      setIsRegistered(true);
      
      // Wait a bit for registration to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return isRegistered;
  }, [isRegistered, user?.address]);

  // Function to check if target user is online
  const checkUserStatus = useCallback((targetAddress: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve(false);
        return;
      }

      const timeout = setTimeout(() => {
        console.log('📞 Orders: User status check timeout');
        resolve(false);
      }, 3000);

      socketRef.current.once('user-status', ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
        clearTimeout(timeout);
        console.log('📞 Orders: User status received:', { userId, isOnline });
        resolve(isOnline);
      });

      socketRef.current.emit('check-user-status', targetAddress);
    });
  }, []);

  // Function to get list of online users (currently unused)
  // const getOnlineUsers = (): Promise<string[]> => {
  //   return new Promise((resolve) => {
  //     if (!socketRef.current) {
  //       resolve([]);
  //       return;
  //     }

  //     const timeout = setTimeout(() => {
  //       console.log('📞 Orders: Online users check timeout');
  //       resolve([]);
  //     }, 3000);

  //     socketRef.current.once('online-users', (users: string[]) => {
  //       clearTimeout(timeout);
  //       console.log('📞 Orders: Online users received:', users);
  //       resolve(users);
  //     });

  //     socketRef.current.emit('get-online-users');
  //   });
  // };

  useEffect(() => {
    console.log('🔄 Orders useEffect: Address changed:', address);
    if (address) {
      console.log('✅ Orders useEffect: Fetching orders and ads for address:', address);
      fetchOrders();
      fetchMyAds();
    } else {
      console.log('❌ Orders useEffect: No address, skipping fetch');
    }
  }, [address]);

  // Clear unread count when Orders page is viewed/mounted
  useEffect(() => {
    // Clear count when component mounts (user is viewing orders page)
    clearUnreadOrdersCount();
  }, [clearUnreadOrdersCount]);

  // Add timer to force re-render every second to update countdown and server time
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
      // Increment server time by 1 second to stay in sync
      setServerTime(prev => prev + 1000);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-refresh orders every 20 seconds
  useEffect(() => {
    if (!address) return;
    
    const refreshTimer = setInterval(() => {
      console.log('🔄 Auto-refreshing orders every 20 seconds...');
      fetchOrders();
    }, 15000); // 20 seconds

    return () => clearInterval(refreshTimer);
  }, [address]);

  const fetchOrders = async () => {
    console.log('🔄 fetchOrders: Starting to fetch orders');
    setIsLoading(true);
    setOrdersError(null);
    
    // Store previous orders to detect state changes
    const previousOrders = orders;
    
    try {
      let token = localStorage.getItem('authToken') || '';
      console.log('🔑 fetchOrders: Token exists:', !!token);
      
      // If no token but wallet is connected, try auto-login
      if (!token && address) {
        console.log('🔄 Orders: No token but wallet connected, attempting auto-login...');
        try {
          const message = 'Sign this message to authenticate with Zotrust';
          const signature = await (window as any).ethereum.request({
            method: 'personal_sign',
            params: [message, address],
          });
          
          const { loginWithWallet } = useUserStore.getState();
          const success = await loginWithWallet(address, signature, message);
          if (success) {
            token = localStorage.getItem('authToken') || '';
            console.log('✅ Orders: Auto-login successful, token:', !!token);
          }
        } catch (loginError) {
          console.error('❌ Orders: Auto-login failed:', loginError);
        }
      }
      
      // Fetch all orders for the current user
      const response = await fetch(`/api/orders/my-orders`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('📡 fetchOrders: Response status:', response.status);
      
      if (!response.ok) {
        let details = '';
        try {
          const errJson = await response.json();
          details = errJson?.error || errJson?.message || String(response.status);
          console.log('❌ fetchOrders: Error response:', errJson);
        } catch (_) {}
        throw new Error(details || `HTTP ${response.status}`);
      }
      
      const json = await response.json();
      console.log('📊 fetchOrders: Raw response data:', json);
      const rows = json.data || [];
      console.log('📋 fetchOrders: Orders count:', rows.length);

      // Update server time from response
      if (json.meta?.server_time) {
        const serverTimeMs = new Date(json.meta.server_time).getTime();
        setServerTime(serverTimeMs);
        const localTimeMs = Date.now();
        const diffMs = Math.abs(serverTimeMs - localTimeMs);
        const diffSeconds = Math.floor(diffMs / 1000);
        console.log('⏰ fetchOrders: Server time sync:', {
          server_time: json.meta.server_time,
          server_time_ms: serverTimeMs,
          server_time_utc: new Date(serverTimeMs).toUTCString(),
          server_time_local: new Date(serverTimeMs).toLocaleString(),
          local_time_ms: localTimeMs,
          local_time_utc: new Date(localTimeMs).toUTCString(),
          local_time_local: new Date(localTimeMs).toLocaleString(),
          time_diff_seconds: diffSeconds,
          note: diffSeconds > 60 ? '⚠️ System time might be wrong!' : '✅ Time in sync'
        });
      }

      // Map DB fields (snake_case) to frontend Order shape
      const mapped: Order[] = rows.map((r: any) => ({
        id: String(r.id),
        adId: String(r.ad_id),
        adType: r.ad_type, // ✅ CRITICAL: Ad type from original ad (BUY/SELL)
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
        // Attach optional fields for UI without changing core Order type
        ...(r.blockchain_trade_id ? { blockchain_trade_id: r.blockchain_trade_id } : {}),
        ...(r.buyer_name ? { buyerName: r.buyer_name } : {}),
        ...(r.seller_name ? { sellerName: r.seller_name } : {}),
      }));

      setOrders(mapped);
      
      // Update unread orders count when orders are fetched
      // This will be cleared when user views the orders page
      if (mapped.length > 0) {
        setUnreadOrdersCount(mapped.length);
      } else {
        clearUnreadOrdersCount();
      }
      
      // Check for state changes and show popover to buyers
      if (previousOrders.length > 0) {
        mapped.forEach(newOrder => {
          const previousOrder = previousOrders.find(prev => prev.id === newOrder.id);
          if (previousOrder && previousOrder.state === 'ACCEPTED' && newOrder.state === 'LOCKED') {
            // Check if current user is the buyer
            const isBuyer = newOrder.buyerAddress.toLowerCase() === address?.toLowerCase();
            if (isBuyer) {
              console.log('🔒 Funds locked! Showing popover to buyer for order:', newOrder.id);
              setShowFundLockedPopover({ isOpen: true, orderId: newOrder.id });
            }
          }
        });
      }
      
    } catch (error: any) {
      console.error('💥 fetchOrders: Error:', error);
      setOrdersError(`Failed to load orders${error?.message ? `: ${error.message}` : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyAds = async () => {
    // console.log('🔄 fetchMyAds: Starting to fetch my ads');
    setIsLoadingAds(true);
    setAdsError(null);
    try {
      let token = localStorage.getItem('authToken') || '';
      // console.log('🔑 fetchMyAds: Token exists:', !!token);
      
      // If no token but wallet is connected, try auto-login
      if (!token && address) {
        // console.log('🔄 Orders: No token but wallet connected, attempting auto-login...');
        try {
          const message = 'Sign this message to authenticate with Zotrust';
          const signature = await (window as any).ethereum.request({
            method: 'personal_sign',
            params: [message, address],
          });
          
          const { loginWithWallet } = useUserStore.getState();
          const success = await loginWithWallet(address, signature, message);
          if (success) {
            token = localStorage.getItem('authToken') || '';
            // console.log('✅ Orders: Auto-login successful, token:', !!token);
          }
        } catch (loginError) {
          console.error('❌ Orders: Auto-login failed:', loginError);
        }
      }
      
      // Fetch my ads
      const response = await fetch(`/api/ads/my-ads`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      // console.log('📡 fetchMyAds: Response status:', response.status);
      
      if (!response.ok) {
        let details = '';
        try {
          const errJson = await response.json();
          details = errJson?.error || errJson?.message || String(response.status);
          console.log('❌ fetchMyAds: Error response:', errJson);
        } catch (_) {}
        throw new Error(details || `HTTP ${response.status}`);
      }
      
      const json = await response.json();
      // console.log('📊 fetchMyAds: Raw response data:', json);
      const rows = json.data || [];
      // console.log('📋 fetchMyAds: Ads count:', rows.length);

      // Map DB fields (snake_case) to frontend Ad shape
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

      console.log('✅ fetchMyAds: Mapped ads:', mapped);
      setMyAds(mapped);
    } catch (error: any) {
      console.error('💥 fetchMyAds: Error:', error);
      setAdsError(`Failed to load ads${error?.message ? `: ${error.message}` : ''}`);
    } finally {
      setIsLoadingAds(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    console.log('✅ handleAcceptOrder: Accepting order and auto-locking funds:', orderId);
    
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      toast.error('Order not found');
      return;
    }

    // Check expiry using proper timezone conversion
    const expiryData = calculateOrderExpiry(order);
    
    if (expiryData.isExpired) {
      toast.error(`Order expired. Max wait time is ${APP_CONFIG.ACCEPT_TIMEOUT_MINUTES} minutes.`);
      console.log('❌ Order expired:', {
        orderId: order.id,
        startTimeIST: expiryData.startTimeIST,
        expiryTimeIST: expiryData.expiryTimeIST,
        timeRemaining: expiryData.timeRemainingSeconds
      });
      return;
    }
      
    try {
      const token = localStorage.getItem('authToken') || '';
      
      // Step 1: Accept the order
      toast.loading('Accepting order...', { id: 'accept-flow' });
      
      const acceptResponse = await fetch(`/api/orders/${orderId}/accept-simple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!acceptResponse.ok) {
        const errorData = await acceptResponse.json();
        toast.error(errorData.error || 'Failed to accept order', { id: 'accept-flow' });
        return;
      }

      const acceptData = await acceptResponse.json();
      console.log('✅ Order accepted:', acceptData);
      
      toast.success('Order accepted! Starting automatic fund lock...', { 
        id: 'accept-flow', 
        duration: 3000 
      });

      // Step 2: Automatically trigger fund lock process
      console.log('🔒 Auto-triggering fund lock process...');
      await handleLockFunds(orderId);
      
    } catch (error) {
      console.error('💥 handleAcceptOrder Error:', error);
      toast.error('Failed to accept order', { id: 'accept-flow' });
    }
  };

  const handleLockFunds = async (orderId: string) => {
    console.log('🔒 handleLockFunds: Starting fund lock process:', orderId);
    
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      toast.error('Order not found');
      return;
    }
    
    try {
      const token = localStorage.getItem('authToken') || '';
      
      // Step 1: Get OTP from backend
      console.log('🔐 Step 1: Getting OTP...');
      toast.loading('Preparing fund lock...', { id: 'lock-flow' });
      
      const prepareResponse = await fetch(`/api/orders/${orderId}/prepare-lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        throw new Error(errorData.error || 'Failed to prepare lock');
      }
      
      const prepareData = await prepareResponse.json();
      console.log('✅ Step 1 Complete: OTP received:', prepareData.data.otp);
      console.log('🔐 OTP Hash:', prepareData.data.otpHash);
      
      // Show OTP to seller
      toast.success(`OTP: ${prepareData.data.otp} - SAVE THIS!`, {
        id: 'lock-flow',
        duration: 8000,
        icon: '🔐'
      });
      
      // Get wallet instructions
      const walletInstructions = blockchainService.getWalletInstructions();
      
      // Confirm with user
      const shouldProceed = window.confirm(
        `🔐 Your OTP: ${prepareData.data.otp}\n\n` +
        `⚠️ SAVE THIS OTP!\n\n` +
        `Your funds will be locked for 2 hours. Once you have received the funds, please click the 'Received' button to confirm.\n\n` +
        `💡 ${walletInstructions}\n\n` +
        `Click OK to lock ${order?.amount} ${order?.token} on blockchain.`
      );
      
      if (!shouldProceed) {
        toast.error('Lock cancelled', { id: 'lock-flow' });
        return;
      }
      
      // Step 2: Create trade and lock funds together (NEW FLOW)
      console.log('⛓️ Step 2: Creating trade and locking funds...');
      toast.loading('Creating trade and locking funds on blockchain...', { id: 'lock-flow' });
      
      // Check wallet type and show instructions
      console.log('💡 Wallet instructions:', blockchainService.getWalletInstructions());
      
      // Get token config
      const tokenSymbol = order?.token || 'BNB';
      const tokenConfig = ((TOKENS as any)[tokenSymbol]) || TOKENS.BNB;
      const tokenAddress = tokenConfig.address;
      const isNativeBNB = tokenConfig.isNative || false;
      
      // Determine counterParty
      let counterParty = '';
      if (order?.adType === 'SELL') {
        // SELL ad: Ad owner (seller) is locking, counterParty is buyer
        counterParty = order.buyerAddress;
      } else {
        // BUY ad: Order creator (seller) is locking, counterParty is ad owner (buyer)
        counterParty = order.adOwnerAddress || order.buyerAddress;
      }
      
      console.log('📊 Ad Type:', order?.adType);
      console.log('🪙 Token:', tokenSymbol, '→ Address:', tokenAddress);
      console.log('💰 Amount:', order?.amount);
      console.log('👤 Buyer (counterParty):', counterParty);
      console.log('ℹ️ Seller (caller) will create trade and lock funds');
      
      let blockchainTradeId: number;
      let createTradeTxHash: string;
      let lockFundsTxHash: string;
      
      try {
        // NEW FLOW: Create trade and lock funds together
        const result = await blockchainService.createTradeAndLockFunds(
          {
            token: tokenAddress,
            amount: order?.amount?.toString() || '0',
            buyer: counterParty,
            isNativeBNB: isNativeBNB
          },
          tokenAddress,
          order?.amount?.toString() || '0'
        );
        
        blockchainTradeId = result.tradeId;
        createTradeTxHash = result.createTradeTxHash;
        lockFundsTxHash = result.lockFundsTxHash;
        
        console.log('✅ Step 2 Complete: Trade created and funds locked!');
        console.log('🆔 Trade ID:', blockchainTradeId);
        console.log('📡 Create Trade TX Hash:', createTradeTxHash);
        console.log('📡 Lock Funds TX Hash:', lockFundsTxHash);
        
        toast.success(`Trade created and funds locked! ID: ${blockchainTradeId}`, {
          id: 'lock-flow',
          duration: 5000
        });
        
      } catch (error: any) {
        console.error('💥 Step 2 FAILED:', error);
        toast.error(`Failed to create trade and lock funds: ${error.message}`, {
          id: 'lock-flow',
          duration: 8000
        });
        return;
      }
      
      // Step 3: Update database
      console.log('💾 Step 3: Updating database...');
      console.log('📊 Step 3: Data to send:', {
        txHash: lockFundsTxHash,
        otpHash: prepareData.data.otpHash,
        blockchainTradeId: blockchainTradeId,
        blockchainTradeIdType: typeof blockchainTradeId,
        createTradeTxHash: createTradeTxHash
      });
      
      // Ensure blockchainTradeId is a number
      const tradeIdToSend = Number(blockchainTradeId);
      if (isNaN(tradeIdToSend) || tradeIdToSend <= 0) {
        console.error('❌ Step 3: Invalid blockchain trade ID:', blockchainTradeId);
        toast.error('Invalid blockchain trade ID. Please try again.', { id: 'lock-flow' });
        return;
      }
      
      console.log('✅ Step 3: Validated trade ID to send:', tradeIdToSend);
      
      toast.loading('Finalizing...', { id: 'lock-flow' });
      
      const finalizeResponse = await fetch(`/api/orders/${orderId}/lock-funds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          txHash: lockFundsTxHash,
          otpHash: prepareData.data.otpHash,
          blockchainTradeId: tradeIdToSend,
          createTradeTxHash: createTradeTxHash
        })
      });
      
      if (finalizeResponse.ok) {
        console.log('✅ Step 3 Complete: Database updated');
        
        toast.success(
          `Funds locked successfully!\n` +
          `OTP: ${prepareData.data.otp}\n` +
          `Trade ID: ${blockchainTradeId}`,
          {
            id: 'lock-flow',
            duration: 10000,
            icon: '🎉'
          }
        );
        
        console.log('🔗 View TX: https://bscscan.com/tx/' + lockFundsTxHash);
        
        fetchOrders(); // Refresh to show updated state
      } else {
        const errorData = await finalizeResponse.json();
        toast.error(errorData.error || 'Failed to finalize', { id: 'lock-flow' });
      }
      
    } catch (error) {
      console.error('💥 handleLockFunds Error:', error);
      toast.error('Failed to lock funds', { id: 'lock-flow' });
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    console.log('❌ handleRejectOrder: Rejecting order:', orderId);
    try {
      const token = localStorage.getItem('authToken') || '';
      console.log('🔑 handleRejectOrder: Token exists:', !!token);
      
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: 'Rejected by seller' }),
      });

      console.log('📡 handleRejectOrder: Response status:', response.status);

      if (response.ok) {
        console.log('✅ handleRejectOrder: Order rejected successfully');
        toast.success('Order rejected');
        fetchOrders();
      } else {
        let msg = 'Failed to reject order';
        try { 
          const j = await response.json(); 
          msg = j?.error || msg; 
          console.log('❌ handleRejectOrder: Error response:', j);
        } catch(_){ }
        console.error('❌ handleRejectOrder: Failed to reject order:', msg);
        toast.error(msg);
      }
    } catch (error) {
      console.error('💥 handleRejectOrder: Error:', error);
      toast.error('Failed to reject order');
    }
  };


  const handleEditAd = (ad: Ad) => {
    console.log('✏️ handleEditAd: Starting to edit ad:', ad.id);
    setEditingAd(ad);
    setEditForm({
      priceInr: ad.priceInr,
      minAmount: ad.minAmount,
      maxAmount: ad.maxAmount,
      active: ad.active
    });
  };

  const handleUpdateAd = async () => {
    if (!editingAd) return;
    
    console.log('💾 handleUpdateAd: Updating ad:', editingAd.id);
    try {
      const token = localStorage.getItem('authToken') || '';
      console.log('🔑 handleUpdateAd: Token exists:', !!token);
      
      const response = await fetch(`/api/ads/${editingAd.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          price_inr: parseFloat(editForm.priceInr),
          min_amount: parseFloat(editForm.minAmount),
          max_amount: parseFloat(editForm.maxAmount),
          active: editForm.active
        }),
      });

      console.log('📡 handleUpdateAd: Response status:', response.status);

      if (response.ok) {
        console.log('✅ handleUpdateAd: Ad updated successfully');
        toast.success('Ad updated successfully');
        setEditingAd(null);
        fetchMyAds();
      } else {
        let msg = 'Failed to update ad';
        try { 
          const j = await response.json(); 
          msg = j?.error || msg; 
          console.log('❌ handleUpdateAd: Error response:', j);
        } catch(_){ }
        console.error('❌ handleUpdateAd: Failed to update ad:', msg);
        toast.error(msg);
      }
    } catch (error) {
      console.error('💥 handleUpdateAd: Error:', error);
      toast.error('Failed to update ad');
    }
  };

  const handleDeleteAd = async (adId: string) => {
    console.log('🗑️ handleDeleteAd: Deleting ad:', adId);
    
    if (!confirm('Are you sure you want to delete this ad? This action cannot be undone.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('authToken') || '';
      console.log('🔑 handleDeleteAd: Token exists:', !!token);
      
      const response = await fetch(`/api/ads/${adId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      console.log('📡 handleDeleteAd: Response status:', response.status);

      if (response.ok) {
        console.log('✅ handleDeleteAd: Ad deleted successfully');
        toast.success('Ad deleted successfully');
        fetchMyAds();
      } else {
        let msg = 'Failed to delete ad';
        try { 
          const j = await response.json(); 
          msg = j?.error || msg; 
          console.log('❌ handleDeleteAd: Error response:', j);
        } catch(_){ }
        console.error('❌ handleDeleteAd: Failed to delete ad:', msg);
        toast.error(msg);
      }
    } catch (error) {
      console.error('💥 handleDeleteAd: Error:', error);
      toast.error('Failed to delete ad');
    }
  };

  // Dispute Resolution Functions
  const fetchDisputeStatus = async (orderId: string) => {
    try {
      const token = localStorage.getItem('authToken') || '';
      const response = await fetch(`/api/disputes/${orderId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDisputeData(prev => ({
          ...prev,
          [orderId]: data.data
        }));
        return data.data;
      }
    } catch (error) {
      console.error('Error fetching dispute status:', error);
    }
    return null;
  };

  const handleConfirmPayment = async (orderId: string, type: 'SENT' | 'RECEIVED') => {
    try {
      // Find order and trade id
      const order = orders.find(o => o.id === orderId);
      if (!order) { toast.error('Order not found'); return; }
      console.log(order);
      
      // Check if order is in a state that requires blockchain trade id
      if (order.state !== 'LOCKED' && order.state !== 'UNDER_DISPUTE' && order.state !== 'APPEALED') {
        toast.error(`Order must be LOCKED, UNDER_DISPUTE, or APPEALED to confirm payment. Current state: ${order.state}`);
        return;
      }
      
      // We expect backend dispute status to populate blockchain_trade_id, but Orders list may not include it.
      // Try to fetch dispute status to get it if missing.
      let tradeId: number | undefined = (order as any)?.blockchain_trade_id || (order as any)?.blockchainTradeId;
      if (!tradeId) {
        console.log('🔍 Blockchain trade ID not in order, fetching from dispute status...');
        const status = await fetchDisputeStatus(orderId);
        tradeId = Number(status?.blockchain_trade_id || status?.blockchainTradeId);
      }
      if (!tradeId || Number.isNaN(tradeId)) {
        toast.error('Missing blockchain trade id. The order may not have been locked on the blockchain yet. Please wait for the seller to lock funds.');
        console.error('Missing blockchain_trade_id for order:', {
          orderId,
          orderState: order.state,
          orderData: order
        });
        return;
      }

      // First perform on-chain confirmation with the user's wallet
      if (type === 'SENT') {
        await blockchainService.markPaid(tradeId);
      } else {
        await blockchainService.markReceived(tradeId);
      }

      // Then notify backend to record off-chain confirmation and progress timeline
      const token = localStorage.getItem('authToken') || '';
      const endpoint = type === 'SENT' 
        ? `/api/disputes/${orderId}/confirm-payment-sent`
        : `/api/disputes/${orderId}/confirm-payment-received`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.data.message || 'Payment confirmation recorded');
        fetchDisputeStatus(orderId);
        fetchOrders(); // Refresh orders
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to confirm payment');
      }
    } catch (error: any) {
      console.error('Error confirming payment:', error);
      
      // Handle user rejection more gracefully
      if (error?.message?.includes('cancelled') || 
          error?.message?.includes('rejected') ||
          error?.code === 'ACTION_REJECTED' ||
          error?.code === 4001) {
        // User intentionally rejected - show softer message
        toast('Payment confirmation cancelled. You can try again when ready.', {
          icon: 'ℹ️',
          duration: 4000
        });
      } else {
        // Other errors - show full error message
        toast.error(error?.reason || error?.message || 'Failed to confirm payment');
      }
    }
  };

  // Detect if user is in DApp browser (Trust Wallet, MetaMask, etc.)
  const isDAppBrowser = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Check for common DApp browser indicators
    const dappBrowsers = [
      'trustwallet',
      'metamask',
      'coinbase',
      'rainbow',
      'imtoken',
      'tokenpocket',
      'safepal',
      'bitget',
      'okx',
      'binance',
      'huobi',
      'gate.io',
      'kucoin',
      'bybit',
      'crypto.com',
      'dapp',
      'web3',
      'wallet'
    ];
    
    return dappBrowsers.some(browser => userAgent.includes(browser));
  };

  // Handle file appeal redirect to external browser
  const handleFileAppealRedirect = (orderId: string) => {
    if (isDAppBrowser()) {
      // Get current URL and construct external browser URL with wallet address
      const currentUrl = window.location.href;
      const baseUrl = currentUrl.split('/#')[0]; // Remove hash routing
      const walletAddress = address || 'unknown';
      
      // Check if current URL already contains /orders to avoid duplication
      let appealUrl;
      if (baseUrl.includes('/orders')) {
        // If already in orders, just add the appeal path
        appealUrl = `${baseUrl}/appeal/${walletAddress}/${orderId}`;
      } else {
        // If not in orders, add the full path
        appealUrl = `${baseUrl}/orders/appeal/${walletAddress}/${orderId}`;
      }
      
      // Show confirmation dialog
      const shouldRedirect = window.confirm(
        `📱 DApp Browser Detected!\n\n` +
        `To access camera and recording features for your appeal, you need to open this in your default browser (Chrome, Safari, etc.).\n\n` +
        `Click OK to open in external browser.\n\n` +
        `This will redirect you to: ${appealUrl}\n\n` +
        `Wallet: ${walletAddress}\n` +
        `Order: ${orderId}`
      );
      
      if (shouldRedirect) {
        // Try to open in external browser
        try {
          // Method 1: Direct window.open (works on some DApp browsers)
          window.open(appealUrl, '_blank');
          
          // Method 2: Copy to clipboard as fallback
          navigator.clipboard.writeText(appealUrl).then(() => {
            toast.success('URL copied to clipboard! Paste it in your browser.');
          }).catch(() => {
            // Method 3: Show URL for manual copy
            toast.error('Please copy this URL and open in your browser: ' + appealUrl);
          });
          
        } catch (error) {
          console.error('Error opening external browser:', error);
          toast.error('Please copy this URL and open in your browser: ' + appealUrl);
        }
      }
    } else {
      // Not in DApp browser, proceed normally with new URL format
      navigate(`/orders/${orderId}/appeal`);
    }
  };

  const handleFileAppeal = async (orderId: string, appealData: any) => {
    try {
      const token = localStorage.getItem('authToken') || '';
      const response = await fetch(`/api/disputes/${orderId}/appeal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
      console.error('Error filing appeal:', error);
      toast.error('Failed to file appeal');
    }
  };

  const openDisputeModal = (orderId: string) => {
    setShowDisputeModal({isOpen: true, orderId});
    fetchDisputeStatus(orderId);
  };

  // const getTimeRemaining = (startTime: string): number => {
  //   const start = new Date(startTime).getTime();
  //   const now = serverTime; // Use server time instead of client time
  //   const elapsed = now - start;
  //   const timeoutMs = APP_CONFIG.ACCEPT_TIMEOUT_MINUTES * 60 * 1000;
  //   const remaining = timeoutMs - elapsed;
    
  //   // Debug logging
  //   if (elapsed < timeoutMs && elapsed > 0) {
  //     console.log('⏰ Time Calculation:', {
  //       start_time: startTime,
  //       start_time_ms: start,
  //       server_time_ms: now,
  //       elapsed_ms: elapsed,
  //       elapsed_seconds: Math.floor(elapsed / 1000),
  //       timeout_seconds: Math.floor(timeoutMs / 1000),
  //       remaining_seconds: Math.floor(remaining / 1000),
  //       start_date_utc: new Date(start).toUTCString(),
  //       server_date_utc: new Date(now).toUTCString(),
  //       start_date_local: new Date(start).toLocaleString(),
  //       server_date_local: new Date(now).toLocaleString()
  //     });
  //   }
    
  //   return Math.max(0, Math.floor(remaining / 1000));
  // };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Timezone conversion utilities (inline conversion used in calculateOrderExpiry)
  
  // Test function to verify UTC+05:30 conversion
  const testTimezoneConversion = () => {
    const testUTC = '2025-10-21T23:20:52.347Z';
    const utcDate = new Date(testUTC);
    const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes
    const istDate = new Date(utcDate.getTime() + istOffset);
    
    console.log('🧪 Timezone Conversion Test:', {
      inputUTC: testUTC,
      utcDate: utcDate.toISOString(),
      istOffset: '+05:30 (5.5 hours)',
      istOffsetMs: istOffset,
      istDate: istDate.toISOString(),
      istFormatted: formatISTDateTime(istDate),
      expectedIST: '22/10/2025, 04:50:52' // Should be 23:20 + 5:30 = 04:50 next day
    });
  };
  
  // Run test on component mount
  useEffect(() => {
    testTimezoneConversion();
  }, []);

  const formatISTDateTime = (date: Date): string => {
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const calculateOrderExpiry = useCallback((order: Order) => {
    // Step 1: Convert UTC start_time to IST (UTC + 5:30)
    const startTimeUTC = new Date(order.startTime);
    const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const startTimeIST = new Date(startTimeUTC.getTime() + istOffset);
    
    // Step 2: Add 5 minutes timeout to IST time
    const expiryTimeIST = new Date(startTimeIST.getTime() + (APP_CONFIG.ACCEPT_TIMEOUT_MINUTES * 60 * 1000));
    
    // Step 3: Calculate time remaining using current IST time
    const currentTimeUTC = new Date(serverTime);
    const currentTimeIST = new Date(currentTimeUTC.getTime() + istOffset);
    const timeRemainingMs = expiryTimeIST.getTime() - currentTimeIST.getTime();
    const timeRemainingSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
    
    const isExpired = timeRemainingSeconds <= 0;
    
    return {
      isExpired,
      timeRemainingSeconds,
      startTimeIST: formatISTDateTime(startTimeIST),
      expiryTimeIST: formatISTDateTime(expiryTimeIST)
    };
  }, [serverTime]);

  const getOrderStatusColor = useCallback((state: Order['state']) => {
    switch (state) {
      case 'CREATED':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'ACCEPTED':
        return 'text-blue-400 bg-blue-500/20';
      case 'LOCKED':
        return 'text-purple-400 bg-purple-500/20';
      case 'RELEASED':
        return 'text-green-400 bg-green-500/20';
      case 'CANCELLED':
        return 'text-red-400 bg-red-500/20';
      case 'EXPIRED':
        return 'text-gray-500 bg-gray-600/20';
      case 'UNDER_DISPUTE':
        return 'text-orange-400 bg-orange-500/20';
      case 'REFUNDED':
        return 'text-gray-400 bg-gray-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
    }
  }, []);

  // Handle call to other party - redirect to call page
  const handleCallUser = useCallback(async (_targetAddress: string, order: Order) => {
    try {
      if (!address) {
        toast.error('Please connect your wallet first');
        return;
      }
      
      // Check if DApp browser
      if (isDAppBrowser()) {
        // Get current URL and construct external browser URL
        const currentUrl = window.location.href;
        const baseUrl = currentUrl.split('/#')[0]; // Remove hash routing
        const callUrl = `${baseUrl}/call/${order.id}/${address}`;
        
        // Show confirmation dialog
        const shouldRedirect = window.confirm(
          `📱 DApp Browser Detected!\n\n` +
          `To make voice calls, you need to open this in your default browser (Chrome, Safari, etc.).\n\n` +
          `Click OK to open in external browser.\n\n` +
          `This will redirect you to: ${callUrl}\n\n` +
          `Wallet: ${address}\n` +
          `Order: ${order.id}`
        );
        
        if (shouldRedirect) {
          try {
            // Try to open in external browser
            window.open(callUrl, '_blank');
            
            // Copy to clipboard as fallback
            navigator.clipboard.writeText(callUrl).then(() => {
              toast.success('URL copied to clipboard! Paste it in your browser.');
            }).catch(() => {
              toast.error('Please copy this URL and open in your browser: ' + callUrl);
            });
          } catch (error) {
            console.error('Error opening external browser:', error);
            toast.error('Please copy this URL and open in your browser: ' + callUrl);
          }
        }
      } else {
        // Normal browser, navigate to call page
        navigate(`/call/${order.id}/${address}`);
      }
      
    } catch (error) {
      console.error('Error redirecting to call page:', error);
      toast.error('Failed to open call page');
    }
  }, [address, navigate]);

  const fetchUserInfo = useCallback(async (addr: string) => {
    const key = addr?.toLowerCase();
    if (!key) return undefined;
    
    // Return cached data if available
    if (userInfoMap[key]) return userInfoMap[key];
    
    // Check if request is already in progress
    if (fetchingUsers.current.has(key)) {
      // Wait for the existing request to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (userInfoMap[key]) {
            clearInterval(checkInterval);
            resolve(userInfoMap[key]);
          } else if (!fetchingUsers.current.has(key)) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
      });
    }
    
    // Mark as fetching
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
      // Remove from fetching set
      fetchingUsers.current.delete(key);
    }
    return undefined;
  }, [userInfoMap]);

  const filteredOrders = useMemo(() => {
    return statusFilter === 'ALL' ? orders : orders.filter(o => o.state === statusFilter);
  }, [orders, statusFilter]);

  // Prefetch counterpart user info (mobile) for orders list
  useEffect(() => {
    if (orders.length === 0) return;
    
    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    // Debounce the fetch operation
    fetchTimeoutRef.current = setTimeout(() => {
      // Get unique addresses to avoid duplicate requests
      const uniqueAddresses = new Set<string>();
      orders.forEach(order => {
        uniqueAddresses.add(order.buyerAddress.toLowerCase());
        uniqueAddresses.add(order.sellerAddress.toLowerCase());
      });
      
      // Only fetch for addresses we don't already have
      const addressesToFetch = Array.from(uniqueAddresses).filter(addr => 
        !userInfoMap[addr] && !fetchingUsers.current.has(addr)
      );
      
      if (addressesToFetch.length > 0) {
        console.log('🔄 Orders: Fetching user info for', addressesToFetch.length, 'unique addresses');
        
        // Fetch user info for all unique addresses
        addressesToFetch.forEach(async (addr) => {
          try {
            await fetchUserInfo(addr);
          } catch (error) {
            console.log('Error fetching user info for', addr, error);
          }
        });
      }
    }, 500); // 500ms debounce
    
    // Cleanup timeout on unmount
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [orders, fetchUserInfo]); // Fixed dependencies - removed userInfoMap to prevent infinite loop

  const canShowRedeem = (order: Order) => {
    if (order.state !== 'LOCKED') return false;
    const isSeller = order.sellerAddress.toLowerCase() === (address || '').toLowerCase();
    if (!isSeller) return false;
    const lockMs = new Date(order.lockExpiresAt as any).getTime();
    const nowMs = serverTime;
    // appeal window starts at lockExpiresAt; seller can redeem after +48h
    const appealDeadlineMs = lockMs + (48 * 60 * 60 * 1000);
    return nowMs > appealDeadlineMs;
  };

  const handleRedeem = async (order: Order) => {
    try {
      const tradeId = Number((order as any)?.blockchain_trade_id || (order as any)?.blockchainTradeId);
      if (!tradeId || Number.isNaN(tradeId)) {
        toast.error('Missing blockchain trade id. This order may not have been locked on the blockchain yet.');
        console.error('Missing blockchain_trade_id for redeem:', {
          orderId: order.id,
          orderState: order.state,
          orderData: order
        });
        return;
      }
      toast.loading('Redeeming on-chain...', { id: 'redeem' });
      const tx = await blockchainService.redeemAfterAppealWindow(tradeId);
      toast.success(`Redeemed! TX: ${tx.slice(0,10)}...`, { id: 'redeem' });
      fetchOrders();
    } catch (e: any) {
      toast.error(e?.reason || e?.message || 'Redeem failed', { id: 'redeem' });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="relative text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">My Trading</h2>
        <p className="text-gray-300 text-sm">Manage your orders and ads</p>
       

        {/* Wallet Status Indicator */}
        {address && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg p-3 mx-auto max-w-sm"
          >
            <div className="flex items-center justify-center space-x-2 text-white">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-sm font-medium">
                {blockchainService.isTrustWalletAvailable() ? 'Trust Wallet' : 'Wallet'} Connected
              </span>
            </div>
            <div className="text-xs text-white/80 mt-1 text-center">
              {address.slice(0, 6)}...{address.slice(-4)}
            </div>
          </motion.div>
        )}

        {/* Call Status Indicator */}
        {isCallActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-green-500 to-blue-500 rounded-lg p-3 mx-auto max-w-sm"
          >
            <div className="flex items-center justify-center space-x-2 text-white">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Call Active</span>
            </div>
          </motion.div>
        )}

        {/* Call Modal Status */}
        {callModal.isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg p-3 mx-auto max-w-sm"
          >
            <div className="flex items-center justify-center space-x-2 text-white">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Call Modal Open</span>
            </div>
          </motion.div>
        )}

     


        {/* Incoming Call Interface */}
        {incomingCall && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-green-500 to-blue-500 rounded-xl p-6 mx-auto max-w-sm text-white"
          >
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                <Phone size={32} className="text-white" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold">Incoming Call</h3>
                <p className="text-sm opacity-90">
                  From: {incomingCall.from.slice(0, 8)}...{incomingCall.from.slice(-6)}
                </p>
              </div>

              <div className="flex space-x-4">
                <motion.button
                  onClick={rejectIncomingCall}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center space-x-2"
                  whileTap={{ scale: 0.95 }}
                >
                  <XCircle size={20} />
                  <span>Reject</span>
                </motion.button>

                <motion.button
                  onClick={acceptIncomingCall}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center space-x-2"
                  whileTap={{ scale: 0.95 }}
                >
                  <Phone size={20} />
                  <span>Accept</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

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

      {ordersError && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3"
        >
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-300 text-sm font-medium">Orders Error</p>
            <p className="text-red-400 text-xs">{ordersError}</p>
          </div>
          <button
            onClick={() => setOrdersError(null)}
            className="p-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}

      {adsError && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3"
        >
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-300 text-sm font-medium">Ads Error</p>
            <p className="text-red-400 text-xs">{adsError}</p>
          </div>
          <button
            onClick={() => setAdsError(null)}
            className="p-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}

      {actionError && (
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center space-x-3"
        >
          <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-300 text-sm font-medium">Action Error</p>
            <p className="text-red-400 text-xs">{actionError}</p>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="p-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-1 border border-white/20">
        <div className="grid grid-cols-2 gap-1">
          {(['orders', 'ads'] as const).map((tab) => (
            <motion.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'py-3 px-4 rounded-lg font-medium transition-all capitalize',
                activeTab === tab
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                  : 'text-gray-300 hover:text-white'
              )}
              whileTap={{ scale: 0.98 }}
            >
              My {tab}
            </motion.button>
          ))}
        </div>
      </div>
      
      <div className=" right-0 top-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-white bg-slate-900 text-sm rounded-md px-3 py-2"
            title="Filter by status"
          >
            {['ALL','CREATED','ACCEPTED','LOCKED','RELEASED','CANCELLED','EXPIRED','UNDER_DISPUTE','UNDER_REVIEW','APPEALED','CONFIRMED','REFUNDED'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      {/* Content based on active tab */}
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12 space-y-4"
            >
              <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto">
                <Clock size={32} className="text-gray-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">No Orders Yet</h3>
                <p className="text-gray-300 text-sm">
                  Your order requests will appear here
                </p>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence>
              <div className="h-[400px] rounded-sm overflow-y-auto ">

           
              {filteredOrders.map((order) => {
              // Calculate expiry using proper timezone conversion - memoized per order
              // Only recalculate when serverTime or order.startTime changes
              const expiryData = calculateOrderExpiry(order);
              const isExpired = expiryData.isExpired;
              const timeRemaining = expiryData.timeRemainingSeconds;
              
              const isSeller = order.sellerAddress.toLowerCase() === address?.toLowerCase();
              const isBuyer = order.buyerAddress.toLowerCase() === address?.toLowerCase();
              
              // The person who created the ad should see Accept/Reject buttons
              // This is determined by checking if the current user is the ad owner
              const isAdOwner = order.adOwnerAddress?.toLowerCase() === address?.toLowerCase();
              
            

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white/10 backdrop-blur-lg  mb-2 orounded-xl p-4 border border-white/20 space-y-4"
                >
                  {/* Order Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-semibold">
                          {order.amount} {order.token}
                        </span>
                        <span className={clsx(
                          'px-2 py-1 rounded text-xs font-medium',
                          getOrderStatusColor(order.state)
                        )}>
                          {order.state}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm">
                        {isSeller ? 'Buyer' : 'Seller'}: {
                          (isSeller ? order.buyerAddress : order.sellerAddress)
                            .slice(0, 8) + '...' + 
                          (isSeller ? order.buyerAddress : order.sellerAddress)
                            .slice(-6)
                        }
                      </p>
                      <p className="text-xs text-gray-400">
                        Name: {(isSeller ? (order as any).buyerName : (order as any).sellerName) || '—'}
                      </p>
                      <p className="text-xs text-gray-400">
                        Mobile: {userInfoMap[(isSeller ? order.buyerAddress : order.sellerAddress).toLowerCase()]?.mobile || '—'}
                      </p>
                      <p className="text-xs text-gray-400">
                        You are the {isSeller ? 'Seller' : 'Buyer'} in this order
                        {isAdOwner && order.state === 'CREATED' && !isExpired && (
                          <span className="text-green-400 font-semibold"> - You can Accept/Reject (Ad Owner)</span>
                        )}
                      </p>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1 mt-1 inline-block">
                        <p className="text-xs text-blue-300">
                          📅 Created: <span className="font-semibold">{expiryData.startTimeIST}</span>
                        </p>
                        <p className="text-xs text-blue-200 mt-1">
                          ⏰ Expires: <span className="font-semibold">{expiryData.expiryTimeIST}</span>
                        </p>
                        <p className="text-xs text-blue-200">
                          🌍 Timezone: Asia/Kolkata (IST) UTC+05:30
                        </p>
                      </div>
                    </div>

                    {order.state === 'CREATED' && (
                      <div className="text-right space-y-1 ml-4">
                        <p className={`font-mono text-xl font-bold ${isExpired ? 'text-gray-500' : timeRemaining < 60 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                          {isExpired ? '0:00' : formatTime(timeRemaining)}
                        </p>
                        {!isExpired && timeRemaining > 0 && (
                          <p className="text-xs text-green-400 animate-pulse">
                            ⏰ Live countdown: {timeRemaining} seconds
                          </p>
                        )}
                        <p className="text-gray-400 text-xs">
                          {isExpired ? 'expired' : 'remaining'}
                        </p>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                          <div 
                            className={`h-1.5 rounded-full transition-all ${
                              isExpired ? 'bg-gray-500' : 
                              timeRemaining < 60 ? 'bg-red-500' : 
                              'bg-yellow-400'
                            }`}
                            style={{ width: `${isExpired ? 0 : (timeRemaining / 300) * 100}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          of 5:00 min
                        </p>
                      </div>
                    )}
                     <div className="flex space-x-2">
                        {/* Call Other Party Button */}
                        <motion.button
                          onClick={() => {
                            const targetAddress = isAdOwner 
                              ? (isSeller ? order.buyerAddress : order.sellerAddress)
                              : order.adOwnerAddress || (isBuyer ? order.sellerAddress : order.buyerAddress);
                            handleCallUser(targetAddress, order);
                          }}
                          className="p-3 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 flex items-center space-x-2"
                          whileTap={{ scale: 0.95 }}
                          whileHover={{ scale: 1.05 }}
                          title={`Call ${isAdOwner ? 'Order Creator' : 'Ad Owner'}`}
                        >
                          <PhoneCall size={18} />
                          <span className="text-sm font-medium">Call</span>
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
                        <motion.button
                          onClick={() => handleAcceptOrder(order.id)}
                          disabled={isExpired}
                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          whileTap={{ scale: 0.98 }}
                        >
                          <CheckCircle size={16} />
                          <span>Accept</span>
                        </motion.button>
                        
                        <motion.button
                          onClick={() => handleRejectOrder(order.id)}
                          className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 text-white py-2 px-4 rounded-lg font-medium flex items-center justify-center space-x-2"
                          whileTap={{ scale: 0.98 }}
                        >
                          <XCircle size={16} />
                          <span>Reject</span>
                        </motion.button>
                      </div>
                    </div>
                  )}

                  {/* Lock Funds Button for Seller (NEW FLOW) */}
                  {order.state === 'ACCEPTED' && isSeller && (
                    <div className="space-y-3">
                      <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-3">
                        <div className="flex items-center space-x-2 text-orange-400">
                          <Lock size={16} />
                          <span className="text-sm font-medium">
                            Action Required: Lock your funds on blockchain
                          </span>
                        </div>
                        <p className="text-xs text-orange-300 mt-2">
                          Order accepted! Now you need to lock {order.amount} {order.token} as escrow.
                        </p>
                        <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">
                          💡 {blockchainService.getWalletInstructions()}
                        </div>
                      </div>
                      
                      <motion.button
                        onClick={() => handleLockFunds(order.id)}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center space-x-2 shadow-lg hover:from-orange-600 hover:to-red-600 transition-all"
                        whileTap={{ scale: 0.98 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        <Lock size={18} />
                        <span>🔒 Lock Funds on Blockchain</span>
                      </motion.button>
                    </div>
                  )}

                  {/* Debug: Show when user should see Accept/Reject but doesn't */}
                  {process.env.NODE_ENV === 'development' && order.state === 'CREATED' && isAdOwner && isExpired && (
                    <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                      <div className="flex items-center space-x-2 text-red-400">
                        <XCircle size={16} />
                        <span className="text-sm font-medium">Order expired - Accept window closed</span>
                      </div>
                    </div>
                  )}

                  {/* Status for Buyer */}
                  {isBuyer && (
                    <div className="space-y-3">
                    
                      
                      {order.state === 'ACCEPTED' && (
                        <div className="flex items-center space-x-2 text-blue-400 bg-blue-500/20 p-3 rounded-lg">
                          <CheckCircle size={16} />
                          <span className="text-sm font-medium">
                            Order accepted! Contact the agent to complete payment
                          </span>
                        </div>
                      )}
                      
                      {order.state === 'RELEASED' && (
                        <div className="flex items-center space-x-2 text-green-400 bg-green-500/20 p-3 rounded-lg">
                          <CheckCircle size={16} />
                          <span className="text-sm font-medium">
                            Order completed successfully!
                          </span>
                        </div>
                      )}
                      
                      {order.state === 'CANCELLED' && (
                        <div className="flex items-center space-x-2 text-red-400 bg-red-500/20 p-3 rounded-lg">
                          <XCircle size={16} />
                          <span className="text-sm font-medium">
                            Order was cancelled
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dispute Resolution System */}
                  {['LOCKED', 'UNDER_DISPUTE', 'APPEALED'].includes(order.state) && (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Gavel size={18} className="text-purple-400" />
                            <span className="text-purple-300 font-medium">Dispute Resolution</span>
                          </div>
                          <button
                            onClick={() => openDisputeModal(order.id)}
                            className="text-purple-400 hover:text-purple-300 text-sm"
                          >
                            View Details
                          </button>
                        </div>
                        
                        {/* Quick Status */}
                        <div className="space-y-2">
                          {order.state === 'LOCKED' && (
                            <div className="text-sm text-blue-300">
                              ⏰ Funds locked - 2 hours to confirm payment
                            </div>
                          )}
                          {order.state === 'UNDER_DISPUTE' && (
                            <div className="text-sm text-orange-300">
                              ⚠️ Dispute filed - 48 hours to appeal
                            </div>
                          )}
                          {(order.state as any) === 'UNDER_REVIEW' && (
                            <div className="text-sm text-purple-300">
                              🔍 Under admin review
                            </div>
                          )}
                        </div>

                        {/* Quick Actions */}
                        <div className="flex space-x-2 mt-3">
                          {order.state === 'LOCKED' && (
                            <>
                              {isBuyer && (order as any)?.blockchain_trade_id && (
                                <motion.button
                                  onClick={() => handleConfirmPayment(order.id, 'SENT')}
                                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                                  whileTap={{ scale: 0.95 }}
                                >
                                  <CheckCircle size={14} className="inline mr-1" />
                                  Confirm Payment Sent
                                </motion.button>
                              )}
                              {isSeller && (order as any)?.blockchain_trade_id && (
                                <motion.button
                                  onClick={() => handleConfirmPayment(order.id, 'RECEIVED')}
                                  className="flex-1 bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700"
                                  whileTap={{ scale: 0.95 }}
                                >
                                  <CheckCircle size={14} className="inline mr-1" />
                                  Confirm Payment Received
                                </motion.button>
                              )}
                              {(!(order as any)?.blockchain_trade_id) && (
                                <div className="flex-1 bg-yellow-500/20 border border-yellow-500/30 rounded-md px-3 py-2 text-xs text-yellow-300">
                                  ⏳ Waiting for blockchain trade ID...
                                </div>
                              )}
                            </>
                          )}
                          
                          {['UNDER_DISPUTE'].includes(order.state) && (
                            <motion.button
                              onClick={() => handleFileAppealRedirect(order.id)}
                              className="flex-1 bg-orange-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-orange-700"
                              whileTap={{ scale: 0.95 }}
                            >
                              <FileText size={14} className="inline mr-1" />
                              File Appeal
                            </motion.button>
                          )}

                          {/* Redeem Button for Seller after 48h appeal window */}
                          {order.state === 'LOCKED' && canShowRedeem(order) && (order as any)?.blockchain_trade_id && (
                            <motion.button
                              onClick={() => handleRedeem(order)}
                              className="flex-1 bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                              whileTap={{ scale: 0.95 }}
                            >
                              <XCircle size={14} className="inline mr-1" />
                              Redeem Funds
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}


                </motion.div>
              );
            })}
               </div>
          </AnimatePresence>
        )}
        </div>
      ) : (
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12 space-y-4"
            >
              <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto">
                <Plus size={32} className="text-gray-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">No Ads Yet</h3>
                <p className="text-gray-300 text-sm">
                  Create your first P2P ad to start trading
                </p>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence>
              {myAds.map((ad) => (
                <motion.div
                  key={ad.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-semibold text-lg">₹{ad.priceInr}</span>
                        <span className="text-gray-300 text-sm bg-white/10 px-2 py-1 rounded">{ad.token}</span>
                      </div>
                      <p className="text-gray-300 text-sm">
                        Min: ₹{ad.minAmount} | Max: ₹{ad.maxAmount}
                      </p>
                      <p className="text-gray-400 text-xs">
                        Lock: {Math.floor(ad.lockDurationSeconds / 60)} min
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span className={clsx(
                        'px-2 py-1 rounded text-xs font-medium',
                        ad.type === 'BUY' 
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-red-500/20 text-red-300'
                      )}>
                        {ad.type}
                      </span>
                      <span className={clsx(
                        'px-2 py-1 rounded text-xs font-medium',
                        ad.active 
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-gray-500/20 text-gray-300'
                      )}>
                        {ad.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {ad.agent && (
                    <div className="bg-white/5 rounded-lg p-3 space-y-2">
                      <p className="text-white text-sm font-medium">{ad.agent.branchName}</p>
                      <p className="text-gray-300 text-xs">{ad.agent.city}</p>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-300 text-xs">{ad.agent.mobile}</span>
                        <motion.button
                          onClick={() => window.open(`tel:${ad.agent?.mobile}`)}
                          className="p-1 rounded bg-green-500/20 text-green-400"
                          whileTap={{ scale: 0.95 }}
                        >
                          <Phone size={12} />
                        </motion.button>
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <motion.button
                      onClick={() => handleEditAd(ad)}
                      className="flex-1 py-2 px-4 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors flex items-center justify-center space-x-2"
                      whileTap={{ scale: 0.95 }}
                    >
                      <Edit size={16} />
                      <span>Edit</span>
                    </motion.button>
                    
                    <motion.button
                      onClick={() => handleDeleteAd(ad.id)}
                      className="p-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                      whileTap={{ scale: 0.95 }}
                    >
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditingAd(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 rounded-xl p-6 w-full max-w-md border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Edit Ad</h3>
                <button
                  onClick={() => setEditingAd(null)}
                  className="p-2 rounded-lg bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-white/5 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">{editingAd.type} {editingAd.token}</span>
                    <span className="text-gray-300 text-sm bg-white/10 px-2 py-1 rounded">{editingAd.city}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Price (USDT)
                  </label>
                  <input
                    type="number"
                    value={editForm.priceInr}
                    onChange={(e) => setEditForm({...editForm, priceInr: e.target.value})}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                    placeholder="Enter price in USDT"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Min Amount (USDT)
                    </label>
                    <input
                      type="number"
                      value={editForm.minAmount}
                      onChange={(e) => setEditForm({...editForm, minAmount: e.target.value})}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      placeholder="Min amount"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Max Amount (USDT)
                    </label>
                    <input
                      type="number"
                      value={editForm.maxAmount}
                      onChange={(e) => setEditForm({...editForm, maxAmount: e.target.value})}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                      placeholder="Max amount"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="active"
                    checked={editForm.active}
                    onChange={(e) => setEditForm({...editForm, active: e.target.checked})}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="active" className="text-sm font-medium text-gray-300">
                    Ad is active
                  </label>
                </div>

                <div className="flex space-x-3">
                  <motion.button
                    onClick={() => setEditingAd(null)}
                    className="flex-1 py-2 px-4 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                    whileTap={{ scale: 0.98 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleUpdateAd}
                    className="flex-1 py-2 px-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                    whileTap={{ scale: 0.98 }}
                  >
                    Update Ad
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Call Modal */}
      {callModal.isOpen && (
        <div>
          <CallModal
            isOpen={callModal.isOpen}
            ad={{
            id: 'order-call',
            ownerAddress: callModal.targetAddress,
            ownerSelectedAgentIds: ['1'],
            type: 'BUY',
            token: 'USDT',
            priceInr: '0',
            minAmount: '0',
            maxAmount: '0',
            lockDurationSeconds: 0,
            city: 'Mumbai',
            active: true,
            createdAt: new Date().toISOString(),
            agent: {
              id: '1',
              branchName: callModal.targetName || 'User',
              city: 'Mumbai',
              address: callModal.targetAddress,
              mobile: '',
              verified: true,
              createdByAdmin: '1',
              createdAt: new Date().toISOString(),
              locationId: '1',
              locationName: 'Mumbai'
            }
          }}
          onClose={() => {
            console.log('📞 Orders: CallModal closed, cleaning up');
            cleanupCall();
          }}
        />
        </div>
      )}

      {/* Dispute Resolution Modal */}
      {showDisputeModal.isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDisputeModal({isOpen: false, orderId: ''})}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-slate-900 rounded-xl  w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Dispute Resolution</h3>
              <button
                onClick={() => setShowDisputeModal({isOpen: false, orderId: ''})}
                className="p-2 rounded-lg bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
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
      {showFundLockedPopover.isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowFundLockedPopover({ isOpen: false, orderId: '' })}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gradient-to-br from-green-500 to-blue-500 rounded-xl p-6 w-full max-w-md border border-white/20 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                <Lock size={32} className="text-white" />
              </div>
              
              <div>
                <h3 className="text-xl font-bold mb-2">🔒 Funds Locked Successfully!</h3>
                <p className="text-white/90 text-sm mb-4">
                  The seller has locked their funds for 2 hours. You can now proceed with payment.
                </p>
                <div className="bg-white/20 rounded-lg p-4 space-y-2">
                  <p className="font-semibold text-sm">📋 Next Steps:</p>
                  <p className="text-xs text-white/90">
                    • Go to Aagnya Branch within 2 hours
                  </p>
                  <p className="text-xs text-white/90">
                    • Deposit the payment amount
                  </p>
                  <p className="text-xs text-white/90">
                    • Contact the agent to complete transaction
                  </p>
                </div>
              </div>

              <div className="flex space-x-3">
                <motion.button
                  onClick={() => setShowFundLockedPopover({ isOpen: false, orderId: '' })}
                  className="flex-1 bg-white/20 hover:bg-white/30 text-white py-3 px-4 rounded-lg font-medium transition-colors"
                  whileTap={{ scale: 0.95 }}
                >
                  Got It
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Orders;
