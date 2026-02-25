import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/constants';
import { loadAudioSettings, saveAudioSettings, type AudioSystem } from '@/systems/AudioSystem';
import { loadMusicSettings, type MusicSystem } from '@/systems/MusicSystem';

export class SettingsScene extends Phaser.Scene {
  private callerKey = '';

  constructor() {
    super({ key: 'SettingsScene' });
  }

  create(data?: { callerKey?: string }) {
    this.callerKey = data?.callerKey ?? '';
    if (this.callerKey) this.scene.pause(this.callerKey);

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // ── Full-screen dim (blocks input to scenes below) ─────────────────────
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
      .setDepth(0).setInteractive();

    // ── Panel ───────────────────────────────────────────────────────────────
    const pw = 500, ph = 360, pr = 14;
    const panel = this.add.graphics().setDepth(1);
    panel.fillStyle(0x0a1220, 0.97);
    panel.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, pr);
    panel.lineStyle(2, 0xf1c40f, 0.30);
    panel.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, pr);
    // Subtle inner inset
    panel.lineStyle(1, 0x3a5070, 0.20);
    panel.strokeRoundedRect(cx - pw / 2 + 4, cy - ph / 2 + 4, pw - 8, ph - 8, pr - 2);

    // ── Title ────────────────────────────────────────────────────────────────
    this.add.text(cx, cy - 150, '⚙  SETTINGS', {
      fontSize: '26px', fontFamily: 'Georgia, serif',
      color: '#f1c40f', stroke: '#000', strokeThickness: 3,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(2);

    // Divider
    const div = this.add.graphics().setDepth(2);
    div.lineStyle(1, 0xf1c40f, 0.18);
    div.lineBetween(cx - 210, cy - 122, cx + 210, cy - 122);

    // ── Load current settings ────────────────────────────────────────────────
    const audio = this.registry.get('audio') as AudioSystem | null;
    const music = this.registry.get('music') as MusicSystem | null;
    const saved      = loadAudioSettings();
    const savedMusic = loadMusicSettings();

    // ── SFX Volume slider ────────────────────────────────────────────────────
    this.add.text(cx - 200, cy - 95, 'SFX Volume', {
      fontSize: '14px', fontFamily: 'Georgia, serif', color: '#8aa0be',
      letterSpacing: 1,
    }).setDepth(2);

    this.buildSlider(cx, cy - 60, saved.sfxVolume, (val) => {
      if (audio) {
        audio.setVolume(val); // live effect + persists via AudioSystem
      } else {
        saveAudioSettings({ ...loadAudioSettings(), sfxVolume: val }); // persist without live AudioSystem
      }
    });

    // ── Music Volume ──────────────────────────────────────────────────────
    this.add.text(cx - 200, cy + 10, 'Music Volume', {
      fontSize: '14px', fontFamily: 'Georgia, serif', color: '#8aa0be',
      letterSpacing: 1,
    }).setDepth(2);

    this.buildSlider(cx, cy + 45, savedMusic.volume, (val) => {
      if (music) {
        music.setVolume(val);
      }
    });

    // ── Mute All toggle ───────────────────────────────────────────────────
    this.buildMuteToggle(cx, cy + 115, saved.muted, (muted) => {
      if (audio) {
        audio.setMuted(muted);
      } else {
        saveAudioSettings({ ...loadAudioSettings(), muted });
      }
      music?.setMuted(muted);
    });

    // ── Close button ─────────────────────────────────────────────────────
    this.buildCloseButton(cx, cy + 155);

    // ESC key closes
    this.input.keyboard?.addKey('ESC').on('down', () => this.closeSettings());
  }

  // ── Draggable slider ────────────────────────────────────────────────────
  private buildSlider(
    cx: number, cy: number, initialValue: number,
    onChange: ((val: number) => void) | null,
    disabled = false,
  ) {
    const trackW = 340, trackH = 8, thumbR = 10;
    const trackX = cx - trackW / 2;
    const alpha  = disabled ? 0.22 : 1;

    // Track bg
    const trackGfx = this.add.graphics().setDepth(3).setAlpha(alpha);
    trackGfx.fillStyle(0x1a2535, 1);
    trackGfx.fillRoundedRect(trackX, cy - trackH / 2, trackW, trackH, 4);

    // Fill
    const fillGfx = this.add.graphics().setDepth(4).setAlpha(disabled ? 0.2 : 1);
    const drawFill = (v: number) => {
      fillGfx.clear();
      if (v > 0) {
        const fillColor = disabled ? 0x3a4a5a : 0xf1c40f;
        fillGfx.fillStyle(fillColor, 1);
        fillGfx.fillRoundedRect(trackX, cy - trackH / 2, Math.max(trackH, trackW * v), trackH, 4);
      }
    };
    drawFill(initialValue);

    // Thumb
    const thumbGfx = this.add.graphics().setDepth(5).setAlpha(alpha);
    const drawThumb = (v: number) => {
      thumbGfx.clear();
      if (disabled) return;
      thumbGfx.fillStyle(0xf1c40f, 1);
      thumbGfx.fillCircle(trackX + trackW * v, cy, thumbR);
      thumbGfx.lineStyle(2, 0xfff8dc, 0.6);
      thumbGfx.strokeCircle(trackX + trackW * v, cy, thumbR);
    };
    drawThumb(initialValue);

    // Value text
    const valueTxt = this.add.text(cx + trackW / 2 + 20, cy, `${Math.round(initialValue * 100)}%`, {
      fontSize: '14px', fontFamily: 'Georgia, serif',
      color: disabled ? '#3a4a5a' : '#f1c40f',
    }).setOrigin(0, 0.5).setDepth(4);

    if (disabled || !onChange) return;

    // Interactive zone
    const hit = this.add.rectangle(cx, cy, trackW + thumbR * 2, 28, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(6);

    let isDragging = false;

    const applyX = (worldX: number) => {
      const v = Math.max(0, Math.min(1, (worldX - trackX) / trackW));
      drawFill(v);
      drawThumb(v);
      valueTxt.setText(`${Math.round(v * 100)}%`);
      onChange(v);
    };

    hit.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      isDragging = true;
      applyX(ptr.x);
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (isDragging) applyX(ptr.x);
    });
    this.input.on('pointerup', () => { isDragging = false; });
  }

  // ── Mute toggle button ──────────────────────────────────────────────────
  private buildMuteToggle(
    cx: number, cy: number, initialMuted: boolean,
    onChange: (muted: boolean) => void,
  ) {
    let muted = initialMuted;
    const w = 180, h = 40, r = 8;

    const bg = this.add.graphics().setDepth(3);
    const lbl = this.add.text(cx, cy, '', {
      fontSize: '15px', fontFamily: 'Georgia, serif',
    }).setOrigin(0.5).setDepth(4);

    const redraw = () => {
      bg.clear();
      if (muted) {
        bg.fillStyle(0x3a1010, 1);
        bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
        bg.lineStyle(2, 0xe74c3c, 0.8);
        bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
        lbl.setText('🔇  Muted').setColor('#e74c3c');
      } else {
        bg.fillStyle(0x0d2010, 1);
        bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
        bg.lineStyle(2, 0x2ecc71, 0.6);
        bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
        lbl.setText('🔈  Sound On').setColor('#2ecc71');
      }
    };
    redraw();

    const hit = this.add.rectangle(cx, cy, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(5);
    hit.on('pointerdown', () => {
      muted = !muted;
      redraw();
      onChange(muted);
    });
    hit.on('pointerover', () => { bg.setAlpha(0.8); });
    hit.on('pointerout', () => { bg.setAlpha(1); });
  }

  // ── Close button ────────────────────────────────────────────────────────
  private buildCloseButton(cx: number, cy: number) {
    const w = 160, h = 44, r = 8;
    const bg = this.add.graphics().setDepth(3);

    const draw = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(hovered ? 0x243550 : 0x101c2e, 1);
      bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
      bg.lineStyle(2, hovered ? 0xf1c40f : 0x3a5070, hovered ? 0.9 : 0.5);
      bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    };
    draw(false);

    this.add.text(cx, cy, 'Close', {
      fontSize: '18px', fontFamily: 'Georgia, serif', color: '#a0bcd0',
    }).setOrigin(0.5).setDepth(4);

    const hit = this.add.rectangle(cx, cy, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(5);
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => this.closeSettings());
  }

  private closeSettings() {
    if (this.callerKey) this.scene.resume(this.callerKey);
    this.scene.stop();
  }
}
