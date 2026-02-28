import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, STARTER_SQUAD_SIZE, MAX_SQUAD_SIZE,
  type HeroClass,
} from '@/config/constants';
import { getMetaBonuses, getShards, pickRandomCommonRelic } from '@/systems/MetaState';
import { newRun, addRelic, clearSave, type NodeDef } from '@/systems/RunState';
import type { MusicSystem } from '@/systems/MusicSystem';
import type { MetaBonuses } from '@/systems/MetaState';
import nodesData from '@/data/nodes.json';
import { getAllMaps, getMapById } from '@/data/maps/index';
import { getUnlockedAscension } from '@/systems/AscensionSystem';

const SAVE_KEY = 'slingsquad_squad_v1';

// Hero class color mapping for borders/accents
const CLASS_COLORS: Record<string, number> = {
  WARRIOR: 0xc0392b,
  RANGER: 0x27ae60,
  MAGE: 0x8e44ad,
  PRIEST: 0xf39c12,
  BARD: 0x1abc9c,
  ROGUE: 0x2c3e50,
  PALADIN: 0xf1c40f,
  DRUID: 0x16a085,
};

const CLASS_LABELS: Record<string, string> = {
  WARRIOR: 'Warrior',
  RANGER: 'Ranger',
  MAGE: 'Mage',
  PRIEST: 'Priest',
  BARD: 'Bard',
  ROGUE: 'Rogue',
  PALADIN: 'Paladin',
  DRUID: 'Druid',
};

interface SlotCard {
  container: Phaser.GameObjects.Container;
  heroClass: HeroClass | null;
  index: number;
}

interface RosterCard {
  container: Phaser.GameObjects.Container;
  heroClass: HeroClass;
  sprite: Phaser.GameObjects.Sprite;
}

export class SquadSelectScene extends Phaser.Scene {
  private _slots: SlotCard[] = [];
  private _roster: RosterCard[] = [];
  private _slotCount = STARTER_SQUAD_SIZE;
  private _availableClasses: HeroClass[] = [];
  private _meta!: MetaBonuses;
  private _beginBtn: Phaser.GameObjects.Container | null = null;
  private _slotsContainer: Phaser.GameObjects.Container | null = null;
  private _rosterContainer: Phaser.GameObjects.Container | null = null;

  // Run config state
  private _selectedMapId = 'goblin_wastes';
  private _ascensionLevel = 0;
  private _activeModifiers: string[] = [];

  constructor() {
    super({ key: 'SquadSelectScene' });
  }

  create() {
    (this.registry.get('music') as MusicSystem | null)?.play('menu');
    this._meta = getMetaBonuses();

    // Calculate slot count
    this._slotCount = Math.min(
      STARTER_SQUAD_SIZE + this._meta.squadSizeBonus,
      MAX_SQUAD_SIZE,
    );

    // Determine available hero classes
    this._availableClasses = ['WARRIOR', 'RANGER', 'MAGE', 'PRIEST'] as HeroClass[];
    for (const cls of this._meta.unlockedHeroClasses) {
      if (!this._availableClasses.includes(cls as HeroClass)) {
        this._availableClasses.push(cls as HeroClass);
      }
    }

    this.cameras.main.fadeIn(400, 0, 0, 0);

    // Clean up scene-level drag listeners on shutdown to prevent accumulation
    this.events.once('shutdown', () => {
      this.input.off('drag');
      this.input.off('dragend');
      this.input.off('drop');
    });

    this.buildBackground();
    this.buildSettingsButton();
    this.buildShardDisplay();
    this.buildTitleText();
    this.buildSlots();
    this.buildRoster();
    this.buildRunConfig();
    this.buildBottomButtons();

    // Pre-fill with last squad or defaults
    this.prefillSquad();
  }

