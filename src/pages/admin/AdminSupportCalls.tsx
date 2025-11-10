
import React, { useEffect, useState, useRef } from 'react';
import { Phone, PhoneOff, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import io, { Socket } from 'socket.io-client';
import { WS_URL } from '../../config/env';
import CallModal from '../../components/CallModal';
import IncomingCallModal from '../../components/IncomingCallModal';
import toast from 'react-hot-toast';

interface SupportCall {
  id: string;
  callerAddress: string;
  callerName?: string;
  timestamp: number;
  status: 'incoming' | 'active' | 'ended';
}

const AdminSupportCalls: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [supportCalls, setSupportCalls] = useState<SupportCall[]>([]);
  const [activeCall, setActiveCall] = useState<SupportCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to socket and register as admin
    const connectSocket = () => {
      console.log('📞 AdminSupportCalls: Connecting to socket...');
      
      const newSocket = io(WS_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 5,
        timeout: 20000
      });

      newSocket.on('connect', () => {
        console.log('📞 AdminSupportCalls: Connected to socket');
        setIsConnected(true);
        
        // Register as admin for support calls
        newSocket.emit('register', 'ADMIN_SUPPORT', true);
        console.log('📞 AdminSupportCalls: Registered as admin for support calls');
      });

      newSocket.on('disconnect', () => {
        console.log('📞 AdminSupportCalls: Disconnected from socket');
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('📞 AdminSupportCalls: Connection error:', error);
        setIsConnected(false);
      });

      // Handle incoming support calls
      newSocket.on('incoming-call', (data: any) => {
        console.log('📞 AdminSupportCalls: Incoming support call:', data);
        
        // Ensure callerAddress exists
        if (!data.callerAddress) {
          console.error('❌ AdminSupportCalls: Missing callerAddress in incoming call data');
          toast.error('Invalid call data: missing caller address');
          return;
        }
        
        // Fetch caller info
        fetchCallerInfo(data.callerAddress).then(callerName => {
          const call: SupportCall = {
            id: data.callId || `call-${Date.now()}`,
            callerAddress: data.callerAddress,
            callerName,
            timestamp: data.timestamp || Date.now(),
            status: 'incoming'
          };

          setSupportCalls(prev => [...prev, call]);
          setIncomingCall({
            ...data,
            callerAddress: data.callerAddress,
            callerName,
            isAdminSupportCall: true
          });

          toast('📞 New support call incoming!', {
            duration: 5000,
            position: 'top-center'
          });
        });
      });

      // Handle call ended
      newSocket.on('call-ended', (data: any) => {
        console.log('📞 AdminSupportCalls: Call ended:', data);
        setActiveCall(null);
        setSupportCalls(prev => prev.map(call => 
          call.id === data.callId ? { ...call, status: 'ended' } : call
        ));
        toast('Call ended', { icon: '📞' });
      });

      // Handle WebRTC offer (this comes after admin accepts)
      newSocket.on('offer', async (data: any) => {
        console.log('📞 AdminSupportCalls: Received offer:', data);
        if (data.isAdminSupportCall && activeCall) {
          console.log('📞 AdminSupportCalls: Offer received for active call - will be handled by CallModal');
          // The offer will be handled by CallModal which is opened for activeCall
          // Update incomingCall with offer so CallModal can process it
          if (incomingCall) {
            setIncomingCall(prev => ({
              ...prev,
              offer: data.offer
            }));
          }
        }
      });

      // Handle WebRTC answer
      newSocket.on('answer', async (data: any) => {
        console.log('📞 AdminSupportCalls: Received answer:', data);
      });

      // Handle ICE candidates
      newSocket.on('ice-candidate', async (data: any) => {
        console.log('📞 AdminSupportCalls: Received ICE candidate');
      });

      setSocket(newSocket);
      socketRef.current = newSocket;

      return () => {
        newSocket.disconnect();
      };
    };

    connectSocket();

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const fetchCallerInfo = async (address: string): Promise<string | undefined> => {
    try {
      const response = await fetch(`/api/auth/user-by-address?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.name) {
          return data.data.name;
        }
      }
    } catch (error) {
      console.error('Error fetching caller info:', error);
    }
    return undefined;
  };

  const handleAcceptCall = async () => {
    if (!incomingCall) return;

    // Validate incoming call data
    if (!incomingCall.callerAddress) {
      console.error('❌ AdminSupportCalls: Cannot accept call - missing callerAddress');
      toast.error('Invalid call data');
      setIncomingCall(null);
      return;
    }

    try {
      console.log('📞 AdminSupportCalls: Accepting call from', incomingCall.callerAddress);
      
      // Emit call-accepted event to backend
      if (socket) {
        socket.emit('call-accepted', {
          callId: incomingCall.callId,
          callerAddress: incomingCall.callerAddress
        });
        console.log('📞 AdminSupportCalls: Call acceptance event sent to backend');
      }
      
      // Update local state
      setActiveCall({
        id: incomingCall.callId || `call-${Date.now()}`,
        callerAddress: incomingCall.callerAddress,
        callerName: incomingCall.callerName,
        timestamp: incomingCall.timestamp || Date.now(),
        status: 'active'
      });

      setSupportCalls(prev => prev.map(call =>
        call.id === incomingCall.callId ? { ...call, status: 'active' } : call
      ));

      // Clear incomingCall modal - AdminLayout will handle WebRTC
      // The offer will come via socket and AdminLayout will handle it
      setIncomingCall(null);
      toast.success('Call accepted! Connecting...');
    } catch (error) {
      console.error('Error accepting call:', error);
      toast.error('Failed to accept call');
    }
  };

  const handleRejectCall = async () => {
    if (!incomingCall) return;

    try {
      if (socket) {
        socket.emit('call-rejected', {
          callId: incomingCall.callId,
          receiverAddress: 'ADMIN_SUPPORT',
          callerAddress: incomingCall.callerAddress
        });
      }

      setSupportCalls(prev => prev.map(call =>
        call.id === incomingCall.callId ? { ...call, status: 'ended' } : call
      ));

      setIncomingCall(null);
      toast('Call rejected', { icon: '📞' });
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  const handleEndCall = () => {
    if (activeCall && socket) {
      socket.emit('end-call', {
        callId: activeCall.id,
        to: activeCall.callerAddress
      });
    }
    setActiveCall(null);
    toast('Call ended', { icon: '📞' });
  };

  return (
    <div>
      {/* Connection Status */}
      <div className="mb-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-lg border flex items-center justify-between ${
            isConnected
              ? 'bg-green-500/20 border-green-500/30'
              : 'bg-red-500/20 border-red-500/30'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <div>
              <p className={`font-medium text-sm ${isConnected ? 'text-green-300' : 'text-red-300'}`}>
                Support Call Service: {isConnected ? 'Online' : 'Offline'}
              </p>
              <p className={`text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                {isConnected
                  ? 'Ready to receive support calls'
                  : 'Not connected to call service'}
              </p>
            </div>
          </div>
          {!isConnected && (
            <Loader2 className="w-4 h-4 animate-spin text-red-400" />
          )}
        </motion.div>
      </div>

      {/* Info Card */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Phone size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Support Calls</h2>
            <p className="text-gray-300 text-sm mb-3">
              Users can call you for support through the Dashboard. Incoming calls will appear here.
            </p>
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <CheckCircle size={14} className="text-green-400" />
              <span>Make sure to keep this page open to receive calls</span>
            </div>
          </div>
        </div>
      </div>

      {/* Support Calls List */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
        <h3 className="text-lg font-bold text-white mb-4">Recent Support Calls</h3>
        
        {supportCalls.length === 0 ? (
          <div className="text-center py-8">
            <Phone size={48} className="text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No support calls yet</p>
            <p className="text-gray-500 text-sm mt-2">
              Waiting for incoming support calls...
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {supportCalls.map((call) => (
              <motion.div
                key={call.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-4 rounded-lg border ${
                  call.status === 'active'
                    ? 'bg-green-500/20 border-green-500/30'
                    : call.status === 'incoming'
                    ? 'bg-blue-500/20 border-blue-500/30'
                    : 'bg-gray-500/20 border-gray-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Phone size={16} className={
                        call.status === 'active' ? 'text-green-400' :
                        call.status === 'incoming' ? 'text-blue-400' :
                        'text-gray-400'
                      } />
                      <p className="font-medium text-white">
                        {call.callerName || 'Unknown User'}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 font-mono">
                      {call.callerAddress 
                        ? `${call.callerAddress.slice(0, 6)}...${call.callerAddress.slice(-4)}`
                        : 'Unknown Address'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(call.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {call.status === 'active' && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                        Active
                      </span>
                    )}
                    {call.status === 'incoming' && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full animate-pulse">
                        Incoming
                      </span>
                    )}
                    {call.status === 'ended' && (
                      <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full">
                        Ended
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          isOpen={!!incomingCall}
          callerAddress={incomingCall.callerAddress}
          callerName={incomingCall.callerName}
          callId={incomingCall.callId}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          onClose={() => setIncomingCall(null)}
        />
      )}

      {/* Active Call Modal */}
      {activeCall && (
        <CallModal
          isOpen={!!activeCall}
          ad={null}
          onClose={handleEndCall}
        />
      )}
    </div>
  );
};

export default AdminSupportCalls;

