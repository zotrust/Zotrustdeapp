import { ethers } from 'ethers';
import { ZOTRUST_CONTRACT_ABI, ZOTRUST_CONTRACT_ADDRESS, BSC_MAINNET_RPC } from '../config/contracts';
import { useWalletStore } from '../stores/walletStore';
import { walletConnectService } from './walletConnectService';

/**
 * Blockchain Service - Direct Smart Contract Interaction
 * User's wallet calls smart contract functions directly
 */

export class BlockchainService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private contract: ethers.Contract | null = null;

  /**
   * Initialize provider and connect wallet
   * Uses the correct provider based on walletType from walletStore
   */
  async init() {
    try {
      // Get walletType from walletStore to determine which provider to use
      const walletType = useWalletStore.getState().walletType;
      
      console.log('🔍 Initializing blockchain service with walletType:', walletType);

      let provider: ethers.BrowserProvider;
      
      if (walletType === 'walletconnect') {
        // Use WalletConnect provider
        // Get the singleton instance
        const wcService = walletConnectService;
        
        // Ensure WalletConnect is initialized
        if (!(wcService as any).isInitialized) {
          console.log('🔄 WalletConnect not initialized, initializing now...');
          await wcService.initialize();
          // Wait a bit for provider to be set
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Try to get provider from WalletConnect service
        let wcProvider = wcService.getProvider();
        console.log('🔍 WalletConnect provider from service:', wcProvider ? 'Found' : 'Not found');
        
        // If provider not available, try to get it from appKit directly
        if (!wcProvider) {
          const appKit = (wcService as any).appKit;
          if (appKit) {
            console.log('🔍 Trying to get provider from appKit...');
            const walletProvider = appKit.getWalletProvider();
            if (walletProvider) {
              wcProvider = new ethers.BrowserProvider(walletProvider);
              console.log('✅ Got WalletConnect provider from appKit');
            } else {
              console.warn('⚠️ appKit.getWalletProvider() returned null');
            }
          } else {
            console.warn('⚠️ appKit is not available');
          }
        }
        
        // If still no provider, check if account is connected and try to get provider again
        if (!wcProvider) {
          const isConnected = wcService.isConnected();
          console.log('🔍 WalletConnect connected status:', isConnected);
          
          if (isConnected) {
            // Wait a bit and try again
            await new Promise(resolve => setTimeout(resolve, 2000));
            wcProvider = wcService.getProvider();
            console.log('🔍 Retry: WalletConnect provider:', wcProvider ? 'Found' : 'Still not found');
            
            // Last attempt: get from appKit again
            if (!wcProvider) {
              const appKit = (wcService as any).appKit;
              if (appKit) {
                const walletProvider = appKit.getWalletProvider();
                if (walletProvider) {
                  wcProvider = new ethers.BrowserProvider(walletProvider);
                  console.log('✅ Got WalletConnect provider from appKit (retry)');
                }
              }
            }
          }
        }
        
        if (!wcProvider) {
          throw new Error('WalletConnect provider not available. Please reconnect your wallet via WalletConnect.');
        }
        
        provider = wcProvider;
        console.log('✅ Using WalletConnect provider for transactions');
      } else {
        // Use window.ethereum for MetaMask/Trust Wallet
    if (!window.ethereum) {
      throw new Error('Please install MetaMask, Trust Wallet, or another Web3 wallet');
    }

        // Request wallet connection if not already connected
    try {
      await (window.ethereum as any).request({ method: 'eth_requestAccounts' });
        } catch (error: any) {
          // If already connected, this might fail, but that's okay
          if (error.code !== 4001) {
            console.warn('eth_requestAccounts failed (might already be connected):', error);
          }
        }
        
        provider = new ethers.BrowserProvider(window.ethereum as any);
        console.log('✅ Using window.ethereum provider');
      }
      
      // Create signer from provider
      this.provider = provider;
      this.signer = await provider.getSigner();
      
      const address = await this.signer.getAddress();
      console.log('✅ Signer created, address:', address);
      
      // Initialize contract with signer (for write operations)
      this.contract = new ethers.Contract(
        ZOTRUST_CONTRACT_ADDRESS,
        ZOTRUST_CONTRACT_ABI,
        this.signer
      );

      console.log('✅ Contract initialized');
      console.log('📋 Contract Address:', ZOTRUST_CONTRACT_ADDRESS);
      console.log('👛 Wallet Address:', address);
      
      // Verify contract is accessible (read-only call)
      try {
        const network = await provider.getNetwork();
        console.log('🌐 Network:', network.name, 'Chain ID:', network.chainId.toString());
        
        // Try a simple read call to verify contract is accessible
        if (this.contract) {
          try {
            const admin = await this.contract.admin();
            console.log('✅ Contract is accessible, admin:', admin);
          } catch (readError: any) {
            console.warn('⚠️ Could not read from contract (might be expected):', readError.message);
          }
        }
      } catch (networkError: any) {
        console.warn('⚠️ Could not get network info:', networkError.message);
      }
      
      // Detect wallet type for better error messages
      const detectedWalletType = this.detectWalletType();
      console.log('🔍 Detected wallet type:', detectedWalletType);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', error);
      throw error;
    }
  }

  /**
   * Detect the type of wallet being used
   * Uses walletType from walletStore if available, otherwise detects from window.ethereum
   */
  private detectWalletType(): string {
    // First, try to get walletType from walletStore (most accurate)
    // Use a more defensive approach to avoid circular dependency issues
    try {
      // Check if useWalletStore is available and accessible
      if (typeof useWalletStore !== 'undefined' && useWalletStore?.getState) {
        const walletType = useWalletStore.getState()?.walletType;
        if (walletType) {
          switch (walletType) {
            case 'metamask':
              return 'MetaMask';
            case 'trustwallet':
              return 'Trust Wallet';
            case 'walletconnect':
              // Check if it's Trust Wallet via WalletConnect
              if (window.ethereum?.isTrust || window.ethereum?.isTrustWallet) {
                return 'Trust Wallet (via WalletConnect)';
              }
              return 'WalletConnect';
            default:
              break;
          }
        }
      }
    } catch (error: any) {
      // Silently handle errors - fallback to detection from window.ethereum
      // Don't log the error details to avoid noise
      if (process.env.NODE_ENV === 'development') {
        console.warn('Could not get walletType from store, using fallback detection');
      }
    }
    
    // Fallback to detection from window.ethereum
    if (!window.ethereum) return 'Unknown Wallet';
    
    if (window.ethereum.isMetaMask) return 'MetaMask';
    if (window.ethereum.isTrust || window.ethereum.isTrustWallet) return 'Trust Wallet';
    if (window.ethereum.isCoinbaseWallet) return 'Coinbase Wallet';
    if (window.ethereum.isRabby) return 'Rabby';
    if (window.ethereum.isBraveWallet) return 'Brave Wallet';
    
    // Check user agent for mobile wallets
    const userAgent = navigator.userAgent;
    if (userAgent.includes('TrustWallet') || userAgent.includes('Trust Wallet')) {
      return 'Trust Wallet (Mobile)';
    }
    
    return 'Unknown Wallet';
  }

  /**
   * Check if Trust Wallet is available
   */
  isTrustWalletAvailable(): boolean {
    if (!window.ethereum) return false;
    
    return !!(
      window.ethereum.isTrust || 
      window.ethereum.isTrustWallet ||
      (window.ethereum as any)?.isTrustWallet ||
      navigator.userAgent.includes('TrustWallet') ||
      navigator.userAgent.includes('Trust Wallet')
    );
  }

  /**
   * Get wallet-specific instructions for fund locking
   */
  getWalletInstructions(): string {
    const walletType = this.detectWalletType();
    
    switch (walletType) {
      case 'Trust Wallet':
        return 'Trust Wallet detected! Make sure you have sufficient BNB for gas fees and the required token balance.';
      case 'Trust Wallet (Mobile)':
        return 'Trust Wallet Mobile detected! Ensure you have sufficient BNB for gas fees and the required token balance.';
      case 'MetaMask':
        return 'MetaMask detected! Make sure you have sufficient BNB for gas fees and the required token balance.';
      default:
        return 'Make sure you have sufficient BNB for gas fees and the required token balance.';
    }
  }

  /**
   * Create trade on blockchain first
   * @param orderData - Order details
   * @returns Blockchain trade ID
   */
  async createTrade(orderData: {
    token: string; // Token contract address
    amount: string; // Amount in tokens
    buyer: string; // Buyer address (caller is always seller)
    isNativeBNB?: boolean; // Flag for native BNB
  }): Promise<{ tradeId: number; txHash: string }> {
    // Ensure provider and contract are initialized with correct wallet
    const walletType = useWalletStore.getState()?.walletType;
    if (!this.contract || !this.signer || !this.provider) {
      console.log('🔄 Re-initializing blockchain service for createTrade...');
      await this.init();
    }
    
    // Double-check for WalletConnect
    if (walletType === 'walletconnect') {
      console.log('🔄 Ensuring WalletConnect provider is ready for createTrade...');
      await this.init();
      
      // Verify we have everything
      if (!this.provider || !this.signer || !this.contract) {
        throw new Error('WalletConnect provider not ready. Please ensure your wallet is connected via WalletConnect.');
      }
      
      const signerAddress = await this.signer.getAddress();
      console.log('✅ WalletConnect ready, signer address:', signerAddress);
    }

    try {
      console.log('⛓️ Creating trade on blockchain (P2PEscrowV2)...');
      console.log('🪙 Token:', orderData.token);
      console.log('💰 Amount:', orderData.amount);
      console.log('👤 Buyer:', orderData.buyer);
      console.log('🔍 Is Native BNB?', orderData.isNativeBNB);
      console.log('👛 Wallet Type:', walletType);

      // Convert amount to wei (18 decimals)
      const amountWei = ethers.parseUnits(orderData.amount, 18);

      // Check if this is native BNB (address(0))
      const isNativeBNB = orderData.token === '0x0000000000000000000000000000000000000000' || orderData.isNativeBNB;
      
      if (isNativeBNB) {
        console.log('📝 Creating trade with NATIVE BNB (address(0))');
        console.log('💡 Note: No BNB sent now - will be sent during lockFunds()');
      } else {
        console.log('📝 Creating trade with ERC20 token (WBNB/USDT/USDC)');
      }

      // Verify contract and signer are ready
      if (!this.contract) {
        throw new Error('Contract not initialized. Please reconnect your wallet.');
      }
      if (!this.signer) {
        throw new Error('Signer not available. Please reconnect your wallet.');
      }
      
      // Verify contract has createTrade function
      if (!this.contract.createTrade) {
        throw new Error('createTrade function not found in contract. Please check the contract ABI.');
      }
      
      // Get trade counter before transaction (for fallback method)
      let tradeCounterBefore = 0;
      try {
        if (this.contract && this.contract.tradeCounter) {
          tradeCounterBefore = Number(await this.contract.tradeCounter());
          console.log('📊 Trade counter before transaction:', tradeCounterBefore);
        }
      } catch (counterError: any) {
        console.warn('⚠️ Could not get trade counter before transaction:', counterError.message);
      }

      // For WalletConnect, estimate gas and add buffer
      let tx;
      if (walletType === 'walletconnect') {
        console.log('🔧 WalletConnect detected - estimating gas for createTrade...');
        try {
          // Estimate gas first
          console.log('⛽ Estimating gas...');
          const gasEstimate = await this.contract.createTrade.estimateGas(
        orderData.token,
        amountWei,
        orderData.buyer
      );
          
          // Add 30% buffer for WalletConnect
          const gasLimit = (gasEstimate * 130n) / 100n;
          
          console.log('⛽ Estimated gas:', gasEstimate.toString());
          console.log('⛽ Gas limit with buffer:', gasLimit.toString());
          
          console.log('📝 Sending createTrade transaction with explicit gas...');
          tx = await this.contract.createTrade(
            orderData.token,
            amountWei,
            orderData.buyer,
            {
              gasLimit: gasLimit
            }
          );
          console.log('✅ Transaction sent with explicit gas');
        } catch (gasError: any) {
          console.warn('⚠️ Gas estimation failed, trying without explicit gas:', gasError);
          console.error('⚠️ Gas estimation error details:', {
            code: gasError.code,
            message: gasError.message,
            reason: gasError.reason
          });
          // Fallback: try without explicit gas limit
          try {
            console.log('📝 Attempting createTrade without explicit gas...');
            tx = await this.contract.createTrade(
              orderData.token,
              amountWei,
              orderData.buyer
            );
            console.log('✅ Transaction sent without explicit gas');
          } catch (fallbackError: any) {
            console.error('❌ createTrade failed even without explicit gas:', fallbackError);
            console.error('❌ Fallback error details:', {
              code: fallbackError.code,
              message: fallbackError.message,
              reason: fallbackError.reason,
              data: fallbackError.data
            });
            throw fallbackError;
          }
        }
      } else {
        // Standard wallet (MetaMask, etc.)
        console.log('📝 Sending createTrade transaction (standard wallet)...');
        tx = await this.contract.createTrade(
          orderData.token,
          amountWei,
          orderData.buyer
        );
        console.log('✅ Transaction sent');
      }
      
      console.log('📡 Transaction sent:', tx.hash);
      console.log('⏳ Waiting for confirmation...');

      const receipt = await tx.wait();
      console.log('✅ Trade created on blockchain!');
      console.log('📦 Block number:', receipt.blockNumber);
      console.log('📋 Receipt status:', receipt.status);
      
      // Verify transaction succeeded
      if (receipt.status !== 1) {
        throw new Error(`Transaction failed on blockchain. Status: ${receipt.status}. Please check on BSCScan: ${tx.hash}`);
      }

      // Parse trade ID from events using ethers event filtering (more reliable)
      console.log('🔍 Parsing transaction receipt for TradeCreated event...');
      console.log('📋 Receipt logs count:', receipt.logs.length);
      
      let tradeId = 0;
      
      // Method 1: Use ethers event filtering (most reliable)
      try {
        const tradeCreatedFilter = this.contract!.filters.TradeCreated();
        const events = await this.contract!.queryFilter(tradeCreatedFilter, receipt.blockNumber, receipt.blockNumber);
        
        // Find the event from this specific transaction
        const ourEvent = events.find((event: any) => {
          return event.transactionHash === tx.hash;
        });
        
        // Check if it's an EventLog (has args) and extract tradeId
        if (ourEvent && 'args' in ourEvent && ourEvent.args) {
          const eventArgs = ourEvent.args as any;
          tradeId = Number(eventArgs.tradeId || 0);
          console.log('✅ TradeCreated event found via queryFilter!');
          console.log('✅ Trade ID from event:', tradeId);
          console.log('📊 Event args:', {
            tradeId: eventArgs.tradeId?.toString(),
            seller: eventArgs.seller,
            buyer: eventArgs.buyer,
            token: eventArgs.token,
            amount: eventArgs.amount?.toString()
          });
        }
      } catch (filterError: any) {
        console.warn('⚠️ Event filtering failed, trying direct log parsing:', filterError.message);
      }

      // Method 2: If event filtering didn't work, try parsing logs directly
      if (tradeId === 0) {
        console.log('🔄 Trying direct log parsing...');
        for (let i = 0; i < receipt.logs.length; i++) {
          const log = receipt.logs[i];
          try {
            // Check if this log is from our contract
            if (log.address.toLowerCase() !== ZOTRUST_CONTRACT_ADDRESS.toLowerCase()) {
              continue;
            }
            
            const parsed = this.contract!.interface.parseLog({
              topics: log.topics || [],
              data: log.data || '0x'
            });
            
            console.log(`📋 Log ${i}: Event name: ${parsed?.name}`);
            
            if (parsed?.name === 'TradeCreated') {
              tradeId = Number(parsed.args?.tradeId || 0);
              console.log('✅ TradeCreated event found via direct parsing!');
              console.log('✅ Trade ID from event:', tradeId);
              console.log('📊 Event args:', parsed.args);
              break;
            }
          } catch (parseError: any) {
            // This log doesn't belong to our contract or can't be parsed, skip it
            continue;
          }
        }
      }

      // Method 3: Fallback - Get trade ID from contract state (tradeCounter)
      if (tradeId === 0 || isNaN(tradeId)) {
        console.warn('⚠️ TradeCreated event not found, trying fallback method...');
        try {
          console.log('🔄 Fallback: Getting trade ID from contract state...');
          
          const signerAddress = await this.signer!.getAddress();
          console.log('👛 Signer address for verification:', signerAddress);
          
          // Get the current trade counter from the contract
          if (this.contract && this.contract.tradeCounter) {
            const tradeCounterAfter = Number(await this.contract.tradeCounter());
            console.log('📊 Trade counter after transaction:', tradeCounterAfter);
            console.log('📊 Trade counter before transaction:', tradeCounterBefore);
            
            // Strategy: Search through recent trade IDs to find the one that matches
            // Start from tradeCounterAfter and go backwards, or try tradeCounterBefore + 1
            const candidates: number[] = [];
            
            // Add candidates based on counter logic
            if (tradeCounterAfter > 0) {
              candidates.push(tradeCounterAfter);
            }
            if (tradeCounterBefore > 0) {
              candidates.push(tradeCounterBefore + 1);
            }
            
            // Also check a few recent trades in case of race conditions
            const maxRecentTrades = 5;
            for (let i = 1; i <= maxRecentTrades && tradeCounterAfter - i > 0; i++) {
              candidates.push(tradeCounterAfter - i);
            }
            
            // Remove duplicates and sort
            const uniqueCandidates = [...new Set(candidates)].sort((a, b) => b - a);
            console.log('🔍 Searching through candidate trade IDs:', uniqueCandidates);
            
            // Try each candidate
            for (const candidateId of uniqueCandidates) {
              try {
                console.log(`🔍 Checking trade ID ${candidateId}...`);
                const trade = await this.contract.trades(candidateId);
                
                // Check if trade exists and has valid data
                if (trade && trade.seller) {
                  const tradeSeller = trade.seller.toLowerCase();
                  const tradeBuyer = trade.buyer?.toLowerCase() || '';
                  const expectedBuyer = orderData.buyer.toLowerCase();
                  
                  console.log(`📊 Trade ${candidateId} details:`, {
                    seller: tradeSeller,
                    buyer: tradeBuyer,
                    expectedBuyer: expectedBuyer,
                    token: trade.token,
                    amount: trade.amount?.toString()
                  });
                  
                  // Verify seller matches
                  if (tradeSeller === signerAddress.toLowerCase()) {
                    // Also verify buyer matches if available
                    if (!tradeBuyer || tradeBuyer === expectedBuyer || tradeBuyer === '0x0000000000000000000000000000000000000000') {
                      tradeId = candidateId;
                      console.log('✅ Found matching trade! ID:', tradeId);
                      console.log('✅ Seller matches:', tradeSeller);
                      console.log('✅ Buyer matches or not set yet');
                      break;
                    } else {
                      console.log(`⚠️ Trade ${candidateId} seller matches but buyer doesn't match`);
                    }
                  } else {
                    console.log(`⚠️ Trade ${candidateId} seller doesn't match`);
                  }
                }
              } catch (checkError: any) {
                // Trade might not exist, continue to next candidate
                console.log(`⚠️ Could not check trade ${candidateId}:`, checkError.message);
                continue;
              }
            }
            
            // If still not found, use the most likely candidate (tradeCounterAfter)
            if (tradeId === 0 && tradeCounterAfter > 0) {
              console.warn('⚠️ Could not find exact match, using tradeCounterAfter as fallback');
              tradeId = tradeCounterAfter;
            }
            
            if (tradeId === 0) {
              throw new Error(`Could not find matching trade ID. Searched ${uniqueCandidates.length} candidates.`);
            }
          } else {
            console.error('❌ tradeCounter function not available in contract');
            throw new Error('tradeCounter function not available');
          }
        } catch (fallbackError: any) {
          console.error('❌ Fallback method also failed:', fallbackError);
          console.error('❌ Fallback error details:', {
            message: fallbackError.message,
            code: fallbackError.code,
            reason: fallbackError.reason
          });
          console.error('❌ Could not extract trade ID from transaction receipt');
          console.error('📋 Transaction hash:', tx.hash);
          console.error('📋 Block number:', receipt.blockNumber);
          console.error('📋 Receipt status:', receipt.status);
          console.error('📋 Logs count:', receipt.logs.length);
          console.error('📋 Logs:', receipt.logs.map((log: any) => ({
            address: log.address,
            topics: log.topics?.length || 0,
            dataLength: log.data?.length || 0
          })));
          throw new Error('Failed to extract trade ID from blockchain transaction. The TradeCreated event was not found and fallback method also failed. Please check the transaction on BSCScan: ' + tx.hash);
        }
      }

      // Final validation
      if (tradeId === 0 || isNaN(tradeId)) {
        console.error('❌ Invalid trade ID after all methods:', tradeId);
        console.error('📋 Transaction hash:', tx.hash);
        throw new Error('Failed to extract valid trade ID. Transaction may have failed. Please check on BSCScan: ' + tx.hash);
      }

      console.log('✅ Final trade ID:', tradeId);
      return { tradeId, txHash: tx.hash };
    } catch (error: any) {
      console.error('💥 Error creating trade:', error);
      console.error('💥 Error details:', {
        code: error.code,
        reason: error.reason,
        message: error.message,
        data: error.data,
        transaction: error.transaction
      });
      
      const detectedWalletType = this.detectWalletType();
      const walletTypeFromStore = useWalletStore.getState()?.walletType;
      const finalWalletType = walletTypeFromStore || detectedWalletType;
      
      // Provide more helpful error messages
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        throw new Error(`Transaction rejected by user in ${finalWalletType}. Please try again and approve the transaction in your wallet.`);
      } else if (error.code === 'INSUFFICIENT_FUNDS' || error.code === -32000) {
        throw new Error(`Insufficient BNB for gas fees in ${finalWalletType}. Please add more BNB to your wallet for transaction fees.`);
      } else if (error.code === 'UNSUPPORTED_OPERATION') {
        throw new Error(`Operation not supported by ${finalWalletType}. Please try with a different wallet or ensure you have sufficient BNB for gas.`);
      } else if (error.reason) {
        throw new Error(`Smart contract error: ${error.reason}`);
      } else if (error.message?.includes('User rejected') || error.message?.includes('user rejected') || error.message?.includes('user-denied')) {
        throw new Error(`Transaction rejected by user in ${finalWalletType}. Please try again and approve the transaction.`);
      } else if (error.message?.includes('insufficient funds') || error.message?.includes('insufficient balance')) {
        throw new Error(`Insufficient BNB for gas fees in ${finalWalletType}. Please add more BNB to your wallet.`);
      } else if (error.message?.includes('provider not available') || error.message?.includes('provider not ready')) {
        throw new Error(`Wallet provider not available. Please reconnect your wallet via ${finalWalletType}.`);
      } else {
        const errorMsg = error.message || 'Unknown error';
        throw new Error(`Failed to create trade on blockchain using ${finalWalletType}. ${errorMsg}`);
      }
    }
  }

  /**
   * Approve token spending (required before lockFunds for ERC20 tokens)
   * For ERC20, seller must approve: amount + seller's extra fee
   */
  private async approveToken(tokenAddress: string, amount: string): Promise<string> {
    // Get wallet type first to ensure correct provider initialization
    const walletTypeFromStore = useWalletStore.getState()?.walletType;
    
    // Ensure provider and signer are initialized with correct wallet
    if (!this.provider || !this.signer) {
      await this.init();
    }
    
    // Double-check that we have the correct provider for WalletConnect
    if (walletTypeFromStore === 'walletconnect') {
      // Always re-initialize for WalletConnect to ensure we have the latest provider
      console.log('🔄 Ensuring WalletConnect provider is available...');
      await this.init();
      
      // Verify we have the provider
      if (!this.provider) {
        throw new Error('WalletConnect provider not available. Please ensure your wallet is connected via WalletConnect.');
      }
      
      // Verify we have the signer
      if (!this.signer) {
        throw new Error('WalletConnect signer not available. Please ensure your wallet is connected via WalletConnect.');
      }
      
      const signerAddress = await this.signer.getAddress();
      console.log('✅ WalletConnect provider verified, signer address:', signerAddress);
    }

    // Native BNB doesn't need approval
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      console.log('✅ Native BNB - no approval needed');
      return 'NATIVE_BNB';
    }

    try {
      console.log('🔓 Approving ERC20 token spending...');
      console.log('🪙 Token:', tokenAddress);
      console.log('💰 Trade Amount:', amount);
      console.log('👛 Wallet Type:', walletTypeFromStore);

      // ERC20 ABI for approve function
      const erc20ABI = [
        "function approve(address spender, uint256 amount) public returns (bool)",
        "function allowance(address owner, address spender) public view returns (uint256)",
        "function decimals() public view returns (uint8)"
      ];

      const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, this.signer);
      
      // Get token decimals (USDT/USDC on BSC use 18 decimals, but check to be sure)
      let tokenDecimals = 18;
      try {
        tokenDecimals = await tokenContract.decimals();
        console.log('📊 Token decimals:', tokenDecimals);
      } catch (error) {
        console.warn('⚠️ Could not fetch token decimals, assuming 18');
      }

      // Get fee constants from contract
      console.log('📊 Fetching fee structure for approval...');
      let SELLER_EXTRA_BPS: bigint;
      let BPS_DENOM: bigint;
      
      try {
        // Try to get fees from the contract using the signer's provider
        SELLER_EXTRA_BPS = await this.contract!.SELLER_EXTRA_BPS();
        BPS_DENOM = await this.contract!.BPS_DENOM();
        console.log('✅ Got fee structure from contract');
      } catch (contractError: any) {
        console.warn('⚠️ Failed to get fees from contract via signer provider:', contractError);
        console.log('🔄 Trying read-only provider as fallback...');
        
        try {
          // Fallback: Use read-only provider to get fees
          const readOnlyProvider = new ethers.JsonRpcProvider(BSC_MAINNET_RPC);
          const readOnlyContract = new ethers.Contract(
            ZOTRUST_CONTRACT_ADDRESS,
            ZOTRUST_CONTRACT_ABI,
            readOnlyProvider
          );
          
          SELLER_EXTRA_BPS = await readOnlyContract.SELLER_EXTRA_BPS();
          BPS_DENOM = await readOnlyContract.BPS_DENOM();
          console.log('✅ Got fee structure from read-only provider');
        } catch (readOnlyError: any) {
          console.error('❌ Failed to get fees from read-only provider:', readOnlyError);
          console.warn('⚠️ Using default fee values (0% extra fee)');
          // Fallback: Use default values (0% extra fee = just approve the amount)
          // BPS_DENOM is typically 10000 (10000 = 100%)
          BPS_DENOM = 10000n;
          SELLER_EXTRA_BPS = 0n; // No extra fee as fallback
        }
      }

      // Calculate seller's total (amount + extra fee) with correct decimals
      const amountWei = ethers.parseUnits(amount, tokenDecimals);
      const extraFee = (amountWei * SELLER_EXTRA_BPS) / BPS_DENOM;
      const sellerTotal = amountWei + extraFee;

      console.log('💵 Seller Extra Fee (BPS):', SELLER_EXTRA_BPS.toString());
      console.log('💵 Extra Fee Amount:', ethers.formatUnits(extraFee, tokenDecimals));
      console.log('💰 Total to Approve:', ethers.formatUnits(sellerTotal, tokenDecimals));
      
      // Check current allowance
      const signerAddress = await this.signer!.getAddress();
      const currentAllowance = await tokenContract.allowance(signerAddress, ZOTRUST_CONTRACT_ADDRESS);

      console.log('📊 Current allowance:', ethers.formatUnits(currentAllowance, tokenDecimals));
      console.log('📊 Required amount (with fees):', ethers.formatUnits(sellerTotal, tokenDecimals));

      // If already approved enough, skip
      if (currentAllowance >= sellerTotal) {
        console.log('✅ Already approved - skipping approval');
        return 'ALREADY_APPROVED';
      }

      // Verify signer is available before attempting approval
      if (!this.signer) {
        throw new Error('Signer not available. Please reconnect your wallet.');
      }
      
      const signerAddressForApproval = await this.signer.getAddress();
      console.log('👛 Approving with signer address:', signerAddressForApproval);

      // Approve tokens (including seller's extra fee)
      // For Trust Wallet and WalletConnect, use explicit gas settings
      const walletType = this.detectWalletType();
      // walletTypeFromStore is already declared at the top of the function
      const isTrustWallet = walletTypeFromStore === 'trustwallet' || 
                           walletTypeFromStore === 'walletconnect' ||
                           walletType.toLowerCase().includes('trust');
      
      let approveTx;
      if (isTrustWallet) {
        console.log('🔧 Trust Wallet/WalletConnect detected - using explicit gas settings');
        try {
          // Estimate gas first
          console.log('⛽ Estimating gas for approval...');
          const gasEstimate = await tokenContract.approve.estimateGas(
            ZOTRUST_CONTRACT_ADDRESS,
            sellerTotal
          );
          
          // Add 30% buffer for Trust Wallet/WalletConnect (increased from 20%)
          const gasLimit = (gasEstimate * 130n) / 100n;
          
          console.log('⛽ Estimated gas:', gasEstimate.toString());
          console.log('⛽ Gas limit with buffer:', gasLimit.toString());
          
          console.log('📝 Sending approval transaction with explicit gas...');
          approveTx = await tokenContract.approve(
            ZOTRUST_CONTRACT_ADDRESS,
            sellerTotal,
            {
              gasLimit: gasLimit
            }
          );
          console.log('✅ Approval transaction sent with explicit gas');
        } catch (gasError: any) {
          console.warn('⚠️ Gas estimation failed, trying without explicit gas:', gasError);
          console.log('📝 Attempting approval without explicit gas limit...');
          // Fallback: try without explicit gas limit
          try {
            approveTx = await tokenContract.approve(ZOTRUST_CONTRACT_ADDRESS, sellerTotal);
            console.log('✅ Approval transaction sent without explicit gas');
          } catch (fallbackError: any) {
            console.error('❌ Approval failed even without explicit gas:', fallbackError);
            throw fallbackError;
          }
        }
      } else {
        console.log('📝 Sending approval transaction (standard wallet)...');
        approveTx = await tokenContract.approve(ZOTRUST_CONTRACT_ADDRESS, sellerTotal);
        console.log('✅ Approval transaction sent');
      }
      
      console.log('📡 Approval transaction sent:', approveTx.hash);
      console.log('⏳ Waiting for confirmation...');

      const receipt = await approveTx.wait();
      console.log('✅ Token approved!');
      console.log('📦 Block number:', receipt.blockNumber);

      return approveTx.hash;
    } catch (error: any) {
      console.error('💥 Error approving token:', error);
      console.error('💥 Error details:', {
        code: error.code,
        reason: error.reason,
        message: error.message,
        data: error.data
      });
      
      const walletType = this.detectWalletType();
      
      // Provide more helpful error messages
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        throw new Error(`Token approval rejected by user in ${walletType}. Please try again and approve the transaction in your wallet.`);
      } else if (error.code === 'INSUFFICIENT_FUNDS' || error.code === -32000) {
        throw new Error(`Insufficient BNB for gas fees in ${walletType}. Please add more BNB to your wallet for transaction fees.`);
      } else if (error.code === 'UNSUPPORTED_OPERATION') {
        throw new Error(`Token approval not supported by ${walletType}. Please try with a different wallet or ensure you have sufficient BNB for gas.`);
      } else if (error.reason) {
        throw new Error(`Approval failed: ${error.reason}`);
      } else if (error.message?.includes('User rejected') || error.message?.includes('user rejected') || error.message?.includes('user-denied')) {
        throw new Error(`Token approval rejected by user in ${walletType}. Please try again and approve the transaction.`);
      } else if (error.message?.includes('insufficient funds') || error.message?.includes('insufficient balance')) {
        throw new Error(`Insufficient BNB for gas fees in ${walletType}. Please add more BNB to your wallet.`);
      } else if (error.message?.includes('CALL_EXCEPTION') || error.message?.includes('missing revert data')) {
        throw new Error(`Token approval failed in ${walletType}. Please ensure you have sufficient token balance and BNB for gas.`);
      } else {
        const errorMsg = error.message || 'Unknown error';
        throw new Error(`Failed to approve token spending using ${walletType}. ${errorMsg}`);
      }
    }
  }

  /**
   * Create trade and lock funds in one operation (NEW FLOW)
   * This creates the trade first, then immediately locks funds
   * @param orderData - Order details for trade creation
   * @param tokenAddress - Token contract address
   * @param amount - Amount to lock
   * @returns Trade ID and transaction hashes
   */
  async createTradeAndLockFunds(orderData: {
    token: string;
    amount: string;
    buyer: string;
    isNativeBNB?: boolean;
  }, tokenAddress: string, amount: string): Promise<{ tradeId: number; createTradeTxHash: string; lockFundsTxHash: string }> {
    console.log('🔄 NEW FLOW: Creating trade and locking funds together...');
    
    // Step 1: Create trade
    console.log('📝 Step 1: Creating trade...');
    const tradeResult = await this.createTrade(orderData);
    const tradeId = tradeResult.tradeId;
    const createTradeTxHash = tradeResult.txHash;
    
    console.log('✅ Trade created! ID:', tradeId);
    
    // Step 2: Lock funds
    console.log('🔒 Step 2: Locking funds...');
    const lockFundsTxHash = await this.lockFunds(tradeId, tokenAddress, amount);
    
    console.log('✅ Funds locked!');
    
    return {
      tradeId,
      createTradeTxHash,
      lockFundsTxHash
    };
  }

  /**
   * Lock funds for an order (seller calls this after accepting order)
   * @param tradeId - Order ID from database (must match blockchain trade ID)
   * @param tokenAddress - Token contract address
   * @param amount - Amount to lock
   * @returns Transaction hash
   */
  async lockFunds(tradeId: number, tokenAddress: string = '0x0000000000000000000000000000000000000000', amount: string = '0'): Promise<string> {
    if (!this.contract || !this.signer) {
      await this.init();
    }

    try {
      // Step 0: Verify trade exists and check status
      console.log('📝 Step 0: Verifying trade on-chain...');
      console.log('📝 Trade ID:', tradeId);
      
      try {
        const trade = await this.contract!.trades(tradeId);
        const tradeStatus = Number(trade.status);
        const tradeIdFromChain = Number(trade.id);
        
        console.log('✅ Trade found on-chain');
        console.log('📊 Trade Status:', tradeStatus);
        console.log('🆔 Trade ID from chain:', tradeIdFromChain);
        
        // Status: 0=Created, 1=Locked, 2=Released, 3=Cancelled, 4=UNDER_DISPUTE
        if (tradeStatus === 1) {
          throw new Error('Trade already locked - funds are already locked on-chain');
        } else if (tradeStatus === 2) {
          throw new Error('Trade already released - cannot lock funds');
        } else if (tradeStatus === 3) {
          throw new Error('Trade already cancelled - cannot lock funds');
        } else if (tradeStatus !== 0) {
          console.warn('⚠️ Trade is in unexpected status:', tradeStatus);
        }
        
        // Verify trade IDs match
        if (tradeIdFromChain !== tradeId) {
          console.warn(`⚠️ Trade ID mismatch: expected ${tradeId}, got ${tradeIdFromChain}`);
        }
      } catch (verifyError: any) {
        if (verifyError.message?.includes('already locked') || 
            verifyError.message?.includes('already released') ||
            verifyError.message?.includes('already cancelled')) {
          throw verifyError;
        }
        console.warn('⚠️ Could not verify trade on-chain:', verifyError.message);
        // Continue anyway - might be a read error
      }

      // Step 1: Approve token spending (if ERC20)
      console.log('📝 Step 1: Token Approval');
      const approvalTxHash = await this.approveToken(tokenAddress, amount);
      
      if (approvalTxHash !== 'ALREADY_APPROVED' && approvalTxHash !== 'NATIVE_BNB') {
        console.log('✅ Token approval confirmed:', approvalTxHash);
      }

      // Step 2: Lock funds
      console.log('📝 Step 2: Lock Funds');
      console.log('⛓️ Locking funds on blockchain...');
      console.log('📝 Trade ID:', tradeId);
      console.log('💰 Calling lockFunds() function...');

      // Check if signer is connected
      const address = await this.signer!.getAddress();
      console.log('👛 Wallet address:', address);

      // Check if this is native BNB
      const isNativeBNB = tokenAddress === '0x0000000000000000000000000000000000000000';
      
      let tx;
      if (isNativeBNB) {
        // For native BNB, need to send amount + seller's extra fee
        const amountWei = ethers.parseUnits(amount, 18);
        
        // Get fee constants from contract
        console.log('📊 Fetching fee structure from contract...');
        let SELLER_EXTRA_BPS: bigint;
        let BPS_DENOM: bigint;
        
        try {
          // Try to get fees from the contract using the signer's provider
          SELLER_EXTRA_BPS = await this.contract!.SELLER_EXTRA_BPS();
          BPS_DENOM = await this.contract!.BPS_DENOM();
          console.log('✅ Got fee structure from contract');
        } catch (contractError: any) {
          console.warn('⚠️ Failed to get fees from contract via signer provider:', contractError);
          console.log('🔄 Trying read-only provider as fallback...');
          
          try {
            // Fallback: Use read-only provider to get fees
            const readOnlyProvider = new ethers.JsonRpcProvider(BSC_MAINNET_RPC);
            const readOnlyContract = new ethers.Contract(
              ZOTRUST_CONTRACT_ADDRESS,
              ZOTRUST_CONTRACT_ABI,
              readOnlyProvider
            );
            
            SELLER_EXTRA_BPS = await readOnlyContract.SELLER_EXTRA_BPS();
            BPS_DENOM = await readOnlyContract.BPS_DENOM();
            console.log('✅ Got fee structure from read-only provider');
          } catch (readOnlyError: any) {
            console.error('❌ Failed to get fees from read-only provider:', readOnlyError);
            console.warn('⚠️ Using default fee values (0% extra fee)');
            // Fallback: Use default values (0% extra fee = just send the amount)
            // BPS_DENOM is typically 10000 (10000 = 100%)
            BPS_DENOM = 10000n;
            SELLER_EXTRA_BPS = 0n; // No extra fee as fallback
          }
        }
        
        // Calculate seller's total (amount + extra fee)
        // sellerTotal = amount + (amount * SELLER_EXTRA_BPS / BPS_DENOM)
        const extraFee = (amountWei * SELLER_EXTRA_BPS) / BPS_DENOM;
        const sellerTotal = amountWei + extraFee;
        
        console.log('💰 Trade Amount:', ethers.formatEther(amountWei), 'BNB');
        console.log('💵 Seller Extra Fee (BPS):', SELLER_EXTRA_BPS.toString());
        console.log('💵 Extra Fee Amount:', ethers.formatEther(extraFee), 'BNB');
        console.log('💰 Total to Send (sellerTotal):', ethers.formatEther(sellerTotal), 'BNB');
        console.log('🔒 Calling lockFundsNative() for NATIVE BNB');
        
        tx = await this.contract!.lockFundsNative(tradeId, { value: sellerTotal });
      } else {
        // For ERC20 tokens, call lockFunds() (already approved)
        console.log('🔒 Calling lockFunds() for ERC20 token (WBNB/USDT/USDC)');
        tx = await this.contract!.lockFunds(tradeId);
      }
      console.log('📡 Transaction sent:', tx.hash);
      console.log('⏳ Waiting for confirmation...');

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      console.log('✅ Transaction confirmed!');
      console.log('📦 Block number:', receipt.blockNumber);
      console.log('⛽ Gas used:', receipt.gasUsed.toString());
      console.log('🔒 Funds are now LOCKED on blockchain for 2 hours');

      return tx.hash;
    } catch (error: any) {
      console.error('💥 Error locking funds:', error);
      console.error('💥 Error details:', {
        code: error.code,
        reason: error.reason,
        message: error.message,
        data: error.data
      });
      
      const walletType = this.detectWalletType();
      
      // Handle CALL_EXCEPTION (missing revert data)
      if (error.code === 'CALL_EXCEPTION' || error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        let errorMsg = `Contract call failed in ${walletType}. `;
        
        if (error.data) {
          errorMsg += `Error data: ${error.data}`;
        } else {
          errorMsg += `Possible reasons: Trade ID ${tradeId} may not exist on-chain, trade already locked, or insufficient funds. `;
          errorMsg += `Please verify the trade ID matches the blockchain trade ID.`;
        }
        
        throw new Error(errorMsg);
      }
      
      // Parse error message
      if (error.code === 'ACTION_REJECTED') {
        throw new Error(`Transaction rejected by user in ${walletType}`);
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error(`Insufficient balance for transaction in ${walletType}. Please add more funds.`);
      } else if (error.code === 'UNSUPPORTED_OPERATION') {
        throw new Error(`Fund locking not supported by ${walletType}. Please try with a different wallet.`);
      } else if (error.reason) {
        throw new Error(`Smart contract error: ${error.reason}`);
      } else if (error.message?.includes('User rejected')) {
        throw new Error(`Transaction rejected by user in ${walletType}`);
      } else if (error.message?.includes('insufficient funds')) {
        throw new Error(`Insufficient balance for transaction in ${walletType}. Please add more funds.`);
      } else if (error.message?.includes('gas')) {
        throw new Error(`Gas estimation failed in ${walletType}. Please try again or increase gas limit.`);
      } else if (error.message?.includes('already locked') || 
                 error.message?.includes('already released') ||
                 error.message?.includes('already cancelled')) {
        throw error; // Re-throw validation errors as-is
      } else {
        throw new Error(`Failed to lock funds on blockchain using ${walletType}. ${error.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Release funds after payment confirmation (buyer/seller calls this with OTP)
   * @param _tradeId - Order ID from database
   * @returns Transaction hash
   * @deprecated Funds are auto-released when seller confirms via confirmReceived()
   */
  async releaseFunds(_tradeId: number): Promise<string> {
    // NEW CONTRACT: Funds are auto-released when seller calls confirmReceived()
    // This function is kept for backwards compatibility but is no longer used
    throw new Error('Direct release not supported. Seller should use confirmReceived() to release funds.');
  }

  /**
   * Cancel trade and refund seller
   * @param tradeId - Order ID from database
   * @returns Transaction hash
   */
  async cancelTrade(tradeId: number): Promise<string> {
    if (!this.contract || !this.signer) {
      await this.init();
    }

    try {
      console.log('⛓️ Cancelling trade on blockchain...');
      console.log('📝 Trade ID:', tradeId);

      const tx = await this.contract!.cancelTrade(tradeId);
      console.log('📡 Transaction sent:', tx.hash);

      await tx.wait();
      console.log('✅ Trade cancelled, funds refunded');

      return tx.hash;
    } catch (error: any) {
      console.error('💥 Error cancelling trade:', error);
      
      const walletType = this.detectWalletType();
      
      if (error.code === 'ACTION_REJECTED') {
        throw new Error(`Transaction rejected by user in ${walletType}`);
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error(`Insufficient balance for gas fees in ${walletType}`);
      } else if (error.reason) {
        throw new Error(`Smart contract error: ${error.reason}`);
      } else {
        throw new Error(`Failed to cancel trade using ${walletType}`);
      }
    }
  }

  /**
   * Seller redeem after appeal window (48h after lock expiry, no appeal filed)
   */
  async redeemAfterAppealWindow(tradeId: number): Promise<string> {
    if (!this.contract || !this.signer) {
      await this.init();
    }
    
    try {
      console.log('⛓️ Redeem after appeal window...', tradeId);
      const tx = await this.contract!.redeemAfterAppealWindow(tradeId);
      await tx.wait();
      return tx.hash;
    } catch (error: any) {
      console.error('💥 Error redeeming after appeal window:', error);
      
      const walletType = this.detectWalletType();
      
      if (error.code === 'ACTION_REJECTED') {
        throw new Error(`Transaction rejected by user in ${walletType}`);
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error(`Insufficient balance for gas fees in ${walletType}`);
      } else if (error.reason) {
        throw new Error(`Smart contract error: ${error.reason}`);
      } else {
        throw new Error(`Failed to redeem after appeal window using ${walletType}`);
      }
    }
  }

  /**
   * Buyer marks paid (OFF-CHAIN ONLY - NEW CONTRACT)
   * Buyer confirmation is now off-chain only, no blockchain transaction needed
   * This function is kept for backwards compatibility but does nothing
   * @deprecated Buyer no longer needs to confirm on-chain
   */
  async markPaid(_tradeId: number): Promise<string> {
    console.log('ℹ️ Buyer confirmation is now off-chain only. No blockchain transaction needed.');
    console.log('ℹ️ This function is deprecated. Buyer should confirm via frontend/database only.');
    // Return a dummy hash since no transaction is needed
    return 'OFF_CHAIN_CONFIRMATION';
  }

  /**
   * Seller confirms received (on-chain) - NEW CONTRACT FLOW
   * Seller calls this to confirm payment received and release funds to buyer
   * Buyer confirmation is off-chain only, so seller's confirmation immediately releases funds
   */
  async confirmReceived(tradeId: number): Promise<string> {
    if (!this.contract || !this.signer) {
      await this.init();
    }
    
    try {
      console.log('✅ Seller confirming payment received on blockchain...');
      console.log('📝 Trade ID:', tradeId);
      console.log('💡 NEW FLOW: Seller confirmation will release funds immediately to buyer');
      
      const walletType = useWalletStore.getState()?.walletType || this.detectWalletType();
      console.log('👛 Wallet Type:', walletType);
      
      // Verify contract is available
      if (!this.contract) {
        throw new Error('Contract not initialized. Please reconnect your wallet.');
      }
      
      // Try confirmReceived first, fallback to markReceived for backwards compatibility
      let contractFunction: any;
      if (this.contract.confirmReceived) {
        contractFunction = this.contract.confirmReceived;
        console.log('✅ Using confirmReceived() function');
      } else if (this.contract.markReceived) {
        contractFunction = this.contract.markReceived;
        console.log('⚠️ Using markReceived() function (fallback)');
      } else {
        throw new Error('Neither confirmReceived nor markReceived function found in contract');
      }
      
      // For WalletConnect, estimate gas and add buffer
      let tx;
      if (walletType === 'walletconnect') {
        console.log('🔧 WalletConnect detected - estimating gas...');
        try {
          const gasEstimate = await contractFunction.estimateGas(tradeId);
          const gasLimit = (gasEstimate * 130n) / 100n;
          
          console.log('⛽ Estimated gas:', gasEstimate.toString());
          console.log('⛽ Gas limit with buffer:', gasLimit.toString());
          
          tx = await contractFunction(tradeId, { gasLimit: gasLimit });
          console.log('✅ Transaction sent with explicit gas');
        } catch (gasError: any) {
          console.warn('⚠️ Gas estimation failed, trying without explicit gas:', gasError);
          tx = await contractFunction(tradeId);
          console.log('✅ Transaction sent without explicit gas');
        }
      } else {
        tx = await contractFunction(tradeId);
        console.log('✅ Transaction sent');
      }
      
      console.log('📡 Transaction hash:', tx.hash);
      console.log('⏳ Waiting for confirmation...');
      
      const receipt = await tx.wait();
      console.log('✅ Payment confirmed and funds released to buyer!');
      console.log('📦 Block number:', receipt.blockNumber);
      
      return tx.hash;
    } catch (error: any) {
      console.error('💥 Error confirming received:', error);
      console.error('💥 Error details:', {
        code: error.code,
        reason: error.reason,
        message: error.message,
        data: error.data
      });
      
      const detectedWalletType = this.detectWalletType();
      const walletTypeFromStore = useWalletStore.getState()?.walletType;
      const finalWalletType = walletTypeFromStore || detectedWalletType;
      
      // Provide more helpful error messages
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        throw new Error(`Payment confirmation cancelled. You can try again later. The transaction was rejected in ${finalWalletType}.`);
      } else if (error.code === 'INSUFFICIENT_FUNDS' || error.code === -32000) {
        throw new Error(`Insufficient BNB for gas fees in ${finalWalletType}. Please add more BNB to your wallet for transaction fees.`);
      } else if (error.reason) {
        throw new Error(`Smart contract error: ${error.reason}`);
      } else if (error.message?.includes('User rejected') || error.message?.includes('user rejected') || error.message?.includes('user-denied')) {
        throw new Error(`Payment confirmation cancelled. You can try again later.`);
      } else {
        const errorMsg = error.message || 'Unknown error';
        throw new Error(`Failed to confirm payment on blockchain using ${finalWalletType}. ${errorMsg}`);
      }
    }
  }

  /**
   * @deprecated Use confirmReceived() instead
   * Kept for backwards compatibility - redirects to confirmReceived
   */
  async markReceived(tradeId: number): Promise<string> {
    return this.confirmReceived(tradeId);
  }

  /**
   * Get trade details from blockchain
   * @param tradeId - Trade ID on blockchain
   * @returns Trade details
   */
  async getTradeDetails(tradeId: number) {
    if (!this.contract) {
      await this.init();
    }

    try {
      // Try to call trades function - it returns a struct
      // In ethers v6, structs are returned as arrays
      const trade = await this.contract!.trades(tradeId);
      
      console.log('📦 Raw trade data from contract:', trade);
      
      // Map status number to status name (matches P2PEscrowV2 contract enum)
      const statusMap: { [key: number]: string } = {
        0: 'CREATED',              // Trade created, not locked yet
        1: 'LOCKED',               // Funds locked, waiting for payment confirmation
        2: 'APPEAL_WINDOW_OPEN',   // Appeal window is open (2-48 hours after lock)
        3: 'UNDER_DISPUTE',        // Appeal filed, trade in dispute
        4: 'RELEASED',             // Funds released to buyer
        5: 'REFUNDED',             // Funds refunded to seller
        6: 'COMPLETED'             // Trade completed (final state)
      };
      
      // Handle both array and object responses
      // The contract returns a Proxy object with numeric indices (0-10)
      // Actual fields: id, seller, buyer, token, amount, status, lockedAt, appealStartAt, buyerPaid, sellerReceived, appealFiled
      // Note: isNativeLocked is NOT returned by the contract, we derive it from token address
      let tradeData: any;
      
      // Check if it's a Proxy or array-like object
      if (typeof trade === 'object' && trade !== null) {
        // Handle Proxy/array-like object with numeric indices
        tradeData = {
          id: trade[0] ?? trade.id,
          seller: trade[1] ?? trade.seller,
          buyer: trade[2] ?? trade.buyer,
          token: trade[3] ?? trade.token,
          amount: trade[4] ?? trade.amount,
          status: trade[5] ?? trade.status,
          lockedAt: trade[6] ?? trade.lockedAt,
          appealStartAt: trade[7] ?? trade.appealStartAt,
          buyerPaid: trade[8] ?? trade.buyerPaid ?? false,
          sellerReceived: trade[9] ?? trade.sellerReceived ?? false,
          appealFiled: trade[10] ?? trade.appealFiled ?? false
        };
        
        // Derive isNativeLocked from token address (native = address(0))
        const tokenAddress = String(tradeData.token || '0x0').toLowerCase();
        tradeData.isNativeLocked = tokenAddress === '0x0000000000000000000000000000000000000000' || 
                                   tokenAddress === '0x0';
      } else {
        // Fallback: use as-is
        tradeData = trade;
        tradeData.isNativeLocked = false;
      }
      
      const statusNumber = Number(tradeData.status);
      const statusName = statusMap[statusNumber] || `UNKNOWN(${statusNumber})`;
      
      // Get token decimals dynamically
      let tokenDecimals = 18; // Default
      try {
        if (tradeData.token && tradeData.token !== '0x0000000000000000000000000000000000000000') {
          const tokenContract = new ethers.Contract(
            tradeData.token,
            ['function decimals() view returns (uint8)'],
            this.provider!
          );
          tokenDecimals = await tokenContract.decimals();
        }
      } catch (decimalsError) {
        console.warn('⚠️ Could not fetch token decimals, using default 18:', decimalsError);
      }
      
      return {
        id: Number(tradeData.id),
        seller: tradeData.seller,
        buyer: tradeData.buyer,
        token: tradeData.token,
        amount: ethers.formatUnits(tradeData.amount, tokenDecimals),
        status: statusNumber,
        statusName: statusName,
        lockedAt: tradeData.lockedAt && Number(tradeData.lockedAt) > 0 ? Number(tradeData.lockedAt) : null,
        appealStartAt: tradeData.appealStartAt && Number(tradeData.appealStartAt) > 0 ? Number(tradeData.appealStartAt) : null,
        buyerPaid: tradeData.buyerPaid || false,
        sellerReceived: tradeData.sellerReceived || false,
        appealFiled: tradeData.appealFiled || false,
        isNativeLocked: tradeData.isNativeLocked || false
      };
    } catch (error: any) {
      console.error('Error fetching trade details:', error);
      
      // If ABI decoding fails, try manual decoding
      if (error.code === 'BAD_DATA' && error.data) {
        console.log('🔄 Attempting manual decoding of trade data...');
        try {
          return await this.getTradeDetailsManual(tradeId);
        } catch (manualError) {
          console.error('Manual decoding also failed:', manualError);
          throw error; // Throw original error
        }
      }
      
      throw error;
    }
  }

  /**
   * Manual decoding of trade data when ABI fails
   * @param tradeId - Trade ID on blockchain
   * @returns Trade details
   */
  private async getTradeDetailsManual(tradeId: number) {
    if (!this.provider) {
      await this.init();
    }

    try {
      // Call the contract function directly using call
      const contractAddress = ZOTRUST_CONTRACT_ADDRESS;
      const iface = new ethers.Interface(ZOTRUST_CONTRACT_ABI);
      const data = iface.encodeFunctionData('trades', [tradeId]);
      
      const result = await this.provider!.call({
        to: contractAddress,
        data: data
      });
      
      // Decode the result manually
      const decoded = iface.decodeFunctionResult('trades', result);
      
      // Map status number to status name (matches P2PEscrowV2 contract enum)
      const statusMap: { [key: number]: string } = {
        0: 'CREATED',              // Trade created, not locked yet
        1: 'LOCKED',               // Funds locked, waiting for payment confirmation
        2: 'APPEAL_WINDOW_OPEN',   // Appeal window is open (2-48 hours after lock)
        3: 'UNDER_DISPUTE',        // Appeal filed, trade in dispute
        4: 'RELEASED',             // Funds released to buyer
        5: 'REFUNDED',             // Funds refunded to seller
        6: 'COMPLETED'             // Trade completed (final state)
      };
      
      const statusNumber = Number(decoded[5]); // status is 6th field (index 5)
      const statusName = statusMap[statusNumber] || `UNKNOWN(${statusNumber})`;
      
      // Get token decimals
      let tokenDecimals = 18;
      const tokenAddress = decoded[3];
      const isNative = !tokenAddress || 
                      tokenAddress === '0x0000000000000000000000000000000000000000' ||
                      String(tokenAddress).toLowerCase() === '0x0';
      
      try {
        if (!isNative) {
          const tokenContract = new ethers.Contract(
            tokenAddress,
            ['function decimals() view returns (uint8)'],
            this.provider!
          );
          tokenDecimals = await tokenContract.decimals();
        }
      } catch (decimalsError) {
        console.warn('⚠️ Could not fetch token decimals:', decimalsError);
      }
      
      return {
        id: Number(decoded[0]),
        seller: decoded[1],
        buyer: decoded[2],
        token: decoded[3],
        amount: ethers.formatUnits(decoded[4], tokenDecimals),
        status: statusNumber,
        statusName: statusName,
        lockedAt: decoded[6] && Number(decoded[6]) > 0 ? Number(decoded[6]) : null,
        appealStartAt: decoded[7] && Number(decoded[7]) > 0 ? Number(decoded[7]) : null,
        buyerPaid: decoded[8] || false,
        sellerReceived: decoded[9] || false,
        appealFiled: decoded[10] || false,
        isNativeLocked: isNative // Derived from token address, not from contract return
      };
    } catch (error) {
      console.error('Error in manual decoding:', error);
      throw error;
    }
  }

  /**
   * Verify trade status on blockchain and compare with database
   * @param tradeId - Trade ID on blockchain
   * @returns Verification result with status comparison
   */
  async verifyTradeStatus(tradeId: number): Promise<{
    tradeId: number;
    blockchainStatus: number;
    blockchainStatusName: string;
    isReleased: boolean;
    seller: string;
    buyer: string;
    amount: string;
    token: string;
    buyerPaid: boolean;
    sellerReceived: boolean;
    details: any;
  }> {
    try {
      console.log('🔍 Verifying trade status on blockchain...');
      console.log('📝 Trade ID:', tradeId);
      
      const tradeDetails = await this.getTradeDetails(tradeId);
      
      // Check if funds are released (status 4 = RELEASED or status 6 = COMPLETED)
      const isReleased = tradeDetails.status === 4 || tradeDetails.status === 6; // 4 = RELEASED, 6 = COMPLETED
      
      console.log('📊 Trade Status on Blockchain:', {
        status: tradeDetails.status,
        statusName: tradeDetails.statusName,
        isReleased: isReleased,
        buyerPaid: tradeDetails.buyerPaid,
        sellerReceived: tradeDetails.sellerReceived
      });
      
      return {
        tradeId,
        blockchainStatus: tradeDetails.status,
        blockchainStatusName: tradeDetails.statusName,
        isReleased,
        seller: tradeDetails.seller,
        buyer: tradeDetails.buyer,
        amount: tradeDetails.amount,
        token: tradeDetails.token,
        buyerPaid: tradeDetails.buyerPaid,
        sellerReceived: tradeDetails.sellerReceived,
        details: tradeDetails
      };
    } catch (error: any) {
      console.error('💥 Error verifying trade status:', error);
      throw new Error(`Failed to verify trade status: ${error.message}`);
    }
  }

  /**
   * Get current network details
   */
  async getNetwork() {
    if (!this.provider) {
      await this.init();
    }

    const network = await this.provider!.getNetwork();
    return {
      name: network.name,
      chainId: Number(network.chainId)
    };
  }

  /**
   * Check if wallet is connected to correct network (BSC Mainnet)
   */
  async checkNetwork(): Promise<boolean> {
    const network = await this.getNetwork();
    const expectedChainId = 56; // BSC Mainnet
    
    if (network.chainId !== expectedChainId) {
      console.warn(`⚠️ Wrong network! Expected: ${expectedChainId}, Got: ${network.chainId}`);
      return false;
    }
    
    return true;
  }

  /**
   * Switch to BSC Mainnet
   */
  async switchToBSCMainnet() {
    if (!window.ethereum) {
      throw new Error('Wallet not found');
    }

    try {
      await (window.ethereum as any).request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x38' }], // 56 in hex
      });
    } catch (switchError: any) {
      // Chain not added, try adding it
      if (switchError.code === 4902) {
        await (window.ethereum as any).request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x38',
            chainName: 'BSC Mainnet',
            nativeCurrency: {
              name: 'BNB',
              symbol: 'BNB',
              decimals: 18
            },
            rpcUrls: ['https://bsc-dataseed.binance.org/'],
            blockExplorerUrls: ['https://bscscan.com']
          }],
        });
      } else {
        throw switchError;
      }
    }
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();

