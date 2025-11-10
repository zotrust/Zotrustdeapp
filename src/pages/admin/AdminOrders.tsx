import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Search, 
  Eye, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Order {
  id: string;
  ad_id: string;
  ad_type: string;
  buyer_address: string;
  seller_address: string;
  amount: string;
  token: string;
  price_inr: string;
  state: string;
  agent_branch: string;
  agent_number: string;
  agent_address: string;
  created_at: string;
  accepted_at: string;
  lock_expires_at: string;
  tx_hash: string;
  ad_owner_address: string;
  buyer_name: string;
  buyer_mobile: string;
  seller_name: string;
  seller_mobile: string;
  agent_mobile: string;
  location_city: string;
  location_state: string;
  location_country: string;
  buyer_confirmed_at: string;
  seller_confirmed_at: string;
  buyer_confirmed: boolean;
  seller_confirmed: boolean;
  blockchain_trade_id: number;
  create_trade_tx_hash: string;
  payment_confirmation_id: string;
  dispute_id: string;
  appeal_deadline: string;
  resolution_deadline: string;
  dispute_status: string;
  dispute_created_at: string;
  appeal_status: string;
  appeal_created_at: string;
}

const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [adminStats, setAdminStats] = useState({
    totalTransactionsToday: 0,
    totalAmountToday: 0,
    totalAdminFees: 0,
    totalReleasedAmount: 0,
    totalTokensReleased: 0,
    totalTokensToAdmin: 0,
    totalTokensToSellers: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    filterOrders();
    calculateAdminStats();
  }, [orders, searchTerm, statusFilter]);

  const calculateAdminStats = () => {
    const today = new Date().toDateString();
    const todayOrders = orders.filter(order => 
      new Date(order.created_at).toDateString() === today
    );
    
    const releasedOrders = orders.filter(order => order.state === 'RELEASED');
    
    let totalTransactionsToday = todayOrders.length;
    let totalAmountToday = 0;
    let totalAdminFees = 0;
    let totalReleasedAmount = 0;
    let totalTokensReleased = 0;
    let totalTokensToAdmin = 0;
    let totalTokensToSellers = 0;
    
    // Calculate today's stats
    todayOrders.forEach(order => {
      const amount = parseFloat(order.amount);
      totalAmountToday += amount;
    });
    
    // Calculate released orders stats
    releasedOrders.forEach(order => {
      const amount = parseFloat(order.amount);
      const priceInr = parseFloat(order.price_inr);
      const totalValue = amount * priceInr;
      const adminFee = totalValue * 0.018; // 1.8% admin fee
      const releasedAmount = totalValue - adminFee;
      
      // Token calculations
      const tokensToAdmin = amount * 0.018; // 1.8% of tokens to admin
      const tokensToSellers = amount - tokensToAdmin; // 98.2% to sellers
      
      totalAdminFees += adminFee;
      totalReleasedAmount += releasedAmount;
      totalTokensReleased += amount;
      totalTokensToAdmin += tokensToAdmin;
      totalTokensToSellers += tokensToSellers;
    });
    
    setAdminStats({
      totalTransactionsToday,
      totalAmountToday,
      totalAdminFees,
      totalReleasedAmount,
      totalTokensReleased,
      totalTokensToAdmin,
      totalTokensToSellers
    });
  };

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        navigate('/admin/login');
        return;
      }

      const response = await fetch('/api/admin/orders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data.data);
      } else if (response.status === 401) {
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
      } else {
        toast.error('Failed to load orders');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = orders;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order => 
        order.id.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.buyer_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.seller_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.agent_branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.seller_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.state === statusFilter);
    }

    setFilteredOrders(filtered);
  };

  const getStatusColor = (state: string) => {
    switch (state) {
      case 'CREATED': return 'text-blue-400 bg-blue-500/10';
      case 'ACCEPTED': return 'text-yellow-400 bg-yellow-500/10';
      case 'LOCKED': return 'text-orange-400 bg-orange-500/10';
      case 'RELEASED': return 'text-green-400 bg-green-500/10';
      case 'CANCELLED': return 'text-red-400 bg-red-500/10';
      case 'EXPIRED': return 'text-gray-400 bg-gray-500/10';
      case 'UNDER_DISPUTE': return 'text-purple-400 bg-purple-500/10';
      case 'REFUNDED': return 'text-pink-400 bg-pink-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
  };

  const getStatusIcon = (state: string) => {
    switch (state) {
      case 'CREATED': return <Clock size={16} />;
      case 'ACCEPTED': return <CheckCircle size={16} />;
      case 'LOCKED': return <AlertTriangle size={16} />;
      case 'RELEASED': return <CheckCircle size={16} />;
      case 'CANCELLED': return <XCircle size={16} />;
      case 'EXPIRED': return <XCircle size={16} />;
      case 'UNDER_DISPUTE': return <AlertTriangle size={16} />;
      case 'REFUNDED': return <DollarSign size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowModal(true);
  };

  const handleManualRefund = async (orderId: string) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/orders/${orderId}/manual-refund`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Manual refund initiated');
        fetchOrders();
        setShowModal(false);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to initiate refund');
      }
    } catch (error) {
      console.error('Error initiating manual refund:', error);
      toast.error('Failed to initiate refund');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
        {/* Admin Statistics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Today's Transactions</p>
                <p className="text-2xl font-bold">{adminStats.totalTransactionsToday}</p>
              </div>
              <DollarSign size={24} className="text-blue-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Total Tokens Released</p>
                <p className="text-2xl font-bold">{adminStats.totalTokensReleased.toFixed(6)} TBNB</p>
              </div>
              <DollarSign size={24} className="text-green-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Admin Wallet (1.8%)</p>
                <p className="text-2xl font-bold">{adminStats.totalTokensToAdmin.toFixed(6)} TBNB</p>
                <p className="text-purple-200 text-xs">₹{adminStats.totalAdminFees.toFixed(2)}</p>
              </div>
              <DollarSign size={24} className="text-purple-200" />
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Released to Sellers</p>
                <p className="text-2xl font-bold">{adminStats.totalTokensToSellers.toFixed(6)} TBNB</p>
                <p className="text-orange-200 text-xs">₹{adminStats.totalReleasedAmount.toFixed(2)}</p>
              </div>
              <DollarSign size={24} className="text-orange-200" />
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex justify-end mb-6">
          <button
            onClick={fetchOrders}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by ID, address, or agent..."
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status Filter</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="CREATED">Created</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="LOCKED">Locked</option>
                <option value="RELEASED">Released</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
                <option value="UNDER_DISPUTE">Under Dispute</option>
                <option value="REFUNDED">Refunded</option>
              </select>
            </div>
            <div className="flex items-end">
              <div className="text-sm text-gray-400">
                Showing {filteredOrders.length} of {orders.length} orders
              </div>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Buyer</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Seller</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Agent</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredOrders.map((order, index) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-mono">
                      #{order.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.ad_type === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {order.ad_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      <div>
                        <div className="font-medium">{order.amount} {order.token}</div>
                        <div className="text-xs text-gray-400">₹{parseFloat(order.price_inr).toFixed(2)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div>
                        <div className="font-medium">{order.buyer_name || 'Unknown'}</div>
                        <div className="text-xs text-gray-400">{order.buyer_mobile || 'No mobile'}</div>
                        <div className="text-xs text-gray-500 font-mono">{order.buyer_address.slice(0, 8)}...{order.buyer_address.slice(-6)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div>
                        <div className="font-medium">{order.seller_name || 'Unknown'}</div>
                        <div className="text-xs text-gray-400">{order.seller_mobile || 'No mobile'}</div>
                        <div className="text-xs text-gray-500 font-mono">{order.seller_address.slice(0, 8)}...{order.seller_address.slice(-6)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.state)}`}>
                        {getStatusIcon(order.state)}
                        <span className="ml-1">{order.state}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div>
                        <div className="font-medium">{order.agent_branch}</div>
                        <div className="text-xs text-gray-400">{order.agent_mobile}</div>
                        <div className="text-xs text-gray-500">{order.location_city}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleViewOrder(order)}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Order Details Modal */}
        {showModal && selectedOrder && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Order Details</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300">Order ID</label>
                    <p className="text-white font-mono">#{selectedOrder.id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">Status</label>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.state)}`}>
                      {getStatusIcon(selectedOrder.state)}
                      <span className="ml-1">{selectedOrder.state}</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300">Amount</label>
                    <p className="text-white">{selectedOrder.amount} {selectedOrder.token}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">Price (INR)</label>
                    <p className="text-white">₹{selectedOrder.price_inr}</p>
                  </div>
                </div>

                {/* Buyer Information */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <h4 className="text-blue-300 font-medium mb-2">Buyer Information</h4>
                  <div className="space-y-1">
                    <p className="text-white"><span className="text-gray-400">Name:</span> {selectedOrder.buyer_name || 'Unknown'}</p>
                    <p className="text-white"><span className="text-gray-400">Mobile:</span> {selectedOrder.buyer_mobile || 'No mobile'}</p>
                    <p className="text-white font-mono text-sm"><span className="text-gray-400">Address:</span> {selectedOrder.buyer_address}</p>
                  </div>
                </div>

                {/* Seller Information */}
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <h4 className="text-green-300 font-medium mb-2">Seller Information</h4>
                  <div className="space-y-1">
                    <p className="text-white"><span className="text-gray-400">Name:</span> {selectedOrder.seller_name || 'Unknown'}</p>
                    <p className="text-white"><span className="text-gray-400">Mobile:</span> {selectedOrder.seller_mobile || 'No mobile'}</p>
                    <p className="text-white font-mono text-sm"><span className="text-gray-400">Address:</span> {selectedOrder.seller_address}</p>
                  </div>
                </div>

                {/* Agent Information */}
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                  <h4 className="text-purple-300 font-medium mb-2">Agent Information</h4>
                  <div className="space-y-1">
                    <p className="text-white"><span className="text-gray-400">Branch:</span> {selectedOrder.agent_branch}</p>
                    <p className="text-white"><span className="text-gray-400">Mobile:</span> {selectedOrder.agent_mobile}</p>
                    <p className="text-white"><span className="text-gray-400">Address:</span> {selectedOrder.agent_address}</p>
                    <p className="text-white"><span className="text-gray-400">Location:</span> {selectedOrder.location_city}, {selectedOrder.location_state}, {selectedOrder.location_country}</p>
                  </div>
                </div>

                {/* Transaction Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300">Created At</label>
                    <p className="text-white">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">Accepted At</label>
                    <p className="text-white">{selectedOrder.accepted_at ? new Date(selectedOrder.accepted_at).toLocaleString() : 'N/A'}</p>
                  </div>
                </div>

                {/* Payment Confirmations */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300">Buyer Confirmed</label>
                    <p className="text-white">{selectedOrder.buyer_confirmed ? '✅ Yes' : '❌ No'}</p>
                    {selectedOrder.buyer_confirmed_at && (
                      <p className="text-gray-400 text-xs">{new Date(selectedOrder.buyer_confirmed_at).toLocaleString()}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300">Seller Confirmed</label>
                    <p className="text-white">{selectedOrder.seller_confirmed ? '✅ Yes' : '❌ No'}</p>
                    {selectedOrder.seller_confirmed_at && (
                      <p className="text-gray-400 text-xs">{new Date(selectedOrder.seller_confirmed_at).toLocaleString()}</p>
                    )}
                  </div>
                </div>

                {/* Financial Details */}
                {selectedOrder.state === 'RELEASED' && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                    <h4 className="text-orange-300 font-medium mb-2">Financial Breakdown</h4>
                    <div className="space-y-3">
                      <div className="bg-white/5 rounded-lg p-3">
                        <h5 className="text-white font-medium mb-2">Token Distribution</h5>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Total Tokens:</span>
                            <span className="text-white font-mono">{parseFloat(selectedOrder.amount).toFixed(6)} TBNB</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Admin Wallet (1.8%):</span>
                            <span className="text-orange-400 font-mono">{(parseFloat(selectedOrder.amount) * 0.018).toFixed(6)} TBNB</span>
                          </div>
                          <div className="flex justify-between border-t border-orange-500/20 pt-2">
                            <span className="text-gray-400 font-medium">Released to Seller:</span>
                            <span className="text-green-400 font-medium font-mono">{(parseFloat(selectedOrder.amount) * 0.982).toFixed(6)} TBNB</span>
                          </div>
                        </div>
                      </div>
        
                  
                    </div>
                  </div>
                )}

                {/* Blockchain Details */}
                {selectedOrder.tx_hash && (
                  <div>
                    <label className="text-sm font-medium text-gray-300">Transaction Hash</label>
                    <p className="text-white font-mono text-sm break-all">{selectedOrder.tx_hash}</p>
                    {selectedOrder.blockchain_trade_id && (
                      <p className="text-gray-400 text-xs mt-1">Trade ID: {selectedOrder.blockchain_trade_id}</p>
                    )}
                  </div>
                )}

                {/* Manual Refund Button */}
                {['LOCKED', 'UNDER_DISPUTE'].includes(selectedOrder.state) && (
                  <div className="pt-4 border-t border-white/20">
                    <button
                      onClick={() => handleManualRefund(selectedOrder.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      Initiate Manual Refund
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
    </div>
  );
};

export default AdminOrders;
