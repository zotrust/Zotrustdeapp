// Centralized access to Vite env variables
// Vite exposes variables via import.meta.env with VITE_ prefix

const getEnv = (key: string, fallback?: string): string => {
	const value = (import.meta as any).env?.[key] as string | undefined;
	if (value && value.length > 0) return value;
	if (fallback !== undefined) return fallback;
	throw new Error(`Missing required env var: ${key}`);
};

export const API_BASE_URL = getEnv('VITE_API_BASE_URL', '/api');

// For WebSocket URL, use dynamic detection with local network support
const getWebSocketURL = () => {
  const wsUrl = getEnv('VITE_WS_URL', '');
  if (wsUrl) return wsUrl;
  
  // In browser environment, use dynamic detection
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Check if it's an ngrok domain
    const isNgrok = hostname.includes('ngrok') || hostname.includes('ngrok-free.dev') || hostname.includes('ngrok.io');
    
    // For local network IPs, use appropriate protocol based on current page protocol
    if (hostname.startsWith('192.168.') || 
        hostname.startsWith('10.') || 
        hostname.startsWith('172.') ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      
      // Use WSS if current page is HTTPS, otherwise use WS
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${hostname}:5000`;
    }
    
    // For ngrok domains, use same origin with WSS (ngrok always uses HTTPS/WSS)
    if (isNgrok) {
      const host = window.location.host;
      return `wss://${host}`;
    }
    
    // For production/HTTPS, use same origin
    const host = window.location.host;
    return `${protocol}//${host}`;
  }
  
  // Fallback for development
  return window.location.protocol === 'https:' ? 'wss://localhost:5000' : 'ws://localhost:5000';
};

export const WS_URL = getWebSocketURL();

export const IS_DEV = (import.meta as any).env?.MODE !== 'production';


