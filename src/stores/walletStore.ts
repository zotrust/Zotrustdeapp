
import { create } from 'zustand';
import { ethers } from 'ethers';
import { WalletState } from '../types';
import { NETWORKS } from '../config/contracts';
import { useUserStore } from './userStore';
import { walletConnectService } from '../services/walletConnectService';
import { saveWalletState, getWalletState, clearWalletState } from '../utils/cookies';
import toast from 'react-hot-toast';

// Local type kept for reference if needed in the future
// interface EthereumProvider {
//   request: (args: { method: string; params?: any[] }) => Promise<any>;
//   on: (event: string, callback: (data: any) => void) => void;
//   removeListener: (event: string, callback: (data: any) => void) => void;
//   isMetaMask?: boolean;
//   isTrust?: boolean;
// }

// Avoid global Window redeclarations that conflict with other types; use casting where needed

type WalletType = 'metamask' | 'trustwallet' | 'walletconnect';

interface WalletStore extends WalletState {
  isConnecting: boolean;
  isUpdatingBalances: boolean;
  connectionError: string | null;
  walletType: WalletType | null;
  connect: (walletType?: WalletType) => Promise<void>;
  connectMetaMask: () => Promise<void>;
  connectTrustWallet: () => Promise<void>;
  connectWalletConnect: () => Promise<void>;
  authenticateUser: (address: string) => Promise<void>;
  disconnect: () => void;
  updateBalances: (showToast?: boolean) => Promise<void>;
  switchToNetwork: (chainId: number) => Promise<void>;
  clearError: () => void;
  restoreWalletState: () => Promise<void>;
  debugWalletDetection: () => any;
}

// Helper function to detect mobile wallets
const detectMobileWallets = () => {
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const hasEthereum = !!window.ethereum;
  const isMetaMask = hasEthereum && window.ethereum?.isMetaMask;
  
  // Enhanced Trust Wallet detection
  const isTrustWallet = hasEthereum && (
    window.ethereum?.isTrust || 
    window.ethereum?.isTrustWallet ||
    (window.ethereum as any)?.isTrustWallet ||
    navigator.userAgent.includes('TrustWallet') ||
    navigator.userAgent.includes('Trust Wallet')
  );
  
  return {
    isMobile,
    hasEthereum,
    isMetaMask,
    isTrustWallet,
    userAgent: navigator.userAgent
  };
};

