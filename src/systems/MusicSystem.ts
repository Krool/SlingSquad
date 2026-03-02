/// <reference types="vite/client" />

// Auto-catalog: Vite discovers every .mp3 in assets/music/ at build time.
// Drop a file into any category folder — it's picked up automatically.
const ALL_MUSIC = import.meta.glob(
  '/assets/music/**/*.mp3',
  { query: '?url', import: 'default' },
) as Record<string, () => Promise<string>>;

export type MusicCategory =
  | 'battle' | 'boss'    | 'defeat' | 'event'
  | 'map'    | 'menu'    | 'shop'   | 'victory';

const CATEGORIES: MusicCategory[] = [
  'battle', 'boss', 'defeat', 'event', 'map', 'menu', 'shop', 'victory',
];

// Build the catalog from glob keys at module-load time.
// Key format: /assets/music/<category>/<filename>.mp3
const CATALOG = Object.fromEntries(
  CATEGORIES.map(c => [c, [] as string[]]),
) as Record<MusicCategory, string[]>;

for (const key of Object.keys(ALL_MUSIC)) {
  const match = key.match(/\/assets\/music\/([^/]+)\//);
  if (match) {
    const cat = match[1] as MusicCategory;
    if (cat in CATALOG) CATALOG[cat].push(key);
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const MUSIC_STORAGE_KEY = 'slingsquad_music_v1';

export interface MusicSettings {
  volume: number; // 0–1
  muted:  boolean;
}

export function loadMusicSettings(): MusicSettings {
  try {
    const raw = localStorage.getItem(MUSIC_STORAGE_KEY);
    if (raw) return { volume: 0.5, muted: false, ...JSON.parse(raw) };
  } catch { /* */ }
  return { volume: 0.5, muted: false };
}

function saveMusicSettings(s: MusicSettings) {
  try { localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(s)); } catch { /* */ }
}

// ─── MusicSystem ─────────────────────────────────────────────────────────────

export class MusicSystem {
  private volume: number;
  private muted: boolean;

  private currentEl: HTMLAudioElement | null = null;
  private currentCategory: MusicCategory | null = null;
  private lastPlayed = new Map<MusicCategory, string>();

  // ── Race-condition guard ──────────────────────────────────────────────────
  // Bumped on every crossfadeTo() call and on stop().
  // Each async crossfadeTo captures its gen and bails out if it becomes stale.
  private _gen = 0;

  // ── Fade interval tracking ───────────────────────────────────────────────
  // Stores interval IDs from fadeIn/fadeOut so stop() can clear abandoned ones.
  private _fadeIntervals: number[] = [];

  // ── Autoplay-unblock listener ─────────────────────────────────────────────
  // Stored so we can remove it before starting a new track (avoids stale
  // callbacks firing for a track that's no longer relevant).
  private _pendingResume: (() => void) | null = null;

  // ── Foreground-resume tracking ────────────────────────────────────────────
  // Mobile browsers pause HTMLAudio when the app backgrounds. We track intent
  // so we can restart the track when the page becomes visible again.
  private _wasPlayingOnHide = false;

  constructor() {
    const s = loadMusicSettings();
    this.volume = s.volume;
    this.muted  = s.muted;
    this._setupVisibilityHandling();
  }

  /**
   * Switch to a category. No-ops if this category is already playing.
   * Crossfades from the current track.
   */
  play(category: MusicCategory): void {
    const tracks = CATALOG[category];
    if (!tracks.length) return; // folder empty — stay silent

    // Already playing this category and the element is running — don't interrupt.
    if (
      this.currentCategory === category &&
      this.currentEl &&
      !this.currentEl.paused
    ) return;

    const key = this.pickTrack(category, tracks);
    this.crossfadeTo(key, category);
  }

  /** Fade out and stop completely. */
  stop(fadeDuration = 800): void {
    this._gen++;                   // invalidates any in-flight crossfadeTo
    this._cancelPendingResume();
    this._fadeIntervals.forEach(clearInterval);
    this._fadeIntervals = [];
    if (!this.currentEl) return;
    const el = this.currentEl;
    this.currentEl       = null;
    this.currentCategory = null;
    this.fadeOut(el, fadeDuration, () => { el.pause(); el.src = ''; });
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.currentEl && !this.muted) this.currentEl.volume = this.volume;
    saveMusicSettings({ volume: this.volume, muted: this.muted });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.currentEl) this.currentEl.volume = muted ? 0 : this.volume;
    saveMusicSettings({ volume: this.volume, muted: this.muted });
  }

  getSettings(): MusicSettings {
    return { volume: this.volume, muted: this.muted };
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private pickTrack(category: MusicCategory, tracks: string[]): string {
    if (tracks.length === 1) return tracks[0];
    const last = this.lastPlayed.get(category);
    const pool = tracks.filter(t => t !== last);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.lastPlayed.set(category, pick);
    return pick;
  }

  private _cancelPendingResume(): void {
    if (this._pendingResume) {
      document.removeEventListener('pointerdown', this._pendingResume);
      this._pendingResume = null;
    }
  }

  private async crossfadeTo(viteKey: string, category: MusicCategory): Promise<void> {
    // Capture this call's generation. If _gen changes before the await resolves,
    // a newer call has taken over and we must bail.
    const gen      = ++this._gen;
    const outgoing = this.currentEl;

    // Remove any stale autoplay-unblock listener before we do anything else.
    this._cancelPendingResume();

    // Resolve the asset URL via Vite's lazy importer.
    let url: string;
    try {
      url = await (ALL_MUSIC[viteKey] as () => Promise<string>)();
    } catch {
      return; // file missing — fail silently
    }

    // Another crossfadeTo or stop() ran while we were awaiting the URL.
    if (gen !== this._gen) return;

    this.currentCategory = category;

    // Verify the URL is reachable before creating an Audio element.
    // This prevents "Invalid URI" console errors when music files are missing
    // (e.g. gitignored assets not present in the deployed build).
    try {
      const probe = await fetch(url, { method: 'HEAD' });
      if (!probe.ok) return; // file missing on server — stay silent
    } catch {
      return; // network error — stay silent
    }

    // Re-check generation after the async probe
    if (gen !== this._gen) return;

    const el = new Audio(url);
    el.loop    = true;
    el.volume  = 0; // start silent; fade in after play() resolves
    el.preload = 'auto';
    this.currentEl = el;

    // Fade out whatever was playing before (fire and forget).
    if (outgoing) {
      this.fadeOut(outgoing, 600, () => { outgoing.pause(); outgoing.src = ''; });
    }

    // Handle load errors (404, network issues) — clean up without console noise.
    const onError = () => {
      if (this.currentEl === el) {
        this.currentEl = null;
        this.currentCategory = null;
      }
      el.removeAttribute('src');
    };
    el.addEventListener('error', onError, { once: true });

    // Kick off playback once enough data is buffered.
    const startPlay = () => {
      if (this.currentEl !== el) return; // superseded

      el.play()
        .then(() => {
          // Playback actually started — NOW begin the fade-in.
          this.fadeIn(el, 800);
        })
        .catch(() => {
          // Autoplay blocked — browser requires a user gesture first.
          // Queue a one-shot resume on the next tap/click anywhere on the page.
          const resume = () => {
            this._pendingResume = null;
            if (this.currentEl !== el) return; // superseded while we were waiting
            el.play()
              .then(() => this.fadeIn(el, 400))
              .catch(() => { /* still blocked — give up gracefully */ });
          };
          this._pendingResume = resume;
          document.addEventListener('pointerdown', resume, { once: true });
        });
    };

    if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      startPlay();
    } else {
      el.addEventListener('canplay', startPlay, { once: true });
    }
  }

  /**
   * Mobile browsers pause HTMLAudio when the page is hidden.
   * Resume the track automatically when the user returns to the app.
   */
  private _setupVisibilityHandling(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Going to background: note whether we were actively playing.
        this._wasPlayingOnHide = !!this.currentEl && !this.currentEl.paused;
      } else {
        // Returning to foreground: resume if we were playing before.
        if (this._wasPlayingOnHide && this.currentEl) {
          this.currentEl.play().catch(() => {
            // Still blocked — user will need to tap. That's fine.
          });
        }
      }
    });
  }

  private fadeOut(el: HTMLAudioElement, duration: number, onDone: () => void): void {
    const STEPS    = 20;
    const interval = duration / STEPS;
    const startVol = el.volume;
    let step = 0;
    const id = setInterval(() => {
      step++;
      el.volume = Math.max(0, startVol * (1 - step / STEPS));
      if (step >= STEPS) { clearInterval(id); this._fadeIntervals = this._fadeIntervals.filter(i => i !== id); onDone(); }
    }, interval) as unknown as number;
    this._fadeIntervals.push(id);
  }

  private fadeIn(el: HTMLAudioElement, duration: number): void {
    const target   = this.muted ? 0 : this.volume;
    const STEPS    = 20;
    const interval = duration / STEPS;
    let step = 0;
    const id = setInterval(() => {
      if (this.currentEl !== el) { clearInterval(id); this._fadeIntervals = this._fadeIntervals.filter(i => i !== id); return; }
      step++;
      el.volume = Math.min(target, target * (step / STEPS));
      if (step >= STEPS) { clearInterval(id); this._fadeIntervals = this._fadeIntervals.filter(i => i !== id); }
    }, interval) as unknown as number;
    this._fadeIntervals.push(id);
  }
}
