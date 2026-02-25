const SAVE_KEY = 'slingsquad_tutorial_v1';

interface TutorialState {
  dragToAim: boolean;
  releaseToFire: boolean;
  trajectoryDots: boolean;
  combatExplained: boolean;
  completed: boolean;
}

let _state: TutorialState | null = null;

function _ensure(): TutorialState {
  if (!_state) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      _state = raw ? JSON.parse(raw) : defaultState();
    } catch {
      _state = defaultState();
    }
  }
  return _state!;
}

function defaultState(): TutorialState {
  return {
    dragToAim: false,
    releaseToFire: false,
    trajectoryDots: false,
    combatExplained: false,
    completed: false,
  };
}

function _save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(_ensure()));
  } catch { /* storage unavailable */ }
}

export function isTutorialComplete(): boolean {
  return _ensure().completed;
}

export function isStepComplete(step: keyof TutorialState): boolean {
  return _ensure()[step];
}

export function completeStep(step: keyof TutorialState): void {
  const s = _ensure();
  (s as any)[step] = true;

  // Check if all steps are done
  if (s.dragToAim && s.releaseToFire && s.trajectoryDots && s.combatExplained) {
    s.completed = true;
  }
  _save();
}

export function getNextStep(): keyof TutorialState | null {
  const s = _ensure();
  if (!s.dragToAim) return 'dragToAim';
  if (!s.releaseToFire) return 'releaseToFire';
  if (!s.trajectoryDots) return 'trajectoryDots';
  if (!s.combatExplained) return 'combatExplained';
  return null;
}

export function getTutorialText(step: keyof TutorialState): string {
  switch (step) {
    case 'dragToAim': return 'Drag from the sling to aim your hero!';
    case 'releaseToFire': return 'Release to fire!';
    case 'trajectoryDots': return 'Follow the dots to predict your trajectory.';
    case 'combatExplained': return 'Heroes fight enemies after landing!';
    default: return '';
  }
}

export function resetTutorial(): void {
  _state = defaultState();
  _save();
}
