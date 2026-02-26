import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@/config/constants';
import { BootScene } from '@/scenes/BootScene';
import { OverworldScene } from '@/scenes/OverworldScene';
import { BattleScene } from '@/scenes/BattleScene';
import { ShopScene } from '@/scenes/ShopScene';
import { ResultScene } from '@/scenes/ResultScene';
import { MainMenuScene } from '@/scenes/MainMenuScene';
import { SquadSelectScene } from '@/scenes/SquadSelectScene';
import { CampUpgradesScene } from '@/scenes/CampUpgradesScene';
import { SettingsScene } from '@/scenes/SettingsScene';
import { EventScene } from '@/scenes/EventScene';
import { ForgeScene } from '@/scenes/ForgeScene';
import { CodexScene } from '@/scenes/CodexScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#0d1117',
  scale: {
    mode: Phaser.Scale.ENVELOP,
    autoCenter: Phaser.Scale.NO_CENTER,  // CSS handles sizing; no Phaser centering
    expandParent: false,
  },
  physics: {
    default: 'matter',
    matter: {
      // Matter.js applies gravity as: force * deltaTimeSquared
      // deltaTimeSquared = (1000/60)² ≈ 277.9
      // So: gravity.y * scale(0.001) * 277.9 = desired 0.3 px/step²
      // → gravity.y = 0.3 / (0.001 * 277.9) ≈ 1.08
      gravity: { x: 0, y: 1.08 },
      debug: false,
    },
  },
  scene: [BootScene, MainMenuScene, SquadSelectScene, OverworldScene, BattleScene, ShopScene, ResultScene, CampUpgradesScene, SettingsScene, EventScene, ForgeScene, CodexScene],
};

new Phaser.Game(config);
