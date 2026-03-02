import Phaser from 'phaser';
import type { RelicDef } from '@/systems/RunState';

/**
 * Relic icon texture key prefix — all relic icons loaded as `relic_{relicId}`.
 */
export function relicTextureKey(relicId: string): string {
  return `relic_${relicId}`;
}

/**
 * Render a relic icon sprite if the texture exists, otherwise return null.
 * Caller is responsible for adding the returned image to any container.
 *
 * @param scene  Active Phaser scene
 * @param relic  Relic definition (needs `id` field)
 * @param x      Center X position
 * @param y      Center Y position
 * @param size   Display width & height (square)
 * @returns The created Image or null if texture doesn't exist
 */
export function createRelicIcon(
  scene: Phaser.Scene,
  relic: RelicDef,
  x: number,
  y: number,
  size: number,
): Phaser.GameObjects.Image | null {
  const key = relicTextureKey(relic.id);
  if (!scene.textures.exists(key)) return null;

  return scene.add.image(x, y, key)
    .setDisplaySize(size, size)
    .setOrigin(0.5);
}
