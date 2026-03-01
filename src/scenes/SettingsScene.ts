import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/constants';
import { loadAudioSettings, saveAudioSettings, type AudioSystem } from '@/systems/AudioSystem';
import { loadMusicSettings, type MusicSystem } from '@/systems/MusicSystem';
import { loadGameplaySettings, saveGameplaySettings } from '@/systems/GameplaySettings';

export class SettingsScene extends Phaser.Scene {
  private callerKey = '';

  constructor() {
    super({ key: 'SettingsScene' });
  }

  create(data?: { callerKey?: string }) {
    this.callerKey = data?.callerKey ?? '';
    if (this.callerKey) this.scene.pause(this.callerKey);
    this.scene.bringToTop();

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // ── Full-screen dim ────────────────────────────────────────────────────
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
      .setDepth(0).setInteractive();

    // ── Panel 520×440 ──────────────────────────────────────────────────────
    const pw = 520, ph = 440, pr = 14;
    const panel = this.add.graphics().setDepth(1);
    panel.fillStyle(0x0a1220, 0.97);
    panel.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, pr);
    panel.lineStyle(2, 0xf1c40f, 0.30);
    panel.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, pr);
    panel.lineStyle(1, 0x3a5070, 0.20);
    panel.strokeRoundedRect(cx - pw / 2 + 4, cy - ph / 2 + 4, pw - 8, ph - 8, pr - 2);

    // ── Title ──────────────────────────────────────────────────────────────
    this.add.text(cx, cy - 190, '\u2699  SETTINGS', {
      fontSize: '30px', fontFamily: 'Cinzel, Nunito, sans-serif',
      color: '#f1c40f', stroke: '#000', strokeThickness: 3,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(2);

    // Gold divider under title
    this.drawDivider(cx, cy - 165, 210, 0xf1c40f, 0.18);

    // ── AUDIO section ──────────────────────────────────────────────────────
    this.add.text(cx - 220, cy - 145, 'AUDIO', {
      fontSize: '13px', fontFamily: 'Nunito, sans-serif', color: '#4a6a8a',
      letterSpacing: 3,
    }).setDepth(2);

    const audio = this.registry.get('audio') as AudioSystem | null;
    const music = this.registry.get('music') as MusicSystem | null;
    const saved = loadAudioSettings();
    const savedMusic = loadMusicSettings();

    // SFX Volume
    this.add.text(cx - 200, cy - 115, 'SFX Volume', {
      fontSize: '16px', fontFamily: 'Nunito, sans-serif', color: '#8aa0be',
      letterSpacing: 1,
    }).setDepth(2);

    this.buildSlider(cx, cy - 85, saved.sfxVolume, (val) => {
      if (audio) {
        audio.setVolume(val);
      } else {
        saveAudioSettings({ ...loadAudioSettings(), sfxVolume: val });
      }
    });

    // Music Volume
    this.add.text(cx - 200, cy - 50, 'Music Volume', {
      fontSize: '16px', fontFamily: 'Nunito, sans-serif', color: '#8aa0be',
      letterSpacing: 1,
    }).setDepth(2);

    this.buildSlider(cx, cy - 20, savedMusic.volume, (val) => {
      if (music) {
        music.setVolume(val);
      }
    });

    // Mute toggle
    this.buildMuteToggle(cx, cy + 20, saved.muted, (muted) => {
      if (audio) {
        audio.setMuted(muted);
      } else {
        saveAudioSettings({ ...loadAudioSettings(), muted });
      }
      music?.setMuted(muted);
    });

    // ── Section divider ────────────────────────────────────────────────────
    this.drawDivider(cx, cy + 55, 210, 0xf1c40f, 0.12);

    // ── GAMEPLAY section ───────────────────────────────────────────────────
    this.add.text(cx - 220, cy + 65, 'GAMEPLAY', {
      fontSize: '13px', fontFamily: 'Nunito, sans-serif', color: '#4a6a8a',
      letterSpacing: 3,
    }).setDepth(2);

    const gpSettings = loadGameplaySettings();
    this.buildShakeToggle(cx, cy + 100, gpSettings.screenShake);

    // ── Section divider ────────────────────────────────────────────────────
    this.drawDivider(cx, cy + 140, 210, 0xf1c40f, 0.12);

    // ── Close button (bottom center) ───────────────────────────────────────
    this.buildCloseButton(cx, cy + 175);

    // ── X button (top-right corner of panel) ───────────────────────────────
    this.buildCornerClose(cx + pw / 2 - 20, cy - ph / 2 + 20);

    // ESC key closes
    this.input.keyboard?.addKey('ESC').on('down', () => this.closeSettings());

    this.events.once('shutdown', () => {
      this.input.off('pointermove');
      this.input.off('pointerup');
    });
  }

  // ── Divider helper ──────────────────────────────────────────────────────
  private drawDivider(cx: number, y: number, halfW: number, color: number, alpha: number) {
    const g = this.add.graphics().setDepth(2);
    g.lineStyle(1, color, alpha);
    g.lineBetween(cx - halfW, y, cx + halfW, y);
  }

  // ── Draggable slider ────────────────────────────────────────────────────
  private buildSlider(
    cx: number, cy: number, initialValue: number,
    onChange: ((val: number) => void) | null,
    disabled = false,
  ) {
    const trackW = 300, trackH = 8, thumbR = 10;
    const trackX = cx - trackW / 2 - 20;
    const alpha = disabled ? 0.22 : 1;

    const trackGfx = this.add.graphics().setDepth(3).setAlpha(alpha);
    trackGfx.fillStyle(0x1a2535, 1);
    trackGfx.fillRoundedRect(trackX, cy - trackH / 2, trackW, trackH, 4);

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

    const valueTxt = this.add.text(trackX + trackW + 16, cy, `${Math.round(initialValue * 100)}%`, {
      fontSize: '16px', fontFamily: 'Nunito, sans-serif',
      color: disabled ? '#6a7a8a' : '#f1c40f',
    }).setOrigin(0, 0.5).setDepth(4);

    if (disabled || !onChange) return;

    const hit = this.add.rectangle(cx - 20, cy, trackW + thumbR * 2, 28, 0x000000, 0)
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

  // ── Mute toggle ─────────────────────────────────────────────────────────
  private buildMuteToggle(
    cx: number, cy: number, initialMuted: boolean,
    onChange: (muted: boolean) => void,
  ) {
    let muted = initialMuted;
    const w = 220, h = 40, r = 8;

    const bg = this.add.graphics().setDepth(3);
    const lbl = this.add.text(cx, cy, '', {
      fontSize: '17px', fontFamily: 'Nunito, sans-serif',
    }).setOrigin(0.5).setDepth(4);

    const redraw = () => {
      bg.clear();
      if (muted) {
        bg.fillStyle(0x3a1010, 1);
        bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
        bg.lineStyle(2, 0xe74c3c, 0.8);
        bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
        lbl.setText('\ud83d\udd07  Muted').setColor('#e74c3c');
      } else {
        bg.fillStyle(0x0d2010, 1);
        bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
        bg.lineStyle(2, 0x2ecc71, 0.6);
        bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
        lbl.setText('\ud83d\udd08  Sound On').setColor('#2ecc71');
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

  // ── Screen Shake toggle ─────────────────────────────────────────────────
  private buildShakeToggle(cx: number, cy: number, initialEnabled: boolean) {
    let enabled = initialEnabled;
    const w = 220, h = 40, r = 8;

    const bg = this.add.graphics().setDepth(3);
    const lbl = this.add.text(cx, cy, '', {
      fontSize: '17px', fontFamily: 'Nunito, sans-serif',
    }).setOrigin(0.5).setDepth(4);

    const redraw = () => {
      bg.clear();
      if (enabled) {
        bg.fillStyle(0x0d2010, 1);
        bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
        bg.lineStyle(2, 0x2ecc71, 0.6);
        bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
        lbl.setText('Shake: On').setColor('#2ecc71');
      } else {
        bg.fillStyle(0x1a1a2a, 1);
        bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
        bg.lineStyle(2, 0x4a4a5a, 0.5);
        bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
        lbl.setText('Shake: Off').setColor('#6a6a7a');
      }
    };
    redraw();

    const hit = this.add.rectangle(cx, cy, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(5);
    hit.on('pointerdown', () => {
      enabled = !enabled;
      redraw();
      saveGameplaySettings({ ...loadGameplaySettings(), screenShake: enabled });
    });
    hit.on('pointerover', () => { bg.setAlpha(0.8); });
    hit.on('pointerout', () => { bg.setAlpha(1); });
  }

  // ── Close button (bottom center) ────────────────────────────────────────
  private buildCloseButton(cx: number, cy: number) {
    const w = 200, h = 48, r = 10;
    const bg = this.add.graphics().setDepth(3);

    const draw = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(hovered ? 0x243550 : 0x101c2e, 1);
      bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
      bg.lineStyle(2, hovered ? 0xf1c40f : 0x3a5070, hovered ? 0.9 : 0.5);
      bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    };
    draw(false);

    this.add.text(cx, cy, '\u2715  Close', {
      fontSize: '20px', fontFamily: 'Nunito, sans-serif', color: '#a0bcd0',
    }).setOrigin(0.5).setDepth(4);

    const hit = this.add.rectangle(cx, cy, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(5);
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => this.closeSettings());
  }

  // ── Corner X close (top-right of panel) ─────────────────────────────────
  private buildCornerClose(x: number, y: number) {
    const sz = 24;
    const bg = this.add.graphics().setDepth(3);
    const draw = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(hovered ? 0x3a1a1a : 0x0a1220, hovered ? 0.9 : 0.5);
      bg.fillCircle(x, y, sz / 2);
      bg.lineStyle(1, hovered ? 0xe74c3c : 0x4a5a6a, hovered ? 0.8 : 0.4);
      bg.strokeCircle(x, y, sz / 2);
    };
    draw(false);

    this.add.text(x, y, '\u2715', {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif',
      color: '#7a8a9a',
    }).setOrigin(0.5).setDepth(4);

    const hit = this.add.rectangle(x, y, sz, sz, 0x000000, 0)
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
