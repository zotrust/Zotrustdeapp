
export interface User {
  id: number;
  address: string;
  name?: string;
  phone?: string;
  city?: string;
  selected_agent_id?: number;
  verified: boolean;
  verified_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Agent {
  id: number;
  branch_name: string;
  city: string;
  address?: string;
  mobile?: string;
  verified: boolean;
  created_by_admin?: number;
  created_at: Date;
  updated_at: Date;
}

export interface Ad {
  id: number;
  owner_address: string;
  owner_selected_agent_id?: number;
  type: 'BUY' | 'SELL';
  token: 'USDT' | 'USDC' | 'TBNB';
  price_inr: number;
  min_amount: number;
  max_amount: number;
  sell_quantity?: number | null;
  buy_quantity?: number | null;
  lock_duration_seconds: number;
  city?: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Order {
  id: number;
  ad_id: number;
  buyer_address: string;
  seller_address: string;
  amount: number;
  token: string;
  state: 'CREATED' | 'ACCEPTED' | 'LOCKED' | 'RELEASED' | 'CANCELLED' | 'UNDER_DISPUTE' | 'REFUNDED' | 'EXPIRED';
  agent_branch?: string;
  agent_number?: string;
  agent_address?: string;
  created_at: Date;
  start_time: Date;
  timezone?: string;
  start_datetime_string?: string;
  accepted_at?: Date;
  lock_expires_at?: Date;
  otp_hash?: string;
  tx_hash?: string;
}

export interface OTPLog {
  id: number;
  order_id: number;
  otp_hash: string;
  created_at: Date;
  expires_at: Date;
  used: boolean;
}

export interface Call {
  id: number;
  caller_address: string;
  receiver_address: string;
  status: 'initiated' | 'active' | 'ended' | 'failed';
  signaling_data?: any;
  created_at: Date;
  ended_at?: Date;
}

export interface AuditLog {
  id: number;
  user_address?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  created_at: Date;
}

export interface AppSetting {
  id: number;
  key: string;
  value: string;
  updated_at: Date;
  updated_by?: number;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    server_time?: string;
    accept_timeout_minutes?: number;
    [key: string]: any;
  };
}

export interface JWTPayload {
  address: string;
  iat: number;
  exp: number;
}

export interface CreateAdRequest {
  type: 'BUY' | 'SELL';
  token: 'USDT' | 'USDC' | 'TBNB';
  price_inr: number;
  min_amount: number;
  max_amount: number;
  sell_quantity?: number | null;
  buy_quantity?: number | null;
  lock_duration_seconds?: number;
  city?: string | number;
  selected_agent_ids: string[];
}

export interface CreateOrderRequest {
  ad_id: number;
  amount: number;
  selected_agent_id?: string;
  // start_time is now auto-generated on backend using database CURRENT_TIMESTAMP
  timezone?: string; // User's timezone (optional, generated on backend)
  start_datetime_string?: string; // Formatted date time (optional, generated on backend)
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
  created_at: Date;
  completed_at?: Date;
}

export interface Support {
  id: number;
  type: 'phone' | 'email';
  value: string;
  label?: string;
  active: boolean;
  priority: number;
  created_at: Date;
  updated_at: Date;
}

export interface AcceptOrderRequest {
  // Empty body - no parameters required
}


export interface UpdateProfileRequest {
  name?: string;
  phone?: string;
  city?: string;
  selected_agent_id?: number;
}
