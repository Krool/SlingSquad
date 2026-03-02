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

// ─── SFX catalog (auto-discovered via Vite import.meta.glob) ────────────────
const sfxModules = import.meta.glob('/assets/sfx/**/*.mp3', { query: '?url', eager: true }) as Record<string, { default: string }>;

/** Build category → url[] map from folder structure. */
function buildSfxCatalog(): Record<string, string[]> {
  const catalog: Record<string, string[]> = {};
  for (const [path, mod] of Object.entries(sfxModules)) {
    // path looks like "/assets/sfx/launch/whoosh_01.mp3"
    const parts = path.replace('/assets/sfx/', '').split('/');
    if (parts.length < 2) continue;
    const category = parts[0];
    if (!catalog[category]) catalog[category] = [];
    catalog[category].push(mod.default);
  }
  return catalog;
}

/**
 * AudioSystem — file-based SFX playback with procedural fallback.
 * Uses Web Audio API for low-latency playback. MP3 assets loaded via Vite glob.
 * Gracefully no-ops if audio is unavailable.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private sfxVolume: number;
  private muted: boolean;
  private catalog: Record<string, string[]>;
  private bufferCache = new Map<string, AudioBuffer>();

  constructor() {
    const s = loadAudioSettings();
    this.sfxVolume = s.sfxVolume;
    this.muted     = s.muted;
    this.catalog   = buildSfxCatalog();
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
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      this.enabled = false;
      return null;
    }
  }

  // ─── File-based SFX playback ──────────────────────────────────────────────

  /** Play a random SFX from the given category folder. */
  private playSfx(category: string, volume = 0.5) {
    const urls = this.catalog[category];
    if (!urls || urls.length === 0) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    const url = urls[Math.floor(Math.random() * urls.length)];
    const cached = this.bufferCache.get(url);
    if (cached) {
      this.playBuffer(ctx, cached, volume);
    } else {
      // Fetch + decode + cache + play
      fetch(url)
        .then(r => r.arrayBuffer())
        .then(ab => ctx.decodeAudioData(ab))
        .then(buf => {
          this.bufferCache.set(url, buf);
          this.playBuffer(ctx, buf, volume);
        })
        .catch(() => { /* non-critical */ });
    }
  }

  private playBuffer(ctx: AudioContext, buffer: AudioBuffer, volume: number) {
    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume * this.sfxVolume, ctx.currentTime);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(ctx.currentTime);
    } catch { /* non-critical */ }
  }

  // ─── Public API: existing methods redirect to file-based or procedural ────

  /** Whoosh on hero launch */
  playLaunch() {
    if (this.catalog['launch']?.length) {
      this.playSfx('launch', 0.4);
    } else {
      this.playLaunchProcedural();
    }
  }

  /** Crack/thud when a block is destroyed */
  playBlockHit(material: 'WOOD' | 'STONE' | 'ICE' | 'OBSIDIAN') {
    const catMap: Record<string, string> = { WOOD: 'block_wood', STONE: 'block_stone', ICE: 'block_ice', OBSIDIAN: 'block_stone' };
    const cat = catMap[material] ?? 'block_wood';
    if (this.catalog[cat]?.length) {
      this.playSfx(cat, 0.5);
    } else {
      this.playBlockHitProcedural(material);
    }
  }

  /** Low boom on barrel / mage explosion */
  playExplosion() {
    if (this.catalog['explosion']?.length) {
      this.playSfx('explosion', 0.6);
    } else {
      this.playExplosionProcedural();
    }
  }

  /** Short pop when an enemy dies */
  playEnemyDeath() {
    if (this.catalog['enemy_death']?.length) {
      this.playSfx('enemy_death', 0.4);
    } else {
      this.playEnemyDeathProcedural();
    }
  }

  /** Bright ascending arpeggio on coin pickup */
  playCoinPickup() {
    if (this.catalog['coin']?.length) {
      this.playSfx('coin', 0.35);
    } else {
      this.playCoinPickupProcedural();
    }
  }

  /** Four-note ascending fanfare on victory */
  playWin() {
    // Always procedural — the fanfare is iconic and hard to replace with a single clip
    this.playWinProcedural();
  }

  /** Three descending tones on defeat */
  playLose() {
    this.playLoseProcedural();
  }

  /** Meaty thud when a hero lands */
  playHeroLand() {
    if (this.catalog['hero_land']?.length) {
      this.playSfx('hero_land', 0.5);
    } else {
      this.playHeroLandProcedural();
    }
  }

  // ─── New SFX methods ─────────────────────────────────────────────────────

  /** UI button click */
  playButtonClick() {
    if (this.catalog['button']?.length) {
      this.playSfx('button', 0.3);
    } else {
      this.playClickProcedural();
    }
  }

  /** Shop purchase cha-ching */
  playPurchase() {
    if (this.catalog['purchase']?.length) {
      this.playSfx('purchase', 0.4);
    } else {
      this.playPurchaseProcedural();
    }
  }

  /** Relic acquired notification */
  playRelicPickup() {
    if (this.catalog['relic_pickup']?.length) {
      this.playSfx('relic_pickup', 0.4);
    } else {
      this.playRelicPickupProcedural();
    }
  }

  /** Map node selection */
  playNodeSelect() {
    if (this.catalog['node_select']?.length) {
      this.playSfx('node_select', 0.3);
    } else {
      this.playClickProcedural();
    }
  }

  /** Ranger arrow fire */
  playArrowFire() {
    if (this.catalog['arrow']?.length) {
      this.playSfx('arrow', 0.35);
    } else {
      this.playArrowProcedural();
    }
  }

  /** Mage spell cast */
  playMagicCast() {
    if (this.catalog['magic']?.length) {
      this.playSfx('magic', 0.4);
    } else {
      this.playMagicProcedural();
    }
  }

  /** Priest heal aura */
  playHealAura() {
    if (this.catalog['heal']?.length) {
      this.playSfx('heal', 0.35);
    } else {
      this.playHealProcedural();
    }
  }

  // ─── Procedural fallbacks (original synthesized SFX) ──────────────────────

  private playLaunchProcedural() {
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

  private playBlockHitProcedural(material: string) {
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

  private playExplosionProcedural() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
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

  private playEnemyDeathProcedural() {
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

  private playCoinPickupProcedural() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
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

  private playWinProcedural() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
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

  private playLoseProcedural() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
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

  private playHeroLandProcedural() {
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

  // ─── Procedural fallbacks for new SFX methods ───────────────────────────

  /** Short click tick */
  private playClickProcedural() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.12 * this.sfxVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.07);
    } catch { /* non-critical */ }
  }

  /** Cash register cha-ching (two quick tones) */
  private playPurchaseProcedural() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.08;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.14 * this.sfxVolume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.start(t); osc.stop(t + 0.13);
      });
    } catch { /* non-critical */ }
  }

  /** Shimmering notification chime */
  private playRelicPickupProcedural() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
      [660, 880, 1100].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.06;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.10 * this.sfxVolume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t); osc.stop(t + 0.20);
      });
    } catch { /* non-critical */ }
  }

  /** Quick bow twang */
  private playArrowProcedural() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.10 * this.sfxVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.10);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.11);
    } catch { /* non-critical */ }
  }

  /** Magical shimmer sweep */
  private playMagicProcedural() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12 * this.sfxVolume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.20);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.22);
    } catch { /* non-critical */ }
  }

  /** Soft ascending heal tone */
  private playHealProcedural() {
    try {
      const ctx = this.getCtx(); if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.20);
      gain.gain.setValueAtTime(0.08 * this.sfxVolume, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.10 * this.sfxVolume, ctx.currentTime + 0.10);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.30);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.32);
    } catch { /* non-critical */ }
  }
}
