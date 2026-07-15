export type BallCosmetic = 'classic' | 'epic';

export interface DribbleProgressionState {
  highScore: number;
  stars: number;
  epicBallOwned: boolean;
  equippedBall: BallCosmetic;
}

export const epicBallPrice = 1;

const storageKey = 'basketball-frenzy-progression-v1';

export function createDefaultProgressionState(): DribbleProgressionState {
  return {
    highScore: 0,
    stars: 0,
    epicBallOwned: false,
    equippedBall: 'classic',
  };
}

export function loadProgression(): DribbleProgressionState {
  const fallback = createDefaultProgressionState();
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<DribbleProgressionState>;
    const epicBallOwned = parsed.epicBallOwned === true;
    return {
      highScore: sanitizeCount(parsed.highScore),
      stars: sanitizeCount(parsed.stars),
      epicBallOwned,
      equippedBall: parsed.equippedBall === 'epic' && epicBallOwned ? 'epic' : 'classic',
    };
  } catch {
    return fallback;
  }
}

export function awardStars(state: DribbleProgressionState, amount: number): DribbleProgressionState {
  return persist({
    ...state,
    stars: state.stars + sanitizeCount(amount),
  });
}

export function recordHighScore(
  state: DribbleProgressionState,
  score: number,
): DribbleProgressionState {
  const highScore = Math.max(state.highScore, sanitizeCount(score));
  return highScore === state.highScore ? state : persist({ ...state, highScore });
}

export function purchaseEpicBall(state: DribbleProgressionState): DribbleProgressionState {
  if (state.epicBallOwned || state.stars < epicBallPrice) {
    return state;
  }
  return persist({
    ...state,
    stars: state.stars - epicBallPrice,
    epicBallOwned: true,
    equippedBall: 'epic',
  });
}

export function equipBall(
  state: DribbleProgressionState,
  cosmetic: BallCosmetic,
): DribbleProgressionState {
  if (cosmetic === 'epic' && !state.epicBallOwned) {
    return state;
  }
  if (state.equippedBall === cosmetic) {
    return state;
  }
  return persist({ ...state, equippedBall: cosmetic });
}

function persist(state: DribbleProgressionState): DribbleProgressionState {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Gameplay remains available when browser storage is blocked.
  }
  return state;
}

function sanitizeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}
