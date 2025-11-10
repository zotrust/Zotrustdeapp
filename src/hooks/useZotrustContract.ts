import { ethers } from 'ethers';
import { useWalletStore } from '../stores/walletStore';
import { 
  ZOTRUST_CONTRACT_ABI, 
  ZOTRUST_CONTRACT_ADDRESS,
  BSC_TESTNET_CHAIN_ID,
  BSC_TESTNET_RPC,
  TOKENS,
  BSC_TESTNET_PARAMS
} from '../config/contracts';
import { debugSmartContract, quickContractCheck, testContractFunction } from '../utils/contractDebugger';
import toast from 'react-hot-toast';

export const useZotrustContract = () => {
  const { address, chainId } = useWalletStore();

  // Verify testnet connection
  const ensureTestnet = () => {
    if (chainId !== BSC_TESTNET_CHAIN_ID) {
      throw new Error(`Please switch to BSC Testnet (ChainID: ${BSC_TESTNET_CHAIN_ID})`);
    }
  };

  const getContract = async () => {
    if (!window.ethereum) {
      throw new Error('Wallet not connected');
    }
    ensureTestnet();

    const provider = new ethers.BrowserProvider(window.ethereum as any);
    const signer = await provider.getSigner();
    return new ethers.Contract(ZOTRUST_CONTRACT_ADDRESS, ZOTRUST_CONTRACT_ABI, signer);
  };

  const getReadOnlyContract = () => {
    const readProvider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);
    return new ethers.Contract(ZOTRUST_CONTRACT_ADDRESS, ZOTRUST_CONTRACT_ABI, readProvider);
  };

  // READ FUNCTIONS (Free - No Gas)

  const getTradeDetails = async (tradeId: number) => {
    try {
      const contract = getReadOnlyContract();
      const trade = await contract.trades(tradeId);
      return {
        id: trade.id.toString(),
        adPoster: trade.adPoster,
        counterParty: trade.counterParty,
        seller: trade.seller,
        buyer: trade.buyer,
        token: trade.token,
        amount: ethers.formatUnits(trade.amount, 18),
        adType: trade.adType, // 0=BUY, 1=SELL
        status: trade.status, // 0=Created, 1=Locked, 2=Released, 3=Cancelled
        expiryTime: Number(trade.expiryTime)
      };
    } catch (error) {
      console.error('Error getting trade details:', error);
      throw error;
    }
  };

  const getTradeCounter = async () => {
    try {
      const contract = getReadOnlyContract();
      const counter = await contract.tradeCounter();
      return Number(counter);
    } catch (error) {
      console.error('Error getting trade counter:', error);
      throw error;
    }
  };

  const isTokenAllowed = async (tokenAddress: string) => {
    try {
      const contract = getReadOnlyContract();
      const allowed = await contract.allowedTokens(tokenAddress);
      return allowed;
    } catch (error) {
      console.error('Error checking token allowance:', error);
      throw error;
    }
  };

  // WRITE FUNCTIONS (Cost Gas)

  const createTrade = async (
    adType: number, // 0=BUY, 1=SELL
    tokenSymbol: string,
    amount: string,
    counterParty: string = '0x0000000000000000000000000000000000000000'
  ) => {
    try {
      ensureTestnet();
      const contract = await getContract();
      
      const tokenAddress = TOKENS[tokenSymbol as keyof typeof TOKENS].address;
      
      const tx = await contract.createTrade(
        adType,
        tokenAddress,
        ethers.parseUnits(amount, 18),
        counterParty
      );

      toast.loading('Creating trade on testnet...', { id: 'create-trade' });
      
      const receipt = await tx.wait();
      
      // Extract tradeId from event logs
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === 'TradeCreated';
        } catch {
          return false;
        }
      });
      
      let tradeId;
      if (event) {
        const parsed = contract.interface.parseLog(event);
        tradeId = parsed?.args?.tradeId?.toString();
      }
      
      toast.success('Trade created on blockchain!', { id: 'create-trade' });
      
      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        tradeId
      };
    } catch (error: any) {
      console.error('Create trade error:', error);
      toast.error(error.message || 'Failed to create trade', { id: 'create-trade' });
      throw error;
    }
  };

  const lockFunds = async (tradeId: number) => {
    try {
      ensureTestnet();
      const contract = await getContract();
      
      const tx = await contract.lockFunds(tradeId);
      
      toast.loading('Locking funds...', { id: 'lock-funds' });
      
      const receipt = await tx.wait();
      
      toast.success('Funds locked successfully!', { id: 'lock-funds' });
      
      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error: any) {
      console.error('Lock funds error:', error);
      toast.error(error.message || 'Failed to lock funds', { id: 'lock-funds' });
      throw error;
    }
  };

  const releaseFunds = async (tradeId: number) => {
    try {
      ensureTestnet();
      const contract = await getContract();
      
      const tx = await contract.releaseFunds(tradeId);
      
      toast.loading('Releasing funds...', { id: 'release-funds' });
      
      const receipt = await tx.wait();
      
      toast.success('Funds released successfully!', { id: 'release-funds' });
      
      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error: any) {
      console.error('Release funds error:', error);
      toast.error(error.message || 'Failed to release funds', { id: 'release-funds' });
      throw error;
    }
  };

  const cancelTrade = async (tradeId: number) => {
    try {
      ensureTestnet();
      const contract = await getContract();
      
      const tx = await contract.cancelTrade(tradeId);
      
      toast.loading('Cancelling trade...', { id: 'cancel-trade' });
      
      const receipt = await tx.wait();
      
      toast.success('Trade cancelled!', { id: 'cancel-trade' });
      
      return {
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber
      };
    } catch (error: any) {
      console.error('Cancel trade error:', error);
      toast.error(error.message || 'Failed to cancel trade', { id: 'cancel-trade' });
      throw error;
    }
  };

  const approveToken = async (tokenSymbol: string, amount: string) => {
    try {
      ensureTestnet();
      
      // For TBNB (native token), no approval needed
      if (tokenSymbol === 'TBNB') {
        toast.success('TBNB is native token - no approval needed!');
        return null;
      }
      
      if (!window.ethereum) throw new Error('Provider not available');
      
      const tokenABI = [
        'function approve(address spender, uint256 amount) returns (bool)',
        'function allowance(address owner, address spender) view returns (uint256)'
      ];
      
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const tokenAddress = TOKENS[tokenSymbol as keyof typeof TOKENS].address;
      const tokenContract = new ethers.Contract(tokenAddress, tokenABI, signer);
      
      // Check current allowance
      const currentAllowance = await tokenContract.allowance(address, ZOTRUST_CONTRACT_ADDRESS);
      const requiredAmount = ethers.parseUnits(amount, 18);
      
      if (currentAllowance >= requiredAmount) {
        toast.success('Token already approved!');
        return null;
      }
      
      const tx = await tokenContract.approve(
        ZOTRUST_CONTRACT_ADDRESS,
        requiredAmount
      );
      
      toast.loading('Approving token...', { id: 'approve-token' });
      
      const receipt = await tx.wait();
      
      toast.success('Token approved!', { id: 'approve-token' });
      
      return receipt.hash;
    } catch (error: any) {
      console.error('Approve token error:', error);
      toast.error(error.message || 'Failed to approve token', { id: 'approve-token' });
      throw error;
    }
  };

  const switchToTestnet = async (): Promise<boolean> => {
    try {
      if (!window.ethereum) throw new Error('Wallet provider not found');

      // Try switching first
      await (window.ethereum as any).request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x61' }]
      });
      toast.success('Switched to BSC Testnet');
      return true;
    } catch (switchError: any) {
      // 4902 = Unrecognized chain, try adding network
      if (switchError?.code === 4902 || /Unrecognized chain/.test(String(switchError?.message || ''))) {
        try {
          await (window.ethereum as any).request({
            method: 'wallet_addEthereumChain',
            params: [BSC_TESTNET_PARAMS]
          });
          toast.success('BSC Testnet added and switched');
          return true;
        } catch (addError: any) {
          console.error('Failed to add BSC Testnet:', addError);
          toast.error('Failed to add BSC Testnet');
          return false;
        }
      }

      console.error('Failed to switch network:', switchError);
      toast.error('Failed to switch to BSC Testnet');
      return false;
    }
  };

  return {
    // Read functions
    getTradeDetails,
    getTradeCounter,
    isTokenAllowed,
    
    // Write functions
    createTrade,
    lockFunds,
    releaseFunds,
    cancelTrade,
    approveToken,
    
    // Utilities
    getContract,
    getReadOnlyContract,
    isTestnet: chainId === BSC_TESTNET_CHAIN_ID,
    
    // Debug functions
    debugContract: debugSmartContract,
    quickCheck: quickContractCheck,
    testFunction: testContractFunction,

    // Network helper
    switchToTestnet
  };
};
