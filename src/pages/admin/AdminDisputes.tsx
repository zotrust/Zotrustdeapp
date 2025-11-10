import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Search, 
  Eye, 
  Clock, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useWalletStore } from '../../stores/walletStore';
import { ethers } from 'ethers';
import { ZOTRUST_CONTRACT_ABI, ZOTRUST_CONTRACT_ADDRESS, BSC_MAINNET_CHAIN_ID } from '../../config/contracts';

interface Appeal {
  id: string;
  dispute_id: string;
  order_id: string;
  appellant_address: string;
  appellant_type: string;
  description: string;
  evidence_video_url: string | null;
  evidence_screenshots: string[] | null;
  evidence_documents: string[] | null;
  created_at: string;
  status: string;
  dispute_type: string;
  dispute_status: string;
  // Order details
  amount: string;
  token: string;
  buyer_address: string;
  seller_address: string;
  order_created_at: string;
  lock_expires_at: string;
  blockchain_trade_id?: number;
  // User details
  buyer_name: string | null;
  seller_name: string | null;
}

const AdminDisputes: React.FC = () => {
  const { address, isConnected, chainId, switchToNetwork, connectMetaMask, connectTrustWallet } = useWalletStore();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [filteredAppeals, setFilteredAppeals] = useState<Appeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [confirmResolution, setConfirmResolution] = useState<{type: 'buyer' | 'seller' | null, appealId: string, reason: string}>({
    type: null, 
    appealId: '', 
    reason: 'This is Testing1'
  });
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showRpcHelp, setShowRpcHelp] = useState(false);
  const [rpcHelpMessage, setRpcHelpMessage] = useState<string>('');
  const [testingRpc, setTestingRpc] = useState<string | null>(null);
  const [syncingStatus, setSyncingStatus] = useState(false);

  const isRpcIndexingError = (e: any) => {
    const msg = String(e?.message || '').toLowerCase();
    const code = e?.code;
    const reason = String(e?.reason || '').toLowerCase();
    return (
      code === -32000 ||
      code === 'CALL_EXCEPTION' ||
      msg.includes('state histories') ||
      msg.includes('internal json-rpc error') ||
      msg.includes('missing revert data') ||
      msg.includes('timeout') ||
      msg.includes('network error') ||
      msg.includes('connection') ||
      reason.includes('missing revert data') ||
      (e?.data === null && e?.reason === null && code === 'CALL_EXCEPTION')
    );
  };

  // Retry contract call with exponential backoff
  const retryContractCall = async (
    fn: () => Promise<any>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<any> => {
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await Promise.race([
          fn(),
          new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error('RPC call timeout after 10 seconds')), 10000)
          )
        ]);
      } catch (error: any) {
        lastError = error;
        if (isRpcIndexingError(error) && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`⚠️ RPC call failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  };

  // Check RPC health before critical operations
  const checkRpcHealth = async (provider: ethers.BrowserProvider): Promise<{ healthy: boolean; error?: string }> => {
    try {
      const blockNumber = await Promise.race([
        provider.getBlockNumber(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('RPC health check timeout')), 5000)
        )
      ]);
      
      if (blockNumber > 0) {
        return { healthy: true };
      }
      return { healthy: false, error: 'RPC returned invalid block number' };
    } catch (error: any) {
      console.error('❌ RPC health check failed:', error);
      return { 
        healthy: false, 
        error: error.message || 'RPC node is unresponsive or timing out' 
      };
    }
  };

  // Test RPC endpoint
  const testRpcEndpoint = async (rpcUrl: string): Promise<{ success: boolean; message: string }> => {
    setTestingRpc(rpcUrl);
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const blockNumber = await Promise.race([
        provider.getBlockNumber(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 5 seconds')), 5000)
        )
      ]);
      
      if (blockNumber > 0) {
        return { success: true, message: `✅ Connected! Latest block: ${blockNumber}` };
      }
      return { success: false, message: '❌ Invalid response: block number is 0' };
    } catch (error: any) {
      return { 
        success: false, 
        message: `❌ Failed: ${error.message || 'Connection error'}` 
      };
    } finally {
      setTestingRpc(null);
    }
  };
  const navigate = useNavigate();

  useEffect(() => {
    fetchAppeals();
  }, []);

  useEffect(() => {
    filterAppeals();
  }, [appeals, searchTerm, statusFilter]);

  const fetchAppeals = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        navigate('/admin/login');
        return;
      }

      const response = await fetch('/api/admin/appeals', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAppeals(data.data);
      } else if (response.status === 401) {
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
      } else {
        toast.error('Failed to load appeals');
      }
    } catch (error) {
      console.error('Error fetching appeals:', error);
      toast.error('Failed to load appeals');
    } finally {
      setIsLoading(false);
    }
  };

  const filterAppeals = () => {
    let filtered = appeals;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(appeal => 
        appeal.id.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        appeal.order_id.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        appeal.appellant_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        appeal.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(appeal => appeal.dispute_status === statusFilter);
    }

    setFilteredAppeals(filtered);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-400 bg-yellow-500/10';
      case 'UNDER_REVIEW': return 'text-blue-400 bg-blue-500/10';
      case 'RESOLVED': return 'text-green-400 bg-green-500/10';
      case 'CLOSED': return 'text-gray-400 bg-gray-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock size={16} />;
      case 'UNDER_REVIEW': return <AlertTriangle size={16} />;
      case 'RESOLVED': return <CheckCircle size={16} />;
      case 'CLOSED': return <XCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  // Check and sync on-chain status with database
  const checkAndSyncStatus = async (appeal: Appeal, showLoading: boolean = false) => {
    if (showLoading) {
      setSyncingStatus(true);
    }
    try {
      // Get trade ID
      const preferredTradeId = (appeal as any)?.order?.blockchain_trade_id ?? 
                              (appeal as any)?.blockchain_trade_id ?? 
                              appeal?.order_id;
      const tradeId = Number(preferredTradeId);

      if (!tradeId || Number.isNaN(tradeId) || tradeId <= 0) {
        return; // Can't check without valid trade ID
      }

      // Check if wallet is connected
      if (!isConnected || !window.ethereum) {
        return; // Can't check without wallet
      }

      // Connect to contract
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== BSC_MAINNET_CHAIN_ID) {
        return; // Wrong network
      }

      const contract = new ethers.Contract(ZOTRUST_CONTRACT_ADDRESS, ZOTRUST_CONTRACT_ABI, provider);
      
      // Get trade status
      let trade: any;
      try {
        trade = await retryContractCall(
          () => contract.trades(tradeId),
          2,
          1000
        );
      } catch (error) {
        console.log('Could not fetch trade status for sync check:', error);
        return; // Silently fail - don't block UI
      }

      const tradeStatus = Number(trade.status);
      const STATUS = {
        RELEASED: 4,
        REFUNDED: 5,
        COMPLETED: 6
      };

      // If trade is already finalized on-chain but dispute is still pending, update database
      if ((tradeStatus === STATUS.RELEASED || tradeStatus === STATUS.REFUNDED || tradeStatus === STATUS.COMPLETED) 
          && appeal.dispute_status === 'PENDING') {
        console.log(`🔄 Syncing status: Trade ${tradeId} is ${tradeStatus === STATUS.RELEASED ? 'RELEASED' : tradeStatus === STATUS.REFUNDED ? 'REFUNDED' : 'COMPLETED'} on-chain, but dispute is PENDING. Updating...`);
        
        const token = localStorage.getItem('adminToken');
        if (!token) return;

        const resolution = tradeStatus === STATUS.RELEASED ? 'TRANSFER_TO_BUYER' : 'REFUND_TO_SELLER';
        const resolutionReason = `Trade was already ${tradeStatus === STATUS.RELEASED ? 'released' : tradeStatus === STATUS.REFUNDED ? 'refunded' : 'completed'} on-chain. Status synced automatically.`;

        const response = await fetch(`/api/admin/appeals/${appeal.id}/resolve`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            resolution,
            resolution_reason: resolutionReason
          })
        });

        if (response.ok) {
          console.log('✅ Status synced successfully');
          toast.success('Status updated: Trade was already completed on-chain', { duration: 3000 });
          fetchAppeals(); // Refresh the list
        } else if (showLoading) {
          const errorData = await response.json();
          toast.error(errorData.error || 'Failed to sync status');
        }
      }
    } catch (error) {
      console.error('Error syncing status:', error);
      if (showLoading) {
        toast.error('Failed to sync status. Please check your connection.');
      }
      // Silently fail for background sync, show error for manual sync
    } finally {
      if (showLoading) {
        setSyncingStatus(false);
      }
    }
  };

  const handleViewAppeal = async (appeal: Appeal) => {
    setSelectedAppeal(appeal);
    setShowModal(true);
    
    // Check and sync status in background
    await checkAndSyncStatus(appeal);
  };

  // Connect Trust Wallet
  const handleConnectTrustWallet = async () => {
    try {
      setShowWalletModal(false);
      await connectTrustWallet();

      // Ensure BSC Mainnet
      if (chainId !== BSC_MAINNET_CHAIN_ID) {
        await switchToNetwork(BSC_MAINNET_CHAIN_ID);
      }

      toast.success('Trust Wallet connected successfully!');
    } catch (error: any) {
      console.error('Trust Wallet connection error:', error);
      toast.error(error.message || 'Failed to connect Trust Wallet');
    }
  };

  // Connect MetaMask
  const handleConnectMetaMask = async () => {
    try {
      setShowWalletModal(false);
      await connectMetaMask();

      // Ensure BSC Mainnet
      if (chainId !== BSC_MAINNET_CHAIN_ID) {
        await switchToNetwork(BSC_MAINNET_CHAIN_ID);
      }

      toast.success('MetaMask connected successfully!');
    } catch (error: any) {
      console.error('MetaMask connection error:', error);
      toast.error(error.message || 'Failed to connect MetaMask');
    }
  };

  // Connect via Reown (WalletConnect AppKit)
  const handleConnectReown = async () => {
    try {
      setShowWalletModal(false);
      // Dynamically import to avoid bundling error if not installed
      // You must install: npm i @reown/appkit @reown/appkit-adapter-ethers
      const [{ createAppKit }, { EthersAdapter }]: any = await Promise.all([
        import('@reown/appkit'),
        import('@reown/appkit-adapter-ethers')
      ]);

      const projectId = (window as any).REOWN_PROJECT_ID || import.meta.env.VITE_REOWN_PROJECT_ID;
      if (!projectId) {
        toast.error('Missing Reown projectId (set VITE_REOWN_PROJECT_ID)');
        return;
      }

      const ethersAdapter = new EthersAdapter();
      const appKit = createAppKit({
        projectId,
        adapters: [ethersAdapter],
        features: {
          analytics: false
        },
        networks: [{ id: 56, name: 'BSC Mainnet' }]
      });

      await appKit.open();

      // After successful connect, ensure network
      if (chainId !== BSC_MAINNET_CHAIN_ID) {
        await switchToNetwork(BSC_MAINNET_CHAIN_ID);
      }

      toast.success('Connected with Reown');
    } catch (error: any) {
      console.error('Reown connection error:', error);
      if (String(error?.message || '').includes('@reown')) {
        toast.error('Reown packages not installed. Run: npm i @reown/appkit @reown/appkit-adapter-ethers');
      } else {
        toast.error(error?.message || 'Failed to connect with Reown');
      }
    }
  };
/**
 * handleResolveAppeal - Resolves a dispute appeal on-chain and updates database
 * 
 * Status Flow (P2PEscrowV2 Contract):
 * 0 = CREATED          → Trade created, not locked yet
 * 1 = LOCKED           → Funds locked, waiting for payment confirmation
 * 2 = APPEAL_WINDOW_OPEN → Appeal window is open (2-48 hours after lock)
 * 3 = UNDER_DISPUTE    → Appeal filed, trade in dispute (admin can resolve) ✅
 * 4 = RELEASED         → Funds released to buyer
 * 5 = REFUNDED         → Funds refunded to 
 * seller
 * 6 = COMPLETED        → Trade completed (final state)
 * 
 * This function:
 * 1. Verifies wallet connection and admin permissions
 * 2. Checks current trade status on-chain
 * 3. Handles already-finalized trades (RELEASED/REFUNDED/COMPLETED)
 * 4. Transitions trade to UNDER_DISPUTE if needed (LOCKED → APPEAL_WINDOW_OPEN → UNDER_DISPUTE)
 * 5. Calls adminDecision() to resolve on-chain (only if status is UNDER_DISPUTE)
 * 6. Updates database with resolution
 * 
 * @param appealId - Database appeal ID
 * @param releaseToBuyer - true = release to buyer, false = refund to seller
 * @param reason - Resolution reason for database
 */
const handleResolveAppeal = async (appealId: string, releaseToBuyer: boolean, reason: string) => {
  try {
    setIsResolving(true);

    // ✅ CORRECT Status mapping from P2PEscrowV2 contract
    // This matches the smart contract enum exactly - DO NOT CHANGE
    const STATUS = {
      CREATED: 0,              // Trade created, not locked yet
      LOCKED: 1,              // Funds locked, waiting for payment confirmation
      APPEAL_WINDOW_OPEN: 2,  // Appeal window is open (2-48 hours after lock)
      UNDER_DISPUTE: 3,      // Appeal filed, trade in dispute (admin can resolve)
      RELEASED: 4,           // Funds released to buyer
      REFUNDED: 5,           // Funds refunded to seller
      COMPLETED: 6           // Trade completed (final state)
    };

    // Helper to get status name for logging
    const getStatusName = (statusNum: number): string => {
      const statusKey = Object.keys(STATUS).find(k => STATUS[k as keyof typeof STATUS] === statusNum);
      return statusKey || `UNKNOWN(${statusNum})`;
    };

    // 1) Check wallet connection
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first');
      setIsResolving(false);
      return;
    }

    // 2) Ensure correct network
    if (chainId !== BSC_MAINNET_CHAIN_ID) {
      toast.loading('Switching to BSC Mainnet...', { id: 'switch-network' });
      await switchToNetwork(BSC_MAINNET_CHAIN_ID);
      toast.success('Switched to BSC Mainnet', { id: 'switch-network' });
    }

    // 3) Get appeal and trade ID
    const appeal = appeals.find(a => String(a.id) === String(appealId));
    if (!appeal) {
      toast.error('Appeal not found');
      setIsResolving(false);
      return;
    }

    const preferredTradeId = (appeal as any)?.order?.blockchain_trade_id ?? 
                            (appeal as any)?.blockchain_trade_id ?? 
                            appeal?.order_id;
    const tradeId = Number(preferredTradeId);

    if (!tradeId || Number.isNaN(tradeId) || tradeId <= 0) {
      toast.error('Invalid Blockchain Trade ID');
      console.error('Trade ID validation failed:', {
        nested_order_trade_id: (appeal as any)?.order?.blockchain_trade_id,
        appeal_trade_id: (appeal as any)?.blockchain_trade_id,
        order_id_fallback: appeal?.order_id,
        computed: tradeId
      });
      setIsResolving(false);
      return;
    }

    // 4) Connect to contract
    if (!window.ethereum) {
      toast.error('Wallet not available');
      setIsResolving(false);
      return;
    }

    toast.loading('Connecting to contract...', { id: 'resolve-chain' });
    const provider = new ethers.BrowserProvider(window.ethereum as any);
    const signer = await provider.getSigner();

    // Verify network
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== BSC_MAINNET_CHAIN_ID) {
      throw new Error(`Wrong network! Expected BSC Mainnet (56), got chain ${network.chainId}`);
    }

    // Health check before proceeding
    toast.loading('Checking RPC connection health...', { id: 'resolve-chain' });
    const healthCheck = await checkRpcHealth(provider);
    if (!healthCheck.healthy) {
      setRpcHelpMessage(`RPC health check failed: ${healthCheck.error}. Please switch to a reliable BSC Mainnet RPC endpoint.`);
      setShowRpcHelp(true);
      throw new Error(`RPC node is unhealthy: ${healthCheck.error}. Please switch RPC and retry.`);
    }

    const contract = new ethers.Contract(ZOTRUST_CONTRACT_ADDRESS, ZOTRUST_CONTRACT_ABI, signer);

    // 5) Verify admin permissions with retry logic
    toast.loading('Verifying admin permissions...', { id: 'resolve-chain' });
    const connectedAddress = (await signer.getAddress()).toLowerCase();
    
    let contractAdmin: string;
    try {
      contractAdmin = (await retryContractCall(
        () => contract.admin(),
        3,
        1000
      )).toLowerCase();
    } catch (adminError: any) {
      console.error('❌ Failed to fetch contract admin after retries:', adminError);
      if (isRpcIndexingError(adminError)) {
        setRpcHelpMessage('RPC node cannot execute admin() call even after retries. The RPC endpoint may be overloaded, rate-limited, or missing state history. Please switch to a reliable BSC Mainnet RPC endpoint.');
        setShowRpcHelp(true);
        throw new Error('RPC node error: Cannot verify admin permissions after multiple attempts. Please switch RPC and retry.');
      }
      throw new Error(`Contract admin() function failed: ${adminError.message}`);
    }
    
    if (connectedAddress !== contractAdmin) {
      throw new Error(`You are not the contract admin. Connected: ${connectedAddress.slice(0,10)}..., Admin: ${contractAdmin.slice(0,10)}...`);
    }

    // 6) Check current trade status with retry
    toast.loading('Checking trade status...', { id: 'resolve-chain' });

    let trade: any;
    try {
      trade = await retryContractCall(
        () => contract.trades(tradeId),
        3,
        1000
      );
    } catch (error: any) {
      if (isRpcIndexingError(error)) {
        setRpcHelpMessage('RPC node cannot fetch trade data. Please switch to a reliable BSC Mainnet RPC endpoint.');
        setShowRpcHelp(true);
        throw new Error('RPC node error: Cannot fetch trade status. Please switch RPC and retry.');
      }
      throw new Error(`Failed to fetch trade ${tradeId}. Does this trade exist on-chain?`);
    }
    
    let tradeStatus = Number(trade.status);
    const statusName = getStatusName(tradeStatus);
    
    console.log('🔍 Current trade status:', tradeStatus, '→', statusName);
    console.log('📊 Trade details:', {
      tradeId,
      buyer: trade.buyer,
      seller: trade.seller,
      amount: trade.amount?.toString(),
      status: tradeStatus,
      statusName,
      appealFiled: trade.appealFiled || false,
      lockedAt: trade.lockedAt?.toString(),
      appealStartAt: trade.appealStartAt?.toString()
    });
    
    // Log important info for debugging
    if (tradeStatus === STATUS.LOCKED) {
      console.log('⚠️ Trade is LOCKED. Admin can open appeal window after 2 hours, then resolve directly.');
    } else if (tradeStatus === STATUS.APPEAL_WINDOW_OPEN) {
      console.log('✅ Trade is in APPEAL_WINDOW_OPEN status. Admin can resolve directly without appeal filing.');
    } else if (tradeStatus === STATUS.UNDER_DISPUTE) {
      console.log('✅ Trade is in UNDER_DISPUTE status. Admin can resolve (appeal filed by participant).');
    }

    // 7) Handle trades that are already finalized
    if (tradeStatus === STATUS.COMPLETED) {
      toast.loading('Trade already completed on-chain. Updating database...', { id: 'resolve-chain' });
      const token = localStorage.getItem('adminToken');
      
      // Determine resolution based on trade history (default to TRANSFER_TO_BUYER for completed)
      const response = await fetch(`/api/admin/appeals/${appealId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          resolution: 'TRANSFER_TO_BUYER', // Completed usually means funds were released
          resolution_reason: reason || 'Trade was already completed on-chain before appeal resolution'
        })
      });
      
      if (response.ok) {
        toast.success('✅ Appeal marked as resolved (trade already completed on-chain)', { id: 'resolve-chain' });
        fetchAppeals();
        setShowModal(false);
        setConfirmResolution({ type: null, appealId: '', reason: '' });
        setIsResolving(false);
        return;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update backend');
      }
    }

    if (tradeStatus === STATUS.RELEASED) {
      toast.loading('Trade already released on-chain. Updating database...', { id: 'resolve-chain' });
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/appeals/${appealId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          resolution: 'TRANSFER_TO_BUYER',
          resolution_reason: reason || 'Trade was already released on-chain before appeal resolution'
        })
      });
      
      if (response.ok) {
        toast.success('✅ Appeal marked as resolved (funds already released to buyer)', { id: 'resolve-chain' });
        fetchAppeals();
        setShowModal(false);
        setConfirmResolution({ type: null, appealId: '', reason: '' });
        setIsResolving(false);
        return;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update backend');
      }
    }

    if (tradeStatus === STATUS.REFUNDED) {
      toast.loading('Trade already refunded on-chain. Updating database...', { id: 'resolve-chain' });
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/appeals/${appealId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          resolution: 'REFUND_TO_SELLER',
          resolution_reason: reason || 'Trade was already refunded on-chain before appeal resolution'
        })
      });
      
      if (response.ok) {
        toast.success('✅ Appeal marked as resolved (funds already refunded to seller)', { id: 'resolve-chain' });
        fetchAppeals();
        setShowModal(false);
        setConfirmResolution({ type: null, appealId: '', reason: '' });
        setIsResolving(false);
        return;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update backend');
      }
    }

    // 8) Block invalid statuses
    if (tradeStatus === STATUS.CREATED) {
      throw new Error('Trade not locked yet - cannot resolve dispute');
    }

    // 9) Handle LOCKED status - Admin can open appeal window if needed
    if (tradeStatus === STATUS.LOCKED) {
      // Check if 2 hours have passed since lock
      const lockTime = trade.lockedAt ? Number(trade.lockedAt) : 0;
      const currentTime = Math.floor(Date.now() / 1000);
      const twoHoursInSeconds = 2 * 60 * 60;
      const timeSinceLock = currentTime - lockTime;
      
      if (timeSinceLock < twoHoursInSeconds) {
        const remainingTime = twoHoursInSeconds - timeSinceLock;
        const remainingMinutes = Math.ceil(remainingTime / 60);
        const errorMsg = `Trade is LOCKED (${tradeStatus}). Appeal window opens after 2 hours.\n\n` +
          `Time remaining: ${remainingMinutes} minutes\n\n` +
          `Admin can resolve once appeal window opens (APPEAL_WINDOW_OPEN status).`;
        throw new Error(errorMsg);
      }
      
      // 2 hours have passed, admin can open appeal window
      console.log('⏰ 2 hours have passed since lock, opening appeal window...');
      toast.loading('Opening appeal window on-chain...', { id: 'resolve-chain' });
      
      try {
        let gasEstimate: bigint;
        try {
          gasEstimate = await retryContractCall(
            () => contract.openAppealWindow.estimateGas(tradeId),
            3,
            1000
          );
          gasEstimate = gasEstimate * BigInt(120) / BigInt(100);
          console.log('✅ openAppealWindow gas estimation successful:', gasEstimate.toString());
        } catch (gasErr: any) {
          if (isRpcIndexingError(gasErr)) {
            console.warn('⚠️ Using fallback gas limit for openAppealWindow due to RPC estimation failure');
            // Use safe default for openAppealWindow (typically needs ~50k-100k, using 200k as safe buffer)
            gasEstimate = BigInt(200000);
            toast.loading('⚠️ Using fallback gas limit for opening appeal window...', { id: 'resolve-chain' });
          } else {
            throw gasErr;
          }
        }
        
        const openWindowTx = await contract.openAppealWindow(tradeId, {
          gasLimit: gasEstimate
        });
        await openWindowTx.wait();
        toast.success('Appeal window opened', { id: 'resolve-chain' });
        
        // Re-check status with retry
        const updatedTrade = await retryContractCall(
          () => contract.trades(tradeId),
          3,
          1000
        );
        tradeStatus = Number(updatedTrade.status);
        console.log('✅ Status after opening appeal window:', tradeStatus, '→', getStatusName(tradeStatus));
      } catch (error: any) {
        console.error('Error opening appeal window:', error);
        if (isRpcIndexingError(error)) {
          setRpcHelpMessage('RPC node error while opening appeal window. Please switch to a reliable BSC Mainnet RPC endpoint.');
          setShowRpcHelp(true);
        }
        // Might already be open, continue
        try {
          const updatedTrade = await retryContractCall(
            () => contract.trades(tradeId),
            2,
            1000
          );
          tradeStatus = Number(updatedTrade.status);
          console.log('⚠️ Status after openAppealWindow attempt:', tradeStatus, '→', getStatusName(tradeStatus));
        } catch (statusError: any) {
          throw new Error(`Failed to check trade status after opening appeal window: ${statusError.message}`);
        }
        
        if (tradeStatus !== STATUS.APPEAL_WINDOW_OPEN && tradeStatus !== STATUS.UNDER_DISPUTE) {
          throw new Error(`Failed to open appeal window. Current status: ${tradeStatus} (${getStatusName(tradeStatus)}). Error: ${error.message}`);
        }
      }
    }

    // 10) Final status check before adminDecision with retry
    // Admin can resolve from APPEAL_WINDOW_OPEN or UNDER_DISPUTE statuses
    const finalTrade = await retryContractCall(
      () => contract.trades(tradeId),
      3,
      1000
    );
    let finalStatus = Number(finalTrade.status);
    let finalStatusName = getStatusName(finalStatus);
    
    console.log('🎯 Final status check before adminDecision:', finalStatus, '→', finalStatusName);
    console.log('✅ Ready to call adminDecision:', {
      tradeId,
      finalStatus,
      finalStatusName,
      releaseToBuyer,
      reason: reason.substring(0, 50) + '...'
    });

    // One last defensive check
    if (finalStatus === STATUS.RELEASED) {
      await markAppealResolvedDB(appealId, 'TRANSFER_TO_BUYER', 'Trade released during resolution process');
      toast.success('Trade was released during process - database updated');
      setIsResolving(false);
      return;
    }
    
    if (finalStatus === STATUS.REFUNDED) {
      await markAppealResolvedDB(appealId, 'REFUND_TO_SELLER', 'Trade refunded during resolution process');
      toast.success('Trade was refunded during process - database updated');
      setIsResolving(false);
      return;
    }

    // Admin can resolve from APPEAL_WINDOW_OPEN (2) or UNDER_DISPUTE (3)
    if (finalStatus !== STATUS.APPEAL_WINDOW_OPEN && finalStatus !== STATUS.UNDER_DISPUTE) {
      const currentStatusName = getStatusName(finalStatus);
      const errorMsg = `Admin can only resolve from APPEAL_WINDOW_OPEN (${STATUS.APPEAL_WINDOW_OPEN}) or UNDER_DISPUTE (${STATUS.UNDER_DISPUTE}) statuses.\n\n` +
        `Current status: ${finalStatus} (${currentStatusName})\n\n` +
        `Required actions:\n` +
        `- If LOCKED: Wait 2 hours for appeal window to open, or open it manually\n` +
        `- If APPEAL_WINDOW_OPEN: Admin will file appeal first, then resolve\n` +
        `- If UNDER_DISPUTE: Admin can resolve (appeal already filed)`;
      throw new Error(errorMsg);
    }

    // 11) If status is APPEAL_WINDOW_OPEN, file appeal first to transition to UNDER_DISPUTE
    if (finalStatus === STATUS.APPEAL_WINDOW_OPEN) {
      console.log('📝 Trade is in APPEAL_WINDOW_OPEN status. Filing admin appeal to transition to UNDER_DISPUTE...');
      toast.loading('Filing admin appeal to enable resolution...', { id: 'resolve-chain' });
      
      try {
        // File appeal with admin intervention reason
        // Using placeholder IPFS CID for admin-initiated appeals
        const adminEvidenceCid = `QmAdminIntervention_${tradeId}_${Date.now()}`;
        
        let fileAppealGasEstimate: bigint;
        try {
          fileAppealGasEstimate = await retryContractCall(
            () => contract.fileAppeal.estimateGas(tradeId, adminEvidenceCid),
            3,
            1000
          );
          fileAppealGasEstimate = fileAppealGasEstimate * BigInt(120) / BigInt(100);
        } catch (gasErr: any) {
          if (isRpcIndexingError(gasErr)) {
            console.warn('⚠️ Using fallback gas limit for fileAppeal due to RPC estimation failure');
            fileAppealGasEstimate = BigInt(200000); // Safe default for fileAppeal
          } else {
            throw gasErr;
          }
        }
        
        const fileAppealTx = await contract.fileAppeal(tradeId, adminEvidenceCid, {
          gasLimit: fileAppealGasEstimate
        });
        const fileAppealReceipt = await fileAppealTx.wait();
        console.log('✅ Admin appeal filed successfully:', {
          hash: fileAppealReceipt.hash,
          blockNumber: fileAppealReceipt.blockNumber
        });
        
        // Re-check status - should now be UNDER_DISPUTE (3)
        const afterAppealTrade = await retryContractCall(
          () => contract.trades(tradeId),
          3,
          1000
        );
        const afterAppealStatus = Number(afterAppealTrade.status);
        const afterAppealStatusName = getStatusName(afterAppealStatus);
        
        console.log('✅ Status after filing appeal:', afterAppealStatus, '→', afterAppealStatusName);
        
        if (afterAppealStatus !== STATUS.UNDER_DISPUTE) {
          throw new Error(
            `Expected status UNDER_DISPUTE (${STATUS.UNDER_DISPUTE}) after filing appeal, ` +
            `but got ${afterAppealStatus} (${afterAppealStatusName})`
          );
        }
        
        toast.success('✅ Appeal filed. Trade is now in dispute. Proceeding with resolution...', { id: 'resolve-chain' });
        
        // Update finalStatus and finalStatusName for adminDecision
        finalStatus = afterAppealStatus;
        finalStatusName = afterAppealStatusName;
        
      } catch (appealError: any) {
        console.error('❌ Failed to file admin appeal:', appealError);
        if (isRpcIndexingError(appealError)) {
          setRpcHelpMessage('RPC node error while filing appeal. Please switch to a reliable BSC Mainnet RPC endpoint.');
          setShowRpcHelp(true);
        }
        throw new Error(`Failed to file admin appeal: ${appealError.message || appealError.reason || 'Unknown error'}`);
      }
    }

    // 12) Execute adminDecision with gas estimation (with fallback)
    toast.loading(
      releaseToBuyer 
        ? 'Releasing full amount to buyer on-chain...' 
        : 'Refunding full amount to seller on-chain...', 
      { id: 'resolve-chain' }
    );
    
    let gasEstimateDecision: bigint;
    let usingFallbackGas = false;
    
    try {
      gasEstimateDecision = await retryContractCall(
        () => contract.adminDecision.estimateGas(tradeId, releaseToBuyer),
        3,
        1000
      );
      // Add 20% buffer to estimated gas
      gasEstimateDecision = gasEstimateDecision * BigInt(120) / BigInt(100);
      console.log('✅ Gas estimation successful:', gasEstimateDecision.toString());
    } catch (gasErr: any) {
      console.error('❌ adminDecision estimateGas failed after retries:', gasErr);
      
      // Check if it's a revert (actual contract error, not RPC issue)
      if (String(gasErr?.message || '').includes('execution reverted') || gasErr?.reason) {
        throw new Error(`adminDecision reverted: ${gasErr.reason || gasErr.message}`);
      }
      
      // If it's an RPC error, use fallback gas limit
      if (isRpcIndexingError(gasErr)) {
        console.warn('⚠️ Using fallback gas limit due to RPC estimation failure');
        // Use a safe default gas limit for adminDecision (typically needs ~100k-150k, using 300k as safe buffer)
        gasEstimateDecision = BigInt(300000);
        usingFallbackGas = true;
        
        toast.loading(
          '⚠️ RPC cannot estimate gas. Using safe default gas limit. This may take longer...', 
          { id: 'resolve-chain' }
        );
        
        // Show RPC help but don't block the transaction
        setRpcHelpMessage(
          'RPC node cannot estimate gas, but transaction will proceed with a safe default gas limit. ' +
          'For better reliability, consider switching to a more reliable BSC Mainnet RPC endpoint.'
        );
        setShowRpcHelp(true);
      } else {
        // Unknown error - could be a contract state issue
        throw new Error(`adminDecision gas estimation failed: ${gasErr.message || 'Unknown error'}`);
      }
    }

    const tx = await contract.adminDecision(tradeId, releaseToBuyer, {
      gasLimit: gasEstimateDecision
    });
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed?.toString() || 'unknown';
    const gasLimit = gasEstimateDecision.toString();
    
    console.log('✅ Transaction receipt:', {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed,
      gasLimit,
      gasLimitUsed: usingFallbackGas ? 'fallback' : 'estimated',
      status: receipt.status
    });
    
    // Verify final on-chain status after transaction with retry
    const postTxTrade = await retryContractCall(
      () => contract.trades(tradeId),
      3,
      1000
    );
    const postTxStatus = Number(postTxTrade.status);
    const postTxStatusName = getStatusName(postTxStatus);
    console.log('✅ Post-transaction status:', postTxStatus, '→', postTxStatusName);
    
    const successMessage = releaseToBuyer 
      ? `✅ On-chain: Full amount released to buyer (Status: ${postTxStatusName})` 
      : `✅ On-chain: Full amount refunded to seller (Status: ${postTxStatusName})`;
    
    const gasInfo = usingFallbackGas 
      ? ` (Used fallback gas: ${gasUsed}/${gasLimit})`
      : ` (Gas used: ${gasUsed})`;
    
    toast.success(successMessage + gasInfo, { id: 'resolve-chain', duration: 6000 });

    // 13) Update backend
    await markAppealResolvedDB(
      appealId, 
      releaseToBuyer ? 'TRANSFER_TO_BUYER' : 'REFUND_TO_SELLER',
      reason
    );
    
    toast.success('✅ Appeal resolved successfully - both on-chain and in database');
    fetchAppeals();
    setShowModal(false);
    setConfirmResolution({ type: null, appealId: '', reason: '' });

  } catch (error: any) {
    console.error('❌ Error resolving appeal:', error);
    toast.dismiss('resolve-chain');
    
    if (error.code === 'ACTION_REJECTED' || error.message?.includes('User rejected')) {
      toast.error('Transaction rejected by user');
    } else if (error.code === 'CALL_EXCEPTION') {
      toast.error(`Smart contract call failed: ${error.message || 'Invalid trade state or permissions'}`);
    } else if (error.reason) {
      toast.error(`Smart contract error: ${error.reason}`);
    } else {
      toast.error(error.message || 'Failed to resolve appeal');
    }
  } finally {
    setIsResolving(false);
  }
};

