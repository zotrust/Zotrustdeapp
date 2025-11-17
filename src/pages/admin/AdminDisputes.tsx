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
    reason: ''
  });
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [estimatedGasFee, setEstimatedGasFee] = useState<string | null>(null);
  const [blockchainStatus, setBlockchainStatus] = useState<{tradeId: number, status: number} | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

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
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
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

  // Fetch blockchain status for an appeal
  const fetchBlockchainStatus = async (appeal: Appeal) => {
    if (!window.ethereum) {
      console.warn('Wallet not available for status check');
      return null;
    }

    try {
      setIsCheckingStatus(true);
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const contract = new ethers.Contract(ZOTRUST_CONTRACT_ADDRESS, ZOTRUST_CONTRACT_ABI, provider);
      
      const preferredTradeId = (appeal as any)?.order?.blockchain_trade_id ?? 
                              (appeal as any)?.blockchain_trade_id ?? 
                              appeal?.order_id;
      const tradeId = Number(preferredTradeId);

      if (!tradeId || Number.isNaN(tradeId) || tradeId <= 0) {
        console.warn('Invalid trade ID for status check');
        return null;
      }

      const trade = await retryContractCall(() => contract.trades(tradeId), 2, 1000);
      const status = Number(trade.status);
      
      setBlockchainStatus({ tradeId, status });
      return status;
    } catch (error: any) {
      console.error('Error fetching blockchain status:', error);
      return null;
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleViewAppeal = async (appeal: Appeal) => {
    setSelectedAppeal(appeal);
    setShowModal(true);
    setBlockchainStatus(null);
    
    // Fetch blockchain status when modal opens
    if (window.ethereum) {
      await fetchBlockchainStatus(appeal);
    }
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
 * handleResolveAppeal - Admin dispute resolution flow
 * 
 * Required Flow:
 * 1. Check current blockchain status
 * 2. If LOCKED → Open appeal window (if possible) → Status becomes APPEAL_WINDOW_OPEN
 * 3. If APPEAL_WINDOW_OPEN → Try adminDecision() directly (contract may allow it)
 * 4. If UNDER_DISPUTE → Call adminDecision() to resolve
 * 
 * Important Notes:
 * - Admin CANNOT call fileAppeal() - only participants (buyer/seller) can file appeals
 * - Admin can call adminDecision() from UNDER_DISPUTE status (guaranteed to work)
 * - Admin may be able to call adminDecision() from APPEAL_WINDOW_OPEN (depends on contract)
 * - If status is LOCKED, admin must wait for appeal window or ask participant to file appeal
 * 
 * Status Flow (P2PEscrowV2 Contract):
 * 0 = CREATED          → Trade created, not locked yet
 * 1 = LOCKED           → Funds locked, waiting for payment confirmation
 * 2 = APPEAL_WINDOW_OPEN → Appeal window is open (auto-opens 2 hours after lock)
 * 3 = UNDER_DISPUTE    → Appeal filed by participant, trade in dispute ✅ Best state for admin resolution
 * 4 = RELEASED         → Funds released to buyer
 * 5 = REFUNDED         → Funds refunded to seller
 * 6 = COMPLETED        → Trade completed (final state)
 * 
 * @param appealId - Database appeal ID
 * @param releaseToBuyer - true = release to buyer, false = refund to seller
 * @param reason - Resolution reason for database
 */
const handleResolveAppeal = async (appealId: string, releaseToBuyer: boolean, reason: string) => {
  try {
    setIsResolving(true);

    const STATUS = {
      CREATED: 0,
      LOCKED: 1,
      APPEAL_WINDOW_OPEN: 2,
      UNDER_DISPUTE: 3,
      RELEASED: 4,
      REFUNDED: 5,
      COMPLETED: 6
    };

    // 1) Basic checks
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first');
      setIsResolving(false);
      return;
    }

    if (chainId !== BSC_MAINNET_CHAIN_ID) {
      toast.loading('Switching to BSC Mainnet...', { id: 'resolve-chain' });
      await switchToNetwork(BSC_MAINNET_CHAIN_ID);
      toast.success('Switched to BSC Mainnet', { id: 'switch-network' });
    }

    // 2) Get appeal and trade ID
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
      setIsResolving(false);
      return;
    }

    // 3) Connect to contract
    if (!window.ethereum) {
      toast.error('Wallet not available');
      setIsResolving(false);
      return;
    }

    toast.loading('Connecting to contract...', { id: 'resolve-chain' });
    const provider = new ethers.BrowserProvider(window.ethereum as any);
    const signer = await provider.getSigner();
    const network = await provider.getNetwork();

    if (Number(network.chainId) !== BSC_MAINNET_CHAIN_ID) {
      throw new Error(`Wrong network! Expected BSC Mainnet (56), got chain ${network.chainId}`);
    }

    const contract = new ethers.Contract(ZOTRUST_CONTRACT_ADDRESS, ZOTRUST_CONTRACT_ABI, signer);

    // 4) Verify admin
    const connectedAddress = (await signer.getAddress()).toLowerCase();
    const contractAdmin = (await retryContractCall(() => contract.admin(), 2, 1000)).toLowerCase();
    
    if (connectedAddress !== contractAdmin) {
      throw new Error(`You are not the contract admin`);
    }

    // 5) Check trade status
    toast.loading('Checking trade status...', { id: 'resolve-chain' });
    const trade = await retryContractCall(() => contract.trades(tradeId), 2, 1000);
    let tradeStatus = Number(trade.status);

    // 6) Handle already finalized trades
    if (tradeStatus === STATUS.RELEASED || tradeStatus === STATUS.COMPLETED) {
      await markAppealResolvedDB(appealId, 'TRANSFER_TO_BUYER', reason || 'Trade already released');
      toast.success('✅ Appeal marked as resolved (funds already released)', { id: 'resolve-chain' });
      fetchAppeals();
      setShowModal(false);
      setConfirmResolution({ type: null, appealId: '', reason: '' });
      setIsResolving(false);
      return;
    }

    if (tradeStatus === STATUS.REFUNDED) {
      await markAppealResolvedDB(appealId, 'REFUND_TO_SELLER', reason || 'Trade already refunded');
      toast.success('✅ Appeal marked as resolved (funds already refunded)', { id: 'resolve-chain' });
      fetchAppeals();
      setShowModal(false);
      setConfirmResolution({ type: null, appealId: '', reason: '' });
      setIsResolving(false);
      return;
    }

    // 7) Transition to UNDER_DISPUTE if needed (REQUIRED STEP)
    // Admin must move trade to UNDER_DISPUTE before resolving
    if (tradeStatus !== STATUS.UNDER_DISPUTE) {
      toast.loading(`Current status: ${tradeStatus}. Moving to UNDER_DISPUTE...`, { id: 'resolve-chain' });
      
      // Step 7a: If LOCKED, first open appeal window
      if (tradeStatus === STATUS.LOCKED) {
        toast.loading('Step 1/2: Opening appeal window...', { id: 'resolve-chain' });
        try {
          // Try autoOpenAppealWindow first, fallback to openAppealWindow
          let openTx;
          try {
            openTx = await contract.autoOpenAppealWindow(tradeId);
          } catch (error: any) {
            // If autoOpenAppealWindow doesn't exist, use openAppealWindow
            if (error.message?.includes('autoOpenAppealWindow')) {
              openTx = await contract.openAppealWindow(tradeId);
            } else {
              throw error;
            }
          }
          const receipt = await openTx.wait();
          console.log('✅ Appeal window opened, tx:', receipt.hash);
          
          // Verify status changed
          const updatedTrade = await retryContractCall(() => contract.trades(tradeId), 3, 1000);
          tradeStatus = Number(updatedTrade.status);
          
          if (tradeStatus === STATUS.APPEAL_WINDOW_OPEN) {
            toast.success('Step 1/2: Appeal window opened', { id: 'resolve-chain' });
          } else if (tradeStatus === STATUS.UNDER_DISPUTE) {
            // Already in dispute, skip to resolution
            toast.success('Trade is already in UNDER_DISPUTE', { id: 'resolve-chain' });
          } else {
            throw new Error(`Unexpected status after opening appeal window: ${tradeStatus}`);
          }
        } catch (error: any) {
          // Check if already in correct state
          const checkTrade = await retryContractCall(() => contract.trades(tradeId), 2, 1000);
          const checkStatus = Number(checkTrade.status);
          
          if (checkStatus === STATUS.APPEAL_WINDOW_OPEN || checkStatus === STATUS.UNDER_DISPUTE) {
            tradeStatus = checkStatus;
            console.log('Appeal window already open or in dispute, continuing...');
          } else {
            throw new Error(`Failed to open appeal window: ${error.message || error.reason || 'Unknown error'}`);
          }
        }
      }

      // Step 7b: Admin cannot file appeal (only participants can)
      // Try calling adminDecision directly - contract might allow it from APPEAL_WINDOW_OPEN
      if (tradeStatus === STATUS.APPEAL_WINDOW_OPEN) {
        // Check if adminDecision can be called from APPEAL_WINDOW_OPEN status
        toast.loading('Attempting admin resolution from APPEAL_WINDOW_OPEN status...', { id: 'resolve-chain' });
        // We'll try adminDecision directly below - skip to resolution step
        console.log('⚠️ Trade is in APPEAL_WINDOW_OPEN. Admin will attempt direct resolution.');
      } else if (tradeStatus === STATUS.LOCKED) {
        // If still LOCKED after opening appeal window, we need to wait or participant must file appeal
        throw new Error(
          `Trade is still LOCKED. Admin cannot file appeals (only participants can). ` +
          `Please wait for appeal window to open automatically, or ask buyer/seller to file an appeal first. ` +
          `Current status: ${tradeStatus}`
        );
      }
    }

    // 8) Try adminDecision - contract might allow it from APPEAL_WINDOW_OPEN or UNDER_DISPUTE
    // If status is UNDER_DISPUTE, proceed normally
    // If status is APPEAL_WINDOW_OPEN, try adminDecision (contract might allow it)
    if (tradeStatus === STATUS.UNDER_DISPUTE) {
      toast.loading('✅ Trade is in UNDER_DISPUTE. Proceeding with resolution...', { id: 'resolve-chain' });
    } else if (tradeStatus === STATUS.APPEAL_WINDOW_OPEN) {
      toast.loading('⚠️ Trade is in APPEAL_WINDOW_OPEN. Attempting admin resolution...', { id: 'resolve-chain' });
      console.log('⚠️ Admin attempting resolution from APPEAL_WINDOW_OPEN status (contract may or may not allow this)');
    } else {
      throw new Error(
        `Cannot resolve appeal. Trade status is ${tradeStatus}. ` +
        `Admin can only resolve from UNDER_DISPUTE (3) or APPEAL_WINDOW_OPEN (2). ` +
        `If status is LOCKED (1), please wait for appeal window to open or ask participant to file appeal.`
      );
    }

    // 9) Estimate gas
    toast.loading('Estimating gas...', { id: 'resolve-chain' });
    let gasEstimate: bigint;
    try {
      gasEstimate = await contract.adminDecision.estimateGas(tradeId, releaseToBuyer);
      gasEstimate = gasEstimate * BigInt(110) / BigInt(100); // 110% buffer
    } catch (error: any) {
      gasEstimate = BigInt(300000); // Fallback
    }

    // 10) Execute adminDecision
    toast.loading(
      releaseToBuyer ? 'Releasing funds to buyer...' : 'Refunding to seller...',
      { id: 'resolve-chain' }
    );

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('3', 'gwei');

    const tx = await contract.adminDecision(tradeId, releaseToBuyer, {
      gasLimit: gasEstimate,
      gasPrice: gasPrice
    });

    toast.loading('Waiting for confirmation...', { id: 'resolve-chain' });
    await tx.wait();


    const successMessage = releaseToBuyer 
      ? '✅ Funds released to buyer' 
      : '✅ Funds refunded to seller';
    
    toast.success(successMessage, { id: 'resolve-chain', duration: 5000 });

    // 11) Update backend
    await markAppealResolvedDB(
      appealId,
      releaseToBuyer ? 'TRANSFER_TO_BUYER' : 'REFUND_TO_SELLER',
      reason
    );

    toast.success('✅ Appeal resolved successfully');
    
    // Refresh blockchain status
    if (selectedAppeal) {
      await fetchBlockchainStatus(selectedAppeal);
    }
    
    fetchAppeals();
    setShowModal(false);
    setConfirmResolution({ type: null, appealId: '', reason: '' });

  } catch (error: any) {
    console.error('❌ Error resolving appeal:', error);
    toast.dismiss('resolve-chain');
    setEstimatedGasFee(null);
    
    if (error.code === 'ACTION_REJECTED' || error.message?.includes('User rejected')) {
      toast.error('Transaction rejected by user');
    } else if (error.code === 'CALL_EXCEPTION' || error.reason) {
      // Check if it's a status-related error
      const errorMessage = error.reason || error.message || 'Unknown contract error';
      
      if (errorMessage.includes('Not participant')) {
        toast.error(
          'Admin cannot file appeals. Please ask buyer or seller to file an appeal first, ' +
          'or wait for the trade to be in UNDER_DISPUTE status.',
          { duration: 8000 }
        );
      } else if (errorMessage.includes('Invalid state') || errorMessage.includes('status')) {
        toast.error(
          `Contract error: ${errorMessage}. ` +
          `The trade may need to be in UNDER_DISPUTE status. ` +
          `Please ask a participant to file an appeal first.`,
          { duration: 8000 }
        );
      } else {
        toast.error(`Contract error: ${errorMessage}`, { duration: 6000 });
      }
    } else {
      toast.error(error.message || 'Failed to resolve appeal');
    }
  } finally {
    setIsResolving(false);
    // Clear gas fee estimates after a delay
    setTimeout(() => {
      setEstimatedGasFee(null);
    }, 10000);
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
  
  const result = await response.json();
  
  // After successful backend update, sync blockchain status
  if (result.success && result.data?.orderId) {
    try {
      console.log('🔄 Syncing blockchain status for order:', result.data.orderId);
      const syncResponse = await fetch(`/api/admin/orders/${result.data.orderId}/sync-blockchain-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (syncResponse.ok) {
        const syncResult = await syncResponse.json();
        console.log('✅ Blockchain status synced:', syncResult);
      } else {
        console.warn('⚠️ Failed to sync blockchain status, but resolution succeeded');
      }
    } catch (syncError) {
      console.warn('⚠️ Error syncing blockchain status:', syncError);
      // Don't throw error - resolution already succeeded
    }
  }
  
  return response;
};
  const handleInitiateResolution = async (appealId: string, releaseToBuyer: boolean) => {
    setConfirmResolution({ 
      type: releaseToBuyer ? 'buyer' : 'seller', 
      appealId, 
      reason: '' 
    });
    
    // Estimate gas fee before showing confirmation
    setEstimatedGasFee(null);
    if (isConnected && window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum as any);
        const network = await provider.getNetwork();
        if (Number(network.chainId) === BSC_MAINNET_CHAIN_ID) {
          const signer = await provider.getSigner();
          const contract = new ethers.Contract(ZOTRUST_CONTRACT_ADDRESS, ZOTRUST_CONTRACT_ABI, signer);
          
          const appeal = appeals.find(a => String(a.id) === String(appealId));
          if (appeal) {
            const preferredTradeId = (appeal as any)?.order?.blockchain_trade_id ?? 
                                    (appeal as any)?.blockchain_trade_id ?? 
                                    appeal?.order_id;
            const tradeId = Number(preferredTradeId);
            
            if (tradeId && !Number.isNaN(tradeId) && tradeId > 0) {
              try {
                const gasEstimate = await contract.adminDecision.estimateGas(tradeId, releaseToBuyer);
                // Use 110% buffer to reduce gas fees
                const gasLimit = gasEstimate * BigInt(110) / BigInt(100);
                const feeData = await provider.getFeeData();
                let gasPrice = feeData.gasPrice;
                if (!gasPrice && feeData.maxFeePerGas) {
                  gasPrice = feeData.maxFeePerGas;
                }
                if (!gasPrice) {
                  gasPrice = ethers.parseUnits('3', 'gwei'); // Fallback: 3 gwei
                }
                const estimatedCost = gasLimit * gasPrice;
                const estimatedCostBNB = ethers.formatEther(estimatedCost);
                setEstimatedGasFee(estimatedCostBNB);
                console.log('⛽ Pre-estimated gas fee:', estimatedCostBNB, 'BNB');
              } catch (error) {
                console.warn('Could not pre-estimate gas fee:', error);
                setEstimatedGasFee(null);
              }
            }
          }
        }
      } catch (error) {
        console.warn('Could not estimate gas fee:', error);
        setEstimatedGasFee(null);
      }
    }
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

        {/* Appeals - Desktop Table / Mobile Cards */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
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

          {/* Mobile Card View */}
          <div className="md:hidden p-4 space-y-4">
            {filteredAppeals.map((appeal, index) => (
              <motion.div
                key={appeal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Appeal ID</div>
                    <div className="text-white font-mono font-semibold">#{appeal.id}</div>
                  </div>
                  <button
                    onClick={() => handleViewAppeal(appeal)}
                    className="text-blue-400 hover:text-blue-300 transition-colors p-2"
                  >
                    <Eye size={20} />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Order ID</div>
                    <div className="text-white font-mono text-sm">#{appeal.order_id}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Type</div>
                    <div className="text-white text-sm">{appeal.dispute_type}</div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-1">Status</div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appeal.dispute_status)}`}>
                    {getStatusIcon(appeal.dispute_status)}
                    <span className="ml-1">{appeal.dispute_status}</span>
                  </span>
                </div>

                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-1">Appellant</div>
                  <div className="text-white font-mono text-sm break-all">{appeal.appellant_address}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 mb-1">Created</div>
                  <div className="text-gray-300 text-sm">{new Date(appeal.created_at).toLocaleDateString()}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Appeal Details Modal */}
        {showModal && selectedAppeal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowModal(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 w-full max-w-5xl my-8"
              style={{ maxHeight: 'calc(100vh - 4rem)' }}
            >
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Appeal Details</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <XCircle size={24} />
                </button>
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

                {/* Blockchain Status Display */}
                {isCheckingStatus && !blockchainStatus && (
                  <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                      <p className="text-blue-300 text-sm">Checking blockchain status...</p>
                    </div>
                  </div>
                )}
                {blockchainStatus && (
                  <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs text-blue-300 mb-1 block">🔗 Blockchain Status</label>
                        <p className="text-white font-semibold">
                          {blockchainStatus.status === 0 && 'CREATED'}
                          {blockchainStatus.status === 1 && 'LOCKED'}
                          {blockchainStatus.status === 2 && 'APPEAL_WINDOW_OPEN'}
                          {blockchainStatus.status === 3 && 'UNDER_DISPUTE ✅'}
                          {blockchainStatus.status === 4 && 'RELEASED'}
                          {blockchainStatus.status === 5 && 'REFUNDED'}
                          {blockchainStatus.status === 6 && 'COMPLETED'}
                          {blockchainStatus.status > 6 && `Unknown (${blockchainStatus.status})`}
                        </p>
                      </div>
                      <button
                        onClick={() => selectedAppeal && fetchBlockchainStatus(selectedAppeal)}
                        disabled={isCheckingStatus}
                        className="text-blue-300 hover:text-blue-200 text-sm disabled:opacity-50 flex items-center space-x-1"
                      >
                        {isCheckingStatus ? (
                          <>
                            <div className="w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                            <span>Checking...</span>
                          </>
                        ) : (
                          <>
                            <span>🔄</span>
                            <span>Refresh</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-blue-400 mt-2">
                      Trade ID: {blockchainStatus.tradeId} | Status Code: {blockchainStatus.status}
                    </p>
                  </div>
                )}
                {!isCheckingStatus && !blockchainStatus && window.ethereum && (
                  <div className="bg-gray-500/20 border border-gray-500/30 rounded-lg p-3 mb-4">
                    <p className="text-gray-300 text-sm">
                      ⚠️ Could not fetch blockchain status. Click refresh to try again.
                    </p>
                    <button
                      onClick={() => selectedAppeal && fetchBlockchainStatus(selectedAppeal)}
                      className="text-blue-300 hover:text-blue-200 text-xs mt-2"
                    >
                      🔄 Retry
                    </button>
                  </div>
                )}

                {/* Resolve Appeal Actions - Based on Blockchain Status */}
                {(() => {
                  // Check if we can resolve based on blockchain status
                  const canResolve = blockchainStatus && 
                    blockchainStatus.status !== 4 && // Not RELEASED
                    blockchainStatus.status !== 5 && // Not REFUNDED
                    blockchainStatus.status !== 6;   // Not COMPLETED
                  
                  // Show resolution section if blockchain status allows OR if status not yet loaded
                  const showResolution = canResolve || !blockchainStatus;
                  
                  if (!showResolution) return null;
                  
                  return (
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
                            <p className="text-white font-mono text-sm">{selectedAppeal.blockchain_trade_id || selectedAppeal.order_id || 'N/A'}</p>
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

                      {/* Status Warning */}
                      {blockchainStatus && blockchainStatus.status !== 3 && (
                        <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 mb-4">
                          <p className="text-yellow-200 text-sm">
                            ⚠️ Current blockchain status: {blockchainStatus.status === 1 ? 'LOCKED' : blockchainStatus.status === 2 ? 'APPEAL_WINDOW_OPEN' : `Status ${blockchainStatus.status}`}
                          </p>
                          <p className="text-yellow-300 text-xs mt-1">
                            {blockchainStatus.status === 1 ? (
                              <>Admin cannot file appeals. Please wait for appeal window to open automatically, or ask buyer/seller to file an appeal first.</>
                            ) : blockchainStatus.status === 2 ? (
                              <>Admin will attempt resolution from APPEAL_WINDOW_OPEN. If this fails, a participant must file an appeal first to move to UNDER_DISPUTE.</>
                            ) : (
                              <>Admin will attempt to resolve. If status is not UNDER_DISPUTE, a participant may need to file an appeal first.</>
                            )}
                          </p>
                        </div>
                      )}

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
                  );
                })()}
              </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {confirmResolution.type && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isResolving) {
                setConfirmResolution({ type: null, appealId: '', reason: '' });
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 w-full max-w-md my-8"
              style={{ maxHeight: 'calc(100vh - 4rem)' }}
            >
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
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

                {/* Gas Fee Estimate */}
                {estimatedGasFee && (
                  <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-blue-300 mb-1">Estimated Network Fee</p>
                        <p className="text-lg font-bold text-blue-100">{estimatedGasFee} BNB</p>
                      </div>
                      <div className="text-2xl">⛽</div>
                    </div>
                    <p className="text-xs text-blue-400 mt-2">
                      This fee will be deducted from your wallet balance
                    </p>
                  </div>
                )}

                {/* Action Warning */}
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
                    ⚠️ This action will transfer <strong>{selectedAppeal?.amount} {selectedAppeal?.token}</strong> on-chain. This cannot be undone.
                  </p>
                  <p className={`text-xs mt-1 ${
                    confirmResolution.type === 'buyer' 
                      ? 'text-green-300' 
                      : 'text-orange-300'
                  }`}>
                    Note: 1% seller extra ({selectedAppeal ? (parseFloat(selectedAppeal.amount) * 0.01).toFixed(6) : '0'} {selectedAppeal?.token}) will remain in contract due to contract limitation.
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

    </div>
  );
};

export default AdminDisputes;
