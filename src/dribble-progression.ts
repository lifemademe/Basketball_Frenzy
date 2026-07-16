export type BallCosmetic = 'classic' | 'epic' | 'disco' | 'blackhole';
export type WristbandColor = 'orange' | 'blue' | 'lime' | 'pink' | 'white' | 'purple';
export type WristbandSide = 'left' | 'right';
export type ProgressionResetTarget =
  | 'normalHighScore'
  | 'hardHighScore'
  | 'achievements'
  | 'freshStart';

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
  | 'highScore';

export const achievementIds: readonly AchievementId[] = [
  'score10000',
  'firstPurchase',
  'playTutorial',
  'starWithoutSwitching',
  'highScore',
];

export interface DribbleProgressionState {
  normalHighScore: number;
  hardHighScore: number;
  normalRunsCompleted: number;
  hardRunsCompleted: number;
  stars: number;
  leftWristbandColor: WristbandColor;
  rightWristbandColor: WristbandColor;
  epicBallOwned: boolean;
  discoBallOwned: boolean;
  blackHoleBallOwned: boolean;
  equippedBall: BallCosmetic;
  classicTutorialCompleted: boolean;
  lastBounceTutorialCompleted: boolean;
  achievements: Record<AchievementId, boolean>;
  achievementMigrationVersion: number;
}

export const epicBallPrice = 5;
export const discoBallPrice = 15;
export const blackHoleBallPrice = 30;

const storageKey = 'basketball-frenzy-progression-v1';

export function createDefaultProgressionState(): DribbleProgressionState {
  return {
    normalHighScore: 0,
    hardHighScore: 0,
    normalRunsCompleted: 0,
    hardRunsCompleted: 0,
    stars: 0,
    leftWristbandColor: 'orange',
    rightWristbandColor: 'blue',
    epicBallOwned: false,
    discoBallOwned: false,
    blackHoleBallOwned: false,
    equippedBall: 'classic',
    classicTutorialCompleted: false,
    lastBounceTutorialCompleted: false,
    achievements: createDefaultAchievements(),
    achievementMigrationVersion: 4,
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
      normalRunsCompleted: sanitizeCount(parsed.normalRunsCompleted),
      hardRunsCompleted: sanitizeCount(parsed.hardRunsCompleted),
      stars: sanitizeCount(parsed.stars),
      leftWristbandColor: isWristbandColor(parsed.leftWristbandColor) ? parsed.leftWristbandColor : 'orange',
      rightWristbandColor: isWristbandColor(parsed.rightWristbandColor) ? parsed.rightWristbandColor : 'blue',
      epicBallOwned,
      discoBallOwned,
      blackHoleBallOwned,
      equippedBall: isBallCosmetic(parsed.equippedBall) ? parsed.equippedBall : 'classic',
      classicTutorialCompleted: parsed.classicTutorialCompleted === true,
      lastBounceTutorialCompleted: parsed.lastBounceTutorialCompleted === true,
      achievements: loadAchievements(parsed.achievements),
      achievementMigrationVersion: 4,
    };
    if (loaded.normalRunsCompleted === 0 && loaded.normalHighScore > 0) loaded.normalRunsCompleted = 1;
    if (loaded.hardRunsCompleted === 0 && loaded.hardHighScore > 0) loaded.hardRunsCompleted = 1;
    if (!isBallOwned(loaded, loaded.equippedBall)) loaded.equippedBall = 'classic';
    if (sanitizeCount(parsed.achievementMigrationVersion) < 1) {
      const bestScore = Math.max(loaded.normalHighScore, loaded.hardHighScore);
      if (bestScore >= 10000) loaded.achievements.score10000 = true;
      if (loaded.epicBallOwned || loaded.discoBallOwned || loaded.blackHoleBallOwned) {
        loaded.achievements.firstPurchase = true;
      }
    }
    if (sanitizeCount(parsed.achievementMigrationVersion) < 2) {
      loaded.achievements.highScore = false;
    }
    if (sanitizeCount(parsed.achievementMigrationVersion) < 3) {
      loaded.achievements.highScore = loaded.normalRunsCompleted > 0
        || loaded.hardRunsCompleted > 0;
    }
    if (sanitizeCount(parsed.achievementMigrationVersion) < 4) {
      loaded.classicTutorialCompleted = loaded.achievements.playTutorial;
      loaded.lastBounceTutorialCompleted = false;
      loaded.achievements.playTutorial = false;
    }
    loaded.achievements.playTutorial = loaded.classicTutorialCompleted
      && loaded.lastBounceTutorialCompleted;
    return persist(loaded);
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

export function recordRunResult(
  state: DribbleProgressionState,
  score: number,
  mode: 'normal' | 'hard',
  completed: boolean,
): DribbleProgressionState {
  if (!completed) return state;
  const key = mode === 'hard' ? 'hardHighScore' : 'normalHighScore';
  const runsKey = mode === 'hard' ? 'hardRunsCompleted' : 'normalRunsCompleted';
  const highScore = Math.max(state[key], sanitizeCount(score));
  return persist({
    ...state,
    [key]: highScore,
    [runsKey]: state[runsKey] + 1,
  });
}

export function getHighScore(
  state: DribbleProgressionState,
  mode: 'normal' | 'hard',
): number {
  return mode === 'hard' ? state.hardHighScore : state.normalHighScore;
}

export function getCompletedRunCount(
  state: DribbleProgressionState,
  mode: 'normal' | 'hard',
): number {
  return mode === 'hard' ? state.hardRunsCompleted : state.normalRunsCompleted;
}

export function resetProgression(
  state: DribbleProgressionState,
  target: ProgressionResetTarget,
): DribbleProgressionState {
  if (target === 'freshStart') {
    return persist(createDefaultProgressionState());
  }
  if (target === 'normalHighScore') {
    return persist({ ...state, normalHighScore: 0, normalRunsCompleted: 0 });
  }
  if (target === 'hardHighScore') {
    return persist({ ...state, hardHighScore: 0, hardRunsCompleted: 0 });
  }
  return persist({
    ...state,
    achievements: createDefaultAchievements(),
    classicTutorialCompleted: false,
    lastBounceTutorialCompleted: false,
    achievementMigrationVersion: 4,
  });
}

export function recordTutorialCompletion(
  state: DribbleProgressionState,
  mode: 'classic' | 'last-bounce',
): DribbleProgressionState {
  const classicTutorialCompleted = state.classicTutorialCompleted || mode === 'classic';
  const lastBounceTutorialCompleted = state.lastBounceTutorialCompleted || mode === 'last-bounce';
  if (
    classicTutorialCompleted === state.classicTutorialCompleted
    && lastBounceTutorialCompleted === state.lastBounceTutorialCompleted
  ) {
    return state;
  }
  return persist({
    ...state,
    classicTutorialCompleted,
    lastBounceTutorialCompleted,
    achievements: {
      ...state.achievements,
      playTutorial: classicTutorialCompleted && lastBounceTutorialCompleted,
    },
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
    highScore: false,
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
    highScore: stored.highScore === true,
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
