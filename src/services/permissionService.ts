export interface PermissionStatus {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
  error?: string;
}

export class PermissionService {
  private static instance: PermissionService;

  private constructor() {}

  public static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  // Check if browser supports the required APIs
  public isWebRTCSupported(): boolean {
    try {
      // Check for RTCPeerConnection (including vendor prefixes)
      const hasRTCPeerConnection = !!(
        window.RTCPeerConnection || 
        (window as any).webkitRTCPeerConnection || 
        (window as any).mozRTCPeerConnection
      );
      
      // Check for MediaDevices API
      const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      
      // Check for getUserMedia (fallback for older browsers)
      const hasGetUserMedia = !!(
        navigator.getUserMedia || 
        navigator.webkitGetUserMedia || 
        navigator.mozGetUserMedia
      );
      
      // Check for RTCSessionDescription and RTCIceCandidate
      const hasRTCSessionDescription = !!(window.RTCSessionDescription || (window as any).webkitRTCSessionDescription);
      const hasRTCIceCandidate = !!(window.RTCIceCandidate || (window as any).webkitRTCIceCandidate);
      
      // Check if it's a mobile Chrome browser
      const isMobileChrome = /Chrome/.test(navigator.userAgent) && /Mobile/.test(navigator.userAgent);
      
      const supportDetails = {
        hasRTCPeerConnection,
        hasMediaDevices,
        hasGetUserMedia,
        hasRTCSessionDescription,
        hasRTCIceCandidate,
        isMobileChrome,
        userAgent: navigator.userAgent,
        isSecureContext: this.isSecureContext()
      };
      
      console.log('WebRTC Support Check:', supportDetails);
      
      // For mobile Chrome, be more lenient with the check
      if (isMobileChrome) {
        return hasRTCPeerConnection && (hasMediaDevices || hasGetUserMedia);
      }
      
      // For desktop browsers, require all components
      return hasRTCPeerConnection && hasRTCSessionDescription && hasRTCIceCandidate && (hasMediaDevices || hasGetUserMedia);
    } catch (error) {
      console.error('WebRTC support check failed:', error);
      return false;
    }
  }

  // Check if we're in a secure context (HTTPS or localhost/local network)
  public isSecureContext(): boolean {
    const hostname = location.hostname;
    const isLocalNetwork = (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||  // Local network
      hostname.startsWith('10.') ||       // Private network
      hostname.startsWith('172.') ||      // Private network
      hostname.endsWith('.local') ||      // mDNS local domain
      hostname === '0.0.0.0' ||           // Local development
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname) // Any IP address (for local development)
    );
    
    const isSecure = location.protocol === 'https:' || isLocalNetwork;
    
    console.log('🔒 Security Context Check:', {
      hostname,
      protocol: location.protocol,
      isLocalNetwork,
      isSecure,
      userAgent: navigator.userAgent
    });
    
    return isSecure;
  }

  // Check current microphone permission status
  public async checkMicrophonePermission(): Promise<PermissionStatus> {
    try {
      // Check if the Permissions API is available
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return {
          granted: permission.state === 'granted',
          denied: permission.state === 'denied',
          prompt: permission.state === 'prompt'
        };
      }

      // Fallback: Try to access getUserMedia to check permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
        return {
          granted: true,
          denied: false,
          prompt: false
        };
      } catch (error) {
        const err = error as DOMException;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          return {
            granted: false,
            denied: true,
            prompt: false,
            error: 'Microphone permission was denied'
          };
        } else if (err.name === 'NotFoundError') {
          return {
            granted: false,
            denied: true,
            prompt: false,
            error: 'No microphone found on this device'
          };
        } else {
          return {
            granted: false,
            denied: false,
            prompt: true,
            error: err.message
          };
        }
      }
    } catch (error) {
      return {
        granted: false,
        denied: false,
        prompt: true,
        error: 'Unable to check microphone permission'
      };
    }
  }

  // Request microphone permission
  public async requestMicrophonePermission(): Promise<PermissionStatus> {
    try {
      if (!this.isWebRTCSupported()) {
        return {
          granted: false,
          denied: true,
          prompt: false,
          error: 'WebRTC is not supported in this browser. Please use Chrome, Firefox, Safari, or Edge.'
        };
      }

      if (!this.isSecureContext()) {
        return {
          granted: false,
          denied: true,
          prompt: false,
          error: 'Microphone access requires HTTPS. Please use a secure connection.'
        };
      }

      // Try to get user media to request permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Stop the stream immediately since we only wanted to request permission
      stream.getTracks().forEach(track => track.stop());

      return {
        granted: true,
        denied: false,
        prompt: false
      };

    } catch (error) {
      const err = error as DOMException;
      console.error('Microphone permission error:', err);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return {
          granted: false,
          denied: true,
          prompt: false,
          error: 'Microphone permission was denied. Please allow microphone access and try again.'
        };
      } else if (err.name === 'NotFoundError') {
        return {
          granted: false,
          denied: true,
          prompt: false,
          error: 'No microphone found. Please connect a microphone and try again.'
        };
      } else if (err.name === 'NotReadableError') {
        return {
          granted: false,
          denied: true,
          prompt: false,
          error: 'Microphone is already in use by another application.'
        };
      } else if (err.name === 'OverconstrainedError') {
        return {
          granted: false,
          denied: true,
          prompt: false,
          error: 'Microphone does not meet the required constraints.'
        };
      } else if (err.name === 'SecurityError') {
        return {
          granted: false,
          denied: true,
          prompt: false,
          error: 'Microphone access blocked due to security restrictions.'
        };
      } else {
        return {
          granted: false,
          denied: false,
          prompt: true,
          error: `Microphone access failed: ${err.message}`
        };
      }
    }
  }

  // Get user-friendly error message for permission issues
  public getPermissionErrorMessage(status: PermissionStatus): string {
    if (status.error) {
      return status.error;
    }

    if (status.denied) {
      return 'Microphone permission is required for voice calls. Please enable microphone access in your browser settings.';
    }

    if (status.prompt) {
      return 'Please allow microphone access when prompted to enable voice calls.';
    }

    return 'Unknown permission error occurred.';
  }

  // Show instructions for enabling microphone permission
  public getPermissionInstructions(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('chrome')) {
      return 'Chrome: Click the microphone icon in the address bar, or go to Settings > Privacy and Security > Site Settings > Microphone.';
    } else if (userAgent.includes('firefox')) {
      return 'Firefox: Click the microphone icon in the address bar, or go to Preferences > Privacy & Security > Permissions > Microphone.';
    } else if (userAgent.includes('safari')) {
      return 'Safari: Go to Preferences > Websites > Microphone, and allow access for this site.';
    } else if (userAgent.includes('edge')) {
      return 'Edge: Click the microphone icon in the address bar, or go to Settings > Cookies and site permissions > Microphone.';
    } else {
      return 'Please check your browser settings to allow microphone access for this website.';
    }
  }
}

export const permissionService = PermissionService.getInstance();
