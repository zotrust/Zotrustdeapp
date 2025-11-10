
// BSC Network Configuration
export const BSC_MAINNET = {
  chainId: 56,
  name: 'BNB Smart Chain',
  rpcUrl: 'https://bsc-dataseed.binance.org/',
  blockExplorer: 'https://bscscan.com'
};

export const BSC_TESTNET = {
  chainId: 97,
  name: 'BNB Smart Chain Testnet',
  rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
  blockExplorer: 'https://testnet.bscscan.com'
};

// Token Addresses (will be updated with actual addresses)
export const TOKEN_ADDRESSES = {
  USDT: {
    mainnet: '0x55d398326f99059fF775485246999027B3197955',
    testnet: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'
  },
  USDC: {
    mainnet: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    testnet: '0x64544969ed7EBf5f083679233325356EbE738930'
  }
};

// Contract Addresses (to be deployed)
export const CONTRACT_ADDRESSES = {
  P2P_ESCROW: {
    mainnet: '',
    testnet: ''
  }
};

// App Configuration
export const APP_CONFIG = {
  NETWORK: process.env.NODE_ENV === 'production' ? BSC_MAINNET : BSC_TESTNET,
  API_BASE_URL: process.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  WS_URL: process.env.VITE_WS_URL || (typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss://localhost:5000' : 'ws://localhost:5000'),
  ACCEPT_TIMEOUT_MINUTES: 5,
  DEFAULT_LOCK_DURATION_HOURS: 1,
  PLATFORM_FEE_PERCENT: 2, // 1% buyer + 1% seller
};

// Indian Cities (sample list - can be expanded)
export const INDIAN_CITIES = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata',
  'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Kanpur',
  'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad',
  'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik'
];

// ERC20 ABI (minimal for balanceOf and approve)
export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];
