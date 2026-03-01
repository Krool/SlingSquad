import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/constants';

// ─── Settings Gear ─────────────────────────────────────────────────────────────

/**
 * Standardized 52x52 settings gear button at top-left (12,12).
 * Returns the hit rectangle for optional cleanup.
 */
export function buildSettingsGear(
  scene: Phaser.Scene,
  callerKey: string,
  depth = 20,
): Phaser.GameObjects.Rectangle {
  const size = 52, r = 10;
  const bg = scene.add.graphics().setDepth(depth);
  const draw = (hovered: boolean) => {
    bg.clear();
    bg.fillStyle(0x060b12, hovered ? 1 : 0.75);
    bg.fillRoundedRect(12, 12, size, size, r);
    bg.lineStyle(1, 0x3a5070, hovered ? 1 : 0.5);
    bg.strokeRoundedRect(12, 12, size, size, r);
  };
  draw(false);
  scene.add.text(12 + size / 2, 12 + size / 2, '\u2699', {
    fontSize: '28px', fontFamily: 'Nunito, sans-serif', color: '#c0c8d0',
  }).setOrigin(0.5).setDepth(depth + 1);

  const hit = scene.add.rectangle(12 + size / 2, 12 + size / 2, size, size, 0x000000, 0)
    .setInteractive({ useHandCursor: true }).setDepth(depth + 2);
  hit.on('pointerover', () => draw(true));
  hit.on('pointerout', () => draw(false));
  hit.on('pointerdown', () => {
    scene.scene.launch('SettingsScene', { callerKey });
  });
  return hit;
}

// ─── Procedural Icons ──────────────────────────────────────────────────────────

/** Draw a procedural gold coin icon at (cx, cy) on the given graphics. */
function drawCoinIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number) {
  // Outer coin
  g.fillStyle(0xf1c40f, 1);
  g.fillCircle(cx, cy, 9);
  // Inner ring
  g.fillStyle(0xd4a017, 0.5);
  g.fillCircle(cx, cy, 6);
  // Outer stroke
  g.lineStyle(1.5, 0xb8960f, 1);
  g.strokeCircle(cx, cy, 9);
}

/** Draw a procedural shard crystal icon at (cx, cy) on the given graphics. */
export function drawCrystalIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number) {
  // 4-point diamond polygon (rotated square)
  const s = 9; // half-size
  const points = [
    { x: cx, y: cy - s },      // top
    { x: cx + s * 0.7, y: cy }, // right
    { x: cx, y: cy + s },      // bottom
    { x: cx - s * 0.7, y: cy }, // left
  ];
  // Fill
  g.fillStyle(0x7ec8e3, 1);
  g.fillPoints(points, true);
  // Inner highlight
  const hs = s * 0.5;
  const hpoints = [
    { x: cx, y: cy - hs },
    { x: cx + hs * 0.7, y: cy },
    { x: cx, y: cy + hs },
    { x: cx - hs * 0.7, y: cy },
  ];
  g.fillStyle(0xb8e8f8, 0.4);
  g.fillPoints(hpoints, true);
  // Stroke
  g.lineStyle(1.5, 0x5aaac8, 1);
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  g.closePath();
  g.strokePath();
}

// ─── Currency Bar ──────────────────────────────────────────────────────────────

export interface CurrencyBarResult {
  container: Phaser.GameObjects.Container;
  updateValue: () => void;
}

/**
 * Standardized 110x40 currency panel at top-right.
 * @param type 'gold' or 'shard'
 * @param getValue Function that returns the current value to display.
 * @param depth Depth for the container.
 */
export function buildCurrencyBar(
  scene: Phaser.Scene,
  type: 'gold' | 'shard',
  getValue: () => number,
  depth = 10,
): CurrencyBarResult {
  const W = 110, H = 40, R = 7;
  const px = GAME_WIDTH - 126;
  const py = 12;

  const container = scene.add.container(px, py).setDepth(depth);

  // Background panel
  const bg = scene.add.graphics();
  bg.fillStyle(0x0d1526, 0.92);
  bg.fillRoundedRect(0, 0, W, H, R);
  bg.lineStyle(1, type === 'gold' ? 0xf1c40f : 0x5aaac8, 0.35);
  bg.strokeRoundedRect(0, 0, W, H, R);
  container.add(bg);

  // Icon
  const iconGfx = scene.add.graphics();
  if (type === 'gold') {
    drawCoinIcon(iconGfx, 18, H / 2);
  } else {
    drawCrystalIcon(iconGfx, 18, H / 2);
  }
  container.add(iconGfx);

  // Value text
  const textColor = type === 'gold' ? '#f1c40f' : '#7ec8e3';
  const maxTextW = W - 42; // 36px icon area + 6px right padding
  const valueText = scene.add.text(36, H / 2, `${getValue()}`, {
    fontSize: '20px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif',
    color: textColor, stroke: '#000', strokeThickness: 2,
    maxLines: 1,
  }).setOrigin(0, 0.5);
  container.add(valueText);

  const fitText = () => {
    valueText.setFontSize(20);
    if (valueText.width > maxTextW) valueText.setFontSize(16);
    if (valueText.width > maxTextW) valueText.setFontSize(13);
  };
  fitText();

  // Clickable hit area for popover
  const hit = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  container.add(hit);
  hit.on('pointerdown', () => {
    showCurrencyPopover(scene, type, px + W / 2, py + H + 6);
  });

  const updateValue = () => {
    valueText.setText(`${getValue()}`);
    fitText();
  };

  return { container, updateValue };
}

