import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Video, CheckCircle, AlertCircle, Loader2, Play, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAdminToken } from '../../utils/adminAuth';

const AdminVideos: React.FC = () => {
  const [demoVideo, setDemoVideo] = useState<File | null>(null);
  const [appealVideo, setAppealVideo] = useState<File | null>(null);
  const [uploadingDemo, setUploadingDemo] = useState(false);
  const [uploadingAppeal, setUploadingAppeal] = useState(false);
  const [demoVideoInfo, setDemoVideoInfo] = useState<any>(null);
  const [appealVideoInfo, setAppealVideoInfo] = useState<any>(null);
  const demoInputRef = useRef<HTMLInputElement>(null);
  const appealInputRef = useRef<HTMLInputElement>(null);

  // Fetch video info on mount
  React.useEffect(() => {
    fetchVideoInfo();
  }, []);

  const fetchVideoInfo = async () => {
    try {
      const [demoRes, appealRes] = await Promise.all([
        fetch('/api/videos/info/demo'),
        fetch('/api/videos/info/appeal')
      ]);
      
      if (demoRes.ok) {
        const demoData = await demoRes.json();
        setDemoVideoInfo(demoData.exists ? demoData : null);
      }
      
      if (appealRes.ok) {
        const appealData = await appealRes.json();
        setAppealVideoInfo(appealData.exists ? appealData : null);
      }
    } catch (error) {
      console.error('Error fetching video info:', error);
    }
  };

  const handleDemoUpload = async () => {
    if (!demoVideo) {
      toast.error('Please select a demo video file');
      return;
    }

    setUploadingDemo(true);
    const formData = new FormData();
    formData.append('video', demoVideo);

    try {
      const token = getAdminToken();
      const response = await fetch('/api/videos/upload/demo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Demo video uploaded successfully!');
        setDemoVideo(null);
        if (demoInputRef.current) {
          demoInputRef.current.value = '';
        }
        fetchVideoInfo();
      } else {
        toast.error(data.error || 'Failed to upload demo video');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload demo video');
    } finally {
      setUploadingDemo(false);
    }
  };

  const handleAppealUpload = async () => {
    if (!appealVideo) {
      toast.error('Please select an appeal video file');
      return;
    }

    setUploadingAppeal(true);
    const formData = new FormData();
    formData.append('video', appealVideo);

    try {
      const token = getAdminToken();
      const response = await fetch('/api/videos/upload/appeal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Appeal video uploaded successfully!');
        setAppealVideo(null);
        if (appealInputRef.current) {
          appealInputRef.current.value = '';
        }
        fetchVideoInfo();
      } else {
        toast.error(data.error || 'Failed to upload appeal video');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload appeal video');
    } finally {
      setUploadingAppeal(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Video Management</h1>
        <p className="text-gray-300">Upload and manage demo and appeal videos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Demo Video Upload */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Video className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Demo Video</h2>
              <p className="text-gray-400 text-sm">Upload platform demonstration video</p>
            </div>
          </div>

          {/* Current Video Info */}
          {demoVideoInfo && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-green-300 text-sm font-medium">Video Available</p>
                    <p className="text-gray-400 text-xs">{demoVideoInfo.filename} • {formatFileSize(demoVideoInfo.size)}</p>
                  </div>
                </div>
                <a
                  href={demoVideoInfo.streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg text-blue-300 transition-colors"
                >
                  <Play className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {/* File Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Demo Video (MP4, WebM, MOV, AVI - Max 500MB)
            </label>
            <input
              ref={demoInputRef}
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 500 * 1024 * 1024) {
                    toast.error('File size must be less than 500MB');
                    return;
                  }
                  setDemoVideo(file);
                }
              }}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-500 file:text-white hover:file:bg-violet-600 cursor-pointer"
            />
            {demoVideo && (
              <div className="mt-2 p-3 bg-white/5 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Video className="w-4 h-4 text-violet-400" />
                  <span className="text-sm text-gray-300">{demoVideo.name}</span>
                  <span className="text-xs text-gray-400">({formatFileSize(demoVideo.size)})</span>
                </div>
                <button
                  onClick={() => {
                    setDemoVideo(null);
                    if (demoInputRef.current) {
                      demoInputRef.current.value = '';
                    }
                  }}
                  className="p-1 hover:bg-red-500/20 rounded text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <button
            onClick={handleDemoUpload}
            disabled={!demoVideo || uploadingDemo}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {uploadingDemo ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>Upload Demo Video</span>
              </>
            )}
          </button>

          <p className="mt-3 text-xs text-gray-400">
            Note: Only one demo video can be stored at a time. Uploading a new video will replace the existing one.
          </p>
        </motion.div>

        {/* Appeal Video Upload */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Video className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Appeal Video</h2>
              <p className="text-gray-400 text-sm">Upload dispute appeal guide video</p>
            </div>
          </div>

          {/* Current Video Info */}
          {appealVideoInfo && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-green-300 text-sm font-medium">Video Available</p>
                    <p className="text-gray-400 text-xs">{appealVideoInfo.filename} • {formatFileSize(appealVideoInfo.size)}</p>
                  </div>
                </div>
                <a
                  href={appealVideoInfo.streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-purple-300 transition-colors"
                >
                  <Play className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {/* File Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Appeal Video (MP4, WebM, MOV, AVI - Max 500MB)
            </label>
            <input
              ref={appealInputRef}
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 500 * 1024 * 1024) {
                    toast.error('File size must be less than 500MB');
                    return;
                  }
                  setAppealVideo(file);
                }
              }}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-500 file:text-white hover:file:bg-violet-600 cursor-pointer"
            />
            {appealVideo && (
              <div className="mt-2 p-3 bg-white/5 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Video className="w-4 h-4 text-violet-400" />
                  <span className="text-sm text-gray-300">{appealVideo.name}</span>
                  <span className="text-xs text-gray-400">({formatFileSize(appealVideo.size)})</span>
                </div>
                <button
                  onClick={() => {
                    setAppealVideo(null);
                    if (appealInputRef.current) {
                      appealInputRef.current.value = '';
                    }
                  }}
                  className="p-1 hover:bg-red-500/20 rounded text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <button
            onClick={handleAppealUpload}
            disabled={!appealVideo || uploadingAppeal}
            className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {uploadingAppeal ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                <span>Upload Appeal Video</span>
              </>
            )}
          </button>

          <p className="mt-3 text-xs text-gray-400">
            Note: Only one appeal video can be stored at a time. Uploading a new video will replace the existing one.
          </p>
        </motion.div>
      </div>

      {/* Video URLs Info */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20"
      >
        <h3 className="text-lg font-bold text-white mb-4">Streaming URLs</h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-400 mb-1">Demo Video Stream URL:</p>
            <code className="block p-3 bg-black/30 rounded-lg text-violet-300 text-sm break-all">
              {typeof window !== 'undefined' ? `${window.location.origin}/api/videos/stream/demo` : '/api/videos/stream/demo'}
            </code>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Appeal Video Stream URL:</p>
            <code className="block p-3 bg-black/30 rounded-lg text-violet-300 text-sm break-all">
              {typeof window !== 'undefined' ? `${window.location.origin}/api/videos/stream/appeal` : '/api/videos/stream/appeal'}
            </code>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminVideos;

