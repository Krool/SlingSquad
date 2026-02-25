import Phaser from 'phaser';
import { MusicSystem } from '@/systems/MusicSystem';

interface CharAnim {
  name: string;
  prefix: string;
  count: number;
  frameRate: number;
  repeat: number;
}

interface CharDef {
  key: string;
  folder: string;
  anims: CharAnim[];
}

// Character sprite definitions — key = lowercased HeroClass / EnemyClass
// folder = medievalrpgpack subfolder
// Frame file pattern: assets/sprites/medievalrpgpack/{folder}/{PREFIX} {N}.png
const CHARS: CharDef[] = [
  {
    key: 'warrior', folder: 'WARRIOR', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
    ],
  },
  {
    key: 'ranger', folder: 'ASSASIN', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  {
    key: 'mage', folder: 'SORCERESS', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  {
    key: 'priest', folder: 'NECROMANCER', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  {
    key: 'grunt', folder: 'BARBARIAN', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  {
    key: 'ranged', folder: 'CENTAUR', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 2, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  // New enemy types — reuse existing sprite folders with unique Phaser keys
  {
    key: 'shield', folder: 'WARRIOR', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
    ],
  },
  {
    key: 'bomber', folder: 'BARBARIAN', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  {
    key: 'healer', folder: 'NECROMANCER', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  {
    key: 'boss_grunt', folder: 'BARBARIAN', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  // Bard hero — reuses SORCERESS sprites
  {
    key: 'bard', folder: 'SORCERESS', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  // Rogue hero — reuses ASSASIN sprites (darker tint applied in Hero.ts)
  {
    key: 'rogue', folder: 'ASSASIN', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  // Paladin hero — reuses WARRIOR sprites (gold tint applied in Hero.ts)
  {
    key: 'paladin', folder: 'WARRIOR', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
    ],
  },
  // Druid hero — reuses NECROMANCER sprites (green tint applied in Hero.ts)
  {
    key: 'druid', folder: 'NECROMANCER', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  // ── Frozen Peaks enemies ──
  {
    key: 'ice_mage', folder: 'SORCERESS', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  {
    key: 'yeti', folder: 'BARBARIAN', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  {
    key: 'frost_archer', folder: 'CENTAUR', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 2, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  // ── Infernal Keep enemies ──
  {
    key: 'fire_imp', folder: 'ASSASIN', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
  {
    key: 'demon_knight', folder: 'WARRIOR', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
    ],
  },
  {
    key: 'infernal_boss', folder: 'BARBARIAN', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
      { name: 'hurt',   prefix: 'HURT',   count: 3, frameRate: 10, repeat:  0 },
    ],
  },
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.setPath('assets/');

    for (const char of CHARS) {
      for (const anim of char.anims) {
        for (let i = 1; i <= anim.count; i++) {
          this.load.image(
            `${char.key}_${anim.name}_${i}`,
            `sprites/medievalrpgpack/${char.folder}/${anim.prefix} ${i}.png`,
          );
        }
      }
    }
  }

  create() {
    for (const char of CHARS) {
      for (const anim of char.anims) {
        const frames: Phaser.Types.Animations.AnimationFrame[] = [];
        for (let i = 1; i <= anim.count; i++) {
          frames.push({ key: `${char.key}_${anim.name}_${i}` });
        }
        this.anims.create({
          key: `${char.key}_${anim.name}`,
          frames,
          frameRate: anim.frameRate,
          repeat: anim.repeat,
        });
      }
    }

    // Instantiate MusicSystem once and share via registry (cross-scene singleton)
    const music = new MusicSystem();
    this.registry.set('music', music);

    console.log('[BootScene] create() complete, starting MainMenuScene');
    this.scene.start('MainMenuScene');
  }
}
