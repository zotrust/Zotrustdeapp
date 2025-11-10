import { useState, useEffect, useRef } from 'react';
import { Camera, Square, CheckCircle, X, Loader2, Video, AlertCircle, SquarePlay } from 'lucide-react';
import { useParams } from 'react-router-dom';

const AppealPage = () => {
  // URL params simulation (replace with actual useParams in real app)
  const { walletAddress, orderId } = useParams<{ walletAddress?: string; orderId: string }>();

  // Media states - Video
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoRecorder, setVideoRecorder] = useState<MediaRecorder | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [videoRecordingTime, setVideoRecordingTime] = useState(0);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  // Form states
  const [appealData, setAppealData] = useState({
    orderId: orderId || '',
    walletAddress: walletAddress || '',
    reason: '',
    description: 'This is Tesing 1',
    evidence: {} as { video?: Blob }
  });
  
  // UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [showAppealGuide, setShowAppealGuide] = useState(false);
  
  // Refs
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const videoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVideoRecording();
      if (videoStream) {
        videoStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    };
  }, [videoStream]);


  // ==================== VIDEO RECORDING ====================
  
  const openCamera = async () => {
    try {
      setCameraError(null);
      setIsCameraOpen(true);
      
      console.log('📹 Opening camera interface...');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log('📹 Requesting camera access...');
      
      const cameraConfigs = [
        {
          video: { 
            facingMode: { ideal: 'environment' }, // Back camera
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        },
        {
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true
        },
        {
          video: { facingMode: 'environment' },
          audio: true
        },
        {
          video: { facingMode: 'user' }, // Fallback to front camera
          audio: true
        },
        {
          video: true,
          audio: true
        }
      ];

      let stream = null;
      for (let i = 0; i < cameraConfigs.length; i++) {
        try {
          console.log(`📹 Trying camera config ${i + 1}...`);
          stream = await navigator.mediaDevices.getUserMedia(cameraConfigs[i]);
          console.log(`📹 Camera config ${i + 1} successful!`);
          break;
        } catch (configError: any) {
          console.log(`📹 Config ${i + 1} failed:`, configError.message);
          if (i === cameraConfigs.length - 1) throw configError;
        }
      }
      
      if (!stream) {
        throw new Error('Unable to access camera');
      }
      
      setVideoStream(stream);
      
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream;
        try {
          await videoElementRef.current.play();
          console.log('📹 Video preview playing');
        } catch (playError) {
          console.warn('📹 Video play warning:', playError);
        }
      }
      
      showToast('📹 Camera opened successfully!', 'success');
      
    } catch (error: any) {
      console.error('📹 Camera error:', error);
      const errorMsg = error.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow permissions.'
        : 'Failed to access camera: ' + error.message;
      setCameraError(errorMsg);
      setIsCameraOpen(false);
      showToast(errorMsg, 'error');
    }
  };

  const closeCamera = () => {
    if (videoStream) {
      videoStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      setVideoStream(null);
    }
    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    console.log('📹 Camera closed');
  };

  const startVideoRecording = async () => {
    try {
      if (!videoStream) {
        showToast('Please open camera first', 'error');
      return;
      }

      // Check supported MIME types
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];
      
      let selectedMimeType = mimeTypes[0];
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }
      
      console.log('📹 Using MIME type:', selectedMimeType);
      
      const recorder = new MediaRecorder(videoStream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      });
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          console.log('📹 Video chunk received:', event.data.size, 'bytes');
        }
      };
      
      recorder.onstop = () => {
        console.log('📹 Video recording stopped, creating blob...');
        const blob = new Blob(chunks, { type: selectedMimeType });
        console.log('📹 Video blob created:', blob.size, 'bytes');
        
        setVideoBlob(blob);
        setIsVideoRecording(false);
        
        // Stop timer
        if (videoTimerRef.current) {
          clearInterval(videoTimerRef.current);
          videoTimerRef.current = null;
        }
        
        // Update appeal data with video
        setAppealData(prev => ({
          ...prev,
          evidence: {
            ...prev.evidence,
            video: blob
          }
        }));
        
        showToast('✅ Video saved and ready for upload!', 'success');
      };
      
      recorder.onerror = (error: any) => {
        console.error('📹 Recorder error:', error);
        setCameraError('Recording failed: ' + error.message);
      };
      
      setVideoRecorder(recorder);
      recorder.start();
      setIsVideoRecording(true);
      setVideoRecordingTime(0);
      
      // Start timer
      videoTimerRef.current = setInterval(() => {
        setVideoRecordingTime(prev => prev + 1);
      }, 1000);
      
      showToast('📹 Video recording started!', 'success');
      
    } catch (error: any) {
      console.error('📹 Error starting video recording:', error);
      setCameraError('Failed to start recording: ' + error.message);
      showToast('Failed to start video recording', 'error');
    }
  };

  const stopVideoRecording = () => {
    if (videoRecorder && isVideoRecording) {
      console.log('📹 Stopping video recording...');
      videoRecorder.stop();
      // Note: The actual save happens in recorder.onstop event
    }
  };

  const deleteVideo = () => {
    setVideoBlob(null);
    setVideoRecordingTime(0);
    showToast('Video recording deleted', 'info');
  };


  // ==================== SUBMIT APPEAL ====================
  
  const submitAppeal = async () => {
    if (!appealData.reason || !appealData.description) {
      setSubmitStatus({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }

    // Validate description minimum length
    if (appealData.description.trim().length < 10) {
      setSubmitStatus({ type: 'error', message: 'Description must be at least 10 characters long' });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });
    
    try {
      const formData = new FormData();
      formData.append('orderId', appealData.orderId);
      formData.append('appellant_address', appealData.walletAddress);
      formData.append('appellant_type', 'BUYER');
      
      // Map reason to dispute type
      let disputeType = 'OTHER';
      switch (appealData.reason) {
        case 'payment_not_received':
          disputeType = 'PAYMENT_NOT_RECEIVED';
          break;
        case 'payment_sent_but_not_confirmed':
          disputeType = 'PAYMENT_NOT_SENT';
          break;
        default:
          disputeType = 'OTHER';
      }
      
      formData.append('dispute_type', disputeType);
      formData.append('description', appealData.description);
      
      // Add video recording
      if (appealData.evidence.video) {
        formData.append('evidence_video', appealData.evidence.video, `video_evidence_${Date.now()}.webm`);
        console.log('📹 Added video to FormData:', appealData.evidence.video.size, 'bytes');
      }

      console.log('📤 Submitting appeal with FormData...');
      console.log('📤 Order ID:', appealData.orderId);
      console.log('📤 Wallet Address:', appealData.walletAddress);
      console.log('📤 Dispute Type:', disputeType);
      console.log('📤 Description:', appealData.description);
      
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}:`, value instanceof Blob ? `Blob(${value.size} bytes)` : value);
      }

      // Real API call
      const apiUrl = `/api/disputes/${appealData.orderId}/appeal`;
      console.log('📤 API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });

      console.log('📤 Response status:', response.status);
      console.log('📤 Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('📤 Error response:', errorData);
        throw new Error(errorData.error || 'Failed to submit appeal');
      }

      const result = await response.json();
      console.log('✅ Appeal submitted successfully:', result);
      
      setSubmitStatus({ type: 'success', message: '✅ Appeal submitted successfully! Admin will review within 48 hours.' });
      
      // Navigate back to orders page after 3 seconds
      // setTimeout(() => {
      //   window.location.href = '/orders';
      // }, 3000);
      
    } catch (error: any) {
      console.error('❌ Error submitting appeal:', error);
      const errorMessage = error.message || 'Failed to submit appeal';
      setSubmitStatus({ type: 'error', message: `❌ Error: ${errorMessage}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==================== UTILITY FUNCTIONS ====================
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  const showToast = (message: string, type = 'info') => {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // In real app: use toast library
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-white">📋 File Appeal</h1>
            <button
              onClick={() => setShowAppealGuide(true)}
              className="relative px-4 py-2.5 capitalize  text-lg font-medium  text-white border border-violet-400/30 transition-all shadow-lg hover:shadow-violet-500/20 flex items-center gap-2 overflow-hidden"
            >
              {/* Blurred video thumbnail background */}
              <div className="absolute inset-0">
                <video
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-110"
                  src="/api/videos/stream/appeal"
                />
              </div>
              {/* Content overlay */}
              <span className="relative z-10 flex items-center gap-2">
                guide 
                <SquarePlay className="w-6 h-6" />
              </span>
            </button>
           
          </div>
          <div className="space-y-2 text-white/80">
            <p><strong>Order ID:</strong> {orderId}</p>
            <p><strong>Wallet:</strong> {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}</p>
          </div>
        </div>


        {/* Video Recording Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Video className="w-5 h-5" />
            📹 Video Evidence
          </h3>
          
          {cameraError && (
            <div className="mb-4 bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
              {cameraError}
            </div>
          )}

          {!isCameraOpen ? (
            <button
              onClick={openCamera}
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
            >
              <Camera className="w-5 h-5" />
              Open Camera
            </button>
          ) : (
            <div className="space-y-4">
              {/* Camera Preview */}
              <div className="relative rounded-xl overflow-hidden border-2 border-white/20">
                <video
                  ref={videoElementRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-[400px] object-cover bg-black"
                />
                {isVideoRecording && (
                  <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    REC {formatTime(videoRecordingTime)}
      </div>
                )}
      </div>

              {/* Video Controls */}
              <div className="flex items-center gap-3">
                {!isVideoRecording ? (
                  <>
        <button
                      onClick={startVideoRecording}
                      disabled={!!videoBlob}
                      className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
        >
                      <Video className="w-5 h-5" />
                      Start Recording
        </button>
        <button
                      onClick={closeCamera}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-all"
                    >
                      <X className="w-5 h-5" />
                      Close
                    </button>
                  </>
                ) : (
                  <button
                    onClick={stopVideoRecording}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
                  >
                    <Square className="w-5 h-5" />
                    Stop & Save
                  </button>
                )}
              </div>

              {/* Video Saved Status */}
              {videoBlob && (
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-300">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Video Saved ({(videoBlob?.size ? (videoBlob.size / 1024 / 1024).toFixed(1) : '0')} MB)</span>
                    </div>
                    <button
                      onClick={deleteVideo}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>


        {/* Appeal Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-4">📝 Appeal Details</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-white font-medium mb-2">Reason for Appeal *</label>
              <select
                value={appealData.reason}
                onChange={(e) => setAppealData(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Select a reason</option>
                <option value="payment_not_received">Payment not received</option>
                <option value="payment_sent_but_not_confirmed">Payment sent but not confirmed</option>
                <option value="dispute_over_amount">Dispute over amount</option>
                <option value="technical_issue">Technical issue</option>
                <option value="fraud_suspected">Fraud suspected</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-white font-medium mb-2">Description *</label>
              <textarea
                value={appealData.description}
                onChange={(e) => setAppealData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Please provide detailed information about your appeal... (Minimum 10 characters)"
                rows={4}
                className={`w-full p-3 bg-white/10 border rounded-lg text-white placeholder-gray-400 focus:outline-none ${
                  appealData.description.length > 0 && appealData.description.length < 10
                    ? 'border-red-500/50 focus:border-red-500'
                    : 'border-white/20 focus:border-blue-500'
                }`}
              />
              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs text-gray-400">
                  {appealData.description.length > 0 && appealData.description.length < 10 && (
                    <span className="text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Description must be at least 10 characters ({appealData.description.length}/10)
                    </span>
                  )}
                  {appealData.description.length >= 10 && (
                    <span className="text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {appealData.description.length} characters
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {appealData.description.length}/10 minimum
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <div className="space-y-4">

            {/* Status Messages */}
            {submitStatus.type && (
              <div className={`p-4 rounded-lg border ${
                submitStatus.type === 'success' 
                  ? 'bg-green-500/20 border-green-500/30 text-green-300' 
                  : 'bg-red-500/20 border-red-500/30 text-red-300'
              }`}>
                <div className="flex items-center gap-2">
                  {submitStatus.type === 'success' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span className="font-medium">{submitStatus.message}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={submitAppeal}
              disabled={
                isSubmitting || 
                !appealData.reason || 
                !appealData.description || 
                appealData.description.trim().length < 10
              }
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Submitting Appeal...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-6 h-6" />
                  <span>Submit Appeal</span>
                </>
              )}
            </button>

            {/* Validation Messages */}
            {(!appealData.reason || !appealData.description || appealData.description.trim().length < 10) && (
              <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-yellow-200 text-sm">
                  <p className="font-medium mb-1">Required fields missing:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {!appealData.reason && <li>Please select a reason for appeal</li>}
                    {!appealData.description && <li>Please provide a description</li>}
                    {appealData.description && appealData.description.trim().length < 10 && (
                      <li>Description must be at least 10 characters (currently {appealData.description.trim().length} characters)</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Appeal Guide Video Modal */}
        {showAppealGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-4xl mx-auto bg-slate-900 border border-white/10 rounded-xl overflow-hidden" style={{ height: '80vh' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">Appeal Guide</h3>
                <button
                  onClick={() => setShowAppealGuide(false)}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="bg-black flex-1 flex items-center justify-center" style={{ height: 'calc(80vh - 120px)' }}>
                <video
                  controls
                  playsInline
                  className="w-full h-full object-contain bg-black"
                  src="/api/videos/stream/appeal"
                />
              </div>
              <div className="p-4 flex items-center justify-end gap-2 border-t border-white/10">
                <a
                  href="/api/videos/stream/appeal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition-colors"
                >
                  Open in new tab
                </a>
                <button
                  onClick={() => setShowAppealGuide(false)}
                  className="text-sm px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 border border-white/10 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default AppealPage;