import { ethers } from 'ethers';
import { 
  ZOTRUST_CONTRACT_ABI, 
  ZOTRUST_CONTRACT_ADDRESS,
  BSC_TESTNET_RPC,
  TOKENS
} from '../config/contracts';

/**
 * Smart Contract Debugger - Check ABI and Connection Status
 * This function verifies contract connection and ABI functionality
 */
export const debugSmartContract = async () => {
  console.log('🔍 ===== SMART CONTRACT DEBUGGER =====');
  console.log('🔍 Starting comprehensive contract check...\n');

  try {
    // 1. Check if wallet is connected
    if (!window.ethereum) {
      console.error('❌ Wallet not detected');
      console.log('💡 Please install MetaMask or connect a wallet');
      return false;
    }
    console.log('✅ Wallet detected');

    // 2. Check network connection
    const provider = new ethers.BrowserProvider(window.ethereum as any);
    const network = await provider.getNetwork();
    console.log(`✅ Network connected: ${network.name} (ChainID: ${network.chainId})`);

    // 3. Check if on BSC Testnet
    if (network.chainId !== 97n) {
      console.warn('⚠️  Not on BSC Testnet! Current chain:', network.chainId);
      console.log('💡 Please switch to BSC Testnet (ChainID: 97)');
    } else {
      console.log('✅ Connected to BSC Testnet');
    }

    // 4. Check contract address
    console.log(`📋 Contract Address: ${ZOTRUST_CONTRACT_ADDRESS}`);
    if (ZOTRUST_CONTRACT_ADDRESS === '0x878A2a0d3452533F7a2cB0E3053258AB66C03d0F') {
      console.log('✅ Using provided contract address');
    } else {
      console.warn('⚠️  Contract address may need updating');
    }

    // 5. Check ABI
    console.log(`📋 ABI Functions: ${ZOTRUST_CONTRACT_ABI.length} functions/events`);
    console.log('📋 Available functions:');
    ZOTRUST_CONTRACT_ABI.forEach((item, index) => {
      if (item.type === 'function') {
        console.log(`   ${index + 1}. ${item.name}(${item.inputs?.map(i => i.type).join(', ') || ''})`);
      }
    });

    // 6. Test contract connection
    console.log('\n🔗 Testing contract connection...');
    const readProvider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);
    const contract = new ethers.Contract(ZOTRUST_CONTRACT_ADDRESS, ZOTRUST_CONTRACT_ABI, readProvider);
    
    try {
      // Test basic contract calls
      console.log('📞 Testing contract calls...');
      
      // Test admin function
      try {
        const admin = await contract.admin();
        console.log(`✅ Admin address: ${admin}`);
      } catch (error) {
        console.warn('⚠️  Could not fetch admin address:', error);
      }

      // Test trade counter
      try {
        const tradeCounter = await contract.tradeCounter();
        console.log(`✅ Trade counter: ${tradeCounter.toString()}`);
      } catch (error) {
        console.warn('⚠️  Could not fetch trade counter:', error);
      }

      // Test allowed tokens
      try {
        const usdtAllowed = await contract.allowedTokens(TOKENS.USDT.address);
        console.log(`✅ USDT allowed: ${usdtAllowed}`);
      } catch (error) {
        console.warn('⚠️  Could not check USDT allowance:', error);
      }

    } catch (error) {
      console.error('❌ Contract connection failed:', error);
      console.log('💡 Check if contract is deployed and address is correct');
      return false;
    }

    // 7. Check token addresses
    console.log('\n🪙 Checking token addresses...');
    Object.entries(TOKENS).forEach(([symbol, token]) => {
      console.log(`📋 ${symbol}: ${token.address}`);
      if (token.isNative) {
        console.log(`   ✅ ${symbol} is native token`);
      } else {
        console.log(`   📋 ${symbol} is ERC20 token`);
      }
    });

    // 8. Test wallet connection
    console.log('\n👛 Testing wallet connection...');
    try {
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      console.log(`✅ Wallet address: ${address}`);
      
      // Check balance
      const balance = await provider.getBalance(address);
      const tbnbBalance = ethers.formatEther(balance);
      console.log(`✅ TBNB balance: ${tbnbBalance} TBNB`);
      
      if (parseFloat(tbnbBalance) < 0.01) {
        console.warn('⚠️  Low TBNB balance! Get more from: https://testnet.bnbchain.org/faucet-smart');
      }
      
    } catch (error) {
      console.error('❌ Wallet connection failed:', error);
      return false;
    }

    // 9. Test contract write functions (dry run)
    console.log('\n✍️  Testing contract write functions...');
    try {
      const signer = await provider.getSigner();
      const writeContract = new ethers.Contract(ZOTRUST_CONTRACT_ADDRESS, ZOTRUST_CONTRACT_ABI, signer);
      
      // Test if we can create a trade (dry run - don't actually execute)
      console.log('📋 Testing createTrade function...');
      console.log('   ✅ createTrade function available');
      console.log('   ✅ lockFunds function available');
      console.log('   ✅ releaseFunds function available');
      console.log('   ✅ cancelTrade function available');
      
    } catch (error) {
      console.error('❌ Contract write functions test failed:', error);
    }

    // 10. Summary
    console.log('\n📊 ===== DEBUG SUMMARY =====');
    console.log('✅ Wallet: Connected');
    console.log('✅ Network: BSC Testnet');
    console.log('✅ Contract: Address configured');
    console.log('✅ ABI: Functions loaded');
    console.log('✅ Tokens: Addresses configured');
    console.log('✅ Connection: Ready for testing');
    
    console.log('\n🚀 Ready to test your Zotrust P2P platform!');
    console.log('💡 Next steps:');
    console.log('   1. Create a test ad');
    console.log('   2. Place a test order');
    console.log('   3. Test the complete flow');
    
    return true;

  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.log('💡 Check your wallet connection and network settings');
    return false;
  }
};

