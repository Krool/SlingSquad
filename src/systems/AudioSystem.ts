// ─── Settings persistence ──────────────────────────────────────────────────────
const AUDIO_KEY = 'slingsquad_audio_v1';

export interface AudioSettings {
  sfxVolume: number; // 0–1
  muted: boolean;
}

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(AUDIO_KEY);
    if (raw) return { sfxVolume: 0.7, muted: false, ...JSON.parse(raw) };
  } catch { /* */ }
  return { sfxVolume: 0.7, muted: false };
}

export function saveAudioSettings(s: AudioSettings) {
  try { localStorage.setItem(AUDIO_KEY, JSON.stringify(s)); } catch { /* */ }
}

/**
 * AudioSystem — procedural Web Audio API sounds.
 * No external assets required. Gracefully no-ops if audio is unavailable.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private sfxVolume: number;
  private muted: boolean;

  constructor() {
    const s = loadAudioSettings();
    this.sfxVolume = s.sfxVolume;
    this.muted     = s.muted;
  }

  /** Update SFX volume (0–1). Persists to localStorage. */
  setVolume(sfxVolume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, sfxVolume));
    saveAudioSettings({ sfxVolume: this.sfxVolume, muted: this.muted });
  }

  /** Toggle mute. Persists to localStorage. */
  setMuted(muted: boolean) {
    this.muted = muted;
    saveAudioSettings({ sfxVolume: this.sfxVolume, muted });
  }

  getSettings(): AudioSettings {
    return { sfxVolume: this.sfxVolume, muted: this.muted };
  }

  private getCtx(): AudioContext | null {
    if (!this.enabled || this.muted) return null;
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume(); // resume after user gesture (autoplay policy)
      }
      return this.ctx;
    } catch {
      this.enabled = false;
      return null;
    }
  }

  /** Whoosh on hero launch */
  playLaunch() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.12 * this.sfxVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    } catch { /* non-critical */ }
  }

  /** Crack/thud when a block is destroyed */
  playBlockHit(material: 'WOOD' | 'STONE' | 'ICE' | 'OBSIDIAN') {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
      const dur  = 0.12;
      const buf  = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.5);
      }
      const src    = ctx.createBufferSource();
      src.buffer   = buf;
      const filter = ctx.createBiquadFilter();
      filter.type  = 'bandpass';
      const freqMap: Record<string, number> = { WOOD: 650, STONE: 1600, ICE: 2800, OBSIDIAN: 1200 };
      filter.frequency.value = freqMap[material] ?? 650;
      filter.Q.value = 2.5;
      const volMap: Record<string, number> = { WOOD: 0.20, STONE: 0.28, ICE: 0.24, OBSIDIAN: 0.32 };
      const gain = ctx.createGain();
      gain.gain.setValueAtTime((volMap[material] ?? 0.20) * this.sfxVolume, ctx.currentTime);
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start(ctx.currentTime);
    } catch { /* non-critical */ }
  }

  /** Low boom on barrel / mage explosion */
  playExplosion() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;

      // Boom oscillator
      const osc  = ctx.createOscillator();
      const oGain = ctx.createGain();
      osc.connect(oGain); oGain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.45);
      oGain.gain.setValueAtTime(0.45 * this.sfxVolume, ctx.currentTime);
      oGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);

      // Noise burst
      const nDur  = 0.35;
      const nBuf  = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * nDur), ctx.sampleRate);
      const nData = nBuf.getChannelData(0);
      for (let i = 0; i < nData.length; i++) {
        nData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nData.length, 1.5);
      }
      const nSrc  = ctx.createBufferSource();
      nSrc.buffer = nBuf;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.28 * this.sfxVolume, ctx.currentTime);
      nSrc.connect(nGain); nGain.connect(ctx.destination);
      nSrc.start(ctx.currentTime);
    } catch { /* non-critical */ }
  }

  /** Short pop when an enemy dies */
  playEnemyDeath() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(580, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.07 * this.sfxVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.14);
    } catch { /* non-critical */ }
  }

  /** Bright ascending arpeggio on coin pickup */
  playCoinPickup() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
      // Three-note ascending figure: A5 → C#6 → E6
      const freqs = [880, 1108, 1320];
      freqs.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'square';
        const t = ctx.currentTime + i * 0.055;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.07 * this.sfxVolume, t + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
        osc.start(t); osc.stop(t + 0.12);
      });
    } catch { /* non-critical */ }
  }

  /** Four-note ascending fanfare on victory */
  playWin() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
      // C5 → E5 → G5 → C6
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'triangle';
        const t   = ctx.currentTime + i * 0.11;
        const vol = (i === notes.length - 1 ? 0.20 : 0.13) * this.sfxVolume;
        const dur = i === notes.length - 1 ? 0.55 : 0.25;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t); osc.stop(t + dur + 0.05);
      });
    } catch { /* non-critical */ }
  }

  /** Three descending tones on defeat */
  playLose() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
      // G4 → E4 → C4
      const notes = [392, 330, 262];
      notes.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.22;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15 * this.sfxVolume, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        osc.start(t); osc.stop(t + 0.60);
      });
    } catch { /* non-critical */ }
  }

  /** Meaty thud when a hero lands */
  playHeroLand() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
      const dur  = 0.09;
      const buf  = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
      }
      const src  = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.32 * this.sfxVolume, ctx.currentTime);
      src.connect(gain); gain.connect(ctx.destination);
      src.start(ctx.currentTime);
    } catch { /* non-critical */ }
  }
}
