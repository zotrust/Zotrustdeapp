import { createClient } from '@lumi.new/sdk'

// Add error handling for WalletConnect SVG issues
const originalConsoleError = console.error;
console.error = (...args) => {
  // Ignore SVG attribute errors from WalletConnect
  if (args[0] && typeof args[0] === 'string' && 
      args[0].includes('Unexpected end of attribute')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

export const lumi = createClient({
  projectId: 'p360991840965423104',
  apiBaseUrl: 'https://api.lumi.new',
  authOrigin: 'https://auth.lumi.new',
})