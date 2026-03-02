import type { TemplateFn } from './types';

// ─── "Coin Field" — dense diamond grid of coins + shard crystals + stone vault on right ──
export const coinField: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // ── Left/center: dense diamond pattern of coins ─────────────────────────
  const startX = 420;
  const rows = 5;
  const cols = 5;
  const spacingX = 55;
  const spacingY = 45;
  const baseY = groundY - 60;

  for (let r = 0; r < rows; r++) {
    const rowOffset = (r % 2) * (spacingX / 2);
    const rowCols = r % 2 === 0 ? cols : cols - 1;
    for (let c = 0; c < rowCols; c++) {
      const cx = startX + c * spacingX + rowOffset;
      const cy = baseY - r * spacingY;
      const value = (r >= 3 || c >= 3) ? 5 : 3; // higher rows/farther cols = more gold
      ctx.coin(cx, cy, value);
    }
  }

  // ── Shard crystals scattered among coins ───────────────────────────────
  ctx.shard?.(startX + spacingX * 2, baseY - spacingY * 2);
  ctx.shard?.(startX + spacingX * 0.5, baseY - spacingY * 4);
  ctx.shard?.(startX + spacingX * 3.5, baseY - spacingY * 1);

  // ── Right side: stone vault protecting a chest ─────────────────────────
  const vaultX = 900;
  const wallH = 100;
  const wallW = 20;
  const innerW = 80;

  // Left wall
  b(vaultX - innerW / 2 - wallW / 2, groundY - wallH / 2, wallW, wallH, 'STONE');
  // Right wall
  b(vaultX + innerW / 2 + wallW / 2, groundY - wallH / 2, wallW, wallH, 'STONE');
  // Roof
  b(vaultX, groundY - wallH - 6, innerW + wallW * 2 + 10, 18, 'STONE');
  // Back wall (thinner, behind chest)
  b(vaultX + innerW / 2 - 5, groundY - wallH / 2, 12, wallH, 'STONE');

  // Chest inside the vault
  ctx.chest?.(vaultX - 10, groundY - 30);

  // Bonus coin on top of vault
  ctx.coin(vaultX, groundY - wallH - 30, 5);
};

// ─── "Treasure Trench" — coins in a valley with raised stone walls + vault behind ──
export const treasureTrench: TemplateFn = (ctx) => {
  const { groundY } = ctx;
  const b = ctx.block.bind(ctx);

  // ── Raised terrain walls creating a trench ─────────────────────────────
  ctx.terrain(520, groundY - 15, 60, 30);
  ctx.terrain(780, groundY - 15, 60, 30);

  // ── Coins filling the trench area ─────────────────────────────────────
  const startX = 440;
  const endX = 740;
  const numCols = 7;
  const spacingX = (endX - startX) / (numCols - 1);

  // Ground row
  for (let c = 0; c < numCols; c++) {
    ctx.coin(startX + c * spacingX, groundY - 25, 3);
  }
  // Mid row
  for (let c = 0; c < numCols - 1; c++) {
    ctx.coin(startX + c * spacingX + spacingX / 2, groundY - 70, 4);
  }
  // High row (fewer, more valuable)
  for (let c = 0; c < 4; c++) {
    ctx.coin(startX + 40 + c * 70, groundY - 120, 5);
  }
  // Very high row (arc targets)
  ctx.coin(500, groundY - 180, 5);
  ctx.coin(600, groundY - 200, 5);
  ctx.coin(700, groundY - 180, 5);

  // ── Shard crystals ─────────────────────────────────────────────────────
  ctx.shard?.(560, groundY - 150);
  ctx.shard?.(660, groundY - 90);

  // ── Stone vault on the far right ──────────────────────────────────────
  const vaultX = 920;
  const wallH = 90;
  const wallW = 18;
  const innerW = 70;

  // Left wall (double thick)
  b(vaultX - innerW / 2 - wallW / 2, groundY - wallH / 2, wallW, wallH, 'STONE');
  b(vaultX - innerW / 2 - wallW * 1.5, groundY - wallH / 2, wallW, wallH, 'STONE');
  // Right wall
  b(vaultX + innerW / 2 + wallW / 2, groundY - wallH / 2, wallW, wallH, 'STONE');
  // Roof
  b(vaultX, groundY - wallH - 6, innerW + wallW * 3 + 10, 18, 'STONE');

  // Chest inside
  ctx.chest?.(vaultX, groundY - 30);

  // Coins near vault entrance
  ctx.coin(vaultX - innerW, groundY - 25, 4);
  ctx.coin(vaultX - innerW, groundY - 70, 4);
};

export const treasureTemplates: TemplateFn[] = [coinField, treasureTrench];
