import { generateName } from '@/systems/NameGenerator';
import { isUnlocked } from '@/systems/AchievementSystem';

const SAVE_KEY = 'slingsquad_profile_v1';

export interface PlayerProfileData {
  uid: string;           // Firebase anonymous UID ('' if offline)
  name: string;
  avatarKey: string;     // character sprite key (default: 'warrior')
  bestScore: number;
  bestAscension: number;
  bestModifiers: string[];
  bestFloor: number;
  createdAt: number;
}

/** Avatar sprite keys mapped to the achievement that unlocks them. */
const AVATAR_ACHIEVEMENT_MAP: Record<string, string> = {
  ranger:       'first_blood',
  grunt:        'goblin_slayer',
  yeti:         'frost_conqueror',
  demon_knight: 'infernal_victor',
  boss_grunt:   'conqueror',
  mage:         'ten_runs',
  bomber:       'wrecking_ball',
  ranged:       'boss_rush',
  priest:       'collector',
  rogue:        'gold_hoarder',
  paladin:      'full_squad',
  druid:        'event_explorer',
};

let _profile: PlayerProfileData | null = null;

function _load(): PlayerProfileData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlayerProfileData;
  } catch {
    return null;
  }
}

function _save() {
  if (!_profile) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(_profile));
  } catch { /* storage unavailable */ }
}

/** Ensure profile exists, creating one if first time. */
export function ensureProfile(): PlayerProfileData {
  if (!_profile) {
    _profile = _load();
    if (!_profile) {
      _profile = {
        uid: '',
        name: generateName(),
        avatarKey: 'warrior',
        bestScore: 0,
        bestAscension: 0,
        bestModifiers: [],
        bestFloor: 0,
        createdAt: Date.now(),
      };
      _save();
    }
  }
  return _profile;
}

export function getProfile(): PlayerProfileData {
  return ensureProfile();
}

export function setName(name: string) {
  ensureProfile().name = name.slice(0, 16);
  _save();
}

export function setAvatar(avatarKey: string) {
  ensureProfile().avatarKey = avatarKey;
  _save();
}

export function setFirebaseUid(uid: string) {
  ensureProfile().uid = uid;
  _save();
}

export function updateBestScore(score: number, ascension: number, modifiers: string[], floor: number) {
  const p = ensureProfile();
  if (score > p.bestScore) {
    p.bestScore = score;
    p.bestAscension = ascension;
    p.bestModifiers = modifiers;
    p.bestFloor = floor;
    _save();
  }
}

/** Returns list of avatar keys the player has unlocked. */
export function getUnlockedAvatars(): string[] {
  const unlocked = ['warrior']; // always available
  for (const [avatarKey, achievementId] of Object.entries(AVATAR_ACHIEVEMENT_MAP)) {
    if (isUnlocked(achievementId)) {
      unlocked.push(avatarKey);
    }
  }
  return unlocked;
}

/** Check if a specific avatar is unlocked. */
export function isAvatarUnlocked(avatarKey: string): boolean {
  if (avatarKey === 'warrior') return true;
  const achievementId = AVATAR_ACHIEVEMENT_MAP[avatarKey];
  if (!achievementId) return false;
  return isUnlocked(achievementId);
}

/** Returns the achievement ID required for an avatar, or null if always unlocked. */
export function getAvatarRequirement(avatarKey: string): string | null {
  return AVATAR_ACHIEVEMENT_MAP[avatarKey] ?? null;
}

/** All possible avatar keys (for display in selection grid). */
export function getAllAvatarKeys(): string[] {
  return ['warrior', ...Object.keys(AVATAR_ACHIEVEMENT_MAP)];
}
