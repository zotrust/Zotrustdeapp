export interface WalletState {
  address: string | null;
  isConnected: boolean;
  chainId: number | null;
  balance: {
    bnb: string;
    usdt: string;
    wbnb: string;
    usdc: string;
  };
}

export interface User {
  id: string;
  address: string;
  name?: string;
  phone?: string;
  locationId?: string;
  selectedAgentIds?: string[]; // Changed to support multiple agents
  verified: boolean;
  verifiedAt?: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  branchName: string;
  mobile: string;
  address: string;
  locationId: string;
  locationName: string;
  city: string;
  verified: boolean;
  createdByAdmin: string;
  createdAt: string;
}

export interface Ad {
  id: string;
  ownerAddress: string;
  ownerSelectedAgentIds: string[]; // Changed to support multiple agents
  owner_name?: string;
  type: 'BUY' | 'SELL';
  token: 'USDT' | 'USDC';
  priceInr: string;
  minAmount: string;
  maxAmount: string;
  sellQuantity?: string | null;
  buyQuantity?: string | null;
  lockDurationSeconds: number;
  city: string;
  active: boolean;
  createdAt: string;
  agent?: Agent; // Single agent for the ad (primary agent)
  agents?: Agent[]; // All agents for the ad
}

export interface Order {
  id: string;
  adId: string;
  adType: 'BUY' | 'SELL'; // Type from the original ad
  buyerAddress: string;
  sellerAddress: string;
  amount: number;
  token: 'USDT' | 'USDC';
  priceInr: number;
  state: 'CREATED' | 'ACCEPTED' | 'LOCKED' | 'RELEASED' | 'CANCELLED' | 'EXPIRED' | 'UNDER_DISPUTE' | 'REFUNDED';
  agentBranch: string;
  agentNumber: string;
  agentAddress: string;
  createdAt: string;
  startTime: string;
  timezone?: string;
  startDatetimeString?: string;
  acceptedAt?: string;
  lockExpiresAt?: string;
  otpHash?: string;
  txHash?: string;
  ad?: Ad;
  adOwnerAddress?: string;
  // Server-calculated expiry fields
  is_expired?: boolean;
  time_remaining_seconds?: number;
  expires_at?: string;
  expires_at_ms?: number;
  // User role and names
  user_role?: string;
  buyer_name?: string;
  seller_name?: string;
}

export interface CreateAdData {
  type: 'BUY' | 'SELL';
  token: 'USDT' | 'USDC';
  priceInr: string;
  minAmount: string;
  maxAmount: string;
  lockDurationSeconds: number;
  selectedAgentIds: string[]; // Changed to support multiple agents
}

export interface ProfileData {
  name: string;
  phone: string;
  locationId: string;
  selectedAgentIds: string[]; // Changed to support multiple agents
}

export interface Location {
  id: string;
  name: string;
  city: string;
  state: string;
  country?: string;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-initiated' | 'call-answered' | 'call-ended' | 'call-rejected';
  data: any;
  from: string;
  to: string;
  callId?: string;
}

export interface CallData {
  id: string;
  from: string;
  to: string;
  status: 'initiated' | 'ringing' | 'answered' | 'ended' | 'rejected';
  startTime?: string;
  endTime?: string;
}

export interface Transaction {
  id: number;
  transaction_number: string;
  order_id: number;
  buyer_address: string;
  seller_address: string;
  amount: number;
  token: string;
  transaction_type: 'BUY' | 'SELL';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  created_at: string;
  completed_at?: string;
}

export interface Support {
  id: number;
  type: 'phone' | 'email';
  value: string;
  label?: string;
  active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}