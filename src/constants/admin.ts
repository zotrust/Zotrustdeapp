/**
 * Admin Support Constants
 * Fixed address for admin support calls - users always connect to this
 */

// Fixed admin support identifier - always the same, no issues
export const ADMIN_SUPPORT_ADDRESS = 'ADMIN_SUPPORT';

// Admin support display name
export const ADMIN_SUPPORT_NAME = 'Admin Support';

// Admin support placeholder wallet address (42 chars)
export const ADMIN_SUPPORT_PLACEHOLDER_ADDRESS = '0x' + 'admin'.padEnd(40, '0').toLowerCase();

/**
 * Check if an address is the admin support address
 */
export const isAdminSupportAddress = (address: string | null | undefined): boolean => {
  if (!address) return false;
  const normalized = address.toLowerCase();
  return normalized === 'admin_support' || normalized === ADMIN_SUPPORT_ADDRESS.toLowerCase();
};