// ─── Currency Popover ──────────────────────────────────────────────────────────

/** Currently active popover container (scene-level singleton). */
const _popovers = new WeakMap<Phaser.Scene, Phaser.GameObjects.Container>();
const _popoverListeners = new WeakMap<Phaser.Scene, () => void>();

function dismissPopover(scene: Phaser.Scene) {
  const listener = _popoverListeners.get(scene);
  if (listener) {
    scene.input.off('pointerdown', listener);
    _popoverListeners.delete(scene);
  }
  const existing = _popovers.get(scene);
  if (existing) {
    existing.destroy();
    _popovers.delete(scene);
  }
}

/**
 * Show an info popover below the currency bar.
 * Auto-dismisses after 4s or on click elsewhere.
 */
export function showCurrencyPopover(
  scene: Phaser.Scene,
  type: 'gold' | 'shard',
  anchorX: number,
  anchorY: number,
) {
  dismissPopover(scene);

  const PW = 240, PH = 90, PR = 8;
  const px = Phaser.Math.Clamp(anchorX - PW / 2, 10, GAME_WIDTH - PW - 10);

  const container = scene.add.container(px, anchorY).setDepth(100).setAlpha(0);
  _popovers.set(scene, container);

  // Background
  const bg = scene.add.graphics();
  bg.fillStyle(0x0a1220, 0.96);
  bg.fillRoundedRect(0, 0, PW, PH, PR);
  bg.lineStyle(1, type === 'gold' ? 0xf1c40f : 0x5aaac8, 0.5);
  bg.strokeRoundedRect(0, 0, PW, PH, PR);
  container.add(bg);

  // Icon
  const iconGfx = scene.add.graphics();
  if (type === 'gold') {
    drawCoinIcon(iconGfx, 22, 24);
  } else {
    drawCrystalIcon(iconGfx, 22, 24);
  }
  container.add(iconGfx);

  // Title
  const title = type === 'gold' ? 'Gold' : 'Shards';
  const titleColor = type === 'gold' ? '#f1c40f' : '#7ec8e3';
  container.add(scene.add.text(38, 16, title, {
    fontSize: '18px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif',
    color: titleColor, stroke: '#000', strokeThickness: 2,
  }).setOrigin(0, 0.5));

  // Description
  const desc = type === 'gold'
    ? 'Earned from battles.\nSpent at shops.'
    : 'Earned at end of runs.\nSpent on camp upgrades.';
  container.add(scene.add.text(PW / 2, 56, desc, {
    fontSize: '13px', fontFamily: 'Nunito, sans-serif', color: '#7a9ab8',
    align: 'center', lineSpacing: 2,
  }).setOrigin(0.5, 0.5));

  // Fade in
  scene.tweens.add({ targets: container, alpha: 1, duration: 150 });

  // Auto-dismiss after 4s
  const timer = scene.time.delayedCall(4000, () => dismissPopover(scene));

  // Click-elsewhere dismiss
  const onPointerDown = () => {
    timer.destroy();
    dismissPopover(scene);
  };
  _popoverListeners.set(scene, onPointerDown);
  // Delay attaching the listener so the opening click doesn't immediately close it
  scene.time.delayedCall(100, () => {
    scene.input.on('pointerdown', onPointerDown);
  });
}

// ─── Back Button ───────────────────────────────────────────────────────────────

/**
 * Standardized back button at bottom-left (90, GAME_HEIGHT-52).
 */
export function buildBackButton(
  scene: Phaser.Scene,
  label: string,
  color: number,
  onClick: () => void,
  depth = 15,
): Phaser.GameObjects.Container {
  const w = 150, h = 44, r = 8;
  const bx = 90, by = GAME_HEIGHT - 52;

  const container = scene.add.container(bx, by).setDepth(depth);

  const bg = scene.add.graphics();
  const dark = Phaser.Display.Color.IntegerToColor(color);
  const drawBg = (hovered: boolean) => {
    bg.clear();
    const mult = hovered ? 0.35 : 0.15;
    const bgColor = Phaser.Display.Color.GetColor(
      Math.floor(dark.red * mult),
      Math.floor(dark.green * mult),
      Math.floor(dark.blue * mult),
    );
    bg.fillStyle(bgColor, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    bg.lineStyle(hovered ? 2 : 1, color, hovered ? 1 : 0.6);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  };
  drawBg(false);
  container.add(bg);

  const accentHex = '#' + color.toString(16).padStart(6, '0');
  container.add(
    scene.add.text(0, 0, label, {
      fontSize: '17px', fontFamily: 'Nunito, sans-serif',
      color: accentHex, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5),
  );

  const hit = scene.add.rectangle(0, 0, w, h, 0, 0)
    .setInteractive({ useHandCursor: true });
  container.add(hit);
  hit.on('pointerover', () => drawBg(true));
  hit.on('pointerout', () => drawBg(false));
  hit.on('pointerdown', onClick);

  return container;
}
