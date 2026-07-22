import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { DribbleBall, type DribbleBallState, type DribbleSide } from './dribble-ball.js';
import { playBasketballBounce } from './dribble-bounce-audio.js';
import { hideDribbleBootScreen } from './dribble-boot-screen.js';
import { DribbleComboPopup } from './dribble-combo-popup.js';
import {
  DribbleControllerNavigation,
  type ControllerMenuDirection,
} from './dribble-controller-navigation.js';
import { DribbleDeveloperPanel } from './dribble-developer-panel.js';
import {
  DribbleDifficultyDirector,
  type DribbleIntensityTier,
} from './dribble-difficulty-director.js';
import { DribbleEnvironmentFocus } from './dribble-environment-focus.js';
import { DribbleImpactBurst } from './dribble-impact-burst.js';
import { playGamepadImpactFeedback } from './dribble-input-feedback.js';
import { DribbleAmbientDust } from './dribble-ambient-dust.js';
import {
  playDribbleEventCue,
  playDribbleFeedback,
  preloadDribbleEventAudio,
} from './dribble-feedback-audio.js';
import {
  DribbleMainMenu,
  highContrastTargetsKey,
  reducedFlashesKey,
  reducedMotionKey,
  type DribbleGameMode,
  type DribbleTutorialSelection,
} from './dribble-main-menu.js';
import { DribbleMusicDirector } from './dribble-music-director.js';
import { t, type TranslationKey } from './dribble-localization.js';
import {
  DribbleOverlay,
  type DribblePowerUpKind,
  type DribblePowerUpShopState,
  type DribbleRunSummary,
  type DribbleVersusSummary,
} from './dribble-overlay.js';
import {
  DribblePatternDirector,
  type DirectedPatternStep,
  type PatternHeight,
  type PatternLane,
} from './dribble-pattern-director.js';
import {
  DribblePerformanceDirector,
  type DribbleQualityTier,
} from './dribble-performance-director.js';
import {
  awardCareerXp,
  awardStars,
  equipBall,
  equipCourt,
  getCompletedRunCount,
  getHighScore,
  getPlayerLevelProgress,
  isBallOwned,
  isCourtOwned,
  loadProgression,
  purchaseBall,
  purchaseCourt,
  recordCourtChallengeProgress,
  recordLastBounceResult,
  recordMastery,
  recordTutorialCompletion,
  recordRunResult,
  resetProgression as resetSavedProgression,
  setWristbandColor as saveWristbandColor,
  spendStars,
  unlockAchievement,
  wristbandColorHex,
  type AchievementId,
  type BallCosmetic,
  type CourtChallengeMetric,
  type CourtCosmetic,
  type DribbleProgressionState,
  type ProgressionResetTarget,
  type WristbandColor,
  type WristbandSide,
} from './dribble-progression.js';
import { DribbleRunDirector } from './dribble-run-director.js';
import {
  DribbleRetentionDirector,
  RUN_OBJECTIVE_XP,
  type RunObjectiveSnapshot,
} from './dribble-retention-director.js';
import {
  DribbleJuiceHud,
  DribbleLivesDisplay,
  DribblePauseButton,
  DribblePowerShopHudButton,
  DribbleRunObjectivesHud,
  DribbleSideHints,
  DribbleTimingMeter,
} from './dribble-status-hud.js';
import {
  DribbleTarget,
  type DribbleTargetOptions,
  type TargetKind,
} from './dribble-target.js';
import { DribbleTelemetry } from './dribble-telemetry.js';
import { DribbleTouchControls } from './dribble-touch-controls.js';
import {
  DribbleTutorialDirector,
  type DribbleTutorialMode,
  type TutorialEvent,
} from './dribble-tutorial-director.js';
import { DribbleTutorialHud } from './dribble-tutorial-hud.js';
import { DribbleUiAudioFeedback } from './dribble-ui-audio-feedback.js';
import { DribbleVersusHud, type VersusOwner } from './dribble-versus-hud.js';
import { DribbleVersusPacingDirector } from './dribble-versus-pacing-director.js';

type DribbleGameState = 'menu' | 'playing' | 'paused' | 'gameOver';
export type DribbleInputAction = 'boost' | 'queued-boost' | 'queued-transfer' | 'transfer' | null;

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
  styleLabel: string;
  reactionBonus: number;
  errorScale: number;
  trapScale: number;
  boostBias: number;
  patienceScale: number;
  rewardScale: number;
}

interface VersusAiTrajectoryRead {
  clearance: number;
  threat: DribbleTarget | null;
  timeToContact: number;
}

