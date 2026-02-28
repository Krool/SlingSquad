import type { MaterialType } from '@/config/constants';
import type { StructureContext } from './types';

// ─── Reusable Sub-Assemblies ─────────────────────────────────────────────────
// Keep templates concise by composing these building blocks.

/**
 * pillarPair — Two vertical pillars with a plank floor on top.
 * Returns the Y of the plank floor (top surface).
 */
export function pillarPair(
  ctx: StructureContext,
  cx: number,
  baseY: number,
  span: number,
  pillarH: number,
  pillarMat: MaterialType,
  plankMat: MaterialType,
  plankW?: number,
): number {
  const pw = plankW ?? span + 30;
  ctx.block(cx - span / 2, baseY - pillarH / 2, 14, pillarH, pillarMat);
  ctx.block(cx + span / 2, baseY - pillarH / 2, 14, pillarH, pillarMat);
  const floorY = baseY - pillarH - 6;
  ctx.block(cx, floorY, pw, 12, plankMat);
  return floorY;
}

/**
 * tower — Multi-level pillar+plank stack.
 * Returns array of floor Y values from bottom to top.
 */
export function tower(
  ctx: StructureContext,
  cx: number,
  baseY: number,
  span: number,
  levels: number,
  pillarHeights: number[],
  pillarMat: MaterialType,
  plankMat: MaterialType,
  plankW?: number,
): number[] {
  const floors: number[] = [];
  let currentBase = baseY;
  for (let i = 0; i < levels; i++) {
    const pH = pillarHeights[i] ?? pillarHeights[pillarHeights.length - 1];
    const floorY = pillarPair(ctx, cx, currentBase, span, pH, pillarMat, plankMat, plankW);
    floors.push(floorY);
    currentBase = floorY - 6;
  }
  return floors;
}

/**
 * wallSegment — A thick solid wall block.
 */
export function wallSegment(
  ctx: StructureContext,
  cx: number,
  baseY: number,
  w: number,
  h: number,
  mat: MaterialType,
) {
  ctx.block(cx, baseY - h / 2, w, h, mat);
}

/**
 * bridgeDeck — A long plank supported by evenly-spaced pillars.
 * Returns the Y of the deck.
 */
export function bridgeDeck(
  ctx: StructureContext,
  startX: number,
  endX: number,
  baseY: number,
  pillarH: number,
  supportCount: number,
  pillarMat: MaterialType,
  deckMat: MaterialType,
): number {
  const deckW = endX - startX;
  const deckCX = (startX + endX) / 2;
  const spacing = deckW / (supportCount - 1);
  for (let i = 0; i < supportCount; i++) {
    ctx.block(startX + i * spacing, baseY - pillarH / 2, 14, pillarH, pillarMat);
  }
  const deckY = baseY - pillarH - 6;
  ctx.block(deckCX, deckY, deckW + 20, 12, deckMat);
  return deckY;
}

/**
 * enclosure — A box structure with walls and floor, optionally roofed.
 * Returns { floorY, roofY? }.
 */
export function enclosure(
  ctx: StructureContext,
  cx: number,
  baseY: number,
  w: number,
  h: number,
  wallMat: MaterialType,
  floorMat: MaterialType,
  roofed = false,
): { floorY: number; roofY?: number } {
  // Two wall pillars
  ctx.block(cx - w / 2, baseY - h / 2, 14, h, wallMat);
  ctx.block(cx + w / 2, baseY - h / 2, 14, h, wallMat);
  // Floor on top
  const floorY = baseY - h - 6;
  ctx.block(cx, floorY, w + 20, 12, floorMat);
  if (roofed) {
    // Add a roof on top with short pillars
    const roofPH = 30;
    ctx.block(cx - w / 2, floorY - 6 - roofPH / 2, 14, roofPH, wallMat);
    ctx.block(cx + w / 2, floorY - 6 - roofPH / 2, 14, roofPH, wallMat);
    const roofY = floorY - 6 - roofPH - 6;
    ctx.block(cx, roofY, w + 30, 14, floorMat);
    return { floorY, roofY };
  }
  return { floorY };
}

/**
 * capBlock — A stone cap placed on a floor.
 */
export function capBlock(
  ctx: StructureContext,
  cx: number,
  floorY: number,
  mat: MaterialType = 'STONE',
  size = 28,
) {
  ctx.block(cx, floorY - 6 - size / 2, size, size, mat);
}

/**
 * triPillar — Three pillars (two outer + one center) with plank.
 * Returns the floor Y.
 */
export function triPillar(
  ctx: StructureContext,
  cx: number,
  baseY: number,
  span: number,
  pillarH: number,
  pillarMat: MaterialType,
  plankMat: MaterialType,
  plankW?: number,
): number {
  const pw = plankW ?? span + 40;
  ctx.block(cx - span / 2, baseY - pillarH / 2, 14, pillarH, pillarMat);
  ctx.block(cx, baseY - pillarH / 2, 14, pillarH, pillarMat);
  ctx.block(cx + span / 2, baseY - pillarH / 2, 14, pillarH, pillarMat);
  const floorY = baseY - pillarH - 6;
  ctx.block(cx, floorY, pw, 12, plankMat);
  return floorY;
}
