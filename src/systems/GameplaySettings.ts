const GAMEPLAY_KEY = 'slingsquad_gameplay_v1';

interface GameplaySettings {
  screenShake: boolean;
}

const DEFAULTS: GameplaySettings = {
  screenShake: true,
};

export function loadGameplaySettings(): GameplaySettings {
  try {
    const raw = localStorage.getItem(GAMEPLAY_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveGameplaySettings(s: GameplaySettings): void {
  localStorage.setItem(GAMEPLAY_KEY, JSON.stringify(s));
}

export function isScreenShakeEnabled(): boolean {
  return loadGameplaySettings().screenShake;
}
