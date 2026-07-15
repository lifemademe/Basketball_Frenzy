export type BallCosmetic = 'classic' | 'epic' | 'disco' | 'blackhole';

export interface DribbleProgressionState {
  highScore: number;
  stars: number;
  epicBallOwned: boolean;
  discoBallOwned: boolean;
  blackHoleBallOwned: boolean;
  equippedBall: BallCosmetic;
}

export const epicBallPrice = 1;
export const discoBallPrice = 3;
export const blackHoleBallPrice = 5;

const storageKey = 'basketball-frenzy-progression-v1';

export function createDefaultProgressionState(): DribbleProgressionState {
  return {
    highScore: 0,
    stars: 0,
    epicBallOwned: false,
    discoBallOwned: false,
    blackHoleBallOwned: false,
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
    const discoBallOwned = parsed.discoBallOwned === true;
    const blackHoleBallOwned = parsed.blackHoleBallOwned === true;
    const loaded: DribbleProgressionState = {
      highScore: sanitizeCount(parsed.highScore),
      stars: sanitizeCount(parsed.stars),
      epicBallOwned,
      discoBallOwned,
      blackHoleBallOwned,
      equippedBall: isBallCosmetic(parsed.equippedBall) ? parsed.equippedBall : 'classic',
    };
    if (!isBallOwned(loaded, loaded.equippedBall)) loaded.equippedBall = 'classic';
    return loaded;
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

export function purchaseBall(
  state: DribbleProgressionState,
  cosmetic: BallCosmetic,
): DribbleProgressionState {
  const price = getBallPrice(cosmetic);
  if (isBallOwned(state, cosmetic) || state.stars < price) {
    return state;
  }
  const ownership = cosmetic === 'epic'
    ? { epicBallOwned: true }
    : cosmetic === 'disco'
      ? { discoBallOwned: true }
      : { blackHoleBallOwned: true };
  return persist({
    ...state,
    ...ownership,
    stars: state.stars - price,
    equippedBall: cosmetic,
  });
}

export function equipBall(
  state: DribbleProgressionState,
  cosmetic: BallCosmetic,
): DribbleProgressionState {
  if (!isBallOwned(state, cosmetic)) {
    return state;
  }
  if (state.equippedBall === cosmetic) {
    return state;
  }
  return persist({ ...state, equippedBall: cosmetic });
}

export function getBallPrice(cosmetic: BallCosmetic): number {
  if (cosmetic === 'epic') return epicBallPrice;
  if (cosmetic === 'disco') return discoBallPrice;
  if (cosmetic === 'blackhole') return blackHoleBallPrice;
  return 0;
}

export function isBallOwned(
  state: DribbleProgressionState,
  cosmetic: BallCosmetic,
): boolean {
  if (cosmetic === 'classic') return true;
  if (cosmetic === 'epic') return state.epicBallOwned;
  if (cosmetic === 'disco') return state.discoBallOwned;
  return state.blackHoleBallOwned;
}

function isBallCosmetic(value: unknown): value is BallCosmetic {
  return value === 'classic' || value === 'epic' || value === 'disco' || value === 'blackhole';
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
