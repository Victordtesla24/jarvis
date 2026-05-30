
export class SoundService {
  private static context: AudioContext | null = null;
  private static gainNode: GainNode | null = null;

  static initialize() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.context.createGain();
      this.gainNode.connect(this.context.destination);
      this.gainNode.gain.value = 0.15; // Master volume
    }
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  // Text-to-Speech implementation
  static speak(text: string) {
    if ('speechSynthesis' in window) {
        // Cancel any current speaking
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = 1;
        utterance.rate = 0.9; // Slightly slower for authority
        utterance.pitch = 0.85; // Slightly deeper

        // Try to select a British Male voice (closest to JARVIS standard)
        // Note: Voices load asynchronously in some browsers, but usually are available after user interaction
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => 
            (v.name.includes('Great Britain') || v.name.includes('UK') || v.name.includes('English')) && 
            v.name.includes('Male')
        ) || voices.find(v => v.name.includes('Google UK English Male')) || voices[0];

        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        window.speechSynthesis.speak(utterance);
    }
  }

  // Play a short high-pitched beep (UI hover/tick)
  static playBlip() {
    if (!this.context || !this.gainNode) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.connect(gain);
    gain.connect(this.gainNode);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2000, this.context.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.1, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.05);

    osc.start();
    osc.stop(this.context.currentTime + 0.05);
  }

  // Play a mechanical lock/scan sound
  static playLock() {
    if (!this.context || !this.gainNode) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.connect(gain);
    gain.connect(this.gainNode);

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.context.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.1, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.3);

    osc.start();
    osc.stop(this.context.currentTime + 0.3);
  }

  // Play a release sound (reverse lock)
  static playRelease() {
    if (!this.context || !this.gainNode) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.connect(gain);
    gain.connect(this.gainNode);

    osc.type = 'square';
    osc.frequency.setValueAtTime(50, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.context.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.05, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.2);

    osc.start();
    osc.stop(this.context.currentTime + 0.2);
  }

  // Play a servo motor sound for expansion (Granular Synthesis style)
  static playServo(intensity: number) {
    if (!this.context || !this.gainNode) return;
    
    // Threshold check - significantly lowered to catch subtle movements
    // 0.001 is roughly the movement per frame during slow gestures
    if (intensity < 0.001) return; 

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.gainNode);

    // Sawtooth gives a nice "buzzy" mechanical texture
    osc.type = 'sawtooth';
    
    // Pitch modulation: 
    // Base 60Hz (low hum) + Intensity scaler
    // Random jitter adds "texture" to prevent phasing artifacts when triggered rapidly
    const jitter = Math.random() * 20; 
    osc.frequency.setValueAtTime(60 + (intensity * 1500) + jitter, this.context.currentTime);
    
    // Lowpass filter mimics the enclosure of a motor
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400 + (intensity * 2000), this.context.currentTime);

    // Short burst (Grain)
    // Volume scaled by intensity
    const vol = Math.min(0.2, 0.05 + (intensity * 2)); 
    gain.gain.setValueAtTime(vol, this.context.currentTime);
    // Fast decay
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.1);

    osc.start();
    osc.stop(this.context.currentTime + 0.1);
  }

  // Play a heavy data-load/switch sound
  static playMapSwitch() {
    if (!this.context || !this.gainNode) return;
    
    const osc1 = this.context.createOscillator();
    const osc2 = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.gainNode);

    // Low heavy bass sweep
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(150, this.context.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(50, this.context.currentTime + 0.5);

    // High tech chirp
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2000, this.context.currentTime);
    osc2.frequency.linearRampToValueAtTime(500, this.context.currentTime + 0.2);

    gain.gain.setValueAtTime(0.3, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.5);

    osc1.start();
    osc2.start();
    osc1.stop(this.context.currentTime + 0.5);
    osc2.stop(this.context.currentTime + 0.5);
  }

  // Ambient background hum
  static playAmbientHum() {
    if (!this.context || !this.gainNode) return;
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.connect(gain);
    gain.connect(this.gainNode);
    
    osc.type = 'sawtooth';
    osc.frequency.value = 40;
    gain.gain.value = 0.03; // Quieter ambient
    
    osc.start();
  }
  
  static playBootSequence() {
     if (!this.context || !this.gainNode) return;
     const t = this.context.currentTime;
     
     const osc = this.context.createOscillator();
     const gain = this.context.createGain();
     osc.connect(gain);
     gain.connect(this.gainNode);
     
     osc.frequency.setValueAtTime(50, t);
     osc.frequency.exponentialRampToValueAtTime(800, t + 1.5);
     
     gain.gain.setValueAtTime(0, t);
     gain.gain.linearRampToValueAtTime(0.3, t + 0.5);
     gain.gain.linearRampToValueAtTime(0, t + 2.0);
     
     osc.start(t);
     osc.stop(t + 2.0);
  }
}
