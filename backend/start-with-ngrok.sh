#!/bin/bash

# Ngrok Setup Script for Zotrust Backend
echo "🚀 Zotrust Backend with ngrok Setup"
echo "====================================="

# Check if NGROK_AUTHTOKEN is set
if [ -z "$NGROK_AUTHTOKEN" ]; then
    echo "❌ NGROK_AUTHTOKEN environment variable is not set!"
    echo ""
    echo "To get your ngrok authtoken:"
    echo "1. Go to https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "2. Sign up for a free ngrok account"
    echo "3. Copy your authtoken"
    echo "4. Set it as environment variable:"
    echo "   export NGROK_AUTHTOKEN=your_authtoken_here"
    echo "   export NGROK_SUBDOMAIN=your-custom-subdomain (optional)"
    echo ""
    echo "Or run this script with the token:"
    echo "   NGROK_AUTHTOKEN=your_authtoken_here NGROK_SUBDOMAIN=your-subdomain ./start-with-ngrok.sh"
    echo ""
    exit 1
fi

echo "✅ NGROK_AUTHTOKEN is set"
echo "🚀 Starting backend server with ngrok tunnel..."
echo ""

# Start the server with ngrok
npm start
