// Import the correct P2PEscrowV2 ABI
import { ZOTRUST_CONTRACT_ABI } from './contracts-abi';

// BSC Mainnet Chain ID (56)
export const BSC_MAINNET_CHAIN_ID = 56;

// Re-export ABI for backwards compatibility
export { ZOTRUST_CONTRACT_ABI };

// Mainnet Contract Address
export const ZOTRUST_CONTRACT_ADDRESS = '0x6722FE6DdCe1F7389daa70aD5C65e51f9F375E6e';

// Mainnet Token Addresses (BSC Mainnet - BNB Primary)
export const TOKENS = {
  BNB: {
    symbol: 'BNB',
    address: '0x0000000000000000000000000000000000000000', // ✅ Native BNB (address(0) with msg.value support)
    decimals: 18,
    isNative: true // Native token - requires msg.value in transactions
  },
  WBNB: {
    symbol: 'WBNB',
    address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // Wrapped BNB (ERC20) on Mainnet
    decimals: 18,
    isNative: false
  },
  USDT: {
    symbol: 'USDT',
    address: '0x55d398326f99059fF775485246999027B3197955', // BSC Mainnet USDT
    decimals: 18,
    isNative: false
  },
  USDC: {
    symbol: 'USDC',
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // BSC Mainnet USDC
    decimals: 18,
    isNative: false
  },
  BUSD: {
    symbol: 'BUSD',
    address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', // BSC Mainnet BUSD
    decimals: 18,
    isNative: false
  },
  CAKE: {
    symbol: 'CAKE',
    address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', // PancakeSwap Mainnet CAKE
    decimals: 18,
    isNative: false
  }
};


// Mainnet RPC URL
export const BSC_MAINNET_RPC = 'https://bsc-dataseed.binance.org/';

// Network Config for wallet connection
export const BSC_MAINNET_PARAMS = {
  chainId: '0x38', // 56 in hex
  chainName: 'BSC Mainnet',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18
  },
  rpcUrls: [BSC_MAINNET_RPC],
  blockExplorerUrls: ['https://bscscan.com']
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

// Mainnet Contract Addresses (for walletStore compatibility)
export const CONTRACTS = {
  BSC_MAINNET: {
    USDT: TOKENS.USDT.address,
    USDC: TOKENS.USDC.address,
    BUSD: TOKENS.BUSD.address,
    chainId: 56
  }
};

// Network configurations
export const NETWORKS = {
  56: {
    name: 'BSC Mainnet',
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    blockExplorerUrl: 'https://bscscan.com'
  }
};
