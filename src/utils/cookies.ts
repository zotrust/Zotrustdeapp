// Cookie utility functions for wallet persistence
export const setCookie = (name: string, value: string, days: number = 30) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};

export const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

export const deleteCookie = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
};

// Wallet-specific cookie functions
export const saveWalletState = (address: string, walletType: string, chainId: number) => {
  const walletData = {
    address,
    walletType,
    chainId,
    timestamp: Date.now()
  };
  setCookie('wallet_state', JSON.stringify(walletData), 30); // 30 days
};

export const getWalletState = (): { address: string; walletType: string; chainId: number } | null => {
  const walletData = getCookie('wallet_state');
  if (!walletData) return null;
  
  try {
    const parsed = JSON.parse(walletData);
    // Check if data is not older than 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    if (parsed.timestamp && parsed.timestamp < thirtyDaysAgo) {
      clearWalletState();
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('Failed to parse wallet state from cookie:', error);
    clearWalletState();
    return null;
  }
};

export const clearWalletState = () => {
  deleteCookie('wallet_state');
};
