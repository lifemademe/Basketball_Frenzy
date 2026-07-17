export type BallCosmetic = 'classic' | 'epic' | 'disco' | 'blackhole';
export type CourtCosmetic = 'blue' | 'light-wood' | 'green';
export type WristbandColor = 'orange' | 'blue' | 'lime' | 'pink' | 'white' | 'purple';
export type WristbandSide = 'left' | 'right';
export type CourtChallengeId = 'scoreSprint' | 'hazardRun' | 'rallyMaster';
export type CourtChallengeMetric = 'score' | 'hazards' | 'rally';
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
  lightWoodCourtOwned: boolean;
  greenCourtOwned: boolean;
  equippedCourt: CourtCosmetic;
  classicTutorialCompleted: boolean;
  lastBounceTutorialCompleted: boolean;
  achievements: Record<AchievementId, boolean>;
  achievementMigrationVersion: number;
  courtChallengeDate: string;
  courtChallengeId: CourtChallengeId;
  courtChallengeProgress: number;
  courtChallengeCompleted: boolean;
}

export interface CourtChallengeDefinition {
  id: CourtChallengeId;
  title: string;
  description: string;
  metric: CourtChallengeMetric;
  goal: number;
  reward: number;
}

const courtChallenges: readonly CourtChallengeDefinition[] = [
  {
    id: 'scoreSprint',
    title: 'Score Sprint',
    description: 'Score 2,500 points in one run.',
    metric: 'score',
    goal: 2500,
    reward: 1,
  },
  {
    id: 'hazardRun',
    title: 'Clean Court',
    description: 'Avoid 15 hazards in one run.',
    metric: 'hazards',
    goal: 15,
    reward: 1,
  },
  {
    id: 'rallyMaster',
    title: 'Long Rally',
    description: 'Reach a 12-pass rally in Last Bounce.',
    metric: 'rally',
    goal: 12,
    reward: 1,
  },
];

export const epicBallPrice = 5;
export const discoBallPrice = 10;
export const blackHoleBallPrice = 20;
export const alternateCourtPrice = 5;

const storageKey = 'basketball-frenzy-progression-v1';

export function createDefaultProgressionState(): DribbleProgressionState {
  const challenge = getChallengeForDate(getLocalDateKey());
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
    lightWoodCourtOwned: false,
    greenCourtOwned: false,
    equippedCourt: 'blue',
    classicTutorialCompleted: false,
    lastBounceTutorialCompleted: false,
    achievements: createDefaultAchievements(),
    achievementMigrationVersion: 4,
    courtChallengeDate: getLocalDateKey(),
    courtChallengeId: challenge.id,
    courtChallengeProgress: 0,
    courtChallengeCompleted: false,
  };
}

export function loadProgression(): DribbleProgressionState {
  const fallback = createDefaultProgressionState();
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<DribbleProgressionState> & {
      highScore?: unknown;
      redCourtOwned?: unknown;
    };
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
      lightWoodCourtOwned: parsed.lightWoodCourtOwned === true,
      greenCourtOwned: parsed.greenCourtOwned === true,
      equippedCourt: isCourtCosmetic(parsed.equippedCourt) ? parsed.equippedCourt : 'blue',
      classicTutorialCompleted: parsed.classicTutorialCompleted === true,
      lastBounceTutorialCompleted: parsed.lastBounceTutorialCompleted === true,
      achievements: loadAchievements(parsed.achievements),
      achievementMigrationVersion: 4,
      courtChallengeDate: typeof parsed.courtChallengeDate === 'string'
        ? parsed.courtChallengeDate
        : '',
      courtChallengeId: isCourtChallengeId(parsed.courtChallengeId)
        ? parsed.courtChallengeId
        : 'scoreSprint',
      courtChallengeProgress: sanitizeCount(parsed.courtChallengeProgress),
      courtChallengeCompleted: parsed.courtChallengeCompleted === true,
    };
    if (loaded.normalRunsCompleted === 0 && loaded.normalHighScore > 0) loaded.normalRunsCompleted = 1;
    if (loaded.hardRunsCompleted === 0 && loaded.hardHighScore > 0) loaded.hardRunsCompleted = 1;
    if (!isBallOwned(loaded, loaded.equippedBall)) loaded.equippedBall = 'classic';
    if (!isCourtOwned(loaded, loaded.equippedCourt)) loaded.equippedCourt = 'blue';
    if (sanitizeCount(parsed.achievementMigrationVersion) < 1) {
      const bestScore = Math.max(loaded.normalHighScore, loaded.hardHighScore);
      if (bestScore >= 10000) loaded.achievements.score10000 = true;
      if (
        loaded.epicBallOwned
        || loaded.discoBallOwned
        || loaded.blackHoleBallOwned
        || loaded.lightWoodCourtOwned
        || parsed.redCourtOwned === true
        || loaded.greenCourtOwned
      ) {
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
    return persist(refreshCourtChallenge(loaded));
  } catch {
    return fallback;
  }
}

