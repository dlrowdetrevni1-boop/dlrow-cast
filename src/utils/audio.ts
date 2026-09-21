// Audio utilities using Web Audio API for zero-dependency sound synthesis,
// voice activity detection (speaking indicator), and per-participant volume control (0%-200%).

let sharedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// Notification chime sounds synthesized with Web Audio API oscillators
export function playNotificationSound(type: "message" | "alert" | "join" | "leave" | "moderation") {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (type === "message") {
      // Gentle two-tone chime
      const osc1 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);
    } else if (type === "join") {
      // Pleasant upward welcome ping
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "leave") {
      // Soft downward ping
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(392, now + 0.18);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "moderation" || type === "alert") {
      // Distinct cautionary chord
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setValueAtTime(261.63, now + 0.1);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch {
    // AudioContext autoplay restrictions or error ignored safely
  }
}

// Voice Activity Detector (RMS threshold) for speaking indicator
export class VoiceActivityDetector {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private animFrameId: number | null = null;
  private isSpeaking = false;
  private lastSpeakingTime = 0;
  private onSpeakingChange: (speaking: boolean) => void;

  constructor(onSpeakingChange: (speaking: boolean) => void) {
    this.onSpeakingChange = onSpeakingChange;
  }

  public start(stream: MediaStream) {
    this.stop();
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      this.ctx = getAudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;
      this.source = this.ctx.createMediaStreamSource(stream);
      this.source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkAudio = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // Threshold for speaking detection (approx > 15 out of 255)
        const threshold = 18;
        const now = Date.now();

        if (average > threshold) {
          this.lastSpeakingTime = now;
          if (!this.isSpeaking) {
            this.isSpeaking = true;
            this.onSpeakingChange(true);
          }
        } else if (this.isSpeaking && now - this.lastSpeakingTime > 400) {
          // 400ms hold so it doesn't flicker between syllables
          this.isSpeaking = false;
          this.onSpeakingChange(false);
        }

        this.animFrameId = requestAnimationFrame(checkAudio);
      };

      this.animFrameId = requestAnimationFrame(checkAudio);
    } catch (e) {
      console.warn("Could not start VoiceActivityDetector:", e);
    }
  }

  public stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {}
      this.source = null;
    }
    if (this.analyser) {
      this.analyser = null;
    }
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.onSpeakingChange(false);
    }
  }
}

// Remote Audio Node Controller per participant (Volume 0-200% & Mute)
export class ParticipantAudioNode {
  private ctx: AudioContext;
  private source: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode;
  private isMuted: boolean = false;
  private volume: number = 100; // 0 to 200 (%)

  constructor(stream: MediaStream) {
    this.ctx = getAudioContext();
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.gainNode.connect(this.ctx.destination);

    if (stream.getAudioTracks().length > 0) {
      this.source = this.ctx.createMediaStreamSource(stream);
      this.source.connect(this.gainNode);
    }
  }

  public setVolume(percent: number) {
    this.volume = Math.max(0, Math.min(200, percent));
    if (!this.isMuted) {
      const gainValue = this.volume / 100;
      this.gainNode.gain.setValueAtTime(gainValue, this.ctx.currentTime);
    }
  }

  public setMute(mute: boolean) {
    this.isMuted = mute;
    if (this.isMuted) {
      this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    } else {
      const gainValue = this.volume / 100;
      this.gainNode.gain.setValueAtTime(gainValue, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public dispose() {
    try {
      if (this.source) this.source.disconnect();
      this.gainNode.disconnect();
    } catch {}
  }
}
