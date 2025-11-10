// Script to whitelist native BNB (address(0)) in the smart contract
const { ethers } = require('ethers');

const CONTRACT_ADDRESS = '0x878A2a0d3452533F7a2cB0E3053258AB66C03d0F';
const RPC_URL = 'https://data-seed-prebsc-1-s1.binance.org:8545/';

// Minimal ABI for setAllowedToken function
const CONTRACT_ABI = [
  {
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "allowed", "type": "bool" }
    ],
    "name": "setAllowedToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

async function whitelistNativeBNB() {
  console.log('🚀 Whitelisting Native BNB in Smart Contract...\n');
  
  // Check if ADMIN_PRIVATE_KEY is set
  const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY;
  if (!adminPrivateKey) {
    console.error('❌ Error: ADMIN_PRIVATE_KEY not found in environment variables');
    console.log('\n💡 Usage:');
    console.log('   ADMIN_PRIVATE_KEY=your_private_key node scripts/whitelist-native-bnb.js');
    console.log('\n⚠️  OR use the HTML tool: scripts/allow-token.html');
    process.exit(1);
  }
  
  try {
    // Connect to BSC Testnet
    console.log('📡 Connecting to BSC Testnet...');
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(adminPrivateKey, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    
    console.log('👛 Admin Wallet:', wallet.address);
    console.log('📄 Contract:', CONTRACT_ADDRESS);
    console.log('🪙 Token to whitelist: 0x0000000000000000000000000000000000000000 (Native BNB)\n');
    
    // Call setAllowedToken
    console.log('📝 Calling setAllowedToken(address(0), true)...');
    const tx = await contract.setAllowedToken(
      '0x0000000000000000000000000000000000000000', // Native BNB
      true // Allow
    );
    
    console.log('📡 Transaction sent:', tx.hash);
    console.log('⏳ Waiting for confirmation...\n');
    
    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed!');
    console.log('📦 Block:', receipt.blockNumber);
    console.log('⛽ Gas Used:', receipt.gasUsed.toString());
    console.log('🔗 BSCScan:', `https://testnet.bscscan.com/tx/${tx.hash}`);
    console.log('\n🎉 Native BNB (TBNB) is now whitelisted!');
    console.log('✅ You can now create trades with native BNB\n');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    if (error.message.includes('Ownable')) {
      console.error('\n❌ Only contract owner can whitelist tokens!');
      console.error('   Make sure you are using the ADMIN wallet private key.');
    }
    process.exit(1);
  }
}

whitelistNativeBNB();

