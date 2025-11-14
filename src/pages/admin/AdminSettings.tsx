import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Save, 
  RefreshCw,
  Wallet,
  DollarSign,
  Clock,
  Shield,
  AlertCircle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AppSetting {
  key: string;
  value: string;
  description?: string;
}

interface TradingHours {
  buyEnabled: boolean;
  sellEnabled: boolean;
  startTime: string;
  endTime: string;
}

const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feeWallet, setFeeWallet] = useState('');
  const [tradingHours, setTradingHours] = useState<TradingHours>({
    buyEnabled: true,
    sellEnabled: true,
    startTime: '09:00',
    endTime: '18:00'
  });
  const [isSavingTradingHours, setIsSavingTradingHours] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSettings();
    fetchTradingHours();
  }, []);

  const fetchTradingHours = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      const response = await fetch('/api/admin/trading-hours', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setTradingHours(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching trading hours:', error);
    }
  };

  const handleSaveTradingHours = async () => {
    setIsSavingTradingHours(true);
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        navigate('/admin/login');
        return;
      }

      const response = await fetch('/api/admin/trading-hours', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tradingHours)
      });

      if (response.ok) {
        toast.success('Trading hours updated successfully');
        fetchTradingHours();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update trading hours');
      }
    } catch (error) {
      console.error('Error updating trading hours:', error);
      toast.error('Failed to update trading hours');
    } finally {
      setIsSavingTradingHours(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        navigate('/admin/login');
        return;
      }

      const response = await fetch('/api/admin/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Ensure data.data is an array
        const settingsArray = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
        setSettings(settingsArray);
        
        // Set fee wallet from settings
        const feeWalletSetting = settingsArray.find((s: AppSetting) => s.key === 'admin_fee_wallet');
        if (feeWalletSetting) {
          setFeeWallet(feeWalletSetting.value || '');
        }
      } else if (response.status === 401) {
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
      } else {
        toast.error('Failed to load settings');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveFeeWallet = async () => {
    if (!feeWallet.trim()) {
      toast.error('Please enter a valid wallet address');
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/set-fee-wallet', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address: feeWallet })
      });

      if (response.ok) {
        toast.success('Fee wallet updated successfully');
        fetchSettings(); // Refresh settings
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update fee wallet');
      }
    } catch (error) {
      console.error('Error updating fee wallet:', error);
      toast.error('Failed to update fee wallet');
    } finally {
      setIsSaving(false);
    }
  };

  const getSettingValue = (key: string) => {
    const setting = settings.find(s => s.key === key);
    return setting?.value || '';
  };

  const getSettingDescription = (key: string) => {
    const descriptions: { [key: string]: string } = {
      'admin_fee_wallet': 'Wallet address where admin fees are collected',
      'buyer_fee_percent': 'Percentage fee charged to buyers (as decimal, e.g., 0.01 for 1%)',
      'seller_fee_percent': 'Percentage fee charged to sellers (as decimal, e.g., 0.01 for 1%)',
      'accept_timeout_minutes': 'Time in minutes for order acceptance timeout',
      'lock_duration_hours': 'Duration in hours for fund lock period'
    };
    return descriptions[key] || 'Application setting';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">App Settings</h1>
            <p className="text-gray-400">Manage application configuration</p>
          </div>
        </div>
        <button
          onClick={fetchSettings}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
        >
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Trading Hours Section */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <Clock className="w-6 h-6 text-yellow-400" />
          <h2 className="text-xl font-semibold text-white">Trading Hours Configuration</h2>
        </div>
        
        <div className="space-y-6">
          {/* Enable/Disable Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Buy Trading Toggle */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-white">BUY Trading</label>
                <button
                  onClick={() => setTradingHours({...tradingHours, buyEnabled: !tradingHours.buyEnabled})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    tradingHours.buyEnabled ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      tradingHours.buyEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-gray-400">
                {tradingHours.buyEnabled ? 'BUY trading is enabled' : 'BUY trading is disabled'}
              </p>
            </div>

            {/* Sell Trading Toggle */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-white">SELL Trading</label>
                <button
                  onClick={() => setTradingHours({...tradingHours, sellEnabled: !tradingHours.sellEnabled})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    tradingHours.sellEnabled ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      tradingHours.sellEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-gray-400">
                {tradingHours.sellEnabled ? 'SELL trading is enabled' : 'SELL trading is disabled'}
              </p>
            </div>
          </div>

          {/* Trading Hours Time Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Start Time (IST)
              </label>
              <input
                type="time"
                value={tradingHours.startTime}
                onChange={(e) => setTradingHours({...tradingHours, startTime: e.target.value})}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <p className="text-xs text-gray-400 mt-1">Trading start time in 24-hour format</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                End Time (IST)
              </label>
              <input
                type="time"
                value={tradingHours.endTime}
                onChange={(e) => setTradingHours({...tradingHours, endTime: e.target.value})}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <p className="text-xs text-gray-400 mt-1">Trading end time in 24-hour format</p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveTradingHours}
              disabled={isSavingTradingHours}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              {isSavingTradingHours ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              <span>{isSavingTradingHours ? 'Saving...' : 'Save Trading Hours'}</span>
            </button>
          </div>

          {/* Current Status Display */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-sm text-blue-300">
              <strong>Current Status:</strong> Trading is {tradingHours.buyEnabled && tradingHours.sellEnabled ? 'enabled' : 'partially enabled'} from {tradingHours.startTime} to {tradingHours.endTime} IST
            </p>
          </div>
        </div>
      </div>

      {/* Fee Wallet Section */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <Wallet className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Fee Wallet Configuration</h2>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Admin Fee Wallet Address
            </label>
            <div className="flex space-x-3">
              <input
                type="text"
                value={feeWallet}
                onChange={(e) => setFeeWallet(e.target.value)}
                placeholder="0x..."
                className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSaveFeeWallet}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                {isSaving ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {getSettingDescription('admin_fee_wallet')}
            </p>
          </div>
        </div>
      </div>

      {/* Application Settings */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-semibold text-white flex items-center space-x-2">
            <Shield className="w-6 h-6 text-green-400" />
            <span>Application Settings</span>
          </h2>
        </div>
        
        <div className="divide-y divide-white/10">
          {Array.isArray(settings) && settings.map((setting, index) => (
            <motion.div
              key={setting.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="px-6 py-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-sm font-medium text-white capitalize">
                      {setting.key.replace(/_/g, ' ')}
                    </h3>
                    {setting.key === 'admin_fee_wallet' && (
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full">
                        Editable
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mb-2">
                    {getSettingDescription(setting.key)}
                  </p>
                  <div className="bg-white/5 rounded-lg p-3">
                    <code className="text-sm text-gray-300 break-all">
                      {setting.value || 'Not set'}
                    </code>
                  </div>
                </div>
                <div className="ml-4 flex items-center space-x-2">
                  {setting.key === 'admin_fee_wallet' ? (
                    <div className="flex items-center space-x-1 text-green-400">
                      <DollarSign size={14} />
                      <span className="text-xs">Fee Collection</span>
                    </div>
                  ) : setting.key.includes('fee') ? (
                    <div className="flex items-center space-x-1 text-yellow-400">
                      <DollarSign size={14} />
                      <span className="text-xs">Fee Rate</span>
                    </div>
                  ) : setting.key.includes('timeout') || setting.key.includes('duration') ? (
                    <div className="flex items-center space-x-1 text-blue-400">
                      <Clock size={14} />
                      <span className="text-xs">Timing</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-gray-400">
                      <Settings size={14} />
                      <span className="text-xs">Config</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {settings.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No settings found</p>
            <p className="text-gray-500 text-sm mt-2">
              Settings will appear here once they are configured
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
