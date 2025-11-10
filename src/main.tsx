import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import App from './App.tsx'
import SplashScreen from './components/SplashScreen.tsx'
import './index.css'

// Global error handling for IndexedDB and SVG errors
window.addEventListener('error', (event) => {
  // Ignore IndexedDB errors
  if (event.error && event.error.message && 
      (event.error.message.includes('IndexedDB') || 
       event.error.message.includes('backing store'))) {
    console.warn('IndexedDB error ignored:', event.error.message);
    event.preventDefault();
    return;
  }
  
  // Ignore SVG attribute errors from WalletConnect
  if (event.error && event.error.message && 
      event.error.message.includes('Unexpected end of attribute')) {
    console.warn('SVG attribute error ignored:', event.error.message);
    event.preventDefault();
    return;
  }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  // Ignore IndexedDB promise rejections
  if (event.reason && event.reason.message && 
      (event.reason.message.includes('IndexedDB') || 
       event.reason.message.includes('backing store'))) {
    console.warn('IndexedDB promise rejection ignored:', event.reason.message);
    event.preventDefault();
    return;
  }
  
  // Ignore SVG attribute errors
  if (event.reason && event.reason.message && 
      event.reason.message.includes('Unexpected end of attribute')) {
    console.warn('SVG attribute promise rejection ignored:', event.reason.message);
    event.preventDefault();
    return;
  }
});

// Disable service worker registration and clear all caches
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister();
      console.log('Service worker unregistered');
    });
  });
  
  // Clear all caches in development
  if (import.meta.env.DEV) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        caches.delete(cacheName);
        console.log('Cache cleared:', cacheName);
      });
    });
  }
}

// Force hard reload in development to prevent caching
if (import.meta.env.DEV && typeof window !== 'undefined') {
  // Add cache buster to prevent browser from caching
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has('_cb')) {
    urlParams.set('_cb', Date.now().toString());
    window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
  }
}

// Main App Component with Splash Screen
function MainApp() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <MainApp />,
)