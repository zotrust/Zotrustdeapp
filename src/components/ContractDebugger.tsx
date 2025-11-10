import React, { useState } from 'react';
import { useZotrustContract } from '../hooks/useZotrustContract';
import { motion } from 'framer-motion';

const ContractDebugger: React.FC = () => {
  const { debugContract, quickCheck, testFunction } = useZotrustContract();
  const [isDebugging, setIsDebugging] = useState(false);
  const [debugResults, setDebugResults] = useState<string[]>([]);

  const runFullDebug = async () => {
    setIsDebugging(true);
    setDebugResults([]);
    
    // Capture console output
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    const logs: string[] = [];
    
    console.log = (...args) => {
      logs.push(`✅ ${args.join(' ')}`);
      originalLog(...args);
    };
    
    console.error = (...args) => {
      logs.push(`❌ ${args.join(' ')}`);
      originalError(...args);
    };
    
    console.warn = (...args) => {
      logs.push(`⚠️ ${args.join(' ')}`);
      originalWarn(...args);
    };

    try {
      await debugContract();
      setDebugResults(logs);
    } catch (error) {
      setDebugResults([...logs, `❌ Debug failed: ${error}`]);
    } finally {
      // Restore original console functions
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      setIsDebugging(false);
    }
  };

  const runQuickCheck = async () => {
    setIsDebugging(true);
    setDebugResults([]);
    
    try {
      const result = await quickCheck();
      setDebugResults([
        result ? '✅ Quick check passed' : '❌ Quick check failed',
        'Check console for detailed output'
      ]);
    } catch (error) {
      setDebugResults([`❌ Quick check error: ${error}`]);
    } finally {
      setIsDebugging(false);
    }
  };

  const testAdminFunction = async () => {
    setIsDebugging(true);
    setDebugResults([]);
    
    try {
      const result = await testFunction('admin');
      setDebugResults([`✅ Admin address: ${result}`]);
    } catch (error) {
      setDebugResults([`❌ Admin test failed: ${error}`]);
    } finally {
      setIsDebugging(false);
    }
  };

  const testTradeCounter = async () => {
    setIsDebugging(true);
    setDebugResults([]);
    
    try {
      const result = await testFunction('tradeCounter');
      setDebugResults([`✅ Trade counter: ${result.toString()}`]);
    } catch (error) {
      setDebugResults([`❌ Trade counter test failed: ${error}`]);
    } finally {
      setIsDebugging(false);
    }
  };

  const verifyContract = async () => {
    setIsDebugging(true);
    setDebugResults([]);
    
    try {
      const { verifyContractDeployment } = await import('../utils/contractDebugger');
      await verifyContractDeployment();
      setDebugResults(['✅ Contract verification complete - check console for details']);
    } catch (error) {
      setDebugResults([`❌ Contract verification failed: ${error}`]);
    } finally {
      setIsDebugging(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black/90 backdrop-blur-lg rounded-lg p-4 border border-white/20 max-w-md"
      >
        <h3 className="text-white font-bold mb-3">🔍 Contract Debugger</h3>
        
        <div className="space-y-2">
          <button
            onClick={runFullDebug}
            disabled={isDebugging}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
          >
            {isDebugging ? '🔄 Running...' : '🔍 Full Debug'}
          </button>
          
          <button
            onClick={runQuickCheck}
            disabled={isDebugging}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
          >
            {isDebugging ? '🔄 Checking...' : '⚡ Quick Check'}
          </button>
          
          <button
            onClick={testAdminFunction}
            disabled={isDebugging}
            className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-500 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
          >
            {isDebugging ? '🔄 Testing...' : '👤 Test Admin'}
          </button>
          
          <button
            onClick={testTradeCounter}
            disabled={isDebugging}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-500 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
          >
            {isDebugging ? '🔄 Testing...' : '🔢 Test Counter'}
          </button>
          
          <button
            onClick={verifyContract}
            disabled={isDebugging}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-500 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
          >
            {isDebugging ? '🔄 Verifying...' : '🔍 Verify Contract'}
          </button>
        </div>

        {debugResults.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto">
            <div className="text-xs text-gray-300 space-y-1">
              {debugResults.map((result, index) => (
                <div key={index} className="break-words">
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="mt-3 text-xs text-gray-400">
          💡 Check browser console for detailed output
        </div>
      </motion.div>
    </div>
  );
};

export default ContractDebugger;
