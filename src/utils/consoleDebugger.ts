import { debugSmartContract, quickContractCheck, testContractFunction, verifyContractDeployment } from './contractDebugger';

/**
 * Console Debugger - Add these functions to window for easy console access
 * Usage: Open browser console and run:
 * - window.debugContract()
 * - window.quickCheck()
 * - window.testAdmin()
 * - window.testTradeCounter()
 */

// Make debug functions available in browser console
if (typeof window !== 'undefined') {
  (window as any).debugContract = debugSmartContract;
  (window as any).quickCheck = quickContractCheck;
  (window as any).testAdmin = () => testContractFunction('admin');
  (window as any).testTradeCounter = () => testContractFunction('tradeCounter');
  (window as any).testAllowedTokens = (tokenAddress: string) => testContractFunction('allowedTokens', tokenAddress);
  (window as any).verifyContract = verifyContractDeployment;
  
  // Network switch helper via dynamic import to avoid hook usage here
  (window as any).switchToTestnet = async () => {
    const { useZotrustContract } = await import('../hooks/useZotrustContract');
    const { switchToTestnet } = useZotrustContract();
    return switchToTestnet();
  };
  
  console.log('🔍 Contract Debugger loaded!');
  console.log('💡 Available commands:');
  console.log('   window.debugContract() - Full contract debug');
  console.log('   window.quickCheck() - Quick status check');
  console.log('   window.verifyContract() - Verify contract deployment');
  console.log('   window.testAdmin() - Test admin function');
  console.log('   window.testTradeCounter() - Test trade counter');
  console.log('   window.testAllowedTokens("0x...") - Test token allowance');
  console.log('   window.switchToTestnet() - Switch wallet to BSC Testnet');
}
