export type BallCosmetic = 'classic' | 'epic' | 'disco' | 'blackhole';
export type WristbandColor = 'orange' | 'blue' | 'lime' | 'pink' | 'white' | 'purple';
export type WristbandSide = 'left' | 'right';
export type ProgressionResetTarget = 'normalHighScore' | 'hardHighScore' | 'achievements';

export const wristbandColors: readonly WristbandColor[] = [
  'orange',
  'blue',
  'lime',
  'pink',
  'white',
  'purple',
];

export const wristbandColorHex: Readonly<Record<WristbandColor, string>> = {
  orange: '#ff6a2a',
  blue: '#168cff',
  lime: '#83f23d',
  pink: '#ff4fa3',
  white: '#f4f8ff',
  purple: '#814dff',
};
export type AchievementId =
  | 'score10000'
  | 'firstPurchase'
  | 'playTutorial'
  | 'starWithoutSwitching'
  | 'firstPoint';

export const achievementIds: readonly AchievementId[] = [
  'score10000',
  'firstPurchase',
  'playTutorial',
  'starWithoutSwitching',
  'firstPoint',
];

export interface DribbleProgressionState {
  normalHighScore: number;
  hardHighScore: number;
  stars: number;
  leftWristbandColor: WristbandColor;
  rightWristbandColor: WristbandColor;
  epicBallOwned: boolean;
  discoBallOwned: boolean;
  blackHoleBallOwned: boolean;
  equippedBall: BallCosmetic;
  achievements: Record<AchievementId, boolean>;
  achievementMigrationVersion: number;
}

export const epicBallPrice = 1;
export const discoBallPrice = 3;
export const blackHoleBallPrice = 5;

const storageKey = 'basketball-frenzy-progression-v1';

export function createDefaultProgressionState(): DribbleProgressionState {
  return {
    normalHighScore: 0,
    hardHighScore: 0,
    stars: 0,
    leftWristbandColor: 'orange',
    rightWristbandColor: 'blue',
    epicBallOwned: false,
    discoBallOwned: false,
    blackHoleBallOwned: false,
    equippedBall: 'classic',
    achievements: createDefaultAchievements(),
    achievementMigrationVersion: 1,
  };
}

export function loadProgression(): DribbleProgressionState {
  const fallback = createDefaultProgressionState();
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<DribbleProgressionState> & { highScore?: unknown };
    const legacyHighScore = sanitizeCount(parsed.highScore);
    const epicBallOwned = parsed.epicBallOwned === true;
    const discoBallOwned = parsed.discoBallOwned === true;
    const blackHoleBallOwned = parsed.blackHoleBallOwned === true;
    const loaded: DribbleProgressionState = {
      normalHighScore: Math.max(sanitizeCount(parsed.normalHighScore), legacyHighScore),
      hardHighScore: sanitizeCount(parsed.hardHighScore),
      stars: sanitizeCount(parsed.stars),
      leftWristbandColor: isWristbandColor(parsed.leftWristbandColor) ? parsed.leftWristbandColor : 'orange',
      rightWristbandColor: isWristbandColor(parsed.rightWristbandColor) ? parsed.rightWristbandColor : 'blue',
      epicBallOwned,
      discoBallOwned,
      blackHoleBallOwned,
      equippedBall: isBallCosmetic(parsed.equippedBall) ? parsed.equippedBall : 'classic',
      achievements: loadAchievements(parsed.achievements),
      achievementMigrationVersion: 1,
    };
    if (!isBallOwned(loaded, loaded.equippedBall)) loaded.equippedBall = 'classic';
    if (sanitizeCount(parsed.achievementMigrationVersion) < 1) {
      const bestScore = Math.max(loaded.normalHighScore, loaded.hardHighScore);
      if (bestScore > 0) loaded.achievements.firstPoint = true;
      if (bestScore >= 10000) loaded.achievements.score10000 = true;
      if (loaded.epicBallOwned || loaded.discoBallOwned || loaded.blackHoleBallOwned) {
        loaded.achievements.firstPurchase = true;
      }
      return persist(loaded);
    }
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
  mode: 'normal' | 'hard',
): DribbleProgressionState {
  const key = mode === 'hard' ? 'hardHighScore' : 'normalHighScore';
  const highScore = Math.max(state[key], sanitizeCount(score));
  return highScore === state[key] ? state : persist({ ...state, [key]: highScore });
}

export function getHighScore(
  state: DribbleProgressionState,
  mode: 'normal' | 'hard',
): number {
  return mode === 'hard' ? state.hardHighScore : state.normalHighScore;
}

export function resetProgression(
  state: DribbleProgressionState,
  target: ProgressionResetTarget,
): DribbleProgressionState {
  if (target === 'normalHighScore') {
    return persist({ ...state, normalHighScore: 0 });
  }
  if (target === 'hardHighScore') {
    return persist({ ...state, hardHighScore: 0 });
  }
  return persist({
    ...state,
    achievements: createDefaultAchievements(),
    achievementMigrationVersion: 1,
  });
}

export function setWristbandColor(
  state: DribbleProgressionState,
  side: WristbandSide,
  color: WristbandColor,
): DribbleProgressionState {
  const key = side === 'left' ? 'leftWristbandColor' : 'rightWristbandColor';
  return state[key] === color ? state : persist({ ...state, [key]: color });
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
    achievements: {
      ...state.achievements,
      firstPurchase: true,
    },
  });
}

export function unlockAchievement(
  state: DribbleProgressionState,
  achievement: AchievementId,
): DribbleProgressionState {
  if (state.achievements[achievement]) return state;
  return persist({
    ...state,
    achievements: {
      ...state.achievements,
      [achievement]: true,
    },
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

function isWristbandColor(value: unknown): value is WristbandColor {
  return wristbandColors.some(color => color === value);
}

function createDefaultAchievements(): Record<AchievementId, boolean> {
  return {
    score10000: false,
    firstPurchase: false,
    playTutorial: false,
    starWithoutSwitching: false,
    firstPoint: false,
  };
}

function loadAchievements(value: unknown): Record<AchievementId, boolean> {
  const stored = typeof value === 'object' && value !== null
    ? value as Partial<Record<AchievementId, unknown>>
    : {};
  return {
    score10000: stored.score10000 === true,
    firstPurchase: stored.firstPurchase === true,
    playTutorial: stored.playTutorial === true,
    starWithoutSwitching: stored.starWithoutSwitching === true,
    firstPoint: stored.firstPoint === true,
  };
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
