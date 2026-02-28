import type { Hero } from '@/entities/Hero';
import type { Enemy } from '@/entities/Enemy';
import type { Barrel } from '@/entities/Barrel';
import type { Projectile } from '@/entities/Projectile';

/**
 * Matter.js body with game-specific entity references.
 * Every physics body created in entities or BattleScene gets one of
 * these custom fields set so collision handlers can look up the owner.
 */
export interface GameBody extends MatterJS.BodyType {
  __hero?: Hero;
  __enemy?: Enemy;
  __barrel?: Barrel;
  __projectile?: Projectile;
}
