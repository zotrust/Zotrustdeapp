import React, { useState, useEffect } from 'react';
import { useUserStore } from '../stores/userStore';
import { Transaction, Support } from '../types';
import { 
  CreditCard, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Phone,
  Mail,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

const Transactions: React.FC = () => {
  const { user } = useUserStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [supportContacts, setSupportContacts] = useState<Support[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.address) {
      fetchTransactions();
      fetchSupportContacts();
    }
  }, [user?.address]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/transactions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportContacts = async () => {
    try {
      const response = await fetch('/api/support');
      if (response.ok) {
        const data = await response.json();
        setSupportContacts(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching support contacts:', error);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'PENDING':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'FAILED':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'CANCELLED':
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'PENDING':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'FAILED':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'CANCELLED':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAmount = (amount: number, token: string) => {
    return `${amount.toFixed(6)} ${token}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Transaction History</h1>
          <p className="text-gray-400">View all your transaction records and support contacts</p>
        </div>

        {/* Support Contacts */}
        {supportContacts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Phone className="w-5 h-5 mr-2" />
              Support Contacts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {supportContacts.map((contact) => (
                <div key={contact.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {contact.type === 'phone' ? (
                        <Phone className="w-4 h-4 text-green-400" />
                      ) : (
                        <Mail className="w-4 h-4 text-blue-400" />
                      )}
                      <div>
                        <div className="font-medium">{contact.label || contact.type}</div>
                        <div className="text-sm text-gray-400">{contact.value}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (contact.type === 'phone') {
                          window.open(`tel:${contact.value}`);
                        } else {
                          window.open(`mailto:${contact.value}`);
                        }
                      }}
                      className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transactions */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            Your Transactions
          </h2>
          
          {transactions.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No transactions found</h3>
              <p className="text-gray-500">Your transaction history will appear here once you complete orders.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(transaction.status)}
                      <div>
                        <div className="font-medium text-lg">
                          Transaction #{transaction.transaction_number}
                        </div>
                        <div className="text-sm text-gray-400">
                          {formatDate(transaction.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </span>
                      <button
                        onClick={() => copyToClipboard(transaction.transaction_number, transaction.transaction_number)}
                        className="p-1 rounded hover:bg-gray-700 transition-colors"
                      >
                        {copiedId === transaction.transaction_number ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Amount</div>
                      <div className="font-medium">
                        {formatAmount(transaction.amount, transaction.token)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Type</div>
                      <div className="font-medium">
                        {transaction.transaction_type}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400 mb-1">Order ID</div>
                      <div className="font-medium">
                        #{transaction.order_id}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400 mb-1">Buyer</div>
                      <div className="font-mono text-xs break-all">
                        {transaction.buyer_address}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 mb-1">Seller</div>
                      <div className="font-mono text-xs break-all">
                        {transaction.seller_address}
                      </div>
                    </div>
                  </div>

                  {transaction.completed_at && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="text-sm text-gray-400">
                        Completed: {formatDate(transaction.completed_at)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Transactions;
