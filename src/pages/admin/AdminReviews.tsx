import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Star, 
  Eye, 
  EyeOff, 
  Check, 
  Trash2, 
  RefreshCw,
  MessageSquare,
  User,
  Filter,
  Search,
  Edit,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Review {
  id: number;
  reviewer_address: string;
  reviewee_address: string;
  reviewer_name: string;
  reviewee_name: string;
  order_id: number | null;
  rating: number;
  message?: string;
  comment?: string;
  is_visible: boolean;
  is_approved: boolean;
  created_at: string;
  approved_at: string | null;
  approved_by_username: string | null;
  amount: number | null;
  token: string | null;
  order_state: string | null;
}

const AdminReviews: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filteredReviews, setFilteredReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editFormData, setEditFormData] = useState({
    reviewer_address: '',
    reviewee_address: '',
    reviewer_name: '',
    reviewee_name: '',
    rating: 5,
    comment: '',
    is_visible: true,
    is_approved: false,
    order_id: null as number | null
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchReviews();
  }, []);

  useEffect(() => {
    filterReviews();
  }, [reviews, searchTerm, statusFilter]);

  const fetchReviews = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        navigate('/admin/login');
        return;
      }

      const response = await fetch('/api/admin/reviews', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReviews(data.data);
      } else if (response.status === 401) {
        localStorage.removeItem('adminToken');
        navigate('/admin/login');
      } else {
        toast.error('Failed to load reviews');
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast.error('Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  };

  const filterReviews = () => {
    let filtered = reviews;

    // Status filter
    if (statusFilter === 'pending') {
      filtered = filtered.filter(review => !review.is_approved);
    } else if (statusFilter === 'approved') {
      filtered = filtered.filter(review => review.is_approved);
    } else if (statusFilter === 'hidden') {
      filtered = filtered.filter(review => !review.is_visible);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(review => 
        review.reviewer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.reviewee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (review.message || review.comment || '')?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.reviewer_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.reviewee_address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredReviews(filtered);
  };

  const handleApproveReview = async (reviewId: number) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/reviews/${reviewId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Review approved successfully');
        fetchReviews();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to approve review');
      }
    } catch (error) {
      console.error('Error approving review:', error);
      toast.error('Failed to approve review');
    }
  };

  const handleToggleVisibility = async (reviewId: number) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/reviews/${reviewId}/toggle-visibility`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchReviews();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to toggle visibility');
      }
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to toggle visibility');
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Review deleted successfully');
        fetchReviews();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete review');
      }
    } catch (error) {
      console.error('Error deleting review:', error);
      toast.error('Failed to delete review');
    }
  };

  const handleEditReview = (review: Review) => {
    setEditingReview(review);
    setEditFormData({
      reviewer_address: review.reviewer_address,
      reviewee_address: review.reviewee_address,
      reviewer_name: review.reviewer_name || '',
      reviewee_name: review.reviewee_name || '',
      rating: review.rating,
      comment: review.comment || review.message || '',
      is_visible: review.is_visible,
      is_approved: review.is_approved,
      order_id: review.order_id
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateReview = async () => {
    if (!editingReview) return;

    setIsUpdating(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`/api/admin/reviews/${editingReview.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editFormData)
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Review updated successfully');
        setIsEditModalOpen(false);
        setEditingReview(null);
        fetchReviews();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update review');
      }
    } catch (error) {
      console.error('Error updating review:', error);
      toast.error('Failed to update review');
    } finally {
      setIsUpdating(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={16}
        className={i < rating ? 'text-yellow-400 fill-current' : 'text-gray-400'}
      />
    ));
  };

  const getStatusBadge = (review: Review) => {
    if (!review.is_approved) {
      return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">Pending</span>;
    } else if (!review.is_visible) {
      return <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">Hidden</span>;
    } else {
      return <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Approved</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading reviews...</p>
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
            <Star className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Reviews Management</h1>
            <p className="text-gray-400">Manage user reviews and ratings</p>
          </div>
        </div>
        <button
          onClick={fetchReviews}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
        >
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reviews by user, message, or address..."
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Reviews</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Review Details
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Order Info
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredReviews.map((review, index) => (
                <motion.tr
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-white/5 transition-colors duration-200"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {review.reviewer_name || 'Unknown User'}
                        </div>
                        <div className="text-xs text-gray-400">
                          → {review.reviewee_name || 'Unknown User'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {review.reviewer_address.slice(0, 6)}...{review.reviewer_address.slice(-4)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-1">
                      {renderStars(review.rating)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {review.rating}/5 stars
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-300 max-w-xs">
                      {review.comment || review.message || (
                        <span className="text-gray-500 italic">No message</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-300">
                      {review.order_id ? (
                        <>
                          <div className="font-medium">Order #{review.order_id}</div>
                          {review.amount && review.token && (
                            <div className="text-xs text-gray-400">
                              {review.amount} {review.token}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-gray-500 italic">No order</div>
                      )}
                      <div className="text-xs text-gray-500">
                        {new Date(review.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(review)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={() => handleEditReview(review)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center space-x-1"
                        title="Edit Review"
                      >
                        <Edit size={12} />
                        <span>Edit</span>
                      </button>
                      {!review.is_approved && (
                        <button
                          onClick={() => handleApproveReview(review.id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center space-x-1"
                        >
                          <Check size={12} />
                          <span>Approve</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleVisibility(review.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center space-x-1 ${
                          review.is_visible 
                            ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        {review.is_visible ? <EyeOff size={12} /> : <Eye size={12} />}
                        <span>{review.is_visible ? 'Hide' : 'Show'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteReview(review.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center space-x-1"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredReviews.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No reviews found</p>
            <p className="text-gray-500 text-sm mt-2">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria' 
                : 'Reviews will appear here once users start leaving feedback'
              }
            </p>
          </div>
        )}
      </div>

      {/* Edit Review Modal */}
      {isEditModalOpen && editingReview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800 rounded-xl border border-white/20 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Edit Review</h2>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingReview(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Reviewer Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reviewer Name
                </label>
                <input
                  type="text"
                  value={editFormData.reviewer_name}
                  onChange={(e) => setEditFormData({ ...editFormData, reviewer_name: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter reviewer name"
                />
              </div>

              {/* Reviewer Address */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reviewer Address
                </label>
                <input
                  type="text"
                  value={editFormData.reviewer_address}
                  onChange={(e) => setEditFormData({ ...editFormData, reviewer_address: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0x..."
                />
              </div>

              {/* Reviewee Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reviewee Name
                </label>
                <input
                  type="text"
                  value={editFormData.reviewee_name}
                  onChange={(e) => setEditFormData({ ...editFormData, reviewee_name: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter reviewee name"
                />
              </div>

              {/* Reviewee Address */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reviewee Address
                </label>
                <input
                  type="text"
                  value={editFormData.reviewee_address}
                  onChange={(e) => setEditFormData({ ...editFormData, reviewee_address: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0x..."
                />
              </div>

              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rating (1-5)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={editFormData.rating}
                    onChange={(e) => setEditFormData({ ...editFormData, rating: parseInt(e.target.value) || 5 })}
                    className="w-20 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={20}
                        className={i < editFormData.rating ? 'text-yellow-400 fill-current' : 'text-gray-400'}
                        onClick={() => setEditFormData({ ...editFormData, rating: i + 1 })}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Comment
                </label>
                <textarea
                  value={editFormData.comment}
                  onChange={(e) => setEditFormData({ ...editFormData, comment: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  placeholder="Review comment..."
                />
              </div>

              {/* Order ID */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Order ID (optional)
                </label>
                <input
                  type="number"
                  value={editFormData.order_id || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, order_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Order ID"
                />
              </div>

              {/* Checkboxes */}
              <div className="flex flex-col space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.is_visible}
                    onChange={(e) => setEditFormData({ ...editFormData, is_visible: e.target.checked })}
                    className="w-5 h-5 rounded bg-white/10 border-white/20 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-gray-300">Visible</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.is_approved}
                    onChange={(e) => setEditFormData({ ...editFormData, is_approved: e.target.checked })}
                    className="w-5 h-5 rounded bg-white/10 border-white/20 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-gray-300">Approved</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingReview(null);
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateReview}
                disabled={isUpdating}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Update Review</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminReviews;
