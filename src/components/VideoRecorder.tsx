import React, { useEffect, useRef, useState } from 'react';

interface VideoRecorderProps {
  onRecorded: (dataUrl: string, blob: Blob) => void;
  disabled?: boolean;
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({ onRecorded, disabled }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const requestCamera = async () => {
    if (hasPermission === true && mediaStreamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setHasPermission(true);
    } catch (e) {
      setHasPermission(false);
    }
  };

  const startRecording = async () => {
    if (disabled) return;
    await requestCamera();
    if (!mediaStreamRef.current) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType: 'video/webm;codecs=vp9' });
    recorderRef.current = recorder;
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        onRecorded(dataUrl, blob);
      };
      reader.readAsDataURL(blob);
    };
    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  };

  return (
    <div className="space-y-3">
      <div className="bg-black/40 rounded-lg overflow-hidden aspect-video">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      </div>
      <div className="text-xs text-gray-300">
        {hasPermission === false && 'Camera/microphone permission denied. Please allow access.'}
      </div>
      <button
        type="button"
        disabled={disabled}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        className={`w-full px-4 py-2 rounded-md text-white font-medium transition-all ${
          isRecording ? 'bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Hold to record"
      >
        {isRecording ? 'Recording... release to stop' : 'Hold to Record Video'}
      </button>
    </div>
  );
};

export default VideoRecorder;


