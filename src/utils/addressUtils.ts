/**
 * Utility functions for wallet address handling
 */

/**
 * Generates a random Ethereum-style address (42 characters: 0x + 40 hex chars)
 * @returns Random address in format 0x[40 hex characters]
 */
export const generateRandomAddress = (): string => {
  const chars = '0123456789abcdef';
  let randomHex = '0x';
  for (let i = 0; i < 40; i++) {
    randomHex += chars[Math.floor(Math.random() * chars.length)];
  }
  return randomHex;
};

/**
 * Validates if a string is a valid Ethereum address format
 * @param address Address to validate
 * @returns true if valid format (0x + 40 hex chars)
 */
export const isValidAddressFormat = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

