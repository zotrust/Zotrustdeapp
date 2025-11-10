import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle, XCircle, FileText, Video, Upload } from 'lucide-react';

interface DisputeResolutionProps {
  orderId: string;
  userRole: 'BUYER' | 'SELLER';
  orderState: string;
  timeRemaining: number;
  appealTimeRemaining: number;
  confirmations: {
    buyer_confirmed: boolean;
    seller_confirmed: boolean;
    buyer_confirmed_at: string | null;
    seller_confirmed_at: string | null;
  } | null;
  dispute: {
    id: number;
    dispute_type: string;
    status: string;
    created_at: string;
  } | null;
  appeals: Array<{
    id: number;
    appellant_type: string;
    description: string;
    evidence_video_url: string | null;
    evidence_screenshots: string[] | null;
    created_at: string;
  }>;
  onConfirmPayment: (orderId: string, type: 'SENT' | 'RECEIVED') => Promise<void>;
  onFileAppeal: (orderId: string, data: AppealData) => Promise<void>;
}

interface AppealData {
  dispute_type: string;
  description: string;
  evidence_video_url?: string;
  evidence_screenshots?: string[];
  evidence_documents?: string[];
}

const DisputeResolution: React.FC<DisputeResolutionProps> = ({
  orderId,
  userRole,
  orderState,
  timeRemaining,
  appealTimeRemaining,
  confirmations,
  dispute,
  appeals,
  onConfirmPayment,
  onFileAppeal
}) => {
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealData, setAppealData] = useState<AppealData>({
    dispute_type: 'PAYMENT_NOT_RECEIVED',
    description: '',
    evidence_video_url: '',
    evidence_screenshots: [],
    evidence_documents: []
  });

  const formatTime = (milliseconds: number) => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const getPhase = () => {
    if (orderState === 'LOCKED' && timeRemaining > 0) {
      return 'PHASE_1';
    } else if (orderState === 'UNDER_DISPUTE' && appealTimeRemaining > 0) {
      return 'PHASE_2';
    } else if (orderState === 'UNDER_REVIEW') {
      return 'PHASE_3';
    } else if (orderState === 'RESOLVED' || orderState === 'RELEASED' || orderState === 'REFUNDED') {
      return 'PHASE_4';
    }
    return 'UNKNOWN';
  };

  const phase = getPhase();

  const renderPhase1 = () => (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <Clock className="h-6 w-6 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-blue-900">Phase 1: Payment Confirmation</h3>
      </div>
      
      <div className="mb-4">
        <div className="bg-white rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Time Remaining:</span>
            <span className="text-lg font-bold text-blue-600">{formatTime(timeRemaining)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${Math.max(0, (timeRemaining / (2 * 60 * 60 * 1000)) * 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4">
            <h4 className="font-semibold mb-2">Buyer Confirmation</h4>
            <div className="flex items-center mb-2">
              {confirmations?.buyer_confirmed ? (
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 mr-2" />
              )}
              <span>{confirmations?.buyer_confirmed ? 'Confirmed' : 'Pending'}</span>
            </div>
            {userRole === 'BUYER' && !confirmations?.buyer_confirmed && (
              <button
                onClick={() => onConfirmPayment(orderId, 'SENT')}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Confirm Payment Sent
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg p-4">
            <h4 className="font-semibold mb-2">Seller Confirmation</h4>
            <div className="flex items-center mb-2">
              {confirmations?.seller_confirmed ? (
                <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 mr-2" />
              )}
              <span>{confirmations?.seller_confirmed ? 'Confirmed' : 'Pending'}</span>
            </div>
            {userRole === 'SELLER' && !confirmations?.seller_confirmed && (
              <button
                onClick={() => onConfirmPayment(orderId, 'RECEIVED')}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Confirm Payment Received
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center mb-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
          <span className="font-semibold text-yellow-800">Important</span>
        </div>
        <p className="text-yellow-700 text-sm">
          Both parties must confirm within 2 hours. If not confirmed, the order will automatically move to dispute phase.
        </p>
      </div>
    </div>
  );

  const renderPhase2 = () => (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <AlertTriangle className="h-6 w-6 text-orange-600 mr-2" />
        <h3 className="text-lg font-semibold text-orange-900">Phase 2: Appeal Window</h3>
      </div>
      
      <div className="mb-4">
        <div className="bg-white rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Appeal Time Remaining:</span>
            <span className="text-lg font-bold text-orange-600">{formatTime(appealTimeRemaining)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-orange-600 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${Math.max(0, (appealTimeRemaining / (48 * 60 * 60 * 1000)) * 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <span className="font-semibold text-red-800">2 Hours Passed Without Full Confirmation</span>
          </div>
          <p className="text-red-700 text-sm">
            You have 48 hours to file an appeal if there's an issue with the payment.
          </p>
        </div>

        {!showAppealForm ? (
          <button
            onClick={() => setShowAppealForm(true)}
            className="w-full bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
          >
            File Appeal
          </button>
        ) : (
          <div className="bg-white rounded-lg p-4">
            <h4 className="font-semibold mb-4">File Appeal</h4>
            <form onSubmit={(e) => { e.preventDefault(); onFileAppeal(orderId, appealData); }}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Dispute Type</label>
                <select
                  value={appealData.dispute_type}
                  onChange={(e) => setAppealData({ ...appealData, dispute_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="PAYMENT_NOT_RECEIVED">Payment Not Received</option>
                  <option value="PAYMENT_NOT_SENT">Payment Not Sent</option>
                  <option value="OTHER">Other Issue</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={appealData.description}
                  onChange={(e) => setAppealData({ ...appealData, description: e.target.value })}
                  placeholder="Describe the issue in detail..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2 h-24"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Evidence Video URL (Optional)</label>
                <input
                  type="url"
                  value={appealData.evidence_video_url}
                  onChange={(e) => setAppealData({ ...appealData, evidence_video_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
                >
                  Submit Appeal
                </button>
                <button
                  type="button"
                  onClick={() => setShowAppealForm(false)}
                  className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {appeals.length > 0 && (
        <div className="bg-white rounded-lg p-4">
          <h4 className="font-semibold mb-2">Existing Appeals</h4>
          {appeals.map((appeal) => (
            <div key={appeal.id} className="border border-gray-200 rounded-lg p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{appeal.appellant_type} Appeal</span>
                <span className="text-sm text-gray-500">{new Date(appeal.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-700">{appeal.description}</p>
              {appeal.evidence_video_url && (
                <div className="mt-2">
                  <Video className="h-4 w-4 inline mr-1" />
                  <a href={appeal.evidence_video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm">
                    View Evidence Video
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderPhase3 = () => (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <FileText className="h-6 w-6 text-purple-600 mr-2" />
        <h3 className="text-lg font-semibold text-purple-900">Phase 3: Under Review</h3>
      </div>
      
      <div className="bg-white rounded-lg p-4">
        <div className="flex items-center mb-2">
          <Clock className="h-5 w-5 text-purple-600 mr-2" />
          <span className="font-medium">Admin is reviewing your case</span>
        </div>
        <p className="text-gray-700 text-sm">
          Your dispute is being reviewed by our admin team. You will be notified once a decision is made.
        </p>
      </div>
    </div>
  );

  const renderPhase4 = () => (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
        <h3 className="text-lg font-semibold text-green-900">Phase 4: Resolved</h3>
      </div>
      
      <div className="bg-white rounded-lg p-4">
        <div className="flex items-center mb-2">
          <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
          <span className="font-medium">Dispute Resolved</span>
        </div>
        <p className="text-gray-700 text-sm">
          The dispute has been resolved. Check your wallet for the final transaction.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {phase === 'PHASE_1' && renderPhase1()}
      {phase === 'PHASE_2' && renderPhase2()}
      {phase === 'PHASE_3' && renderPhase3()}
      {phase === 'PHASE_4' && renderPhase4()}
    </div>
  );
};

export default DisputeResolution;
