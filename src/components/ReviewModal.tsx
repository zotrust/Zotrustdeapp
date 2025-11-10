import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReviewSubmitted: () => void;
  userAddress: string;
}

const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  onReviewSubmitted,
  userAddress
}) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);


  const handleSubmitReview = async () => {
    if (rating === 0) {
      toast.error('Please provide a rating');
      return;
    }

    if (!userAddress) {
      toast.error('User address not found. Please reconnect your wallet.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('authToken') || '';

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reviewee_address: userAddress, // Review yourself
          rating: rating,
          message: message.trim() || undefined
          // No order_id for general reviews
        })
      });

      if (response.ok) {
        toast.success('Thank you for your feedback! Your review helps us improve.');
        onReviewSubmitted();
        onClose();
        // Reset form
        setRating(0);
        setMessage('');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setRating(0);
      setMessage('');
      onClose();
    }
  };

  const renderStars = (currentRating: number, onRatingChange: (rating: number) => void) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onRatingChange(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            className="focus:outline-none"
          >
            <Star
              size={32}
              className={
                star <= (hoveredRating || currentRating)
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-400'
              }
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                  <Star className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Review Our Platform</h2>
                  <p className="text-gray-400 text-sm">Share your experience with Zotrust</p>
                  <p className="text-blue-400 text-xs mt-1">
                    How was your experience on our platform?
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="p-2 rounded-lg bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>


            {/* Review Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
                {/* Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    How would you rate our platform?
                  </label>
                  <div className="flex items-center space-x-4">
                    {renderStars(rating, setRating)}
                    <span className="text-gray-400 text-sm">
                      {rating > 0 && `${rating} star${rating > 1 ? 's' : ''}`}
                    </span>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Share your feedback (optional)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about your experience with Zotrust platform..."
                    rows={4}
                    maxLength={500}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-gray-500 text-xs">
                      {message.length}/500 characters
                    </p>
                    <p className="text-gray-500 text-xs">
                      Review will be visible after admin approval
                    </p>
                  </div>
                </div>


                {/* Submit Button */}
                <div className="flex space-x-3">
                  <button
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="flex-1 py-3 px-4 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitReview}
                    disabled={isSubmitting || rating === 0}
                    className="flex-1 py-3 px-4 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-medium hover:from-yellow-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Star size={16} />
                        <span>Submit Review</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReviewModal;