  // ── Background ──────────────────────────────────────────────────────────
  private buildBackground() {
    const bg = this.add.graphics().setDepth(0);

    // Dark blue gradient
    bg.fillGradientStyle(0x0a0e2a, 0x0a0e2a, 0x101830, 0x101830, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Subtle ground strip
    bg.fillGradientStyle(0x0d1a2a, 0x0d1a2a, 0x081218, 0x081218, 1);
    bg.fillRect(0, GAME_HEIGHT * 0.82, GAME_WIDTH, GAME_HEIGHT * 0.18);

    // Stars
    for (let i = 0; i < 50; i++) {
      const sx = Phaser.Math.Between(0, GAME_WIDTH);
      const sy = Phaser.Math.Between(0, GAME_HEIGHT * 0.6);
      bg.fillStyle(0xffffff, Math.random() * 0.3 + 0.05);
      bg.fillCircle(sx, sy, Math.random() < 0.1 ? 2 : 1);
    }
  }

  // ── Settings gear (top-left) ──────────────────────────────────────────
  private buildSettingsButton() {
    const size = 44, r = 8;
    const bg = this.add.graphics().setDepth(20);
    const draw = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(0x060b12, hovered ? 1 : 0.75);
      bg.fillRoundedRect(10, 10, size, size, r);
      bg.lineStyle(1, 0x3a5070, hovered ? 1 : 0.5);
      bg.strokeRoundedRect(10, 10, size, size, r);
    };
    draw(false);
    this.add.text(10 + size / 2, 10 + size / 2, '\u2699', {
      fontSize: '24px', fontFamily: 'Nunito, sans-serif',
    }).setOrigin(0.5).setDepth(21);

    const hit = this.add.rectangle(10 + size / 2, 10 + size / 2, size, size, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(22);
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => {
      this.scene.launch('SettingsScene', { callerKey: 'SquadSelectScene' });
    });
  }

