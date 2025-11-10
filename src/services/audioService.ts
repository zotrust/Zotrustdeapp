export class AudioService {
  private static instance: AudioService;
  private incomingCallAudio: HTMLAudioElement | null = null;
  private outgoingCallAudio: HTMLAudioElement | null = null;
  private callConnectedAudio: HTMLAudioElement | null = null;
  private callEndedAudio: HTMLAudioElement | null = null;
  private isPlaying: { [key: string]: boolean } = {};
  private audioContext: AudioContext | null = null;
  private activeOscillators: OscillatorNode[] = [];

  private constructor() {
    this.initializeAudioElements();
  }

  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  private initializeAudioElements() {
    try {
      // Create audio elements
      this.incomingCallAudio = new Audio();
      this.outgoingCallAudio = new Audio();
      this.callConnectedAudio = new Audio();
      this.callEndedAudio = new Audio();

      // Set audio sources - use existing ring.mp3 for both incoming and outgoing
      this.incomingCallAudio.src = '/sounds/ring.mp3';
      this.outgoingCallAudio.src = '/sounds/ring.mp3';

      // Set loop for incoming and outgoing calls
      this.incomingCallAudio.loop = true;
      this.outgoingCallAudio.loop = true;

      // Set volume
      [this.incomingCallAudio, this.outgoingCallAudio, this.callConnectedAudio, this.callEndedAudio].forEach(audio => {
        if (audio) {
          audio.volume = 0.7;
          audio.preload = 'auto';
        }
      });

      // Handle audio loading errors - create fallback beep sounds
      this.incomingCallAudio.onerror = () => this.createFallbackAudio('incoming');
      this.outgoingCallAudio.onerror = () => this.createFallbackAudio('outgoing');

    } catch (error) {
      console.error('Failed to initialize audio elements:', error);
      this.createFallbackAudio('all');
    }
  }

  private createFallbackAudio(type: string) {
    console.log(`Creating fallback audio for: ${type}`);
    // Simple fallback - we'll use Web Audio API or just console logs
    if (type === 'incoming' || type === 'all') {
      this.incomingCallAudio = this.createBeepAudio(800, 0.5);
    }
    if (type === 'outgoing' || type === 'all') {
      this.outgoingCallAudio = this.createBeepAudio(440, 1.0);
    }
  }

  private createBeepAudio(frequency: number, duration: number): HTMLAudioElement {
    // Create a mock audio element that plays a beep using Web Audio API
    const mockAudio = {
      play: () => {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration);
        } catch (error) {
          console.log('Web Audio API not available, using silent fallback');
        }
        return Promise.resolve();
      },
      pause: () => {},
      currentTime: 0,
      volume: 0.7,
      loop: false
    };
    
    return mockAudio as HTMLAudioElement;
  }

  public async playIncomingCall(): Promise<void> {
    try {
      if (this.incomingCallAudio) {
        this.isPlaying['incoming'] = true;
        await this.incomingCallAudio.play();
        console.log('📞 Playing incoming call sound');
      }
    } catch (error) {
      console.log('Could not play incoming call sound:', error);
    }
  }

  public stopIncomingCall(): void {
    try {
      if (this.incomingCallAudio) {
        this.isPlaying['incoming'] = false;
        this.incomingCallAudio.pause();
        this.incomingCallAudio.currentTime = 0;
        console.log('🔇 Stopped incoming call sound');
      }
    } catch (error) {
      console.log('Could not stop incoming call sound:', error);
    }
  }

  public async playOutgoingCall(): Promise<void> {
    try {
      if (this.outgoingCallAudio) {
        this.isPlaying['outgoing'] = true;
        await this.outgoingCallAudio.play();
        console.log('📞 Playing outgoing call sound');
      }
    } catch (error) {
      console.log('Could not play outgoing call sound:', error);
    }
  }

  public stopOutgoingCall(): void {
    try {
      if (this.outgoingCallAudio) {
        this.isPlaying['outgoing'] = false;
        this.outgoingCallAudio.pause();
        this.outgoingCallAudio.currentTime = 0;
        console.log('🔇 Stopped outgoing call sound');
      }
    } catch (error) {
      console.log('Could not stop outgoing call sound:', error);
    }
  }

  public async playCallConnected(): Promise<void> {
    try {
      this.stopAllOscillators(); // Stop any existing sounds first
      
      // Play a simple beep for call connected
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
      
      this.activeOscillators.push(oscillator);
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.3);
      
      // Clean up after sound finishes
      setTimeout(() => {
        this.removeOscillator(oscillator);
      }, 300);
      
      console.log('✅ Playing call connected sound');
    } catch (error) {
      console.log('Could not play call connected sound:', error);
    }
  }

  public async playCallEnded(): Promise<void> {
    try {
      this.stopAllOscillators(); // Stop any existing sounds first
      
      // Play a simple beep for call ended
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
      
      this.activeOscillators.push(oscillator);
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.5);
      
      // Clean up after sound finishes
      setTimeout(() => {
        this.removeOscillator(oscillator);
      }, 500);
      
      console.log('❌ Playing call ended sound');
    } catch (error) {
      console.log('Could not play call ended sound:', error);
    }
  }

  public stopAllSounds(): void {
    this.stopIncomingCall();
    this.stopOutgoingCall();
    this.stopAllOscillators();
    console.log('🔇 Stopped all call sounds');
  }

  private stopAllOscillators(): void {
    this.activeOscillators.forEach(oscillator => {
      try {
        oscillator.stop();
      } catch (error) {
        // Oscillator might already be stopped
      }
    });
    this.activeOscillators = [];
    
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (error) {
        // Context might already be closed
      }
      this.audioContext = null;
    }
  }

  private removeOscillator(oscillator: OscillatorNode): void {
    const index = this.activeOscillators.indexOf(oscillator);
    if (index > -1) {
      this.activeOscillators.splice(index, 1);
    }
  }

  public setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    [this.incomingCallAudio, this.outgoingCallAudio, this.callConnectedAudio, this.callEndedAudio].forEach(audio => {
      if (audio) {
        audio.volume = clampedVolume;
      }
    });
  }
}

export const audioService = AudioService.getInstance();