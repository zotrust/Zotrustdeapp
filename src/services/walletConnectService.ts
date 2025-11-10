// WalletConnect Service for Trust Wallet and other mobile wallets
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc, bscTestnet } from '@reown/appkit/networks';
import { ethers } from 'ethers';

export interface WalletConnectConfig {
  projectId: string;
  metadata: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  networks: any[];
}

export class WalletConnectService {
  private static instance: WalletConnectService;
  private appKit: any = null;
  private provider: ethers.BrowserProvider | null = null;
  private isInitialized = false;
  private connectionCallbacks: ((connected: boolean) => void)[] = [];

  private constructor() {}

  public static getInstance(): WalletConnectService {
    if (!WalletConnectService.instance) {
      WalletConnectService.instance = new WalletConnectService();
    }
    return WalletConnectService.instance;
  }

  // Initialize WalletConnect with project configuration
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Project ID - you need to get this from https://cloud.reown.com/
      const projectId = "ec7b7de733ccdb815ca5ef14d3136983";
      
    
      
      // Create ethers adapter
      const ethersAdapter = new EthersAdapter();

      // Create the modal - only BSC networks with BSC Testnet as default
      this.appKit = createAppKit({
        adapters: [ethersAdapter],
        projectId,
        networks: [
          {
            ...bscTestnet,
            rpcUrls: {
              default: {
                http: [
                  'https://data-seed-prebsc-1-s1.binance.org:8545',
                  'https://data-seed-prebsc-2-s1.binance.org:8545',
                  'https://data-seed-prebsc-1-s2.binance.org:8545'
                ]
              }
            }
          },
          bsc
        ], // BSC Testnet first (default) with correct RPC URLs
        metadata: {
          name: 'Zotrust P2P Trading',
          description: 'Decentralized P2P Trading Platform with Voice Calls on BSC',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://zotrust.app',
          icons: ['https://zotrust.app/icon.png']
        },
        features: {
          analytics: true,
          email: false,
          socials: [],
          emailShowWallets: false
        }
      });

      // Subscribe to connection events
      this.appKit.subscribeAccount(async (account: any) => {
        console.log('WalletConnect Account Updated:', account);
        
        if (account.isConnected && account.address) {
          // Get the provider from the modal
          const provider = this.appKit.getWalletProvider();
          if (provider) {
            this.provider = new ethers.BrowserProvider(provider);
            
            // Ensure we're on BSC Testnet
            const currentChainId = this.appKit.getChainId();
            if (currentChainId !== 97) {
              console.log('🔄 WalletConnect: Switching to BSC Testnet...');
              try {
                await this.appKit.switchNetwork({ chainId: 97 });
              } catch (error) {
                console.warn('Failed to auto-switch to BSC Testnet:', error);
              }
            }
            
            this.notifyConnectionChange(true);
          }
        } else {
          this.provider = null;
          this.notifyConnectionChange(false);
        }
      });

