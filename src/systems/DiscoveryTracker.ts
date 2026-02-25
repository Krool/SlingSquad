const SAVE_KEY = 'slingsquad_discovery_v1';

interface DiscoveryData {
  relics: Record<string, number>;   // relicId → times collected
  enemies: Record<string, number>;  // enemyClass → kill count
  heroes: string[];                 // hero classes used
}

let _data: DiscoveryData | null = null;

function _ensure(): DiscoveryData {
  if (!_data) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      _data = raw ? JSON.parse(raw) : { relics: {}, enemies: {}, heroes: [] };
    } catch {
      _data = { relics: {}, enemies: {}, heroes: [] };
    }
  }
  return _data!;
}

function _save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(_ensure()));
  } catch { /* storage unavailable */ }
}

// ── Relics ─────────────────────────────────────────────────────────────────────

export function discoverRelic(relicId: string): void {
  const d = _ensure();
  d.relics[relicId] = (d.relics[relicId] ?? 0) + 1;
  _save();
}

export function getRelicDiscoveryCount(relicId: string): number {
  return _ensure().relics[relicId] ?? 0;
}

export function isRelicDiscovered(relicId: string): boolean {
  return (_ensure().relics[relicId] ?? 0) > 0;
}

export function getDiscoveredRelicIds(): string[] {
  return Object.keys(_ensure().relics).filter(id => _ensure().relics[id] > 0);
}

// ── Enemies ────────────────────────────────────────────────────────────────────

export function recordEnemyKill(enemyClass: string): void {
  const d = _ensure();
  d.enemies[enemyClass] = (d.enemies[enemyClass] ?? 0) + 1;
  _save();
}

export function getEnemyKillCount(enemyClass: string): number {
  return _ensure().enemies[enemyClass] ?? 0;
}

export function isEnemyDiscovered(enemyClass: string): boolean {
  return (_ensure().enemies[enemyClass] ?? 0) > 0;
}

export function getDiscoveredEnemyClasses(): string[] {
  return Object.keys(_ensure().enemies).filter(cls => _ensure().enemies[cls] > 0);
}

// ── Heroes ─────────────────────────────────────────────────────────────────────

export function recordHeroUsed(heroClass: string): void {
  const d = _ensure();
  if (!d.heroes.includes(heroClass)) {
    d.heroes.push(heroClass);
    _save();
  }
}

export function isHeroDiscovered(heroClass: string): boolean {
  return _ensure().heroes.includes(heroClass);
}

export function getDiscoveredHeroClasses(): string[] {
  return [..._ensure().heroes];
}