export const useWalletStore = create<WalletStore>((set, get) => ({
  address: null,
  isConnected: false,
  chainId: null, // BSC Mainnet
  balance: {
    bnb: '0',
    usdt: '0',
    wbnb: '0',
    usdc: '0'
  },
  isConnecting: false,
  isUpdatingBalances: false,
  connectionError: null,
  walletType: null,

  connect: async (walletType?: WalletType) => {
    const { isConnecting } = get();
    
    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
      console.log('🔄 Connection already in progress, skipping...');
      return;
    }

    // Auto-detect wallet type if not provided
    if (!walletType) {
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      walletType = isMobile ? 'walletconnect' : 'metamask';
    }

    console.log('🔄 Connecting wallet type:', walletType);

    try {
      set({ isConnecting: true, connectionError: null, walletType });

      if (walletType === 'metamask') {
        await get().connectMetaMask();
      } else if (walletType === 'trustwallet') {
        await get().connectTrustWallet();
      } else {
        await get().connectWalletConnect();
      }

    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      let errorMessage = 'Wallet connection failed';
      
      if (error.code === 4001) {
        errorMessage = 'Connection cancelled by user';
      } else if (error.code === -32002) {
        errorMessage = 'Connection request already pending. Please wait and try again.';
        console.log('🔄 Connection already pending, will retry automatically...');
        // Don't show error toast for pending requests, just wait
        set({ connectionError: null, walletType: null });
        return;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      set({ connectionError: errorMessage, walletType: null });
      toast.error(errorMessage);
    } finally {
      set({ isConnecting: false });
    }
  },

  connectMetaMask: async () => {
    console.log('🦊 Connecting MetaMask...');

    // Enhanced mobile wallet detection
    const walletInfo = detectMobileWallets();
    console.log('🔍 Wallet detection:', walletInfo);

    if (!walletInfo.hasEthereum) {
      let error = 'कृपया MetaMask install करें या TrustWallet dApp browser का उपयोग करें';
      
      if (walletInfo.isMobile) {
        error = 'Mobile पर MetaMask app install करें या Trust Wallet dApp browser का उपयोग करें';
        console.log('📱 Mobile detected, suggesting mobile solutions');
      }
      
      set({ connectionError: error });
      toast.error(error);
      return;
    }

    // Check if it's actually MetaMask (not other wallet)
    if (!walletInfo.isMetaMask) {
      console.log('⚠️ Detected wallet is not MetaMask, but proceeding...');
      console.log('🔍 Ethereum provider info:', {
        isMetaMask: window.ethereum?.isMetaMask,
        isTrust: window.ethereum?.isTrust,
        isCoinbaseWallet: window.ethereum?.isCoinbaseWallet
      });
    }

      // Request account access
      const accounts = await (window.ethereum as any)!.request({
        method: 'eth_requestAccounts',
      }) as string[];

      if (!accounts || accounts.length === 0) {
      const error = 'कोई account नहीं मिला';
      set({ connectionError: error });
      toast.error(error);
        return;
      }

      const address = accounts[0];
      const chainId = await (window.ethereum as any)!.request({
        method: 'eth_chainId',
      }) as string;

      const parsedChainId = parseInt(chainId, 16);

      set({
        address,
        isConnected: true,
        chainId: parsedChainId,
        walletType: 'metamask'
      });

      // Save wallet state to cookies and sessionStorage
      saveWalletState(address, 'metamask', parsedChainId);
      sessionStorage.setItem('walletType', 'metamask');

      // Enforce BSC Mainnet only - Force switch if not on mainnet
      if (parsedChainId !== 56) {
        console.log('🔄 Switching to BSC Mainnet...');
        toast.loading('Switching to BSC Mainnet...', { id: 'network-switch' });
        
        try {
          await get().switchToNetwork(56);
          
          // Wait a moment for network switch to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verify the switch was successful
          const newChainId = await (window.ethereum as any)!.request({
            method: 'eth_chainId',
          }) as string;
          
          const newParsedChainId = parseInt(newChainId, 16);
          
          if (newParsedChainId === 56) {
            set({ chainId: 56 });
            toast.success('Switched to BSC Mainnet!', { id: 'network-switch' });
          } else {
            throw new Error('Failed to switch to BSC Mainnet');
          }
        } catch (switchError: any) {
          console.error('Network switch failed:', switchError);
          const error = 'Please manually switch to BSC Mainnet in MetaMask';
          set({ connectionError: error });
          toast.error(error, { id: 'network-switch' });
          return;
        }
      }

    await get().authenticateUser(address);
    await get().updateBalances();
  },

  connectTrustWallet: async () => {
    console.log('🔒 Connecting Trust Wallet...');

    // Enhanced mobile wallet detection
    const walletInfo = detectMobileWallets();
    console.log('🔍 Trust Wallet detection:', walletInfo);

    // For mobile devices, try to open Trust Wallet app directly
    if (walletInfo.isMobile && !walletInfo.hasEthereum) {
      console.log('📱 Mobile detected, attempting to open Trust Wallet app...');
      
      // Try Trust Wallet deep link
      const trustWalletUrl = `trust://open_url?url=${encodeURIComponent(window.location.href)}`;
      
      try {
        // Try to open Trust Wallet app
        window.location.href = trustWalletUrl;
        
        // Show fallback message
        toast.loading('Opening Trust Wallet app...', { duration: 3000 });
        
        // If we're still here after 2 seconds, show fallback
        setTimeout(() => {
          toast.error('Trust Wallet app not found. Please install Trust Wallet from the app store.');
        }, 2000);
        
        return;
      } catch (error) {
        console.log('Trust Wallet deep link failed, falling back to regular connection');
      }
    }

    if (!walletInfo.hasEthereum) {
      let error = 'कृपया Trust Wallet install करें या MetaMask dApp browser का उपयोग करें';
      
      if (walletInfo.isMobile) {
        error = 'Mobile पर Trust Wallet app install करें या MetaMask dApp browser का उपयोग करें';
        console.log('📱 Mobile detected, suggesting mobile solutions');
      }
      
      set({ connectionError: error });
      toast.error(error);
      return;
    }

    // Check if it's actually Trust Wallet (not other wallet)
    if (!walletInfo.isTrustWallet) {
      console.log('⚠️ Detected wallet is not Trust Wallet, but proceeding...');
      console.log('🔍 Ethereum provider info:', {
        isMetaMask: window.ethereum?.isMetaMask,
        isTrust: window.ethereum?.isTrust,
        isTrustWallet: window.ethereum?.isTrustWallet,
        isCoinbaseWallet: window.ethereum?.isCoinbaseWallet,
        userAgent: navigator.userAgent
      });
    }

    // Request account access
    const accounts = await (window.ethereum as any)!.request({
      method: 'eth_requestAccounts',
    }) as string[];

    if (!accounts || accounts.length === 0) {
      const error = 'कोई account नहीं मिला';
      set({ connectionError: error });
      toast.error(error);
      return;
    }

    const address = accounts[0];
    const chainId = await (window.ethereum as any)!.request({
      method: 'eth_chainId',
    }) as string;

    const parsedChainId = parseInt(chainId, 16);

    set({
      address,
      isConnected: true,
      chainId: parsedChainId,
      walletType: 'trustwallet'
    });

    // Save wallet state to cookies
    saveWalletState(address, 'trustwallet', parsedChainId);
    sessionStorage.setItem('walletType', 'trustwallet');

    // Enforce BSC Mainnet only - Force switch if not on mainnet
    if (parsedChainId !== 56) {
      console.log('🔄 Switching to BSC Mainnet...');
      toast.loading('Switching to BSC Mainnet...', { id: 'network-switch' });
      
      try {
        await get().switchToNetwork(56);
        
        // Wait a moment for network switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify the switch was successful
        const newChainId = await (window.ethereum as any)!.request({
          method: 'eth_chainId',
        }) as string;
        
        const newParsedChainId = parseInt(newChainId, 16);
        
        if (newParsedChainId === 56) {
          set({ chainId: 56 });
          toast.success('Switched to BSC Mainnet!', { id: 'network-switch' });
        } else {
          throw new Error('Failed to switch to BSC Mainnet');
        }
      } catch (switchError: any) {
        console.error('Network switch failed:', switchError);
        const error = 'Please manually switch to BSC Mainnet in Trust Wallet';
        set({ connectionError: error });
        toast.error(error, { id: 'network-switch' });
        return;
      }
    }

    await get().authenticateUser(address);
    await get().updateBalances();
  },

  // Helper method for user authentication
  authenticateUser: async (address: string) => {
    const { loginWithWallet, fetchUserProfile } = useUserStore.getState();
    
    // Generate a message for signature
    const message = `Welcome to Zotrust! Please sign this message to authenticate.\n\nTimestamp: ${Date.now()}`;
    
    try {
      let signature: string;
      
      const { walletType } = get();
      
      if (walletType === 'metamask') {
        // Request signature from MetaMask
        signature = await (window.ethereum as any)!.request({
          method: 'personal_sign',
          params: [message, address],
        });
      } else {
        // Request signature from WalletConnect
        signature = await walletConnectService.signMessage(message);
      }
      
      // Log in with wallet signature
      await loginWithWallet(address, signature, message);
      await fetchUserProfile(address);
      
      toast.success(`Wallet connected and logged in! ${address.slice(0, 6)}...${address.slice(-4)}`);
    } catch (signError: any) {
      // Check if user rejected the signature request
      const isUserRejection = 
        signError?.code === 'ACTION_REJECTED' ||
        signError?.code === 4001 ||
        signError?.message?.includes('User rejected') ||
        signError?.message?.includes('user rejected') ||
        signError?.message?.includes('user-denied') ||
        signError?.reason === 'rejected';
      
      if (isUserRejection) {
        // User intentionally rejected signature - don't show error, just info
        console.log('ℹ️ User skipped signature - wallet connected but not authenticated');
        
        // Try to fetch user profile anyway (in case they're already logged in)
        try {
          await fetchUserProfile(address);
          toast.success(`Wallet connected! ${address.slice(0, 6)}...${address.slice(-4)}`, {
            duration: 3000,
            icon: 'ℹ️'
          });
        } catch (profileError) {
          // If profile fetch fails, show a friendly message
          toast(`Wallet connected! Sign in later to access all features.`, {
            duration: 4000,
            icon: 'ℹ️'
          });
        }
      } else {
        // Actual error (not user rejection)
        console.error('Signature failed:', signError);
        
        // Try to fetch user profile anyway
        try {
          await fetchUserProfile(address);
          toast.success(`Wallet connected! ${address.slice(0, 6)}...${address.slice(-4)}`);
        } catch (profileError) {
          // Show error only if it's not a user rejection
          toast.error('Failed to authenticate. Wallet connected but some features may be limited.', {
            duration: 4000
          });
        }
      }
      // Always continue - wallet is connected even without signature
    }
  },

  connectWalletConnect: async () => {
    console.log('🔗 Connecting WalletConnect...');

    try {
      // Initialize WalletConnect service
      await walletConnectService.initialize();
      
      // Connect to wallet
      const { address, chainId } = await walletConnectService.connect();

      set({
        address,
        isConnected: true,
        chainId,
        walletType: 'walletconnect'
      });

      // Save wallet state to cookies and sessionStorage
      saveWalletState(address, 'walletconnect', chainId);
      sessionStorage.setItem('walletType', 'walletconnect');

      // Enforce BSC Mainnet only
      if (chainId !== 56) {
        console.log('🔄 WalletConnect: Not on BSC Mainnet, attempting to switch...');
        toast.loading('Switching to BSC Mainnet...', { id: 'walletconnect-switch' });
        
        try {
          // Use WalletConnect service to switch network
          await walletConnectService.switchNetwork(56);
          
          // Wait a moment for network switch to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Update chainId after switch
          const newChainId = walletConnectService.getChainId();
          if (newChainId === 56) {
            set({ chainId: 56 });
            toast.success('Switched to BSC Mainnet!', { id: 'walletconnect-switch' });
          } else {
            // If we can't verify the switch, just continue with the connection
            console.log('Network switch attempted, continuing with connection...');
            toast.success('Network switch requested!', { id: 'walletconnect-switch' });
          }
        } catch (switchError: any) {
          console.error('WalletConnect network switch failed:', switchError);
          const error = 'Please manually switch to BSC Mainnet in your wallet';
          set({ connectionError: error });
          toast.error(error, { id: 'walletconnect-switch' });
          return;
        }
      }

      await get().authenticateUser(address);
      
      // Wait a moment for provider to be fully ready, then fetch balances
      console.log('💰 WalletConnect: Waiting for provider to be ready...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch balances with retry
      try {
        await get().updateBalances();
        console.log('✅ WalletConnect: Balances fetched successfully');
      } catch (balanceError) {
        console.error('❌ WalletConnect: Balance fetch failed, retrying...', balanceError);
        // Retry after another delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        await get().updateBalances();
      }

    } catch (error: any) {
      console.error('WalletConnect connection failed:', error);
      
      // Handle specific errors with better messages
      if (error.message.includes('Project ID required')) {
        const errorMsg = 'WalletConnect setup incomplete. Using MetaMask instead.';
        toast.error(errorMsg);
        // Fallback to MetaMask if available
        if (window.ethereum) {
          await get().connectMetaMask();
          return;
        }
      } else if (error.message.includes('timeout') || error.message.includes('cancelled')) {
        throw new Error('Connection was cancelled or timed out. Please try connecting again.');
      } else if (error.message.includes('User rejected')) {
        throw new Error('Connection was rejected. Please approve the connection in your wallet.');
      } else if (error.message.includes('No accounts')) {
        throw new Error('No wallet accounts found. Please make sure your wallet is unlocked.');
      }
      
      throw error;
    }
  },

  disconnect: async () => {
    const { address, walletType } = get();
    
    // Disconnect from WalletConnect if needed
    if (walletType === 'walletconnect') {
      try {
        await walletConnectService.disconnect();
      } catch (error) {
        console.error('Failed to disconnect WalletConnect:', error);
      }
    }
    
    // Clear wallet connection but keep user data if available
    set({
      address: null,
      isConnected: false,
      chainId: null,
      balance: { bnb: '0', usdt: '0', wbnb: '0', usdc: '0' },
      connectionError: null,
      walletType: null
    });

    // Clear wallet state from cookies and sessionStorage
    sessionStorage.removeItem('walletType');
    clearWalletState();
    
    // Try to keep user logged in by fetching from database
    if (address) {
      try {
        const { fetchUserProfile } = useUserStore.getState();
        await fetchUserProfile(address);
        toast.success('Wallet disconnected, but you remain logged in');
      } catch (error) {
        console.error('Failed to fetch user after disconnect:', error);
        // If fetch fails, then logout completely
        const { setUser } = useUserStore.getState();
        setUser(null);
        localStorage.removeItem('authToken');
        toast.success('Wallet disconnected and logged out');
      }
    } else {
      // No address, complete logout
      const { setUser } = useUserStore.getState();
      setUser(null);
      localStorage.removeItem('authToken');
      toast.success('Wallet disconnected and logged out');
    }
  },

  switchToNetwork: async (targetChainId: number) => {
    try {
      if (!window.ethereum) {
        throw new Error('No wallet detected');
      }

      const chainIdHex = `0x${targetChainId.toString(16)}`;
      console.log(`🔄 Switching to network: ${targetChainId} (${chainIdHex})`);
      
      try {
        // First try to switch to the network
        await (window.ethereum as any)!.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });
        console.log('✅ Network switched successfully');
      } catch (switchError: any) {
        console.log('⚠️ Network switch failed, trying to add network...', switchError);
        
        // Network not added to wallet (error code 4902)
        if (switchError.code === 4902) {
          const network = NETWORKS[targetChainId as keyof typeof NETWORKS];
          if (network) {
            console.log('➕ Adding BSC Mainnet to wallet...');
            await (window.ethereum as any)!.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: chainIdHex,
                chainName: network.name,
                rpcUrls: [network.rpcUrl],
                blockExplorerUrls: [network.blockExplorerUrl],
                nativeCurrency: {
                  name: 'BNB',
                  symbol: 'BNB',
                  decimals: 18,
                },
              }],
            });
            console.log('✅ BSC Mainnet added to wallet');
          } else {
            throw new Error(`Network configuration not found for chain ID: ${targetChainId}`);
          }
        } else {
          // Other switch errors
          throw new Error(`Failed to switch network: ${switchError.message}`);
        }
      }
      
      // Verify the network switch
      const currentChainId = await (window.ethereum as any)!.request({
        method: 'eth_chainId',
      }) as string;
      
      const currentParsedChainId = parseInt(currentChainId, 16);
      
      if (currentParsedChainId !== targetChainId) {
        throw new Error(`Network switch verification failed. Expected: ${targetChainId}, Got: ${currentParsedChainId}`);
      }
      
      console.log('✅ Network switch verified successfully');
      
    } catch (error: any) {
      console.error('❌ Network switch failed:', error);
      throw error; // Re-throw to be handled by caller
    }
  },

  updateBalances: async (showToast: boolean = false) => {
    const { address, isConnected, chainId, walletType, isUpdatingBalances } = get();
    
    // Prevent multiple simultaneous balance updates
    if (isUpdatingBalances) {
      console.log('⏸️ Balance update already in progress, skipping duplicate call');
      return;
    }
    
    if (!address || !isConnected || !chainId) return;

    set({ isUpdatingBalances: true });
    
    // For BSC Mainnet (56), show BNB balance and ERC20 tokens
    if (chainId === 56) {
      console.log('🌐 BSC Mainnet: Checking BNB balance');
      try {
        let provider: ethers.BrowserProvider;

        // Get provider based on wallet type
        if (walletType === 'metamask' || walletType === 'trustwallet') {
          // Both MetaMask and Trust Wallet use window.ethereum
          if (!window.ethereum) {
            throw new Error(`${walletType === 'metamask' ? 'MetaMask' : 'Trust Wallet'} provider not available`);
          }
          provider = new ethers.BrowserProvider(window.ethereum! as any);
          console.log(`✅ Using ${walletType === 'metamask' ? 'MetaMask' : 'Trust Wallet'} provider for balance fetch`);
        } else {
          // For WalletConnect, ensure service is initialized
          let wcProvider = walletConnectService.getProvider();
          if (!wcProvider) {
            console.log('🔄 WalletConnect: Initializing service for balance fetch...');
            await walletConnectService.initialize();
            wcProvider = walletConnectService.getProvider();
          }
          
          if (!wcProvider) {
            console.error('❌ WalletConnect provider not available, retrying...');
            // Wait a bit and retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryProvider = walletConnectService.getProvider();
            if (!retryProvider) {
              throw new Error('WalletConnect provider not available');
            }
            provider = retryProvider;
          } else {
            provider = wcProvider;
          }
        }

        // Get BNB balance (native token)
        let bnbBalance = '0.00';
        try {
          console.log('📊 Fetching BNB balance for:', address);
          const balance = await provider.getBalance(address);
          bnbBalance = parseFloat(ethers.formatEther(balance)).toFixed(6);
          console.log('✅ BNB Formatted Balance:', bnbBalance);
        } catch (error: any) {
          console.error('❌ Failed to fetch BNB balance:', error);
          bnbBalance = '0.000000';
        }

        // ERC20 ABI for balance checking (shared for USDT and USDC)
        const erc20Abi = [
          'function balanceOf(address) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ];

        // Get USDT balance with retry logic and fallback to read-only provider
        let usdtBalance = '0.00';
        const usdtAddress = '0x55d398326f99059fF775485246999027B3197955'; // USDT on BSC Mainnet
        
        let retryCount = 0;
        const maxRetries = 2;
        let useReadOnlyProvider = false;
        
        while (retryCount < maxRetries) {
          try {
            console.log(`📊 Fetching USDT balance for: ${address} (attempt ${retryCount + 1})`);
            
            // Use read-only provider as fallback if wallet provider fails
            let contractProvider: ethers.BrowserProvider | ethers.JsonRpcProvider = provider;
            if (useReadOnlyProvider || retryCount > 0) {
              console.log('🔄 Using read-only RPC provider for USDT balance...');
              const { BSC_MAINNET_RPC } = await import('../config/contracts');
              contractProvider = new ethers.JsonRpcProvider(BSC_MAINNET_RPC);
            }
            
            const usdtContract = new ethers.Contract(usdtAddress, erc20Abi, contractProvider);
            
            // Try direct call with timeout
            const usdtBal = await Promise.race([
              usdtContract.balanceOf(address),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
            ]) as bigint;
            
            const usdtDecimals = await Promise.race([
              usdtContract.decimals(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
            ]) as number;
            
            usdtBalance = parseFloat(ethers.formatUnits(usdtBal, usdtDecimals)).toFixed(6);
            console.log('✅ USDT Formatted Balance:', usdtBalance);
            break; // Success, exit retry loop
          } catch (error: any) {
            retryCount++;
            console.error(`❌ Failed to fetch USDT balance (attempt ${retryCount}):`, error);
            
            // If it's a CALL_EXCEPTION, try read-only provider on next attempt
            if (error.code === 'CALL_EXCEPTION' || error.message?.includes('missing revert data')) {
              useReadOnlyProvider = true;
              console.log('🔄 CALL_EXCEPTION detected, will use read-only provider on retry');
            }
            
            if (retryCount < maxRetries) {
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            } else {
              // All retries failed, use fallback
              console.warn('⚠️ All USDT balance fetch attempts failed, using fallback');
              usdtBalance = '0.000000';
            }
          }
        }

        // Get USDC balance with retry logic and fallback to read-only provider
        let usdcBalance = '0.00';
        const usdcAddress = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'; // USDC on BSC Mainnet
        
        retryCount = 0;
        useReadOnlyProvider = false;
        
        while (retryCount < maxRetries) {
          try {
            console.log(`📊 Fetching USDC balance for: ${address} (attempt ${retryCount + 1})`);
            
            // Use read-only provider as fallback if wallet provider fails
            let contractProvider: ethers.BrowserProvider | ethers.JsonRpcProvider = provider;
            if (useReadOnlyProvider || retryCount > 0) {
              console.log('🔄 Using read-only RPC provider for USDC balance...');
              const { BSC_MAINNET_RPC } = await import('../config/contracts');
              contractProvider = new ethers.JsonRpcProvider(BSC_MAINNET_RPC);
            }
            
            const usdcContract = new ethers.Contract(usdcAddress, erc20Abi, contractProvider);
            
            // Try direct call with timeout
            const usdcBal = await Promise.race([
              usdcContract.balanceOf(address),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
            ]) as bigint;
            
            const usdcDecimals = await Promise.race([
              usdcContract.decimals(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
            ]) as number;
            
            usdcBalance = parseFloat(ethers.formatUnits(usdcBal, usdcDecimals)).toFixed(6);
            console.log('✅ USDC Formatted Balance:', usdcBalance);
            break; // Success, exit retry loop
          } catch (error: any) {
            retryCount++;
            console.error(`❌ Failed to fetch USDC balance (attempt ${retryCount}):`, error);
            
            // If it's a CALL_EXCEPTION, try read-only provider on next attempt
            if (error.code === 'CALL_EXCEPTION' || error.message?.includes('missing revert data')) {
              useReadOnlyProvider = true;
              console.log('🔄 CALL_EXCEPTION detected, will use read-only provider on retry');
            }
            
            if (retryCount < maxRetries) {
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            } else {
              // All retries failed, use fallback
              console.warn('⚠️ All USDC balance fetch attempts failed, using fallback');
              usdcBalance = '0.000000';
            }
          }
        }

        set({
          balance: {
            bnb: bnbBalance, // BNB balance (native token)
            usdt: usdtBalance, // USDT balance
            wbnb: usdcBalance, // USDC balance (stored in wbnb field for display)
            usdc: '0.000000' // Reserved field
          }
        });

        console.log('💰 BNB balance updated:', bnbBalance);
        console.log('💰 USDT balance updated:', usdtBalance);
        console.log('💰 USDC balance updated:', usdcBalance);
        
        // Show success toast only if explicitly requested (e.g., manual refresh)
        if (showToast && (parseFloat(bnbBalance) > 0 || parseFloat(usdtBalance) > 0 || parseFloat(usdcBalance) > 0)) {
          toast.success(`Balances: BNB ${parseFloat(bnbBalance).toFixed(4)}, USDT ${parseFloat(usdtBalance).toFixed(2)}, USDC ${parseFloat(usdcBalance).toFixed(2)}`, {
            duration: 3000,
            icon: '💰'
          });
        }
      } catch (error) {
        console.error('Failed to fetch token balances:', error);
        set({
          balance: {
            bnb: '0.00',
            usdt: '0.00',
            wbnb: '0.00',
            usdc: '0.00'
          }
        });
      } finally {
        set({ isUpdatingBalances: false });
      }
      return;
    }

    // For other networks (not 56), show native balance only
    console.log('ℹ️ Non-BSC Mainnet network: showing native balance only');
    try {
      let provider: ethers.BrowserProvider;

      if (walletType === 'metamask' || walletType === 'trustwallet') {
        // Both MetaMask and Trust Wallet use window.ethereum
        if (!window.ethereum) {
          throw new Error(`${walletType === 'metamask' ? 'MetaMask' : 'Trust Wallet'} provider not available`);
        }
        provider = new ethers.BrowserProvider(window.ethereum! as any);
      } else {
        const wcProvider = walletConnectService.getProvider();
        if (!wcProvider) {
          throw new Error('WalletConnect provider not available');
        }
        provider = wcProvider;
      }

      const balance = await provider.getBalance(address);
      const nativeBalance = ethers.formatEther(balance);

      set({
        balance: {
          bnb: nativeBalance,
          usdt: '0.00',
          wbnb: '0.00',
          usdc: '0.00'
        }
      });

      console.log('Native balance updated:', nativeBalance);
    } catch (error) {
      console.error('Failed to fetch native balance:', error);
        set({
          balance: {
            bnb: '0.00',
            usdt: '0.00',
            wbnb: '0.00',
            usdc: '0.00'
          }
        });
    }
  },

  clearError: () => {
    set({ connectionError: null });
  },

  // Debug function to help troubleshoot mobile wallet issues
  debugWalletDetection: () => {
    const walletInfo = detectMobileWallets();
    const debugInfo = {
      ...walletInfo,
      ethereum: !!window.ethereum,
      ethereumProviders: window.ethereum ? Object.keys(window.ethereum) : [],
      ethereumMethods: window.ethereum ? Object.getOwnPropertyNames(window.ethereum) : [],
      location: window.location.href,
      referrer: document.referrer
    };
    
    console.log('🔍 Wallet Debug Info:', debugInfo);
    return debugInfo;
  },

  restoreWalletState: async () => {
    try {
      const walletState = getWalletState();
      if (!walletState) return;

      console.log('🔄 Restoring wallet state from cookies:', walletState);

      // Restore walletType from sessionStorage first (most recent), fallback to cookie
      let walletType = walletState.walletType as WalletType;
      const sessionWalletType = sessionStorage.getItem('walletType');
      if (sessionWalletType && ['metamask', 'trustwallet', 'walletconnect'].includes(sessionWalletType)) {
        walletType = sessionWalletType as WalletType;
        console.log('📦 Restored walletType from sessionStorage:', walletType);
      }

      // Set the basic state
      set({
        address: walletState.address,
        isConnected: true,
        chainId: walletState.chainId,
        walletType: walletType
      });

      // Try to restore the connection based on wallet type (use restored walletType)
      if (walletType === 'metamask') {
        // For MetaMask, check if still connected
        if (window.ethereum) {
          try {
            const accounts = await (window.ethereum as any).request({ method: 'eth_accounts' }) as string[];
            if (accounts.length > 0 && accounts[0].toLowerCase() === walletState.address.toLowerCase()) {
              console.log('✅ MetaMask wallet restored successfully');
              await get().updateBalances();
              await get().authenticateUser(walletState.address);
              return;
            }
          } catch (error) {
            console.log('❌ MetaMask wallet not available, clearing state');
            get().disconnect();
          }
        }
      } else if (walletType === 'walletconnect') {
        // For WalletConnect, try to restore session
        try {
          await walletConnectService.initialize();
          if (walletConnectService.isConnected()) {
            console.log('✅ WalletConnect wallet restored successfully');
            await get().updateBalances();
            await get().authenticateUser(walletState.address);
            return;
          }
        } catch (error) {
          console.log('❌ WalletConnect session not available, clearing state');
          get().disconnect();
        }
      }

      // If we reach here, the wallet is not available, clear the state
      console.log('❌ Wallet not available, clearing saved state');
      get().disconnect();
    } catch (error) {
      console.error('❌ Failed to restore wallet state:', error);
      get().disconnect();
    }
  }
}));

