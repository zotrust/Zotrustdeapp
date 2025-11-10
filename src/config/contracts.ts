// Import the correct P2PEscrowV2 ABI
import { ZOTRUST_CONTRACT_ABI } from './contracts-abi';

// BSC Testnet Chain ID (97)
export const BSC_TESTNET_CHAIN_ID = 97;

// Re-export ABI for backwards compatibility
export { ZOTRUST_CONTRACT_ABI };

// Testnet Contract Address (replace with your deployed testnet address)
export const ZOTRUST_CONTRACT_ADDRESS = '0x878A2a0d3452533F7a2cB0E3053258AB66C03d0F';

// Testnet Token Addresses (BSC Testnet - TBNB Primary)
export const TOKENS = {
  TBNB: {
    symbol: 'TBNB',
    address: '0x0000000000000000000000000000000000000000', // ✅ Native BNB (address(0) with msg.value support)
    decimals: 18,
    isNative: true // Native token - requires msg.value in transactions
  },
  WBNB: {
    symbol: 'WBNB',
    address: '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd', // Wrapped BNB (ERC20)
    decimals: 18,
    isNative: false
  },
  USDT: {
    symbol: 'USDT',
    address: '0x7ef95a0FEE0Dd31b22626fA2e10Ee6A223F8a684', // PancakeSwap Testnet USDT
    decimals: 18,
    isNative: false
  },
  USDC: {
    symbol: 'USDC',
    address: '0x64544969ed7EBf5f083679233325356EbE738930', // BSC Testnet USDC
    decimals: 18,
    isNative: false
  },
  BUSD: {
    symbol: 'BUSD',
    address: '0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7', // PancakeSwap Testnet BUSD
    decimals: 18,
    isNative: false
  },
  CAKE: {
    symbol: 'CAKE',
    address: '0xFa60D973F7642B748046464eAD5d4c8c4b8A0C7c', // PancakeSwap Testnet CAKE
    decimals: 18,
    isNative: false
  }
};


// Testnet RPC URL
export const BSC_TESTNET_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545/';

// Network Config for wallet connection
export const BSC_TESTNET_PARAMS = {
  chainId: '0x61', // 97 in hex
  chainName: 'BSC Testnet',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18
  },
  rpcUrls: [BSC_TESTNET_RPC],
  blockExplorerUrls: ['https://testnet.bscscan.com']
};

// ERC20 ABI for balance checking
export const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  }
];

// Testnet Contract Addresses (for walletStore compatibility)
export const CONTRACTS = {
  BSC_TESTNET: {
    USDT: TOKENS.USDT.address,
    USDC: TOKENS.USDC.address,
    BUSD: TOKENS.BUSD.address,
    chainId: 97
  }
};

// Network configurations
export const NETWORKS = {
  56: {
    name: 'BSC Mainnet',
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    blockExplorerUrl: 'https://bscscan.com'
  },
  97: {
    name: 'BSC Testnet',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    blockExplorerUrl: 'https://testnet.bscscan.com'
  }
};
