import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { DribbleBall, type DribbleBallState, type DribbleSide } from './dribble-ball.js';
import { playBasketballBounce } from './dribble-bounce-audio.js';
import { hideDribbleBootScreen } from './dribble-boot-screen.js';
import { DribbleComboPopup } from './dribble-combo-popup.js';
import {
  DribbleDifficultyDirector,
  type DribbleIntensityTier,
} from './dribble-difficulty-director.js';
import { DribbleImpactBurst } from './dribble-impact-burst.js';
import {
  DribbleMainMenu,
  highContrastTargetsKey,
  reducedFlashesKey,
  reducedMotionKey,
  type DribbleGameMode,
  type DribbleTutorialSelection,
} from './dribble-main-menu.js';
import { DribbleMusicDirector } from './dribble-music-director.js';
import {
  DribbleOverlay,
  type DribbleRunSummary,
  type DribbleVersusSummary,
} from './dribble-overlay.js';
import { DribblePatternDirector, type PatternLane } from './dribble-pattern-director.js';
import {
  awardStars,
  equipBall,
  getCompletedRunCount,
  getHighScore,
  isBallOwned,
  loadProgression,
  purchaseBall,
  recordCourtChallengeProgress,
  recordTutorialCompletion,
  recordRunResult,
  resetProgression as resetSavedProgression,
  setWristbandColor as saveWristbandColor,
  unlockAchievement,
  wristbandColorHex,
  type AchievementId,
  type BallCosmetic,
  type CourtChallengeMetric,
  type DribbleProgressionState,
  type ProgressionResetTarget,
  type WristbandColor,
  type WristbandSide,
} from './dribble-progression.js';
import {
  DribbleJuiceHud,
  DribbleLivesDisplay,
  DribblePauseButton,
  DribbleSideHints,
  DribbleTimingMeter,
} from './dribble-status-hud.js';
import { DribbleTarget, type TargetKind } from './dribble-target.js';
import {
  DribbleTutorialDirector,
  type DribbleTutorialMode,
  type TutorialEvent,
} from './dribble-tutorial-director.js';
import { DribbleTutorialHud } from './dribble-tutorial-hud.js';
import { DribbleVersusHud, type VersusOwner } from './dribble-versus-hud.js';

type DribbleGameState = 'menu' | 'playing' | 'paused' | 'gameOver';
export type DribbleInputAction = 'boost' | 'transfer' | null;

interface AchievementToastDefinition {
  title: string;
  description: string;
  iconPath: string;
  iconScale: number;
  rarity: 'rare' | 'epic' | 'legendary';
}

interface AchievementToastRequest {
  title: string;
  description: string;
  iconUrl: string;
  iconScale: number;
  rarity: AchievementToastDefinition['rarity'];
  duration: number;
}

interface VersusAiStyle {
  name: string;
  intro: string;
  reactionBonus: number;
  errorScale: number;
  trapScale: number;
  boostBias: number;
  patienceScale: number;
}

const versusAiStyles: readonly VersusAiStyle[] = [
  {
    name: 'ACE',
    intro: 'Balanced reads and clean counters',
    reactionBonus: 0.015,
    errorScale: 0.82,
    trapScale: 0.92,
    boostBias: 1,
    patienceScale: 1,
  },
  {
    name: 'BLAZE',
    intro: 'Aggressive trap passes and fast pressure',
    reactionBonus: -0.015,
    errorScale: 1.1,
    trapScale: 1.42,
    boostBias: 0.86,
    patienceScale: 0.82,
  },
  {
    name: 'LOCK',
    intro: 'Patient defense and precise power bounces',
    reactionBonus: 0.035,
    errorScale: 0.68,
    trapScale: 0.72,
    boostBias: 1.25,
    patienceScale: 1.16,
  },
];

const achievementToastDefinitions: Readonly<Record<AchievementId, AchievementToastDefinition>> = {
  score10000: {
    title: 'Five-Figure Run',
    description: 'Score 10,000 points in one game.',
    iconPath: '@project/assets/textures/10000pointsinonegame.png',
    iconScale: 3.2,
    rarity: 'legendary',
  },
  firstPurchase: {
    title: 'First Purchase',
    description: 'Buy your first ball from the shop.',
    iconPath: '@project/assets/textures/First purchase.png',
    iconScale: 3.2,
    rarity: 'epic',
  },
  playTutorial: {
    title: 'Training Day',
    description: 'Complete both tutorials.',
    iconPath: '@project/assets/textures/play tutorial.png',
    iconScale: 3.2,
    rarity: 'rare',
  },
  starWithoutSwitching: {
    title: 'Hold Your Ground',
    description: 'Collect a star without switching lanes.',
    iconPath: '@project/assets/textures/Star without switching lanes.png',
    iconScale: 4.4,
    rarity: 'epic',
  },
  highScore: {
    title: 'High Score',
    description: 'Complete your first run and set a personal best.',
    iconPath: '@project/assets/textures/First point.png',
    iconScale: 3.2,
    rarity: 'legendary',
  },
};

interface HandAnimationState {
  action: THREE.AnimationAction;
  mixer: THREE.AnimationMixer;
}

@ENGINE.GameClass()
export class DribbleGameplayManager extends ENGINE.Actor {
  private ball: DribbleBall | null = null;
  private scoreDisplay: ENGINE.NumberDisplay | null = null;
  private pauseButton: DribblePauseButton | null = null;
  private livesDisplay: DribbleLivesDisplay | null = null;
  private sideHints: DribbleSideHints | null = null;
  private timingMeter: DribbleTimingMeter | null = null;
  private juiceHud: DribbleJuiceHud | null = null;
  private mainMenu: DribbleMainMenu | null = null;
  private overlay: DribbleOverlay | null = null;
  private tutorialHud: DribbleTutorialHud | null = null;
  private versusHud: DribbleVersusHud | null = null;
  private achievementToast: ENGINE.Achievement | null = null;
  private spawnTimer = 0.9;
  private elapsedTime = 0;
  private score = 0;
  private progression: DribbleProgressionState = loadProgression();
  private lives = 3;
  private maxLives = 3;
  private gameMode: DribbleGameMode = 'normal';
  private combo = 0;
  private bestCombo = 0;
  private goodHits = 0;
  private perfectSwitches = 0;
  private hazardsAvoided = 0;
  private runStarsEarned = 0;
  private nextMilestoneScore = 2500;
  private timingCandidateError: number | null = null;
  private timingReady = false;
  private pendingPerfectSwitchUntil = 0;
  private frenzyCharge = 0;
  private frenzyTimeRemaining = 0;
  private spawnsSinceHazard = 0;
  private consecutiveHazards = 0;
  private centerRhythmSpawnsRemaining = 0;
  private centerRhythmNextKind: 'score' | 'hazard' = 'score';
  private centerRhythmCooldown = 12;
  private centerRhythmOpportunityCount = 0;
  private lastSpawnWasCenterRhythm = false;
  private readonly handAnimations = new Map<DribbleSide, HandAnimationState>();
  private readonly handModelRoots = new Map<DribbleSide, THREE.Object3D>();
  private readonly referenceHandVisibility = new Map<ENGINE.SceneComponent, boolean>();
  private readonly impactBursts: DribbleImpactBurst[] = [];
  private readonly comboPopups: DribbleComboPopup[] = [];
  private readonly activeTargets: DribbleTarget[] = [];
  private readonly targetSpawnSwitchCounts = new WeakMap<DribbleTarget, number>();
  private readonly targetPaceScales = new WeakMap<DribbleTarget, number>();
  private readonly achievementToastQueue: AchievementToastRequest[] = [];
  private readonly achievementIconUrls = new Map<AchievementId, string>();
  private readonly patternDirector = new DribblePatternDirector();
  private readonly difficultyDirector = new DribbleDifficultyDirector();
  private readonly tutorialDirector = new DribbleTutorialDirector();
  private tutorialActive = false;
  private tutorialMode: DribbleTutorialMode = 'classic';
  private tutorialTarget: DribbleTarget | null = null;
  private tutorialLessonId = '';
  private tutorialTransitionTimer = 0;
  private tutorialTransitionPending = false;
  private tutorialRiskCueShown = false;
  private readonly targetHitPosition = new THREE.Vector3();
  private readonly comboPopupPosition = new THREE.Vector3();
  private gameState: DribbleGameState = 'menu';
  private musicDirector: DribbleMusicDirector | null = null;
  private impactBurstCursor = 0;
  private comboPopupCursor = 0;
  private previousGameCursor: string | null = null;
  private scoreStarAssetUrl = '';
  private readonly lanes = [-0.95, 0, 0.95];
  private readonly frenzyHitsRequired = 14;
  private readonly frenzyDuration = 5.5;
  private readonly targetSpawnZ = -18;
  private readonly minimumTargetGap = 2.35;
  private readonly comfortableTargetGap = 3.15;
  private readonly centerRhythmLength = 8;
  private readonly difficultyRampStart = 5;
  private readonly difficultyRampDuration = 90;
  private readonly speedStageStart = 12;
  private readonly speedStageInterval = 20;
  private readonly maximumSpeedStage = 4;
  private readonly speedStageBoost = 0.3;
  private lastSpawnIntervalScale = 1;
  private laneSwitchCount = 0;
  private difficultyStage = 0;
  private achievementToastTimer: ReturnType<typeof setTimeout> | null = null;
  private achievementToastActive = false;
  private runStartingHighScore = 0;
  private runHadPriorResult = false;
  private runHighScoreCelebrated = false;
  private runResultCommitted = true;
  private versusOwner: VersusOwner = 'ai';
  private versusPlayerLosses = 0;
  private versusAiLosses = 0;
  private versusRound = 1;
  private versusRoundActive = false;
  private versusRoundResetTimer = 0;
  private versusPossessionTime = 0;
  private versusAiDecisionTimer = 0;
  private versusLastStableSide: DribbleSide = 'left';
  private versusSpawnCount = 0;
  private versusQueuedAiAction: 'return' | 'boost' | null = null;
  private versusQueuedAiActionTimer = 0;
  private versusTrickyPassCooldown = 0;
  private versusLastEvaluatedAirThreat: DribbleTarget | null = null;
  private versusRecoveryCooldown = 0;
  private versusRecoveryGateSequence = 0;
  private versusPlayerRiskCards = 3;
  private versusAiRiskCards = 3;
  private versusReturnLockedOwner: VersusOwner | null = null;
  private versusWasCatching = false;
  private versusPressureWarningStage = 0;
  private versusCurrentRally = 0;
  private versusLongestRally = 0;
  private versusPlayerReturns = 0;
  private versusAiReturns = 0;
  private versusDangerPasses = 0;
  private versusAiStyle: VersusAiStyle = versusAiStyles[0];
  private readonly versusLossesToEndMatch = 3;
  private readonly versusPressureDuration = 2.45;
  private readonly versusMaximumRiskCards = 3;

  public handleLeftClick(): DribbleInputAction {
    if (this.gameState !== 'playing') return null;
    const ballState = this.ball?.getState();
    if (this.gameMode === 'last-bounce') {
      if (this.tutorialActive) {
        const lessonId = this.tutorialDirector.getLesson().id;
        if (lessonId === 'versus-lives') {
          this.recordTutorialEvent('continue');
          return null;
        }
      }
      if (!this.versusRoundActive || ballState?.side !== 'right' || ballState.isTransferring) return null;
      if (ballState.isCatching && this.versusReturnLockedOwner === 'player') {
        this.versusHud?.showCallout('SECURE THE BALL', 'Return available after the catch', 'gold', 520);
        return null;
      }
      const actionWorked = this.ball?.transferToLeft();
      if (actionWorked) {
        this.beginVersusPass('ai', ballState.isCatching);
        if (this.tutorialActive) this.recordTutorialEvent('switch-left');
      }
      return actionWorked ? 'transfer' : null;
    }
    const isBoost = ballState?.side === 'left';
    const actionWorked = ballState?.side === 'left'
      ? this.ball?.boostLeft()
      : this.ball?.transferToLeft();
    if (actionWorked && !isBoost) {
      this.laneSwitchCount += 1;
      this.registerCenterSwitchTiming();
    }
    if (actionWorked && this.tutorialActive) {
      this.recordTutorialEvent(ballState?.side === 'left' ? 'boost-left' : 'switch-left');
    }
    return actionWorked ? isBoost ? 'boost' : 'transfer' : null;
  }

  public handleRightClick(): DribbleInputAction {
    if (this.gameState !== 'playing') return null;
    const ballState = this.ball?.getState();
    if (this.gameMode === 'last-bounce') {
      if (this.tutorialActive) {
        const lessonId = this.tutorialDirector.getLesson().id;
        if (lessonId === 'versus-lives') return null;
      }
      if (!this.versusRoundActive || ballState?.side !== 'right' || ballState.isTransferring) return null;
      const actionWorked = this.ball?.boostRight();
      if (actionWorked && this.tutorialActive) this.recordTutorialEvent('boost-right');
      return actionWorked ? 'boost' : null;
    }
    const isBoost = ballState?.side === 'right';
    const actionWorked = ballState?.side === 'right'
      ? this.ball?.boostRight()
      : this.ball?.transferToRight();
    if (actionWorked && !isBoost) {
      this.laneSwitchCount += 1;
      this.registerCenterSwitchTiming();
    }
    if (actionWorked && this.tutorialActive) {
      this.recordTutorialEvent(ballState?.side === 'right' ? 'boost-right' : 'switch-right');
    }
    return actionWorked ? isBoost ? 'boost' : 'transfer' : null;
  }

  public togglePause(): void {
    if (this.gameState === 'menu' || this.gameState === 'gameOver') {
      return;
    }

    if (this.gameState === 'paused') {
      this.resumeRun();
    } else {
      this.pauseRun();
    }
  }

