
# Zotrust P2P dApp Backend API

## Overview

The Zotrust backend provides a comprehensive API for the decentralized P2P exchange dApp running on BNB Smart Chain. It handles user authentication, order management, agent-based filtering, OTP verification, and admin functions.

## Features

- **Wallet-based Authentication**: Ethereum signature verification
- **Agent-based Ad Filtering**: Users see only ads from their selected agent
- **Order Management**: Complete P2P order lifecycle with timeouts
- **OTP Verification**: Secure 6-digit OTP flow for payment confirmation
- **Real-time Updates**: WebSocket support for live order updates
- **Admin Panel**: Agent management and system administration
- **In-app Calling**: WebRTC signaling for direct communication
- **Audit Logging**: Complete activity tracking
- **Worker Queues**: Automated order timeouts and cleanup

## Tech Stack

- **Framework**: Node.js + Express.js + TypeScript
- **Database**: PostgreSQL with connection pooling
- **Cache/Queue**: Redis + Bull for job processing
- **Real-time**: Socket.IO for WebSocket connections
- **Blockchain**: Ethers.js for Web3 integration
- **Authentication**: JWT with wallet signature verification
- **Validation**: Joi for request validation
- **Logging**: Winston for structured logging

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- BSC wallet with testnet/mainnet access

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Configure your .env file (see Environment Variables section)

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=zotrust
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key

# Blockchain
BSC_RPC_URL=https://bsc-dataseed1.binance.org/
CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
RELAYER_PRIVATE_KEY=your-relayer-private-key

# Token Addresses (BSC Mainnet)
USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
USDC_ADDRESS=0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d

# Server
PORT=5000
FRONTEND_URL=http://localhost:3000
OTP_SALT=your-otp-salt
```

## API Documentation

### Authentication

#### POST /api/auth/wallet-login
Authenticate user with wallet signature.

**Request:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b8D1a5C4F7E2b1D3E8",
  "signature": "0x...",
  "message": "Sign this message to authenticate with Zotrust"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "jwt_token_here"
  }
}
```

#### GET /api/auth/me
Get current user information (requires authentication).

### User Profile

#### POST /api/profile
Update user profile and verification status.

**Request:**
```json
{
  "name": "John Doe",
  "phone": "+91-9876543210",
  "city": "Mumbai",
  "selected_agent_id": 1
}
```

#### GET /api/profile
Get user profile with agent details.

### Agents

