import Phaser from 'phaser';
import { MusicSystem } from '@/systems/MusicSystem';
import { AudioSystem } from '@/systems/AudioSystem';
import relicsData from '@/data/relics.json';
import cursesData from '@/data/curses.json';
import eventsData from '@/data/events.json';
import { relicTextureKey } from '@/ui/RelicIcon';
import { ensureProfile, setFirebaseUid } from '@/systems/PlayerProfile';
import { initFirebase, getFirebaseUid, isFirebaseAvailable } from '@/services/LeaderboardService';

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
      { name: 'walk',   prefix: 'WALK',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'jump',   prefix: 'JUMP',   count: 4, frameRate: 10, repeat: -1 },
      { name: 'fall',   prefix: 'FALL',   count: 3, frameRate: 10, repeat: -1 },
      { name: 'attack', prefix: 'ATTACK', count: 3, frameRate: 8,  repeat: -1 },
      { name: 'defeat', prefix: 'DEFEAT', count: 3, frameRate: 8,  repeat:  0 },
    ],
  },
  {
    key: 'ranger', folder: 'ASSASIN', anims: [
      { name: 'idle',   prefix: 'IDLE',   count: 4, frameRate: 8,  repeat: -1 },
      { name: 'walk',   prefix: 'WALK',   count: 4, frameRate: 10, repeat: -1 },
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
      { name: 'walk',   prefix: 'WALK',   count: 4, frameRate: 10, repeat: -1 },
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
      { name: 'walk',   prefix: 'WALK',   count: 4, frameRate: 10, repeat: -1 },
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
      { name: 'walk',   prefix: 'WALK',   count: 4, frameRate: 10, repeat: -1 },
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
      { name: 'walk',   prefix: 'WALK',   count: 4, frameRate: 10, repeat: -1 },
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
      { name: 'walk',   prefix: 'WALK',   count: 4, frameRate: 10, repeat: -1 },
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
      { name: 'walk',   prefix: 'WALK',   count: 4, frameRate: 10, repeat: -1 },
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
            `sprites/medievalrpgpack/${char.folder}/${anim.prefix}_${i}.png`,
          );
        }
      }
    }

    // ── RPG icon sprites (upgrade cards, codex tabs) ──────────────────────
    const iconBase = 'sprites/rpggame1700plusicons/RPG Graphics Pack - Icons/Pack 1A-Renamed';
    const ICON_MAP: Record<string, string> = {
      // Upgrade icons
      icon_gold_pouch:   `${iconBase}/accessory/accessory_05.png`,
      icon_health_potion:`${iconBase}/potion/potion_001.png`,
      icon_gold_ring:    `${iconBase}/ring/ring_001.png`,
      icon_sword_skill:  `${iconBase}/skill/skill_001.png`,
      icon_amulet:       `${iconBase}/accessory/accessory_16.png`,
      icon_power_skill:  `${iconBase}/skill/skill_005.png`,
      icon_bard_skill:   `${iconBase}/skill/skill_003.png`,
      icon_rogue_skill:  `${iconBase}/skill/skill_002.png`,
      icon_paladin_skill:`${iconBase}/skill/skill_009.png`,
      icon_druid_skill:  `${iconBase}/skill/skill_004.png`,
      icon_squad_skill:  `${iconBase}/skill/skill_007.png`,
      icon_forge_skill:  `${iconBase}/skill/skill_014.png`,
      icon_ward_skill:   `${iconBase}/skill/skill_015.png`,
      icon_crystal_skill:`${iconBase}/skill/skill_016.png`,
      // Codex tab icons
      icon_tab_heroes:   `${iconBase}/skill/skill_010.png`,
      icon_tab_bestiary: `${iconBase}/skill/skill_012.png`,
      icon_tab_relics:   `${iconBase}/accessory/accessory_01.png`,
      icon_tab_history:  `${iconBase}/quest/quest_005.png`,
    };
    for (const [key, path] of Object.entries(ICON_MAP)) {
      this.load.image(key, path);
    }

    // ── Relic & curse icon sprites ────────────────────────────────────────────
    const allRelicData = [...relicsData, ...cursesData] as { id: string; icon?: string }[];
    for (const r of allRelicData) {
      if (r.icon) {
        this.load.image(relicTextureKey(r.id), `${iconBase}/${r.icon}`);
      }
    }

    // ── Event icon sprites ──────────────────────────────────────────────────
    for (const ev of eventsData as { id: string; icon?: string }[]) {
      if (ev.icon) {
        this.load.image(`event_${ev.id}`, `${iconBase}/${ev.icon}`);
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

    // Set nearest-neighbor filtering on icon textures for crisp pixel art
    const iconKeys = this.textures.getTextureKeys().filter(k => k.startsWith('icon_') || k.startsWith('relic_') || k.startsWith('event_'));
    for (const key of iconKeys) {
      const src = this.textures.get(key).getSourceImage();
      if (src instanceof HTMLImageElement) {
        (src as HTMLImageElement).style.imageRendering = 'pixelated';
      }
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // Instantiate MusicSystem + AudioSystem once and share via registry (cross-scene singletons)
    const music = new MusicSystem();
    this.registry.set('music', music);
    const audio = new AudioSystem();
    this.registry.set('audio', audio);

    // Force-load custom fonts before starting first scene
    // (Phaser canvas text caches the font on first render — must be ready)
    // Ensure player profile exists on first load
    ensureProfile();

    // Initialize Firebase (fire-and-forget — game works fully offline)
    if (isFirebaseAvailable()) {
      initFirebase().then(ok => {
        if (ok) {
          const uid = getFirebaseUid();
          if (uid) setFirebaseUid(uid);
        }
      }).catch(() => { /* silent */ });
    }

    Promise.all([
      document.fonts.load('52px "Knights Quest"'),
      document.fonts.load('400 16px "Nunito"'),
    ]).then(() => this.scene.start('MainMenuScene'))
      .catch(() => this.scene.start('MainMenuScene'));
  }
}