  // ── Shard display (top-right) ─────────────────────────────────────────
  private buildShardDisplay() {
    const px = GAME_WIDTH - 20, py = 14;
    const W = 140, H = 36;

    const panel = this.add.graphics().setDepth(10);
    panel.fillStyle(0x0d1526, 0.92);
    panel.fillRoundedRect(px - W, py, W, H, 7);
    panel.lineStyle(1, 0x3a5570, 0.7);
    panel.strokeRoundedRect(px - W, py, W, H, 7);

    this.add.text(px - W / 2, py + H / 2, `\u25c6 ${getShards()}`, {
      fontSize: '16px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif',
      color: '#7ec8e3', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(11);
  }

  // ── Title ─────────────────────────────────────────────────────────────
  private buildTitleText() {
    this.add.text(GAME_WIDTH / 2, 56, 'ASSEMBLE YOUR SQUAD', {
      fontSize: '36px', fontFamily: 'Nunito, sans-serif',
      color: '#c8a840', stroke: '#000', strokeThickness: 4,
      letterSpacing: 4,
    }).setOrigin(0.5).setDepth(10);
  }

  // ── Squad Slots ───────────────────────────────────────────────────────
  private buildSlots() {
    const slotW = this._slotCount <= 4 ? 140 : 120;
    const slotH = this._slotCount <= 4 ? 160 : 140;
    const gap = this._slotCount <= 4 ? 16 : 12;
    const totalW = this._slotCount * slotW + (this._slotCount - 1) * gap;
    const startX = GAME_WIDTH / 2 - totalW / 2 + slotW / 2;
    const slotY = 160;

    this._slotsContainer = this.add.container(0, 0).setDepth(5);
    this._slots = [];

    for (let i = 0; i < this._slotCount; i++) {
      const sx = startX + i * (slotW + gap);
      const card = this.buildSlotCard(sx, slotY, i, slotW, slotH);
      this._slots.push(card);
    }
  }

  private buildSlotCard(x: number, y: number, index: number, w: number, h: number): SlotCard {
    const container = this.add.container(x, y).setDepth(6);

    // Background — will be redrawn
    const bg = this.add.graphics();
    container.add(bg);
    container.setData('bg', bg);
    container.setData('w', w);
    container.setData('h', h);

    const slot: SlotCard = { container, heroClass: null, index };

    // Make the slot a drop target
    const dropZone = this.add.rectangle(0, 0, w, h, 0x000000, 0)
      .setInteractive({ dropZone: true });
    container.add(dropZone);
    container.setData('dropZone', dropZone);

    // Click empty slot → fill with first available
    dropZone.on('pointerdown', () => {
      if (!slot.heroClass) {
        const next = this.getFirstAvailableClass();
        if (next) this.fillSlot(index, next);
      }
    });

    this.drawSlotCard(slot);
    return slot;
  }

  private drawSlotCard(slot: SlotCard) {
    const { container, heroClass } = slot;
    const bg = container.getData('bg') as Phaser.GameObjects.Graphics;
    const w = container.getData('w') as number;
    const h = container.getData('h') as number;

    bg.clear();

    // Remove old visuals (sprite, texts, remove button)
    const oldSprite = container.getData('heroSprite') as Phaser.GameObjects.Sprite | null;
    if (oldSprite) { oldSprite.destroy(); container.setData('heroSprite', null); }
    const oldName = container.getData('nameText') as Phaser.GameObjects.Text | null;
    if (oldName) { oldName.destroy(); container.setData('nameText', null); }
    const oldPlus = container.getData('plusText') as Phaser.GameObjects.Text | null;
    if (oldPlus) { oldPlus.destroy(); container.setData('plusText', null); }
    const oldRemBtn = container.getData('removeBtn') as Phaser.GameObjects.Container | null;
    if (oldRemBtn) { oldRemBtn.destroy(); container.setData('removeBtn', null); }

    if (heroClass) {
      const color = CLASS_COLORS[heroClass] ?? 0x3a5070;
      // Filled card
      bg.fillStyle(0x0d1a2e, 0.95);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      bg.lineStyle(2, color, 0.9);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

      // Hero sprite
      const key = heroClass.toLowerCase();
      const sprite = this.add.sprite(0, -10, `${key}_idle_1`)
        .setDisplaySize(64, 64);
      const animKey = `${key}_idle`;
      if (this.anims.exists(animKey)) sprite.play(animKey);
      container.add(sprite);
      container.setData('heroSprite', sprite);

      // Name label
      const label = CLASS_LABELS[heroClass] ?? heroClass;
      const nameText = this.add.text(0, h / 2 - 28, label, {
        fontSize: '18px', fontFamily: 'Nunito, sans-serif',
        color: '#' + color.toString(16).padStart(6, '0'),
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5);
      container.add(nameText);
      container.setData('nameText', nameText);

      // Remove button (X) — top right
      const remBtn = this.add.container(w / 2 - 16, -h / 2 + 16);
      const remBg = this.add.graphics();
      remBg.fillStyle(0x2a0a0a, 0.9);
      remBg.fillCircle(0, 0, 16);
      remBg.lineStyle(1, 0xe74c3c, 0.7);
      remBg.strokeCircle(0, 0, 16);
      remBtn.add(remBg);
      const remX = this.add.text(0, 0, '\u2715', {
        fontSize: '16px', fontFamily: 'Nunito, sans-serif', color: '#e74c3c',
      }).setOrigin(0.5);
      remBtn.add(remX);
      const remHit = this.add.rectangle(0, 0, 32, 32, 0, 0)
        .setInteractive({ useHandCursor: true });
      remBtn.add(remHit);
      remHit.on('pointerdown', (pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        this.clearSlot(slot.index);
      });
      container.add(remBtn);
      container.setData('removeBtn', remBtn);
    } else {
      // Empty card — dashed border
      bg.fillStyle(0x0a1020, 0.6);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      bg.lineStyle(2, 0x2a3a50, 0.5);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

      // Dashed inner border effect
      bg.lineStyle(1, 0x3a4a60, 0.3);
      const dash = 8, gapSize = 6;
      // Top edge
      for (let dx = -w / 2 + 10; dx < w / 2 - 10; dx += dash + gapSize) {
        bg.lineBetween(dx, -h / 2 + 4, Math.min(dx + dash, w / 2 - 10), -h / 2 + 4);
      }
      // Bottom edge
      for (let dx = -w / 2 + 10; dx < w / 2 - 10; dx += dash + gapSize) {
        bg.lineBetween(dx, h / 2 - 4, Math.min(dx + dash, w / 2 - 10), h / 2 - 4);
      }

      // Plus icon
      const plus = this.add.text(0, -6, '+', {
        fontSize: '36px', fontFamily: 'Nunito, sans-serif',
        color: '#2a3a50',
      }).setOrigin(0.5);
      container.add(plus);
      container.setData('plusText', plus);
    }
  }

  private fillSlot(index: number, heroClass: HeroClass) {
    if (index < 0 || index >= this._slots.length) return;
    this._slots[index].heroClass = heroClass;
    this.drawSlotCard(this._slots[index]);
    this.refreshRoster();
    this.updateBeginButton();
  }

  private clearSlot(index: number) {
    if (index < 0 || index >= this._slots.length) return;
    this._slots[index].heroClass = null;
    this.drawSlotCard(this._slots[index]);
    this.refreshRoster();
    this.updateBeginButton();
  }

  private getSlottedClasses(): HeroClass[] {
    return this._slots
      .filter(s => s.heroClass !== null)
      .map(s => s.heroClass!);
  }

  private getFirstAvailableClass(): HeroClass | null {
    const slotted = new Set(this.getSlottedClasses());
    for (const cls of this._availableClasses) {
      if (!slotted.has(cls)) return cls;
    }
    return null;
  }

  private getFirstEmptySlotIndex(): number {
    return this._slots.findIndex(s => s.heroClass === null);
  }

  // ── Roster Panel ──────────────────────────────────────────────────────
  private buildRoster() {
    this._rosterContainer = this.add.container(0, 0).setDepth(5);
    this._roster = [];

    this.layoutRoster();
  }

  private layoutRoster() {
    // Clear existing
    for (const r of this._roster) {
      r.container.destroy();
    }
    this._roster = [];

    const cardW = 100, cardH = 110, gap = 12;
    const totalW = this._availableClasses.length * cardW + (this._availableClasses.length - 1) * gap;
    const startX = GAME_WIDTH / 2 - totalW / 2 + cardW / 2;
    const rosterY = 370;

    const slotted = new Set(this.getSlottedClasses());

    for (let i = 0; i < this._availableClasses.length; i++) {
      const cls = this._availableClasses[i];
      const rx = startX + i * (cardW + gap);
      const isSlotted = slotted.has(cls);

      const container = this.add.container(rx, rosterY).setDepth(6);
      const color = CLASS_COLORS[cls] ?? 0x3a5070;

      // Card background
      const bg = this.add.graphics();
      bg.fillStyle(0x0a1526, isSlotted ? 0.5 : 0.9);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
      bg.lineStyle(1.5, color, isSlotted ? 0.3 : 0.7);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
      container.add(bg);

      // Hero sprite
      const key = cls.toLowerCase();
      const sprite = this.add.sprite(0, -14, `${key}_idle_1`)
        .setDisplaySize(48, 48)
        .setAlpha(isSlotted ? 0.35 : 1);
      const animKey = `${key}_idle`;
      if (this.anims.exists(animKey)) sprite.play(animKey);
      container.add(sprite);

      // Label
      const label = CLASS_LABELS[cls] ?? cls;
      const nameText = this.add.text(0, cardH / 2 - 28, label, {
        fontSize: '15px', fontFamily: 'Nunito, sans-serif',
        color: isSlotted ? '#6a7a8a' : '#' + color.toString(16).padStart(6, '0'),
        stroke: '#000', strokeThickness: 1,
      }).setOrigin(0.5);
      container.add(nameText);

      // "In Squad" label if slotted
      if (isSlotted) {
        const inSquad = this.add.text(0, cardH / 2 - 14, 'In Squad', {
          fontSize: '13px', fontFamily: 'Nunito, sans-serif',
          color: '#4a5a6a',
        }).setOrigin(0.5);
        container.add(inSquad);
      }

      // Interactive — click to add to first empty slot
      if (!isSlotted) {
        const hit = this.add.rectangle(0, 0, cardW, cardH, 0, 0)
          .setInteractive({ useHandCursor: true, draggable: true });
        container.add(hit);

        hit.on('pointerover', () => {
          bg.clear();
          bg.fillStyle(0x142030, 1);
          bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
          bg.lineStyle(2, color, 1);
          bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
        });
        hit.on('pointerout', () => {
          bg.clear();
          bg.fillStyle(0x0a1526, 0.9);
          bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
          bg.lineStyle(1.5, color, 0.7);
          bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
        });
        hit.on('pointerdown', () => {
          const emptyIdx = this.getFirstEmptySlotIndex();
          if (emptyIdx >= 0) {
            this.fillSlot(emptyIdx, cls);
          }
        });

        // Drag support
        hit.setData('heroClass', cls);
        this.input.setDraggable(hit);
      }

      this._roster.push({ container, heroClass: cls, sprite });
    }

    // Drag events (scene-level)
    this.input.off('drag'); // avoid duplicate listeners
    this.input.off('dragend');
    this.input.off('drop');

    this.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Rectangle, dragX: number, dragY: number) => {
      // Move the parent container to follow drag
      const parent = gameObject.parentContainer;
      if (parent) {
        parent.setPosition(dragX, dragY);
      }
    });

    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Rectangle, dropped: boolean) => {
      if (!dropped) {
        // Snap back — re-layout roster
        this.refreshRoster();
      }
    });

