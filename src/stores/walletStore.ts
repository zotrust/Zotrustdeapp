
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
  updateBalances: () => Promise<void>;
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
  chainId: null, // BSC Testnet
  balance: {
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

      // Save wallet state to cookies
      saveWalletState(address, 'metamask', parsedChainId);

      // Enforce BSC Testnet only - Force switch if not on testnet
      if (parsedChainId !== 97) {
        console.log('🔄 Switching to BSC Testnet...');
        toast.loading('Switching to BSC Testnet...', { id: 'network-switch' });
        
        try {
          await get().switchToNetwork(97);
          
          // Wait a moment for network switch to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verify the switch was successful
          const newChainId = await (window.ethereum as any)!.request({
            method: 'eth_chainId',
          }) as string;
          
          const newParsedChainId = parseInt(newChainId, 16);
          
          if (newParsedChainId === 97) {
            set({ chainId: 97 });
            toast.success('Switched to BSC Testnet!', { id: 'network-switch' });
          } else {
            throw new Error('Failed to switch to BSC Testnet');
          }
        } catch (switchError: any) {
          console.error('Network switch failed:', switchError);
          const error = 'Please manually switch to BSC Testnet in MetaMask';
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

    // Enforce BSC Testnet only - Force switch if not on testnet
    if (parsedChainId !== 97) {
      console.log('🔄 Switching to BSC Testnet...');
      toast.loading('Switching to BSC Testnet...', { id: 'network-switch' });
      
      try {
        await get().switchToNetwork(97);
        
        // Wait a moment for network switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify the switch was successful
        const newChainId = await (window.ethereum as any)!.request({
          method: 'eth_chainId',
        }) as string;
        
        const newParsedChainId = parseInt(newChainId, 16);
        
        if (newParsedChainId === 97) {
          set({ chainId: 97 });
          toast.success('Switched to BSC Testnet!', { id: 'network-switch' });
        } else {
          throw new Error('Failed to switch to BSC Testnet');
        }
      } catch (switchError: any) {
        console.error('Network switch failed:', switchError);
        const error = 'Please manually switch to BSC Testnet in Trust Wallet';
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
    } catch (signError) {
      console.error('Signature failed:', signError);
      toast.error('Please sign the message to complete login');
      // Still continue even if signature fails
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

      // Save wallet state to cookies
      saveWalletState(address, 'walletconnect', chainId);

      // Enforce BSC Testnet only
      if (chainId !== 97) {
        console.log('🔄 WalletConnect: Not on BSC Testnet, attempting to switch...');
        toast.loading('Switching to BSC Testnet...', { id: 'walletconnect-switch' });
        
        try {
          // Use WalletConnect service to switch network
          await walletConnectService.switchNetwork(97);
          
          // Wait a moment for network switch to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Update chainId after switch
          const newChainId = walletConnectService.getChainId();
          if (newChainId === 97) {
            set({ chainId: 97 });
            toast.success('Switched to BSC Testnet!', { id: 'walletconnect-switch' });
          } else {
            // If we can't verify the switch, just continue with the connection
            console.log('Network switch attempted, continuing with connection...');
            toast.success('Network switch requested!', { id: 'walletconnect-switch' });
          }
        } catch (switchError: any) {
          console.error('WalletConnect network switch failed:', switchError);
          const error = 'Please manually switch to BSC Testnet in your wallet';
          set({ connectionError: error });
          toast.error(error, { id: 'walletconnect-switch' });
          return;
        }
      }

      await get().authenticateUser(address);
      await get().updateBalances();

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
      balance: { usdt: '0', wbnb: '0', usdc: '0' },
      connectionError: null,
      walletType: null
    });

    // Clear wallet state from cookies
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
            console.log('➕ Adding BSC Testnet to wallet...');
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
            console.log('✅ BSC Testnet added to wallet');
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

  updateBalances: async () => {
    const { address, isConnected, chainId, walletType } = get();
    if (!address || !isConnected || !chainId) return;

    set({ isUpdatingBalances: true });
    
    // For BSC Testnet (97), show TBNB balance and skip ERC20 calls
    if (chainId === 97) {
      console.log('🧪 BSC Testnet: Checking TBNB balance');
      try {
        let provider: ethers.BrowserProvider;

        // Get provider based on wallet type
        if (walletType === 'metamask') {
          provider = new ethers.BrowserProvider(window.ethereum! as any);
        } else {
          const wcProvider = walletConnectService.getProvider();
          if (!wcProvider) {
            throw new Error('WalletConnect provider not available');
          }
          provider = wcProvider;
        }

        // Get TBNB balance (native token on testnet)
        const balance = await provider.getBalance(address);
        const tbnbBalance = ethers.formatEther(balance);

        // Get WBNB balance (ERC20 token)
        let wbnbBalance = '0.00';
        try {
          console.log('📊 Fetching WBNB balance for:', address);
          const wbnbAddress = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd'; // WBNB on BSC Testnet
          const erc20Abi = [
            'function balanceOf(address) view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function symbol() view returns (string)'
          ];
          const wbnbContract = new ethers.Contract(wbnbAddress, erc20Abi, provider);
          
          // Get balance
          const wbnbBal = await wbnbContract.balanceOf(address);
          console.log('🔍 WBNB Raw Balance:', wbnbBal.toString());
          
          // Format with proper decimals
          wbnbBalance = parseFloat(ethers.formatEther(wbnbBal)).toFixed(6);
          console.log('✅ WBNB Formatted Balance:', wbnbBalance);
          
        } catch (error: any) {
          console.error('❌ Failed to fetch WBNB balance:', error);
          console.error('Error details:', error.message);
          wbnbBalance = '0.000000';
        }

        set({
          balance: {
            usdt: parseFloat(tbnbBalance).toFixed(6), // Show TBNB balance as primary
            wbnb: wbnbBalance, // WBNB (Wrapped BNB)
            usdc: '0.000000' // No USDC on testnet
          }
        });

        console.log('💰 TBNB balance updated:', tbnbBalance);
        console.log('💰 WBNB balance updated:', wbnbBalance);
      } catch (error) {
        console.error('Failed to fetch TBNB balance:', error);
        set({
          balance: {
            usdt: '0.00',
            wbnb: '0.00',
            usdc: '0.00'
          }
        });
      }
      set({ isUpdatingBalances: false });
      return;
    }

    // For other networks (not 97), show native balance only
    console.log('ℹ️ Non-BSC Testnet network: showing native balance only');
    try {
      let provider: ethers.BrowserProvider;

      if (walletType === 'metamask') {
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
          usdt: nativeBalance,
          wbnb: '0.00',
          usdc: '0.00'
        }
      });

      console.log('Native balance updated:', nativeBalance);
    } catch (error) {
      console.error('Failed to fetch native balance:', error);
      set({
        balance: {
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

      // Set the basic state
      set({
        address: walletState.address,
        isConnected: true,
        chainId: walletState.chainId,
        walletType: walletState.walletType as WalletType
      });

      // Try to restore the connection based on wallet type
      if (walletState.walletType === 'metamask') {
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
      } else if (walletState.walletType === 'walletconnect') {
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
      if (parsedChainId !== 97) {
        console.log('⚠️ Wrong network detected, requesting switch to BSC Testnet');
        toast.error('Please switch to BSC Testnet for proper functionality');
        
        // Try to switch to BSC Testnet
        try {
          await useWalletStore.getState().switchToNetwork(97);
          toast.success('Switched to BSC Testnet!');
        } catch (error) {
          console.error('Failed to auto-switch network:', error);
        }
      } else {
        console.log('✅ Connected to BSC Testnet');
        toast.success('Connected to BSC Testnet!');
      }
      
      // Update balances when network changes
      setTimeout(() => {
        useWalletStore.getState().updateBalances();
      }, 1000);
    });
  }
}

