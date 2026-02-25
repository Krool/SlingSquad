import Phaser from 'phaser';
import nodesData from '@/data/nodes.json';
import type { MusicSystem } from '@/systems/MusicSystem';
import { newRun, getRunState, hasRunState, selectNode, loadRun, clearSave, reorderSquad, type NodeDef } from '@/systems/RunState';
import { GAME_WIDTH, GAME_HEIGHT, HERO_STATS } from '@/config/constants';
import type { HeroClass } from '@/config/constants';

const NODE_RADIUS = 26;
const NODE_COLORS: Record<string, number> = {
  BATTLE: 0xe74c3c,
  ELITE:  0x8e44ad,
  REWARD: 0xf1c40f,
  SHOP:   0x27ae60,
  BOSS:   0xc0392b,
  EVENT:  0x9b59b6,
  FORGE:  0xe67e22,
};
const NODE_ICONS: Record<string, string> = {
  BATTLE: '⚔',
  ELITE:  '★',
  REWARD: '◆',
  SHOP:   '●',
  BOSS:   '☠',
  EVENT:  '?',
  FORGE:  '⚒',
};
const RARITY_COLOR: Record<string, string> = {
  common:   '#95a5a6',
  uncommon: '#2ecc71',
  rare:     '#9b59b6',
};

/** Visual state of a node from the player's perspective */
type NodeState = 'completed' | 'available' | 'locked' | 'future';

// ─── Party panel content ───────────────────────────────────────────────────────
const HERO_DESCS: Partial<Record<string, string>> = {
  WARRIOR: 'Frontline bruiser. Smashes through walls and trades blows at melee range.',
  RANGER:  'Bouncy archer. Fires a spread of arrows at nearby enemies each time it lands.',
  MAGE:    'Area nuker. Creates a massive explosion on landing that hits all nearby enemies.',
  PRIEST:  'Holy healer. Pulses a healing aura to nearby allies on each landing.',
  BARD:    'Support trickster. Charms nearby enemies and boosts ally attack speed.',
};
const HERO_KEY_STAT: Partial<Record<string, string>> = {
  WARRIOR: '×1.4 vs structures',
  RANGER:  '3 arrows / bounce',
  MAGE:    '150 px blast radius',
  PRIEST:  '25 HP heal aura',
  BARD:    '20% speed aura',
};

export class OverworldScene extends Phaser.Scene {
  private nodeMap: NodeDef[] = [];

  private pathLayer!: Phaser.GameObjects.Graphics;
  private nodeContainers: Map<number, Phaser.GameObjects.Container> = new Map();
  private pulseTime = 0;

  private goldText!: Phaser.GameObjects.Text;
  private relicRow!: Phaser.GameObjects.Container;
  private tooltip!: Phaser.GameObjects.Container;
  /** Tracks which node was last tapped on touch — used for two-tap confirm. */
  private touchSelectedNodeId: number | null = null;