#### GET /api/agents?city=Mumbai
Get verified agents by city.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "branch_name": "Mumbai Central Branch",
      "city": "Mumbai",
      "address": "Shop No. 123, Mumbai Central",
      "mobile": "+91-9876543210",
      "verified": true
    }
  ]
}
```

### Ads

#### GET /api/ads?type=BUY&token=USDT
Get P2P ads with agent filtering.

**Query Parameters:**
- `type`: BUY | SELL
- `token`: USDT | USDC
- `city`: Filter by city
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset

#### POST /api/ads
Create new P2P ad (requires verification).

**Request:**
```json
{
  "type": "BUY",
  "token": "USDT",
  "price_inr": 83.50,
  "min_amount": 100,
  "max_amount": 10000,
  "lock_duration_seconds": 3600,
  "city": "Mumbai"
}
```

### Orders

#### POST /api/orders
Create new order.

**Request:**
```json
{
  "ad_id": 1,
  "amount": 1000
}
```

#### POST /api/orders/:id/accept
Accept order (seller only).

**Request:**
```json
{
  "otp_hash": "0x1234567890abcdef..."
}
```

#### POST /api/orders/:id/verify-payment
Verify payment with OTP.

**Request:**
```json
{
  "otp": "123456"
}
```

#### GET /api/orders/my-orders
Get user's orders.

#### GET /api/orders/requests
Get order requests for seller.

### Calls

#### POST /api/calls
Initiate in-app call.

**Request:**
```json
{
  "receiver_address": "0x742d35Cc6634C0532925a3b8D1a5C4F7E2b1D3E8",
  "signaling_data": { ... }
}
```

#### PATCH /api/calls/:id
Update call status.

**Request:**
```json
{
  "status": "active",
  "signaling_data": { ... }
}
```

### Admin Routes

All admin routes require admin authentication.

#### POST /api/admin/agents
Create new agent.

#### GET /api/admin/agents
Get all agents.

#### PATCH /api/admin/agents/:id
Update agent.

#### DELETE /api/admin/agents/:id
Delete agent.

#### GET /api/admin/orders
Get all orders.

#### POST /api/admin/orders/:id/refund
Manual order refund.

#### POST /api/admin/set-fee-wallet
Set platform fee wallet address.

#### GET /api/admin/settings
Get app settings.

#### GET /api/admin/dashboard
Get admin dashboard statistics.

## Database Schema

### Key Tables

- **users**: User profiles and verification status
- **agents**: Verified agents by city
- **ads**: P2P advertisements with agent linking
- **orders**: Order lifecycle and state management
- **otp_logs**: OTP generation and verification tracking
- **calls**: In-app calling records
- **audit_logs**: Complete activity audit trail

### Agent-based Filtering

The system implements agent-based ad visibility:

1. Users select an agent during profile verification
2. Only ads from users with the same agent are visible
3. Ad creation requires verified profile with agent selection
4. This creates localized P2P markets by agent/city

## OTP Security Flow

1. **Generation**: 6-digit numeric OTP generated on order acceptance
2. **Hashing**: `hash = keccak256(otp + orderId + serverSalt)`
3. **Storage**: Only hash stored in database and blockchain
4. **Verification**: Plain OTP verified against stored hash
5. **Cleanup**: OTPs automatically expired and cleaned up

## Worker Queues

### Order Timeout Worker
- Automatically cancels orders not accepted within 5 minutes
- Removes pending jobs when orders are manually cancelled

### Lock Expiry Worker
- Moves orders to disputed state after lock expiration
- Allows admin intervention for resolution

### OTP Cleanup Worker
- Runs hourly to remove expired OTP records
- Maintains database hygiene

## WebSocket Events

### Client to Server
- `join-user-room`: Join personal notification room
- `call-offer`: WebRTC call offer
- `call-answer`: WebRTC call answer
- `ice-candidate`: WebRTC ICE candidate
- `call-end`: End call

### Server to Client
- `NEW_ORDER`: New order notification
- `ORDER_ACCEPTED`: Order accepted notification
- `ORDER_CANCELLED`: Order cancelled notification
- `FUNDS_RELEASED`: Payment completed notification
- `INCOMING_CALL`: Incoming call notification

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Joi schema validation for all inputs
- **SQL Injection Protection**: Parameterized queries
- **JWT Authentication**: Secure token-based auth
- **Audit Logging**: Complete activity tracking
- **Error Handling**: Secure error responses

## Monitoring & Logging

- **Winston Logging**: Structured JSON logging
- **Health Check**: `/health` endpoint for monitoring
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Request timing and statistics

## Deployment

### Production Setup

1. **Environment Configuration**:
   ```bash
   NODE_ENV=production
   DB_HOST=your-production-db
   REDIS_URL=your-production-redis
   BSC_RPC_URL=https://bsc-dataseed1.binance.org/
   ```

2. **Database Setup**:
   ```bash
   npm run migrate
   ```

3. **Process Management**:
   ```bash
   npm run build
   npm start
   ```

4. **Nginx Configuration**:
   ```nginx
   location /api {
       proxy_pass http://localhost:5000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
   }
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## License

MIT License - see LICENSE file for details.

## Support

For technical support or questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation wiki

---

**Note**: This backend is designed specifically for the Zotrust P2P dApp and includes BSC-specific configurations. Ensure proper environment setup before deployment.
