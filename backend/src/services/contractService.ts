
import { ethers } from 'ethers';
import pool from '../config/database';

export class ContractService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private relayerWallet: ethers.Wallet;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(
      process.env.BSC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/'
    );
    
    // Only create wallet if private key is provided and valid
    const privateKey = process.env.RELAYER_PRIVATE_KEY;
    if (privateKey && privateKey !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      try {
        this.relayerWallet = new ethers.Wallet(privateKey, this.provider);
      } catch (error) {
        console.warn('Invalid private key provided, ContractService will run in read-only mode');
        this.relayerWallet = null as any;
      }
    } else {
      console.warn('No private key provided, ContractService will run in read-only mode');
      this.relayerWallet = null as any;
    }

    // Real deployed contract ABI (from 0x6722FE6DdCe1F7389daa70aD5C65e51f9F375E6e)
    const contractABI = [{"inputs":[{"internalType":"address","name":"_admin","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"oldAdmin","type":"address"},{"indexed":false,"internalType":"address","name":"newAdmin","type":"address"}],"name":"AdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tradeId","type":"uint256"},{"indexed":true,"internalType":"address","name":"receiver","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"AdminDecision","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tradeId","type":"uint256"},{"indexed":true,"internalType":"address","name":"by","type":"address"},{"indexed":false,"internalType":"string","name":"evidenceCid","type":"string"}],"name":"AppealFiled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tradeId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"appealStartAt","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"appealDeadline","type":"uint256"}],"name":"AppealWindowOpened","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tradeId","type":"uint256"},{"indexed":true,"internalType":"address","name":"locker","type":"address"},{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"uint256","name":"totalLocked","type":"uint256"},{"indexed":false,"internalType":"bool","name":"isNative","type":"bool"}],"name":"FundsLocked","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bool","name":"allowed","type":"bool"}],"name":"NativeAllowed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tradeId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Redeemed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tradeId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"}],"name":"SellerConfirmed","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"bool","name":"allowed","type":"bool"}],"name":"TokenAllowed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tradeId","type":"uint256"}],"name":"TradeCompleted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"tradeId","type":"uint256"},{"indexed":true,"internalType":"address","name":"seller","type":"address"},{"indexed":true,"internalType":"address","name":"buyer","type":"address"},{"indexed":false,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TradeCreated","type":"event"},{"stateMutability":"payable","type":"fallback"},{"inputs":[],"name":"APPEAL_DEADLINE_WINDOW","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"APPEAL_OPEN_DELAY","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"BPS_DENOM","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"BUYER_FEE_BPS","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"SELLER_EXTRA_BPS","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"TOTAL_ADMIN_BPS","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"admin","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tradeId","type":"uint256"},{"internalType":"bool","name":"releaseToBuyer","type":"bool"}],"name":"adminDecision","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"allowedNative","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"allowedTokens","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tradeId","type":"uint256"}],"name":"confirmReceived","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_token","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"},{"internalType":"address","name":"_buyer","type":"address"}],"name":"createTrade","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"evidenceCIDs","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tradeId","type":"uint256"},{"internalType":"string","name":"_evidenceCid","type":"string"}],"name":"fileAppeal","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tradeId","type":"uint256"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getEvidenceAt","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tradeId","type":"uint256"}],"name":"getEvidenceCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tradeId","type":"uint256"}],"name":"lockFunds","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tradeId","type":"uint256"}],"name":"lockFundsNative","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tradeId","type":"uint256"}],"name":"openAppealWindow","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_token","type":"address"},{"internalType":"uint256","name":"_amount","type":"uint256"},{"internalType":"address","name":"_to","type":"address"}],"name":"recoverTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_tradeId","type":"uint256"}],"name":"redeemAfterAppealWindow","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_newAdmin","type":"address"}],"name":"setAdmin","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bool","name":"_allowed","type":"bool"}],"name":"setAllowedNative","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_token","type":"address"},{"internalType":"bool","name":"_allowed","type":"bool"}],"name":"setAllowedToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"tradeCounter","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"trades","outputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"address","name":"seller","type":"address"},{"internalType":"address","name":"buyer","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"enum P2PEscrowV2.Status","name":"status","type":"uint8"},{"internalType":"uint256","name":"lockedAt","type":"uint256"},{"internalType":"uint256","name":"appealStartAt","type":"uint256"},{"internalType":"bool","name":"sellerConfirmed","type":"bool"},{"internalType":"bool","name":"appealFiled","type":"bool"},{"internalType":"bool","name":"isNativeLocked","type":"bool"}],"stateMutability":"view","type":"function"},{"stateMutability":"payable","type":"receive"}];
    // Use deployed contract address (can be overridden with .env)
    const contractAddress = process.env.CONTRACT_ADDRESS || '0x6722FE6DdCe1F7389daa70aD5C65e51f9F375E6e';

    if (contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000') {
      this.contract = new ethers.Contract(
        contractAddress,
        contractABI,
        this.relayerWallet || this.provider
      );
      console.log('✅ ContractService: Initialized with contract:', contractAddress);
      if (this.relayerWallet) {
        console.log('✅ ContractService: Relayer wallet configured');
      } else {
        console.warn('⚠️ ContractService: No relayer wallet - read-only mode');
        console.warn('⚠️ ContractService: Set RELAYER_PRIVATE_KEY in .env to enable fund locking');
      }
    } else {
      console.warn('No contract address provided, ContractService will run in read-only mode');
      this.contract = null as any;
    }
  }

  async createAdOnChain(params: {
    ownerAgentId: number;
    isBuy: boolean;
    token: string;
    priceInUSDT: string;
    minAmount: string;
    maxAmount: string;
    lockDurationSeconds: number;
    city: string;
  }): Promise<{ txHash: string; adId: number }> {
    if (!this.contract) {
      throw new Error('Contract not available - running in read-only mode');
    }
    
    try {
      const tx = await this.contract.createAd(
        params.ownerAgentId,
        params.isBuy,
        params.token,
        ethers.parseUnits(params.priceInUSDT, 18),
        ethers.parseUnits(params.minAmount, 6), // USDT/USDC have 6 decimals
        ethers.parseUnits(params.maxAmount, 6),
        params.lockDurationSeconds,
        params.city
      );

      const receipt = await tx.wait();
      
      // Extract adId from event logs
      const adCreatedEvent = receipt.logs.find((log: any) => 
        log.topics[0] === ethers.id("AdCreated(uint256,address)")
      );
      
      const adId = parseInt(adCreatedEvent?.topics[1] || '0', 16);

      return { txHash: tx.hash, adId };
    } catch (error) {
      console.error('Error creating ad on chain:', error);
      throw error;
    }
  }

  async placeOrderOnChain(adId: number, amount: string): Promise<{ txHash: string; orderId: number }> {
    if (!this.contract) {
      throw new Error('Contract not available - running in read-only mode');
    }
    
    try {
      const tx = await this.contract.placeOrder(
        adId,
        ethers.parseUnits(amount, 6)
      );

      const receipt = await tx.wait();
      
      // Extract orderId from event logs
      const orderCreatedEvent = receipt.logs.find((log: any) => 
        log.topics[0] === ethers.id("OrderCreated(uint256,uint256,address,address,uint256)")
      );
      
      const orderId = parseInt(orderCreatedEvent?.topics[1] || '0', 16);

      return { txHash: tx.hash, orderId };
    } catch (error) {
      console.error('Error placing order on chain:', error);
      throw error;
    }
  }

  async acceptOrderAndLockFunds(orderId: number, otpHash: string): Promise<string> {
    if (!this.contract || !this.relayerWallet) {
      console.error('❌ ContractService: Cannot lock funds - contract or wallet not configured');
      console.log('💡 CONTRACT_ADDRESS:', process.env.CONTRACT_ADDRESS);
      console.log('💡 RELAYER_PRIVATE_KEY:', process.env.RELAYER_PRIVATE_KEY ? 'Set' : 'Missing');
      throw new Error('Contract or relayer wallet not configured. Please check .env file.');
    }

    try {
      console.log('⛓️ ContractService: Locking funds on blockchain');
      console.log('📝 ContractService: Trade ID (Order ID):', orderId);
      console.log('🔐 ContractService: OTP Hash (off-chain):', otpHash);
      console.log('💰 ContractService: Calling lockFunds() - This will LOCK seller\'s tokens');
      console.log('👛 ContractService: Relayer wallet:', await this.relayerWallet.getAddress());

      // Call lockFunds on the smart contract (seller's funds will be locked)
      const tx = await this.contract.lockFunds(orderId);
      console.log('📡 ContractService: Transaction sent:', tx.hash);
      console.log('⏳ ContractService: Waiting for blockchain confirmation...');

      const receipt = await tx.wait();
      console.log('✅ ContractService: Transaction confirmed!');
      console.log('📦 ContractService: Block number:', receipt.blockNumber);
      console.log('⛽ ContractService: Gas used:', receipt.gasUsed.toString());
      console.log('🔒 ContractService: Funds are now LOCKED on blockchain at address:', process.env.CONTRACT_ADDRESS);

      // Parse events to confirm lock
      receipt.logs.forEach((log: any, index: number) => {
        console.log(`📄 ContractService: Event ${index + 1}:`, log.topics[0]);
      });

      return tx.hash;
    } catch (error: any) {
      console.error('💥 ContractService: Error locking funds on blockchain:', error);
      console.error('💥 ContractService: Error message:', error.message);
      if (error.reason) {
        console.error('💥 ContractService: Revert reason:', error.reason);
      }
      throw error;
    }
  }

  async releaseFundsOnChain(orderId: number): Promise<string> {
    if (!this.contract || !this.relayerWallet) {
      console.error('❌ ContractService: Cannot release funds - contract or wallet not configured');
      throw new Error('Contract or relayer wallet not configured. Please check .env file.');
    }
    
    try {
      console.log('⛓️ ContractService: Releasing funds from blockchain');
      console.log('📝 ContractService: Trade ID (Order ID):', orderId);
      console.log('💰 ContractService: Calling releaseFunds() - This will RELEASE funds to buyer');
      console.log('👛 ContractService: Relayer wallet:', await this.relayerWallet.getAddress());

      const tx = await this.contract.releaseFunds(orderId);
      console.log('📡 ContractService: Transaction sent:', tx.hash);
      console.log('⏳ ContractService: Waiting for blockchain confirmation...');

      const receipt = await tx.wait();
      console.log('✅ ContractService: Transaction confirmed!');
      console.log('📦 ContractService: Block number:', receipt.blockNumber);
      console.log('⛽ ContractService: Gas used:', receipt.gasUsed.toString());
      console.log('💸 ContractService: Funds RELEASED to buyer');
      
      // Update order state in database
      await pool.query(
        'UPDATE orders SET state = $1, tx_hash = $2 WHERE id = $3',
        ['RELEASED', tx.hash, orderId]
      );

      return tx.hash;
    } catch (error: any) {
      console.error('💥 ContractService: Error releasing funds:', error);
      console.error('💥 ContractService: Error message:', error.message);
      if (error.reason) {
        console.error('💥 ContractService: Revert reason:', error.reason);
      }
      throw error;
    }
  }

  async markPaidOnChain(tradeId: number): Promise<string> {
    if (!this.contract || !this.relayerWallet) {
      throw new Error('Contract or relayer wallet not configured. Please check .env file.');
    }
    try {
      const tx = await this.contract.markPaid(tradeId);
      const receipt = await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error('Error calling markPaid:', error);
      throw error;
    }
  }

  async markReceivedOnChain(tradeId: number): Promise<string> {
    if (!this.contract || !this.relayerWallet) {
      throw new Error('Contract or relayer wallet not configured. Please check .env file.');
    }
    try {
      const tx = await this.contract.markReceived(tradeId);
      const receipt = await tx.wait();
      return tx.hash;
    } catch (error) {
      console.error('Error calling markReceived:', error);
      throw error;
    }
  }

  async refundOnChain(orderId: number): Promise<string> {
    if (!this.contract || !this.relayerWallet) {
      console.error('❌ ContractService: Cannot refund trade - contract or wallet not configured');
      throw new Error('Contract or relayer wallet not configured. Please check .env file.');
    }

    try {
      console.log('⛓️ ContractService: Refunding trade on blockchain');
      console.log('📝 ContractService: Trade ID (Order ID):', orderId);
      console.log('🔙 ContractService: Calling redeemAfterAppealWindow() - This will REFUND seller');

      const tx = await this.contract.redeemAfterAppealWindow(orderId);
      console.log('📡 ContractService: Transaction sent:', tx.hash);
      console.log('⏳ ContractService: Waiting for blockchain confirmation...');

      const receipt = await tx.wait();
      console.log('✅ ContractService: Transaction confirmed, block:', receipt.blockNumber);
      console.log('⛽ ContractService: Gas used:', receipt.gasUsed.toString());
      console.log('🔙 ContractService: Trade refunded to seller');
      
      // Update order state in database
      await pool.query(
        'UPDATE orders SET state = $1, tx_hash = $2 WHERE id = $3',
        ['REFUNDED', tx.hash, orderId]
      );

      return tx.hash;
    } catch (error: any) {
      console.error('💥 ContractService: Error refunding trade:', error);
      console.error('💥 ContractService: Error message:', error.message);
      if (error.reason) {
        console.error('💥 ContractService: Revert reason:', error.reason);
      }
      throw error;
    }
  }

  async getTradeFromChain(tradeId: number): Promise<any> {
    if (!this.contract) {
      throw new Error('Contract not available');
    }

    try {
      console.log('🔍 ContractService: Getting trade info from blockchain');
      console.log('📝 ContractService: Trade ID:', tradeId);

      const trade = await this.contract.trades(tradeId);
      console.log('✅ ContractService: Trade info retrieved:', trade);

      return {
        id: trade.id,
        adPoster: trade.adPoster,
        counterParty: trade.counterParty,
        seller: trade.seller,
        buyer: trade.buyer,
        token: trade.token,
        amount: trade.amount,
        adType: trade.adType,
        status: trade.status,
        expiryTime: trade.expiryTime
      };
    } catch (error) {
      console.error('💥 ContractService: Error getting trade from chain:', error);
      throw error;
    }
  }

  async getAdmin(): Promise<string> {
    if (!this.contract) {
      throw new Error('Contract not available');
    }

    try {
      return await this.contract.admin();
    } catch (error) {
      console.error('Error getting admin from contract:', error);
      throw error;
    }
  }

  async getTradeCounter(): Promise<number> {
    if (!this.contract) {
      throw new Error('Contract not available');
    }

    try {
      const counter = await this.contract.tradeCounter();
      return Number(counter);
    } catch (error) {
      console.error('Error getting trade counter:', error);
      throw error;
    }
  }
}
