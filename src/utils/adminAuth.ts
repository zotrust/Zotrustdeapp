// Admin authentication utilities

export const clearExpiredToken = () => {
  localStorage.removeItem('adminToken');
  console.log('Cleared expired admin token');
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch {
    return true; // If we can't parse the token, consider it expired
  }
};

export const getAdminToken = (): string | null => {
  return localStorage.getItem('adminToken');
};

export const checkAdminAuth = async (): Promise<boolean> => {
  const token = localStorage.getItem('adminToken');
  
  if (!token) {
    return false;
  }

  // Check if token is expired locally first
  if (isTokenExpired(token)) {
    clearExpiredToken();
    return false;
  }

  // Test token with server
  try {
    const response = await fetch('/api/admin/test-token', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      clearExpiredToken();
      return false;
    }
    
    return true;
  } catch {
    clearExpiredToken();
    return false;
  }
};