const versusAiStyles: readonly VersusAiStyle[] = [
  {
    name: 'ACE',
    styleLabel: 'BALANCED',
    reactionBonus: 0.015,
    errorScale: 0.82,
    trapScale: 0.92,
    boostBias: 1,
    patienceScale: 1,
    rewardScale: 1,
  },
  {
    name: 'BLAZE',
    styleLabel: 'AGGRESSIVE',
    reactionBonus: -0.015,
    errorScale: 1.1,
    trapScale: 1.42,
    boostBias: 0.86,
    patienceScale: 0.82,
    rewardScale: 1.08,
  },
  {
    name: 'LOCK',
    styleLabel: 'DEFENSIVE',
    reactionBonus: 0.035,
    errorScale: 0.68,
    trapScale: 0.72,
    boostBias: 1.25,
    patienceScale: 1.16,
    rewardScale: 1.16,
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
    description: 'Buy your first item from the shop.',
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
  weight: number;
}

interface CourtMaterialSlot {
  mesh: THREE.Mesh;
  materialIndex: number;
  blueMaterial: THREE.MeshStandardMaterial;
  variants: Map<CourtCosmetic, THREE.MeshStandardMaterial>;
}

@ENGINE.GameClass()
export class DribbleGameplayManager extends ENGINE.Actor {
  private static readonly developerToolsEnabled = false;

  private ball: DribbleBall | null = null;
  private ambientDust: DribbleAmbientDust | null = null;
  private environmentFocus: DribbleEnvironmentFocus | null = null;
  private sunsetKeyLight: ENGINE.DirectionalLightComponent | null = null;
  private courtModel: ENGINE.ModelMeshComponent | null = null;
  private courtMaterialApplyToken = 0;
  private readonly courtMaterialSlots: CourtMaterialSlot[] = [];
  private readonly courtTextureCache = new Map<CourtCosmetic, THREE.Texture>();
  private scoreDisplay: ENGINE.NumberDisplay | null = null;
  private pauseButton: DribblePauseButton | null = null;
  private powerShopHudButton: DribblePowerShopHudButton | null = null;
  private livesDisplay: DribbleLivesDisplay | null = null;
  private sideHints: DribbleSideHints | null = null;
  private timingMeter: DribbleTimingMeter | null = null;
  private juiceHud: DribbleJuiceHud | null = null;
  private runObjectivesHud: DribbleRunObjectivesHud | null = null;
  private mainMenu: DribbleMainMenu | null = null;
  private uiAudioFeedback: DribbleUiAudioFeedback | null = null;
  private overlay: DribbleOverlay | null = null;
  private tutorialHud: DribbleTutorialHud | null = null;
  private versusHud: DribbleVersusHud | null = null;
  private developerPanel: DribbleDeveloperPanel | null = null;
  private achievementToast: ENGINE.Achievement | null = null;
  private touchControls: DribbleTouchControls | null = null;
  private controllerNavigation: DribbleControllerNavigation | null = null;
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
  private frenzyStarsCollected = 0;
  private runMilestoneStarsAwarded = 0;
  private nextMilestoneScore = 2500;
  private runCoachStage = -1;
  private timingCandidateError: number | null = null;
  private timingReady = false;
  private pendingPerfectSwitchUntil = 0;
  private frenzyTimeRemaining = 0;
  private shieldTimeRemaining = 0;
  private coinMagnetTimeRemaining = 0;
  private powerUpPurchasesThisRun = 0;
  private nextHardPowerUpPurchaseAt = 0;
  private spawnsSinceHazard = 0;
  private consecutiveHazards = 0;
  private spawnsSinceAirHazard = 6;
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
  private readonly targetPool = new Map<TargetKind, DribbleTarget[]>();
  private readonly targetSpawnSwitchCounts = new WeakMap<DribbleTarget, number>();
  private readonly targetPaceScales = new WeakMap<DribbleTarget, number>();
  private readonly achievementToastQueue: AchievementToastRequest[] = [];
  private readonly achievementIconUrls = new Map<AchievementId, string>();
  private readonly patternDirector = new DribblePatternDirector();
  private pendingClassicAirTrap: {
    patternId: string;
    laneX: number;
    setupTarget: DribbleTarget;
    setupType: NonNullable<DirectedPatternStep['airTrapSetup']>;
  } | null = null;
  private readonly runDirector = new DribbleRunDirector();
  private readonly difficultyDirector = new DribbleDifficultyDirector();
  private readonly retentionDirector = new DribbleRetentionDirector();
  private readonly telemetry = new DribbleTelemetry();
  private readonly performanceDirector = new DribblePerformanceDirector();
  private readonly versusPacingDirector = new DribbleVersusPacingDirector();
  private developerPanelVisible = false;
  private developerPanelRefreshTimer = 0;
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
  private previousMenuCursorProperty: string | null = null;
  private previousGameplayCursorProperty: string | null = null;
  private scoreStarAssetUrl = '';
  private readonly lanes = [-0.95, 0, 0.95];
  private readonly frenzyDuration = 5.5;
  private readonly shieldDuration = 8;
  private readonly coinMagnetDuration = 12;
  private readonly normalPowerUpPurchaseLimit = 2;
  private readonly hardPowerUpPurchaseLimit = 3;
  private readonly hardPowerUpCooldown = 60;
  private readonly resumePaceRampDuration = 0.82;
  private readonly resumePaceStartScale = 0.6;
  private readonly resumeSpawnHoldDuration = 0.18;
  private readonly normalFrenzyStarGracePeriod = 28;
  private readonly hardFrenzyStarGracePeriod = 22;
  private readonly normalAirHazardGracePeriod = 16;
  private readonly hardAirHazardGracePeriod = 12;
  private readonly normalRunDuration = 120;
  private readonly normalFinalPushDuration = 15;
  private readonly normalFinalShotBonus = 500;
  private readonly normalFinalShotLocalTarget = new THREE.Vector3(0.02, 2.08, -7.72);
  private readonly normalFinalShotTarget = new THREE.Vector3(0.02, 2.08, -7.72);
  private readonly targetSpawnZ = -18;
  private readonly minimumTargetGap = 2.35;
  private readonly comfortableTargetGap = 3.15;
  private readonly centerRhythmLength = 8;
  private readonly difficultyRampStart = 5;
  private readonly difficultyRampDuration = 90;
  private readonly speedStageStart = 12;
  private readonly speedStageInterval = 20;
  private readonly normalMaximumSpeedStage = 4;
  private readonly hardMaximumSpeedStage = 12;
  private readonly speedStageBoost = 0.3;
  private lastSpawnIntervalScale = 1;
  private laneSwitchCount = 0;
  private difficultyStage = 0;
  private achievementToastTimer: ReturnType<typeof setTimeout> | null = null;
  private resumeCountdownTimer: ReturnType<typeof setTimeout> | null = null;
  private resumePaceRampElapsed = Number.POSITIVE_INFINITY;
  private achievementToastActive = false;
  private runStartingHighScore = 0;
  private runHadPriorResult = false;
  private runHighScoreCelebrated = false;
  private runResultCommitted = true;
  private retentionRewardsCommitted = true;
  private objectiveBonusStarAwarded = false;
  private runPerformanceXp = 0;
  private runObjectiveXp = 0;
  private runBonusXp = 0;
  private runXpEarned = 0;
  private objectiveRefreshTimer = 0;
  private normalFinaleActive = false;
  private normalFinaleResolved = false;
  private normalFinaleHandoffActive = false;
  private normalFinaleShotStarted = false;
  private normalFinaleBallSettled = false;
  private normalRunCompleted = false;
  private normalFinaleTimer = 0;
  private normalFinaleShotElapsed = 0;
  private normalFinaleResultDelay = 0;
  private normalFinalPushAnnounced = false;
  private versusOwner: VersusOwner = 'player';
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
  private versusQueuedAiActionWasRisky = false;
  private versusAiRiskDefenseStreak = 0;
  private versusTrickyPassCooldown = 0;
  private readonly versusAiHesitatedThreats = new WeakSet<DribbleTarget>();
  private versusRecoveryCooldown = 0;
  private versusRecoveryGateSequence = 0;
  private versusPlayerRiskCards = 3;
  private versusAiRiskCards = 3;
  private versusPressureWarningStage = 0;
  private versusRecoveryEnabled = true;
  private versusPressureDurationScale = 1;
  private versusCurrentRally = 0;
  private versusLongestRally = 0;
  private versusPlayerReturns = 0;
  private versusAiReturns = 0;
  private versusDangerPasses = 0;
  private versusCounterReads = 0;
  private versusPlayerRiskThreatActive = false;
  private versusAiStyle: VersusAiStyle = versusAiStyles[0];
  private readonly versusLossesToEndMatch = 3;
  private readonly versusPressureDuration = 2.45;
  private readonly versusMaximumRiskCards = 3;
  private readonly versusRiskArrivalWindow = 0.34;
  private readonly versusRiskMaximumDistance = 3.4;

  public handleLeftClick(): DribbleInputAction {
    if (this.gameState !== 'playing' || this.normalFinaleActive) return null;
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
      if (ballState.isBoosting) {
        return this.ball?.queueTransferAfterBoost('left') ? 'queued-transfer' : null;
      }
      const actionWorked = this.ball?.transferToLeft();
      if (actionWorked) {
        this.recordVersusCounterRead();
        this.beginVersusPass('ai');
        if (this.tutorialActive) this.recordTutorialEvent('switch-left');
      }
      return actionWorked ? 'transfer' : null;
    }
    if (ballState?.isTransferring) {
      return this.ball?.queueBoostOnArrival('left') ? 'queued-boost' : null;
    }
    if (ballState?.isBoosting) {
      return ballState.side === 'right' && this.ball?.queueTransferAfterBoost('left')
        ? 'queued-transfer'
        : null;
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
    if (this.gameState !== 'playing' || this.normalFinaleActive) return null;
    const ballState = this.ball?.getState();
    if (this.gameMode === 'last-bounce') {
      if (this.tutorialActive) {
        const lessonId = this.tutorialDirector.getLesson().id;
        if (lessonId === 'versus-lives') return null;
      }
      if (!this.versusRoundActive) return null;
      if (ballState?.isTransferring) {
        return this.ball?.queueBoostOnArrival('right') ? 'queued-boost' : null;
      }
      if (ballState?.side !== 'right') return null;
      const actionWorked = this.ball?.boostRight();
      if (actionWorked) this.recordVersusCounterRead();
      if (actionWorked && this.tutorialActive) this.recordTutorialEvent('boost-right');
      return actionWorked ? 'boost' : null;
    }
    if (ballState?.isTransferring) {
      return this.ball?.queueBoostOnArrival('right') ? 'queued-boost' : null;
    }
    if (ballState?.isBoosting) {
      return ballState.side === 'left' && this.ball?.queueTransferAfterBoost('right')
        ? 'queued-transfer'
        : null;
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

  public handleSideAction(side: DribbleSide): DribbleInputAction {
    const action = side === 'left' ? this.handleLeftClick() : this.handleRightClick();
    if (action === 'boost') this.playPowerBounceCameraImpulse(side);
    return action;
  }

  private playPowerBounceCameraImpulse(side: DribbleSide): void {
    const pawn = this.getWorld()?.getActorsByPredicate(actor => (
      actor !== this
      && typeof (actor as unknown as { playPowerBounceCameraImpulse?: unknown })
        .playPowerBounceCameraImpulse === 'function'
    ))[0] as unknown as {
      playPowerBounceCameraImpulse?: (inputSide: DribbleSide) => void;
    } | undefined;
    pawn?.playPowerBounceCameraImpulse?.(side);
  }

  public showDirectionalInputFeedback(side: DribbleSide, accepted: boolean): void {
    this.touchControls?.pulse(side, accepted);
  }

  public isControllerMenuActive(): boolean {
    return this.gameState === 'menu' || this.gameState === 'paused' || this.gameState === 'gameOver';
  }

  public navigateControllerMenu(direction: ControllerMenuDirection): boolean {
    if (!this.isControllerMenuActive()) return false;
    this.controllerNavigation?.setNavigationActive(true);
    return this.controllerNavigation?.move(direction) ?? false;
  }

  public confirmControllerMenuSelection(): boolean {
    if (!this.isControllerMenuActive()) return false;
    this.controllerNavigation?.setNavigationActive(true);
    return this.controllerNavigation?.confirm() ?? false;
  }

  public cancelControllerMenuSelection(): boolean {
    if (!this.isControllerMenuActive()) return false;
    const handled = this.gameState === 'menu'
      ? this.mainMenu?.handleControllerBack() ?? false
      : (this.overlay?.handleControllerBack(), true);
    if (handled) this.controllerNavigation?.refresh();
    return handled;
  }

  public togglePause(): void {
    if (this.gameState === 'menu' || this.gameState === 'gameOver' || this.normalFinaleActive) {
      return;
    }

    if (this.gameState === 'paused') {
      this.resumeRun();
    } else {
      this.pauseRun();
    }
  }

  public toggleDeveloperPanel(): void {
    if (!DribbleGameplayManager.developerToolsEnabled) return;
    this.developerPanelVisible = !this.developerPanelVisible;
    if (this.developerPanelVisible) {
      this.refreshDeveloperPanel();
      this.developerPanel?.show();
    } else {
      this.developerPanel?.hide();
    }
  }

  public exportTelemetryReport(): void {
    if (!DribbleGameplayManager.developerToolsEnabled) return;
    const snapshot = this.telemetry.getSnapshot();
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...snapshot }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `basketball-frenzy-telemetry-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  public restartRun(mode?: DribbleGameMode): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }
    this.clearResumeCountdown();
    this.resetResumePaceRamp();
    this.musicDirector?.setState('gameplay');
    this.clearAchievementToasts();

    if (!this.tutorialActive) this.commitRunResult(false);
    this.stopTutorial();
    if (mode) {
      this.gameMode = mode;
      this.maxLives = mode === 'hard' ? 2 : 3;
    }
    this.prepareRunRecordTracking();
    this.performanceDirector.reset();
    this.runCoachStage = this.runHadPriorResult ? -1 : 0;
    this.retentionRewardsCommitted = false;
    this.objectiveBonusStarAwarded = false;
    this.runPerformanceXp = 0;
    this.runObjectiveXp = 0;
    this.runBonusXp = 0;
    this.runXpEarned = 0;
    this.objectiveRefreshTimer = 0;
    this.normalFinaleActive = false;
    this.normalFinaleResolved = false;
    this.normalFinaleHandoffActive = false;
    this.normalFinaleShotStarted = false;
    this.normalFinaleBallSettled = false;
    this.normalRunCompleted = false;
    this.normalFinaleTimer = 0;
    this.normalFinaleShotElapsed = 0;
    this.normalFinaleResultDelay = 0;
    this.normalFinalPushAnnounced = false;

    this.clearActiveTargets();
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
    this.frenzyStarsCollected = 0;
    this.runMilestoneStarsAwarded = 0;
    this.nextMilestoneScore = 2500;
    this.timingCandidateError = null;
    this.timingReady = false;
    this.pendingPerfectSwitchUntil = 0;
    this.frenzyTimeRemaining = 0;
    this.setEnvironmentFrenzyActive(false);
    this.shieldTimeRemaining = 0;
    this.coinMagnetTimeRemaining = 0;
    this.powerUpPurchasesThisRun = 0;
    this.nextHardPowerUpPurchaseAt = 0;
    this.ball?.setShieldActive(false);
    this.spawnsSinceHazard = 0;
    this.consecutiveHazards = 0;
    this.spawnsSinceAirHazard = 6;
    this.centerRhythmSpawnsRemaining = 0;
    this.centerRhythmNextKind = 'score';
    this.centerRhythmCooldown = 12;
    this.centerRhythmOpportunityCount = 0;
    this.lastSpawnWasCenterRhythm = false;
    this.pendingClassicAirTrap = null;
    this.lastSpawnIntervalScale = 1;
    this.laneSwitchCount = 0;
    this.difficultyStage = 0;
    this.patternDirector.reset(this.gameMode);
    this.difficultyDirector.reset(this.gameMode);
    this.retentionDirector.start(this.gameMode, this.getObjectiveRotationSeed());
    this.runDirector.start(this.gameMode, this.getObjectiveRotationSeed());
    this.updateRunHudContext();
    this.refreshRunObjectivesHud();
    this.musicDirector?.setIntensity(0);
    if (this.gameMode === 'last-bounce') {
      this.startVersusMatch();
    } else {
      this.versusRoundActive = false;
      this.ball?.setCatchEnabled(false);
      this.ball?.reset();
    }
    this.telemetry.startRun(
      this.gameMode,
      this.gameMode === 'last-bounce' ? this.versusAiStyle.name : '',
    );
    this.setGameplayActive(true);
    this.scoreDisplay?.setValue(0, false);
    this.scoreDisplay?.setTrend(null);
    this.livesDisplay?.resetLives(this.lives, this.maxLives);
    this.timingMeter?.setTiming(0, false, false);
    this.juiceHud?.setFrenzy(0, 0, false);
    this.juiceHud?.setPowerUps(0, 0, false, 0, 0, false);
    this.refreshPowerShopHud();
    this.mainMenu?.hide();
    this.overlay?.hide();
    this.setHudVisible(true);
    if (this.gameMode === 'last-bounce') this.syncVersusHud();
    world.inputManager.exitPointerLock();
  }

  public startTutorial(mode: DribbleTutorialSelection = 'classic'): void {
    const world = this.getWorld();
    if (!world) return;
    this.resetResumePaceRamp();
    this.musicDirector?.setState('gameplay');
    this.clearAchievementToasts();
    this.clearActiveTargets();
    this.environmentFocus?.resetFocus();
    this.juiceHud?.setEnvironmentFocus(0, 0, 'score', false);
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
    this.frenzyStarsCollected = 0;
    this.frenzyTimeRemaining = 0;
    this.setEnvironmentFrenzyActive(false);
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
    this.versusHud?.setOpponentName(mode === 'last-bounce' ? 'COACH' : 'AI', 'TRAINING');
    this.ball?.setCatchEnabled(false);
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

    const performanceChange = this.performanceDirector.update(deltaTime);
    if (performanceChange) {
      if (performanceChange.changed) this.applyQualityTier(performanceChange.current);
      this.telemetry.recordPerformanceSample(
        performanceChange.averageFps,
        performanceChange.changed,
      );
    }

    if (this.normalFinaleActive) {
      this.updateNormalFinale(deltaTime);
      return;
    }

    this.elapsedTime += deltaTime;
    this.updateResumePaceRamp(deltaTime);
    this.compactActiveTargets();
    if (DribbleGameplayManager.developerToolsEnabled) {
      this.updateDeveloperTelemetry(deltaTime);
    }
    this.updateRunCoach();
    this.processQueuedBoostTransfer();
    if (this.tutorialActive) {
      this.updateTutorial(deltaTime);
      const ballState = this.ball?.getState();
      if (ballState) {
        this.updateEnvironmentPresentation(deltaTime);
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
    if (this.gameMode === 'normal' && this.elapsedTime >= this.normalRunDuration) {
      this.elapsedTime = this.normalRunDuration;
      this.beginNormalFinale();
      return;
    }
    this.updateNormalFinalPush();
    this.centerRhythmCooldown = Math.max(0, this.centerRhythmCooldown - deltaTime);
    this.updateFrenzy(deltaTime);
    this.updatePowerUps(deltaTime);
    const baseDifficulty = this.getDifficultyRamp();
    this.difficultyDirector.update(
      deltaTime,
      baseDifficulty,
      this.combo,
      this.maxLives > 0 ? this.lives / this.maxLives : 0,
    );
    const difficulty = this.difficultyDirector.getDifficulty(baseDifficulty);
    this.telemetry.update(this.elapsedTime, this.score, difficulty);
    this.updateRunObjectivesThrottled(deltaTime);
    this.musicDirector?.setIntensity(this.difficultyDirector.getIntensity());
    this.updateAdaptiveIntensityFeedback();
    this.updateDifficultyStage();
    if (!this.isResumeSpawnHoldActive()) this.spawnTimer -= deltaTime;
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
          * this.runDirector.getPhase(this.elapsedTime).spawnIntervalScale
          * this.difficultyDirector.getSpawnIntervalScale();
      } else {
        this.spawnTimer = 0.08;
      }
    }

    const ballState = this.ball?.getState();
    if (ballState) {
      this.updateTargetSpacing(this.activeTargets, deltaTime, difficulty);
      this.updateEnvironmentPresentation(deltaTime);
      this.updateCoinMagnetAttraction(ballState, this.activeTargets);
      this.updateTimingMeter(ballState, this.activeTargets);
      this.checkBallTargetHits(ballState, this.activeTargets);
      this.updateHandAnimations(deltaTime, ballState);
    }
  }

  protected override doBeginPlay(): void {
    super.doBeginPlay();
    const world = this.getWorld();
    if (world) {
      world.inputManager.options.virtualJoystickOptions = {
        ...world.inputManager.options.virtualJoystickOptions,
        hidden: true,
      };
      this.musicDirector = new DribbleMusicDirector(world);
      this.musicDirector.preload();
      void this.prewarmGameplayAssets();
      preloadDribbleEventAudio(world);
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
    this.clearResumeCountdown();
    this.clearAchievementToasts();
    this.scoreDisplay?.destroy();
    this.musicDirector?.stop();
    this.musicDirector = null;
    this.handModelRoots.clear();
    this.environmentFocus?.destroy();
    this.environmentFocus = null;
    this.sunsetKeyLight = null;
    this.pauseButton?.destroy();
    this.powerShopHudButton?.destroy();
    this.livesDisplay?.destroy();
    this.sideHints?.destroy();
    this.timingMeter?.destroy();
    this.juiceHud?.destroy();
    this.runObjectivesHud?.destroy();
    this.achievementToast?.destroy();
    this.touchControls?.destroy();
    this.controllerNavigation?.destroy();
    this.tutorialHud?.destroy();
    this.versusHud?.destroy();
    this.developerPanel?.destroy();
    this.mainMenu?.destroy();
    this.uiAudioFeedback?.destroy();
    this.overlay?.destroy();
    this.scoreDisplay = null;
    this.pauseButton = null;
    this.powerShopHudButton = null;
    this.livesDisplay = null;
    this.sideHints = null;
    this.timingMeter = null;
    this.juiceHud = null;
    this.runObjectivesHud = null;
    this.achievementToast = null;
    this.touchControls = null;
    this.controllerNavigation = null;
    this.tutorialHud = null;
    this.versusHud = null;
    this.developerPanel = null;
    this.mainMenu = null;
    this.uiAudioFeedback = null;
    this.overlay = null;
    this.restoreReferenceHands();
    const world = this.getWorld();
    const gameContainer = world?.gameContainer;
    if (gameContainer && this.previousGameCursor !== null) {
      gameContainer.style.cursor = this.previousGameCursor;
      this.previousGameCursor = null;
    }
    if (gameContainer && this.previousMenuCursorProperty !== null) {
      if (this.previousMenuCursorProperty) {
        gameContainer.style.setProperty('--dribble-menu-cursor', this.previousMenuCursorProperty);
      } else {
        gameContainer.style.removeProperty('--dribble-menu-cursor');
      }
      this.previousMenuCursorProperty = null;
    }
    if (gameContainer && this.previousGameplayCursorProperty !== null) {
      if (this.previousGameplayCursorProperty) {
        gameContainer.style.setProperty(
          '--dribble-gameplay-cursor',
          this.previousGameplayCursorProperty,
        );
      } else {
        gameContainer.style.removeProperty('--dribble-gameplay-cursor');
      }
      this.previousGameplayCursorProperty = null;
    }
    for (const state of this.handAnimations.values()) {
      state.mixer.stopAllAction();
    }
    this.handAnimations.clear();
    this.impactBursts.length = 0;
    this.comboPopups.length = 0;
    this.activeTargets.length = 0;
    this.targetPool.clear();
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

    this.configureRendererForPerformance(world);
    this.configurePostProcessing(world);
    this.configureSunsetLighting(world);
    this.setupCourtModel(world);
    this.addHand(world, 'Left Hand', '@project/assets/models/right_hand_runtime.glb');
    this.addHand(world, 'Right Hand', '@project/assets/models/left_hand_runtime.glb');

    this.environmentFocus = new DribbleEnvironmentFocus(world, this.lanes);
    this.environmentFocus.setSunsetKey(this.sunsetKeyLight);

    this.ambientDust = DribbleAmbientDust.create({ name: 'Ambient Court Dust' });
    world.addActor(this.ambientDust);

    this.ball = DribbleBall.create({ name: 'Dribble Ball' });
    world.addActor(this.ball);
    this.ball.setEquippedCosmetic(this.progression.equippedBall);
    this.ball.setGameplayActive(false);
    this.createHitEffectPool(world);
    this.createTargetPool(world);
    this.applyQualityTier(this.performanceDirector.getTier());
  }

  private async prewarmGameplayAssets(): Promise<void> {
    await Promise.all([
      DribbleTarget.preloadModels(),
      DribbleBall.preloadFrenzyModel(),
    ]);
  }

  private setupCourtModel(world: ENGINE.World): void {
    const courtActor = world.getActorByName('Basketballscene 2');
    this.courtModel = courtActor?.rootComponent instanceof ENGINE.ModelMeshComponent
      ? courtActor.rootComponent
      : courtActor?.getComponent(ENGINE.ModelMeshComponent) ?? null;
    if (!this.courtModel) {
      console.warn('Basketballscene 2 court model was not found; court cosmetics are unavailable.');
      return;
    }
    this.courtModel.replacePhysicsOptions({ enabled: false });
    this.courtModel.receiveShadow = true;
    void this.courtModel.waitForLoad()
      .then(() => {
        this.registerReactiveArenaAccents();
        this.cacheCourtMaterialSlots();
        return this.applyEquippedCourt();
      })
      .catch(error => {
        console.warn('Could not prepare court material customization.', error);
      });
  }

  private cacheCourtMaterialSlots(): void {
    if (this.courtMaterialSlots.length > 0) return;
    this.courtModel?.getModel()?.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material, materialIndex) => {
        if (!(material instanceof THREE.MeshStandardMaterial) || material.name !== 'MaterialCancha') return;
        this.courtMaterialSlots.push({
          mesh: object,
          materialIndex,
          blueMaterial: material,
          variants: new Map(),
        });
      });
    });
    if (this.courtMaterialSlots.length === 0) {
      console.warn('MaterialCancha was not found on the basketball court model.');
    }
  }

  private async applyEquippedCourt(): Promise<void> {
    if (this.courtMaterialSlots.length === 0) return;
    const cosmetic = this.progression.equippedCourt;
    const applyToken = ++this.courtMaterialApplyToken;
    const texture = await this.loadCourtTexture(cosmetic);
    if (applyToken !== this.courtMaterialApplyToken) return;
    if (!texture) {
      if (cosmetic === 'blue') {
        for (const slot of this.courtMaterialSlots) this.setCourtSlotMaterial(slot, slot.blueMaterial);
      }
      return;
    }
    for (const slot of this.courtMaterialSlots) {
      let material = slot.variants.get(cosmetic);
      if (!material) {
        material = slot.blueMaterial.clone();
        material.name = `MaterialCancha_${cosmetic}`;
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
        slot.variants.set(cosmetic, material);
      }
      this.setCourtSlotMaterial(slot, material);
    }
  }

  private async loadCourtTexture(cosmetic: CourtCosmetic): Promise<THREE.Texture | null> {
    const cached = this.courtTextureCache.get(cosmetic);
    if (cached) return cached;
    const texturePath = cosmetic === 'blue'
      ? '@project/assets/textures/court.png'
      : '@project/assets/textures/court_light_wood.png';
    const texture = await ENGINE.resourceManager.loadTexture(ENGINE.AssetPath.fromString(texturePath));
    if (!texture) return null;
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this.courtTextureCache.set(cosmetic, texture);
    return texture;
  }

  private setCourtSlotMaterial(slot: CourtMaterialSlot, material: THREE.Material): void {
    if (!Array.isArray(slot.mesh.material)) {
      slot.mesh.material = material;
      return;
    }
    const materials = [...slot.mesh.material];
    materials[slot.materialIndex] = material;
    slot.mesh.material = materials;
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
      const keyLight = ENGINE.DirectionalLightComponent.create({
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
      });
      this.sunsetKeyLight = keyLight;
      world.addActor(ENGINE.Actor.create({
        name: 'Gameplay Sunset Key Light',
        rootComponent: keyLight,
      }));
    }
  }

  private registerReactiveArenaAccents(): void {
    this.courtModel?.getModel()?.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !/^hoop_(left|right)/i.test(object.name)) return;
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const reactiveMaterials = sourceMaterials.map(material => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return material;
        const reactive = material.clone();
        reactive.name = `${material.name || 'Hoop'}_Reactive`;
        reactive.emissive.copy(material.color).multiplyScalar(0.62);
        reactive.emissiveIntensity = Math.max(0.22, material.emissiveIntensity);
        reactive.needsUpdate = true;
        this.environmentFocus?.registerArenaAccentMaterial(reactive);
        return reactive;
      });
      object.material = Array.isArray(object.material) ? reactiveMaterials : reactiveMaterials[0];
    });
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
      this.previousMenuCursorProperty = gameContainer.style.getPropertyValue('--dribble-menu-cursor');
      this.previousGameplayCursorProperty = gameContainer.style.getPropertyValue(
        '--dribble-gameplay-cursor',
      );
      const mouseCursorUrl = await ENGINE.resolveAssetPathsInText(
        '@project/assets/textures/mouse_cursor.png',
      );
      const gameplayCursor = `url("${mouseCursorUrl}") 3 2, default`;
      gameContainer.style.setProperty(
        '--dribble-menu-cursor',
        `url("${mouseCursorUrl}") 3 2, pointer`,
      );
      gameContainer.style.setProperty('--dribble-gameplay-cursor', gameplayCursor);
      gameContainer.style.cursor = window.matchMedia('(hover: hover) and (pointer: fine)').matches
        ? gameplayCursor
        : 'none';
      this.uiAudioFeedback = new DribbleUiAudioFeedback(world, gameContainer);
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
    this.powerShopHudButton = new DribblePowerShopHudButton(world.uiManager, {
      visible: false,
      onOpen: () => this.openPowerUpShop(),
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
    this.runObjectivesHud = new DribbleRunObjectivesHud(world.uiManager, {
      position: 'top-right',
      visible: false,
    });
    this.achievementToast = new ENGINE.Achievement(world.uiManager, {
      position: 'top-right',
      visible: false,
    });
    this.mainMenu = new DribbleMainMenu(world.uiManager, {
      onPlay: mode => {
        playDribbleEventCue(world, 'mode-start');
        this.restartRun(mode);
      },
      onTutorial: mode => this.startTutorial(mode),
      onVolumeChange: volume => this.applyMasterVolume(volume),
      onMusicVolumeChange: volume => this.applyMusicVolume(volume),
      onSfxVolumeChange: volume => this.applySfxVolume(volume),
      onReducedMotionChange: enabled => this.applyReducedMotion(enabled),
      onReducedFlashesChange: enabled => this.applyReducedFlashes(enabled),
      onHighContrastTargetsChange: enabled => this.applyHighContrastTargets(enabled),
      onTouchControlModeChange: mode => this.touchControls?.setMode(mode),
      onBallBounce: strength => playBasketballBounce(world, strength),
      onNameType: () => {
        void world.globalAudioManager.playGlobalSound('@project/assets/audio/ui-type-click.wav', {
          volume: 0.18,
          bus: 'SFX',
        });
      },
      onExit: () => this.exitGame(),
      progression: this.progression,
      onPurchaseBall: cosmetic => this.purchaseBall(cosmetic),
      onEquipBall: cosmetic => this.setEquippedBall(cosmetic),
      onPurchaseCourt: cosmetic => this.purchaseCourt(cosmetic),
      onEquipCourt: cosmetic => this.setEquippedCourt(cosmetic),
      onWristbandColorChange: (side, color) => this.setWristbandSelection(side, color),
      onResetProgression: target => this.resetProgression(target),
    });
    this.overlay = new DribbleOverlay(world.uiManager, {
      onResume: () => this.resumeRun(),
      onRestart: () => this.tutorialActive ? this.startTutorial(this.tutorialMode) : this.restartRun(),
      onMainMenu: () => this.returnToMainMenu(),
      onSettings: () => this.openPauseSettings(),
      getPowerUpShopState: () => this.getPowerUpShopState(),
      onPurchasePowerUp: kind => this.purchasePowerUp(kind),
    });
    this.tutorialHud = new DribbleTutorialHud(world.uiManager, {
      visible: false,
      onExit: () => this.returnToMainMenu(),
    });
    this.versusHud = new DribbleVersusHud(world.uiManager, {
      visible: false,
    });
    if (DribbleGameplayManager.developerToolsEnabled) {
      this.developerPanel = new DribbleDeveloperPanel(world.uiManager, {
        visible: false,
      });
    }
    this.touchControls = new DribbleTouchControls(world.uiManager, {
      visible: false,
      container: gameContainer,
      onAction: side => this.handleSideAction(side),
      getBallSide: () => {
        const ballState = this.ball?.getState();
        if (!ballState) return 'right';
        if (!ballState.isTransferring) return ballState.side;
        return ballState.side === 'left' ? 'right' : 'left';
      },
    });
    this.controllerNavigation = new DribbleControllerNavigation(world.uiManager, {
      visible: false,
      container: gameContainer,
    });

    const uiInitializations: Promise<void>[] = [
      this.scoreDisplay.initialize(),
      this.pauseButton.initialize(),
      this.powerShopHudButton.initialize(),
      this.livesDisplay.initialize(),
      this.sideHints.initialize(),
      this.timingMeter.initialize(),
      this.juiceHud.initialize(),
      this.runObjectivesHud.initialize(),
      this.achievementToast.initialize(),
      this.tutorialHud.initialize(),
      this.versusHud.initialize(),
      this.touchControls.initialize(),
      this.controllerNavigation.initialize(),
      this.mainMenu.initialize(),
      this.overlay.initialize(),
    ];
    if (this.developerPanel) uiInitializations.push(this.developerPanel.initialize());
    await Promise.all(uiInitializations);
    this.scoreDisplay.setPosition({
      'width': 'auto',
      'height': '48px',
      'min-height': '48px',
      'box-sizing': 'border-box',
      'position': 'fixed',
      'top': '28px',
      'right': '28px',
      'left': 'auto',
      'display': 'flex',
      'flex-direction': 'row',
      'align-items': 'center',
      'justify-content': 'flex-end',
      'gap': '8px',
      'padding': '5px 11px 5px 8px',
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
      'width': '40px',
      'height': '34px',
      'flex-shrink': '0',
    }, '.ui-number-display-icon');
    this.scoreDisplay.setPosition({
      'display': 'block',
      'width': '40px',
      'height': '34px',
      'object-fit': 'contain',
    }, '.ui-number-display-icon img');
    this.scoreDisplay.setPosition({
      'position': 'relative',
      'display': 'block',
      'width': '40px',
      'height': '34px',
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
      'font-size': '34px',
      'line-height': '36px',
      'color': '#ffffff',
      'letter-spacing': '0',
    }, '.ui-number-display-value');
    const scoreRoot = this.scoreDisplay.getElement()?.element;
    this.powerShopHudButton.anchorToScore(
      scoreRoot?.querySelector('.ui-number-display') as HTMLElement | null,
    );
    this.refreshPowerShopHud();
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
    action.setEffectiveWeight(0);
    this.handAnimations.set(side, { action, mixer, weight: 0 });
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
        && !ballState.isTransferring
        && !(this.normalFinaleActive && this.normalFinaleBallSettled)
        && (!ballState.isFinalShot || ballState.isFinalShotHandActive);
      const blendSpeed = active ? 12 : 16;
      const blend = 1 - Math.exp(-deltaTime * blendSpeed);
      state.weight = THREE.MathUtils.lerp(state.weight, active ? 1 : 0, blend);
      if (state.weight < 0.015 && !active) {
        state.weight = 0;
        state.action.paused = true;
        state.action.time = 0;
      } else {
        state.action.paused = false;
      }
      state.action.setEffectiveWeight(state.weight);
      state.mixer.update(deltaTime);
    }
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
        needsRecovery: this.lives < this.maxLives,
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
    if (kind === 'hazard' && this.runCoachStage === 1) {
      this.runCoachStage = 2;
      this.juiceHud?.showCoach(
        'CLEAR THE HAZARD',
        'Click the same side holding the ball to power-bounce over low red targets.',
      );
    }
    const availableLanes = kind === 'bonus' ? [this.lanes[0], this.lanes[2]] : this.lanes;
    let laneX = rhythmTarget
      ? 0
      : patternStep
        ? this.getPatternLaneX(patternStep.lane)
        : availableLanes[Math.floor(Math.random() * availableLanes.length)];
    const paceScale = rhythmTarget ? 1 : patternStep?.speedScale ?? 1;
    const speed = this.getTargetPace(difficulty) * paceScale;
    const validAirTrapFollowUp = patternStep?.airTrapFollowUp === true
      && this.hasValidClassicAirTrapSetup(patternStep, laneX);
    const targetHeight = this.selectTargetHeight(
      kind,
      rhythmTarget,
      patternStep?.height,
      validAirTrapFollowUp,
      Boolean(patternStep),
    );
    if (kind === 'hazard' && targetHeight > 1.5 && Math.abs(laneX) < 0.01) {
      laneX = Math.random() < 0.5 ? this.lanes[0] : this.lanes[2];
    }
    const target = this.acquireTarget({
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
        targetHeight,
        this.targetSpawnZ,
      ),
    });
    this.activeTargets.push(target);
    this.updateClassicAirTrapSetup(patternStep, laneX, target);
    this.targetSpawnSwitchCounts.set(target, this.laneSwitchCount);
    this.targetPaceScales.set(target, paceScale);
    this.lastSpawnWasCenterRhythm = rhythmTarget;
    this.lastSpawnIntervalScale = patternStep?.intervalScale ?? 1;
    this.recordAirHazardSpacing(kind, targetHeight);
    if (patternStep?.startsPattern) {
      this.telemetry.recordPattern(patternStep.patternId);
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
    this.ball?.setCatchEnabled(false);
    this.versusPlayerLosses = 0;
    this.versusAiLosses = 0;
    this.versusRound = 1;
    this.versusSpawnCount = 0;
    this.versusCurrentRally = 0;
    this.versusLongestRally = 0;
    this.versusPlayerReturns = 0;
    this.versusAiReturns = 0;
    this.versusDangerPasses = 0;
    this.versusCounterReads = 0;
    this.versusPlayerRiskThreatActive = false;
    this.versusAiRiskDefenseStreak = 0;
    this.versusRecoveryGateSequence = 0;
    this.versusPlayerRiskCards = this.versusMaximumRiskCards;
    this.versusAiRiskCards = this.versusMaximumRiskCards;
    this.versusAiStyle = versusAiStyles[Math.floor(Math.random() * versusAiStyles.length)];
    this.versusHud?.setOpponentName(this.versusAiStyle.name, this.versusAiStyle.styleLabel);
    this.beginVersusRound();
  }

  private beginVersusRound(): void {
    this.clearActiveTargets();
    this.deactivateHitEffects();
    this.versusRoundActive = true;
    this.versusRoundResetTimer = 0;
    this.versusPossessionTime = 0;
    this.versusCurrentRally = 0;
    this.versusAiDecisionTimer = 0.42;
    this.spawnTimer = 0.85;
    const startingSide: DribbleSide = this.versusRound % 2 === 1 ? 'right' : 'left';
    this.versusLastStableSide = startingSide;
    this.versusOwner = startingSide === 'left' ? 'ai' : 'player';
    this.versusQueuedAiAction = null;
    this.versusQueuedAiActionTimer = 0;
    this.versusQueuedAiActionWasRisky = false;
    this.versusHud?.setAiIntent(null);
    this.versusPlayerRiskThreatActive = false;
    this.versusAiRiskDefenseStreak = Math.max(0, this.versusAiRiskDefenseStreak - 1);
    this.versusTrickyPassCooldown = THREE.MathUtils.randFloat(1.6, 2.4);
    this.versusRecoveryCooldown = THREE.MathUtils.randFloat(5.5, 7.5);
    this.versusPressureWarningStage = 0;
    this.versusRecoveryEnabled = true;
    this.versusPressureDurationScale = 1;
    this.versusPacingDirector.reset();
    this.versusHud?.setPacePhase('rally');
    this.ball?.reset(startingSide);
    this.ball?.setGameplayActive(true);
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
    const rallyHeat = THREE.MathUtils.smoothstep(this.versusCurrentRally, 6, 18);
    const pacing = this.versusPacingDirector.update(
      deltaTime,
      this.versusCurrentRally,
      this.versusRound,
    );
    this.versusRecoveryEnabled = pacing.recoveryEnabled;
    this.versusPressureDurationScale = pacing.pressureDurationScale;
    this.versusHud?.setPacePhase(pacing.phase);
    const paceDifficulty = THREE.MathUtils.clamp(
      difficulty + rallyHeat * 0.18 + pacing.paceBonus,
      0,
      1,
    );
    this.telemetry.update(this.elapsedTime, this.score, difficulty);
    this.versusTrickyPassCooldown = Math.max(0, this.versusTrickyPassCooldown - deltaTime);
    this.versusRecoveryCooldown = Math.max(0, this.versusRecoveryCooldown - deltaTime);
    this.spawnTimer -= deltaTime;
    if (this.spawnTimer <= 0) {
      const spawned = (this.versusRecoveryEnabled && this.trySpawnVersusRecoveryGate(paceDifficulty))
        || this.spawnVersusHazard(paceDifficulty);
      if (spawned) {
        const baseInterval = THREE.MathUtils.lerp(1.12, 0.62, paceDifficulty)
          * THREE.MathUtils.lerp(1, 0.74, rallyHeat)
          * THREE.MathUtils.clamp(1 - (this.versusRound - 1) * 0.025, 0.88, 1);
        this.spawnTimer = THREE.MathUtils.randFloat(baseInterval * 0.92, baseInterval * 1.08)
          * pacing.spawnIntervalScale;
      } else {
        this.spawnTimer = 0.08;
      }
    }

    const ballState = this.ball?.getState();
    if (!ballState) return;
    this.versusPossessionTime += deltaTime;
    this.updateVersusPossession(ballState);
    this.updateVersusAi(deltaTime, ballState, difficulty);
    const pressureDuration = this.versusPressureDuration
      * THREE.MathUtils.lerp(1, 0.8, rallyHeat)
      * pacing.pressureDurationScale;
    const pressure = THREE.MathUtils.clamp(
      this.versusPossessionTime / pressureDuration,
      0,
      1,
    );
    this.musicDirector?.setIntensity(Math.max(paceDifficulty, pressure * 0.9));
    this.updateVersusPressureFeedback(pressure);
    this.updateTargetSpacing(this.activeTargets, deltaTime, paceDifficulty, {
      basePace: THREE.MathUtils.lerp(4.45, 7.15, paceDifficulty)
        * THREE.MathUtils.lerp(1, 1.12, rallyHeat)
        * Math.min(1.12, 1 + (this.versusRound - 1) * 0.025),
      pressureLaneX: this.versusOwner === 'ai' ? this.lanes[0] : this.lanes[2],
      pressure,
    });
    this.updateEnvironmentPresentation(deltaTime);
    this.checkBallTargetHits(ballState, this.activeTargets);
    this.updateHandAnimations(deltaTime, ballState);
    this.syncVersusHud(ballState);
    this.updateRunObjectivesThrottled(deltaTime);
  }

  private updateVersusPossession(ballState: DribbleBallState): void {
    if (ballState.isTransferring || ballState.side === this.versusLastStableSide) return;
    this.versusLastStableSide = ballState.side;
    this.versusOwner = ballState.side === 'left' ? 'ai' : 'player';
    this.versusPossessionTime = 0;
    this.versusPressureWarningStage = 0;
    this.versusAiDecisionTimer = THREE.MathUtils.randFloat(0.28, 0.46);
  }

  private processQueuedBoostTransfer(): void {
    const transferTo = this.ball?.consumeQueuedBoostTransfer();
    if (!transferTo) return;
    if (this.gameMode === 'last-bounce') {
      this.beginVersusPass(transferTo === 'left' ? 'ai' : 'player');
    } else {
      this.laneSwitchCount += 1;
    }
    if (this.tutorialActive) {
      this.recordTutorialEvent(transferTo === 'left' ? 'switch-left' : 'switch-right');
    }
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

    const aiSkill = this.getVersusAiSkill(difficulty);

    if (this.versusQueuedAiAction) {
      this.versusQueuedAiActionTimer = Math.max(0, this.versusQueuedAiActionTimer - deltaTime);
      if (this.versusQueuedAiActionTimer > 0) return;
      const queuedAction = this.versusQueuedAiAction;
      if (queuedAction === 'return') {
        this.versusHud?.setAiIntent(null);
        this.versusQueuedAiAction = null;
        const defendedRiskyPass = this.versusQueuedAiActionWasRisky;
        this.versusQueuedAiActionWasRisky = false;
        if (this.ball?.transferToRight()) {
          if (defendedRiskyPass) this.versusAiRiskDefenseStreak += 1;
          this.beginVersusPass('player');
        }
        return;
      }
      const boostRead = this.assessVersusAiTrajectory('left', 'boost', 1.15);
      if (queuedAction === 'boost' && boostRead.clearance >= 0.08) {
        this.versusHud?.setAiIntent(null);
        this.versusQueuedAiAction = null;
        const defendedRiskyPass = this.versusQueuedAiActionWasRisky;
        this.versusQueuedAiActionWasRisky = false;
        if (defendedRiskyPass) this.versusAiRiskDefenseStreak += 1;
        this.ball?.boostLeft();
        return;
      }
      this.versusQueuedAiAction = null;
      this.versusHud?.setAiIntent(null);
      const defendedRiskyPass = this.versusQueuedAiActionWasRisky;
      this.versusQueuedAiActionWasRisky = false;
      if (this.ball?.transferToRight()) {
        if (defendedRiskyPass) this.versusAiRiskDefenseStreak += 1;
        this.beginVersusPass('player');
      }
      return;
    }

    this.versusAiDecisionTimer -= deltaTime;
    if (this.versusAiDecisionTimer > 0) return;
    this.versusAiDecisionTimer = (
      THREE.MathUtils.lerp(0.22, 0.12, aiSkill)
      + THREE.MathUtils.randFloat(0.015, 0.055)
    ) * THREE.MathUtils.clamp(1 - this.versusAiStyle.reactionBonus * 3, 0.86, 1.1);

    const recoveryOpportunity = this.findVersusRecovery('left', 1.3);
    const recoveryThreat = this.findVersusGroundThreat('left', 1.3);
    const recoveryBoostRead = recoveryOpportunity && recoveryThreat
      ? this.assessVersusAiTrajectory('left', 'boost', 1.22)
      : null;
    if (
      recoveryOpportunity
      && recoveryThreat
      && this.versusAiRiskCards < this.versusMaximumRiskCards
      && recoveryBoostRead
      && recoveryBoostRead.clearance >= 0.1
    ) {
      const recoveryReadChance = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(0.9, 0.985, aiSkill) + this.versusAiStyle.reactionBonus,
        0,
        0.997,
      );
      if (Math.random() < recoveryReadChance) {
        this.ball?.boostLeft();
        return;
      }
    }

    const holdRead = this.assessVersusAiTrajectory('left', 'hold', 1.35);
    const threat = holdRead.clearance <= 0.06 ? holdRead.threat : null;
    if (
      threat
      && holdRead.timeToContact > 0.18
      && holdRead.timeToContact < 1.22
    ) {
      if (this.shouldVersusAiHesitate(threat, holdRead.timeToContact, aiSkill)) return;

      const boostRead = this.assessVersusAiTrajectory('left', 'boost', 1.25);
      const groundThreat = threat.rootComponent.position.y < 0.9;
      const boostSafe = groundThreat && boostRead.clearance >= 0.08;
      const defensivePassIsRisky = this.findVersusRiskPassThreat('right') !== null;
      const passAffordable = !defensivePassIsRisky || this.versusAiRiskCards > 0;
      const counterAttack = defensivePassIsRisky
        && this.versusAiRiskCards > 1
        && this.versusTrickyPassCooldown <= 0;
      const boostPreference = THREE.MathUtils.clamp(
        0.7 * this.versusAiStyle.boostBias + aiSkill * 0.12,
        0.54,
        0.94,
      );

      if (boostSafe && (!passAffordable || !counterAttack || Math.random() < boostPreference)) {
        this.ball?.boostLeft();
      } else if (passAffordable && this.ball?.transferToRight()) {
        if (defensivePassIsRisky) {
          this.versusTrickyPassCooldown = THREE.MathUtils.randFloat(3.6, 5.1);
        }
        this.beginVersusPass('player');
      } else if (boostSafe) {
        this.ball?.boostLeft();
      }
      if (boostSafe || passAffordable) {
        return;
      }
    }

    const playerTrapThreat = this.findVersusGroundThreat('right', 1.05);
    if (
      playerTrapThreat
      && this.versusTrickyPassCooldown <= 0
      && this.versusPossessionTime >= 0.45
    ) {
      const aiRiskDiscipline = this.versusAiRiskCards > 1
        ? 1
        : this.versusAiRiskCards === 1
          ? 0.48
          : 0.08;
      const trapChance = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(0.26, 0.43, aiSkill)
          * aiRiskDiscipline
          * this.versusAiStyle.trapScale,
        0,
        0.7,
      );
      if (this.isVersusRiskPassThreat(playerTrapThreat) && Math.random() < trapChance) {
        if (this.ball?.transferToRight()) {
          this.versusTrickyPassCooldown = THREE.MathUtils.randFloat(3.8, 5.4);
          this.beginVersusPass('player');
        }
        return;
      }
    }

    const pressureThreshold = THREE.MathUtils.lerp(2.4, 1.62, aiSkill)
      * this.versusAiStyle.patienceScale;
    const rightLaneSafe = this.findVersusThreat('right', 0.95) === null;
    if (this.versusPossessionTime >= pressureThreshold && rightLaneSafe) {
      if (this.ball?.transferToRight()) {
        this.beginVersusPass('player');
      }
    }
  }

  private beginVersusPass(receiver: VersusOwner): void {
    const receiverSide: DribbleSide = receiver === 'ai' ? 'left' : 'right';
    const passer: VersusOwner = receiver === 'ai' ? 'player' : 'ai';
    const dangerPass = this.findVersusRiskPassThreat(receiverSide) !== null;
    if (receiver === 'player') this.versusPlayerRiskThreatActive = dangerPass;
    this.versusCurrentRally += 1;
    this.versusLongestRally = Math.max(this.versusLongestRally, this.versusCurrentRally);
    this.updateCourtChallenge('rally', this.versusCurrentRally);
    if (receiver === 'ai') this.versusPlayerReturns += 1;
    else this.versusAiReturns += 1;
    if (dangerPass) this.versusDangerPasses += 1;
    this.telemetry.recordPass(dangerPass, this.versusCurrentRally);

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
    this.versusQueuedAiActionWasRisky = false;
    this.versusPlayerRiskThreatActive = false;
    this.versusHud?.setAiIntent(dangerPass ? 'reading' : null);
    const holdRead = this.assessVersusAiTrajectory(
      'left',
      'hold',
      DribbleBall.transferDuration + 0.82,
      DribbleBall.transferDuration,
      true,
    );
    const threat = holdRead.clearance <= 0.06 ? holdRead.threat : null;
    if (!threat) {
      this.versusHud?.setAiIntent(null);
      return;
    }
    const isGroundThreat = threat.rootComponent.position.y < 0.9;
    if (!isGroundThreat) {
      this.versusHud?.setAiIntent(null);
      return;
    }
    const difficulty = THREE.MathUtils.clamp(this.elapsedTime / 75, 0, 1);
    const aiSkill = this.getVersusAiSkill(difficulty);
    const contactAfterReception = holdRead.timeToContact - DribbleBall.transferDuration;
    const trapQuality = THREE.MathUtils.clamp(
      1 - Math.abs(contactAfterReception - 0.24) / 0.2,
      0,
      1,
    );
    const rallyFatigue = THREE.MathUtils.smoothstep(this.versusCurrentRally, 5, 16);
    const defenseStreakPenalty = Math.min(0.2, this.versusAiRiskDefenseStreak * 0.065);
    const reactionChance = dangerPass
      ? THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(0.88, 0.94, aiSkill)
          - trapQuality * 0.24
          - rallyFatigue * 0.08
          - defenseStreakPenalty
          + this.versusAiStyle.reactionBonus,
        0.54,
        0.94,
      )
      : THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(0.93, 0.985, aiSkill) + this.versusAiStyle.reactionBonus,
        0,
        0.995,
      );
    if (Math.random() >= reactionChance) {
      this.versusHud?.setAiIntent(null);
      return;
    }
    const boostRead = this.assessVersusAiTrajectory(
      'left',
      'boost',
      DribbleBall.transferDuration + 0.9,
      DribbleBall.transferDuration,
      true,
    );
    const canReceptionBoost = boostRead.clearance >= 0.1;
    const receptionBoostChance = THREE.MathUtils.clamp(
      (dangerPass ? 0.44 : 0.62) * this.versusAiStyle.boostBias,
      0.28,
      0.76,
    );
    this.versusQueuedAiAction = canReceptionBoost
      && Math.random() < receptionBoostChance
      ? 'boost'
      : 'return';
    this.versusQueuedAiActionWasRisky = dangerPass;
    this.versusHud?.setAiIntent(this.versusQueuedAiAction === 'boost' ? 'power' : 'return');
    const riskyReactionDelay = dangerPass ? trapQuality * 0.05 : 0;
    this.versusQueuedAiActionTimer = this.versusQueuedAiAction === 'return'
      ? THREE.MathUtils.lerp(0.11, 0.072, aiSkill)
        + riskyReactionDelay
        + THREE.MathUtils.randFloat(0.012, 0.04)
      : THREE.MathUtils.lerp(0.125, 0.08, aiSkill)
        + riskyReactionDelay
        + THREE.MathUtils.randFloat(0.012, 0.035);
  }

  private getVersusAiSkill(difficulty: number): number {
    const matchAdjustment = THREE.MathUtils.clamp(
      (this.versusAiLosses - this.versusPlayerLosses) * 0.045,
      -0.05,
      0.1,
    );
    const rallyFatigue = THREE.MathUtils.smoothstep(this.versusCurrentRally, 7, 19) * 0.14;
    return THREE.MathUtils.clamp(
      0.38 + difficulty * 0.52 + (this.versusRound - 1) * 0.018
        + matchAdjustment - rallyFatigue,
      0.34,
      0.98,
    );
  }

  private shouldVersusAiHesitate(
    target: DribbleTarget,
    timeToContact: number,
    aiSkill: number,
  ): boolean {
    if (timeToContact <= 0.42 || this.versusAiHesitatedThreats.has(target)) return false;
    this.versusAiHesitatedThreats.add(target);
    const mistakeChance = THREE.MathUtils.lerp(0.045, 0.014, aiSkill)
      * this.versusAiStyle.errorScale;
    return Math.random() < mistakeChance;
  }

  private assessVersusAiTrajectory(
    side: DribbleSide,
    action: 'hold' | 'boost',
    maximumTime: number,
    actionDelay = 0,
    startAtHand = false,
  ): VersusAiTrajectoryRead {
    const ball = this.ball;
    if (!ball) {
      return { clearance: Number.NEGATIVE_INFINITY, threat: null, timeToContact: 0 };
    }
    const laneX = side === 'left' ? this.lanes[0] : this.lanes[2];
    let minimumClearance = Number.POSITIVE_INFINITY;
    let limitingThreat: DribbleTarget | null = null;
    let limitingTime = Number.POSITIVE_INFINITY;

    for (const target of this.activeTargets) {
      if (
        target.kind !== 'hazard'
        || target.isRemovalPending()
        || Math.abs(target.laneX - laneX) > 0.05
      ) continue;
      const contactTime = this.getTargetTimeToBall(target);
      if (contactTime < actionDelay || contactTime > maximumTime) continue;
      const collisionRadius = action === 'boost'
        ? target.radius * 0.9 + ball.radius * 0.65
        : target.radius + ball.radius * 0.85;
      const contactWindow = Math.min(
        0.16,
        (action === 'boost' ? collisionRadius : 0.48)
          / Math.max(0.01, target.getApproachSpeed()),
      );
      const sampleOffsets = [
        -contactWindow,
        -contactWindow * 0.5,
        0,
        contactWindow * 0.5,
        contactWindow,
      ];

      for (const offset of sampleOffsets) {
        const sampleTime = contactTime + offset;
        const trajectoryTime = sampleTime - actionDelay;
        if (trajectoryTime < 0) continue;
        const ballY = action === 'boost'
          ? ball.predictHeightAfterBoost(trajectoryTime, startAtHand ? true : undefined)
          : ball.predictBounceHeight(trajectoryTime, startAtHand);
        const clearance = Math.abs(target.rootComponent.position.y - ballY) - collisionRadius;
        if (clearance < minimumClearance) {
          minimumClearance = clearance;
          limitingThreat = target;
          limitingTime = contactTime;
        }
      }
    }

    return {
      clearance: minimumClearance,
      threat: limitingThreat,
      timeToContact: limitingTime,
    };
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
    if (this.tutorialActive) {
      this.versusHud?.showCallout(
        owner === 'player' ? 'RISK CARD RESTORED' : 'AI RECOVERS',
        `${restored} of ${this.versusMaximumRiskCards} cards ready`,
        'recovery',
        920,
      );
    }
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
    const recovery = this.acquireTarget({
      name: 'Last Bounce Recovery Card',
      kind: 'recovery',
      laneX,
      speed,
      spacingGroup,
      position: new THREE.Vector3(laneX, 2.45, this.targetSpawnZ),
      actorTags: ['versus-recovery-card'],
    });
    const hazard = this.acquireTarget({
      name: 'Last Bounce Recovery Gate Hazard',
      kind: 'hazard',
      laneX,
      speed,
      spacingGroup,
      position: new THREE.Vector3(laneX, 0.3, this.targetSpawnZ),
      actorTags: ['versus-ground-hazard', 'versus-recovery-gate'],
    });
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
    if (this.tutorialActive) {
      this.versusHud?.showCallout(
        preferredOwner === 'player' ? 'RECOVERY GATE' : 'AI RECOVERY GATE',
        preferredOwner === 'player'
          ? 'Power bounce through green to restore a Risk Card'
          : 'The AI can power bounce to recover',
        'recovery',
        1100,
      );
    }
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
    const target = this.acquireTarget({
      name: high ? 'Last Bounce Air Hazard' : 'Last Bounce Ground Hazard',
      kind: 'hazard',
      laneX,
      speed,
      position: new THREE.Vector3(laneX, high ? 2.45 : 0.3, this.targetSpawnZ),
      actorTags: [high ? 'versus-air-hazard' : 'versus-ground-hazard'],
    });
    target.setThreatOwner(laneX === this.lanes[2] ? 'player' : 'ai');
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
      if (world) {
        void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
          volume: 0.52,
          bus: 'SFX',
        });
      }
      return;
    }
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

  private findVersusRiskPassThreat(side: DribbleSide): DribbleTarget | null {
    const laneX = side === 'left' ? this.lanes[0] : this.lanes[2];
    let nearest: DribbleTarget | null = null;
    let nearestTime = Number.POSITIVE_INFINITY;
    for (const target of this.activeTargets) {
      if (
        target.kind !== 'hazard'
        || target.rootComponent.position.y >= 0.9
        || Math.abs(target.laneX - laneX) > 0.05
        || !this.isVersusRiskPassThreat(target)
      ) continue;
      const time = this.getTargetTimeToBall(target);
      if (time < nearestTime) {
        nearest = target;
        nearestTime = time;
      }
    }
    return nearest;
  }

  private isVersusRiskPassThreat(target: DribbleTarget): boolean {
    const timeToContact = this.getTargetTimeToBall(target);
    const ballZ = this.ball?.getState().position.z ?? -1.2;
    const distanceToHand = ballZ - target.rootComponent.position.z;
    return timeToContact >= DribbleBall.transferDuration - 0.035
      && timeToContact <= DribbleBall.transferDuration + this.versusRiskArrivalWindow
      && distanceToHand <= this.versusRiskMaximumDistance;
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
    else {
      this.versusAiLosses += 1;
      this.versusAiRiskDefenseStreak = 0;
    }
    this.versusQueuedAiAction = null;
    this.versusQueuedAiActionTimer = 0;
    this.versusQueuedAiActionWasRisky = false;
    this.telemetry.recordRound(loser === 'ai');
    this.updateRunObjectives();
    if (reason !== 'risk') this.telemetry.recordHazardHit();
    this.versusRoundActive = false;
    this.versusRoundResetTimer = 1.65;
    this.ball?.setGameplayActive(false);
    for (const target of this.activeTargets) target.setGameplayActive(false);
    this.spawnImpactBurst(position, 0xff453a, 1.42);
    playGamepadImpactFeedback(loser === 'ai' ? 'score' : 'hazard');
    playDribbleFeedback(this.getWorld(), loser === 'ai' ? 'round-win' : 'hazard');
    this.versusHud?.showRoundResult(
      loser === 'ai',
      loser === 'player' ? 'ROUND LOST' : 'ROUND WON',
      reason === 'risk'
        ? 'No Risk Cards remained'
        : `${reason === 'air' ? 'Air' : 'Ground'} hazard hit ${loser === 'player' ? 'your ball' : `${this.versusAiStyle.name}'s ball`}`,
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
    this.telemetry.finishRun(playerWon ? 'won' : 'lost', this.score, this.elapsedTime);
    this.finalizeRetentionRewards(playerWon);
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
      this.versusPossessionTime / (this.versusPressureDuration * this.versusPressureDurationScale),
      ballState?.isTransferring ?? false,
      ballState?.isCatching ?? false,
      false,
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
    const targetPace = (options?.basePace ?? this.getTargetPace(difficulty))
      * this.getResumePaceScale();
    const accelerationBlend = 1 - Math.exp(
      -deltaTime * (this.isResumePaceRampActive() ? 10 : 1.65),
    );
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
    const runScale = this.gameMode === 'last-bounce'
      ? 1
      : this.runDirector.getModifier().speedScale
        * this.runDirector.getPhase(this.elapsedTime).speedScale;
    const finalPushScale = this.gameMode === 'normal'
      && this.elapsedTime >= this.normalRunDuration - this.normalFinalPushDuration
      ? 1.08
      : 1;
    return (4.15 + difficulty * 3.9 + stageBoost) * modeScale * runScale * finalPushScale;
  }

  private getDifficultyStage(): number {
    if (this.elapsedTime < this.speedStageStart) return 0;
    const maximumStage = this.gameMode === 'hard'
      ? this.hardMaximumSpeedStage
      : this.normalMaximumSpeedStage;
    const stageInterval = this.gameMode === 'hard' ? 16 : this.speedStageInterval;
    return Math.min(
      maximumStage,
      Math.floor((this.elapsedTime - this.speedStageStart) / stageInterval) + 1,
    );
  }

  private updateDifficultyStage(): void {
    const stage = this.getDifficultyStage();
    if (stage <= this.difficultyStage) return;
    this.difficultyStage = stage;
    this.juiceHud?.showPraise('SPEED UP!', 'gold', 760, 2);
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
      heating: 'HEATING UP',
      'on-fire': 'ON FIRE',
      overtime: 'OVERTIME',
    };
    this.juiceHud?.showPraise(presentation[tier], 'gold', 760, 2);
    playDribbleFeedback(this.getWorld(), tier === 'overtime' ? 'frenzy' : 'perfect');
  }

  private selectTargetKind(difficulty: number): TargetKind {
    if (this.frenzyTimeRemaining > 0) {
      return 'score';
    }

    const phase = this.runDirector.getPhase(this.elapsedTime);
    const starGracePeriod = this.gameMode === 'hard'
      ? this.hardFrenzyStarGracePeriod
      : this.normalFrenzyStarGracePeriod;
    const frenzyStarWindowOpen = this.elapsedTime >= starGracePeriod
      && (
        this.gameMode !== 'normal'
        || this.elapsedTime < this.normalRunDuration - this.normalFinalPushDuration
      );
    if (frenzyStarWindowOpen && Math.random() < 0.02 * phase.bonusChanceScale) {
      return 'bonus';
    }

    const safeSpawnLimit = difficulty < 0.18 ? 4 : 3;
    const hazardDue = this.spawnsSinceHazard >= safeSpawnLimit;
    const canSpawnHazard = this.consecutiveHazards < 3;
    if (hazardDue && canSpawnHazard) {
      return 'hazard';
    }

    const healthChance = this.lives < this.maxLives ? 0.09 : 0;
    const finalPushHazardBonus = this.gameMode === 'normal'
      && this.elapsedTime >= this.normalRunDuration - this.normalFinalPushDuration
      ? 0.045
      : 0;
    const hazardChance = canSpawnHazard
      ? this.runDirector.getHazardChance(
          THREE.MathUtils.lerp(0.64, 0.72, difficulty) + finalPushHazardBonus,
          this.elapsedTime,
        )
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

  private selectTargetHeight(
    kind: TargetKind,
    rhythmTarget: boolean,
    patternHeight: PatternHeight | undefined,
    airTrapFollowUp: boolean,
    authoredPattern: boolean,
  ): number {
    if (kind === 'bonus') return 2.45;
    if (rhythmTarget) return 0.48;

    if (kind === 'hazard') {
      const requestedAirTrap = patternHeight === 'high' && airTrapFollowUp;
      if (requestedAirTrap && this.canSpawnAirHazard()) {
        return 2.45;
      }
      if (patternHeight === 'high' || patternHeight === 'low') return 0.3;
    }

    if (patternHeight === 'high') return 2.45;
    if (patternHeight === 'low') return 0.3;
    return authoredPattern ? 0.52 : THREE.MathUtils.randFloat(0.24, 0.68);
  }

  private hasValidClassicAirTrapSetup(
    step: DirectedPatternStep,
    laneX: number,
  ): boolean {
    const pending = this.pendingClassicAirTrap;
    if (
      !pending
      || pending.patternId !== step.patternId
      || Math.abs(pending.laneX - laneX) > 0.01
      || pending.setupTarget.isRemovalPending()
      || !this.activeTargets.includes(pending.setupTarget)
    ) {
      return false;
    }

    return pending.setupType === 'ground-hazard'
      ? pending.setupTarget.kind === 'hazard'
        && pending.setupTarget.rootComponent.position.y < 1.5
      : pending.setupTarget.kind === 'health'
        && pending.setupTarget.rootComponent.position.y > 1.5;
  }

  private updateClassicAirTrapSetup(
    step: DirectedPatternStep | null,
    laneX: number,
    target: DribbleTarget,
  ): void {
    if (step?.airTrapSetup) {
      this.pendingClassicAirTrap = {
        patternId: step.patternId,
        laneX,
        setupTarget: target,
        setupType: step.airTrapSetup,
      };
      return;
    }

    if (!step || step.airTrapFollowUp || step.startsPattern) {
      this.pendingClassicAirTrap = null;
    }
  }

  public openPowerUpShop(): boolean {
    if (
      this.gameState !== 'playing'
      || this.tutorialActive
      || this.gameMode === 'last-bounce'
      || this.normalFinaleActive
      || this.frenzyTimeRemaining > 0
    ) {
      return false;
    }
    this.pauseRun();
    this.overlay?.showPowerUpShop();
    this.controllerNavigation?.refresh();
    return true;
  }

  private canSpawnAirHazard(): boolean {
    if (this.tutorialActive || (this.gameMode !== 'normal' && this.gameMode !== 'hard')) {
      return false;
    }
    const gracePeriod = this.gameMode === 'hard'
      ? this.hardAirHazardGracePeriod
      : this.normalAirHazardGracePeriod;
    const minimumGap = this.gameMode === 'hard' ? 3 : 4;
    return this.elapsedTime >= gracePeriod && this.spawnsSinceAirHazard >= minimumGap;
  }

  private recordAirHazardSpacing(kind: TargetKind, targetHeight: number): void {
    if (kind === 'hazard' && targetHeight > 1.5) {
      this.spawnsSinceAirHazard = 0;
      return;
    }
    this.spawnsSinceAirHazard += 1;
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
    this.juiceHud?.showPraise('PERFECT RELEASE!', 'gold', 760, 2);
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
        const boostLaneX = ballState.side === 'left' ? this.lanes[0] : this.lanes[2];
        if (Math.abs(target.laneX - boostLaneX) > 0.05) continue;
        const depthRadius = target.radius * 0.62 + ballState.radius * 0.5;
        const lateralRadius = target.radius * 0.82 + ballState.radius * 0.58;
        const verticalRadius = target.radius * 0.92 + ballState.radius * 0.68;
        const normalizedZ = (targetPosition.z - ballState.position.z) / depthRadius;
        const normalizedX = (targetPosition.x - ballState.position.x) / lateralRadius;
        const normalizedY = (targetPosition.y - ballState.position.y) / verticalRadius;
        if (normalizedZ * normalizedZ + normalizedX * normalizedX + normalizedY * normalizedY > 1) {
          continue;
        }
      } else {
        const magnetActive = target.kind === 'score' && this.coinMagnetTimeRemaining > 0;
        const depthDistance = Math.abs(targetPosition.z - ballState.position.z);
        if (depthDistance > (magnetActive ? 0.58 : 0.48)) {
          continue;
        }

        const magnetScale = magnetActive ? 1.15 : 1;
        const lateralRadius = (target.radius + ballState.radius * 0.8) * magnetScale;
        const verticalRadius = (target.radius + ballState.radius * 0.85) * magnetScale;
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
        target.requestRemoval();
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
      target.requestRemoval();

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
      this.juiceHud?.showPraise('PERFECT +25', 'gold', 760, 2);
    }
  }

  private handleBonusHit(position: THREE.Vector3, collectedWithoutSwitching: boolean): void {
    if (collectedWithoutSwitching) {
      this.unlockAchievementAndSync('starWithoutSwitching');
    }
    this.progression = awardStars(this.progression, 1);
    this.runStarsEarned += 1;
    this.frenzyStarsCollected += 1;
    this.mainMenu?.setProgression(this.progression);
    this.updateScoreStarCounter();
    this.handleGoodHit(position, 50, true, false);
    this.activateFrenzy();
  }

  private awardScoreMilestoneStars(): number {
    let awarded = 0;
    while (this.score >= this.nextMilestoneScore) {
      this.nextMilestoneScore += 2500;
      if (this.gameMode === 'normal' && this.runMilestoneStarsAwarded >= 1) continue;
      awarded += 1;
      this.runMilestoneStarsAwarded += 1;
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
    this.telemetry.recordScoreHit(timingBonus > 0, bonus);
    this.difficultyDirector.recordSuccess(timingBonus > 0);
    const rawPoints = basePoints * this.combo + timingBonus;
    const modifierPoints = this.gameMode === 'last-bounce'
      ? rawPoints
      : this.runDirector.scaleScore(rawPoints);
    const points = this.gameMode === 'hard'
      ? Math.max(5, Math.round(modifierPoints * 1.25 / 5) * 5)
      : modifierPoints;
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
      bonus ? 1.35 : timingBonus > 0 ? 1.24 : rhythmTarget ? 1.08 : 0.88,
    );
    this.environmentFocus?.playTargetHit(
      position.x,
      0xffca3a,
      bonus ? 1.35 : timingBonus > 0 ? 1.2 : 0.9,
    );
    playGamepadImpactFeedback('score');
    playDribbleFeedback(world, bonus ? 'star' : timingBonus > 0 ? 'perfect' : 'score');
    if (milestoneAwarded) {
      this.environmentFocus?.celebrateMilestone();
      this.juiceHud?.showPraise(`MILESTONE STAR +${milestoneAwarded}!`, 'gold', 1100, 3);
    } else if (bonus) {
      this.juiceHud?.showPraise('STAR +1!', 'gold', 1000, 3);
    } else if (rhythmTarget) {
      this.juiceHud?.showPraise('ON BEAT!', 'gold');
    } else {
      this.showScorePraise();
    }
    if (brokeHighScore) {
      this.juiceHud?.showPraise(t('feedback.newHighScore'), 'gold', 1400, 3);
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

    if (this.shieldTimeRemaining > 0) {
      this.spawnImpactBurst(position, 0x43e8ff, 1.35);
      this.environmentFocus?.playTargetHit(position.x, 0x43e8ff, 1.25);
      this.juiceHud?.showPraise('SHIELD BLOCK!', 'cyan', 900, 3);
      playGamepadImpactFeedback('score');
      void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
        volume: 0.42,
        bus: 'SFX',
      });
      return;
    }

    this.lives = Math.max(0, this.lives - 1);
    this.combo = 0;
    this.difficultyDirector.recordFailure(true);
    this.patternDirector.cancel();
    this.telemetry.recordHazardHit();
    this.livesDisplay?.setLives(this.lives);
    this.spawnImpactBurst(position, 0xff453a, 1.25);
    this.environmentFocus?.playTargetHit(position.x, 0xff453a, 1.18);
    playGamepadImpactFeedback('hazard');
    playDribbleFeedback(world, 'hazard');
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
    this.environmentFocus?.playTargetHit(position.x, 0x4de6b8, 0.95);
    void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
      volume: 0.78,
      bus: 'SFX',
    });
  }

  private spawnImpactBurst(
    position: THREE.Vector3,
    color: THREE.ColorRepresentation,
    intensity = 1,
  ): void {
    const burst = this.impactBursts[this.impactBurstCursor];
    if (!burst) {
      return;
    }
    this.impactBurstCursor = (this.impactBurstCursor + 1) % this.impactBursts.length;
    burst.play(position, color, intensity);
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
    for (const target of this.activeTargets) {
      if (target.isRemovalPending()) continue;
      if (target.kind === 'hazard') {
        if (!target.convertHazardToScore()) continue;
        this.spawnImpactBurst(target.rootComponent.position, 0xffca3a, 0.82);
        continue;
      }
      if (target.kind !== 'bonus') continue;
      this.spawnImpactBurst(target.rootComponent.position, 0xffca3a, 0.82);
      target.requestRemoval();
    }
    this.frenzyTimeRemaining = this.frenzyDuration;
    this.setEnvironmentFrenzyActive(true);
    this.telemetry.recordFrenzy();
    playGamepadImpactFeedback('frenzy');
    playDribbleFeedback(world, 'frenzy');
    this.ball?.setFrenzyActive(true);
    this.juiceHud?.setFrenzy(1, this.frenzyTimeRemaining, true);
    this.musicDirector?.duckForCallout(1.15);
    playDribbleEventCue(world, 'frenzy-start');
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
      this.setEnvironmentFrenzyActive(false);
    }
  }

  private setEnvironmentFrenzyActive(active: boolean): void {
    this.environmentFocus?.setFrenzyActive(active);
    this.ambientDust?.setFrenzyActive(active);
  }

  private updatePowerUps(deltaTime: number): void {
    const shieldWasActive = this.shieldTimeRemaining > 0;
    this.shieldTimeRemaining = Math.max(0, this.shieldTimeRemaining - deltaTime);
    this.coinMagnetTimeRemaining = Math.max(0, this.coinMagnetTimeRemaining - deltaTime);
    const shieldActive = this.shieldTimeRemaining > 0;
    const magnetActive = this.coinMagnetTimeRemaining > 0;
    if (shieldWasActive !== shieldActive) this.ball?.setShieldActive(shieldActive);
    this.juiceHud?.setPowerUps(
      this.shieldTimeRemaining / this.shieldDuration,
      this.shieldTimeRemaining,
      shieldActive,
      this.coinMagnetTimeRemaining / this.coinMagnetDuration,
      this.coinMagnetTimeRemaining,
      magnetActive,
    );
    this.refreshPowerShopHud();
  }

  private updateCoinMagnetAttraction(
    ballState: DribbleBallState,
    targets: DribbleTarget[],
  ): void {
    const magnetActive = this.coinMagnetTimeRemaining > 0;
    const captureRadius = 4.5;
    const releaseRadius = 5.15;
    for (const target of targets) {
      if (target.kind !== 'score' || target.isRemovalPending()) continue;
      if (!magnetActive) {
        if (target.isCoinMagnetized()) target.setCoinMagnetTarget(null);
        continue;
      }

      const radius = target.isCoinMagnetized() ? releaseRadius : captureRadius;
      const distanceSquared = target.rootComponent.position.distanceToSquared(ballState.position);
      target.setCoinMagnetTarget(distanceSquared <= radius * radius ? ballState.position : null);
    }
  }

  private getPowerUpShopState(requirePaused = true): DribblePowerUpShopState {
    const purchaseLimit = this.gameMode === 'hard'
      ? this.hardPowerUpPurchaseLimit
      : this.normalPowerUpPurchaseLimit;
    const purchasesRemaining = Math.max(0, purchaseLimit - this.powerUpPurchasesThisRun);
    const cooldownRemaining = this.gameMode === 'hard'
      ? Math.max(0, this.nextHardPowerUpPurchaseAt - this.elapsedTime)
      : 0;
    const ballX = this.ball?.getState().position.x ?? this.lanes[2];
    const occupiedLaneX = this.lanes.reduce((closest, laneX) => (
      Math.abs(laneX - ballX) < Math.abs(closest - ballX) ? laneX : closest
    ), this.lanes[0]);
    const dangerNearby = this.activeTargets.some(target => (
      !target.isRemovalPending()
      && target.kind === 'hazard'
      && Math.abs(target.laneX - occupiedLaneX) <= 0.05
      && target.rootComponent.position.z > -5.25
    ));
    const correctState = requirePaused
      ? this.gameState === 'paused'
      : this.gameState === 'playing' || this.gameState === 'paused';
    const commonReady = correctState
      && !this.tutorialActive
      && this.gameMode !== 'last-bounce'
      && purchasesRemaining > 0
      && cooldownRemaining <= 0
      && !dangerNearby;
    return {
      stars: this.progression.stars,
      purchasesRemaining,
      purchaseLimit,
      cooldownRemaining,
      lives: this.lives,
      maxLives: this.maxLives,
      shieldRemaining: this.shieldTimeRemaining,
      magnetRemaining: this.coinMagnetTimeRemaining,
      dangerNearby,
      canPurchase: {
        magnet: commonReady && this.coinMagnetTimeRemaining <= 0 && this.progression.stars >= 2,
        shield: commonReady && this.shieldTimeRemaining <= 0 && this.progression.stars >= 3,
        secondWind: commonReady && this.lives < this.maxLives && this.progression.stars >= 4,
      },
    };
  }

  private refreshPowerShopHud(): void {
    if (this.gameMode === 'last-bounce' || this.tutorialActive) return;
    this.powerShopHudButton?.setState(
      this.getPowerUpShopState(false),
      this.gameMode === 'hard' ? 'hard' : 'normal',
    );
  }

  private purchasePowerUp(kind: DribblePowerUpKind): DribblePowerUpShopState {
    const state = this.getPowerUpShopState();
    if (!state.canPurchase[kind]) return state;
    const cost = kind === 'magnet' ? 2 : kind === 'shield' ? 3 : 4;
    const nextProgression = spendStars(this.progression, cost);
    if (nextProgression === this.progression) return state;

    this.progression = nextProgression;
    this.unlockAchievementAndSync('firstPurchase', false);
    this.powerUpPurchasesThisRun += 1;
    if (this.gameMode === 'hard') {
      this.nextHardPowerUpPurchaseAt = this.elapsedTime + this.hardPowerUpCooldown;
    }
    if (kind === 'magnet') {
      this.coinMagnetTimeRemaining = this.coinMagnetDuration;
    } else if (kind === 'shield') {
      this.shieldTimeRemaining = this.shieldDuration;
      this.ball?.setShieldActive(true);
    } else {
      this.lives = Math.min(this.maxLives, this.lives + 1);
      this.livesDisplay?.setLives(this.lives);
    }
    this.mainMenu?.setProgression(this.progression);
    this.updateScoreStarCounter();
    this.refreshPowerShopHud();
    void this.getWorld()?.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
      volume: 0.48,
      bus: 'SFX',
    });
    return this.getPowerUpShopState();
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
    this.ambientDust?.setReducedMotion(enabled);
    this.environmentFocus?.setAccessibility(
      enabled,
      container?.dataset.reducedFlashes === 'true',
    );
    try {
      localStorage.setItem(reducedMotionKey, String(enabled));
    } catch {
      // The current session still uses the selected accessibility preference.
    }
  }

  private applyReducedFlashes(enabled: boolean): void {
    const container = this.getWorld()?.gameContainer;
    if (container) container.dataset.reducedFlashes = enabled ? 'true' : 'false';
    this.environmentFocus?.setAccessibility(
      container?.dataset.reducedMotion === 'true',
      enabled,
    );
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
    const weeklyWasComplete = this.progression.weeklyChallengeCompleted;
    const nextProgression = recordCourtChallengeProgress(this.progression, metric, value);
    if (nextProgression === this.progression) return;
    this.progression = nextProgression;
    this.mainMenu?.setProgression(this.progression);
    this.updateScoreStarCounter();
    const weeklyCompleted = !weeklyWasComplete && this.progression.weeklyChallengeCompleted;
    const dailyCompleted = !wasComplete && this.progression.courtChallengeCompleted;
    if (dailyCompleted || weeklyCompleted) {
      this.juiceHud?.showPraise(
        weeklyCompleted ? 'WEEKLY CHALLENGE +3 STARS' : 'DAILY CHALLENGE +1 STAR',
        'gold',
        1600,
        3,
      );
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
    const target = this.acquireTarget({
      name: `Tutorial ${request.kind} Target`,
      kind: request.kind,
      laneX,
      speed: request.rhythmTarget ? 3.15 : 3.35,
      rhythmTarget: request.rhythmTarget ?? false,
      position: new THREE.Vector3(laneX, y, -12),
    });
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
      if (this.isVersusRiskPassThreat(this.tutorialTarget) && !this.tutorialRiskCueShown) {
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
    this.clearActiveTargets();
    this.tutorialTarget = null;
    this.tutorialRiskCueShown = false;
    this.versusRoundActive = true;
    this.versusQueuedAiAction = null;
    this.versusQueuedAiActionTimer = 0;
    this.versusPossessionTime = 0;
    this.ball?.setCatchEnabled(false);
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
      this.environmentFocus?.playTargetHit(position.x, 0xff453a, 0.85);
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
      this.environmentFocus?.playTargetHit(position.x, 0x4de6b8, 0.8);
      this.recordTutorialEvent('recovery-hit');
    } else if (target.kind === 'health') {
      this.lives = Math.min(this.maxLives, this.lives + 1);
      this.livesDisplay?.setLives(this.lives);
      this.spawnImpactBurst(position, 0x4de6b8);
      this.environmentFocus?.playTargetHit(position.x, 0x4de6b8, 0.8);
      this.recordTutorialEvent('health-hit');
    } else if (target.kind === 'bonus') {
      this.spawnImpactBurst(position, 0xffca3a);
      this.environmentFocus?.playTargetHit(position.x, 0xffca3a, 0.9);
      this.recordTutorialEvent('bonus-hit');
    } else {
      this.spawnImpactBurst(position, 0xffca3a);
      this.environmentFocus?.playTargetHit(position.x, 0xffca3a, 0.8);
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
        this.setEnvironmentFrenzyActive(false);
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
    const tutorialFrenzyActive = lesson.id === 'frenzy';
    this.ball?.setFrenzyActive(tutorialFrenzyActive);
    this.setEnvironmentFrenzyActive(tutorialFrenzyActive);
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
    this.setEnvironmentFrenzyActive(false);
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
    this.clearResumeCountdown();
    this.resetResumePaceRamp();

    if (!this.tutorialActive) this.commitRunResult(false);
    if (!this.tutorialActive) this.telemetry.finishRun('abandoned', this.score, this.elapsedTime);
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
      this.overlay?.showPause(this.score, !this.tutorialActive);
    }
    world.inputManager.exitPointerLock();
  }

  private openPauseSettings(): void {
    if (this.gameState !== 'paused') return;
    this.overlay?.hide();
    this.mainMenu?.showPauseSettings(() => {
      if (this.gameState !== 'paused') return;
      if (this.gameMode === 'last-bounce') {
        this.overlay?.showVersusPause(this.versusPlayerLosses, this.versusAiLosses);
      } else {
        this.overlay?.showPause(this.score, !this.tutorialActive);
      }
    });
  }

  private resumeRun(): void {
    const world = this.getWorld();
    if (!world || this.gameState !== 'paused' || this.resumeCountdownTimer) {
      return;
    }
    this.overlay?.hide();
    this.mainMenu?.hide();
    this.juiceHud?.show();
    let count = 3;
    const advanceCountdown = (): void => {
      if (this.gameState !== 'paused') {
        this.resumeCountdownTimer = null;
        return;
      }
      if (count > 0) {
        this.juiceHud?.showResumeCountdown(count);
        void world.globalAudioManager.playGlobalSound('@project/assets/audio/ui-type-click.wav', {
          volume: 0.16,
          bus: 'SFX',
        });
        count -= 1;
        this.resumeCountdownTimer = setTimeout(advanceCountdown, 600);
        return;
      }
      this.resumeCountdownTimer = null;
      this.juiceHud?.showResumeCountdown(null);
      this.completeResumeRun(world);
    };
    advanceCountdown();
  }

  private completeResumeRun(world: ENGINE.World): void {
    if (this.gameState !== 'paused') return;
    this.gameState = 'playing';
    this.musicDirector?.setPaused(false);
    this.setGameplayActive(true);
    this.beginResumePaceRamp();
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

  private beginResumePaceRamp(): void {
    if (
      this.tutorialActive
      || this.gameMode === 'last-bounce'
      || this.normalFinaleActive
      || this.activeTargets.length === 0
    ) {
      this.resetResumePaceRamp();
      return;
    }

    const previousPaceScale = this.getResumePaceScale();
    if (this.isResumePaceRampActive()) {
      for (const target of this.activeTargets) {
        target.speed /= Math.max(0.01, previousPaceScale);
      }
    }
    this.resumePaceRampElapsed = 0;
    for (const target of this.activeTargets) {
      target.speed *= this.resumePaceStartScale;
    }
  }

  private updateResumePaceRamp(deltaTime: number): void {
    if (!this.isResumePaceRampActive()) return;
    this.resumePaceRampElapsed = Math.min(
      this.resumePaceRampDuration,
      this.resumePaceRampElapsed + deltaTime,
    );
  }

  private getResumePaceScale(): number {
    if (!this.isResumePaceRampActive()) return 1;
    const progress = THREE.MathUtils.smoothstep(
      this.resumePaceRampElapsed,
      0,
      this.resumePaceRampDuration,
    );
    return THREE.MathUtils.lerp(this.resumePaceStartScale, 1, progress);
  }

  private isResumePaceRampActive(): boolean {
    return this.resumePaceRampElapsed < this.resumePaceRampDuration;
  }

  private isResumeSpawnHoldActive(): boolean {
    return this.isResumePaceRampActive()
      && this.resumePaceRampElapsed < this.resumeSpawnHoldDuration;
  }

  private resetResumePaceRamp(): void {
    this.resumePaceRampElapsed = Number.POSITIVE_INFINITY;
  }

  private clearResumeCountdown(): void {
    if (this.resumeCountdownTimer) clearTimeout(this.resumeCountdownTimer);
    this.resumeCountdownTimer = null;
    this.juiceHud?.showResumeCountdown(null);
  }

  private updateNormalFinalPush(): void {
    if (
      this.normalFinalPushAnnounced
      || this.gameMode !== 'normal'
      || this.elapsedTime < this.normalRunDuration - this.normalFinalPushDuration
    ) {
      return;
    }
    this.normalFinalPushAnnounced = true;
    this.juiceHud?.showPraise(t('feedback.finalPush'), 'gold', 1500, 3);
    this.musicDirector?.duckForCallout(0.75);
    playDribbleFeedback(this.getWorld(), 'perfect');
  }

  private beginNormalFinale(): void {
    if (this.normalFinaleActive || this.gameMode !== 'normal') return;
    this.resetResumePaceRamp();
    this.updateRunObjectives();
    this.normalFinaleActive = true;
    this.normalRunCompleted = true;
    this.normalFinaleResolved = false;
    this.normalFinaleHandoffActive = false;
    this.normalFinaleShotStarted = false;
    this.normalFinaleBallSettled = false;
    this.normalFinaleTimer = 0;
    this.normalFinaleShotElapsed = 0;
    this.normalFinaleResultDelay = 0;
    this.patternDirector.cancel();
    this.centerRhythmSpawnsRemaining = 0;
    this.frenzyTimeRemaining = 0;
    this.setEnvironmentFrenzyActive(false);
    this.shieldTimeRemaining = 0;
    this.coinMagnetTimeRemaining = 0;
    this.ball?.setFrenzyActive(false);
    this.ball?.setShieldActive(false);
    this.ball?.setGameplayActive(true);
    this.clearActiveTargets();
    this.deactivateHitEffects();
    this.updateRunHudContext();
    this.timingMeter?.hide();
    this.sideHints?.hide();
    this.pauseButton?.hide();
    this.touchControls?.setInputActive(false);
    this.resolveNormalFinalShotTarget();
    const ballState = this.ball?.getState();
    if (ballState?.side === 'left' && this.ball?.startFinalHandoffToRight()) {
      this.normalFinaleHandoffActive = true;
      this.juiceHud?.showPraise(t('feedback.finalPlay'), 'gold', 1100, 3);
      this.musicDirector?.duckForCallout(0.65);
      playDribbleFeedback(this.getWorld(), 'perfect');
      return;
    }
    this.startNormalFinalShot();
  }

  private startNormalFinalShot(): void {
    if (this.normalFinaleShotStarted) return;
    this.normalFinaleHandoffActive = false;
    this.normalFinaleShotStarted = true;
    this.normalFinaleShotElapsed = 0;
    this.juiceHud?.showPraise(t('feedback.finalShot'), 'gold', 1500, 3);
    this.musicDirector?.duckForCallout(1.4);
    playDribbleFeedback(this.getWorld(), 'frenzy');
    if (this.ball?.startFinalShot(this.normalFinalShotTarget)) return;
    console.warn('Normal finale shot could not start; resolving the final bucket safely.');
    this.markNormalFinaleBallSettled();
    this.resolveNormalFinalShot();
  }

  private resolveNormalFinalShotTarget(): void {
    const ballTarget = this.getWorld()?.getActorByName('BallTarget');
    if (ballTarget) {
      this.normalFinalShotTarget.copy(ballTarget.rootComponent.position);
      return;
    }

    const model = this.courtModel?.getModel();
    if (!model) {
      this.normalFinalShotTarget.copy(this.normalFinalShotLocalTarget);
      return;
    }

    model.updateWorldMatrix(true, true);
    const hoop = model.getObjectByName('Hoop_Left_2')
      ?? model.getObjectByName('Hoop_Left')
      ?? model.getObjectByName('Hoop');
    if (hoop) {
      hoop.getWorldPosition(this.normalFinalShotTarget);
      const origin = model.localToWorld(new THREE.Vector3());
      const rimOffset = model.localToWorld(new THREE.Vector3(0, -0.02, 0.18)).sub(origin);
      this.normalFinalShotTarget.add(rimOffset);
      return;
    }

    this.normalFinalShotTarget.copy(this.normalFinalShotLocalTarget);
    model.localToWorld(this.normalFinalShotTarget);
  }

  private updateNormalFinale(deltaTime: number): void {
    this.normalFinaleTimer += deltaTime;
    const ballState = this.ball?.getState();
    if (ballState) this.updateHandAnimations(deltaTime, ballState);

    if (this.normalFinaleHandoffActive) {
      if (ballState?.side === 'right' && !ballState.isTransferring && !ballState.isCatching) {
        this.startNormalFinalShot();
      } else if (this.normalFinaleTimer >= 1.2) {
        this.ball?.reset('right');
        this.startNormalFinalShot();
      }
      return;
    }

    if (!this.normalFinaleShotStarted) this.startNormalFinalShot();
    this.normalFinaleShotElapsed += deltaTime;
    if (!this.normalFinaleResolved && this.ball?.consumeFinalShotScore()) {
      this.resolveNormalFinalShot();
    }
    if (!this.normalFinaleBallSettled && this.ball?.consumeFinalShotComplete()) {
      this.markNormalFinaleBallSettled();
    }
    if (this.normalFinaleShotElapsed >= 4.8) {
      if (!this.normalFinaleResolved) this.resolveNormalFinalShot();
      this.markNormalFinaleBallSettled();
    }

    if (!this.normalFinaleBallSettled) return;
    if (!this.normalFinaleResolved) this.resolveNormalFinalShot();
    this.normalFinaleResultDelay += deltaTime;
    if (this.normalFinaleResultDelay >= 0.85) {
      this.endRun(true);
    }
  }

  private markNormalFinaleBallSettled(): void {
    if (this.normalFinaleBallSettled) return;
    this.normalFinaleBallSettled = true;
    this.ball?.setGameplayActive(false);
    this.runObjectivesHud?.setRunTimer(0, this.normalRunDuration, 'complete');
  }

  private resolveNormalFinalShot(): void {
    if (this.normalFinaleResolved) return;
    this.normalFinaleResolved = true;
    this.score += this.normalFinalShotBonus;
    this.updateCourtChallenge('score', this.score);
    this.awardScoreMilestoneStars();
    this.checkForNewHighScore();
    this.scoreDisplay?.setValue(this.score, true);
    this.spawnImpactBurst(this.normalFinalShotTarget, 0xffca3a, 1.65);
    this.juiceHud?.showPraise(
      t('feedback.bucket', { points: this.normalFinalShotBonus }),
      'gold',
      1500,
      3,
    );
    playGamepadImpactFeedback('frenzy');
    playDribbleFeedback(this.getWorld(), 'star');
    void this.getWorld()?.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
      volume: 0.9,
      bus: 'SFX',
    });
  }

  private endRun(completedNormalRun = false): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }
    this.normalRunCompleted = this.normalRunCompleted || completedNormalRun;
    this.normalFinaleActive = false;
    this.gameState = 'gameOver';
    this.telemetry.finishRun('completed', this.score, this.elapsedTime);
    this.clearAchievementToasts();
    this.musicDirector?.setPaused(true);
    this.commitRunResult(true);
    this.finalizeRetentionRewards(false);
    this.setGameplayActive(false);
    this.deactivateHitEffects();
    this.setHudVisible(false);
    if (this.gameMode !== 'last-bounce') {
      this.overlay?.showGameOver(
        this.score,
        getHighScore(this.progression, this.gameMode),
        this.gameMode,
        this.createRunSummary(),
        this.normalRunCompleted,
      );
    }
    world.inputManager.exitPointerLock();
  }

  private setGameplayActive(active: boolean): void {
    this.ball?.setGameplayActive(active);
    this.ambientDust?.setActive(active);
    this.environmentFocus?.setActive(active);
    if (!active) this.juiceHud?.setEnvironmentFocus(0, 0, 'score', false);
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

  private updateEnvironmentPresentation(deltaTime: number): void {
    const presentationDelta = this.performanceDirector.consumePresentationDelta(deltaTime);
    if (presentationDelta <= 0) return;
    const runDuration = this.gameMode === 'normal' ? this.normalRunDuration : 180;
    const runProgress = THREE.MathUtils.clamp(this.elapsedTime / runDuration, 0, 1);
    const frenzyProgress = this.frenzyTimeRemaining > 0
      ? this.frenzyTimeRemaining / this.frenzyDuration
      : 0;
    const focus = this.environmentFocus?.update(
      presentationDelta,
      this.activeTargets,
      frenzyProgress,
      runProgress,
    );
    this.juiceHud?.setEnvironmentFocus(
      focus?.lane ?? 0,
      focus?.urgency ?? 0,
      focus?.kind ?? 'score',
      true,
    );
  }

  private applyQualityTier(tier: DribbleQualityTier): void {
    const world = this.getWorld();
    const renderer = world?.getRenderer() as unknown as {
      setPixelRatio?: (ratio: number) => void;
    } | null;
    const deviceRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    renderer?.setPixelRatio?.(Math.min(deviceRatio, this.performanceDirector.getPixelRatioCap()));
    this.ambientDust?.setQualityTier(tier);
    this.environmentFocus?.setQualityTier(tier);
    if (world?.gameContainer) world.gameContainer.dataset.dribbleQuality = tier;
  }

  private setHudVisible(visible: boolean): void {
    this.touchControls?.setInputActive(visible);
    this.controllerNavigation?.setNavigationActive(!visible && this.isControllerMenuActive());
    if (this.gameMode === 'last-bounce' && !this.tutorialActive) {
      const standardComponents = [
        this.scoreDisplay,
        this.powerShopHudButton,
        this.livesDisplay,
        this.timingMeter,
        this.juiceHud,
        this.runObjectivesHud,
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
      this.powerShopHudButton,
      this.livesDisplay,
      this.sideHints,
      this.timingMeter,
      this.juiceHud,
    ];
    for (const component of components) {
      if (visible) component?.show();
      else component?.hide();
    }
    if (visible && !this.tutorialActive) this.timingMeter?.hide();
    if (visible && this.tutorialActive) this.powerShopHudButton?.hide();
    if (visible && !this.tutorialActive) this.runObjectivesHud?.show();
    else this.runObjectivesHud?.hide();
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

  private createTargetPool(world: ENGINE.World): void {
    const counts: Readonly<Record<TargetKind, number>> = {
      score: 1,
      hazard: 1,
      health: 1,
      bonus: 1,
      recovery: 1,
    };
    for (const kind of Object.keys(counts) as TargetKind[]) {
      for (let index = 0; index < counts[kind]; index += 1) {
        const target = DribbleTarget.create({
          name: `Pooled ${kind} Target ${index + 1}`,
          kind,
          laneX: 0,
          speed: 4,
          position: new THREE.Vector3(0, -50, this.targetSpawnZ),
        });
        world.addActor(target);
        this.releaseTarget(target);
      }
    }
  }

  private acquireTarget(options: DribbleTargetOptions): DribbleTarget {
    const kind = options.kind ?? 'score';
    const pool = this.targetPool.get(kind);
    const target = pool?.pop();
    if (target) {
      target.reactivate(options);
      return target;
    }
    const created = DribbleTarget.create(options);
    this.getWorld()?.addActor(created);
    return created;
  }

  private releaseTarget(target: DribbleTarget): void {
    target.deactivateForPool();
    let pool = this.targetPool.get(target.kind);
    if (!pool) {
      pool = [];
      this.targetPool.set(target.kind, pool);
    }
    if (!pool.includes(target)) pool.push(target);
  }

  private clearActiveTargets(): void {
    for (const target of this.activeTargets) this.releaseTarget(target);
    this.activeTargets.length = 0;
    this.tutorialTarget = null;
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

  private purchaseCourt(cosmetic: CourtCosmetic): DribbleProgressionState {
    const previouslyOwned = isCourtOwned(this.progression, cosmetic);
    const firstPurchaseWasUnlocked = this.progression.achievements.firstPurchase;
    this.progression = purchaseCourt(this.progression, cosmetic);
    void this.applyEquippedCourt();
    this.updateScoreStarCounter();
    if (!previouslyOwned && isCourtOwned(this.progression, cosmetic)) {
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
      title: t(`achievement.${achievement}.title` as TranslationKey),
      description: t(`achievement.${achievement}.description` as TranslationKey),
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

  private setEquippedCourt(cosmetic: CourtCosmetic): DribbleProgressionState {
    const previousCourt = this.progression.equippedCourt;
    this.progression = equipCourt(this.progression, cosmetic);
    void this.applyEquippedCourt();
    if (previousCourt !== this.progression.equippedCourt) {
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
      this.telemetry.clear();
      this.ball?.setEquippedCosmetic(this.progression.equippedBall);
      void this.applyEquippedCourt();
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
        continue;
      }
      if (this.tutorialActive && target === this.tutorialTarget) {
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
        this.telemetry.recordMissedScore();
      } else if (target.didAvoidHazard()) {
        this.hazardsAvoided += 1;
        this.telemetry.recordHazardAvoided();
        this.difficultyDirector.recordSuccess();
        this.updateCourtChallenge('hazards', this.hazardsAvoided);
      }
      this.releaseTarget(target);
    }
    this.activeTargets.length = writeIndex;
    if (missedScoreTarget && this.frenzyTimeRemaining <= 0) {
      this.combo = 0;
      this.difficultyDirector.recordFailure();
    }
  }

  private updateDeveloperTelemetry(deltaTime: number): void {
    if (!this.developerPanelVisible) return;
    this.developerPanelRefreshTimer -= deltaTime;
    if (this.developerPanelRefreshTimer > 0) return;
    this.developerPanelRefreshTimer = 0.25;
    this.refreshDeveloperPanel();
  }

  private updateRunCoach(): void {
    if (this.tutorialActive || this.gameMode === 'last-bounce') return;
    if (this.runCoachStage !== 0 || this.elapsedTime < 4.5) return;
    this.runCoachStage = 1;
    this.juiceHud?.showCoach(
      'READ THE COURT',
      'Yellow targets score. Red hazards cost a heart. Switch lanes to meet the opening.',
      3600,
    );
  }

  private refreshDeveloperPanel(): void {
    const snapshot = this.telemetry.getSnapshot();
    this.developerPanel?.setReport(snapshot.current, snapshot.reports);
  }

  private createRunSummary(): DribbleRunSummary {
    const objectiveProgress = this.retentionDirector.getProgress(this.createObjectiveSnapshot());
    const nextObjective = objectiveProgress.find(objective => !objective.completed)?.label
      ?? 'All run objectives complete';
    const level = getPlayerLevelProgress(this.progression.playerXp);
    return {
      bestCombo: this.bestCombo,
      goodHits: this.goodHits,
      perfectSwitches: this.perfectSwitches,
      hazardsAvoided: this.hazardsAvoided,
      starsEarned: this.runStarsEarned,
      elapsedSeconds: this.elapsedTime,
      objectivesCompleted: this.retentionDirector.getCompletedCount(),
      objectiveCount: this.retentionDirector.getObjectiveCount(),
      performanceXp: this.runPerformanceXp,
      objectiveXp: this.runObjectiveXp,
      bonusXp: this.runBonusXp,
      xpEarned: this.runXpEarned,
      playerLevel: level.level,
      nextObjective: `NEXT RUN: ${nextObjective} · LEVEL ${level.nextUnlockLevel}: ${level.nextUnlock}`,
    };
  }

  private createVersusSummary(): DribbleVersusSummary {
    const objectiveProgress = this.retentionDirector.getProgress(this.createObjectiveSnapshot());
    const nextObjective = objectiveProgress.find(objective => !objective.completed)?.label
      ?? 'All match objectives complete';
    const level = getPlayerLevelProgress(this.progression.playerXp);
    return {
      roundsPlayed: this.versusRound,
      longestRally: this.versusLongestRally,
      playerReturns: this.versusPlayerReturns,
      aiReturns: this.versusAiReturns,
      dangerPasses: this.versusDangerPasses,
      counterReads: this.versusCounterReads,
      elapsedSeconds: this.elapsedTime,
      objectivesCompleted: this.retentionDirector.getCompletedCount(),
      objectiveCount: this.retentionDirector.getObjectiveCount(),
      performanceXp: this.runPerformanceXp,
      objectiveXp: this.runObjectiveXp,
      bonusXp: this.runBonusXp,
      xpEarned: this.runXpEarned,
      playerLevel: level.level,
      nextObjective: `NEXT MATCH: ${nextObjective} · LEVEL ${level.nextUnlockLevel}: ${level.nextUnlock}`,
    };
  }

  private updateRunObjectives(): void {
    const snapshot = this.createObjectiveSnapshot();
    const completed = this.retentionDirector.update(snapshot);
    const progress = this.retentionDirector.getProgress(snapshot);
    this.updateRunHudContext();
    this.runObjectivesHud?.setObjectives(progress, this.shouldShowRunHudHeader());
    if (this.gameMode === 'last-bounce') return;
    const allComplete = progress.length > 0 && progress.every(objective => objective.completed);
    if (allComplete && !this.objectiveBonusStarAwarded) {
      this.objectiveBonusStarAwarded = true;
      this.progression = awardStars(this.progression, 1);
      this.runStarsEarned += 1;
      this.mainMenu?.setProgression(this.progression);
      this.updateScoreStarCounter();
      this.juiceHud?.showPraise(
        t('feedback.allObjectives', { xp: RUN_OBJECTIVE_XP }),
        'gold',
        2200,
        3,
      );
      playGamepadImpactFeedback('frenzy');
      playDribbleFeedback(this.getWorld(), 'star');
      return;
    }
    if (completed.length > 0) {
      this.juiceHud?.showPraise(
        t('feedback.objective', { xp: RUN_OBJECTIVE_XP }),
        'gold',
        1000,
        2,
      );
      playDribbleFeedback(this.getWorld(), 'perfect');
    }
  }

  private refreshRunObjectivesHud(): void {
    this.updateRunHudContext();
    this.runObjectivesHud?.setObjectives(
      this.retentionDirector.getProgress(this.createObjectiveSnapshot()),
      this.shouldShowRunHudHeader(),
    );
  }

  private updateRunHudContext(): void {
    this.runObjectivesHud?.setModifier('');
    if (this.gameMode === 'last-bounce') {
      this.runObjectivesHud?.setRunTimer(0, this.normalRunDuration, 'hidden');
      return;
    }
    if (this.normalFinaleActive) {
      this.runObjectivesHud?.setRunTimer(0, this.normalRunDuration, 'final-shot');
      return;
    }
    if (this.gameMode === 'normal') {
      const remaining = Math.max(0, this.normalRunDuration - this.elapsedTime);
      this.runObjectivesHud?.setRunTimer(
        remaining,
        this.normalRunDuration,
        remaining <= this.normalFinalPushDuration ? 'final-push' : 'steady',
      );
      return;
    }
    this.runObjectivesHud?.setRunTimer(0, this.normalRunDuration, 'hidden');
  }

  private shouldShowRunHudHeader(): boolean {
    return this.gameMode === 'normal' || this.elapsedTime < 4.5;
  }

  private updateRunObjectivesThrottled(deltaTime: number): void {
    this.objectiveRefreshTimer -= deltaTime;
    if (this.objectiveRefreshTimer > 0) return;
    this.objectiveRefreshTimer = 0.15;
    this.updateRunObjectives();
  }

  private createObjectiveSnapshot(): RunObjectiveSnapshot {
    return {
      score: this.score,
      goodHits: this.goodHits,
      perfectSwitches: this.perfectSwitches,
      hazardsAvoided: this.hazardsAvoided,
      bestCombo: this.bestCombo,
      starsEarned: this.frenzyStarsCollected,
      elapsedSeconds: this.elapsedTime,
      roundsWon: this.versusAiLosses,
      longestRally: this.versusLongestRally,
      playerReturns: this.versusPlayerReturns,
      dangerPasses: this.versusDangerPasses,
    };
  }

  private finalizeRetentionRewards(playerWon: boolean): void {
    if (this.retentionRewardsCommitted || this.tutorialActive) return;
    this.retentionRewardsCommitted = true;
    this.updateRunObjectives();
    const completedObjectives = this.retentionDirector.getCompletedCount();
    const allObjectivesComplete = completedObjectives > 0
      && completedObjectives === this.retentionDirector.getObjectiveCount();
    if (this.gameMode === 'last-bounce') {
      this.runPerformanceXp = 45 + this.versusAiLosses * 28 + this.versusLongestRally * 4
        + this.versusPlayerReturns * 3 + this.versusDangerPasses * 10
        + this.versusCounterReads * 15;
      this.runBonusXp = (playerWon ? Math.round(90 * this.versusAiStyle.rewardScale) : 20)
        + (playerWon && this.versusPlayerLosses === 0 ? 50 : 0);
    } else {
      this.runPerformanceXp = 35 + this.goodHits * 5 + this.perfectSwitches * 8 + this.hazardsAvoided * 2
        + Math.max(0, this.runStarsEarned - (this.objectiveBonusStarAwarded ? 1 : 0)) * 20
        + (this.gameMode === 'hard' ? 35 : 0);
      this.runBonusXp = this.gameMode === 'normal' && this.normalRunCompleted ? 75 : 0;
    }
    this.runPerformanceXp = Math.max(0, Math.floor(this.runPerformanceXp));
    this.runObjectiveXp = completedObjectives * RUN_OBJECTIVE_XP;
    this.runBonusXp = Math.max(0, Math.floor(this.runBonusXp));
    this.runXpEarned = this.runPerformanceXp + this.runObjectiveXp + this.runBonusXp;
    if (this.gameMode === 'last-bounce') {
      this.progression = recordLastBounceResult(this.progression, playerWon);
    }
    this.progression = recordMastery(this.progression, this.gameMode === 'last-bounce'
      ? { longestRally: this.versusLongestRally }
      : {
          bestCombo: this.bestCombo,
          perfectSwitches: this.perfectSwitches,
          hazardsAvoided: this.hazardsAvoided,
        });
    if (allObjectivesComplete && !this.objectiveBonusStarAwarded) {
      this.objectiveBonusStarAwarded = true;
      this.progression = awardStars(this.progression, 1);
      this.runStarsEarned += 1;
    }
    this.progression = awardCareerXp(this.progression, this.runXpEarned);
    this.mainMenu?.setProgression(this.progression);
    this.updateScoreStarCounter();
  }

  private getObjectiveRotationSeed(): number {
    const totalRuns = this.progression.normalRunsCompleted
      + this.progression.hardRunsCompleted
      + this.progression.lastBounceMatches;
    const day = Math.floor(Date.now() / 86_400_000);
    return day + totalRuns;
  }

  private recordVersusCounterRead(): void {
    if (!this.versusPlayerRiskThreatActive || !this.versusRoundActive) return;
    this.versusPlayerRiskThreatActive = false;
    this.versusCounterReads += 1;
    this.telemetry.recordCounterRead();
    playDribbleFeedback(this.getWorld(), 'perfect');
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
        this.overlay?.showPause(this.score, !this.tutorialActive);
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
          this.normalRunCompleted,
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
