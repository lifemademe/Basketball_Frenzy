export type BallCosmetic = 'classic' | 'epic' | 'disco' | 'blackhole';
export type CourtCosmetic = 'blue' | 'light-wood';
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
  lastBounceMatches: number;
  lastBounceWins: number;
  playerXp: number;
  stars: number;
  leftWristbandColor: WristbandColor;
  rightWristbandColor: WristbandColor;
  epicBallOwned: boolean;
  discoBallOwned: boolean;
  blackHoleBallOwned: boolean;
  equippedBall: BallCosmetic;
  lightWoodCourtOwned: boolean;
  equippedCourt: CourtCosmetic;
  classicTutorialCompleted: boolean;
  lastBounceTutorialCompleted: boolean;
  achievements: Record<AchievementId, boolean>;
  achievementMigrationVersion: number;
  courtChallengeDate: string;
  courtChallengeId: CourtChallengeId;
  courtChallengeProgress: number;
  courtChallengeCompleted: boolean;
  weeklyChallengeWeek: string;
  weeklyChallengeId: CourtChallengeId;
  weeklyChallengeProgress: number;
  weeklyChallengeCompleted: boolean;
  bestClassicCombo: number;
  bestPerfectSwitches: number;
  bestHazardsAvoided: number;
  bestLastBounceRally: number;
}

