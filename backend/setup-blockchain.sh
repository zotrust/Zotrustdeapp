#!/bin/bash

# 🔐 Blockchain Fund Locking Setup Script
# This script helps you set up environment variables for blockchain integration

echo "🚀 ZoTrust P2P - Blockchain Fund Locking Setup"
echo "=============================================="
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled"
        exit 1
    fi
fi

# Copy template
if [ -f ENV_TEMPLATE.txt ]; then
    cp ENV_TEMPLATE.txt .env
    echo "✅ Created .env from template"
else
    echo "❌ ENV_TEMPLATE.txt not found!"
    echo "Please run this script from the backend directory"
    exit 1
fi

echo ""
echo "📝 Now you need to configure blockchain settings:"
echo ""
echo "1️⃣  Get a wallet private key:"
echo "   - Open MetaMask"
echo "   - Account Details → Export Private Key"
echo "   - Copy the private key (starts with 0x)"
echo ""
echo "2️⃣  Get testnet BNB:"
echo "   - Visit: https://testnet.binance.org/faucet-smart"
echo "   - Paste your wallet address"
echo "   - Request testnet BNB"
echo ""
echo "3️⃣  Deploy smart contract:"
echo "   - Deploy ZoTrust contract to BSC Testnet"
echo "   - Copy the contract address"
echo ""

read -p "Do you have the contract address? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    read -p "Enter CONTRACT_ADDRESS (0x...): " CONTRACT_ADDR
    
    if [[ $CONTRACT_ADDR =~ ^0x[a-fA-F0-9]{40}$ ]]; then
        # Update .env file
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000/CONTRACT_ADDRESS=$CONTRACT_ADDR/" .env
        else
            # Linux
            sed -i "s/CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000/CONTRACT_ADDRESS=$CONTRACT_ADDR/" .env
        fi
        echo "✅ Contract address updated"
    else
        echo "❌ Invalid address format"
    fi
fi

read -p "Do you have the relayer private key? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "⚠️  WARNING: Never share your private key with anyone!"
    read -sp "Enter RELAYER_PRIVATE_KEY (will be hidden): " PRIVATE_KEY
    echo ""
    
    if [[ $PRIVATE_KEY =~ ^0x[a-fA-F0-9]{64}$ ]]; then
        # Update .env file
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/RELAYER_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000/RELAYER_PRIVATE_KEY=$PRIVATE_KEY/" .env
        else
            # Linux
            sed -i "s/RELAYER_PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000/RELAYER_PRIVATE_KEY=$PRIVATE_KEY/" .env
        fi
        echo "✅ Private key updated"
    else
        echo "❌ Invalid private key format"
    fi
fi

echo ""
echo "🎯 Setup Summary:"
echo "================"
grep "CONTRACT_ADDRESS=" .env
echo "RELAYER_PRIVATE_KEY=0x****** (hidden for security)"
echo ""

# Ask to rebuild and restart
read -p "Build and restart backend now? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔨 Building backend..."
    npm run build
    
    echo ""
    echo "🛑 Stopping existing backend..."
    lsof -ti:5000 | xargs kill -9 2>/dev/null || true
    
    echo ""
    echo "🚀 Starting backend..."
    npm start &
    
    sleep 3
    
    echo ""
    echo "✅ Backend restarted!"
    echo ""
    echo "Check logs above for:"
    echo "  ✅ ContractService initialized"
    echo "  ✅ Wallet address: 0x..."
    echo ""
    echo "If you see 'read-only mode', check your .env configuration"
else
    echo ""
    echo "⚠️  Remember to rebuild and restart:"
    echo "   npm run build && npm start"
fi

echo ""
echo "📖 For more help, see: BLOCKCHAIN_FUND_LOCKING_GUIDE.md"
echo ""