    this.input.on('drop', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Rectangle, dropZone: Phaser.GameObjects.Rectangle) => {
      const cls = gameObject.getData('heroClass') as HeroClass;
      // Find which slot this dropZone belongs to
      const slot = this._slots.find(s => s.container.getData('dropZone') === dropZone);
      if (slot && !slot.heroClass && cls) {
        this.fillSlot(slot.index, cls);
      } else {
        this.refreshRoster();
      }
    });
  }

  private refreshRoster() {
    if (this._rosterContainer) {
      this._rosterContainer.destroy();
      this._rosterContainer = this.add.container(0, 0).setDepth(5);
    }
    this._roster = [];
    this.layoutRoster();
  }

  // ── Bottom Buttons ────────────────────────────────────────────────────
  private buildBottomButtons() {
    const btnY = GAME_HEIGHT - 60;

    // Back button (left)
    this.buildButton(GAME_WIDTH / 2 - 140, btnY, '\u2190 Back', 0x3a5070, () => {
      this.cameras.main.fadeOut(300, 0, 0, 0, (_: unknown, p: number) => {
        if (p === 1) this.scene.start('MainMenuScene');
      });
    });

    // Begin Run button (right)
    this._beginBtn = this.buildButton(GAME_WIDTH / 2 + 140, btnY, 'Begin Run \u2192', 0x2ecc71, () => {
      this.startRun();
    });

    this.updateBeginButton();
  }

  private buildButton(x: number, y: number, label: string, accentColor: number, onClick: () => void): Phaser.GameObjects.Container {
    const w = 180, h = 46, r = 9;
    const container = this.add.container(x, y).setDepth(15);

    const bg = this.add.graphics();
    const dark = Phaser.Display.Color.IntegerToColor(accentColor);
    const drawBg = (hovered: boolean) => {
      bg.clear();
      const bgColor = Phaser.Display.Color.GetColor(
        Math.floor(dark.red * 0.15),
        Math.floor(dark.green * 0.15),
        Math.floor(dark.blue * 0.15),
      );
      bg.fillStyle(hovered ? Phaser.Display.Color.GetColor(
        Math.floor(dark.red * 0.35),
        Math.floor(dark.green * 0.35),
        Math.floor(dark.blue * 0.35),
      ) : bgColor, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      bg.lineStyle(hovered ? 2 : 1, accentColor, hovered ? 1 : 0.65);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    };
    drawBg(false);
    container.add(bg);

    container.add(
      this.add.text(0, 0, label, {
        fontSize: '20px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif',
        color: '#' + accentColor.toString(16).padStart(6, '0'),
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5),
    );

    const hit = this.add.rectangle(0, 0, w, h, 0, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hit);
    hit.on('pointerover', () => { drawBg(true); this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 70 }); });
    hit.on('pointerout', () => { drawBg(false); this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 70 }); });
    hit.on('pointerdown', onClick);

    return container;
  }

  private updateBeginButton() {
    if (!this._beginBtn) return;
    const hasHeroes = this.getSlottedClasses().length > 0;
    this._beginBtn.setAlpha(hasHeroes ? 1 : 0.4);
    // Disable/enable the hit area
    const hit = this._beginBtn.getAt(2) as Phaser.GameObjects.Rectangle;
    if (hasHeroes) {
      hit.setInteractive({ useHandCursor: true });
    } else {
      hit.disableInteractive();
    }
  }

  // ── Prefill ───────────────────────────────────────────────────────────
  private prefillSquad() {
    // Try loading last saved squad
    let savedSquad: HeroClass[] | null = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) savedSquad = JSON.parse(raw) as HeroClass[];
    } catch { /* ignore */ }

    // Filter saved squad to only available classes and respect slot count
    const validClasses = new Set(this._availableClasses);
    let prefill: HeroClass[];

    if (savedSquad && savedSquad.length > 0) {
      prefill = savedSquad.filter(cls => validClasses.has(cls));
    } else {
      // Default: WARRIOR, RANGER, MAGE, PRIEST
      prefill = (['WARRIOR', 'RANGER', 'MAGE', 'PRIEST'] as HeroClass[])
        .filter(cls => validClasses.has(cls));
    }

    // Fill slots
    for (let i = 0; i < Math.min(prefill.length, this._slotCount); i++) {
      this._slots[i].heroClass = prefill[i];
      this.drawSlotCard(this._slots[i]);
    }

    this.refreshRoster();
    this.updateBeginButton();
  }

  // ── Run Config (map, ascension, modifiers) ────────────────────────────
  private buildRunConfig() {
    const cx = GAME_WIDTH / 2;
    const panelY = 490;
    const pw = 620, ph = 100, pr = 8;

    // Panel background — centered below roster
    const panel = this.add.graphics().setDepth(10);
    panel.fillStyle(0x0a1220, 0.88);
    panel.fillRoundedRect(cx - pw / 2, panelY, pw, ph, pr);
    panel.lineStyle(1, 0x3a5070, 0.45);
    panel.strokeRoundedRect(cx - pw / 2, panelY, pw, ph, pr);

    // ── Map selection (left column) ──
    const mapCX = cx - 200;
    this.add.text(mapCX, panelY + 10, 'MAP', {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif', color: '#4a6a8a', letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(11);

    const maps = getAllMaps();
    let mapIdx = maps.findIndex(m => m.id === this._selectedMapId);
    if (mapIdx < 0) mapIdx = 0;
    const mapLabel = this.add.text(mapCX, panelY + 32, maps[mapIdx].name, {
      fontSize: '18px', fontFamily: 'Nunito, sans-serif', color: '#f1c40f',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(11);

    const updateMap = () => {
      this._selectedMapId = maps[mapIdx].id;
      mapLabel.setText(maps[mapIdx].name);
    };
    this.buildSmallArrowBtn(mapCX - 80, panelY + 36, '\u25c0', () => {
      mapIdx = (mapIdx - 1 + maps.length) % maps.length; updateMap();
    });
    this.buildSmallArrowBtn(mapCX + 80, panelY + 36, '\u25b6', () => {
      mapIdx = (mapIdx + 1) % maps.length; updateMap();
    });

    // Subtle divider
    panel.lineStyle(1, 0x2a3a50, 0.4);
    panel.lineBetween(cx - 80, panelY + 12, cx - 80, panelY + ph - 12);

    // ── Ascension (center column) ──
    const ascCX = cx;
    this.add.text(ascCX, panelY + 10, 'ASCENSION', {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif', color: '#4a6a8a', letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(11);

    const maxAsc = getUnlockedAscension();
    const ascLabel = this.add.text(ascCX, panelY + 32, `${this._ascensionLevel}`, {
      fontSize: '20px', fontStyle: 'bold', fontFamily: 'Nunito, sans-serif',
      color: this._ascensionLevel > 0 ? '#e74c3c' : '#5a7a9a',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(11);

    const updateAsc = () => {
      ascLabel.setText(`${this._ascensionLevel}`);
      ascLabel.setColor(this._ascensionLevel > 0 ? '#e74c3c' : '#5a7a9a');
    };
    this.buildSmallArrowBtn(ascCX - 36, panelY + 36, '\u25c0', () => {
      this._ascensionLevel = Math.max(0, this._ascensionLevel - 1); updateAsc();
    });
    this.buildSmallArrowBtn(ascCX + 36, panelY + 36, '\u25b6', () => {
      this._ascensionLevel = Math.min(maxAsc, this._ascensionLevel + 1); updateAsc();
    });

    // Subtle divider
    panel.lineBetween(cx + 80, panelY + 12, cx + 80, panelY + ph - 12);

    // ── Modifier toggles (right column) ──
    const modCX = cx + 200;
    this.add.text(modCX, panelY + 10, 'MODIFIERS', {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif', color: '#4a6a8a', letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(11);

    const modDefs = [
      { id: 'glass_cannon', label: 'Glass Cannon', color: 0xe74c3c },
      { id: 'marathon', label: 'Marathon', color: 0x3498db },
      { id: 'poverty', label: 'Poverty', color: 0xf39c12 },
      { id: 'chaos', label: 'Chaos', color: 0x9b59b6 },
    ];

    // 2x2 grid of modifier chips
    modDefs.forEach((mod, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const mx = modCX - 55 + col * 110;
      const my = panelY + 32 + row * 30;
      this.buildModChip(mx, my, mod.id, mod.label, mod.color);
    });
  }

  /** Small arrow button (used in run config panel) */
  private buildSmallArrowBtn(x: number, y: number, char: string, onClick: () => void) {
    const g = this.add.graphics().setDepth(11);
    const draw = (hovered: boolean) => {
      g.clear();
      g.fillStyle(hovered ? 0x1a2a3e : 0x0d1526, 1);
      g.fillRoundedRect(x - 20, y - 6, 40, 32, 6);
      g.lineStyle(1, hovered ? 0x5a8ab8 : 0x2a4a60, hovered ? 0.9 : 0.5);
      g.strokeRoundedRect(x - 20, y - 6, 40, 32, 6);
    };
    draw(false);
    this.add.text(x, y + 10, char, {
      fontSize: '16px', fontFamily: 'Nunito, sans-serif', color: '#7a9ab8',
    }).setOrigin(0.5).setDepth(12);
    const hit = this.add.rectangle(x, y + 10, 40, 32, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(13);
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', onClick);
  }

  /** Modifier toggle chip (used in run config panel) */
  private buildModChip(x: number, y: number, modId: string, label: string, color: number) {
    const w = 110, h = 30, r = 6;
    const isOn = this._activeModifiers.includes(modId);
    const g = this.add.graphics().setDepth(11);
    const textObj = this.add.text(x, y + h / 2, label, {
      fontSize: '14px', fontFamily: 'Nunito, sans-serif',
      color: isOn ? '#' + color.toString(16).padStart(6, '0') : '#4a5a6a',
      stroke: '#000', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(12);
    let active = isOn;

    const draw = (hovered: boolean) => {
      g.clear();
      if (active) {
        const dc = Phaser.Display.Color.IntegerToColor(color);
        const bg = Phaser.Display.Color.GetColor(
          Math.floor(dc.red * 0.18), Math.floor(dc.green * 0.18), Math.floor(dc.blue * 0.18),
        );
        g.fillStyle(bg, 1);
        g.fillRoundedRect(x - w / 2, y, w, h, r);
        g.lineStyle(1.5, color, hovered ? 1 : 0.7);
        g.strokeRoundedRect(x - w / 2, y, w, h, r);
      } else {
        g.fillStyle(hovered ? 0x0f1a28 : 0x0a1220, 0.8);
        g.fillRoundedRect(x - w / 2, y, w, h, r);
        g.lineStyle(1, 0x2a3a4a, hovered ? 0.6 : 0.3);
        g.strokeRoundedRect(x - w / 2, y, w, h, r);
      }
    };
    draw(false);

    const hit = this.add.rectangle(x, y + h / 2, w, h, 0, 0)
      .setInteractive({ useHandCursor: true }).setDepth(13);
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => {
      const idx = this._activeModifiers.indexOf(modId);
      if (idx >= 0) {
        this._activeModifiers.splice(idx, 1);
        active = false;
      } else {
        this._activeModifiers.push(modId);
        active = true;
      }
      draw(true);
      textObj.setColor(active ? '#' + color.toString(16).padStart(6, '0') : '#4a5a6a');
    });
  }

  // ── Start Run ─────────────────────────────────────────────────────────
  private startRun() {
    const squad = this.getSlottedClasses();
    if (squad.length === 0) return;

    // Save squad selection
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(squad));
    } catch { /* ignore */ }

    clearSave();
    // Load nodes from selected map
    const mapDef = getMapById(this._selectedMapId);
    const nodes = mapDef ? (mapDef.nodes as NodeDef[]) : (nodesData.nodes as NodeDef[]);
    newRun(nodes, squad, this._meta, this._selectedMapId, {
      ascensionLevel: this._ascensionLevel,
      modifiers: this._activeModifiers,
    });

    // Inject starting relic if purchased
    if (this._meta.startingRelic) {
      const relic = pickRandomCommonRelic();
      if (relic) addRelic(relic);
    }

    this.cameras.main.fadeOut(350, 0, 0, 0, (_: unknown, p: number) => {
      if (p === 1) this.scene.start('OverworldScene');
    });
  }
}