  // Party management panel
  private partyPanel:    Phaser.GameObjects.Container | null = null;
  private partyVeil:     Phaser.GameObjects.Rectangle | null = null;
  private squadPreviewCt!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'OverworldScene' });
  }

  create(data?: { fromBattle?: boolean }) {
    (this.registry.get('music') as MusicSystem | null)?.play('map');
    this.nodeContainers.clear();

    if (!hasRunState()) {
      if (!loadRun()) {
        const nodes = (nodesData as any).nodes as NodeDef[];
        newRun(nodes, ['WARRIOR', 'RANGER', 'MAGE', 'PRIEST'] as HeroClass[]);
      }
    }

    const run = getRunState();
    this.nodeMap = run.nodeMap;

    this.buildBackground();
    this.buildMapTitle();

    this.pathLayer = this.add.graphics().setDepth(2);
    this.drawPaths();
    this.buildTooltip();
    this.buildNodes();
    this.buildHUD();
    this.buildSquadPreview();
    this.buildSettingsButton();
    this.buildQuitRunButton();

    this.cameras.main.fadeIn(300, 0, 0, 0);

    // Tapping background dismisses touch tooltip selection
    this.input.on('pointerdown', (_ptr: Phaser.Input.Pointer, hit: Phaser.GameObjects.GameObject[]) => {
      if (hit.length === 0) this.clearTouchSelection();
    });

    // Run complete: no active (non-locked) nodes remain unfinished
    const isComplete = this.isRunComplete();
    if (isComplete) {
      this.time.delayedCall(400, () => this.buildRunCompleteOverlay());
    } else if (data?.fromBattle) {
      this.showAvailableGlow();
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  private getNodeState(nodeId: number): NodeState {
    const run = getRunState();
    if (run.completedNodeIds.has(nodeId)) return 'completed';
    if (run.lockedNodeIds.has(nodeId))    return 'locked';
    if (run.availableNodeIds.has(nodeId)) return 'available';
    return 'future';
  }

  private isRunComplete(): boolean {
    const run = getRunState();
    // Complete when no non-locked, non-completed node exists in available
    const hasActive = [...run.availableNodeIds].some(
      id => !run.completedNodeIds.has(id) && !run.lockedNodeIds.has(id),
    );
    return !hasActive && run.completedNodeIds.size > 0;
  }

  private formatEnemies(enemies: string[]): string {
    const counts: Record<string, number> = {};
    for (const e of enemies) counts[e] = (counts[e] || 0) + 1;
    return Object.entries(counts)
      .map(([k, v]) => `${v}× ${k[0] + k.slice(1).toLowerCase()}`)
      .join('  ');
  }

  // ── Background ─────────────────────────────────────────────────────────────
  private buildBackground() {
    const bg = this.add.graphics().setDepth(0);

    bg.fillStyle(0x0e1520, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    bg.lineStyle(1, 0x1e2d42, 0.7);
    const size = 55;
    const w = size * 1.5;
    const h = size * Math.sqrt(3);
    for (let col = -1; col < GAME_WIDTH / w + 1; col++) {
      for (let row = -1; row < GAME_HEIGHT / h + 2; row++) {
        const xo = col * w;
        const yo = row * h + (col % 2 === 0 ? 0 : h / 2);
        for (let i = 0; i < 6; i++) {
          const a0 = (i * 60 - 30) * (Math.PI / 180);
          const a1 = ((i + 1) * 60 - 30) * (Math.PI / 180);
          bg.lineBetween(
            xo + size * Math.cos(a0), yo + size * Math.sin(a0),
            xo + size * Math.cos(a1), yo + size * Math.sin(a1),
          );
        }
      }
    }

    for (let i = 0; i < 40; i++) {
      const sx = Phaser.Math.Between(0, GAME_WIDTH);
      const sy = Phaser.Math.Between(0, GAME_HEIGHT);
      const bright = Math.random() * 0.35 + 0.08;
      bg.fillStyle(0xc0d0e8, bright);
      bg.fillCircle(sx, sy, Math.random() < 0.2 ? 2 : 1);
    }

    const fog = this.add.graphics().setDepth(1);
    fog.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.6, 0.6, 0, 0);
    fog.fillRect(0, 0, 180, GAME_HEIGHT);
    fog.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.6, 0.6);
    fog.fillRect(GAME_WIDTH - 180, 0, 180, GAME_HEIGHT);
    fog.fillGradientStyle(0x000000, 0x000000, 0x0e1520, 0x0e1520, 0.65, 0.65, 0, 0);
    fog.fillRect(0, 0, GAME_WIDTH, 60);
    fog.fillGradientStyle(0x0e1520, 0x0e1520, 0x000000, 0x000000, 0, 0, 0.55, 0.55);
    fog.fillRect(0, GAME_HEIGHT - 60, GAME_WIDTH, 60);
  }

  private buildMapTitle() {
    const title = (nodesData as any).name as string;

    const titleBg = this.add.graphics().setDepth(9);
    titleBg.fillStyle(0x000000, 0.55);
    titleBg.fillRect(0, 0, GAME_WIDTH, 52);
    titleBg.lineStyle(1, 0xc0a060, 0.25);
    titleBg.lineBetween(0, 52, GAME_WIDTH, 52);

    this.add.text(GAME_WIDTH / 2, 26, title.toUpperCase(), {
      fontSize: '20px', fontFamily: 'Georgia, serif',
      color: '#c0a060', stroke: '#000', strokeThickness: 3, letterSpacing: 6,
    }).setOrigin(0.5).setDepth(10);
  }

  // ── Paths ──────────────────────────────────────────────────────────────────
  private drawPaths() {
    this.pathLayer.clear();

    for (const node of this.nodeMap) {
      for (const nextId of node.next) {
        const next = this.nodeMap.find(n => n.id === nextId)!;

        const fromState = this.getNodeState(node.id);
        const toState   = this.getNodeState(nextId);

        let color: number, alpha: number, thickness: number;

        if (fromState === 'locked' || toState === 'locked') {
          // Path to/from a locked branch — very faint, reddish
          color = 0x3a1a1a; alpha = 0.4; thickness = 1;
        } else if (fromState === 'completed') {
          // Completed → next: gold trail
          color = 0xf1c40f; alpha = 0.85; thickness = 3;
        } else if (fromState === 'available') {
          // Available → future: bright blue
          color = 0x6b8cba; alpha = 0.55; thickness = 2;
        } else {
          // Future → future: dim blue-gray
          color = 0x2a4060; alpha = 0.4; thickness = 1.5;
        }

        const steps = 20;
        for (let i = 0; i < steps; i++) {
          if (i % 2 === 1) continue;
          const t0 = i / steps;
          const t1 = (i + 0.7) / steps;
          const x0 = Phaser.Math.Interpolation.Linear([node.x, next.x], t0);
          const y0 = Phaser.Math.Interpolation.Linear([node.y, next.y], t0);
          const x1 = Phaser.Math.Interpolation.Linear([node.x, next.x], t1);
          const y1 = Phaser.Math.Interpolation.Linear([node.y, next.y], t1);

          this.pathLayer.lineStyle(thickness, color, alpha);
          this.pathLayer.lineBetween(x0, y0, x1, y1);
        }
      }
    }
  }

  // ── Nodes ──────────────────────────────────────────────────────────────────
  private buildNodes() {
    for (const node of this.nodeMap) {
      const state = this.getNodeState(node.id);
      const container = this.add.container(node.x, node.y).setDepth(5);
      this.nodeContainers.set(node.id, container);

      this.buildNodeVisual(container, node, state);

      // Completed nodes: no interaction
      if (state === 'completed') continue;

      const hitArea = new Phaser.Geom.Circle(0, 0, NODE_RADIUS + 16);
      container.setInteractive(hitArea, Phaser.Geom.Circle.Contains);

      if (state === 'available') {
        // Mouse: hover shows tooltip, click enters immediately
        container.on('pointerover', (ptr: Phaser.Input.Pointer) => {
          if (ptr.wasTouch) return;
          this.showTooltip(node, false);
          this.onNodeHover(node.id, true);
        });
        container.on('pointerout', (ptr: Phaser.Input.Pointer) => {
          if (ptr.wasTouch) return;
          this.hideTooltip();
          this.onNodeHover(node.id, false);
        });
        container.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
          if (ptr.wasTouch) {
            // Two-tap confirm: first tap previews, second tap enters
            if (this.touchSelectedNodeId === node.id && this.tooltip.visible) {
              this.clearTouchSelection();
              this.onNodeClick(node.id);
            } else {
              this.clearTouchSelection();
              this.touchSelectedNodeId = node.id;
              this.showTooltip(node, true);
              this.onNodeHover(node.id, true);
            }
          } else {
            this.onNodeClick(node.id);
          }
        });
      } else {
        // Locked / future: tap toggles tooltip (info only)
        container.on('pointerover', (ptr: Phaser.Input.Pointer) => {
          if (ptr.wasTouch) return;
          this.showTooltip(node, false);
        });
        container.on('pointerout', (ptr: Phaser.Input.Pointer) => {
          if (ptr.wasTouch) return;
          this.hideTooltip();
        });
        container.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
          if (!ptr.wasTouch) return;
          if (this.touchSelectedNodeId === node.id && this.tooltip.visible) {
            this.clearTouchSelection();
          } else {
            this.clearTouchSelection();
            this.touchSelectedNodeId = node.id;
            this.showTooltip(node, false);
          }
        });
      }
    }
  }

  private clearTouchSelection() {
    if (this.touchSelectedNodeId !== null) {
      this.onNodeHover(this.touchSelectedNodeId, false);
      this.touchSelectedNodeId = null;
    }
    this.hideTooltip();
  }

  private buildNodeVisual(
    container: Phaser.GameObjects.Container,
    node: NodeDef,
    state: NodeState,
  ) {
    const baseColor = NODE_COLORS[node.type] ?? 0x555555;

    // ── Available ────────────────────────────────────────────────────────────
    if (state === 'available') {
      // Outer glow
      const glow = this.add.graphics();
      glow.fillStyle(baseColor, 0.18);
      glow.fillCircle(0, 0, NODE_RADIUS + 14);
      container.add(glow);
      (container as any).__glow = glow;

      // Boss gets spiky border
      const circle = this.add.graphics();
      if (node.type === 'BOSS') {
        circle.lineStyle(3, 0xff2222, 0.9);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          circle.lineBetween(
            Math.cos(a) * (NODE_RADIUS - 2), Math.sin(a) * (NODE_RADIUS - 2),
            Math.cos(a) * (NODE_RADIUS + 6), Math.sin(a) * (NODE_RADIUS + 6),
          );
        }
        circle.fillStyle(baseColor, 1);
        circle.fillCircle(0, 0, NODE_RADIUS);
        circle.lineStyle(2, 0xff2222, 0.9);
        circle.strokeCircle(0, 0, NODE_RADIUS);
      } else {
        circle.fillStyle(baseColor, 1);
        circle.fillCircle(0, 0, NODE_RADIUS);
        circle.lineStyle(2, 0xffffff, 0.7);
        circle.strokeCircle(0, 0, NODE_RADIUS);
      }
      container.add(circle);

      // Top shine
      const shine = this.add.graphics();
      shine.fillStyle(0xffffff, 0.09);
      shine.fillEllipse(0, -NODE_RADIUS * 0.35, NODE_RADIUS * 1.2, NODE_RADIUS * 0.7);
      container.add(shine);

      // Icon
      container.add(this.add.text(0, -1, NODE_ICONS[node.type] ?? '?', {
        fontSize: '17px', color: '#ffffff', fontFamily: 'Georgia, serif',
      }).setOrigin(0.5));

      // Name label
      container.add(this.add.text(0, NODE_RADIUS + 11, node.name, {
        fontSize: '11px', color: '#b8a870',
        fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5));

      // Type badge above
      const typeHex = '#' + baseColor.toString(16).padStart(6, '0');
      container.add(this.add.text(0, -NODE_RADIUS - 14, node.type, {
        fontSize: '9px', color: typeHex,
        fontFamily: 'monospace', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5));

      // Difficulty pips
      if (node.difficulty && node.difficulty > 0) {
        for (let i = 0; i < node.difficulty; i++) {
          const pip = this.add.graphics();
          pip.fillStyle(0xe74c3c, 0.8);
          pip.fillCircle(
            -((node.difficulty - 1) * 6) / 2 + i * 6,
            NODE_RADIUS + 27, 2.5,
          );
          container.add(pip);
        }
      }
      return;
    }

    // ── Completed ────────────────────────────────────────────────────────────
    if (state === 'completed') {
      const circle = this.add.graphics();
      circle.fillStyle(0x2a3040, 1);
      circle.fillCircle(0, 0, NODE_RADIUS);
      circle.lineStyle(1, 0x556070, 0.5);
      circle.strokeCircle(0, 0, NODE_RADIUS);
      container.add(circle);

      container.add(this.add.text(0, -1, '✓', {
        fontSize: '18px', color: '#55667a', fontFamily: 'Georgia, serif',
      }).setOrigin(0.5));

      container.add(this.add.text(0, NODE_RADIUS + 11, node.name, {
        fontSize: '11px', color: '#556070',
        fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5));
      return;
    }

    // ── Locked (path not taken) ───────────────────────────────────────────
    if (state === 'locked') {
      const circle = this.add.graphics();
      circle.fillStyle(0x1a0f0f, 1);
      circle.fillCircle(0, 0, NODE_RADIUS);
      circle.lineStyle(1.5, 0x4a2a2a, 0.7);
      circle.strokeCircle(0, 0, NODE_RADIUS);
      // Diagonal strike-through
      circle.lineStyle(2, 0x6a2020, 0.55);
      const d = NODE_RADIUS * 0.65;
      circle.lineBetween(-d, -d, d, d);
      circle.lineBetween(d, -d, -d, d);
      container.add(circle);

      // Dim type icon (shows what you missed)
      container.add(this.add.text(0, -1, NODE_ICONS[node.type] ?? '?', {
        fontSize: '14px', color: '#4a3030', fontFamily: 'Georgia, serif',
      }).setOrigin(0.5));

      // Name
      container.add(this.add.text(0, NODE_RADIUS + 11, node.name, {
        fontSize: '10px', color: '#4a3030',
        fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setAlpha(0.7));

      // Dim type badge so you can still see what it was
      const typeHex = '#' + (baseColor & 0x555555).toString(16).padStart(6, '0');
      container.add(this.add.text(0, -NODE_RADIUS - 13, node.type, {
        fontSize: '8px', color: typeHex,
        fontFamily: 'monospace', stroke: '#000', strokeThickness: 1,
      }).setOrigin(0.5).setAlpha(0.5));

      container.setAlpha(0.7);
      return;
    }

    // ── Future (on active path, not yet reachable) ────────────────────────
    // state === 'future'
    const circle = this.add.graphics();
    circle.fillStyle(baseColor, 0.15);
    circle.fillCircle(0, 0, NODE_RADIUS);
    circle.lineStyle(1.5, baseColor, 0.45);
    circle.strokeCircle(0, 0, NODE_RADIUS);
    container.add(circle);

    // Icon — visible but muted
    container.add(this.add.text(0, -1, NODE_ICONS[node.type] ?? '?', {
      fontSize: '16px', color: '#' + baseColor.toString(16).padStart(6, '0'),
      fontFamily: 'Georgia, serif',
    }).setOrigin(0.5).setAlpha(0.55));

    // Name
    container.add(this.add.text(0, NODE_RADIUS + 11, node.name, {
      fontSize: '11px', color: '#7a6840',
      fontFamily: 'Georgia, serif', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0.75));

    // Type badge — clearly labeled so you can plan
    const typeHex = '#' + baseColor.toString(16).padStart(6, '0');
    container.add(this.add.text(0, -NODE_RADIUS - 13, node.type, {
      fontSize: '9px', color: typeHex,
      fontFamily: 'monospace', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0.6));

    // Difficulty pips (dimmed)
    if (node.difficulty && node.difficulty > 0) {
      for (let i = 0; i < node.difficulty; i++) {
        const pip = this.add.graphics();
        pip.fillStyle(0xe74c3c, 0.4);
        pip.fillCircle(
          -((node.difficulty - 1) * 6) / 2 + i * 6,
          NODE_RADIUS + 27, 2.5,
        );
        container.add(pip);
      }
    }

    container.setAlpha(0.8);
  }

  // ── Tooltip ────────────────────────────────────────────────────────────────
  private buildTooltip() {
    this.tooltip = this.add.container(0, 0).setDepth(40).setVisible(false);
  }

  /**
   * @param node       Node to describe
   * @param showConfirm  If true (touch, available node) adds "Tap again to enter →" hint
   */
  private showTooltip(node: NodeDef, showConfirm: boolean) {
    this.tooltip.removeAll(true);

    const state = this.getNodeState(node.id);
    const lines: string[] = [];

    if (node.enemies && node.enemies.length > 0) lines.push(this.formatEnemies(node.enemies));
    if (node.gold && node.gold > 0)              lines.push(`◆  ${node.gold} Gold reward`);
    if (node.type === 'REWARD')                  lines.push('Free relic pick');
    if (node.type === 'SHOP')                    lines.push('Spend gold on relics');
    if (node.type === 'EVENT')                   lines.push('Random encounter — choose wisely');
    if (node.type === 'FORGE')                   lines.push('Upgrade, fuse, or purge relics');
    if (node.difficulty && node.difficulty > 0) {
      const stars = '★'.repeat(node.difficulty) + '☆'.repeat(5 - node.difficulty);
      lines.push(`Threat  ${stars}`);
    }
    if (state === 'locked') lines.push('— Path not taken —');

    const padX = 10, padY = 8, lineH = 16;
    const ttW = 210;
    // Extra height for confirm hint
    const confirmH = showConfirm ? lineH + 6 : 0;
    const ttH = padY * 2 + lineH + (lines.length > 0 ? 4 + lines.length * lineH : 0) + confirmH;

    const borderCol = state === 'locked' ? 0x5a2020 : (NODE_COLORS[node.type] ?? 0x3a5070);
    const bg = this.add.graphics();
    bg.fillStyle(0x07101e, 0.97);
    bg.fillRoundedRect(0, 0, ttW, ttH, 6);
    bg.lineStyle(1, borderCol, 0.7);
    bg.strokeRoundedRect(0, 0, ttW, ttH, 6);
    this.tooltip.add(bg);

    const typeHex = '#' + (NODE_COLORS[node.type] ?? 0x8a9aaa).toString(16).padStart(6, '0');
    this.tooltip.add(
      this.add.text(padX, padY, `${NODE_ICONS[node.type] ?? '?'}  ${node.name}`, {
        fontSize: '13px', fontFamily: 'Georgia, serif', color: typeHex,
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0, 0),
    );

    lines.forEach((line, i) => {
      this.tooltip.add(
        this.add.text(padX, padY + lineH + 4 + i * lineH, line, {
          fontSize: '11px', fontFamily: 'monospace', color: '#7a9ab8',
        }).setOrigin(0, 0),
      );
    });

    // Touch confirm hint — shown below a separator
    if (showConfirm) {
      const sepY = ttH - confirmH - 1;
      const sep = this.add.graphics();
      sep.lineStyle(1, borderCol, 0.35);
      sep.lineBetween(padX, sepY, ttW - padX, sepY);
      this.tooltip.add(sep);
      this.tooltip.add(
        this.add.text(ttW / 2, sepY + confirmH / 2 + 2, 'Tap again to enter  →', {
          fontSize: '11px', fontFamily: 'Georgia, serif', color: typeHex,
        }).setOrigin(0.5, 0.5),
      );
    }

    // ── Smart positioning ────────────────────────────────────────────────────
    // Prefer ABOVE the node (touch-friendly — finger doesn't obscure it).
    // Fall back to below, then right/left.
    const nx = node.x, ny = node.y;
    const HUD_TOP = 60, HUD_BOT = 64; // safe margins from title bar + bottom HUD
    const GAP = 12;

    const aboveY = ny - NODE_RADIUS - GAP - ttH;
    const belowY = ny + NODE_RADIUS + GAP;
    const aboveFits = aboveY >= HUD_TOP;
    const belowFits = belowY + ttH <= GAME_HEIGHT - HUD_BOT;

    let tx: number, ty: number;

    if (aboveFits) {
      // Center-aligned above the node
      tx = Math.max(8, Math.min(nx - ttW / 2, GAME_WIDTH - ttW - 8));
      ty = aboveY;
    } else if (belowFits) {
      tx = Math.max(8, Math.min(nx - ttW / 2, GAME_WIDTH - ttW - 8));
      ty = belowY;
    } else {
      // Side positioning (original behaviour — good for desktop)
      tx = nx + NODE_RADIUS + GAP;
      ty = Phaser.Math.Clamp(ny - ttH / 2, HUD_TOP, GAME_HEIGHT - HUD_BOT - ttH);
      if (tx + ttW > GAME_WIDTH - 8) tx = nx - NODE_RADIUS - GAP - ttW;
    }

    this.tooltip.setPosition(tx, ty).setVisible(true);
  }

  private hideTooltip() {
    this.tooltip.setVisible(false);
  }

  // ── Interaction ────────────────────────────────────────────────────────────
  private onNodeHover(nodeId: number, hovered: boolean) {
    const c = this.nodeContainers.get(nodeId);
    if (!c) return;
    this.tweens.killTweensOf(c);
    this.tweens.add({
      targets: c,
      scaleX: hovered ? 1.14 : 1,
      scaleY: hovered ? 1.14 : 1,
      duration: 130,
      ease: 'Power2',
    });
  }

  private onNodeClick(nodeId: number) {
    const node = this.nodeMap.find(n => n.id === nodeId)!;
    selectNode(nodeId); // locks sibling branches

    const c = this.nodeContainers.get(nodeId)!;
    this.tweens.add({
      targets: c, scaleX: 1.28, scaleY: 1.28, duration: 90, yoyo: true,
      onComplete: () => this.enterNode(node),
    });
  }

  private enterNode(node: NodeDef) {
    this.hideTooltip();
    this.cameras.main.fadeOut(350, 0, 0, 0, (_: unknown, progress: number) => {
      if (progress === 1) {
        if (node.type === 'BATTLE' || node.type === 'ELITE' || node.type === 'BOSS') {
          this.scene.start('BattleScene', { node });
        } else if (node.type === 'REWARD') {
          this.scene.start('ShopScene', { node, free: true });
        } else if (node.type === 'SHOP') {
          this.scene.start('ShopScene', { node, free: false });
        } else if (node.type === 'EVENT') {
          this.scene.start('EventScene', { node });
        } else if (node.type === 'FORGE') {
          this.scene.start('ForgeScene', { node });
        }
      }
    });
  }

  // ── HUD ─────────────────────────────────────────────────────────────────────
  private buildHUD() {
    const run = getRunState();

    const goldPanel = this.add.graphics().setDepth(20);
    goldPanel.fillStyle(0x060b12, 0.92);
    goldPanel.fillRoundedRect(12, 58, 168, 40, 7);
    goldPanel.lineStyle(1, 0xf1c40f, 0.35);
    goldPanel.strokeRoundedRect(12, 58, 168, 40, 7);

    this.goldText = this.add.text(26, 70, `◆  ${run.gold} Gold`, {
      fontSize: '18px', fontFamily: 'Georgia, serif',
      color: '#f1c40f', stroke: '#000', strokeThickness: 3,
    }).setDepth(21);

    const runPanel = this.add.graphics().setDepth(20);
    runPanel.fillStyle(0x060b12, 0.88);
    runPanel.fillRoundedRect(GAME_WIDTH - 120, 58, 108, 36, 6);
    this.add.text(GAME_WIDTH - 64, 76, 'RUN 1', {
      fontSize: '13px', fontFamily: 'monospace', color: '#5a7a9a',
    }).setOrigin(0.5).setDepth(21);

    this.relicRow = this.add.container(14, GAME_HEIGHT - 48).setDepth(21);
    this.refreshRelicRow();
  }

  private refreshRelicRow() {
    const run = getRunState();
    this.relicRow.removeAll(true);
    if (run.relics.length === 0) return;

    const label = this.add.text(0, 0, 'Relics:', {
      fontSize: '12px', color: '#6a7e94', fontFamily: 'Georgia, serif',
    }).setOrigin(0, 0.5);
    this.relicRow.add(label);

    let xOff = 52;
    for (const relic of run.relics) {
      const pillW = 108;
      const pill = this.add.graphics();
      pill.fillStyle(0x101828, 1);
      pill.fillRoundedRect(xOff, -11, pillW, 22, 4);
      const rarityHex = parseInt((RARITY_COLOR[relic.rarity ?? 'common'] ?? '#888').replace('#', ''), 16);
      pill.lineStyle(1, rarityHex, 0.4);
      pill.strokeRoundedRect(xOff, -11, pillW, 22, 4);
      this.relicRow.add(pill);

      const txt = this.add.text(xOff + 8, 0, relic.name, {
        fontSize: '11px',
        color: RARITY_COLOR[relic.rarity ?? 'common'] ?? '#888',
        fontFamily: 'Georgia, serif',
      }).setOrigin(0, 0.5);
      this.relicRow.add(txt);
      xOff += pillW + 6;
    }
  }

  // ── Squad preview (bottom-right, clickable) ─────────────────────────────────
  private buildSquadPreview() {
    const panelX = GAME_WIDTH - 188, panelY = GAME_HEIGHT - 102;
    const panelW = 176, panelH = 90;

    // Static bg + title (never changes)
    const bg = this.add.graphics().setDepth(20);
    bg.fillStyle(0x060b12, 0.92);
    bg.fillRoundedRect(panelX, panelY, panelW, panelH, 8);
    bg.lineStyle(1, 0x2a3a50, 0.6);
    bg.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);

    this.add.text(panelX + panelW / 2, panelY + 14, 'PARTY  ▶', {
      fontSize: '10px', color: '#5a7a9a', fontFamily: 'monospace', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(21);

    // Dynamic hero bubbles container (refreshed when order changes)
    this.squadPreviewCt = this.add.container(0, 0).setDepth(21);
    this.refreshSquadPreview();

    // Hover highlight + click to open party panel
    const hoverRing = this.add.graphics().setDepth(22);
    const hit = this.add.rectangle(
      panelX + panelW / 2, panelY + panelH / 2, panelW, panelH, 0x000000, 0,
    ).setInteractive({ useHandCursor: true }).setDepth(23);
    hit.on('pointerover', () => {
      hoverRing.clear();
      hoverRing.lineStyle(1, 0xc0a060, 0.5);
      hoverRing.strokeRoundedRect(panelX, panelY, panelW, panelH, 8);
    });
    hit.on('pointerout', () => hoverRing.clear());
    hit.on('pointerdown', () => { hoverRing.clear(); this.openPartyPanel(); });
  }

  private refreshSquadPreview() {
    this.squadPreviewCt.removeAll(true);
    const run = getRunState();
    const panelX = GAME_WIDTH - 188, panelY = GAME_HEIGHT - 102;
    const panelW = 176;
    const heroColors: Record<string, number> = {
      WARRIOR: 0xc0392b, RANGER: 0x27ae60, MAGE: 0x8e44ad,
      PRIEST: 0xf39c12, BARD: 0x1abc9c, ROGUE: 0x2c3e50,
      PALADIN: 0xf1c40f, DRUID: 0x16a085,
    };
    const count = run.squad.length;
    const spacing = Math.min(40, (panelW - 20) / Math.max(count, 1));
    const startX = panelX + panelW / 2 - ((count - 1) * spacing) / 2;

    run.squad.forEach((h, i) => {
      const hx = startX + i * spacing;
      const hy = panelY + 54;
      const pct = Math.max(0, h.currentHp / h.maxHp);
      const col = heroColors[h.heroClass] ?? 0x888888;

      const g = this.add.graphics();
      g.lineStyle(1, col, 0.7);
      g.strokeCircle(hx, hy, 17);
      g.fillStyle(col, 0.85);
      g.fillCircle(hx, hy, 14);
      g.fillStyle(0x1a2a3a, 1);
      g.fillRect(hx - 12, hy + 18, 24, 3);
      g.fillStyle(pct > 0.5 ? 0x2ecc71 : pct > 0.25 ? 0xf39c12 : 0xe74c3c, 1);
      g.fillRect(hx - 12, hy + 18, 24 * pct, 3);
      this.squadPreviewCt.add(g);

      this.squadPreviewCt.add(
        this.add.text(hx, hy, h.heroClass[0], {
          fontSize: '13px', fontStyle: 'bold', color: '#fff',
          stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5),
      );
    });
  }

  // ── Party management panel ───────────────────────────────────────────────────
  private openPartyPanel() {
    if (this.partyPanel) return;
    const run = getRunState();
    const PANEL_W = 520;
    const CARD_H  = 100;
    const CARD_GAP = 6;
    const HEADER_H = 46;
    const FOOTER_PAD = 14;
    const n = run.squad.length;
    const panelH = HEADER_H + n * (CARD_H + CARD_GAP) - CARD_GAP + FOOTER_PAD;
    const px = Math.round(GAME_WIDTH  / 2 - PANEL_W / 2);
    const py = Math.round(GAME_HEIGHT / 2 - panelH / 2);

    // Veil
    this.partyVeil = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000,
    ).setAlpha(0).setDepth(45).setInteractive();
    this.partyVeil.on('pointerdown', () => this.closePartyPanel());
    this.tweens.add({ targets: this.partyVeil, alpha: 0.75, duration: 180 });

    // Panel container — use local ref so TS knows it's non-null throughout
    const panel = this.add.container(px, py).setDepth(46).setAlpha(0);
    this.partyPanel = panel;
    this.tweens.add({ targets: panel, alpha: 1, duration: 180 });

    // Shell
    const shell = this.add.graphics();
    shell.fillStyle(0x05101c, 0.98);
    shell.fillRoundedRect(0, 0, PANEL_W, panelH, 10);
    shell.lineStyle(1, 0xc0a060, 0.45);
    shell.strokeRoundedRect(0, 0, PANEL_W, panelH, 10);
    panel.add(shell);

    // Header
    panel.add(this.add.text(PANEL_W / 2, HEADER_H / 2, 'PARTY', {
      fontSize: '13px', fontFamily: 'monospace', color: '#c0a060', letterSpacing: 5,
    }).setOrigin(0.5));

    // Close ✕
    const closeBtn = this.add.text(PANEL_W - 20, HEADER_H / 2, '✕', {
      fontSize: '16px', color: '#556070',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#cc4444'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#556070'));
    closeBtn.on('pointerdown', () => this.closePartyPanel());
    panel.add(closeBtn);

    // Header separator
    const hSep = this.add.graphics();
    hSep.lineStyle(1, 0xc0a060, 0.18);
    hSep.lineBetween(14, HEADER_H, PANEL_W - 14, HEADER_H);
    panel.add(hSep);

    // Cards
    const heroColors: Record<string, number> = {
      WARRIOR: 0xc0392b, RANGER: 0x27ae60, MAGE: 0x8e44ad,
      PRIEST: 0xf39c12, BARD: 0x1abc9c, ROGUE: 0x2c3e50,
      PALADIN: 0xf1c40f, DRUID: 0x16a085,
    };
    run.squad.forEach((heroData, idx) => {
      const cardY  = HEADER_H + idx * (CARD_H + CARD_GAP);
      const col    = heroColors[heroData.heroClass] ?? 0x888888;
      const hexCol = '#' + col.toString(16).padStart(6, '0');
      const pct    = Math.max(0, heroData.currentHp / heroData.maxHp);
      const stats  = HERO_STATS[heroData.heroClass as HeroClass] as any;

      // Card bg
      const cardBg = this.add.graphics();
      cardBg.fillStyle(0x0b1828, 1);
      cardBg.fillRoundedRect(10, cardY + 2, PANEL_W - 20, CARD_H - 4, 6);
      cardBg.lineStyle(1, col, 0.2);
      cardBg.strokeRoundedRect(10, cardY + 2, PANEL_W - 20, CARD_H - 4, 6);
      panel.add(cardBg);

      // Portrait (idle frame 1)
      const charKey = heroData.heroClass.toLowerCase();
      const portrait = this.add.image(48, cardY + CARD_H / 2, `${charKey}_idle_1`)
        .setDisplaySize(58, 58);
      panel.add(portrait);

      // Name
      panel.add(this.add.text(88, cardY + 13, heroData.name, {
        fontSize: '15px', fontFamily: 'Georgia, serif', fontStyle: 'bold',
        color: '#ddd0b0', stroke: '#000', strokeThickness: 2,
      }));

      // Class badge
      panel.add(this.add.text(88, cardY + 31, heroData.heroClass, {
        fontSize: '9px', fontFamily: 'monospace', color: hexCol, letterSpacing: 2,
      }));

      // HP bar
      const barX = 88, barY = cardY + 50, barW = PANEL_W - 170;
      const hpBg = this.add.graphics();
      hpBg.fillStyle(0x1a2a3a, 1);
      hpBg.fillRoundedRect(barX, barY, barW, 6, 3);
      panel.add(hpBg);

      const hpFill = this.add.graphics();
      const hpCol = pct > 0.5 ? 0x2ecc71 : pct > 0.25 ? 0xf39c12 : 0xe74c3c;
      hpFill.fillStyle(hpCol, 1);
      hpFill.fillRoundedRect(barX, barY, Math.max(3, barW * pct), 6, 3);
      panel.add(hpFill);

      const hpHex = pct > 0.5 ? '#2ecc71' : pct > 0.25 ? '#f39c12' : '#e74c3c';
      panel.add(this.add.text(barX + barW + 8, barY - 1,
        `${heroData.currentHp} / ${heroData.maxHp}`, {
          fontSize: '10px', fontFamily: 'monospace', color: hpHex,
        }));

      // Description
      const desc = HERO_DESCS[heroData.heroClass] ?? '';
      panel.add(this.add.text(88, cardY + 63, desc, {
        fontSize: '10px', fontFamily: 'Georgia, serif', color: '#6a8aaa',
        wordWrap: { width: PANEL_W - 190 },
      }));

      // Stats row
      const keyStat = HERO_KEY_STAT[heroData.heroClass] ?? '';
      panel.add(this.add.text(88, cardY + 83,
        `⚔ ${stats.combatDamage} atk   ◎ ${stats.combatRange} range   ${keyStat}`, {
          fontSize: '9px', fontFamily: 'monospace', color: '#4a6080',
        }));

      // Reorder arrows ▲ ▼
      if (idx > 0) {
        const upBtn = this.add.text(PANEL_W - 30, cardY + 26, '▲', {
          fontSize: '18px', color: '#4a6a88',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        upBtn.on('pointerover', () => upBtn.setColor('#c0a060'));
        upBtn.on('pointerout',  () => upBtn.setColor('#4a6a88'));
        upBtn.on('pointerdown', () => this.reorderAndRebuild(idx, idx - 1));
        panel.add(upBtn);
      }
      if (idx < n - 1) {
        const dnBtn = this.add.text(PANEL_W - 30, cardY + 54, '▼', {
          fontSize: '18px', color: '#4a6a88',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        dnBtn.on('pointerover', () => dnBtn.setColor('#c0a060'));
        dnBtn.on('pointerout',  () => dnBtn.setColor('#4a6a88'));
        dnBtn.on('pointerdown', () => this.reorderAndRebuild(idx, idx + 1));
        panel.add(dnBtn);
      }
    });
  }

  private closePartyPanel(refreshPreview = true) {
    this.partyPanel?.destroy();
    this.partyPanel = null;
    this.partyVeil?.destroy();
    this.partyVeil = null;
    if (refreshPreview) this.refreshSquadPreview();
  }

  private reorderAndRebuild(fromIdx: number, toIdx: number) {
    reorderSquad(fromIdx, toIdx);
    this.closePartyPanel(false); // skip preview refresh — openPartyPanel will do it after close
    this.openPartyPanel();
    this.refreshSquadPreview();  // update the mini-preview too
  }

  // ── Settings button (top-left) ─────────────────────────────────────────────
  private buildSettingsButton() {
    const size = 36, r = 8;
    const bg = this.add.graphics().setDepth(30);
    const draw = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(0x060b12, hovered ? 1 : 0.75);
      bg.fillRoundedRect(10, 10, size, size, r);
      bg.lineStyle(1, 0x3a5070, hovered ? 1 : 0.5);
      bg.strokeRoundedRect(10, 10, size, size, r);
    };
    draw(false);
    this.add.text(10 + size / 2, 10 + size / 2, '⚙', {
      fontSize: '18px',
    }).setOrigin(0.5).setDepth(31);

    const hit = this.add.rectangle(10 + size / 2, 10 + size / 2, size, size, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(32);
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => {
      this.scene.launch('SettingsScene', { callerKey: 'OverworldScene' });
    });
  }

  // ── Quit Run button (bottom-left) ──────────────────────────────────────────
  private buildQuitRunButton() {
    const w = 130, h = 36, r = 7;
    const bx = 16, by = GAME_HEIGHT - 52;

    const bg = this.add.graphics().setDepth(20);
    const draw = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(hovered ? 0x3a1010 : 0x0f0808, hovered ? 1 : 0.85);
      bg.fillRoundedRect(bx, by, w, h, r);
      bg.lineStyle(1, 0xe74c3c, hovered ? 0.9 : 0.4);
      bg.strokeRoundedRect(bx, by, w, h, r);
    };
    draw(false);

    this.add.text(bx + w / 2, by + h / 2, '← Quit Run', {
      fontSize: '13px', fontFamily: 'Georgia, serif',
      color: '#c06060', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(21);

    const hit = this.add.rectangle(bx + w / 2, by + h / 2, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(22);
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => {
      this.cameras.main.fadeOut(350, 0, 0, 0, (_: unknown, p: number) => {
        if (p === 1) this.scene.start('MainMenuScene');
      });
    });
  }

  private showAvailableGlow() {
    const run = getRunState();
    for (const id of run.availableNodeIds) {
      if (run.completedNodeIds.has(id) || run.lockedNodeIds.has(id)) continue;
      const c = this.nodeContainers.get(id);
      if (!c) continue;
      this.tweens.add({
        targets: c, scaleX: 1.18, scaleY: 1.18,
        duration: 550, yoyo: true, repeat: 2, ease: 'Sine.easeInOut',
      });
    }
  }

  // ── Run complete overlay ──────────────────────────────────────────────────
  private buildRunCompleteOverlay() {
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
    const run = getRunState();

    // Did the player beat the boss?
    const bossNode = run.nodeMap.find(n => n.type === 'BOSS');
    const bossDefeated = bossNode ? run.completedNodeIds.has(bossNode.id) : false;

    const titleText  = bossDefeated ? 'VICTORY!' : 'RUN COMPLETE';
    const subText    = bossDefeated
      ? `${(nodesData as any).name} has been conquered!`
      : `${(nodesData as any).name} — all paths exhausted.`;
    const btnLabel   = 'Start New Run  →';
    const glowColor  = bossDefeated ? 0xf1c40f : 0x4a7ab8;

    // Dark veil
    const veil = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setDepth(50).setAlpha(0);
    this.tweens.add({ targets: veil, alpha: 0.8, duration: 500 });

    // Top glow
    const glow = this.add.graphics().setDepth(51).setAlpha(0);
    glow.fillGradientStyle(glowColor, glowColor, 0x000000, 0x000000, 0.18, 0.18, 0, 0);
    glow.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.55);
    this.tweens.add({ targets: glow, alpha: 1, duration: 700, delay: 200 });

    // Decorative rules
    const rules = this.add.graphics().setDepth(52).setAlpha(0);
    rules.lineStyle(1, glowColor, 0.35);
    rules.lineBetween(cx - 320, cy - 62, cx + 320, cy - 62);
    rules.lineBetween(cx - 320, cy + 22, cx + 320, cy + 22);
    this.tweens.add({ targets: rules, alpha: 1, duration: 350, delay: 900 });

    // Title
    const title = this.add.text(cx, cy - 120, titleText, {
      fontSize: bossDefeated ? '80px' : '72px',
      fontFamily: 'Georgia, serif',
      color: '#f1c40f', stroke: '#5c3d00', strokeThickness: 7,
      letterSpacing: 4,
    }).setOrigin(0.5).setDepth(52).setAlpha(0);
    this.tweens.add({
      targets: title, y: cy - 148, alpha: 1,
      duration: 650, ease: 'Back.easeOut', delay: 280,
    });

    // Subtitle
    const sub = this.add.text(cx, cy - 22, subText, {
      fontSize: '20px', fontFamily: 'Georgia, serif', color: '#c8a840',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(52).setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 380, delay: 860 });

    // Gold particle rain (only on boss victory)
    if (bossDefeated) {
      const goldCols = [0xf1c40f, 0xffe066, 0xffd700, 0xfff0a0];
      for (let i = 0; i < 18; i++) {
        this.time.delayedCall(Phaser.Math.Between(200, 2000), () => this.dropGoldSpeck(goldCols));
        this.time.addEvent({
          delay: Phaser.Math.Between(2000, 3500), repeat: 5,
          callback: () => this.dropGoldSpeck(goldCols),
        });
      }
    }

    // Button
    this.time.delayedCall(1100, () => {
      const w = 260, h = 52;
      const btn = this.add.container(cx, cy + 72).setDepth(52).setAlpha(0);

      const btnBg = this.add.graphics();
      const drawBtn = (hovered: boolean) => {
        btnBg.clear();
        btnBg.fillStyle(hovered ? 0x7d5a00 : 0x3a2800, 1);
        btnBg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
        btnBg.lineStyle(hovered ? 2 : 1, 0xf1c40f, hovered ? 1 : 0.65);
        btnBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
      };
      drawBtn(false);
      btn.add(btnBg);
      btn.add(this.add.text(0, 0, btnLabel, {
        fontSize: '21px', fontFamily: 'Georgia, serif', color: '#f1c40f',
      }).setOrigin(0.5));

      btn.setInteractive(
        new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
        Phaser.Geom.Rectangle.Contains,
      );
      btn.on('pointerover', () => { drawBtn(true); this.tweens.add({ targets: btn, scaleX: 1.05, scaleY: 1.05, duration: 80 }); });
      btn.on('pointerout',  () => { drawBtn(false); this.tweens.add({ targets: btn, scaleX: 1, scaleY: 1, duration: 80 }); });
      btn.on('pointerdown', () => {
        this.cameras.main.fadeOut(400, 0, 0, 0, (_: unknown, p: number) => {
          if (p === 1) this.scene.start('MainMenuScene', { shardsEarned: 0 });
        });
      });

      this.tweens.add({ targets: btn, alpha: 1, y: cy + 54, duration: 360, ease: 'Back.easeOut' });
    });
  }

  private dropGoldSpeck(colors: number[]) {
    const x = Phaser.Math.Between(60, GAME_WIDTH - 60);
    const size = Phaser.Math.Between(2, 7);
    const col = colors[Phaser.Math.Between(0, colors.length - 1)];
    const g = this.add.graphics().setDepth(53);
    g.fillStyle(col, 1);
    if (size >= 5) {
      g.fillTriangle(-size, 0, 0, -size, size, 0);
      g.fillTriangle(-size, 0, 0, size, size, 0);
    } else {
      g.fillCircle(0, 0, size);
    }
    g.setPosition(x, -12);
    this.tweens.add({
      targets: g, y: GAME_HEIGHT + 12,
      alpha: { from: 0.85, to: 0 },
      angle: Phaser.Math.Between(-100, 100),
      duration: Phaser.Math.Between(2400, 4000),
      ease: 'Linear',
      onComplete: () => g.destroy(),
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(_time: number, delta: number) {
    this.pulseTime += delta;
    const run = getRunState();
    this.goldText.setText(`◆  ${run.gold} Gold`);

    const pulseMag = 0.09 * Math.sin(this.pulseTime / 380);
    for (const id of run.availableNodeIds) {
      if (run.completedNodeIds.has(id) || run.lockedNodeIds.has(id)) continue;
      const c = this.nodeContainers.get(id);
      if (!c || !(c as any).__glow) continue;
      const glow = (c as any).__glow as Phaser.GameObjects.Graphics;
      glow.setAlpha(0.13 + pulseMag);
    }
  }
}
