// ICE Server Configuration
// Update these values with your TURN server details

export interface ICEServer {
  urls: string;
  username?: string;
  credential?: string;
}

export const ICE_SERVERS: ICEServer[] = [
  // Google STUN servers for NAT traversal
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  
  // Additional STUN servers for better connectivity
  { urls: 'stun:stun.stunprotocol.org:3478' },
  { urls: 'stun:stun.voiparound.com' },
  { urls: 'stun:stun.voipbuster.com' },
  
  // Free TURN servers (Metered.ca OpenRelay)
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

// Environment-based configuration
export const getICEServers = (): ICEServer[] => {
  const turnServerIP = process.env.TURN_SERVER_IP || 'YOUR_SERVER_IP';
  const turnUsername = process.env.TURN_USERNAME || 'webrtc';
  const turnPassword = process.env.TURN_PASSWORD || 'password123';
  
  const baseServers: ICEServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.voiparound.com' },
    { urls: 'stun:stun.voipbuster.com' }
  ];
  
  // Use custom TURN server if configured, otherwise use free TURN servers
  if (turnServerIP !== 'YOUR_SERVER_IP') {
    return [
      ...baseServers,
      {
        urls: `turn:${turnServerIP}:3478`,
        username: turnUsername,
        credential: turnPassword
      },
      {
        urls: `turn:${turnServerIP}:3478?transport=tcp`,
        username: turnUsername,
        credential: turnPassword
      },
      {
        urls: `turn:${turnServerIP}:5349?transport=tcp`,
        username: turnUsername,
        credential: turnPassword
      }
    ];
  }
  
  // Use free TURN servers by default
  return [
    ...baseServers,
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ];
};
