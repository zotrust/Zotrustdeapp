
import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {Home, Users, FileText, User, Phone} from 'lucide-react';
import { useCallNotifications } from '../providers/CallNotificationProvider';
import { useWalletStore } from '../stores/walletStore';
import { useUserStore } from '../stores/userStore';
import { useNotificationStore } from '../stores/notificationStore';
import logo from './logo.jpeg';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { incomingCall, isConnected: callServiceConnected } = useCallNotifications();
  const { isConnected: walletConnected, address } = useWalletStore();
  const { user } = useUserStore();
  const { unreadOrdersCount } = useNotificationStore();

  const isActive = (path: string) => location.pathname === path;
  const isOrdersPage = location.pathname === '/orders';

  // Ensure mobile viewport is properly set
  useEffect(() => {
    // Set viewport meta tag for mobile devices
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(meta);
    }

    // Prevent zoom on mobile input focus
    const handleTouchStart = () => {
      document.addEventListener('touchend', () => {
        document.body.style.zoom = '1';
      }, { once: true });
    };

    document.addEventListener('touchstart', handleTouchStart);
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  // Request notification permissions on mobile
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }, []);

  // Add vibration for incoming calls on mobile
  useEffect(() => {
    if (incomingCall && 'navigator' in window && 'vibrate' in navigator) {
      // Vibrate pattern: vibrate for 500ms, pause for 300ms, repeat
      const vibrationPattern = [500, 300, 500, 300, 500, 300];
      navigator.vibrate(vibrationPattern);
      
      // Stop vibration when call is no longer incoming
      return () => {
        navigator.vibrate(0);
      };
    }
  }, [incomingCall]);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Connection Status Indicator */}
      {walletConnected && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-black/10 backdrop-blur-sm">
          <div className="max-w-md mx-auto px-4 py-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${callServiceConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
                <span className="text-gray-300">
                  {callServiceConnected ? 'Online' : 'Offline'}
                </span>
              </div>
              {user && (
                <div className="flex items-center space-x-1">
                  {user.verified && (
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                  )}
                  <span className="text-gray-300 truncate max-w-20">
                    {user.name || `${address?.slice(0, 6)}...${address?.slice(-4)}`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`bg-black/20 backdrop-blur-lg border-b border-white/10 ${walletConnected ? 'mt-6' : ''}`}>
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <img src={logo} alt="Zotrust Logo" className="w-12 h-12 object-contain" />
            {incomingCall && (
              <div className="flex items-center space-x-2 animate-pulse">
                <Phone size={16} className="text-green-400" />
                <span className="text-green-400 text-sm font-medium">Incoming Call</span>
              </div>
            )}
            <div className="text-center flex items-center justify-center"  >
            <p className="text-gray-300 text-sm text-center font-bold">Decentralized P2P Trading Platform</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-safe">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-black/30 backdrop-blur-lg border-t border-white/20 pb-safe">
        <div className="w-full px-2 sm:px-4">
          <div className="flex items-center justify-between py-2 sm:py-3 safe-area-inset-bottom">
            <Link
              to="/"
              className={`flex flex-col items-center space-y-0.5 py-2 px-2 sm:py-3 sm:px-4 rounded-lg transition-all duration-200 min-h-[48px] sm:min-h-[56px] touch-manipulation flex-1 ${
                isActive('/') 
                  ? 'text-violet-400 bg-violet-400/20 scale-105' 
                  : 'text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/20 active:scale-95'
              }`}
              style={{ touchAction: 'manipulation' }}
            >
              <Home size={20} className="sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-xs font-medium leading-tight">Home</span>
            </Link>

            <Link
              to="/p2p"
              className={`flex flex-col items-center space-y-0.5 py-2 px-2 sm:py-3 sm:px-4 rounded-lg transition-all duration-200 min-h-[48px] sm:min-h-[56px] touch-manipulation flex-1 ${
                isActive('/p2p') 
                  ? 'text-violet-400 bg-violet-400/20 scale-105' 
                  : 'text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/20 active:scale-95'
              }`}
              style={{ touchAction: 'manipulation' }}
            >
              <Users size={20} className="sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-xs font-medium leading-tight">P2P</span>
            </Link>

            <Link
              to="/orders"
              className={`flex flex-col items-center space-y-0.5 py-2 px-2 sm:py-3 sm:px-4 rounded-lg transition-all duration-200 min-h-[48px] sm:min-h-[56px] touch-manipulation flex-1 relative ${
                isActive('/orders') 
                  ? 'text-violet-400 bg-violet-400/20 scale-105' 
                  : 'text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/20 active:scale-95'
              }`}
              style={{ touchAction: 'manipulation' }}
            >
              <FileText size={20} className="sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-xs font-medium leading-tight">Orders</span>
              {incomingCall && (
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse" />
              )}
              {!isOrdersPage && unreadOrdersCount > 0 && (
                <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center px-1">
                  <span className="text-white text-[10px] font-bold">
                    {unreadOrdersCount > 99 ? '99+' : unreadOrdersCount}
                  </span>
                </div>
              )}
            </Link>

          
            <Link
              to="/profile"
              className={`flex flex-col items-center space-y-0.5 py-2 px-2 sm:py-3 sm:px-4 rounded-lg transition-all duration-200 min-h-[48px] sm:min-h-[56px] touch-manipulation flex-1 relative ${
                isActive('/profile') 
                  ? 'text-violet-400 bg-violet-400/20 scale-105' 
                  : 'text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/20 active:scale-95'
              }`}
              style={{ touchAction: 'manipulation' }}
            >
              <User size={20} className="sm:w-5 sm:h-5" />
              <span className="text-[10px] sm:text-xs font-medium leading-tight">Profile</span>
              {user?.verified && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full" />
              )}
            </Link>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Layout;