// Auto-connect on page load if previously connected
if (typeof window !== 'undefined') {
  // Only auto-connect once on page load
  if (!(window as any).__zotrustAutoConnectTriggered) {
    (window as any).__zotrustAutoConnectTriggered = true;
    
    // Try to restore wallet state from cookies
    setTimeout(() => {
      useWalletStore.getState().restoreWalletState();
    }, 1000); // Wait 1 second for page to load
  }

  // Listen for account changes (only if ethereum is available)
  if (window.ethereum) {
    (window.ethereum as any).on('accountsChanged', async (accounts: string[]) => {
      console.log('🔄 Account changed:', accounts);
      if (accounts.length === 0) {
        useWalletStore.getState().disconnect();
      } else {
        // Only connect if not already connecting
        const { isConnecting } = useWalletStore.getState();
        if (!isConnecting) {
          await useWalletStore.getState().connect();
        }
      }
    });

    // Listen for network changes
    (window.ethereum as any).on('chainChanged', async (chainId: string) => {
      console.log('🔄 Chain changed:', chainId);
      const parsedChainId = parseInt(chainId, 16);
      useWalletStore.setState({ chainId: parsedChainId });
      
      // Check if on correct network
      if (parsedChainId !== 56) {
        console.log('⚠️ Wrong network detected, requesting switch to BSC Mainnet');
        toast.error('Please switch to BSC Mainnet for proper functionality');
        
        // Try to switch to BSC Mainnet
        try {
          await useWalletStore.getState().switchToNetwork(56);
          toast.success('Switched to BSC Mainnet!');
        } catch (error) {
          console.error('Failed to auto-switch network:', error);
        }
      } else {
        console.log('✅ Connected to BSC Mainnet');
        toast.success('Connected to BSC Mainnet!');
      }
      
      // Update balances when network changes
      setTimeout(() => {
        useWalletStore.getState().updateBalances();
      }, 1000);
    });
  }
}

