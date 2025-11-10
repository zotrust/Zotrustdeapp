import React, { useState, useEffect } from 'react';
import { webrtcService } from '../services/webrtcService';
import { signalingService } from '../services/signalingService';

interface WebRTCDebugProps {
  isOpen: boolean;
  onClose: () => void;
}

const WebRTCDebug: React.FC<WebRTCDebugProps> = ({ isOpen, onClose }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [iceServers, setIceServers] = useState<any[]>([]);
  const [connectionState, setConnectionState] = useState<string>('new');
  const [iceGatheringState, setIceGatheringState] = useState<string>('new');
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
      loadIceServers();
      setupLogging();
    }
  }, [isOpen]);

  const loadDevices = async () => {
    try {
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      setDevices(deviceList);
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const loadIceServers = () => {
    // Get ICE servers from the WebRTC service
    const config = (webrtcService as any).peerConnection?.getConfiguration();
    if (config?.iceServers) {
      setIceServers(config.iceServers);
    }
  };

  const setupLogging = () => {
    // Monitor connection state changes
    const checkState = () => {
      const pc = (webrtcService as any).peerConnection;
      if (pc) {
        setConnectionState(pc.connectionState || 'new');
        setIceGatheringState(pc.iceGatheringState || 'new');
      }
    };

    const interval = setInterval(checkState, 1000);
    return () => clearInterval(interval);
  };

  const testMediaAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      addLog('✅ Media access successful');
      addLog(`Stream tracks: ${stream.getTracks().length}`);
      
      // Stop the stream
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      addLog(`❌ Media access failed: ${error}`);
    }
  };

  const testWebRTCConnection = async () => {
    try {
      addLog('🧪 Testing WebRTC connection...');
      
      // Create a test peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addLog(`🧊 ICE candidate: ${event.candidate.type} ${event.candidate.protocol}`);
        }
      };

      pc.onicegatheringstatechange = () => {
        addLog(`🧊 ICE gathering state: ${pc.iceGatheringState}`);
      };

      pc.onconnectionstatechange = () => {
        addLog(`🔗 Connection state: ${pc.connectionState}`);
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      addLog('✅ WebRTC test connection created');
      
      // Clean up
      setTimeout(() => {
        pc.close();
        addLog('🧹 Test connection closed');
      }, 5000);
      
    } catch (error) {
      addLog(`❌ WebRTC test failed: ${error}`);
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl p-6 w-full max-w-4xl border border-white/20 text-white max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">WebRTC Debug Panel</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Media Devices */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Media Devices</h3>
            <div className="space-y-2">
              {devices.map((device, index) => (
                <div key={index} className="p-3 bg-slate-800 rounded-lg">
                  <div className="font-medium">{device.kind}</div>
                  <div className="text-sm text-gray-400">
                    {device.label || 'No label'}
                  </div>
                  <div className="text-xs text-gray-500">
                    ID: {device.deviceId}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={testMediaAccess}
              className="w-full p-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Test Media Access
            </button>
          </div>

          {/* ICE Servers */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">ICE Servers</h3>
            <div className="space-y-2">
              {iceServers.map((server, index) => (
                <div key={index} className="p-3 bg-slate-800 rounded-lg">
                  <div className="font-medium">{server.urls}</div>
                  {server.username && (
                    <div className="text-sm text-gray-400">
                      User: {server.username}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Connection State */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Connection State</h3>
            <div className="space-y-2">
              <div className="p-3 bg-slate-800 rounded-lg">
                <div className="font-medium">WebRTC State</div>
                <div className="text-sm text-gray-400">{connectionState}</div>
              </div>
              <div className="p-3 bg-slate-800 rounded-lg">
                <div className="font-medium">ICE Gathering</div>
                <div className="text-sm text-gray-400">{iceGatheringState}</div>
              </div>
              <div className="p-3 bg-slate-800 rounded-lg">
                <div className="font-medium">Signaling Connected</div>
                <div className="text-sm text-gray-400">
                  {signalingService.isSignalingConnected() ? '✅ Yes' : '❌ No'}
                </div>
              </div>
            </div>
            <button
              onClick={testWebRTCConnection}
              className="w-full p-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              Test WebRTC Connection
            </button>
          </div>

          {/* Debug Logs */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Debug Logs</h3>
            <div className="h-64 bg-slate-800 rounded-lg p-3 overflow-y-auto font-mono text-sm">
              {logs.map((log, index) => (
                <div key={index} className="mb-1">{log}</div>
              ))}
            </div>
            <button
              onClick={() => setLogs([])}
              className="w-full p-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Clear Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebRTCDebug;