// Helper function to mark appeal resolved in DB
const markAppealResolvedDB = async (appealId: string, resolution: string, reason: string) => {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(`/api/admin/appeals/${appealId}/resolve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ resolution, resolution_reason: reason })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update backend');
  }
  
  return response;
};
  const handleInitiateResolution = (appealId: string, releaseToBuyer: boolean) => {
    setConfirmResolution({ 
      type: releaseToBuyer ? 'buyer' : 'seller', 
      appealId, 
      reason: '' 
    });
  };

  const handleConfirmResolution = () => {
    if (!confirmResolution.reason.trim()) {
      toast.error('Please provide a reason for this resolution');
      return;
    }
    
    handleResolveAppeal(
      confirmResolution.appealId,
      confirmResolution.type === 'buyer',
      confirmResolution.reason
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading appeals...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
        {/* Header Actions */}
        <div className="flex justify-between items-center mb-6">
          <div>
            {!isConnected ? (
                <motion.button
                onClick={() => setShowWalletModal(true)}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-lg transition-all flex items-center space-x-2 shadow-lg"
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ scale: 1.02 }}
                >
                <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">🔗</span>
                  </div>
                <span className="font-medium">Connect Wallet</span>
                </motion.button>
            ) : (
              <div className="flex items-center space-x-2 text-white">
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-sm font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                {chainId !== BSC_MAINNET_CHAIN_ID && (
                  <button
                    onClick={() => switchToNetwork(BSC_MAINNET_CHAIN_ID)}
                    className="text-xs bg-yellow-600 hover:bg-yellow-700 px-2 py-1 rounded"
                  >
                    Switch to BSC Mainnet
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
          <button
            onClick={fetchAppeals}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
            <button
              onClick={() => setShowRpcHelp(true)}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
              title="Get help configuring a reliable RPC"
            >
              RPC Help
            </button>
          </div>
        </div>
        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by appeal ID, order ID, address, or description..."
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status Filter</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-gray-400">
                Showing {filteredAppeals.length} of {appeals.length} appeals
              </div>
            </div>
          </div>
        </div>

        {/* Appeals Table */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Appeal ID</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Appellant</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredAppeals.map((appeal, index) => (
                  <motion.tr
                    key={appeal.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-mono">
                      #{appeal.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-mono">
                      #{appeal.order_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {appeal.dispute_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appeal.dispute_status)}`}>
                        {getStatusIcon(appeal.dispute_status)}
                        <span className="ml-1">{appeal.dispute_status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-mono">
                      {appeal.appellant_address.slice(0, 10)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {new Date(appeal.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleViewAppeal(appeal)}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Appeal Details Modal */}
        {showModal && selectedAppeal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Appeal Details</h2>
                <div className="flex items-center space-x-2">
                  {selectedAppeal.dispute_status === 'PENDING' && isConnected && (
                    <motion.button
                      onClick={async () => {
                        if (selectedAppeal) {
                          await checkAndSyncStatus(selectedAppeal, true);
                        }
                      }}
                      disabled={syncingStatus}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 text-sm"
                      whileTap={{ scale: 0.98 }}
                      title="Sync with on-chain status"
                    >
                      <RefreshCw size={16} className={syncingStatus ? 'animate-spin' : ''} />
                      <span>{syncingStatus ? 'Syncing...' : 'Sync Status'}</span>
                    </motion.button>
                  )}
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <XCircle size={24} />
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {/* Appeal Information Section */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">📋 Appeal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-300">Appeal ID</label>
                      <p className="text-white font-mono">#{selectedAppeal.id}</p>
                    </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">Dispute ID</label>
                      <p className="text-white font-mono">#{selectedAppeal.dispute_id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-300">Dispute Type</label>
                      <p className="text-white">{selectedAppeal.dispute_type}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-300">Status</label>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedAppeal.dispute_status)}`}>
                          {getStatusIcon(selectedAppeal.dispute_status)}
                          <span className="ml-1">{selectedAppeal.dispute_status}</span>
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-300">Appellant Address</label>
                      <p className="text-white font-mono text-sm break-all">{selectedAppeal.appellant_address}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-300">Appellant Type</label>
                      <p className="text-white">{selectedAppeal.appellant_type}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-300">Description</label>
                      <p className="text-white bg-white/5 p-3 rounded-lg mt-1">{selectedAppeal.description}</p>
                  </div>
                  <div>
                      <label className="text-sm font-medium text-gray-300">Appeal Created At</label>
                      <p className="text-white">{new Date(selectedAppeal.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Order Details Section */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">📦 Order Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="text-sm font-medium text-gray-300">Order ID</label>
                      <p className="text-white font-mono">#{selectedAppeal.order_id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-300">Amount</label>
                      <p className="text-white font-semibold">{selectedAppeal.amount} {selectedAppeal.token}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-300">Token</label>
                      <p className="text-white">{selectedAppeal.token}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-300">Order Created At</label>
                      <p className="text-white">{new Date(selectedAppeal.order_created_at).toLocaleString()}</p>
                  </div>
                  <div>
                      <label className="text-sm font-medium text-gray-300">Lock Expires At</label>
                      <p className="text-white">{new Date(selectedAppeal.lock_expires_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Buyer Information Section */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">👤 Buyer Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-300">Buyer Name</label>
                      <p className="text-white">{selectedAppeal.buyer_name || 'Not Available'}</p>
                    </div>
                <div>
                      <label className="text-sm font-medium text-gray-300">Buyer Address</label>
                      <p className="text-white font-mono text-sm break-all">{selectedAppeal.buyer_address}</p>
                    </div>
                  </div>
                </div>

                {/* Seller Information Section */}
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">👤 Seller Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="text-sm font-medium text-gray-300">Seller Name</label>
                      <p className="text-white">{selectedAppeal.seller_name || 'Not Available'}</p>
                  </div>
                    <div>
                      <label className="text-sm font-medium text-gray-300">Seller Address</label>
                      <p className="text-white font-mono text-sm break-all">{selectedAppeal.seller_address}</p>
                    </div>
                  </div>
                </div>

                {/* Evidence Section */}
                {selectedAppeal.evidence_video_url && (
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">📹 Video Evidence</h3>
                    <div className="mt-2">
                      <video 
                        controls 
                        className="w-full rounded-lg bg-black"
                        preload="metadata"
                        playsInline
                        style={{ maxHeight: '400px' }}
                      >
                        <source 
                          src={`/uploads/${selectedAppeal.evidence_video_url}`} 
                          type="video/webm" 
                        />
                        <source 
                          src={`/uploads/${selectedAppeal.evidence_video_url}`} 
                          type="video/mp4" 
                        />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                )}

              
                {(selectedAppeal.evidence_screenshots || selectedAppeal.evidence_documents) && (
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4 pb-2 border-b border-white/10">📎 Additional Evidence</h3>
                    {selectedAppeal.evidence_screenshots && selectedAppeal.evidence_screenshots.length > 0 && (
                      <div className="mb-4">
                        <label className="text-sm font-medium text-gray-300 mb-2 block">Screenshots</label>
                        <div className="text-gray-400 text-sm">
                          {selectedAppeal.evidence_screenshots.length} screenshot(s) uploaded
                        </div>
                      </div>
                    )}
                    {selectedAppeal.evidence_documents && selectedAppeal.evidence_documents.length > 0 && (
                  <div>
                        <label className="text-sm font-medium text-gray-300 mb-2 block">Documents</label>
                        <div className="text-gray-400 text-sm">
                          {selectedAppeal.evidence_documents.length} document(s) uploaded
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Resolve Appeal Actions */}
                {selectedAppeal.dispute_status === 'PENDING' && (
                  <div className="pt-4 border-t border-white/20">
                    <h3 className="text-lg font-medium text-white mb-4">Resolve Dispute</h3>
                    
                    {/* Trade Information */}
                    <div className="bg-white/5 rounded-lg p-4 mb-4 border border-white/10">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="text-xs text-gray-400">Amount</label>
                          <p className="text-white font-semibold">{selectedAppeal.amount} {selectedAppeal.token}</p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">Trade ID</label>
                          <p className="text-white font-mono text-sm">{selectedAppeal.blockchain_trade_id || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-gray-400">Buyer Address</label>
                          <p className="text-white font-mono text-xs break-all">{selectedAppeal.buyer_address}</p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">Seller Address</label>
                          <p className="text-white font-mono text-xs break-all">{selectedAppeal.seller_address}</p>
                        </div>
                      </div>
                    </div>

                    {!isConnected && (
                      <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 mb-4">
                        <p className="text-yellow-200 text-sm">
                          ⚠️ Please connect your wallet to resolve disputes on-chain
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <motion.button
                        onClick={() => handleInitiateResolution(selectedAppeal.id, true)}
                        disabled={isResolving || !isConnected}
                        className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-lg transition-all flex items-center justify-center space-x-3 font-medium"
                        whileTap={{ scale: 0.98 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        <CheckCircle size={20} />
                        <div className="text-left">
                          <div className="font-semibold">Release Full Amount</div>
                          <div className="text-xs text-green-100">Transfer to Buyer</div>
                        </div>
                      </motion.button>

                      <motion.button
                        onClick={() => handleInitiateResolution(selectedAppeal.id, false)}
                        disabled={isResolving || !isConnected}
                        className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-lg transition-all flex items-center justify-center space-x-3 font-medium"
                        whileTap={{ scale: 0.98 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        <XCircle size={20} />
                        <div className="text-left">
                          <div className="font-semibold">Refund Full Amount</div>
                          <div className="text-xs text-orange-100">Return to Seller</div>
                        </div>
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {confirmResolution.type && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 w-full max-w-md"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">
                  {confirmResolution.type === 'buyer' ? 'Release Funds to Buyer' : 'Refund Funds to Seller'}
                </h3>
                <button
                  onClick={() => setConfirmResolution({ type: null, appealId: '', reason: '' })}
                  className="text-gray-400 hover:text-white transition-colors"
                  disabled={isResolving}
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Appeal Info */}
                {selectedAppeal && (
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-400">Amount to {confirmResolution.type === 'buyer' ? 'Release' : 'Refund'}</label>
                        <p className="text-white font-semibold text-lg">{selectedAppeal.amount} {selectedAppeal.token}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">
                          {confirmResolution.type === 'buyer' ? 'Buyer' : 'Seller'} Address
                        </label>
                        <p className="text-white font-mono text-sm break-all">
                          {confirmResolution.type === 'buyer' ? selectedAppeal.buyer_address : selectedAppeal.seller_address}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reason Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Resolution Reason <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={confirmResolution.reason}
                    onChange={(e) => setConfirmResolution({ ...confirmResolution, reason: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter the reason for this resolution..."
                    disabled={isResolving}
                  />
                </div>

                {/* Warning */}
                <div className={`rounded-lg p-3 ${
                  confirmResolution.type === 'buyer' 
                    ? 'bg-green-500/20 border border-green-500/30' 
                    : 'bg-orange-500/20 border border-orange-500/30'
                }`}>
                  <p className={`text-sm ${
                    confirmResolution.type === 'buyer' 
                      ? 'text-green-200' 
                      : 'text-orange-200'
                  }`}>
                    ⚠️ This action will transfer the <strong>full amount</strong> on-chain. This cannot be undone.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={() => setConfirmResolution({ type: null, appealId: '', reason: '' })}
                    disabled={isResolving}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <motion.button
                    onClick={handleConfirmResolution}
                    disabled={isResolving || !confirmResolution.reason.trim()}
                    className={`flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium ${
                      confirmResolution.type === 'buyer'
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-orange-600 hover:bg-orange-700 text-white'
                    }`}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isResolving ? 'Processing...' : 'Confirm & Execute'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Wallet Selection Modal */}
        {showWalletModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowWalletModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 max-w-md w-full"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Choose Wallet</h2>
                <button
                  onClick={() => setShowWalletModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>
              
              <p className="text-gray-300 mb-6 text-sm">
                Select a wallet to connect and resolve appeals on-chain
              </p>

              <div className="space-y-3">
                <motion.button
                  onClick={handleConnectReown}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-lg transition-all flex items-center justify-between shadow-lg"
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                      <span className="text-purple-600 text-lg font-bold">R</span>
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-lg">Reown</div>
                      <div className="text-sm text-purple-100">Connect via Reown (WalletConnect)</div>
                    </div>
                  </div>
                  <div className="text-purple-200">→</div>
                </motion.button>
                
                <motion.button
                  onClick={handleConnectTrustWallet}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg transition-all flex items-center justify-between shadow-lg"
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                      <span className="text-blue-600 text-lg font-bold">T</span>
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-lg">Trust Wallet</div>
                      <div className="text-sm text-blue-100">Connect via Trust Wallet</div>
                    </div>
                  </div>
                  <div className="text-blue-200">→</div>
                </motion.button>
                
                <motion.button
                  onClick={handleConnectMetaMask}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-lg transition-all flex items-center justify-between shadow-lg"
                  whileTap={{ scale: 0.98 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                      <span className="text-orange-600 text-lg font-bold">🦊</span>
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-lg">MetaMask</div>
                      <div className="text-sm text-orange-100">Connect via MetaMask</div>
                    </div>
                  </div>
                  <div className="text-orange-200">→</div>
                </motion.button>
              </div>

              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-xs text-gray-400 text-center">
                  Make sure you have the wallet extension installed and unlocked
                </p>
              </div>
            </motion.div>
          </div>
        )}

        {/* RPC Help Modal */}
        {showRpcHelp && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRpcHelp(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 max-w-lg w-full"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">RPC Configuration Help</h2>
                <button
                  onClick={() => setShowRpcHelp(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              {rpcHelpMessage && (
                <div className="mb-4 text-sm text-orange-200 bg-orange-500/10 border border-orange-500/20 rounded p-3">
                  {rpcHelpMessage}
                </div>
              )}

              <p className="text-gray-300 text-sm mb-3">
                <strong className="text-white">Recommended BSC Mainnet RPC endpoints</strong> (try in this order):
              </p>
              <div className="space-y-2 mb-4">
                {[
                  { url: 'https://bsc-dataseed.binance.org/', label: 'Binance Official #1' },
                  { url: 'https://bsc-dataseed1.defibit.io/', label: 'DeFiBit #1' },
                  { url: 'https://bsc-dataseed1.nodereal.io', label: 'NodeReal #1' },
                  { url: 'https://bsc.publicnode.com', label: 'PublicNode' },
                  { url: 'https://bsc-mainnet-rpc.publicnode.com', label: 'PublicNode Alt' }
                ].map(({ url, label }) => (
                  <div key={url} className="bg-white/5 rounded p-3 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">{label}</span>
                      <div className="flex space-x-2">
                        <button
                          onClick={async () => {
                            const result = await testRpcEndpoint(url);
                            toast[result.success ? 'success' : 'error'](result.message);
                          }}
                          disabled={testingRpc === url}
                          className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 rounded text-white"
                        >
                          {testingRpc === url ? 'Testing...' : 'Test'}
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(url);
                            toast.success('RPC URL copied to clipboard!');
                          }}
                          className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-white"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <code className="text-xs break-all text-white/80 block">{url}</code>
                  </div>
                ))}
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3 mb-4">
                <p className="text-sm text-blue-200">
                  <strong>💡 Tip:</strong> Test each RPC endpoint before switching. Use the "Test" button to verify connectivity.
                </p>
              </div>

              <div className="mt-4">
                <p className="text-white font-semibold mb-2">How to change RPC in MetaMask:</p>
                <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">
                  <li>Open MetaMask ➜ Settings ➜ Networks ➜ BSC Mainnet.</li>
                  <li>Change RPC URL to one of the above and Save.</li>
                  <li>Reconnect wallet and retry the action.</li>
                </ol>
              </div>

              <div className="mt-3">
                <p className="text-white font-semibold mb-2">How to change RPC in Trust Wallet:</p>
                <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">
                  <li>Open DApp Browser ➜ Network selector.</li>
                  <li>Edit or add BSC Mainnet with the new RPC URL.</li>
                  <li>Reload page and reconnect wallet.</li>
                </ol>
              </div>

              <div className="mt-5 text-right">
                <button
                  onClick={() => setShowRpcHelp(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                >Got it</button>
              </div>
            </motion.div>
          </div>
        )}
    </div>
  );
};

export default AdminDisputes;
