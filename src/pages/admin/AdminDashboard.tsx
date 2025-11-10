import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  ShoppingCart, 
  CreditCard, 
  Gavel, 
  MapPin, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalOrders: number;
  totalTransactions: number;
  totalDisputes: number;
  totalAgents: number;
  totalLocations: number;
  pendingDisputes: number;
  completedOrders: number;
  totalVolume: number;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    totalTransactions: 0,
    totalDisputes: 0,
    totalAgents: 0,
    totalLocations: 0,
    pendingDisputes: 0,
    completedOrders: 0,
    totalVolume: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      console.log('AdminDashboard - Token from localStorage:', token);
      
      if (!token) {
        navigate('/admin/login');
        return;
      }

      console.log('AdminDashboard - Making request to /api/admin/dashboard-stats');
      const response = await fetch('/api/admin/dashboard-stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      } else if (response.status === 401) {
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
      } else {
        toast.error('Failed to load dashboard stats');
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Failed to load dashboard stats');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
    toast.success('Logged out successfully');
  };

  const statCards = [
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: ShoppingCart,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-400'
    },
    {
      title: 'Total Transactions',
      value: stats.totalTransactions,
      icon: CreditCard,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400'
    },
    {
      title: 'Active Disputes',
      value: stats.totalDisputes,
      icon: Gavel,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-500/10',
      textColor: 'text-orange-400'
    },
    {
      title: 'Pending Disputes',
      value: stats.pendingDisputes,
      icon: AlertTriangle,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-400'
    },
    {
      title: 'Total Agents',
      value: stats.totalAgents,
      icon: Users,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/10',
      textColor: 'text-purple-400'
    },
    {
      title: 'Total Locations',
      value: stats.totalLocations,
      icon: MapPin,
      color: 'from-indigo-500 to-indigo-600',
      bgColor: 'bg-indigo-500/10',
      textColor: 'text-indigo-400'
    },
    {
      title: 'Completed Orders',
      value: stats.completedOrders,
      icon: CheckCircle,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-500/10',
      textColor: 'text-emerald-400'
    },
    {
      title: 'Total Volume',
      value: `$${stats.totalVolume.toLocaleString()}`,
      icon: DollarSign,
      color: 'from-yellow-500 to-yellow-600',
      bgColor: 'bg-yellow-500/10',
      textColor: 'text-yellow-400'
    }
  ];

  const quickActions = [
    {
      title: 'Manage Orders',
      description: 'View and manage all orders',
      icon: ShoppingCart,
      color: 'from-blue-500 to-blue-600',
      onClick: () => navigate('/admin/orders')
    },
    {
      title: 'View Transactions',
      description: 'Monitor all transactions',
      icon: CreditCard,
      color: 'from-green-500 to-green-600',
      onClick: () => navigate('/admin/transactions')
    },
    {
      title: 'Resolve Disputes',
      description: 'Handle dispute cases',
      icon: Gavel,
      color: 'from-orange-500 to-orange-600',
      onClick: () => navigate('/admin/disputes')
    },
    {
      title: 'Manage Agents',
      description: 'Add and manage agents',
      icon: Users,
      color: 'from-purple-500 to-purple-600',
      onClick: () => navigate('/admin/agents')
    },
    {
      title: 'Manage Locations',
      description: 'Add and manage locations',
      icon: MapPin,
      color: 'from-indigo-500 to-indigo-600',
      onClick: () => navigate('/admin/locations')
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-300 text-sm font-medium">{stat.title}</p>
                  <p className="text-2xl font-bold text-white mt-2">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action, index) => (
              <motion.button
                key={action.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={action.onClick}
                className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg p-4 text-left transition-all duration-300 group"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${action.color} flex items-center justify-center`}>
                    <action.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium group-hover:text-white/90">{action.title}</h3>
                    <p className="text-gray-400 text-sm">{action.description}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
    </div>
  );
};

export default AdminDashboard;
