import { ethers } from 'ethers';
import { ZOTRUST_CONTRACT_ABI, ZOTRUST_CONTRACT_ADDRESS } from '../config/contracts';

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
   */
  async init() {
    if (!window.ethereum) {
      throw new Error('Please install MetaMask, Trust Wallet, or another Web3 wallet');
    }

    try {
      // Request wallet connection
      await (window.ethereum as any).request({ method: 'eth_requestAccounts' });
      
      // Create provider and signer
      this.provider = new ethers.BrowserProvider(window.ethereum as any);
      this.signer = await this.provider.getSigner();
      
      // Initialize contract with signer (for write operations)
      this.contract = new ethers.Contract(
        ZOTRUST_CONTRACT_ADDRESS,
        ZOTRUST_CONTRACT_ABI,
        this.signer
      );

      console.log('✅ Blockchain service initialized');
      console.log('📋 Contract:', ZOTRUST_CONTRACT_ADDRESS);
      console.log('👛 Wallet:', await this.signer.getAddress());
      
      // Detect wallet type for better error messages
      const walletType = this.detectWalletType();
      console.log('🔍 Detected wallet type:', walletType);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', error);
      throw error;
    }
  }

  /**
   * Detect the type of wallet being used
   */
  private detectWalletType(): string {
    if (!window.ethereum) return 'unknown';
    
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
    if (!this.contract || !this.signer) {
      await this.init();
    }

    try {
      console.log('⛓️ Creating trade on blockchain (P2PEscrowV2)...');
      console.log('🪙 Token:', orderData.token);
      console.log('💰 Amount:', orderData.amount);
      console.log('👤 Buyer:', orderData.buyer);
      console.log('🔍 Is Native BNB?', orderData.isNativeBNB);

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

      // Call createTrade function - NEW P2PEscrowV2 signature: createTrade(token, amount, buyer)
      const tx = await this.contract!.createTrade(
        orderData.token,
        amountWei,
        orderData.buyer
      );
      
      console.log('📡 Transaction sent:', tx.hash);
      console.log('⏳ Waiting for confirmation...');

      const receipt = await tx.wait();
      console.log('✅ Trade created on blockchain!');
      console.log('📦 Block number:', receipt.blockNumber);

      // Parse trade ID from events
      // Find TradeCreated event
      const tradeCreatedEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = this.contract!.interface.parseLog(log);
          return parsed?.name === 'TradeCreated';
        } catch {
          return false;
        }
      });

      let tradeId = 0;
      if (tradeCreatedEvent) {
        const parsed = this.contract!.interface.parseLog(tradeCreatedEvent);
        tradeId = Number(parsed?.args?.tradeId || 0);
        console.log('✅ Trade ID from blockchain:', tradeId);
      }

      return { tradeId, txHash: tx.hash };
    } catch (error: any) {
      console.error('💥 Error creating trade:', error);
      
      const walletType = this.detectWalletType();
      
      if (error.code === 'ACTION_REJECTED') {
        throw new Error(`Transaction rejected by user in ${walletType}`);
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error(`Insufficient balance in ${walletType}. Please add more funds.`);
      } else if (error.code === 'UNSUPPORTED_OPERATION') {
        throw new Error(`Operation not supported by ${walletType}. Please try with a different wallet.`);
      } else if (error.reason) {
        throw new Error(`Smart contract error: ${error.reason}`);
      } else if (error.message?.includes('User rejected')) {
        throw new Error(`Transaction rejected by user in ${walletType}`);
      } else if (error.message?.includes('insufficient funds')) {
        throw new Error(`Insufficient balance in ${walletType}. Please add more funds.`);
      } else {
        throw new Error(`Failed to create trade on blockchain using ${walletType}`);
      }
    }
  }

  /**
   * Approve token spending (required before lockFunds for ERC20 tokens)
   * For ERC20, seller must approve: amount + seller's extra fee
   */
  private async approveToken(tokenAddress: string, amount: string): Promise<string> {
    if (!this.provider || !this.signer) {
      await this.init();
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

      // Get fee constants from contract
      console.log('📊 Fetching fee structure for approval...');
      const SELLER_EXTRA_BPS = await this.contract!.SELLER_EXTRA_BPS();
      const BPS_DENOM = await this.contract!.BPS_DENOM();

      // Calculate seller's total (amount + extra fee)
      const amountWei = ethers.parseUnits(amount, 18);
      const extraFee = (amountWei * SELLER_EXTRA_BPS) / BPS_DENOM;
      const sellerTotal = amountWei + extraFee;

      console.log('💵 Seller Extra Fee (BPS):', SELLER_EXTRA_BPS.toString());
      console.log('💵 Extra Fee Amount:', ethers.formatEther(extraFee));
      console.log('💰 Total to Approve:', ethers.formatEther(sellerTotal));

      // ERC20 ABI for approve function
      const erc20ABI = [
        "function approve(address spender, uint256 amount) public returns (bool)",
        "function allowance(address owner, address spender) public view returns (uint256)"
      ];

      const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, this.signer);
      
      // Check current allowance
      const signerAddress = await this.signer!.getAddress();
      const currentAllowance = await tokenContract.allowance(signerAddress, ZOTRUST_CONTRACT_ADDRESS);

      console.log('📊 Current allowance:', ethers.formatUnits(currentAllowance, 18));
      console.log('📊 Required amount (with fees):', ethers.formatEther(sellerTotal));

      // If already approved enough, skip
      if (currentAllowance >= sellerTotal) {
        console.log('✅ Already approved - skipping approval');
        return 'ALREADY_APPROVED';
      }

      // Approve tokens (including seller's extra fee)
      const approveTx = await tokenContract.approve(ZOTRUST_CONTRACT_ADDRESS, sellerTotal);
      console.log('📡 Approval transaction sent:', approveTx.hash);
      console.log('⏳ Waiting for confirmation...');

      const receipt = await approveTx.wait();
      console.log('✅ Token approved!');
      console.log('📦 Block number:', receipt.blockNumber);

      return approveTx.hash;
    } catch (error: any) {
      console.error('💥 Error approving token:', error);
      
      const walletType = this.detectWalletType();
      
      if (error.code === 'ACTION_REJECTED') {
        throw new Error(`Token approval rejected by user in ${walletType}`);
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error(`Insufficient balance for gas fees in ${walletType}`);
      } else if (error.code === 'UNSUPPORTED_OPERATION') {
        throw new Error(`Token approval not supported by ${walletType}. Please try with a different wallet.`);
      } else if (error.reason) {
        throw new Error(`Approval failed: ${error.reason}`);
      } else if (error.message?.includes('User rejected')) {
        throw new Error(`Token approval rejected by user in ${walletType}`);
      } else if (error.message?.includes('insufficient funds')) {
        throw new Error(`Insufficient balance for gas fees in ${walletType}`);
      } else {
        throw new Error(`Failed to approve token spending using ${walletType}`);
      }
    }
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
        const SELLER_EXTRA_BPS = await this.contract!.SELLER_EXTRA_BPS();
        const BPS_DENOM = await this.contract!.BPS_DENOM();
        
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
   * @param tradeId - Order ID from database
   * @returns Transaction hash
   */
  async releaseFunds(tradeId: number): Promise<string> {
    // Contract auto-releases inside _releaseFunds when both parties confirm on-chain.
    // Keep this method to avoid breaking imports, but make it explicit.
    throw new Error('Direct release not supported; use markPaid/markReceived to trigger auto-release.');
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
   * Buyer marks paid (on-chain) - triggers auto-release when seller also confirms
   */
  async markPaid(tradeId: number): Promise<string> {
    if (!this.contract || !this.signer) {
      await this.init();
    }
    
    try {
      const tx = await this.contract!.markPaid(tradeId);
      await tx.wait();
      return tx.hash;
    } catch (error: any) {
      console.error('💥 Error marking paid:', error);
      
      const walletType = this.detectWalletType();
      
      if (error.code === 'ACTION_REJECTED') {
        throw new Error(`Transaction rejected by user in ${walletType}`);
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error(`Insufficient balance for gas fees in ${walletType}`);
      } else if (error.reason) {
        throw new Error(`Smart contract error: ${error.reason}`);
      } else {
        throw new Error(`Failed to mark paid using ${walletType}`);
      }
    }
  }

  /**
   * Seller marks received (on-chain) - triggers auto-release when buyer also confirmed
   */
  async markReceived(tradeId: number): Promise<string> {
    if (!this.contract || !this.signer) {
      await this.init();
    }
    
    try {
      const tx = await this.contract!.markReceived(tradeId);
      await tx.wait();
      return tx.hash;
    } catch (error: any) {
      console.error('💥 Error marking received:', error);
      
      const walletType = this.detectWalletType();
      
      if (error.code === 'ACTION_REJECTED') {
        throw new Error(`Transaction rejected by user in ${walletType}`);
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error(`Insufficient balance for gas fees in ${walletType}`);
      } else if (error.reason) {
        throw new Error(`Smart contract error: ${error.reason}`);
      } else {
        throw new Error(`Failed to mark received using ${walletType}`);
      }
    }
  }

  /**
   * Get trade details from blockchain
   * @param tradeId - Order ID
   * @returns Trade details
   */
  async getTradeDetails(tradeId: number) {
    if (!this.contract) {
      await this.init();
    }

    try {
      const trade = await this.contract!.trades(tradeId);
      
      return {
        id: Number(trade.id),
        adPoster: trade.adPoster,
        counterParty: trade.counterParty,
        seller: trade.seller,
        buyer: trade.buyer,
        token: trade.token,
        amount: ethers.formatUnits(trade.amount, 18), // Assuming 18 decimals
        adType: Number(trade.adType),
        status: Number(trade.status),
        expiryTime: new Date(Number(trade.expiryTime) * 1000).toISOString()
      };
    } catch (error) {
      console.error('Error fetching trade details:', error);
      throw error;
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
   * Check if wallet is connected to correct network (BSC Testnet)
   */
  async checkNetwork(): Promise<boolean> {
    const network = await this.getNetwork();
    const expectedChainId = 97; // BSC Testnet
    
    if (network.chainId !== expectedChainId) {
      console.warn(`⚠️ Wrong network! Expected: ${expectedChainId}, Got: ${network.chainId}`);
      return false;
    }
    
    return true;
  }

  /**
   * Switch to BSC Testnet
   */
  async switchToBSCTestnet() {
    if (!window.ethereum) {
      throw new Error('Wallet not found');
    }

    try {
      await (window.ethereum as any).request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x61' }], // 97 in hex
      });
    } catch (switchError: any) {
      // Chain not added, try adding it
      if (switchError.code === 4902) {
        await (window.ethereum as any).request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x61',
            chainName: 'BSC Testnet',
            nativeCurrency: {
              name: 'BNB',
              symbol: 'BNB',
              decimals: 18
            },
            rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
            blockExplorerUrls: ['https://testnet.bscscan.com']
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