      this.isInitialized = true;
      console.log('✅ WalletConnect initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize WalletConnect:', error);
      throw error;
    }
  }

  // Open wallet selection modal
  async openModal(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.appKit) {
      this.appKit.open();
    }
  }

  // Connect to wallet
  async connect(): Promise<{ address: string; chainId: number }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Check if already connected
      const account = this.appKit.getAccount();
      if (account && account.isConnected && account.address) {
        const chainId = this.appKit.getChainId() || 56; // Default to BSC mainnet
        return {
          address: account.address,
          chainId: chainId
        };
      }

      // Open the modal for new connection
      await this.appKit.open();
      
      // Return a promise that resolves when connection is established
      return new Promise((resolve, reject) => {
        let isResolved = false;
        let subscriptionCleanup: (() => void) | null = null;
        
        // Set up a one-time subscription to account changes
        try {
          subscriptionCleanup = this.appKit.subscribeAccount((newAccount: any) => {
            if (isResolved) return;
            
            if (newAccount && newAccount.isConnected && newAccount.address) {
              isResolved = true;
              
              const chainId = this.appKit.getChainId() || 56; // Default to BSC mainnet
              resolve({
                address: newAccount.address,
                chainId: chainId
              });
            }
          });
        } catch (subscribeError) {
          console.warn('Failed to set up account subscription:', subscribeError);
          // Fallback: poll for connection status
          const pollForConnection = () => {
            if (isResolved) return;
            
            const account = this.appKit.getAccount();
            if (account && account.isConnected && account.address) {
              isResolved = true;
              const chainId = this.appKit.getChainId() || 56;
              resolve({
                address: account.address,
                chainId: chainId
              });
            } else {
              setTimeout(pollForConnection, 1000);
            }
          };
          setTimeout(pollForConnection, 1000);
        }
        
        // Set a reasonable timeout (60 seconds) for user interaction
        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            reject(new Error('Connection cancelled or timed out. Please try again.'));
          }
        }, 60000);
        
        // Clean up function
        const cleanup = () => {
          clearTimeout(timeoutId);
          if (subscriptionCleanup && typeof subscriptionCleanup === 'function') {
            try {
              subscriptionCleanup();
            } catch (error) {
              console.warn('Failed to cleanup subscription:', error);
            }
          }
        };
        
        // Override resolve and reject to include cleanup
        const originalResolve = resolve;
        resolve = (value: any) => {
          cleanup();
          originalResolve(value);
        };
        
        const originalReject = reject;
        reject = (error: any) => {
          cleanup();
          originalReject(error);
        };
      });
    } catch (error) {
      console.error('WalletConnect connection failed:', error);
      throw error;
    }
  }

  // Disconnect wallet
  async disconnect(): Promise<void> {
    if (this.appKit) {
      await this.appKit.disconnect();
    }
    this.provider = null;
    this.notifyConnectionChange(false);
    console.log('🔌 WalletConnect disconnected');
  }

  // Get current account info
  async getAccountInfo(): Promise<{ address: string; chainId: number }> {
    const account = this.appKit.getAccount();
    const chainId = this.appKit.getChainId();

    if (!account || !account.address) {
      throw new Error('No account connected');
    }

    return { 
      address: account.address, 
      chainId: chainId || 97
    };
  }

  // Get provider for transactions
  getProvider(): ethers.BrowserProvider | null {
    return this.provider;
  }

  // Get signer for transactions
  async getSigner(): Promise<ethers.Signer | null> {
    if (!this.provider) return null;
    return await this.provider.getSigner();
  }

  // Check if connected
  isConnected(): boolean {
    const account = this.appKit?.getAccount();
    return account ? account.isConnected : false;
  }

  // Sign message
  async signMessage(message: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Wallet not connected');
    }

    const signer = await this.provider.getSigner();
    return await signer.signMessage(message);
  }

  // Get the current chain ID
  getChainId(): number | undefined {
    return this.appKit?.getChainId();
  }

  // Switch network
  async switchNetwork(targetChainId: number): Promise<void> {
    if (!this.appKit) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      console.log(`🔄 WalletConnect: Switching to network ${targetChainId}`);
      
      // Use AppKit's switchNetwork method
      await this.appKit.switchNetwork({
        chainId: targetChainId
      });
      
      console.log('✅ WalletConnect: Network switched successfully');
    } catch (error: any) {
      console.error('❌ WalletConnect: Network switch failed:', error);
      throw new Error(`Failed to switch WalletConnect network: ${error.message}`);
    }
  }

  // Subscribe to connection changes
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.connectionCallbacks.indexOf(callback);
      if (index > -1) {
        this.connectionCallbacks.splice(index, 1);
      }
    };
  }

  // Notify connection change
  private notifyConnectionChange(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('Error in connection callback:', error);
      }
    });
  }

  // Create Trust Wallet deep link
  static createTrustWalletDeepLink(wcUri: string): string {
    const encodedUri = encodeURIComponent(wcUri);
    return `trust://wc?uri=${encodedUri}`;
  }

  // Create universal Trust Wallet link
  static createTrustWalletUniversalLink(wcUri: string): string {
    const encodedUri = encodeURIComponent(wcUri);
    return `https://link.trustwallet.com/wc?uri=${encodedUri}`;
  }

  // Get QR code URI (for manual QR scanning)
  getQRCodeURI(): string | null {
    // This would need to be implemented based on the specific AppKit API
    // For now, the AppKit modal handles QR codes automatically
    return null;
  }

  // Check if Trust Wallet is installed (mobile detection)
  static isTrustWalletInstalled(): boolean {
    return typeof window !== 'undefined' && 
           /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // Check if we're on mobile
  static isMobile(): boolean {
    return typeof window !== 'undefined' && 
           /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
}

// Singleton instance
export const walletConnectService = WalletConnectService.getInstance();