  public restartRun(mode?: DribbleGameMode): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }
    this.musicDirector?.setState('gameplay');
    this.clearAchievementToasts();

    if (!this.tutorialActive) this.commitRunResult(false);
    this.stopTutorial();
    if (mode) {
      this.gameMode = mode;
      this.maxLives = mode === 'hard' ? 1 : 3;
    }
    this.prepareRunRecordTracking();

    for (const target of this.activeTargets) {
      target.destroy();
    }
    this.activeTargets.length = 0;
    this.deactivateHitEffects();

    this.gameState = 'playing';
    this.spawnTimer = 0.7;
    this.elapsedTime = 0;
    this.score = 0;
    this.lives = this.maxLives;
    this.combo = 0;
    this.bestCombo = 0;
    this.goodHits = 0;
    this.perfectSwitches = 0;
    this.hazardsAvoided = 0;
    this.runStarsEarned = 0;
    this.nextMilestoneScore = 2500;
    this.timingCandidateError = null;
    this.timingReady = false;
    this.pendingPerfectSwitchUntil = 0;
    this.frenzyCharge = 0;
    this.frenzyTimeRemaining = 0;
    this.spawnsSinceHazard = 0;
    this.consecutiveHazards = 0;
    this.centerRhythmSpawnsRemaining = 0;
    this.centerRhythmNextKind = 'score';
    this.centerRhythmCooldown = 12;
    this.centerRhythmOpportunityCount = 0;
    this.lastSpawnWasCenterRhythm = false;
    this.lastSpawnIntervalScale = 1;
    this.laneSwitchCount = 0;
    this.difficultyStage = 0;
    this.patternDirector.reset(this.gameMode);
    this.difficultyDirector.reset(this.gameMode);
    this.musicDirector?.setIntensity(0);
    if (this.gameMode === 'last-bounce') {
      this.startVersusMatch();
    } else {
      this.versusRoundActive = false;
      this.ball?.setCatchEnabled(false);
      this.ball?.reset();
    }
    this.setGameplayActive(true);
    this.scoreDisplay?.setValue(0, false);
    this.scoreDisplay?.setTrend(null);
    this.livesDisplay?.resetLives(this.lives, this.maxLives);
    this.timingMeter?.setTiming(0, false, false);
    this.juiceHud?.setFrenzy(0, 0, false);
    this.mainMenu?.hide();
    this.overlay?.hide();
    this.setHudVisible(true);
    if (this.gameMode === 'last-bounce') this.syncVersusHud();
    world.inputManager.exitPointerLock();
  }

  public startTutorial(mode: DribbleTutorialSelection = 'classic'): void {
    const world = this.getWorld();
    if (!world) return;
    this.musicDirector?.setState('gameplay');
    this.clearAchievementToasts();
    for (const target of this.activeTargets) target.destroy();
    this.activeTargets.length = 0;
    this.deactivateHitEffects();
    this.tutorialActive = true;
    this.tutorialMode = mode;
    this.gameMode = mode === 'last-bounce' ? 'last-bounce' : 'normal';
    this.tutorialTarget = null;
    this.tutorialLessonId = '';
    this.tutorialTransitionTimer = 0;
    this.tutorialTransitionPending = false;
    this.tutorialRiskCueShown = false;
    this.gameState = 'playing';
    this.runResultCommitted = true;
    this.runHighScoreCelebrated = false;
    this.elapsedTime = 0;
    this.score = 0;
    this.maxLives = 3;
    this.lives = 3;
    this.combo = 0;
    this.bestCombo = 0;
    this.goodHits = 0;
    this.perfectSwitches = 0;
    this.hazardsAvoided = 0;
    this.runStarsEarned = 0;
    this.frenzyCharge = 0;
    this.frenzyTimeRemaining = 0;
    this.laneSwitchCount = 0;
    this.patternDirector.cancel();
    this.musicDirector?.setIntensity(0);
    this.tutorialDirector.reset(mode);
    this.versusRoundActive = mode === 'last-bounce';
    this.versusOwner = 'player';
    this.versusPlayerLosses = 0;
    this.versusAiLosses = 0;
    this.versusRound = 1;
    this.versusPossessionTime = 0;
    this.versusPlayerRiskCards = this.versusMaximumRiskCards;
    this.versusAiRiskCards = this.versusMaximumRiskCards;
    this.versusReturnLockedOwner = null;
    this.versusHud?.setOpponentName(mode === 'last-bounce' ? 'COACH' : 'AI');
    this.ball?.setCatchEnabled(mode === 'last-bounce');
    this.ball?.reset(mode === 'last-bounce' ? 'right' : 'left');
    this.ball?.setFrenzyActive(false);
    this.setGameplayActive(true);
    this.scoreDisplay?.setValue(0, false);
    this.livesDisplay?.resetLives(3, 3);
    this.timingMeter?.setTiming(0, false, false);
    this.juiceHud?.setFrenzy(0, 0, false);
    this.mainMenu?.hide();
    this.overlay?.hide();
    this.setHudVisible(true);
    this.scoreDisplay?.hide();
    this.versusHud?.setTutorialLayout(mode === 'last-bounce');
    if (mode === 'last-bounce') {
      this.livesDisplay?.hide();
      this.timingMeter?.hide();
      this.juiceHud?.hide();
      this.versusHud?.show();
      this.syncVersusHud();
    }
    this.tutorialHud?.setMode(mode);
    this.tutorialHud?.show();
    this.syncTutorialLesson();
    world.inputManager.exitPointerLock();
  }

  public override tickPrePhysics(deltaTime: number): void {
    super.tickPrePhysics(deltaTime);
    if (this.gameState !== 'playing') {
      return;
    }

    this.elapsedTime += deltaTime;
    this.compactActiveTargets();
    if (this.tutorialActive) {
      this.updateTutorial(deltaTime);
      const ballState = this.ball?.getState();
      if (ballState) {
        this.updateTimingMeter(ballState, this.activeTargets);
        this.checkBallTargetHits(ballState, this.activeTargets);
        this.updateHandAnimations(deltaTime, ballState);
      }
      return;
    }
    if (this.gameMode === 'last-bounce') {
      this.updateVersusMode(deltaTime);
      return;
    }
    this.centerRhythmCooldown = Math.max(0, this.centerRhythmCooldown - deltaTime);
    this.updateFrenzy(deltaTime);
    const baseDifficulty = this.getDifficultyRamp();
    this.difficultyDirector.update(
      deltaTime,
      baseDifficulty,
      this.combo,
      this.maxLives > 0 ? this.lives / this.maxLives : 0,
    );
    const difficulty = this.difficultyDirector.getDifficulty(baseDifficulty);
    this.musicDirector?.setIntensity(this.difficultyDirector.getIntensity());
    this.updateAdaptiveIntensityFeedback();
    this.updateDifficultyStage();
    this.spawnTimer -= deltaTime;
    if (this.spawnTimer <= 0) {
      if (this.spawnTarget(difficulty)) {
        const baseInterval = this.lastSpawnWasCenterRhythm
          ? THREE.MathUtils.lerp(0.92, 0.7, difficulty)
          : THREE.MathUtils.lerp(1.02, 0.54, difficulty);
        const frenzyMultiplier = this.frenzyTimeRemaining > 0 && !this.lastSpawnWasCenterRhythm
          ? 0.82
          : 1;
        this.spawnTimer = THREE.MathUtils.randFloat(
          baseInterval * (this.lastSpawnWasCenterRhythm ? 0.97 : 0.9),
          baseInterval * (this.lastSpawnWasCenterRhythm ? 1.03 : 1.1),
        ) * frenzyMultiplier
          * this.lastSpawnIntervalScale
          * this.difficultyDirector.getSpawnIntervalScale();
      } else {
        this.spawnTimer = 0.08;
      }
    }

    const ballState = this.ball?.getState();
    if (ballState) {
      this.updateTargetSpacing(this.activeTargets, deltaTime, difficulty);
      this.updateTimingMeter(ballState, this.activeTargets);
      this.checkBallTargetHits(ballState, this.activeTargets);
      this.updateHandAnimations(deltaTime, ballState);
    }
  }

  protected override doBeginPlay(): void {
    super.doBeginPlay();
    const world = this.getWorld();
    if (world) {
      this.musicDirector = new DribbleMusicDirector(world);
      this.musicDirector.preload();
      this.musicDirector.setState('menu');
    }
    this.setupArena();
    this.hideReferenceHands();
    void this.setupHandAnimations();
    void this.setupHud().catch(error => {
      const gameContainer = this.getWorld()?.gameContainer;
      if (gameContainer) hideDribbleBootScreen(gameContainer);
      console.error('Could not initialize Basketball Frenzy UI', error);
    });
  }

  protected override doEndPlay(): void {
    this.clearAchievementToasts();
    this.scoreDisplay?.destroy();
    this.musicDirector?.stop();
    this.musicDirector = null;
    this.handModelRoots.clear();
    this.pauseButton?.destroy();
    this.livesDisplay?.destroy();
    this.sideHints?.destroy();
    this.timingMeter?.destroy();
    this.juiceHud?.destroy();
    this.achievementToast?.destroy();
    this.tutorialHud?.destroy();
    this.versusHud?.destroy();
    this.mainMenu?.destroy();
    this.overlay?.destroy();
    this.scoreDisplay = null;
    this.pauseButton = null;
    this.livesDisplay = null;
    this.sideHints = null;
    this.timingMeter = null;
    this.juiceHud = null;
    this.achievementToast = null;
    this.tutorialHud = null;
    this.versusHud = null;
    this.mainMenu = null;
    this.overlay = null;
    this.restoreReferenceHands();
    const world = this.getWorld();
    const gameContainer = world?.gameContainer;
    if (gameContainer && this.previousGameCursor !== null) {
      gameContainer.style.cursor = this.previousGameCursor;
      this.previousGameCursor = null;
    }
    for (const state of this.handAnimations.values()) {
      state.mixer.stopAllAction();
    }
    this.handAnimations.clear();
    this.impactBursts.length = 0;
    this.comboPopups.length = 0;
    this.activeTargets.length = 0;
    super.doEndPlay();
  }

  private hideReferenceHands(): void {
    const world = this.getWorld();
    if (!world) return;
    for (const actor of world.getActorsByPredicate(candidate => candidate.hasActorTag('hand-placeholder'))) {
      for (const component of actor.getComponents(ENGINE.SceneComponent)) {
        if (!this.referenceHandVisibility.has(component)) {
          this.referenceHandVisibility.set(component, component.visible);
        }
        component.visible = false;
      }
    }
  }

  private restoreReferenceHands(): void {
    for (const [component, visible] of this.referenceHandVisibility) {
      component.visible = visible;
    }
    this.referenceHandVisibility.clear();
  }

  private setupArena(): void {
    const world = this.getWorld();
    if (!world || this.ball) {
      return;
    }

    const courtFloor = world.addBox({
      position: new THREE.Vector3(0, -0.08, -7),
      width: 3.6,
      height: 0.16,
      depth: 30,
      color: 0x2b2134,
    });
    courtFloor.setName('Dribble Court Floor');
    courtFloor.rootComponent.castShadow = false;
    courtFloor.rootComponent.receiveShadow = true;

    world.addBox({
      position: new THREE.Vector3(0, 0.02, -1.85),
      width: 0.12,
      height: 0.04,
      depth: 0.8,
      color: 0xffd36a,
    }).setName('Center Bounce Mark');

    for (const laneX of this.lanes) {
      world.addBox({
        position: new THREE.Vector3(laneX, 0.02, -8),
        width: 0.035,
        height: 0.04,
        depth: 30,
        color: laneX === 0 ? 0xffd36a : laneX < 0 ? 0xff6b8a : 0x65b8ff,
      }).setName(`Lane Guide ${laneX}`);
    }

    this.configureRendererForPerformance(world);
    this.configurePostProcessing(world);
    this.configureSunsetLighting(world);
    this.addHand(world, 'Left Hand', '@project/assets/models/right_hand_runtime.glb');
    this.addHand(world, 'Right Hand', '@project/assets/models/left_hand_runtime.glb');
    this.addLights(world);

    this.ball = DribbleBall.create({ name: 'Dribble Ball' });
    world.addActor(this.ball);
    this.ball.setEquippedCosmetic(this.progression.equippedBall);
    this.ball.setGameplayActive(false);
    this.createHitEffectPool(world);
  }

  private configureRendererForPerformance(world: ENGINE.World): void {
    const renderer = world.getRenderer() as unknown as {
      getPixelRatio?: () => number;
      setPixelRatio?: (ratio: number) => void;
      shadowMap?: { enabled: boolean; autoUpdate?: boolean };
    } | null;
    const currentPixelRatio = renderer?.getPixelRatio?.() ?? 1;
    renderer?.setPixelRatio?.(Math.min(currentPixelRatio, 1));
    if (renderer?.shadowMap) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.autoUpdate = true;
    }
  }

  private configurePostProcessing(world: ENGINE.World): void {
    const configuration = world.getPostProcessConfiguration();
    if (!configuration) {
      return;
    }

    const effects = configuration.effects.map(effect => {
      if (effect.type === 'bloom') {
        return Object.assign({}, effect, { levels: 2 });
      }
      if (effect.type === 'ao') {
        return Object.assign({}, effect, { enabled: false });
      }
      return effect;
    });
    world.setPostProcessConfiguration({ effects });
  }

  private configureSunsetLighting(world: ENGINE.World): void {
    let hasSkyDriver = false;
    for (const actor of world.getActors()) {
      for (const sunLight of actor.getComponents(ENGINE.DirectionalLightComponent)) {
        if (!sunLight.isSunLight) {
          continue;
        }

        // This light drives only the procedural sky; the gameplay key below preserves object lighting.
        sunLight.position.set(-30, 18, 12);
        sunLight.rotation.set(0.15, -0.62, 0);
        sunLight.color = new THREE.Color(1, 0.296138, 0.088656);
        sunLight.intensity = 0;
        sunLight.castShadow = false;
        hasSkyDriver = true;
      }

      for (const sky of actor.getComponents(ENGINE.SkyComponent)) {
        sky.turbidity = 10.5;
        sky.rayleigh = 1.8;
        sky.mieCoefficient = 0.0075;
        sky.mieDirectionalG = 0.62;
        sky.cloudCoverage = 0.4;
        sky.cloudDensity = 0.46;
        sky.cloudElevation = 0.3;
        sky.showSunDisc = true;
        sky.environmentMapIntensity = 0.85;
      }

      for (const hemisphere of actor.getComponents(ENGINE.HemisphereLightComponent)) {
        hemisphere.color = new THREE.Color(0.155926, 0.168269, 0.584078);
        hemisphere.groundColor = new THREE.Color(0.799103, 0.099899, 0.084376);
        hemisphere.intensity = 1.6;
      }

      for (const ambient of actor.getComponents(ENGINE.AmbientLightComponent)) {
        ambient.color = new THREE.Color(0.040915, 0.024158, 0.109462);
        ambient.intensity = 0.35;
      }
    }

    if (hasSkyDriver) {
      world.addActor(ENGINE.Actor.create({
        name: 'Gameplay Sunset Key Light',
        rootComponent: ENGINE.DirectionalLightComponent.create({
          color: new THREE.Color(1, 0.296138, 0.088656),
          intensity: 5.5,
          isSunLight: false,
          castShadow: true,
          shadowMapSize: 1024,
          shadowBias: -0.001,
          shadowCameraBottom: -15,
          shadowCameraLeft: -30,
          shadowCameraRight: 30,
          shadowCameraTop: 25,
          position: new THREE.Vector3(10, 50, -10),
          rotation: new THREE.Euler(0.22, -0.35, 0),
        }),
      }));
    }
  }

  private async setupHud(): Promise<void> {
    const world = this.getWorld();
    if (!world || this.scoreDisplay) {
      return;
    }

    this.scoreStarAssetUrl = await ENGINE.resolveAssetPathsInText(
      '@project/assets/textures/Star.png',
    );
    await this.resolveAchievementIconUrls();
    const gameContainer = world.gameContainer;
    if (gameContainer) {
      this.previousGameCursor = gameContainer.style.cursor;
      gameContainer.style.cursor = 'none';
    }

    this.scoreDisplay = new ENGINE.NumberDisplay(world.uiManager, {
      position: 'top-right',
      visible: false,
      label: '',
      initialValue: 0,
      animate: true,
      iconHtml: this.createScoreIconHtml(),
    });
    this.pauseButton = new DribblePauseButton(world.uiManager, {
      visible: false,
      onPause: () => this.pauseRun(),
    });
    this.livesDisplay = new DribbleLivesDisplay(world.uiManager, {
      position: 'top-left',
      visible: false,
      initialLives: this.lives,
      maxLives: 3,
    });
    this.sideHints = new DribbleSideHints(world.uiManager, {
      visible: false,
    });
    this.timingMeter = new DribbleTimingMeter(world.uiManager, {
      position: 'bottom-center',
      visible: false,
    });
    this.juiceHud = new DribbleJuiceHud(world.uiManager, {
      position: 'top-center',
      visible: false,
    });
    this.achievementToast = new ENGINE.Achievement(world.uiManager, {
      position: 'top-right',
      visible: false,
    });
    this.mainMenu = new DribbleMainMenu(world.uiManager, {
      onPlay: mode => this.restartRun(mode),
      onTutorial: mode => this.startTutorial(mode),
      onVolumeChange: volume => this.applyMasterVolume(volume),
      onMusicVolumeChange: volume => this.applyMusicVolume(volume),
      onSfxVolumeChange: volume => this.applySfxVolume(volume),
      onReducedMotionChange: enabled => this.applyReducedMotion(enabled),
      onReducedFlashesChange: enabled => this.applyReducedFlashes(enabled),
      onHighContrastTargetsChange: enabled => this.applyHighContrastTargets(enabled),
      onBallBounce: strength => playBasketballBounce(world, strength),
      onExit: () => this.exitGame(),
      progression: this.progression,
      onPurchaseBall: cosmetic => this.purchaseBall(cosmetic),
      onEquipBall: cosmetic => this.setEquippedBall(cosmetic),
      onWristbandColorChange: (side, color) => this.setWristbandSelection(side, color),
      onResetProgression: target => this.resetProgression(target),
    });
    this.overlay = new DribbleOverlay(world.uiManager, {
      onResume: () => this.resumeRun(),
      onRestart: () => this.tutorialActive ? this.startTutorial(this.tutorialMode) : this.restartRun(),
      onMainMenu: () => this.returnToMainMenu(),
    });
    this.tutorialHud = new DribbleTutorialHud(world.uiManager, {
      visible: false,
      onExit: () => this.returnToMainMenu(),
    });
    this.versusHud = new DribbleVersusHud(world.uiManager, {
      visible: false,
    });

    await Promise.all([
      this.scoreDisplay.initialize(),
      this.pauseButton.initialize(),
      this.livesDisplay.initialize(),
      this.sideHints.initialize(),
      this.timingMeter.initialize(),
      this.juiceHud.initialize(),
      this.achievementToast.initialize(),
      this.tutorialHud.initialize(),
      this.versusHud.initialize(),
      this.mainMenu.initialize(),
      this.overlay.initialize(),
    ]);
    this.scoreDisplay.setPosition({
      'width': 'auto',
      'height': 'auto',
      'position': 'fixed',
      'top': '28px',
      'right': '28px',
      'left': 'auto',
      'display': 'flex',
      'flex-direction': 'row',
      'align-items': 'center',
      'justify-content': 'flex-end',
      'gap': '8px',
      'padding': '7px 12px 7px 9px',
      'border': '1px solid rgba(255, 255, 255, 0.14)',
      'border-radius': '8px',
      'background-color': 'rgba(7, 11, 18, 0.62)',
      'backdrop-filter': 'none',
      '-webkit-backdrop-filter': 'none',
      'box-shadow': 'none',
      'margin': '0',
      'pointer-events': 'none',
    }, '.ui-number-display');
    this.scoreDisplay.setPosition({
      'display': 'flex',
      'align-items': 'center',
      'min-height': '0',
    }, '.ui-number-display-header');
    this.scoreDisplay.setPosition({
      'display': 'inline-flex',
      'width': '44px',
      'height': '36px',
      'flex-shrink': '0',
    }, '.ui-number-display-icon');
    this.scoreDisplay.setPosition({
      'display': 'block',
      'width': '44px',
      'height': '36px',
      'object-fit': 'contain',
    }, '.ui-number-display-icon img');
    this.scoreDisplay.setPosition({
      'position': 'relative',
      'display': 'block',
      'width': '44px',
      'height': '36px',
    }, '.score-star-icon');
    this.scoreDisplay.setPosition({
      'position': 'absolute',
      'left': '-4px',
      'bottom': '-4px',
      'display': 'grid',
      'min-width': '17px',
      'height': '17px',
      'padding': '0 4px',
      'box-sizing': 'border-box',
      'place-items': 'center',
      'border': '1px solid rgba(255, 255, 255, 0.88)',
      'border-radius': '9px',
      'background': '#101827',
      'color': '#fff6a8',
      'font-family': 'Boogaloo, sans-serif',
      'font-size': '12px',
      'font-weight': '700',
      'line-height': '15px',
      'text-shadow': '0 1px 2px rgba(0, 0, 0, 0.9)',
      'z-index': '2',
    }, '.score-star-balance');
    this.scoreDisplay.setPosition({
      'font-weight': '700',
      'font-size': '36px',
      'line-height': '40px',
      'color': '#ffffff',
      'letter-spacing': '0',
    }, '.ui-number-display-value');
    this.configureAchievementToast();
    this.syncUiState();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (gameContainer) hideDribbleBootScreen(gameContainer);
  }

  private async resolveAchievementIconUrls(): Promise<void> {
    const ids = Object.keys(achievementToastDefinitions) as AchievementId[];
    const resolvedUrls = await Promise.all(ids.map(id => (
      ENGINE.resolveAssetPathsInText(achievementToastDefinitions[id].iconPath)
    )));
    for (let index = 0; index < ids.length; index += 1) {
      this.achievementIconUrls.set(ids[index], resolvedUrls[index]);
    }
  }

  private configureAchievementToast(): void {
    this.achievementToast?.setPosition({
      'position': 'fixed',
      'z-index': '14500',
      'top': 'clamp(88px, 10vh, 108px)',
      'right': 'max(16px, env(safe-area-inset-right))',
      'bottom': 'auto',
      'left': 'auto',
      'width': 'min(330px, calc(100vw - 32px))',
      'min-width': '0',
      'max-width': '330px',
      'padding': '10px 12px',
      'gap': '10px',
      'box-sizing': 'border-box',
      'border': '2px solid #ffd34f',
      'border-radius': '8px',
      'background-color': 'rgba(5, 24, 67, 0.94)',
      'box-shadow': '0 8px 20px rgba(0, 15, 55, 0.38)',
      'font-family': 'Boogaloo, sans-serif',
      'pointer-events': 'none',
    }, '.ui-achievement');
    this.achievementToast?.setPosition({
      'width': '52px',
      'height': '52px',
      'border-radius': '7px',
      'background': 'rgba(24, 111, 210, 0.38)',
    }, '.ui-achievement-icon');
    this.achievementToast?.setPosition({
      'gap': '1px',
    }, '.ui-achievement-body');
    this.achievementToast?.setPosition({
      'color': '#ffffff',
      'font-family': 'Boogaloo, sans-serif',
      'font-size': '21px',
      'font-weight': '400',
      'line-height': '24px',
      'letter-spacing': '0',
    }, '.ui-achievement-title');
    this.achievementToast?.setPosition({
      'color': '#cce8ff',
      'font-family': 'Boogaloo, sans-serif',
      'font-size': '14px',
      'line-height': '18px',
      'letter-spacing': '0',
    }, '.ui-achievement-description');
  }

  private addHand(world: ENGINE.World, name: string, modelUrl: string): void {
    const existing = world.getActorByName(name);
    const existingModel = existing?.rootComponent instanceof ENGINE.ModelMeshComponent
      ? existing.rootComponent
      : existing?.getComponent(ENGINE.ModelMeshComponent);
    if (existingModel?.modelUrl === modelUrl) {
      existingModel.replacePhysicsOptions({ enabled: false });
      existingModel.castShadow = true;
      return;
    }
    existing?.destroy();

    const hand = ENGINE.ModelMeshActor.create({
      name,
      modelUrl,
      position: new THREE.Vector3(0, 1.32, -1.08),
      scale: new THREE.Vector3(0.5, 0.5, 0.5),
      physicsOptions: { enabled: false },
    });
    hand.rootComponent.castShadow = true;
    world.addActor(hand);
  }

  private async setupHandAnimations(): Promise<void> {
    await Promise.all([
      this.setupHandAnimation('left', 'Left Hand'),
      this.setupHandAnimation('right', 'Right Hand'),
    ]);
  }

  private async setupHandAnimation(side: DribbleSide, actorName: string): Promise<void> {
    const actor = this.getWorld()?.getActorByName(actorName);
    const model = actor?.rootComponent instanceof ENGINE.ModelMeshComponent
      ? actor.rootComponent
      : actor?.getComponent(ENGINE.ModelMeshComponent);
    if (!model) {
      return;
    }

    await model.waitForLoad();
    const modelRoot = model.getModel();
    const clip = model.getAnimations().find(animation => animation.name === 'Bounce');
    if (!modelRoot) {
      return;
    }
    this.handModelRoots.set(side, modelRoot);
    const wristbandColor = side === 'left'
      ? this.progression.leftWristbandColor
      : this.progression.rightWristbandColor;
    this.applyWristbandColor(side, wristbandColor);
    if (!clip) return;

    const mixer = new THREE.AnimationMixer(modelRoot);
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
    action.paused = true;
    this.handAnimations.set(side, { action, mixer });
  }

  private applyWristbandColor(side: WristbandSide, color: WristbandColor): void {
    const modelRoot = this.handModelRoots.get(side);
    if (!modelRoot) return;
    const tint = wristbandColorHex[color];
    modelRoot.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !this.isWristbandObject(object, modelRoot)) return;
      if (object.userData.dribbleWristbandMaterialCloned !== true) {
        object.material = Array.isArray(object.material)
          ? object.material.map(material => this.isWristbandMaterial(material) ? material.clone() : material)
          : this.isWristbandMaterial(object.material) ? object.material.clone() : object.material;
        object.userData.dribbleWristbandMaterialCloned = true;
      }
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (this.isWristbandMaterial(material) && 'color' in material && material.color instanceof THREE.Color) {
          material.color.set(tint);
          material.needsUpdate = true;
        }
      }
    });
  }

  private isWristbandObject(object: THREE.Object3D, modelRoot: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.name.toLowerCase().includes('wristband')) return true;
      if (current === modelRoot) return false;
      current = current.parent;
    }
    return false;
  }

  private isWristbandMaterial(material: THREE.Material): boolean {
    const name = material.name.toLowerCase();
    return !name.includes('emblem') && (name.includes('cuff') || name.includes('wristband'));
  }

  private updateHandAnimations(deltaTime: number, ballState: DribbleBallState): void {
    this.sideHints?.setState(ballState.side, ballState.isTransferring);

    for (const [side, state] of this.handAnimations) {
      const active = ballState.side === side
        && !ballState.isTransferring;
      state.action.paused = !active;
      if (active) {
        state.mixer.update(deltaTime);
      } else if (state.action.time !== 0) {
        state.action.time = 0;
        state.mixer.update(0);
      }
    }
  }

  private addLights(world: ENGINE.World): void {
    const coralFill = ENGINE.Actor.create({
      name: 'Sunset Coral Lane Fill',
      rootComponent: ENGINE.PointLightComponent.create({
        color: 0xff4f7b,
        intensity: 9,
        distance: 9,
        decay: 2,
        castShadow: false,
        position: new THREE.Vector3(-2.2, 2.5, -4.5),
      }),
    });

    const blueFill = ENGINE.Actor.create({
      name: 'Sunset Blue Lane Fill',
      rootComponent: ENGINE.PointLightComponent.create({
        color: 0x4da6ff,
        intensity: 8,
        distance: 10,
        decay: 2,
        castShadow: false,
        position: new THREE.Vector3(2.2, 2.2, -6.5),
      }),
    });

    world.addActors(coralFill, blueFill);
  }

  private spawnTarget(difficulty: number): boolean {
    const world = this.getWorld();
    if (!world) {
      return false;
    }

    const existingTargets = this.activeTargets;
    if (existingTargets.length >= 9) return false;
    const rearmostTarget = existingTargets[existingTargets.length - 1] ?? null;
    const entryGap = rearmostTarget
      ? rearmostTarget.rootComponent.position.z - this.targetSpawnZ
      : Number.POSITIVE_INFINITY;
    if (entryGap < this.minimumTargetGap) {
      return false;
    }

    this.tryStartCenterRhythm(existingTargets);
    const rhythmTarget = this.centerRhythmSpawnsRemaining > 0;
    const patternStep = !rhythmTarget && this.frenzyTimeRemaining <= 0
      ? this.patternDirector.takeStep({
        difficulty,
        elapsedTime: this.elapsedTime,
        activeTargetCount: existingTargets.length,
        mode: this.gameMode,
      })
      : null;
    const kind = rhythmTarget
      ? this.centerRhythmNextKind
      : patternStep?.kind ?? this.selectTargetKind(difficulty);
    if (!rhythmTarget && !patternStep) {
      this.patternDirector.recordUnscriptedSpawn();
    }
    if (!rhythmTarget) {
      this.recordSpawnKind(kind);
    }
    const availableLanes = kind === 'bonus' ? [this.lanes[0], this.lanes[2]] : this.lanes;
    const laneX = rhythmTarget
      ? 0
      : patternStep
        ? this.getPatternLaneX(patternStep.lane)
        : availableLanes[Math.floor(Math.random() * availableLanes.length)];
    const paceScale = rhythmTarget ? 1 : patternStep?.speedScale ?? 1;
    const speed = this.getTargetPace(difficulty) * paceScale;
    const target = DribbleTarget.create({
      name: kind === 'score'
        ? 'Score Target'
        : kind === 'health'
          ? 'Health Target'
          : kind === 'bonus'
            ? 'Bonus Star Target'
            : 'Hazard Target',
      kind,
      laneX,
      speed,
      rhythmTarget,
      position: new THREE.Vector3(
        laneX,
        kind === 'bonus'
          ? 2.45
          : rhythmTarget
            ? 0.48
            : patternStep?.height === 'low'
              ? 0.3
              : patternStep
                ? 0.52
                : THREE.MathUtils.randFloat(0.24, 0.68),
        this.targetSpawnZ,
      ),
    });
    world.addActor(target);
    this.activeTargets.push(target);
    this.targetSpawnSwitchCounts.set(target, this.laneSwitchCount);
    this.targetPaceScales.set(target, paceScale);
    this.lastSpawnWasCenterRhythm = rhythmTarget;
    this.lastSpawnIntervalScale = patternStep?.intervalScale ?? 1;
    if (patternStep?.startsPattern) {
      this.juiceHud?.showPraise(patternStep.patternLabel, 'gold');
    }
    if (rhythmTarget) {
      this.centerRhythmSpawnsRemaining -= 1;
      this.centerRhythmNextKind = kind === 'score' ? 'hazard' : 'score';
      if (this.centerRhythmSpawnsRemaining === 0) {
        this.centerRhythmCooldown = THREE.MathUtils.randFloat(26, 36);
      }
    }
    return true;
  }

  private startVersusMatch(): void {
    this.ball?.setCatchEnabled(true);
    this.versusPlayerLosses = 0;
    this.versusAiLosses = 0;
    this.versusRound = 1;
    this.versusSpawnCount = 0;
    this.versusCurrentRally = 0;
    this.versusLongestRally = 0;
    this.versusPlayerReturns = 0;
    this.versusAiReturns = 0;
    this.versusDangerPasses = 0;
    this.versusRecoveryGateSequence = 0;
    this.versusPlayerRiskCards = this.versusMaximumRiskCards;
    this.versusAiRiskCards = this.versusMaximumRiskCards;
    this.versusAiStyle = versusAiStyles[Math.floor(Math.random() * versusAiStyles.length)];
    this.versusHud?.setOpponentName(this.versusAiStyle.name);
    this.beginVersusRound();
  }

  private beginVersusRound(): void {
    for (const target of this.activeTargets) target.destroy();
    this.activeTargets.length = 0;
    this.deactivateHitEffects();
    this.versusRoundActive = true;
    this.versusRoundResetTimer = 0;
    this.versusPossessionTime = 0;
    this.versusCurrentRally = 0;
    this.versusAiDecisionTimer = 0.42;
    this.spawnTimer = 0.85;
    const startingSide: DribbleSide = this.versusRound % 2 === 1 ? 'left' : 'right';
    this.versusLastStableSide = startingSide;
    this.versusOwner = startingSide === 'left' ? 'ai' : 'player';
    this.versusQueuedAiAction = null;
    this.versusQueuedAiActionTimer = 0;
    this.versusTrickyPassCooldown = THREE.MathUtils.randFloat(1.6, 2.4);
    this.versusLastEvaluatedAirThreat = null;
    this.versusRecoveryCooldown = THREE.MathUtils.randFloat(5.5, 7.5);
    this.versusReturnLockedOwner = null;
    this.versusWasCatching = false;
    this.versusPressureWarningStage = 0;
    this.ball?.reset(startingSide);
    this.ball?.setGameplayActive(true);
    this.versusHud?.showCallout(
      `ROUND ${this.versusRound}`,
      this.versusRound === 1
        ? `${this.versusAiStyle.name}: ${this.versusAiStyle.intro}`
        : `${this.versusOwner === 'player' ? 'You start' : `${this.versusAiStyle.name} starts`} - cards ${this.versusPlayerRiskCards} vs ${this.versusAiRiskCards}`,
      this.versusOwner === 'player' ? 'blue' : 'gold',
      this.versusRound === 1 ? 1450 : 1000,
    );
    this.syncVersusHud();
  }

  private updateVersusMode(deltaTime: number): void {
    if (!this.versusRoundActive) {
      this.versusRoundResetTimer = Math.max(0, this.versusRoundResetTimer - deltaTime);
      if (this.versusRoundResetTimer <= 0 && this.gameState === 'playing') {
        if (
          this.versusPlayerLosses >= this.versusLossesToEndMatch
          || this.versusAiLosses >= this.versusLossesToEndMatch
        ) {
          this.endVersusMatch();
        } else {
          this.versusRound += 1;
          this.beginVersusRound();
        }
      }
      return;
    }

    const difficulty = THREE.MathUtils.clamp(this.elapsedTime / 75, 0, 1);
    this.versusTrickyPassCooldown = Math.max(0, this.versusTrickyPassCooldown - deltaTime);
    this.versusRecoveryCooldown = Math.max(0, this.versusRecoveryCooldown - deltaTime);
    this.spawnTimer -= deltaTime;
    if (this.spawnTimer <= 0) {
      const spawned = this.trySpawnVersusRecoveryGate(difficulty)
        || this.spawnVersusHazard(difficulty);
      if (spawned) {
        const baseInterval = THREE.MathUtils.lerp(1.12, 0.62, difficulty);
        this.spawnTimer = THREE.MathUtils.randFloat(baseInterval * 0.92, baseInterval * 1.08);
      } else {
        this.spawnTimer = 0.08;
      }
    }

    const ballState = this.ball?.getState();
    if (!ballState) return;
    if (!ballState.isCatching) this.versusPossessionTime += deltaTime;
    this.updateVersusPossession(ballState);
    this.updateVersusCatchState(ballState);
    this.updateVersusAi(deltaTime, ballState, difficulty);
    const pressure = THREE.MathUtils.clamp(
      this.versusPossessionTime / this.versusPressureDuration,
      0,
      1,
    );
    this.musicDirector?.setIntensity(Math.max(difficulty, pressure * 0.9));
    this.updateVersusPressureFeedback(pressure);
    this.updateTargetSpacing(this.activeTargets, deltaTime, difficulty, {
      basePace: THREE.MathUtils.lerp(4.45, 7.15, difficulty),
      pressureLaneX: this.versusOwner === 'ai' ? this.lanes[0] : this.lanes[2],
      pressure,
    });
    this.checkBallTargetHits(ballState, this.activeTargets);
    this.updateHandAnimations(deltaTime, ballState);
    this.syncVersusHud(ballState);
  }

  private updateVersusPossession(ballState: DribbleBallState): void {
    if (ballState.isTransferring || ballState.side === this.versusLastStableSide) return;
    this.versusLastStableSide = ballState.side;
    this.versusOwner = ballState.side === 'left' ? 'ai' : 'player';
    this.versusPossessionTime = 0;
    this.versusPressureWarningStage = 0;
    this.versusAiDecisionTimer = THREE.MathUtils.randFloat(0.28, 0.46);
    this.versusHud?.showCallout(
      ballState.isCatching ? 'CATCH WINDOW' : this.versusOwner === 'player' ? 'YOUR BALL' : 'AI BALL',
      ballState.isCatching
        ? this.versusReturnLockedOwner === this.versusOwner
          ? 'Control this catch'
          : this.versusOwner === 'player'
            ? 'Left click to return'
            : 'AI can return the pass'
        : this.versusOwner === 'player' ? 'Pass or power-bounce' : 'Read the next move',
      this.versusOwner === 'player' ? 'blue' : 'gold',
      620,
    );
  }

  private updateVersusCatchState(ballState: DribbleBallState): void {
    if (this.versusWasCatching && !ballState.isCatching) {
      if (this.versusReturnLockedOwner === this.versusOwner) {
        this.versusReturnLockedOwner = null;
      }
      if (this.versusOwner === 'ai' && this.versusQueuedAiAction === 'boost') {
        this.versusQueuedAiActionTimer = Math.min(this.versusQueuedAiActionTimer, 0.08);
      }
    }
    this.versusWasCatching = ballState.isCatching;
  }

  private updateVersusAi(
    deltaTime: number,
    ballState: DribbleBallState,
    difficulty: number,
  ): void {
    if (
      this.versusOwner !== 'ai'
      || ballState.side !== 'left'
      || ballState.isTransferring
      || ballState.isBoosting
    ) {
      return;
    }

    if (this.versusQueuedAiAction) {
      this.versusQueuedAiActionTimer = Math.max(0, this.versusQueuedAiActionTimer - deltaTime);
      if (this.versusQueuedAiActionTimer > 0) return;
      const queuedAction = this.versusQueuedAiAction;
      if (
        queuedAction === 'return'
        && ballState.isCatching
        && this.versusReturnLockedOwner !== 'ai'
      ) {
        this.versusQueuedAiAction = null;
        if (this.ball?.transferToRight()) {
          this.beginVersusPass('player', true);
          this.versusHud?.showCallout('AI RETURNS', 'Immediate counter-pass', 'danger', 540);
        }
        return;
      }
      const queuedGroundThreat = this.findVersusGroundThreat('left', 1.2);
      if (
        queuedAction === 'boost'
        && !ballState.isCatching
        && queuedGroundThreat
        && this.isSafeAiBoostWindow(queuedGroundThreat)
      ) {
        this.versusQueuedAiAction = null;
        if (this.ball?.boostLeft()) {
          this.versusHud?.showCallout('AI EVADES', 'Timed power bounce', 'gold', 440);
        }
        return;
      }
      if (ballState.isCatching) return;
      this.versusQueuedAiAction = null;
    }

    if (ballState.isCatching) return;
    this.versusAiDecisionTimer -= deltaTime;
    if (this.versusAiDecisionTimer > 0) return;
    this.versusAiDecisionTimer = (
      THREE.MathUtils.lerp(0.28, 0.16, difficulty)
      + THREE.MathUtils.randFloat(0.02, 0.08)
    ) * THREE.MathUtils.clamp(1 - this.versusAiStyle.reactionBonus * 3, 0.86, 1.1);

    const recoveryOpportunity = this.findVersusRecovery('left', 1.3);
    const recoveryThreat = this.findVersusGroundThreat('left', 1.3);
    if (
      recoveryOpportunity
      && recoveryThreat
      && this.versusAiRiskCards < this.versusMaximumRiskCards
      && this.isSafeAiBoostWindow(recoveryThreat)
    ) {
      const recoveryReadChance = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(0.82, 0.94, difficulty) + this.versusAiStyle.reactionBonus,
        0,
        0.99,
      );
      if (Math.random() < recoveryReadChance && this.ball?.boostLeft()) {
        this.versusHud?.showCallout('AI TAKES THE BAIT', 'Recovery power bounce', 'gold', 560);
      }
      return;
    }

    const threat = this.findVersusThreat('left', 1.55);
    const rightLaneSafe = this.findVersusThreat('right', 0.95) === null;
    if (threat) {
      const timeToContact = this.getTargetTimeToBall(threat);
      if (timeToContact > 0.25 && timeToContact < 1.22) {
        const isGroundThreat = threat.rootComponent.position.y < 0.9;
        const errorChance = THREE.MathUtils.lerp(0.1, 0.035, difficulty)
          * this.versusAiStyle.errorScale;
        if (Math.random() < errorChance) return;
        if (
          isGroundThreat
          && this.isSafeAiBoostWindow(threat)
          && (
            !rightLaneSafe
            || Math.random() < THREE.MathUtils.clamp(0.62 * this.versusAiStyle.boostBias, 0, 0.9)
          )
        ) {
          if (this.ball?.boostLeft()) {
            this.versusHud?.showCallout('AI POWER', 'Low hazard avoided', 'gold', 460);
          }
        } else if (isGroundThreat && rightLaneSafe) {
          if (this.ball?.transferToRight()) {
            this.beginVersusPass('player', false);
            this.versusHud?.showCallout(
              timeToContact < 0.5 ? 'QUICK PASS' : 'INCOMING',
              timeToContact < 0.5 ? 'AI escaped late' : 'AI passes to you',
              'danger',
              520,
            );
          }
        } else if (!isGroundThreat && this.shouldAiMisreadAirThreat(threat, difficulty)) {
          if (this.ball?.boostLeft()) {
            this.versusHud?.showCallout('AI COMMITS', 'Power bounce read', 'gold', 420);
          }
        }
        return;
      }
    }

    const playerTrapThreat = this.findVersusGroundThreat('right', 1.05);
    if (
      playerTrapThreat
      && this.versusTrickyPassCooldown <= 0
      && this.versusPossessionTime >= 0.45
    ) {
      const trapTime = this.getTargetTimeToBall(playerTrapThreat);
      const aiRiskDiscipline = this.versusAiRiskCards > 1
        ? 1
        : this.versusAiRiskCards === 1
          ? 0.48
          : 0.08;
      const trapChance = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(0.24, 0.42, difficulty)
          * aiRiskDiscipline
          * this.versusAiStyle.trapScale,
        0,
        0.72,
      );
      if (trapTime >= 0.48 && trapTime <= 0.78 && Math.random() < trapChance) {
        if (this.ball?.transferToRight()) {
          this.versusTrickyPassCooldown = THREE.MathUtils.randFloat(3.8, 5.4);
          this.beginVersusPass('player', false);
          this.versusHud?.showCallout('AI TRAP PASS', 'Return it during the catch window', 'danger', 720);
        }
        return;
      }
    }

    const pressureThreshold = THREE.MathUtils.lerp(2.45, 1.72, difficulty)
      * this.versusAiStyle.patienceScale;
    if (this.versusPossessionTime >= pressureThreshold && rightLaneSafe) {
      if (this.ball?.transferToRight()) {
        this.beginVersusPass('player', false);
        this.versusHud?.showCallout('INCOMING', 'Pressure pass', 'danger', 520);
      }
    }
  }

  private beginVersusPass(
    receiver: VersusOwner,
    immediateReturn: boolean,
  ): void {
    const receiverSide: DribbleSide = receiver === 'ai' ? 'left' : 'right';
    const passer: VersusOwner = receiver === 'ai' ? 'player' : 'ai';
    const dangerPass = this.findVersusGroundThreat(
      receiverSide,
      DribbleBall.transferDuration + 0.62,
    ) !== null;
    this.versusReturnLockedOwner = immediateReturn ? receiver : null;
    this.versusCurrentRally += 1;
    this.versusLongestRally = Math.max(this.versusLongestRally, this.versusCurrentRally);
    this.updateCourtChallenge('rally', this.versusCurrentRally);
    if (receiver === 'ai') this.versusPlayerReturns += 1;
    else this.versusAiReturns += 1;
    if (dangerPass) this.versusDangerPasses += 1;

    const riskCardsRemaining = dangerPass
      ? this.spendVersusRiskCard(passer)
      : null;
    if (!this.versusRoundActive) return;
    if (dangerPass && this.tutorialActive) this.recordTutorialEvent('risk-pass');
    if (receiver === 'ai') this.queueVersusAiReception(dangerPass);
    if (!dangerPass) return;
    this.versusHud?.showCallout(
      riskCardsRemaining === 0 ? 'FINAL WARNING' : 'RISK PASS',
      riskCardsRemaining === 0
        ? `${passer === 'player' ? 'Your' : 'AI'} next danger pass loses the round`
        : `${riskCardsRemaining} risk card${riskCardsRemaining === 1 ? '' : 's'} left - receiver can return`,
      'danger',
      riskCardsRemaining === 0 ? 1100 : 820,
    );
    void this.getWorld()?.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
      volume: 0.48,
      bus: 'SFX',
    });
  }

  private queueVersusAiReception(dangerPass: boolean): void {
    this.versusQueuedAiAction = null;
    this.versusQueuedAiActionTimer = 0;
    const threat = this.findVersusThreat(
      'left',
      DribbleBall.transferDuration + DribbleBall.catchDuration + 0.75,
    );
    if (!threat) return;
    const isGroundThreat = threat.rootComponent.position.y < 0.9;
    if (!isGroundThreat) return;
    const difficulty = THREE.MathUtils.clamp(this.elapsedTime / 75, 0, 1);
    const reactionChance = THREE.MathUtils.clamp((dangerPass
      ? THREE.MathUtils.lerp(0.96, 0.995, difficulty)
      : THREE.MathUtils.lerp(0.82, 0.94, difficulty))
      + this.versusAiStyle.reactionBonus, 0, 0.998);
    if (Math.random() >= reactionChance) return;
    const contactAfterReception = this.getTargetTimeToBall(threat) - DribbleBall.transferDuration;
    const canReturn = this.versusReturnLockedOwner !== 'ai';
    const needsImmediateReturn = dangerPass
      || contactAfterReception < DribbleBall.catchDuration + 0.82;
    this.versusQueuedAiAction = canReturn && needsImmediateReturn ? 'return' : 'boost';
    this.versusQueuedAiActionTimer = this.versusQueuedAiAction === 'return'
      ? THREE.MathUtils.lerp(0.09, 0.045, difficulty) + THREE.MathUtils.randFloat(0.01, 0.045)
      : THREE.MathUtils.lerp(0.12, 0.07, difficulty) + THREE.MathUtils.randFloat(0.01, 0.04);
  }

  private isSafeAiBoostWindow(target: DribbleTarget): boolean {
    if (target.rootComponent.position.y >= 0.9) return false;
    const timeToContact = this.getTargetTimeToBall(target);
    if (timeToContact <= 0.2 || timeToContact > 1.18) return false;
    if (timeToContact <= DribbleBall.boostDuration) {
      const boostProgress = timeToContact / DribbleBall.boostDuration;
      if (boostProgress < 0.18) return false;
      const arcProgress = (boostProgress - 0.18) / 0.82;
      const clearance = Math.pow(Math.sin(arcProgress * Math.PI), 0.88);
      return clearance >= 0.48;
    }

    const resumedBouncePhase = (timeToContact - DribbleBall.boostDuration) * 5.8;
    return Math.abs(Math.sin(resumedBouncePhase)) >= 0.58;
  }

  private shouldAiMisreadAirThreat(target: DribbleTarget, difficulty: number): boolean {
    if (this.versusLastEvaluatedAirThreat === target) return false;
    this.versusLastEvaluatedAirThreat = target;
    const mistakeChance = THREE.MathUtils.lerp(0.09, 0.045, difficulty)
      * this.versusAiStyle.errorScale;
    return Math.random() < mistakeChance;
  }

  private spendVersusRiskCard(owner: VersusOwner): number {
    const cards = owner === 'player' ? this.versusPlayerRiskCards : this.versusAiRiskCards;
    if (cards <= 0) {
      this.resolveVersusRoundLoss(
        this.ball?.getState().position ?? new THREE.Vector3(),
        owner,
        'risk',
      );
      return 0;
    }

    const remaining = cards - 1;
    if (owner === 'player') this.versusPlayerRiskCards = remaining;
    else this.versusAiRiskCards = remaining;
    if (remaining === 0) {
      this.versusRecoveryCooldown = Math.min(this.versusRecoveryCooldown, 2.5);
    }
    this.syncVersusHud();
    return remaining;
  }

  private restoreVersusRiskCard(owner: VersusOwner, position: THREE.Vector3): void {
    const current = owner === 'player' ? this.versusPlayerRiskCards : this.versusAiRiskCards;
    if (current >= this.versusMaximumRiskCards) return;
    const restored = current + 1;
    if (owner === 'player') this.versusPlayerRiskCards = restored;
    else this.versusAiRiskCards = restored;
    this.spawnImpactBurst(position, 0x4de6b8);
    this.versusHud?.showCallout(
      owner === 'player' ? 'RISK CARD RESTORED' : 'AI RECOVERS',
      `${restored} of ${this.versusMaximumRiskCards} cards ready`,
      'recovery',
      920,
    );
    this.syncVersusHud();
    void this.getWorld()?.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
      volume: 0.58,
      bus: 'SFX',
    });
  }

  private trySpawnVersusRecoveryGate(difficulty: number): boolean {
    const world = this.getWorld();
    if (!world || this.versusRecoveryCooldown > 0 || this.activeTargets.length > 7) return false;
    if (this.activeTargets.some(target => target.kind === 'recovery')) return false;
    const rearmostTarget = this.activeTargets[this.activeTargets.length - 1] ?? null;
    const entryGap = rearmostTarget
      ? rearmostTarget.rootComponent.position.z - this.targetSpawnZ
      : Number.POSITIVE_INFINITY;
    if (entryGap < this.minimumTargetGap + 0.25) return false;
    const depletedOwners: VersusOwner[] = [];
    if (this.versusPlayerRiskCards < this.versusMaximumRiskCards) depletedOwners.push('player');
    if (this.versusAiRiskCards < this.versusMaximumRiskCards) depletedOwners.push('ai');
    if (depletedOwners.length === 0) return false;

    const preferredOwner = depletedOwners.includes(this.versusOwner) && Math.random() < 0.72
      ? this.versusOwner
      : depletedOwners[Math.floor(Math.random() * depletedOwners.length)];
    const laneX = preferredOwner === 'ai' ? this.lanes[0] : this.lanes[2];
    const speed = THREE.MathUtils.lerp(4.45, 7.15, difficulty);
    const spacingGroup = `versus-recovery-${this.versusRecoveryGateSequence}`;
    this.versusRecoveryGateSequence += 1;
    const recovery = DribbleTarget.create({
      name: 'Last Bounce Recovery Card',
      kind: 'recovery',
      laneX,
      speed,
      spacingGroup,
      position: new THREE.Vector3(laneX, 2.45, this.targetSpawnZ),
      actorTags: ['versus-recovery-card'],
    });
    const hazard = DribbleTarget.create({
      name: 'Last Bounce Recovery Gate Hazard',
      kind: 'hazard',
      laneX,
      speed,
      spacingGroup,
      position: new THREE.Vector3(laneX, 0.3, this.targetSpawnZ),
      actorTags: ['versus-ground-hazard', 'versus-recovery-gate'],
    });
    world.addActor(recovery);
    world.addActor(hazard);
    this.activeTargets.push(recovery, hazard);
    this.targetPaceScales.set(recovery, 1);
    this.targetPaceScales.set(hazard, 1);
    const urgent = preferredOwner === 'player'
      ? this.versusPlayerRiskCards === 0
      : this.versusAiRiskCards === 0;
    this.versusRecoveryCooldown = THREE.MathUtils.randFloat(
      urgent ? 6.5 : 9,
      urgent ? 8.5 : 12,
    );
    this.versusHud?.showCallout(
      preferredOwner === 'player' ? 'RECOVERY GATE' : 'AI RECOVERY GATE',
      preferredOwner === 'player'
        ? 'Power bounce through green to restore a Risk Card'
        : 'The AI can power bounce to recover',
      'recovery',
      1100,
    );
    void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
      volume: 0.28,
      bus: 'SFX',
    });
    return true;
  }

  private spawnVersusHazard(difficulty: number): boolean {
    const world = this.getWorld();
    if (!world) return false;
    if (this.activeTargets.length >= 9) return false;
    const rearmostTarget = this.activeTargets[this.activeTargets.length - 1] ?? null;
    const entryGap = rearmostTarget
      ? rearmostTarget.rootComponent.position.z - this.targetSpawnZ
      : Number.POSITIVE_INFINITY;
    if (entryGap < this.minimumTargetGap + 0.25) return false;

    this.versusSpawnCount += 1;
    const holderLane = this.versusOwner === 'ai' ? this.lanes[0] : this.lanes[2];
    const opposingLane = this.versusOwner === 'ai' ? this.lanes[2] : this.lanes[0];
    const holderPressureChance = THREE.MathUtils.lerp(0.68, 0.82, difficulty);
    const laneX = Math.random() < holderPressureChance ? holderLane : opposingLane;
    const forceHigh = this.versusSpawnCount % 7 === 0;
    const high = forceHigh || Math.random() < THREE.MathUtils.lerp(0.1, 0.16, difficulty);
    const speed = THREE.MathUtils.lerp(4.45, 7.15, difficulty);
    const target = DribbleTarget.create({
      name: high ? 'Last Bounce Air Hazard' : 'Last Bounce Ground Hazard',
      kind: 'hazard',
      laneX,
      speed,
      position: new THREE.Vector3(laneX, high ? 2.45 : 0.3, this.targetSpawnZ),
      actorTags: [high ? 'versus-air-hazard' : 'versus-ground-hazard'],
    });
    world.addActor(target);
    this.activeTargets.push(target);
    this.targetPaceScales.set(target, high ? 0.96 : 1.05);
    return true;
  }

  private updateVersusPressureFeedback(pressure: number): void {
    const nextStage = pressure >= 1 ? 2 : pressure >= 0.68 ? 1 : 0;
    if (nextStage <= this.versusPressureWarningStage) return;
    this.versusPressureWarningStage = nextStage;
    const world = this.getWorld();
    if (nextStage === 2) {
      this.versusHud?.showCallout(
        'MAX PRESSURE',
        `${this.versusOwner === 'player' ? 'Your' : 'AI'} lane is in overdrive`,
        'danger',
        760,
      );
      if (world) {
        void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
          volume: 0.52,
          bus: 'SFX',
        });
      }
      return;
    }
    this.versusHud?.showCallout(
      'LANE HEATING UP',
      'Hazards are accelerating',
      'gold',
      620,
    );
    if (world) {
      void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
        volume: 0.25,
        bus: 'SFX',
      });
    }
  }

  private findVersusThreat(side: DribbleSide, maximumTime: number): DribbleTarget | null {
    const laneX = side === 'left' ? this.lanes[0] : this.lanes[2];
    let nearest: DribbleTarget | null = null;
    let nearestTime = Number.POSITIVE_INFINITY;
    for (const target of this.activeTargets) {
      if (target.kind !== 'hazard' || Math.abs(target.laneX - laneX) > 0.05) continue;
      const time = this.getTargetTimeToBall(target);
      if (time >= 0 && time <= maximumTime && time < nearestTime) {
        nearest = target;
        nearestTime = time;
      }
    }
    return nearest;
  }

  private findVersusGroundThreat(side: DribbleSide, maximumTime: number): DribbleTarget | null {
    const laneX = side === 'left' ? this.lanes[0] : this.lanes[2];
    let nearest: DribbleTarget | null = null;
    let nearestTime = Number.POSITIVE_INFINITY;
    for (const target of this.activeTargets) {
      if (
        target.kind !== 'hazard'
        || target.rootComponent.position.y >= 0.9
        || Math.abs(target.laneX - laneX) > 0.05
      ) continue;
      const time = this.getTargetTimeToBall(target);
      if (time >= 0 && time <= maximumTime && time < nearestTime) {
        nearest = target;
        nearestTime = time;
      }
    }
    return nearest;
  }

  private findVersusRecovery(side: DribbleSide, maximumTime: number): DribbleTarget | null {
    const laneX = side === 'left' ? this.lanes[0] : this.lanes[2];
    let nearest: DribbleTarget | null = null;
    let nearestTime = Number.POSITIVE_INFINITY;
    for (const target of this.activeTargets) {
      if (target.kind !== 'recovery' || Math.abs(target.laneX - laneX) > 0.05) continue;
      const time = this.getTargetTimeToBall(target);
      if (time >= 0 && time <= maximumTime && time < nearestTime) {
        nearest = target;
        nearestTime = time;
      }
    }
    return nearest;
  }

  private getTargetTimeToBall(target: DribbleTarget): number {
    const ballZ = this.ball?.getState().position.z ?? -1.2;
    return (ballZ - target.rootComponent.position.z)
      / Math.max(0.01, target.getApproachSpeed());
  }

  private resolveVersusRoundLoss(
    position: THREE.Vector3,
    forcedLoser: VersusOwner = this.versusOwner,
    reason: 'ground' | 'air' | 'risk' = 'ground',
  ): void {
    if (!this.versusRoundActive) return;
    const loser = forcedLoser;
    if (loser === 'player') this.versusPlayerLosses += 1;
    else this.versusAiLosses += 1;
    this.versusRoundActive = false;
    this.versusRoundResetTimer = 1.85;
    this.ball?.setGameplayActive(false);
    for (const target of this.activeTargets) target.setGameplayActive(false);
    this.spawnImpactBurst(position, 0xff453a);
    this.versusHud?.showCallout(
      reason === 'risk'
        ? loser === 'player' ? 'DISQUALIFIED' : 'AI DISQUALIFIED'
        : loser === 'player' ? 'ROUND LOST' : 'ROUND WON',
      reason === 'risk'
        ? 'No Risk Cards remained'
        : `${reason === 'air' ? 'Air' : 'Ground'} hazard hit ${loser === 'player' ? 'your ball' : `${this.versusAiStyle.name}'s ball`}`,
      loser === 'player' ? 'danger' : 'blue',
      1350,
    );
    this.syncVersusHud();
    void this.getWorld()?.globalAudioManager.playGlobalSound('@engine/assets/sounds/explosion.mp3', {
      volume: 0.56,
      bus: 'SFX',
    });
  }

  private endVersusMatch(): void {
    const world = this.getWorld();
    if (!world) return;
    const playerWon = this.versusAiLosses >= this.versusLossesToEndMatch;
    this.gameState = 'gameOver';
    this.musicDirector?.setPaused(true);
    this.setGameplayActive(false);
    this.setHudVisible(false);
    this.overlay?.showVersusGameOver(
      playerWon,
      this.versusPlayerLosses,
      this.versusAiLosses,
      this.createVersusSummary(),
    );
    world.inputManager.exitPointerLock();
  }

  private syncVersusHud(ballState = this.ball?.getState()): void {
    this.versusHud?.setMatchState(
      this.versusOwner,
      this.versusRound,
      this.versusPlayerLosses,
      this.versusAiLosses,
      this.versusPossessionTime / this.versusPressureDuration,
      ballState?.isTransferring ?? false,
      ballState?.isCatching ?? false,
      this.versusReturnLockedOwner === this.versusOwner,
      this.versusPlayerRiskCards,
      this.versusAiRiskCards,
    );
  }

  private getPatternLaneX(lane: PatternLane): number {
    if (lane === 'left') return this.lanes[0];
    if (lane === 'right') return this.lanes[2];
    return this.lanes[1];
  }

  private tryStartCenterRhythm(existingTargets: DribbleTarget[]): void {
    if (
      this.centerRhythmSpawnsRemaining > 0
      || this.patternDirector.isActive()
      || this.centerRhythmCooldown > 0
      || this.frenzyTimeRemaining > 0
      || this.elapsedTime < 14
      || existingTargets.length > 3
    ) {
      return;
    }

    this.centerRhythmOpportunityCount += 1;
    const startChance = Math.min(0.4, 0.075 + this.centerRhythmOpportunityCount * 0.04);
    if (this.centerRhythmOpportunityCount < 8 && Math.random() >= startChance) {
      return;
    }

    this.centerRhythmSpawnsRemaining = this.centerRhythmLength;
    this.centerRhythmNextKind = 'score';
    this.centerRhythmOpportunityCount = 0;
    this.spawnsSinceHazard = 0;
    this.consecutiveHazards = 0;
    this.juiceHud?.showPraise('CENTER RHYTHM!', 'gold');
    const world = this.getWorld();
    if (world) {
      void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
        volume: 0.34,
        bus: 'SFX',
      });
    }
  }

  private updateTargetSpacing(
    targets: DribbleTarget[],
    deltaTime: number,
    difficulty: number,
    options?: {
      basePace?: number;
      pressureLaneX?: number;
      pressure?: number;
    },
  ): void {
    const targetPace = options?.basePace ?? this.getTargetPace(difficulty);
    const accelerationBlend = 1 - Math.exp(-deltaTime * 1.65);
    const frontTarget = targets[0];
    if (frontTarget) {
      const pressureMultiplier = this.getTargetPressureMultiplier(frontTarget, options);
      const desiredSpeed = targetPace
        * (this.targetPaceScales.get(frontTarget) ?? 1)
        * pressureMultiplier;
      const paceBlend = desiredSpeed < frontTarget.speed
        ? 1 - Math.exp(-deltaTime * 5)
        : accelerationBlend;
      frontTarget.speed = THREE.MathUtils.lerp(frontTarget.speed, desiredSpeed, paceBlend);
      frontTarget.setPressureLevel((pressureMultiplier - 1) / 0.3);
      frontTarget.setSpacingSpeedLimit(null);
    }

    for (let index = 1; index < targets.length; index += 1) {
      const leader = targets[index - 1];
      const follower = targets[index];
      if (
        leader.spacingGroup !== null
        && leader.spacingGroup === follower.spacingGroup
      ) {
        follower.speed = leader.speed;
        follower.setPressureLevel(0);
        follower.setSpacingSpeedLimit(null);
        continue;
      }
      const pressureMultiplier = this.getTargetPressureMultiplier(follower, options);
      const desiredSpeed = targetPace
        * (this.targetPaceScales.get(follower) ?? 1)
        * pressureMultiplier;
      const paceBlend = desiredSpeed < follower.speed
        ? 1 - Math.exp(-deltaTime * 5)
        : accelerationBlend;
      follower.speed = THREE.MathUtils.lerp(follower.speed, desiredSpeed, paceBlend);
      follower.setPressureLevel((pressureMultiplier - 1) / 0.3);
      const gap = leader.rootComponent.position.z - follower.rootComponent.position.z;
      if (gap >= this.comfortableTargetGap) {
        follower.setSpacingSpeedLimit(null);
        continue;
      }

      const spacingBlend = THREE.MathUtils.smoothstep(
        gap,
        this.minimumTargetGap,
        this.comfortableTargetGap,
      );
      const leaderSpeed = leader.getApproachSpeed();
      follower.setSpacingSpeedLimit(
        THREE.MathUtils.lerp(leaderSpeed * 0.78, leaderSpeed, spacingBlend),
      );
    }
  }

  private getTargetPressureMultiplier(
    target: DribbleTarget,
    options?: {
      pressureLaneX?: number;
      pressure?: number;
    },
  ): number {
    const pressure = options?.pressure ?? 0;
    const pressureLaneX = options?.pressureLaneX;
    if (
      pressureLaneX === undefined
      || pressure <= 0.5
      || Math.abs(target.laneX - pressureLaneX) > 0.05
    ) {
      return 1;
    }
    const pressureRamp = THREE.MathUtils.smoothstep(pressure, 0.5, 1);
    const fairDistanceRamp = 1 - THREE.MathUtils.smoothstep(
      target.rootComponent.position.z,
      -7,
      -4.25,
    );
    return 1 + pressureRamp * fairDistanceRamp * 0.3;
  }

  private getDifficultyRamp(): number {
    return THREE.MathUtils.clamp(
      (this.elapsedTime - this.difficultyRampStart) / this.difficultyRampDuration,
      0,
      1,
    );
  }

  private getTargetPace(difficulty: number): number {
    const stageBoost = this.getDifficultyStage() * this.speedStageBoost;
    const modeScale = this.gameMode === 'hard' ? 1.05 : 1;
    return (4.15 + difficulty * 3.9 + stageBoost) * modeScale;
  }

  private getDifficultyStage(): number {
    if (this.elapsedTime < this.speedStageStart) return 0;
    return Math.min(
      this.maximumSpeedStage,
      Math.floor((this.elapsedTime - this.speedStageStart) / this.speedStageInterval) + 1,
    );
  }

  private updateDifficultyStage(): void {
    const stage = this.getDifficultyStage();
    if (stage <= this.difficultyStage) return;
    this.difficultyStage = stage;
    this.juiceHud?.showPraise('SPEED UP!', 'gold');
    const world = this.getWorld();
    if (world) {
      void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
        volume: 0.2,
        bus: 'SFX',
      });
    }
  }

  private updateAdaptiveIntensityFeedback(): void {
    const tier = this.difficultyDirector.takeTierChange();
    if (!tier || tier === 'warmup') return;
    const presentation: Record<Exclude<DribbleIntensityTier, 'warmup'>, string> = {
      flow: 'FLOW STATE',
      heat: 'COURT HEATING UP',
      overdrive: 'OVERDRIVE',
    };
    this.juiceHud?.showPraise(presentation[tier], 'gold');
  }

  private selectTargetKind(difficulty: number): TargetKind {
    if (this.frenzyTimeRemaining > 0) {
      return Math.random() < 0.01 ? 'bonus' : 'score';
    }

    if (Math.random() < 0.02) {
      return 'bonus';
    }

    const safeSpawnLimit = difficulty < 0.18 ? 4 : 3;
    const hazardDue = this.spawnsSinceHazard >= safeSpawnLimit;
    const canSpawnHazard = this.consecutiveHazards < 3;
    if (hazardDue && canSpawnHazard) {
      return 'hazard';
    }

    const healthChance = this.lives < this.maxLives ? 0.09 : 0;
    const hazardChance = canSpawnHazard
      ? THREE.MathUtils.lerp(0.64, 0.72, difficulty)
      : 0;
    const roll = Math.random();
    if (roll < healthChance) {
      return 'health';
    }
    if (roll < healthChance + hazardChance) {
      return 'hazard';
    }
    return 'score';
  }

  private recordSpawnKind(kind: TargetKind): void {
    if (this.frenzyTimeRemaining > 0) {
      this.spawnsSinceHazard = 0;
      this.consecutiveHazards = 0;
      return;
    }
    if (kind === 'hazard') {
      this.spawnsSinceHazard = 0;
      this.consecutiveHazards += 1;
      return;
    }
    this.spawnsSinceHazard += 1;
    this.consecutiveHazards = 0;
  }

  private updateTimingMeter(ballState: DribbleBallState, targets: DribbleTarget[]): void {
    if (!this.timingMeter) {
      return;
    }

    const transferToCenterTime = DribbleBall.transferDuration * 0.5;
    const centerBounceZ = -1.85;
    const timingTolerance = 0.48;
    const trackingSpan = 4;
    let candidate: number | null = null;
    let candidateMagnitude = Number.POSITIVE_INFINITY;
    for (const target of targets) {
      if (target.kind !== 'score' || Math.abs(target.laneX) > 0.01) continue;
      const switchZ = centerBounceZ - target.getApproachSpeed() * transferToCenterTime;
      const error = target.rootComponent.position.z - switchZ;
      const magnitude = Math.abs(error);
      if (magnitude <= trackingSpan && magnitude < candidateMagnitude) {
        candidate = error;
        candidateMagnitude = magnitude;
      }
    }

    if (candidate === null) {
      this.timingCandidateError = null;
      this.timingReady = false;
      this.timingMeter.setTiming(0, false, false, false);
      return;
    }

    const progress = 0.5 + candidate / (trackingSpan * 2);
    const ready = !ballState.isTransferring && !ballState.isBoosting && Math.abs(candidate) <= timingTolerance;
    const perfect = ready && Math.abs(candidate) <= 0.18;
    this.timingCandidateError = candidate;
    this.timingReady = ready;
    this.timingMeter.setTiming(progress, true, ready, perfect);
  }

  private registerCenterSwitchTiming(): void {
    const perfectTolerance = 0.18;
    if (
      !this.timingReady
      || this.timingCandidateError === null
      || Math.abs(this.timingCandidateError) > perfectTolerance
    ) {
      return;
    }
    this.pendingPerfectSwitchUntil = this.elapsedTime + 1.2;
    this.juiceHud?.showPraise('PERFECT RELEASE!', 'gold');
    void this.getWorld()?.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
      volume: 0.24,
      bus: 'SFX',
    });
  }

  private checkBallTargetHits(ballState: DribbleBallState, targets: DribbleTarget[]): void {
    if (
      this.gameMode === 'last-bounce'
      && (ballState.isTransferring || ballState.isCatching)
    ) {
      return;
    }
    for (const target of targets) {
      const targetPosition = target.rootComponent.position;
      if (ballState.isBoosting) {
        const boostCollisionRadius = target.radius * 0.9 + ballState.radius * 0.65;
        if (targetPosition.distanceToSquared(ballState.position) > boostCollisionRadius ** 2) {
          continue;
        }
      } else {
        const depthDistance = Math.abs(targetPosition.z - ballState.position.z);
        if (depthDistance > 0.48) {
          continue;
        }

        const lateralRadius = target.radius + ballState.radius * 0.8;
        const verticalRadius = target.radius + ballState.radius * 0.85;
        const normalizedX = (targetPosition.x - ballState.position.x) / lateralRadius;
        const normalizedY = (targetPosition.y - ballState.position.y) / verticalRadius;
        if (normalizedX * normalizedX + normalizedY * normalizedY > 1) {
          continue;
        }
      }

      if (!target.consumeHit()) {
        continue;
      }

      this.targetHitPosition.copy(targetPosition);
      if (this.tutorialActive) {
        this.handleTutorialTargetHit(target, this.targetHitPosition);
        if (target === this.tutorialTarget) this.tutorialTarget = null;
        target.destroy();
        continue;
      }
      if (target.kind === 'score') {
        this.handleScoreHit(
          this.targetHitPosition,
          target.isRhythmTarget,
          Math.abs(target.laneX) < 0.01,
        );
      } else if (target.kind === 'bonus') {
        const spawnSwitchCount = this.targetSpawnSwitchCounts.get(target);
        this.handleBonusHit(
          this.targetHitPosition,
          spawnSwitchCount !== undefined && spawnSwitchCount === this.laneSwitchCount,
        );
      } else if (target.kind === 'health') {
        this.handleHealthHit(this.targetHitPosition);
      } else if (target.kind === 'recovery') {
        if (this.gameMode === 'last-bounce') {
          const recoveryOwner: VersusOwner = target.laneX < 0 ? 'ai' : 'player';
          this.restoreVersusRiskCard(recoveryOwner, this.targetHitPosition);
        }
      } else {
        if (this.gameMode === 'last-bounce') {
          this.resolveVersusRoundLoss(
            this.targetHitPosition,
            this.versusOwner,
            target.rootComponent.position.y >= 0.9 ? 'air' : 'ground',
          );
        } else {
          this.handleHazardHit(this.targetHitPosition);
        }
      }
      target.destroy();

      if (this.gameState === 'gameOver') {
        break;
      }
    }
  }

  private handleScoreHit(
    position: THREE.Vector3,
    rhythmTarget: boolean,
    centerTarget: boolean,
  ): void {
    const perfect = centerTarget && this.elapsedTime <= this.pendingPerfectSwitchUntil;
    if (centerTarget) this.pendingPerfectSwitchUntil = 0;
    this.handleGoodHit(position, rhythmTarget ? 15 : 10, false, rhythmTarget, perfect ? 25 : 0);
    if (perfect) {
      this.perfectSwitches += 1;
      this.juiceHud?.showPraise('PERFECT +25', 'gold');
    }
  }

  private handleBonusHit(position: THREE.Vector3, collectedWithoutSwitching: boolean): void {
    if (collectedWithoutSwitching) {
      this.unlockAchievementAndSync('starWithoutSwitching');
    }
    this.progression = awardStars(this.progression, 1);
    this.runStarsEarned += 1;
    this.mainMenu?.setProgression(this.progression);
    this.updateScoreStarCounter();
    this.handleGoodHit(position, 50, true, false);
  }

  private awardScoreMilestoneStars(): number {
    let awarded = 0;
    while (this.score >= this.nextMilestoneScore) {
      awarded += 1;
      this.nextMilestoneScore += 2500;
    }
    if (awarded === 0) return 0;
    this.progression = awardStars(this.progression, awarded);
    this.runStarsEarned += awarded;
    this.mainMenu?.setProgression(this.progression);
    this.updateScoreStarCounter();
    return awarded;
  }

  private handleGoodHit(
    position: THREE.Vector3,
    basePoints: number,
    bonus: boolean,
    rhythmTarget: boolean,
    timingBonus = 0,
  ): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }

    this.combo = Math.min(this.combo + 1, 12);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.goodHits += 1;
    this.difficultyDirector.recordSuccess(timingBonus > 0);
    if (this.frenzyTimeRemaining <= 0) {
      this.frenzyCharge += 1;
    }
    const points = basePoints * this.combo + timingBonus;
    this.score += points;
    this.updateCourtChallenge('score', this.score);
    const milestoneAwarded = this.awardScoreMilestoneStars();
    const brokeHighScore = this.checkForNewHighScore();
    if (this.score >= 10000) this.unlockAchievementAndSync('score10000');
    this.scoreDisplay?.setValue(this.score, true);
    this.spawnComboPopup();
    this.spawnImpactBurst(
      position,
      0xffca3a,
    );
    if (this.frenzyCharge >= this.frenzyHitsRequired && this.frenzyTimeRemaining <= 0) {
      this.activateFrenzy();
    } else if (milestoneAwarded) {
      this.juiceHud?.showPraise(`MILESTONE STAR +${milestoneAwarded}!`, 'gold');
    } else if (bonus) {
      this.juiceHud?.showPraise('STAR +1!', 'gold');
    } else if (rhythmTarget) {
      this.juiceHud?.showPraise('ON BEAT!', 'gold');
    } else {
      this.showScorePraise();
    }
    if (brokeHighScore) {
      this.juiceHud?.showPraise('NEW HIGH SCORE!', 'gold');
    }
    void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
      volume: bonus ? 0.86 : 0.62,
      bus: 'SFX',
    });
  }

  private handleHazardHit(position: THREE.Vector3): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }

    this.lives = Math.max(0, this.lives - 1);
    this.combo = 0;
    this.frenzyCharge = 0;
    this.difficultyDirector.recordFailure(true);
    this.livesDisplay?.setLives(this.lives);
    this.spawnImpactBurst(position, 0xff453a);
    void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/explosion.mp3', {
      volume: 0.48,
      bus: 'SFX',
    });

    if (this.lives <= 0) {
      this.endRun();
    }
  }

  private handleHealthHit(position: THREE.Vector3): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }

    this.lives = Math.min(this.maxLives, this.lives + 1);
    this.livesDisplay?.setLives(this.lives);
    this.spawnImpactBurst(position, 0x4de6b8);
    void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
      volume: 0.78,
      bus: 'SFX',
    });
  }

  private spawnImpactBurst(position: THREE.Vector3, color: THREE.ColorRepresentation): void {
    const burst = this.impactBursts[this.impactBurstCursor];
    if (!burst) {
      return;
    }
    this.impactBurstCursor = (this.impactBurstCursor + 1) % this.impactBursts.length;
    burst.play(position, color);
  }

  private spawnComboPopup(): void {
    const ballState = this.ball?.getState();
    const popup = this.comboPopups[this.comboPopupCursor];
    if (!ballState || !popup || this.combo < 2) {
      return;
    }
    this.comboPopupCursor = (this.comboPopupCursor + 1) % this.comboPopups.length;
    this.comboPopupPosition.copy(ballState.position).y += 0.16;
    popup.play(
      this.comboPopupPosition,
      `COMBO x${this.combo}`,
      this.combo >= 5 ? '#ffca3a' : '#65e6a8',
    );
  }

  private activateFrenzy(): void {
    const world = this.getWorld();
    this.centerRhythmSpawnsRemaining = 0;
    this.centerRhythmNextKind = 'score';
    this.centerRhythmCooldown = Math.max(this.centerRhythmCooldown, 14);
    this.centerRhythmOpportunityCount = 0;
    this.patternDirector.cancel();
    this.frenzyCharge = 0;
    this.frenzyTimeRemaining = this.frenzyDuration;
    this.ball?.setFrenzyActive(true);
    this.juiceHud?.setFrenzy(1, this.frenzyTimeRemaining, true);
    this.juiceHud?.showPraise('FRENZY!', 'gold');
    if (world) {
      void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
        volume: 0.9,
        bus: 'SFX',
      });
      void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
        volume: 0.5,
        bus: 'SFX',
      });
    }
  }

  private updateFrenzy(deltaTime: number): void {
    if (this.frenzyTimeRemaining <= 0) {
      return;
    }
    this.frenzyTimeRemaining = Math.max(0, this.frenzyTimeRemaining - deltaTime);
    const active = this.frenzyTimeRemaining > 0;
    this.juiceHud?.setFrenzy(
      this.frenzyTimeRemaining / this.frenzyDuration,
      this.frenzyTimeRemaining,
      active,
    );
    if (!active) {
      this.ball?.setFrenzyActive(false);
    }
  }

  private showScorePraise(): void {
    const praise = this.combo >= 5
      ? ['WOW!', 'UNREAL!', 'PERFECT!']
      : ['NICE!', 'COOL!', 'SWEET!', 'GREAT!'];
    const label = praise[Math.floor(Math.random() * praise.length)];
    this.juiceHud?.showPraise(label, 'gold');
  }

  private applyMasterVolume(volume: number): void {
    this.getWorld()?.globalAudioManager.getBus('Master')?.setVolume(volume);
  }

  private applyMusicVolume(volume: number): void {
    this.musicDirector?.setVolume(volume);
  }

  private applySfxVolume(volume: number): void {
    this.getWorld()?.globalAudioManager.getBus('SFX')?.setVolume(volume);
  }

  private applyReducedMotion(enabled: boolean): void {
    const container = this.getWorld()?.gameContainer;
    if (container) container.dataset.reducedMotion = enabled ? 'true' : 'false';
    try {
      localStorage.setItem(reducedMotionKey, String(enabled));
    } catch {
      // The current session still uses the selected accessibility preference.
    }
  }

  private applyReducedFlashes(enabled: boolean): void {
    const container = this.getWorld()?.gameContainer;
    if (container) container.dataset.reducedFlashes = enabled ? 'true' : 'false';
    try {
      localStorage.setItem(reducedFlashesKey, String(enabled));
    } catch {
      // The current session still uses the selected accessibility preference.
    }
  }

  private applyHighContrastTargets(enabled: boolean): void {
    DribbleTarget.setHighContrastEnabled(enabled);
    for (const target of this.activeTargets) target.applyAccessibilityPalette();
    const container = this.getWorld()?.gameContainer;
    if (container) container.dataset.highContrastTargets = enabled ? 'true' : 'false';
    try {
      localStorage.setItem(highContrastTargetsKey, String(enabled));
    } catch {
      // The current session still uses the selected accessibility preference.
    }
  }

  private updateCourtChallenge(metric: CourtChallengeMetric, value: number): void {
    const wasComplete = this.progression.courtChallengeCompleted;
    const nextProgression = recordCourtChallengeProgress(this.progression, metric, value);
    if (nextProgression === this.progression) return;
    this.progression = nextProgression;
    this.mainMenu?.setProgression(this.progression);
    this.updateScoreStarCounter();
    if (!wasComplete && this.progression.courtChallengeCompleted) {
      this.juiceHud?.showPraise('COURT CHALLENGE +1 STAR', 'gold');
      const world = this.getWorld();
      if (world) {
        void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
          volume: 0.78,
          bus: 'SFX',
        });
      }
    }
  }

  private updateTutorial(deltaTime: number): void {
    this.tutorialDirector.update(deltaTime);
    if (this.tutorialTransitionPending) {
      this.tutorialTransitionTimer = Math.max(0, this.tutorialTransitionTimer - deltaTime);
      if (this.tutorialTransitionTimer <= 0) {
        this.tutorialTransitionPending = false;
        this.syncTutorialLesson();
      }
    } else {
      this.syncTutorialLesson();
    }
    if (this.tutorialMode === 'last-bounce') {
      if (!this.tutorialTransitionPending) this.updateLastBounceTutorial(deltaTime);
      this.syncVersusHud();
    }
    if (
      this.tutorialTransitionPending
      || this.tutorialDirector.isComplete()
      || this.tutorialTarget
    ) return;

    const request = this.tutorialDirector.takeSpawnRequest();
    const ballState = this.ball?.getState();
    const world = this.getWorld();
    if (!request || !ballState || !world) return;

    const lane = this.tutorialDirector.resolveLane(request.lane, ballState.side);
    const laneX = lane === 'center' ? this.lanes[1] : lane === 'left' ? this.lanes[0] : this.lanes[2];
    const y = request.height === 'high' ? 2.45 : request.height === 'low' ? 0.3 : 0.52;
    const target = DribbleTarget.create({
      name: `Tutorial ${request.kind} Target`,
      kind: request.kind,
      laneX,
      speed: request.rhythmTarget ? 3.15 : 3.35,
      rhythmTarget: request.rhythmTarget ?? false,
      position: new THREE.Vector3(laneX, y, -12),
    });
    world.addActor(target);
    this.activeTargets.push(target);
    this.tutorialTarget = target;
    if (request.kind === 'hazard' && this.tutorialDirector.getLesson().id === 'versus-risk') {
      this.tutorialRiskCueShown = false;
      this.tutorialHud?.setControl('WAIT FOR THE CUE');
    }
  }

  private updateLastBounceTutorial(deltaTime: number): void {
    if (this.tutorialDirector.isComplete()) return;
    const lesson = this.tutorialDirector.getLesson();
    const ballState = this.ball?.getState();
    if (!ballState) return;

    if (
      lesson.id === 'versus-risk'
      && this.tutorialTarget
      && ballState.side === 'right'
      && !ballState.isTransferring
      && !ballState.isCatching
    ) {
      const passTime = this.getTargetTimeToBall(this.tutorialTarget);
      if (passTime <= 0.88 && passTime >= 0.3 && !this.tutorialRiskCueShown) {
        this.tutorialRiskCueShown = true;
        this.tutorialHud?.setControl('LEFT CLICK - PASS NOW');
        this.versusHud?.showCallout(
          'PASS NOW',
          'The hazard is inside the Risk Pass window',
          'danger',
          1050,
        );
        void this.getWorld()?.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
          volume: 0.4,
          bus: 'SFX',
        });
      }
    }

    if (
      ballState.side === 'left'
      && !ballState.isTransferring
      && !ballState.isCatching
    ) {
      this.ball?.reset('right');
      this.versusOwner = 'player';
      this.versusLastStableSide = 'right';
      this.versusReturnLockedOwner = null;
      this.versusQueuedAiAction = null;
      this.versusQueuedAiActionTimer = 0;
      this.syncVersusHud();
    }

    if (lesson.id === 'versus-pressure' && ballState.side === 'right' && !ballState.isTransferring) {
      this.versusPossessionTime = Math.min(
        this.versusPressureDuration * 1.05,
        this.versusPossessionTime + deltaTime * 1.45,
      );
      const pressure = THREE.MathUtils.clamp(
        this.versusPossessionTime / this.versusPressureDuration,
        0,
        1,
      );
      this.updateVersusPressureFeedback(pressure);
      this.updateTargetSpacing(this.activeTargets, deltaTime, 0.2, {
        basePace: 4.1,
        pressureLaneX: this.lanes[2],
        pressure,
      });
    }
  }

  private prepareTutorialLesson(lessonId: string): void {
    if (this.tutorialMode !== 'last-bounce') return;
    for (const target of this.activeTargets) target.destroy();
    this.activeTargets.length = 0;
    this.tutorialTarget = null;
    this.tutorialRiskCueShown = false;
    this.versusRoundActive = true;
    this.versusReturnLockedOwner = null;
    this.versusQueuedAiAction = null;
    this.versusQueuedAiActionTimer = 0;
    this.versusWasCatching = false;
    this.versusPossessionTime = 0;
    this.ball?.setCatchEnabled(true);
    this.versusHud?.setTutorialFocus(
      lessonId === 'versus-lives'
        ? 'lives'
        : lessonId === 'versus-risk'
          ? 'risk'
          : null,
    );

    this.ball?.reset('right');
    this.versusOwner = 'player';
    this.versusLastStableSide = 'right';

    if (lessonId === 'versus-recovery') {
      this.versusPlayerRiskCards = Math.min(
        this.versusPlayerRiskCards,
        this.versusMaximumRiskCards - 1,
      );
    } else if (lessonId === 'versus-pressure') {
      this.versusPossessionTime = this.versusPressureDuration * 0.58;
      this.versusHud?.showCallout(
        'PRESSURE BUILDS',
        'Your lane accelerates while you hold possession',
        'danger',
        1100,
      );
    }
    this.syncVersusHud();
  }

  private handleTutorialTargetHit(target: DribbleTarget, position: THREE.Vector3): void {
    const world = this.getWorld();
    if (!world) return;

    if (target.kind === 'hazard') {
      this.spawnImpactBurst(position, 0xff453a);
      const lesson = this.tutorialDirector.getLesson();
      const retryMessage = lesson.id === 'versus-air'
        ? 'STAY LOW FOR AIR HAZARDS'
        : lesson.id === 'versus-risk'
          ? 'THE PASS WAS TOO LATE'
        : 'TIME THE POWER BOUNCE';
      this.versusHud?.showCallout('HAZARD HIT', retryMessage, 'danger', 850);
      this.juiceHud?.showPraise('TRY A HIGH BOUNCE', 'gold');
      if (lesson.id === 'versus-risk') {
        this.versusPlayerRiskCards = this.versusMaximumRiskCards;
        this.tutorialRiskCueShown = false;
        this.tutorialHud?.setControl('WAIT FOR THE CUE');
        this.ball?.reset('right');
        this.versusOwner = 'player';
        this.versusLastStableSide = 'right';
        this.syncVersusHud();
      }
      this.recordTutorialEvent('hazard-hit');
      if (this.tutorialMode === 'last-bounce') this.tutorialDirector.retryTarget();
      void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/explosion.mp3', {
        volume: 0.34,
        bus: 'SFX',
      });
      return;
    }

    if (target.kind === 'recovery') {
      this.restoreVersusRiskCard('player', position);
      this.recordTutorialEvent('recovery-hit');
    } else if (target.kind === 'health') {
      this.lives = Math.min(this.maxLives, this.lives + 1);
      this.livesDisplay?.setLives(this.lives);
      this.spawnImpactBurst(position, 0x4de6b8);
      this.recordTutorialEvent('health-hit');
    } else if (target.kind === 'bonus') {
      this.spawnImpactBurst(position, 0xffca3a);
      this.recordTutorialEvent('bonus-hit');
    } else {
      this.spawnImpactBurst(position, 0xffca3a);
      this.recordTutorialEvent(target.isRhythmTarget ? 'center-hit' : 'score-hit');
    }
    void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
      volume: 0.62,
      bus: 'SFX',
    });
  }

  private recordTutorialEvent(event: TutorialEvent): void {
    if (!this.tutorialActive) return;
    const advanced = this.tutorialDirector.recordEvent(event);
    if (!advanced) return;
    this.juiceHud?.showPraise(this.tutorialDirector.isComplete() ? 'COURT READY!' : 'NICE!', 'gold');
    this.tutorialTransitionPending = true;
    this.tutorialTransitionTimer = event === 'boost-left' || event === 'boost-right'
      ? DribbleBall.boostDuration + 0.08
      : event === 'switch-left' || event === 'switch-right'
        ? DribbleBall.transferDuration + 0.08
        : 0.18;
  }

  private syncTutorialLesson(): void {
    if (!this.tutorialActive) return;
    if (this.tutorialDirector.isComplete()) {
      if (this.tutorialLessonId !== 'complete') {
        this.tutorialLessonId = 'complete';
        this.ball?.setFrenzyActive(false);
        this.tutorialHud?.showComplete(this.tutorialMode);
        const tutorialWasUnlocked = this.progression.achievements.playTutorial;
        this.progression = recordTutorialCompletion(this.progression, this.tutorialMode);
        this.mainMenu?.setProgression(this.progression);
        if (!tutorialWasUnlocked && this.progression.achievements.playTutorial) {
          this.enqueueAchievementToast('playTutorial');
        }
      }
      return;
    }

    const lesson = this.tutorialDirector.getLesson();
    if (lesson.id === this.tutorialLessonId) return;
    this.tutorialLessonId = lesson.id;
    this.prepareTutorialLesson(lesson.id);
    if (lesson.id === 'health-target') {
      this.lives = 2;
      this.livesDisplay?.setLives(this.lives);
    }
    this.ball?.setFrenzyActive(lesson.id === 'frenzy');
    this.tutorialHud?.setLesson(
      this.tutorialDirector.getLessonNumber(),
      this.tutorialDirector.getLessonCount(),
      lesson.title,
      lesson.instruction,
      lesson.control,
    );
  }

  private stopTutorial(): void {
    this.tutorialActive = false;
    this.tutorialTarget = null;
    this.tutorialLessonId = '';
    this.tutorialTransitionTimer = 0;
    this.tutorialTransitionPending = false;
    this.tutorialRiskCueShown = false;
    this.versusRoundActive = false;
    this.ball?.setFrenzyActive(false);
    this.tutorialHud?.hide();
    this.versusHud?.setTutorialLayout(false);
    this.versusHud?.setTutorialFocus(null);
    this.versusHud?.hide();
  }

  private returnToMainMenu(): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }

    if (!this.tutorialActive) this.commitRunResult(false);
    this.stopTutorial();
    this.clearAchievementToasts();
    this.gameState = 'menu';
    this.musicDirector?.setState('menu');
    this.setGameplayActive(false);
    this.deactivateHitEffects();
    this.setHudVisible(false);
    this.tutorialHud?.hide();
    this.overlay?.hide();
    this.mainMenu?.showHome();
    world.inputManager.exitPointerLock();
  }

  private exitGame(): void {
    this.commitRunResult(false);
    this.musicDirector?.stop();
    const closeGame = (): void => window.close();
    if (document.fullscreenElement) {
      void document.exitFullscreen().then(closeGame, closeGame);
      return;
    }
    closeGame();
  }

  private pauseRun(): void {
    const world = this.getWorld();
    if (!world || this.gameState !== 'playing') {
      return;
    }
    this.gameState = 'paused';
    this.clearAchievementToasts();
    this.musicDirector?.setPaused(true);
    this.setGameplayActive(false);
    this.setHudVisible(false);
    this.tutorialHud?.hide();
    if (this.gameMode === 'last-bounce') {
      this.overlay?.showVersusPause(this.versusPlayerLosses, this.versusAiLosses);
    } else {
      this.overlay?.showPause(this.score);
    }
    world.inputManager.exitPointerLock();
  }

  private resumeRun(): void {
    const world = this.getWorld();
    if (!world || this.gameState !== 'paused') {
      return;
    }
    this.gameState = 'playing';
    this.musicDirector?.setPaused(false);
    this.setGameplayActive(true);
    this.overlay?.hide();
    this.setHudVisible(true);
    if (this.tutorialActive) {
      this.scoreDisplay?.hide();
      this.tutorialHud?.show();
      if (this.tutorialMode === 'last-bounce') {
        this.livesDisplay?.hide();
        this.timingMeter?.hide();
        this.juiceHud?.hide();
        this.versusHud?.show();
        this.syncVersusHud();
      }
    }
    world.inputManager.exitPointerLock();
  }

  private endRun(): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }
    this.gameState = 'gameOver';
    this.clearAchievementToasts();
    this.musicDirector?.setPaused(true);
    this.commitRunResult(true);
    this.setGameplayActive(false);
    this.deactivateHitEffects();
    this.setHudVisible(false);
    if (this.gameMode !== 'last-bounce') {
      this.overlay?.showGameOver(
        this.score,
        getHighScore(this.progression, this.gameMode),
        this.gameMode,
        this.createRunSummary(),
      );
    }
    world.inputManager.exitPointerLock();
  }

  private setGameplayActive(active: boolean): void {
    this.ball?.setGameplayActive(active);
    for (const target of this.activeTargets) {
      target.setGameplayActive(active);
    }
    for (const burst of this.impactBursts) {
      burst.setGameplayActive(active);
    }
    for (const popup of this.comboPopups) {
      popup.setGameplayActive(active);
    }
  }

  private setHudVisible(visible: boolean): void {
    if (this.gameMode === 'last-bounce' && !this.tutorialActive) {
      const standardComponents = [
        this.scoreDisplay,
        this.livesDisplay,
        this.timingMeter,
        this.juiceHud,
      ];
      for (const component of standardComponents) component?.hide();
      if (visible) {
        this.pauseButton?.show();
        this.sideHints?.show();
        this.versusHud?.show();
      } else {
        this.pauseButton?.hide();
        this.sideHints?.hide();
        this.versusHud?.hide();
      }
      return;
    }
    this.versusHud?.hide();
    const components = [
      this.scoreDisplay,
      this.pauseButton,
      this.livesDisplay,
      this.sideHints,
      this.timingMeter,
      this.juiceHud,
    ];
    for (const component of components) {
      if (visible) component?.show();
      else component?.hide();
    }
  }

  private createHitEffectPool(world: ENGINE.World): void {
    for (let index = 0; index < 4; index += 1) {
      const burst = DribbleImpactBurst.create({ name: `Target Impact Burst ${index + 1}` });
      this.impactBursts.push(burst);
      world.addActor(burst);
    }
    for (let index = 0; index < 3; index += 1) {
      const popup = DribbleComboPopup.create({ name: `Ball Combo Popup ${index + 1}` });
      this.comboPopups.push(popup);
      world.addActor(popup);
    }
  }

  private deactivateHitEffects(): void {
    for (const burst of this.impactBursts) {
      burst.deactivate();
    }
    for (const popup of this.comboPopups) {
      popup.deactivate();
    }
  }

  private purchaseBall(cosmetic: BallCosmetic): DribbleProgressionState {
    const previouslyOwned = isBallOwned(this.progression, cosmetic);
    const firstPurchaseWasUnlocked = this.progression.achievements.firstPurchase;
    this.progression = purchaseBall(this.progression, cosmetic);
    this.ball?.setEquippedCosmetic(this.progression.equippedBall);
    this.updateScoreStarCounter();
    if (!previouslyOwned && isBallOwned(this.progression, cosmetic)) {
      void this.getWorld()?.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
        volume: 0.72,
        bus: 'SFX',
      });
    }
    if (!firstPurchaseWasUnlocked && this.progression.achievements.firstPurchase) {
      this.enqueueAchievementToast('firstPurchase');
    }
    return this.progression;
  }

  private unlockAchievementAndSync(achievement: AchievementId, showToast = true): boolean {
    const updatedProgression = unlockAchievement(this.progression, achievement);
    if (updatedProgression === this.progression) return false;
    this.progression = updatedProgression;
    this.mainMenu?.setProgression(this.progression);
    if (showToast) this.enqueueAchievementToast(achievement);
    return true;
  }

  private enqueueAchievementToast(achievement: AchievementId): void {
    const definition = achievementToastDefinitions[achievement];
    this.achievementToastQueue.push({
      ...definition,
      iconUrl: this.achievementIconUrls.get(achievement) ?? '',
      duration: 3000,
    });
    this.showNextAchievementToast();
  }

  private enqueueHighScoreToast(
    event: 'established' | 'beaten',
    achievementUnlocked = false,
  ): void {
    const modeLabel = this.gameMode === 'hard' ? 'Hard' : 'Normal';
    const title = achievementUnlocked
      ? 'HIGH SCORE ACHIEVEMENT!'
      : event === 'established'
        ? `${modeLabel.toUpperCase()} HIGH SCORE SET!`
        : `NEW ${modeLabel.toUpperCase()} HIGH SCORE!`;
    const description = event === 'established'
      ? `${modeLabel} personal best: ${this.score}`
      : `Previous best: ${this.runStartingHighScore}`;
    this.achievementToastQueue.push({
      title,
      description,
      iconUrl: this.achievementIconUrls.get('highScore') ?? '',
      iconScale: achievementToastDefinitions.highScore.iconScale,
      rarity: 'legendary',
      duration: achievementUnlocked ? 3000 : 2700,
    });
    this.showNextAchievementToast();
  }

  private showNextAchievementToast(): void {
    if (this.achievementToastActive || !this.achievementToast) return;
    const toast = this.achievementToastQueue.shift();
    if (!toast) return;
    this.achievementToastActive = true;
    this.achievementToast.show({
      title: toast.title,
      description: toast.description,
      iconHtml: `<img src="${toast.iconUrl}" alt="" style="width:100%;height:100%;max-width:none;object-fit:contain;transform:scale(${toast.iconScale});">`,
      rarity: toast.rarity,
      duration: toast.duration,
    });
    const world = this.getWorld();
    if (world) {
      void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
        volume: 0.2,
        bus: 'SFX',
      });
    }
    this.achievementToastTimer = setTimeout(() => {
      this.achievementToastTimer = null;
      this.achievementToastActive = false;
      this.showNextAchievementToast();
    }, toast.duration + 400);
  }

  private clearAchievementToasts(): void {
    if (this.achievementToastTimer !== null) {
      clearTimeout(this.achievementToastTimer);
      this.achievementToastTimer = null;
    }
    this.achievementToastQueue.length = 0;
    this.achievementToastActive = false;
    this.achievementToast?.hide();
  }

  private prepareRunRecordTracking(): void {
    if (this.gameMode === 'last-bounce') {
      this.runStartingHighScore = 0;
      this.runHadPriorResult = false;
      this.runHighScoreCelebrated = false;
      this.runResultCommitted = true;
      return;
    }
    this.runStartingHighScore = getHighScore(this.progression, this.gameMode);
    this.runHadPriorResult = getCompletedRunCount(this.progression, this.gameMode) > 0;
    this.runHighScoreCelebrated = false;
    this.runResultCommitted = false;
  }

  private checkForNewHighScore(): boolean {
    if (
      this.tutorialActive
      || this.gameMode === 'last-bounce'
      || !this.runHadPriorResult
      || this.runHighScoreCelebrated
      || this.score <= this.runStartingHighScore
    ) {
      return false;
    }
    this.runHighScoreCelebrated = true;
    const achievementUnlocked = this.unlockAchievementAndSync('highScore', false);
    this.enqueueHighScoreToast('beaten', achievementUnlocked);
    return true;
  }

  private commitRunResult(completed: boolean): void {
    if (
      this.gameMode === 'last-bounce'
      || this.tutorialActive
      || this.runResultCommitted
      || (this.gameState !== 'playing' && this.gameState !== 'paused' && this.gameState !== 'gameOver')
    ) {
      return;
    }
    this.runResultCommitted = true;
    this.progression = recordRunResult(this.progression, this.score, this.gameMode, completed);
    if (completed && !this.runHadPriorResult) {
      const achievementUnlocked = this.unlockAchievementAndSync('highScore', false);
      this.enqueueHighScoreToast('established', achievementUnlocked);
    }
    this.mainMenu?.setProgression(this.progression);
  }

  private setEquippedBall(cosmetic: BallCosmetic): DribbleProgressionState {
    const previousCosmetic = this.progression.equippedBall;
    this.progression = equipBall(this.progression, cosmetic);
    this.ball?.setEquippedCosmetic(this.progression.equippedBall);
    if (previousCosmetic !== this.progression.equippedBall) {
      void this.getWorld()?.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
        volume: 0.3,
        bus: 'SFX',
      });
    }
    return this.progression;
  }

  private setWristbandSelection(side: WristbandSide, color: WristbandColor): DribbleProgressionState {
    const updatedProgression = saveWristbandColor(this.progression, side, color);
    if (updatedProgression === this.progression) return this.progression;
    this.progression = updatedProgression;
    this.applyWristbandColor(side, color);
    void this.getWorld()?.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
      volume: 0.16,
      bus: 'SFX',
    });
    return this.progression;
  }

  private resetProgression(target: ProgressionResetTarget): DribbleProgressionState {
    this.progression = resetSavedProgression(this.progression, target);
    if (target === 'freshStart') {
      this.ball?.setEquippedCosmetic(this.progression.equippedBall);
      this.applyWristbandColor('left', this.progression.leftWristbandColor);
      this.applyWristbandColor('right', this.progression.rightWristbandColor);
      this.updateScoreStarCounter();
    }
    return this.progression;
  }

  private compactActiveTargets(): void {
    let writeIndex = 0;
    let missedScoreTarget = false;
    for (const target of this.activeTargets) {
      if (!target.isRemovalPending()) {
        this.activeTargets[writeIndex] = target;
        writeIndex += 1;
      } else if (this.tutorialActive && target === this.tutorialTarget) {
        this.tutorialTarget = null;
        if (target.kind === 'hazard') {
          const lessonId = this.tutorialDirector.getLesson().id;
          if (lessonId === 'versus-risk') {
            this.recordTutorialEvent('hazard-avoided');
            this.tutorialRiskCueShown = false;
            this.tutorialHud?.setControl('WAIT FOR THE CUE');
          } else if (lessonId === 'versus-pressure') {
            this.tutorialDirector.retryTarget();
          } else {
            this.recordTutorialEvent('hazard-avoided');
          }
        } else {
          this.tutorialDirector.retryTarget();
        }
      } else if (target.didMissScoreTarget()) {
        missedScoreTarget = true;
      } else if (target.didAvoidHazard()) {
        this.hazardsAvoided += 1;
        this.difficultyDirector.recordSuccess();
        this.updateCourtChallenge('hazards', this.hazardsAvoided);
      }
    }
    this.activeTargets.length = writeIndex;
    if (missedScoreTarget && this.frenzyTimeRemaining <= 0) {
      this.combo = 0;
      this.frenzyCharge = 0;
      this.difficultyDirector.recordFailure();
    }
  }

  private createRunSummary(): DribbleRunSummary {
    return {
      bestCombo: this.bestCombo,
      goodHits: this.goodHits,
      perfectSwitches: this.perfectSwitches,
      hazardsAvoided: this.hazardsAvoided,
      starsEarned: this.runStarsEarned,
      elapsedSeconds: this.elapsedTime,
    };
  }

  private createVersusSummary(): DribbleVersusSummary {
    return {
      roundsPlayed: this.versusRound,
      longestRally: this.versusLongestRally,
      playerReturns: this.versusPlayerReturns,
      aiReturns: this.versusAiReturns,
      dangerPasses: this.versusDangerPasses,
      elapsedSeconds: this.elapsedTime,
    };
  }

  private createScoreIconHtml(): string {
    return `<span class="score-star-icon"><img src="${this.scoreStarAssetUrl}" alt="">`
      + `<b class="score-star-balance">${this.progression.stars}</b></span>`;
  }

  private updateScoreStarCounter(): void {
    const counter = this.scoreDisplay?.getElement()?.querySelector('.score-star-balance');
    if (counter) {
      counter.textContent = String(this.progression.stars);
    }
  }

  private syncUiState(): void {
    if (this.gameState === 'menu') {
      this.setGameplayActive(false);
      this.setHudVisible(false);
      this.overlay?.hide();
      this.mainMenu?.showHome();
    } else if (this.gameState === 'paused') {
      this.mainMenu?.hide();
      this.setHudVisible(false);
      if (this.gameMode === 'last-bounce') {
        this.overlay?.showVersusPause(this.versusPlayerLosses, this.versusAiLosses);
      } else {
        this.overlay?.showPause(this.score);
      }
    } else if (this.gameState === 'gameOver') {
      this.mainMenu?.hide();
      this.setHudVisible(false);
      if (this.gameMode === 'last-bounce') {
        this.overlay?.showVersusGameOver(
          this.versusAiLosses >= this.versusLossesToEndMatch,
          this.versusPlayerLosses,
          this.versusAiLosses,
          this.createVersusSummary(),
        );
      } else {
        this.overlay?.showGameOver(
          this.score,
          getHighScore(this.progression, this.gameMode),
          this.gameMode,
          this.createRunSummary(),
        );
      }
    } else {
      this.mainMenu?.hide();
      this.overlay?.hide();
      this.setHudVisible(true);
      if (this.tutorialActive) {
        this.scoreDisplay?.hide();
        this.tutorialHud?.show();
      }
    }
  }
}