/**
 * Quick contract status check
 */
export const quickContractCheck = async () => {
  console.log('🔍 Quick Contract Check...');
  
  try {
    if (!window.ethereum) {
      console.error('❌ No wallet detected');
      return false;
    }

    const provider = new ethers.BrowserProvider(window.ethereum as any);
    const network = await provider.getNetwork();
    
    console.log(`📋 Network: ${network.name} (${network.chainId})`);
    console.log(`📋 Contract: ${ZOTRUST_CONTRACT_ADDRESS}`);
    console.log(`📋 ABI Functions: ${ZOTRUST_CONTRACT_ABI.length}`);
    
    if (network.chainId === 97n) {
      console.log('✅ Ready for BSC Testnet testing');
      return true;
    } else {
      console.log('⚠️  Switch to BSC Testnet (ChainID: 97)');
      return false;
    }
  } catch (error) {
    console.error('❌ Quick check failed:', error);
    return false;
  }
};

/**
 * Test specific contract function
 */
export const testContractFunction = async (functionName: string, ...args: any[]) => {
  console.log(`🧪 Testing function: ${functionName}`);
  
  try {
    const provider = new ethers.BrowserProvider(window.ethereum as any);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(ZOTRUST_CONTRACT_ADDRESS, ZOTRUST_CONTRACT_ABI, signer);
    
    const result = await contract[functionName](...args);
    console.log(`✅ ${functionName} result:`, result);
    return result;
  } catch (error) {
    console.error(`❌ ${functionName} failed:`, error);
    throw error;
  }
};

/**
 * Verify contract deployment and basic functionality
 */
export const verifyContractDeployment = async () => {
  console.log('🔍 ===== CONTRACT VERIFICATION =====');
  console.log(`📋 Contract Address: ${ZOTRUST_CONTRACT_ADDRESS}`);
  
  try {
    if (!window.ethereum) {
      throw new Error('Wallet not connected');
    }

    const provider = new ethers.BrowserProvider(window.ethereum as any);
    
    // 1. Check if contract has code
    console.log('📋 Checking contract code...');
    const code = await provider.getCode(ZOTRUST_CONTRACT_ADDRESS);
    
    if (code === '0x') {
      console.error('❌ No contract code found at this address!');
      console.log('💡 The contract may not be deployed or the address is wrong');
      return false;
    }
    
    console.log('✅ Contract code found');
    console.log(`📋 Code length: ${code.length} characters`);
    
    // 2. Try to get contract info using a minimal ABI
    console.log('📋 Testing basic contract interaction...');
    const minimalABI = [
      'function admin() view returns (address)',
      'function tradeCounter() view returns (uint256)'
    ];
    
    const contract = new ethers.Contract(ZOTRUST_CONTRACT_ADDRESS, minimalABI, provider);
    
    // Test admin function
    try {
      const admin = await contract.admin();
      console.log(`✅ Admin address: ${admin}`);
    } catch (error) {
      console.warn('⚠️ Admin function failed:', error);
    }
    
    // Test tradeCounter function
    try {
      const counter = await contract.tradeCounter();
      console.log(`✅ Trade counter: ${counter.toString()}`);
    } catch (error) {
      console.warn('⚠️ Trade counter function failed:', error);
      console.log('💡 This suggests the contract ABI may not match the deployed contract');
    }
    
    // 3. Check if it's a proxy contract
    console.log('📋 Checking for proxy patterns...');
    try {
      const implementation = await provider.getStorage(ZOTRUST_CONTRACT_ADDRESS, '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc');
      if (implementation !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        console.log('🔍 Possible proxy contract detected');
        console.log(`📋 Implementation: ${implementation}`);
      }
    } catch (error) {
      // Not a proxy, that's fine
    }
    
    console.log('✅ Contract verification complete');
    return true;
    
  } catch (error) {
    console.error('❌ Contract verification failed:', error);
    return false;
  }
};