export interface DribbleMasterySnapshot {
  bestCombo?: number;
  perfectSwitches?: number;
  hazardsAvoided?: number;
  longestRally?: number;
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

const weeklyChallenges: readonly CourtChallengeDefinition[] = [
  {
    id: 'scoreSprint',
    title: 'Weekly Scorer',
    description: 'Score 5,000 points in one run.',
    metric: 'score',
    goal: 5000,
    reward: 3,
  },
  {
    id: 'hazardRun',
    title: 'Defensive Wall',
    description: 'Avoid 30 hazards in one run.',
    metric: 'hazards',
    goal: 30,
    reward: 3,
  },
  {
    id: 'rallyMaster',
    title: 'Rally Legend',
    description: 'Reach a 20-pass Last Bounce rally.',
    metric: 'rally',
    goal: 20,
    reward: 3,
  },
];

export const epicBallPrice = 5;
export const discoBallPrice = 10;
export const blackHoleBallPrice = 20;
export const alternateCourtPrice = 5;

const storageKey = 'basketball-frenzy-progression-v1';

export function createDefaultProgressionState(): DribbleProgressionState {
  const challenge = getChallengeForDate(getLocalDateKey());
  const weeklyChallenge = getChallengeForWeek(getLocalWeekKey());
  return {
    normalHighScore: 0,
    hardHighScore: 0,
    normalRunsCompleted: 0,
    hardRunsCompleted: 0,
    lastBounceMatches: 0,
    lastBounceWins: 0,
    playerXp: 0,
    stars: 0,
    leftWristbandColor: 'orange',
    rightWristbandColor: 'blue',
    epicBallOwned: false,
    discoBallOwned: false,
    blackHoleBallOwned: false,
    equippedBall: 'classic',
    lightWoodCourtOwned: false,
    equippedCourt: 'blue',
    classicTutorialCompleted: false,
    lastBounceTutorialCompleted: false,
    achievements: createDefaultAchievements(),
    achievementMigrationVersion: 4,
    courtChallengeDate: getLocalDateKey(),
    courtChallengeId: challenge.id,
    courtChallengeProgress: 0,
    courtChallengeCompleted: false,
    weeklyChallengeWeek: getLocalWeekKey(),
    weeklyChallengeId: weeklyChallenge.id,
    weeklyChallengeProgress: 0,
    weeklyChallengeCompleted: false,
    bestClassicCombo: 0,
    bestPerfectSwitches: 0,
    bestHazardsAvoided: 0,
    bestLastBounceRally: 0,
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
      greenCourtOwned?: unknown;
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
      lastBounceMatches: sanitizeCount(parsed.lastBounceMatches),
      lastBounceWins: sanitizeCount(parsed.lastBounceWins),
      playerXp: sanitizeCount(parsed.playerXp),
      stars: sanitizeCount(parsed.stars),
      leftWristbandColor: isWristbandColor(parsed.leftWristbandColor) ? parsed.leftWristbandColor : 'orange',
      rightWristbandColor: isWristbandColor(parsed.rightWristbandColor) ? parsed.rightWristbandColor : 'blue',
      epicBallOwned,
      discoBallOwned,
      blackHoleBallOwned,
      equippedBall: isBallCosmetic(parsed.equippedBall) ? parsed.equippedBall : 'classic',
      lightWoodCourtOwned: parsed.lightWoodCourtOwned === true,
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
      weeklyChallengeWeek: typeof parsed.weeklyChallengeWeek === 'string'
        ? parsed.weeklyChallengeWeek
        : '',
      weeklyChallengeId: isCourtChallengeId(parsed.weeklyChallengeId)
        ? parsed.weeklyChallengeId
        : 'scoreSprint',
      weeklyChallengeProgress: sanitizeCount(parsed.weeklyChallengeProgress),
      weeklyChallengeCompleted: parsed.weeklyChallengeCompleted === true,
      bestClassicCombo: sanitizeCount(parsed.bestClassicCombo),
      bestPerfectSwitches: sanitizeCount(parsed.bestPerfectSwitches),
      bestHazardsAvoided: sanitizeCount(parsed.bestHazardsAvoided),
      bestLastBounceRally: sanitizeCount(parsed.bestLastBounceRally),
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
        || parsed.greenCourtOwned === true
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

export function getWeeklyChallenge(
  state: DribbleProgressionState,
): CourtChallengeDefinition {
  return weeklyChallenges.find(challenge => challenge.id === state.weeklyChallengeId)
    ?? weeklyChallenges[0];
}

export function recordCourtChallengeProgress(
  state: DribbleProgressionState,
  metric: CourtChallengeMetric,
  value: number,
): DribbleProgressionState {
  const refreshed = refreshCourtChallenge(state);
  let next = refreshed;
  let reward = 0;
  const daily = getCourtChallenge(next);
  if (!next.courtChallengeCompleted && daily.metric === metric) {
    const progress = Math.min(daily.goal, Math.max(next.courtChallengeProgress, sanitizeCount(value)));
    const completed = progress >= daily.goal;
    reward += completed && !next.courtChallengeCompleted ? daily.reward : 0;
    next = {
      ...next,
      courtChallengeProgress: progress,
      courtChallengeCompleted: completed,
    };
  }
  const weekly = getWeeklyChallenge(next);
  if (!next.weeklyChallengeCompleted && weekly.metric === metric) {
    const progress = Math.min(weekly.goal, Math.max(next.weeklyChallengeProgress, sanitizeCount(value)));
    const completed = progress >= weekly.goal;
    reward += completed && !next.weeklyChallengeCompleted ? weekly.reward : 0;
    next = {
      ...next,
      weeklyChallengeProgress: progress,
      weeklyChallengeCompleted: completed,
    };
  }
  if (next === state) return state;
  return persist({ ...next, stars: next.stars + reward });
}

export function awardStars(state: DribbleProgressionState, amount: number): DribbleProgressionState {
  return persist({
    ...state,
    stars: state.stars + sanitizeCount(amount),
  });
}

export function awardCareerXp(
  state: DribbleProgressionState,
  amount: number,
): DribbleProgressionState {
  const xp = sanitizeCount(amount);
  return xp === 0 ? state : persist({ ...state, playerXp: state.playerXp + xp });
}

export function recordLastBounceResult(
  state: DribbleProgressionState,
  playerWon: boolean,
): DribbleProgressionState {
  return persist({
    ...state,
    lastBounceMatches: state.lastBounceMatches + 1,
    lastBounceWins: state.lastBounceWins + (playerWon ? 1 : 0),
  });
}

export function recordMastery(
  state: DribbleProgressionState,
  snapshot: DribbleMasterySnapshot,
): DribbleProgressionState {
  const next = {
    ...state,
    bestClassicCombo: Math.max(state.bestClassicCombo, sanitizeCount(snapshot.bestCombo)),
    bestPerfectSwitches: Math.max(state.bestPerfectSwitches, sanitizeCount(snapshot.perfectSwitches)),
    bestHazardsAvoided: Math.max(state.bestHazardsAvoided, sanitizeCount(snapshot.hazardsAvoided)),
    bestLastBounceRally: Math.max(state.bestLastBounceRally, sanitizeCount(snapshot.longestRally)),
  };
  return next.bestClassicCombo === state.bestClassicCombo
    && next.bestPerfectSwitches === state.bestPerfectSwitches
    && next.bestHazardsAvoided === state.bestHazardsAvoided
    && next.bestLastBounceRally === state.bestLastBounceRally
    ? state
    : persist(next);
}

export function getCourtTitle(level: number): string {
  if (level >= 20) return 'Court Legend';
  if (level >= 15) return 'Court MVP';
  if (level >= 12) return 'Floor General';
  if (level >= 10) return 'All-Court Ace';
  if (level >= 9) return 'Clutch Guard';
  if (level >= 8) return 'Shot Caller';
  if (level >= 7) return 'Floor Leader';
  if (level >= 6) return 'Court Captain';
  if (level >= 5) return 'Playmaker';
  if (level >= 4) return 'Sixth Player';
  if (level >= 3) return 'Rising Star';
  if (level >= 2) return 'Prospect';
  return 'Rookie';
}

export function getWristbandUnlockLevel(color: WristbandColor): number {
  if (color === 'lime') return 2;
  if (color === 'pink') return 3;
  if (color === 'white') return 4;
  if (color === 'purple') return 5;
  return 1;
}

export function isWristbandUnlocked(playerXp: number, color: WristbandColor): boolean {
  return getPlayerLevelProgress(playerXp).level >= getWristbandUnlockLevel(color);
}

export function getPlayerLevelProgress(playerXp: number): {
  level: number;
  current: number;
  required: number;
  progress: number;
  nextUnlock: string;
  nextUnlockLevel: number;
} {
  const xp = sanitizeCount(playerXp);
  let level = 1;
  let levelStart = 0;
  let levelEnd = getXpForLevel(2);
  while (xp >= levelEnd && level < 50) {
    level += 1;
    levelStart = levelEnd;
    levelEnd = getXpForLevel(level + 1);
  }
  const current = xp - levelStart;
  const required = Math.max(1, levelEnd - levelStart);
  const nextUnlockLevel = getNextUnlockLevel(level);
  return {
    level,
    current,
    required,
    progress: Math.min(1, current / required),
    nextUnlock: getLevelUnlockLabel(nextUnlockLevel),
    nextUnlockLevel,
  };
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
    return persist({ ...state, normalHighScore: 0 });
  }
  if (target === 'hardHighScore') {
    return persist({ ...state, hardHighScore: 0 });
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
  if (!isWristbandUnlocked(state.playerXp, color)) return state;
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
  return persist({
    ...state,
    lightWoodCourtOwned: true,
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
  return state.lightWoodCourtOwned;
}

function isBallCosmetic(value: unknown): value is BallCosmetic {
  return value === 'classic' || value === 'epic' || value === 'disco' || value === 'blackhole';
}

function isCourtCosmetic(value: unknown): value is CourtCosmetic {
  return value === 'blue' || value === 'light-wood';
}

function isWristbandColor(value: unknown): value is WristbandColor {
  return wristbandColors.some(color => color === value);
}

function isCourtChallengeId(value: unknown): value is CourtChallengeId {
  return courtChallenges.some(challenge => challenge.id === value);
}

function refreshCourtChallenge(state: DribbleProgressionState): DribbleProgressionState {
  const date = getLocalDateKey();
  const week = getLocalWeekKey();
  let refreshed = state;
  if (state.courtChallengeDate !== date) {
    const challenge = getChallengeForDate(date);
    refreshed = {
      ...refreshed,
      courtChallengeDate: date,
      courtChallengeId: challenge.id,
      courtChallengeProgress: 0,
      courtChallengeCompleted: false,
    };
  }
  if (state.weeklyChallengeWeek !== week) {
    const challenge = getChallengeForWeek(week);
    refreshed = {
      ...refreshed,
      weeklyChallengeWeek: week,
      weeklyChallengeId: challenge.id,
      weeklyChallengeProgress: 0,
      weeklyChallengeCompleted: false,
    };
  }
  return refreshed;
}

function getChallengeForDate(date: string): CourtChallengeDefinition {
  const dayNumber = Math.floor(new Date(`${date}T12:00:00`).getTime() / 86_400_000);
  return courtChallenges[Math.abs(dayNumber) % courtChallenges.length];
}

function getChallengeForWeek(week: string): CourtChallengeDefinition {
  const weekNumber = Math.floor(new Date(`${week}T12:00:00`).getTime() / (86_400_000 * 7));
  return weeklyChallenges[Math.abs(weekNumber) % weeklyChallenges.length];
}

function getXpForLevel(level: number): number {
  const completedLevels = Math.max(0, level - 1);
  return completedLevels * 300 + completedLevels * completedLevels * 90;
}

function getLevelUnlockLabel(level: number): string {
  if (level === 2) return 'Electric Lime Wristbands';
  if (level === 3) return 'Hot Pink Wristbands';
  if (level === 4) return 'Bright White Wristbands';
  if (level === 5) return 'Deep Purple Wristbands';
  if (level <= 10 || level === 12 || level === 15 || level === 20) {
    return `${getCourtTitle(level)} Title`;
  }
  return 'Legend Rank';
}

function getNextUnlockLevel(level: number): number {
  const rewardLevels = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20];
  return rewardLevels.find(rewardLevel => rewardLevel > level) ?? level + 5;
}

function getLocalDateKey(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalWeekKey(): string {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
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
