# Ngrok Setup for Zotrust Backend

## Quick Setup

1. **Get your ngrok authtoken:**
   - Go to https://dashboard.ngrok.com/get-started/your-authtoken
   - Sign up for a free ngrok account
   - Copy your authtoken

2. **Set the environment variable:**
   ```bash
   export NGROK_AUTHTOKEN=your_authtoken_here
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

## Alternative: Use the setup script

```bash
NGROK_AUTHTOKEN=your_authtoken_here ./start-with-ngrok.sh
```

## What you'll get:

- **Local access:** `http://localhost:5000` or `https://localhost:5000`
- **Network access:** `http://10.202.122.230:5000` (your local IP)
- **Public access:** `https://abc123.ngrok.io` (ngrok public URL)

## Features:

- ✅ Automatic ngrok tunnel creation
- ✅ Public HTTPS URL (no SSL warnings)
- ✅ WebSocket support (WSS)
- ✅ Accessible from anywhere on the internet
- ✅ Real-time updates via WebSocket

## Troubleshooting:

- If ngrok fails, check your authtoken
- Make sure you have an active internet connection
- The ngrok URL will change each time you restart (unless you have a paid plan)