export function getCourtChallenge(
  state: DribbleProgressionState,
): CourtChallengeDefinition {
  return courtChallenges.find(challenge => challenge.id === state.courtChallengeId)
    ?? courtChallenges[0];
}

export function recordCourtChallengeProgress(
  state: DribbleProgressionState,
  metric: CourtChallengeMetric,
  value: number,
): DribbleProgressionState {
  const refreshed = refreshCourtChallenge(state);
  const challenge = getCourtChallenge(refreshed);
  if (refreshed.courtChallengeCompleted || challenge.metric !== metric) {
    return refreshed === state ? state : persist(refreshed);
  }
  const progress = Math.min(challenge.goal, Math.max(refreshed.courtChallengeProgress, sanitizeCount(value)));
  if (progress === refreshed.courtChallengeProgress) return refreshed;
  const completed = progress >= challenge.goal;
  return persist({
    ...refreshed,
    stars: refreshed.stars + (completed ? challenge.reward : 0),
    courtChallengeProgress: progress,
    courtChallengeCompleted: completed,
  });
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

export function purchaseCourt(
  state: DribbleProgressionState,
  cosmetic: CourtCosmetic,
): DribbleProgressionState {
  const price = getCourtPrice(cosmetic);
  if (isCourtOwned(state, cosmetic) || state.stars < price) return state;
  const ownership = cosmetic === 'light-wood'
    ? { lightWoodCourtOwned: true }
    : { greenCourtOwned: true };
  return persist({
    ...state,
    ...ownership,
    stars: state.stars - price,
    equippedCourt: cosmetic,
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

export function equipCourt(
  state: DribbleProgressionState,
  cosmetic: CourtCosmetic,
): DribbleProgressionState {
  if (!isCourtOwned(state, cosmetic) || state.equippedCourt === cosmetic) return state;
  return persist({ ...state, equippedCourt: cosmetic });
}

export function getBallPrice(cosmetic: BallCosmetic): number {
  if (cosmetic === 'epic') return epicBallPrice;
  if (cosmetic === 'disco') return discoBallPrice;
  if (cosmetic === 'blackhole') return blackHoleBallPrice;
  return 0;
}

export function getCourtPrice(cosmetic: CourtCosmetic): number {
  return cosmetic === 'blue' ? 0 : alternateCourtPrice;
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

export function isCourtOwned(
  state: DribbleProgressionState,
  cosmetic: CourtCosmetic,
): boolean {
  if (cosmetic === 'blue') return true;
  if (cosmetic === 'light-wood') return state.lightWoodCourtOwned;
  return state.greenCourtOwned;
}

function isBallCosmetic(value: unknown): value is BallCosmetic {
  return value === 'classic' || value === 'epic' || value === 'disco' || value === 'blackhole';
}

function isCourtCosmetic(value: unknown): value is CourtCosmetic {
  return value === 'blue' || value === 'light-wood' || value === 'green';
}

function isWristbandColor(value: unknown): value is WristbandColor {
  return wristbandColors.some(color => color === value);
}

function isCourtChallengeId(value: unknown): value is CourtChallengeId {
  return courtChallenges.some(challenge => challenge.id === value);
}

function refreshCourtChallenge(state: DribbleProgressionState): DribbleProgressionState {
  const date = getLocalDateKey();
  if (state.courtChallengeDate === date) return state;
  const challenge = getChallengeForDate(date);
  return {
    ...state,
    courtChallengeDate: date,
    courtChallengeId: challenge.id,
    courtChallengeProgress: 0,
    courtChallengeCompleted: false,
  };
}

function getChallengeForDate(date: string): CourtChallengeDefinition {
  const dayNumber = Math.floor(new Date(`${date}T12:00:00`).getTime() / 86_400_000);
  return courtChallenges[Math.abs(dayNumber) % courtChallenges.length];
}

function getLocalDateKey(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
