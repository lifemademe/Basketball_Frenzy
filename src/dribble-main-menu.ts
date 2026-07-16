import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import {
  achievementIds,
  blackHoleBallPrice,
  createDefaultProgressionState,
  discoBallPrice,
  epicBallPrice,
  getBallPrice,
  isBallOwned,
  wristbandColorHex,
  wristbandColors,
  type AchievementId,
  type BallCosmetic,
  type DribbleProgressionState,
  type ProgressionResetTarget,
  type WristbandColor,
  type WristbandSide,
} from './dribble-progression.js';

export type DribbleGameMode = 'normal' | 'hard' | 'last-bounce';
export type DribbleTutorialSelection = 'classic' | 'last-bounce';

type MainMenuPanel = 'home' | 'mode-select' | 'tutorial-select' | 'how-to-play' | 'settings' | 'shop' | 'achievements' | 'reset';
type ResetMenuTarget = ProgressionResetTarget | 'audio';

const masterVolumeKey = 'basketball-frenzy-master-volume';
const musicVolumeKey = 'basketball-frenzy-music-volume';
const sfxVolumeKey = 'basketball-frenzy-sfx-volume';
const playerNameKey = 'basketball-frenzy-player-name';
export const reducedMotionKey = 'basketball-frenzy-reduced-motion';
export const reducedFlashesKey = 'basketball-frenzy-reduced-flashes';
const defaultMasterVolume = 0.8;
const defaultMusicVolume = 0.55;
const defaultSfxVolume = 0.8;

export interface DribbleMainMenuOptions extends ENGINE.BaseUIComponentOptions {
  onPlay?: (mode: DribbleGameMode) => void;
  onTutorial?: (mode: DribbleTutorialSelection) => void;
  onVolumeChange?: (volume: number) => void;
  onMusicVolumeChange?: (volume: number) => void;
  onSfxVolumeChange?: (volume: number) => void;
  onReducedMotionChange?: (enabled: boolean) => void;
  onReducedFlashesChange?: (enabled: boolean) => void;
  onBallBounce?: (strength: number) => void;
  onExit?: () => void;
  progression?: DribbleProgressionState;
  onPurchaseBall?: (cosmetic: BallCosmetic) => DribbleProgressionState;
  onEquipBall?: (cosmetic: BallCosmetic) => DribbleProgressionState;
  onWristbandColorChange?: (side: WristbandSide, color: WristbandColor) => DribbleProgressionState;
  onResetProgression?: (target: ProgressionResetTarget) => DribbleProgressionState;
}

export class DribbleMainMenu extends ENGINE.BaseUIComponent<DribbleMainMenuOptions> {
  public static metadata: ENGINE.UIComponentMetadata = {
    displayName: 'Basketball Frenzy Main Menu',
    category: 'menu',
    summary: 'Full-screen main menu for Basketball Frenzy.',
    useCases: ['main menu', 'start screen', 'settings', 'controls'],
    optionsType: 'DribbleMainMenuOptions',
    assetPaths: {
      template: '@project/assets/ui/dribble-main-menu-model-ball.html',
      styles: '@project/assets/ui/dribble-main-menu-model-ball-cursor.css',
    },
  };

  private rootElement: HTMLElement | null = null;
  private volumeInput: HTMLInputElement | null = null;
  private volumeValue: HTMLElement | null = null;
  private musicVolumeInput: HTMLInputElement | null = null;
  private musicVolumeValue: HTMLElement | null = null;
  private sfxVolumeInput: HTMLInputElement | null = null;
  private sfxVolumeValue: HTMLElement | null = null;
  private reducedMotionInput: HTMLInputElement | null = null;
  private reducedFlashesInput: HTMLInputElement | null = null;
  private homeStarsElement: HTMLElement | null = null;
  private normalHighScoreElement: HTMLElement | null = null;
  private hardHighScoreElement: HTMLElement | null = null;
  private shopStarsElement: HTMLElement | null = null;
  private shopGoalElement: HTMLElement | null = null;
  private classicStatusElement: HTMLElement | null = null;
  private epicStatusElement: HTMLElement | null = null;
  private discoStatusElement: HTMLElement | null = null;
  private blackHoleStatusElement: HTMLElement | null = null;
  private achievementCountElement: HTMLElement | null = null;
  private achievementRows: HTMLElement[] = [];
  private wristbandButtons: HTMLButtonElement[] = [];
  private leftWristbandPreview: HTMLElement | null = null;
  private rightWristbandPreview: HTMLElement | null = null;
  private resetChoices: HTMLButtonElement[] = [];
  private resetConfirmation: HTMLElement | null = null;
  private resetConfirmationTitle: HTMLElement | null = null;
  private resetConfirmationCopy: HTMLElement | null = null;
  private resetConfirmButton: HTMLButtonElement | null = null;
  private resetCancelButton: HTMLButtonElement | null = null;
  private resetStatusElement: HTMLElement | null = null;
  private resetNormalValueElement: HTMLElement | null = null;
  private resetHardValueElement: HTMLElement | null = null;
  private resetAchievementsValueElement: HTMLElement | null = null;
  private nameEntryElement: HTMLElement | null = null;
  private playerNameInput: HTMLInputElement | null = null;
  private playerNameStatus: HTMLElement | null = null;
  private modePlayerNameElement: HTMLElement | null = null;
  private playerName = 'PLAYER';
  private pendingReset: ResetMenuTarget | null = null;
  private classicActionButton: ENGINE.Button | null = null;
  private epicActionButton: ENGINE.Button | null = null;
  private discoActionButton: ENGINE.Button | null = null;
  private blackHoleActionButton: ENGINE.Button | null = null;
  private progression = createDefaultProgressionState();
  private menuBall: HTMLButtonElement | null = null;
  private menuBallCanvas: HTMLCanvasElement | null = null;
  private menuBallRenderer: THREE.WebGLRenderer | null = null;
  private menuBallScene: THREE.Scene | null = null;
  private menuBallCamera: THREE.PerspectiveCamera | null = null;
  private menuBallModel: THREE.Group | null = null;
  private menuBallModelLoadToken = 0;
  private ballAnimationFrame: number | null = null;
  private ballPointerId: number | null = null;
  private ballX = 0;
  private ballY = 0;
  private ballVelocityX = 0;
  private ballVelocityY = 0;
  private ballRotation = 0;
  private ballGrabOffsetX = 0;
  private ballGrabOffsetY = 0;
  private ballLastPointerX = 0;
  private ballLastPointerY = 0;
  private ballLastPointerTime = 0;
  private ballLastFrameTime = 0;
  private ballHasPosition = false;

  private readonly handlePlayerNameInput = (): void => {
    if (!this.playerNameInput) return;
    const sanitized = this.sanitizePlayerName(this.playerNameInput.value);
    if (this.playerNameInput.value !== sanitized) this.playerNameInput.value = sanitized;
    if (this.playerNameStatus) this.playerNameStatus.textContent = '';
  };

  private readonly handlePlayerNameKeyDown = (event: KeyboardEvent): void => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      this.confirmPlayerName();
    }
  };

  private readonly handleBallPointerDown = (event: PointerEvent): void => {
    if (!this.menuBall || !this.rootElement || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rootBounds = this.rootElement.getBoundingClientRect();
    const ballBounds = this.menuBall.getBoundingClientRect();
    this.ballPointerId = event.pointerId;
    this.ballGrabOffsetX = event.clientX - ballBounds.left;
    this.ballGrabOffsetY = event.clientY - ballBounds.top;
    this.ballLastPointerX = event.clientX;
    this.ballLastPointerY = event.clientY;
    this.ballLastPointerTime = performance.now();
    this.ballVelocityX = 0;
    this.ballVelocityY = 0;
    this.stopBallPhysics();
    this.menuBall.dataset.grabbed = 'true';
    this.menuBall.setPointerCapture(event.pointerId);
    this.ballX = ballBounds.left - rootBounds.left;
    this.ballY = ballBounds.top - rootBounds.top;
  };

  private readonly handleBallPointerMove = (event: PointerEvent): void => {
    if (!this.menuBall || !this.rootElement || event.pointerId !== this.ballPointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const now = performance.now();
    const elapsed = Math.max((now - this.ballLastPointerTime) / 1000, 1 / 240);
    const rootBounds = this.rootElement.getBoundingClientRect();
    const maxX = Math.max(0, rootBounds.width - this.menuBall.offsetWidth);
    const maxY = Math.max(0, rootBounds.height - this.menuBall.offsetHeight);
    this.ballX = Math.max(0, Math.min(maxX, event.clientX - rootBounds.left - this.ballGrabOffsetX));
    this.ballY = Math.max(0, Math.min(maxY, event.clientY - rootBounds.top - this.ballGrabOffsetY));
    this.ballVelocityX = (event.clientX - this.ballLastPointerX) / elapsed;
    this.ballVelocityY = (event.clientY - this.ballLastPointerY) / elapsed;
    this.ballLastPointerX = event.clientX;
    this.ballLastPointerY = event.clientY;
    this.ballLastPointerTime = now;
    this.ballRotation += (this.ballVelocityX * elapsed / this.menuBall.offsetWidth) * 57.3;
    this.renderMenuBall();
  };

  private readonly handleBallPointerUp = (event: PointerEvent): void => {
    if (!this.menuBall || event.pointerId !== this.ballPointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.menuBall.hasPointerCapture(event.pointerId)) {
      this.menuBall.releasePointerCapture(event.pointerId);
    }
    this.menuBall.dataset.grabbed = 'false';
    this.ballPointerId = null;
    this.startBallPhysics();
  };

  private readonly handleBallClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly handleMenuResize = (): void => {
    this.clampMenuBall();
    this.resizeMenuBallRenderer();
    this.renderMenuBall();
  };

  private readonly handleVolumeInput = (): void => {
    if (!this.volumeInput) return;
    const volume = Number(this.volumeInput.value) / 100;
    if (this.volumeValue) this.volumeValue.textContent = `${Math.round(volume * 100)}%`;
    this.storeVolume(masterVolumeKey, volume);
    this.options.onVolumeChange(volume);
  };

  private readonly handleMusicVolumeInput = (): void => {
    if (!this.musicVolumeInput) return;
    const volume = Number(this.musicVolumeInput.value) / 100;
    if (this.musicVolumeValue) this.musicVolumeValue.textContent = `${Math.round(volume * 100)}%`;
    this.storeVolume(musicVolumeKey, volume);
    this.options.onMusicVolumeChange(volume);
  };

  private readonly handleSfxVolumeInput = (): void => {
    if (!this.sfxVolumeInput) return;
    const volume = Number(this.sfxVolumeInput.value) / 100;
    if (this.sfxVolumeValue) this.sfxVolumeValue.textContent = `${Math.round(volume * 100)}%`;
    this.storeVolume(sfxVolumeKey, volume);
    this.options.onSfxVolumeChange(volume);
  };

  private readonly handleReducedMotionInput = (): void => {
    const enabled = this.reducedMotionInput?.checked ?? false;
    this.storeBoolean(reducedMotionKey, enabled);
    this.options.onReducedMotionChange(enabled);
  };

  private readonly handleReducedFlashesInput = (): void => {
    const enabled = this.reducedFlashesInput?.checked ?? false;
    this.storeBoolean(reducedFlashesKey, enabled);
    this.options.onReducedFlashesChange(enabled);
  };

  private readonly handleWristbandClick = (event: Event): void => {
    const button = event.currentTarget as HTMLButtonElement;
    const side = button.dataset.wristbandSide as WristbandSide | undefined;
    const color = button.dataset.wristbandColor as WristbandColor | undefined;
    if (!side || !color || !wristbandColors.includes(color)) return;
    this.setProgression(this.options.onWristbandColorChange(side, color));
  };

  private readonly handleResetChoice = (event: Event): void => {
    const button = event.currentTarget as HTMLButtonElement;
    const target = button.dataset.resetChoice;
    if (!this.isResetMenuTarget(target)) return;
    for (const choice of this.resetChoices) {
      choice.setAttribute('aria-pressed', String(choice === button));
    }
    this.pendingReset = target;
    if (this.resetConfirmationTitle) {
      this.resetConfirmationTitle.textContent = this.getResetConfirmationCopy(target);
    }
    if (this.resetConfirmationCopy) {
      this.resetConfirmationCopy.textContent = target === 'freshStart'
        ? 'This clears the username, scores, stars, purchases, achievements, cosmetics, and sound settings.'
        : 'Only this selection will be reset.';
    }
    if (this.resetConfirmation) this.resetConfirmation.dataset.active = 'true';
    if (this.resetStatusElement) this.resetStatusElement.textContent = '';
  };

  private readonly handleResetCancel = (): void => {
    this.closeResetConfirmation();
  };

  private readonly handleResetConfirm = (): void => {
    const target = this.pendingReset;
    if (!target) return;
    if (target === 'audio') {
      this.resetAudioSettings();
    } else if (target === 'freshStart') {
      this.setProgression(this.options.onResetProgression(target));
      this.resetAudioSettings();
      if (this.reducedMotionInput) this.reducedMotionInput.checked = false;
      if (this.reducedFlashesInput) this.reducedFlashesInput.checked = false;
      this.options.onReducedMotionChange(false);
      this.options.onReducedFlashesChange(false);
      try {
        localStorage.removeItem(playerNameKey);
        localStorage.removeItem(reducedMotionKey);
        localStorage.removeItem(reducedFlashesKey);
      } catch {
        // The saved profile may remain when browser storage is unavailable.
      }
    } else {
      this.setProgression(this.options.onResetProgression(target));
    }
    if (this.resetStatusElement) {
      this.resetStatusElement.textContent = this.getResetSuccessCopy(target);
    }
    this.closeResetConfirmation();
  };

  protected override getAssetPaths(): { templatePath: string; stylesPath: string } {
    return {
      templatePath: DribbleMainMenu.metadata.assetPaths.template,
      stylesPath: DribbleMainMenu.metadata.assetPaths.styles,
    };
  }

  protected override getDefaultOptions(): Required<DribbleMainMenuOptions> {
    return {
      position: 'center',
      visible: true,
      customClasses: [],
      customStyles: {},
      onPlay: () => {},
      onTutorial: () => {},
      onVolumeChange: () => {},
      onMusicVolumeChange: () => {},
      onSfxVolumeChange: () => {},
      onReducedMotionChange: () => {},
      onReducedFlashesChange: () => {},
      onBallBounce: () => {},
      onExit: () => {},
      progression: createDefaultProgressionState(),
      onPurchaseBall: () => createDefaultProgressionState(),
      onEquipBall: () => createDefaultProgressionState(),
      onWristbandColorChange: () => createDefaultProgressionState(),
      onResetProgression: () => createDefaultProgressionState(),
    };
  }

  protected override getInitialData(): Record<string, string> {
    return {};
  }

  protected override cacheElements(): void {
    if (!this.layout) return;
    this.rootElement = this.layout.querySelector('[data-main-menu]') as HTMLElement | null;
    this.volumeInput = this.layout.querySelector('[data-menu-volume]') as HTMLInputElement | null;
    this.volumeValue = this.layout.querySelector('[data-menu-volume-value]') as HTMLElement | null;
    this.musicVolumeInput = this.layout.querySelector('[data-menu-music-volume]') as HTMLInputElement | null;
    this.musicVolumeValue = this.layout.querySelector('[data-menu-music-volume-value]') as HTMLElement | null;
    this.sfxVolumeInput = this.layout.querySelector('[data-menu-sfx-volume]') as HTMLInputElement | null;
    this.sfxVolumeValue = this.layout.querySelector('[data-menu-sfx-volume-value]') as HTMLElement | null;
    this.reducedMotionInput = this.layout.querySelector('[data-menu-reduced-motion]') as HTMLInputElement | null;
    this.reducedFlashesInput = this.layout.querySelector('[data-menu-reduced-flashes]') as HTMLInputElement | null;
    this.homeStarsElement = this.layout.querySelector('[data-menu-stars]') as HTMLElement | null;
    this.normalHighScoreElement = this.layout.querySelector('[data-menu-normal-high-score]') as HTMLElement | null;
    this.hardHighScoreElement = this.layout.querySelector('[data-menu-hard-high-score]') as HTMLElement | null;
    this.shopStarsElement = this.layout.querySelector('[data-shop-stars]') as HTMLElement | null;
    this.shopGoalElement = this.layout.querySelector('[data-shop-goal]') as HTMLElement | null;
    this.classicStatusElement = this.layout.querySelector('[data-shop-classic-status]') as HTMLElement | null;
    this.epicStatusElement = this.layout.querySelector('[data-shop-epic-status]') as HTMLElement | null;
    this.discoStatusElement = this.layout.querySelector('[data-shop-disco-status]') as HTMLElement | null;
    this.blackHoleStatusElement = this.layout.querySelector('[data-shop-blackhole-status]') as HTMLElement | null;
    this.achievementCountElement = this.layout.querySelector('[data-achievement-count]') as HTMLElement | null;
    this.achievementRows = Array.from(this.layout.querySelectorAll('[data-achievement-id]')) as HTMLElement[];
    this.wristbandButtons = Array.from(this.layout.querySelectorAll('[data-wristband-color]')) as HTMLButtonElement[];
    this.leftWristbandPreview = this.layout.querySelector('[data-wristband-preview="left"]') as HTMLElement | null;
    this.rightWristbandPreview = this.layout.querySelector('[data-wristband-preview="right"]') as HTMLElement | null;
    this.resetChoices = Array.from(this.layout.querySelectorAll('[data-reset-choice]')) as HTMLButtonElement[];
    this.resetConfirmation = this.layout.querySelector('[data-reset-confirmation]') as HTMLElement | null;
    this.resetConfirmationTitle = this.layout.querySelector('[data-reset-confirm-title]') as HTMLElement | null;
    this.resetConfirmationCopy = this.layout.querySelector('[data-reset-confirm-copy]') as HTMLElement | null;
    this.resetConfirmButton = this.layout.querySelector('[data-reset-confirm]') as HTMLButtonElement | null;
    this.resetCancelButton = this.layout.querySelector('[data-reset-cancel]') as HTMLButtonElement | null;
    this.resetStatusElement = this.layout.querySelector('[data-reset-status]') as HTMLElement | null;
    this.resetNormalValueElement = this.layout.querySelector('[data-reset-normal-value]') as HTMLElement | null;
    this.resetHardValueElement = this.layout.querySelector('[data-reset-hard-value]') as HTMLElement | null;
    this.resetAchievementsValueElement = this.layout.querySelector('[data-reset-achievements-value]') as HTMLElement | null;
    this.nameEntryElement = this.layout.querySelector('[data-name-entry]') as HTMLElement | null;
    this.playerNameInput = this.layout.querySelector('[data-player-name-input]') as HTMLInputElement | null;
    this.playerNameStatus = this.layout.querySelector('[data-player-name-status]') as HTMLElement | null;
    this.modePlayerNameElement = this.layout.querySelector('[data-mode-player-name]') as HTMLElement | null;
    this.menuBall = this.layout.querySelector('[data-menu-ball]') as HTMLButtonElement | null;
    this.menuBallCanvas = this.layout.querySelector('[data-menu-ball-canvas]') as HTMLCanvasElement | null;
  }

  protected override async onInitialize(): Promise<void> {
    if (!this.layout) return;
    const slot = (name: string): HTMLElement | null => (
      this.layout?.querySelector(`[data-menu-${name}-slot]`) as HTMLElement | null
    );
    const playSlot = slot('play');
    const normalModeSlot = slot('normal-mode');
    const hardModeSlot = slot('hard-mode');
    const lastBounceModeSlot = slot('last-bounce-mode');
    const classicTutorialSlot = slot('classic-tutorial');
    const lastBounceTutorialSlot = slot('last-bounce-tutorial');
    const nameConfirmSlot = slot('name-confirm');
    const modeBackSlot = slot('mode-back');
    const tutorialBackSlot = slot('tutorial-back');
    const howSlot = slot('how');
    const settingsSlot = slot('settings');
    const shopSlot = slot('shop');
    const resetSlot = slot('reset');
    const exitSlot = slot('exit');
    const achievementsSlot = slot('achievements');
    const howBackSlot = slot('how-back');
    const settingsBackSlot = slot('settings-back');
    const shopBackSlot = slot('shop-back');
    const achievementsBackSlot = slot('achievements-back');
    const resetBackSlot = slot('reset-back');
    const classicActionSlot = slot('classic-action');
    const epicActionSlot = slot('epic-action');
    const discoActionSlot = slot('disco-action');
    const blackHoleActionSlot = slot('blackhole-action');
    if (
      !playSlot || !normalModeSlot || !hardModeSlot || !lastBounceModeSlot
      || !classicTutorialSlot || !lastBounceTutorialSlot
      || !nameConfirmSlot || !modeBackSlot || !tutorialBackSlot
      || !howSlot || !settingsSlot || !shopSlot || !resetSlot || !exitSlot || !achievementsSlot || !howBackSlot
      || !settingsBackSlot || !shopBackSlot || !achievementsBackSlot || !resetBackSlot
      || !classicActionSlot || !epicActionSlot
      || !discoActionSlot || !blackHoleActionSlot
    ) return;

    const mounted = await Promise.all([
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.primaryLarge,
        label: 'Play',
        onClick: () => this.showPanel('mode-select'),
      }, playSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.primaryLarge,
        label: 'Normal',
        onClick: () => this.options.onPlay('normal'),
      }, normalModeSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Hard',
        onClick: () => this.options.onPlay('hard'),
      }, hardModeSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Last Bounce',
        onClick: () => this.options.onPlay('last-bounce'),
      }, lastBounceModeSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.primaryLarge,
        label: 'Classic',
        onClick: () => this.options.onTutorial('classic'),
      }, classicTutorialSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Last Bounce',
        onClick: () => this.options.onTutorial('last-bounce'),
      }, lastBounceTutorialSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.primaryLarge,
        label: 'Confirm',
        onClick: () => this.confirmPlayerName(),
      }, nameConfirmSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Back',
        onClick: () => this.showPanel('home'),
      }, modeBackSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Back',
        onClick: () => this.showPanel('home'),
      }, tutorialBackSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Tutorial',
        onClick: () => this.showPanel('tutorial-select'),
      }, howSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Settings',
        onClick: () => this.showPanel('settings'),
      }, settingsSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Shop',
        onClick: () => this.showPanel('shop'),
      }, shopSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Reset',
        onClick: () => this.showPanel('reset'),
      }, resetSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Exit',
        onClick: () => this.options.onExit(),
      }, exitSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Achievements',
        onClick: () => this.showPanel('achievements'),
      }, achievementsSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Back',
        onClick: () => this.showPanel('home'),
      }, howBackSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Back',
        onClick: () => this.showPanel('home'),
      }, settingsBackSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Back',
        onClick: () => this.showPanel('home'),
      }, shopBackSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Close',
        onClick: () => this.showPanel('home'),
      }, achievementsBackSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Back',
        onClick: () => this.showPanel('home'),
      }, resetBackSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.primaryLarge,
        label: 'Equipped',
        disabled: true,
        onClick: () => this.handleClassicAction(),
      }, classicActionSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.primaryLarge,
        label: `Buy - ${epicBallPrice} Stars`,
        onClick: () => this.handleBallAction('epic'),
      }, epicActionSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.primaryLarge,
        label: `Buy - ${discoBallPrice} Stars`,
        onClick: () => this.handleBallAction('disco'),
      }, discoActionSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.primaryLarge,
        label: `Buy - ${blackHoleBallPrice} Stars`,
        onClick: () => this.handleBallAction('blackhole'),
      }, blackHoleActionSlot),
    ]);
    this.classicActionButton = mounted[mounted.length - 4];
    this.epicActionButton = mounted[mounted.length - 3];
    this.discoActionButton = mounted[mounted.length - 2];
    this.blackHoleActionButton = mounted[mounted.length - 1];
    this.playerName = this.loadPlayerName() ?? 'PLAYER';
    this.refreshPlayerNameUi();
    this.setProgression(this.options.progression);

    const volume = this.loadVolume(masterVolumeKey, defaultMasterVolume);
    const musicVolume = this.loadVolume(musicVolumeKey, defaultMusicVolume);
    const sfxVolume = this.loadVolume(sfxVolumeKey, defaultSfxVolume);
    if (this.volumeInput) {
      this.volumeInput.value = String(Math.round(volume * 100));
      this.volumeInput.addEventListener('input', this.handleVolumeInput);
    }
    if (this.musicVolumeInput) {
      this.musicVolumeInput.value = String(Math.round(musicVolume * 100));
      this.musicVolumeInput.addEventListener('input', this.handleMusicVolumeInput);
    }
    if (this.sfxVolumeInput) {
      this.sfxVolumeInput.value = String(Math.round(sfxVolume * 100));
      this.sfxVolumeInput.addEventListener('input', this.handleSfxVolumeInput);
    }
    if (this.volumeValue) this.volumeValue.textContent = `${Math.round(volume * 100)}%`;
    if (this.musicVolumeValue) this.musicVolumeValue.textContent = `${Math.round(musicVolume * 100)}%`;
    if (this.sfxVolumeValue) this.sfxVolumeValue.textContent = `${Math.round(sfxVolume * 100)}%`;
    this.options.onVolumeChange(volume);
    this.options.onMusicVolumeChange(musicVolume);
    this.options.onSfxVolumeChange(sfxVolume);
    const reducedMotion = this.loadBoolean(reducedMotionKey);
    const reducedFlashes = this.loadBoolean(reducedFlashesKey);
    if (this.reducedMotionInput) this.reducedMotionInput.checked = reducedMotion;
    if (this.reducedFlashesInput) this.reducedFlashesInput.checked = reducedFlashes;
    this.options.onReducedMotionChange(reducedMotion);
    this.options.onReducedFlashesChange(reducedFlashes);

    this.reducedMotionInput?.addEventListener('change', this.handleReducedMotionInput);
    this.reducedFlashesInput?.addEventListener('change', this.handleReducedFlashesInput);
    this.playerNameInput?.addEventListener('input', this.handlePlayerNameInput);
    this.playerNameInput?.addEventListener('keydown', this.handlePlayerNameKeyDown);
    this.resetConfirmButton?.addEventListener('click', this.handleResetConfirm);
    this.resetCancelButton?.addEventListener('click', this.handleResetCancel);
    for (const button of this.resetChoices) {
      button.addEventListener('click', this.handleResetChoice);
    }
    this.menuBall?.addEventListener('pointerdown', this.handleBallPointerDown);
    this.menuBall?.addEventListener('pointermove', this.handleBallPointerMove);
    this.menuBall?.addEventListener('pointerup', this.handleBallPointerUp);
    this.menuBall?.addEventListener('pointercancel', this.handleBallPointerUp);
    this.menuBall?.addEventListener('click', this.handleBallClick);
    for (const button of this.wristbandButtons) {
      button.addEventListener('click', this.handleWristbandClick);
    }
    window.addEventListener('resize', this.handleMenuResize);
    this.showPanel('home');
    await this.preloadCriticalMenuAssets();
    this.showPlayerNameEntryIfNeeded();
    void this.setupMenuBallModel();
    requestAnimationFrame(() => {
      this.resetMenuBall();
      this.startBallPhysics();
    });
  }

  private async preloadCriticalMenuAssets(): Promise<void> {
    const logicalPaths = [
      '@project/assets/textures/main-menu-background.png',
      '@project/assets/textures/Basketball_frenzy_logo.png',
      '@project/assets/textures/play_button_background.png',
      '@project/assets/textures/Confirm_button.png',
      '@project/assets/textures/pause-menu-background.png',
      '@project/assets/textures/resumebutton.png',
      '@project/assets/textures/menu_button.png',
      '@project/assets/textures/Tutorial.png',
      '@project/assets/textures/Settings.png',
      '@project/assets/textures/Shop.png',
      '@project/assets/textures/Star.png',
      '@project/assets/textures/Heart.png',
      '@project/assets/textures/classicball.png',
      '@project/assets/textures/blueball.png',
      '@project/assets/textures/Discoball.png',
      '@project/assets/textures/Blackholeball.png',
      '@project/assets/textures/Achievments.png',
      '@project/assets/textures/achievementsbutton.png',
      '@project/assets/textures/10000pointsinonegame.png',
      '@project/assets/textures/First purchase.png',
      '@project/assets/textures/play tutorial.png',
      '@project/assets/textures/Star without switching lanes.png',
      '@project/assets/textures/First point.png',
      '@project/assets/textures/close.png',
      '@project/assets/textures/Back.png',
      '@project/assets/textures/Reset.png',
      '@project/assets/textures/exit.png',
      '@project/assets/textures/mouse.png',
    ];
    const resolvedPaths = await Promise.all(
      logicalPaths.map(path => ENGINE.resolveAssetPathsInText(path)),
    );
    await Promise.all([
      ...resolvedPaths.map(path => this.preloadImage(path)),
      document.fonts?.load('32px Boogaloo').catch(() => []),
    ]);
  }

  private preloadImage(path: string): Promise<void> {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => resolve();
      image.src = path;
      if (image.complete) resolve();
    });
  }

  public showHome(): void {
    this.showPanel('home');
    this.show();
  }

  public getPlayerName(): string {
    return this.playerName;
  }

  private showPanel(panel: MainMenuPanel): void {
    if (this.rootElement) this.rootElement.dataset.panel = panel;
    if (panel === 'shop' || panel === 'achievements' || panel === 'reset') this.refreshProgressionUi();
    if (panel !== 'reset') this.closeResetConfirmation();
    if (this.resetStatusElement) this.resetStatusElement.textContent = '';
    if (panel === 'home') this.startBallPhysics();
    else {
      this.stopBallPhysics();
      this.cancelBallDrag();
    }
  }

  private showPlayerNameEntryIfNeeded(): void {
    if (this.loadPlayerName()) return;
    if (this.nameEntryElement) this.nameEntryElement.dataset.active = 'true';
    this.stopBallPhysics();
    requestAnimationFrame(() => this.playerNameInput?.focus());
  }

  private confirmPlayerName(): void {
    const name = this.sanitizePlayerName(this.playerNameInput?.value ?? '').trim();
    if (name.length < 2) {
      if (this.playerNameStatus) this.playerNameStatus.textContent = 'Enter at least 2 characters.';
      this.playerNameInput?.focus();
      return;
    }
    this.playerName = name;
    try {
      localStorage.setItem(playerNameKey, name);
    } catch {
      // The current session still uses the selected name when storage is unavailable.
    }
    this.refreshPlayerNameUi();
    if (this.nameEntryElement) this.nameEntryElement.dataset.active = 'false';
    this.startBallPhysics();
  }

  private sanitizePlayerName(value: string): string {
    return value
      .toUpperCase()
      .replace(/[^A-Z0-9 _-]/g, '')
      .replace(/\s+/g, ' ')
      .trimStart()
      .slice(0, 14);
  }

  private loadPlayerName(): string | null {
    try {
      const stored = localStorage.getItem(playerNameKey);
      if (!stored) return null;
      const sanitized = this.sanitizePlayerName(stored).trim();
      return sanitized.length >= 2 ? sanitized : null;
    } catch {
      return null;
    }
  }

  private refreshPlayerNameUi(): void {
    if (this.modePlayerNameElement) this.modePlayerNameElement.textContent = this.playerName;
  }

  public setProgression(progression: DribbleProgressionState): void {
    this.progression = { ...progression };
    this.refreshProgressionUi();
  }

  private handleClassicAction(): void {
    this.setProgression(this.options.onEquipBall('classic'));
  }

  private handleBallAction(cosmetic: BallCosmetic): void {
    if (!isBallOwned(this.progression, cosmetic)) {
      this.setProgression(this.options.onPurchaseBall(cosmetic));
      return;
    }
    this.setProgression(this.options.onEquipBall(cosmetic));
  }

  private refreshProgressionUi(): void {
    const { stars, normalHighScore, hardHighScore, equippedBall } = this.progression;
    if (this.homeStarsElement) this.homeStarsElement.textContent = String(stars);
    if (this.normalHighScoreElement) this.normalHighScoreElement.textContent = String(normalHighScore);
    if (this.hardHighScoreElement) this.hardHighScoreElement.textContent = String(hardHighScore);
    if (this.shopStarsElement) this.shopStarsElement.textContent = String(stars);
    this.refreshShopGoal();
    if (this.classicStatusElement) {
      this.classicStatusElement.textContent = equippedBall === 'classic' ? 'EQUIPPED' : 'OWNED';
    }
    this.refreshBallStatus(this.epicStatusElement, 'epic');
    this.refreshBallStatus(this.discoStatusElement, 'disco');
    this.refreshBallStatus(this.blackHoleStatusElement, 'blackhole');
    if (this.rootElement) {
      this.rootElement.dataset.epicOwned = this.progression.epicBallOwned ? 'true' : 'false';
      this.rootElement.dataset.epicEquipped = equippedBall === 'epic' ? 'true' : 'false';
    }
    this.classicActionButton?.setLabel(equippedBall === 'classic' ? 'Equipped' : 'Equip');
    this.classicActionButton?.setDisabled(equippedBall === 'classic');
    this.refreshBallAction(this.epicActionButton, 'epic');
    this.refreshBallAction(this.discoActionButton, 'disco');
    this.refreshBallAction(this.blackHoleActionButton, 'blackhole');
    this.refreshAchievementsUi();
    this.refreshWristbandUi();
    this.refreshResetUi();
  }

  private refreshShopGoal(): void {
    if (!this.shopGoalElement) return;
    const next = !this.progression.epicBallOwned
      ? { name: 'Epic Ball', price: epicBallPrice }
      : !this.progression.discoBallOwned
        ? { name: 'Disco Ball', price: discoBallPrice }
        : !this.progression.blackHoleBallOwned
          ? { name: 'Black Hole', price: blackHoleBallPrice }
          : null;
    if (!next) {
      this.shopGoalElement.textContent = 'Collection complete';
      return;
    }
    const remaining = Math.max(0, next.price - this.progression.stars);
    this.shopGoalElement.textContent = remaining === 0
      ? `${next.name} ready to unlock`
      : `${remaining} stars to ${next.name}`;
  }

  private refreshResetUi(): void {
    if (this.resetNormalValueElement) {
      this.resetNormalValueElement.textContent = `${this.progression.normalHighScore} points`;
    }
    if (this.resetHardValueElement) {
      this.resetHardValueElement.textContent = `${this.progression.hardHighScore} points`;
    }
    if (this.resetAchievementsValueElement) {
      const completed = achievementIds.filter(id => this.progression.achievements[id]).length;
      this.resetAchievementsValueElement.textContent = `${completed} of ${achievementIds.length} complete`;
    }
  }

  private refreshWristbandUi(): void {
    const selected: Record<WristbandSide, WristbandColor> = {
      left: this.progression.leftWristbandColor,
      right: this.progression.rightWristbandColor,
    };
    for (const button of this.wristbandButtons) {
      const side = button.dataset.wristbandSide as WristbandSide | undefined;
      const color = button.dataset.wristbandColor as WristbandColor | undefined;
      const isSelected = side !== undefined && color !== undefined && selected[side] === color;
      button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    }
    this.leftWristbandPreview?.style.setProperty('--wristband-color', wristbandColorHex[selected.left]);
    this.rightWristbandPreview?.style.setProperty('--wristband-color', wristbandColorHex[selected.right]);
  }

  private refreshAchievementsUi(): void {
    let completed = 0;
    for (const row of this.achievementRows) {
      const achievement = row.dataset.achievementId as AchievementId | undefined;
      const unlocked = achievement !== undefined
        && achievementIds.includes(achievement)
        && this.progression.achievements[achievement];
      row.dataset.unlocked = unlocked ? 'true' : 'false';
      const state = row.querySelector('.dribble-achievement-state');
      if (state) state.textContent = unlocked ? 'COMPLETE' : 'LOCKED';
      if (unlocked) completed += 1;
    }
    if (this.achievementCountElement) this.achievementCountElement.textContent = String(completed);
  }

  private refreshBallStatus(element: HTMLElement | null, cosmetic: BallCosmetic): void {
    if (!element) return;
    element.textContent = !isBallOwned(this.progression, cosmetic)
      ? 'LOCKED'
      : this.progression.equippedBall === cosmetic
        ? 'EQUIPPED'
        : 'OWNED';
  }

  private refreshBallAction(button: ENGINE.Button | null, cosmetic: BallCosmetic): void {
    if (!button) return;
    const price = getBallPrice(cosmetic);
    if (!isBallOwned(this.progression, cosmetic)) {
      button.setLabel(`Buy - ${price} ${price === 1 ? 'Star' : 'Stars'}`);
      button.setDisabled(this.progression.stars < price);
    } else if (this.progression.equippedBall === cosmetic) {
      button.setLabel('Equipped');
      button.setDisabled(true);
    } else {
      button.setLabel('Equip');
      button.setDisabled(false);
    }
  }

  protected override onShow(): void {
    if (this.rootElement?.dataset.panel === 'home') this.startBallPhysics();
    if (!this.menuBallRenderer) void this.setupMenuBallModel();
  }

  protected override onHide(): void {
    this.stopBallPhysics();
    this.cancelBallDrag();
    this.disposeMenuBallModel();
  }

  private resetMenuBall(): void {
    if (!this.rootElement || !this.menuBall) return;
    const bounds = this.rootElement.getBoundingClientRect();
    this.ballX = Math.max(12, bounds.width * 0.76 - this.menuBall.offsetWidth * 0.5);
    this.ballY = Math.max(24, bounds.height * 0.16);
    this.ballVelocityX = -80;
    this.ballVelocityY = 30;
    this.ballRotation = 0;
    this.ballHasPosition = true;
    this.clampMenuBall();
    this.renderMenuBall();
  }

  private startBallPhysics(): void {
    if (this.ballAnimationFrame !== null || !this.menuBall || !this.rootElement) return;
    if (!this.ballHasPosition) this.resetMenuBall();
    this.ballLastFrameTime = performance.now();
    this.ballAnimationFrame = requestAnimationFrame(this.updateBallPhysics);
  }

  private stopBallPhysics(): void {
    if (this.ballAnimationFrame !== null) cancelAnimationFrame(this.ballAnimationFrame);
    this.ballAnimationFrame = null;
  }

  private readonly updateBallPhysics = (time: number): void => {
    this.ballAnimationFrame = null;
    if (!this.menuBall || !this.rootElement || this.rootElement.dataset.panel !== 'home') return;
    const deltaTime = Math.min(Math.max((time - this.ballLastFrameTime) / 1000, 0), 1 / 30);
    this.ballLastFrameTime = time;

    if (this.ballPointerId === null) {
      const size = this.menuBall.offsetWidth;
      const maxX = Math.max(0, this.rootElement.clientWidth - size);
      const floorY = this.getMenuBallFloorY();
      this.ballVelocityY += 1850 * deltaTime;
      this.ballX += this.ballVelocityX * deltaTime;
      this.ballY += this.ballVelocityY * deltaTime;
      this.ballRotation += (this.ballVelocityX * deltaTime / Math.max(size, 1)) * 57.3;

      if (this.ballX <= 0 || this.ballX >= maxX) {
        this.ballX = Math.max(0, Math.min(maxX, this.ballX));
        this.ballVelocityX *= -0.72;
      }
      if (this.ballY <= 0) {
        this.ballY = 0;
        this.ballVelocityY = Math.abs(this.ballVelocityY) * 0.68;
      }
      if (this.ballY >= floorY) {
        const impactVelocity = this.ballVelocityY;
        this.ballY = floorY;
        if (this.ballVelocityY > 52) {
          this.ballVelocityY *= -0.68;
          if (impactVelocity >= 120) {
            this.options.onBallBounce(THREE.MathUtils.clamp(impactVelocity / 1100, 0.18, 1));
          }
        }
        else if (this.ballVelocityY >= 0) this.ballVelocityY = 0;
        this.ballVelocityX *= Math.pow(0.76, deltaTime * 8);
        if (Math.abs(this.ballVelocityX) < 4) this.ballVelocityX = 0;
      }
      this.renderMenuBall();
      if (this.ballVelocityX === 0 && this.ballVelocityY === 0 && this.ballY >= floorY) {
        return;
      }
    }

    this.ballAnimationFrame = requestAnimationFrame(this.updateBallPhysics);
  };

  private clampMenuBall(): void {
    if (!this.rootElement || !this.menuBall) return;
    this.ballX = Math.max(
      0,
      Math.min(Math.max(0, this.rootElement.clientWidth - this.menuBall.offsetWidth), this.ballX),
    );
    this.ballY = Math.max(0, Math.min(this.getMenuBallFloorY(), this.ballY));
  }

  private getMenuBallFloorY(): number {
    if (!this.rootElement || !this.menuBall) return 0;
    const collisionLine = this.rootElement.clientHeight * 0.76;
    return Math.max(0, collisionLine - this.menuBall.offsetHeight);
  }

  private renderMenuBall(): void {
    if (!this.menuBall) return;
    this.menuBall.style.transform = `translate3d(${this.ballX}px, ${this.ballY}px, 0)`;
    if (this.menuBallModel) {
      const rotation = THREE.MathUtils.degToRad(this.ballRotation);
      this.menuBallModel.rotation.set(rotation * 0.34, rotation, -rotation * 0.18);
    }
    if (this.menuBallRenderer && this.menuBallScene && this.menuBallCamera) {
      this.menuBallRenderer.render(this.menuBallScene, this.menuBallCamera);
    }
  }

  private async setupMenuBallModel(): Promise<void> {
    if (!this.menuBallCanvas || this.menuBallRenderer) return;
    const loadToken = ++this.menuBallModelLoadToken;
    const renderer = new THREE.WebGLRenderer({
      canvas: this.menuBallCanvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 20);
    camera.position.set(0, 0.05, 3.1);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffe1bd, 0x29466c, 2.15));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
    keyLight.position.set(-2.5, 3.5, 4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x65d5ff, 1.35);
    rimLight.position.set(3, 1, -2);
    scene.add(rimLight);

    this.menuBallRenderer = renderer;
    this.menuBallScene = scene;
    this.menuBallCamera = camera;
    this.resizeMenuBallRenderer();
    this.renderMenuBall();

    try {
      const modelUrl = await ENGINE.resolveAssetPathsInText('@project/assets/models/ball_runtime.glb');
      const gltf = await new GLTFLoader().loadAsync(modelUrl);
      if (loadToken !== this.menuBallModelLoadToken || !this.menuBallScene) {
        this.disposeThreeObject(gltf.scene);
        return;
      }
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const model = new THREE.Group();
      gltf.scene.position.copy(center).multiplyScalar(-1);
      model.add(gltf.scene);
      model.scale.setScalar(1.72 / Math.max(size.x, size.y, size.z, 0.001));
      model.rotation.set(-0.12, 0.45, -0.08);
      this.menuBallModel = model;
      this.menuBallScene.add(model);
      this.renderMenuBall();
    } catch (error) {
      if (loadToken === this.menuBallModelLoadToken) {
        console.warn('Could not load the main-menu basketball model', error);
      }
    }
  }

  private resizeMenuBallRenderer(): void {
    if (!this.menuBallRenderer || !this.menuBall || !this.menuBallCamera) return;
    const size = Math.max(this.menuBall.offsetWidth, 1);
    this.menuBallRenderer.setSize(size, size, false);
    this.menuBallCamera.aspect = 1;
    this.menuBallCamera.updateProjectionMatrix();
  }

  private disposeMenuBallModel(): void {
    this.menuBallModelLoadToken += 1;
    if (this.menuBallModel) this.disposeThreeObject(this.menuBallModel);
    this.menuBallModel?.removeFromParent();
    this.menuBallModel = null;
    this.menuBallScene = null;
    this.menuBallCamera = null;
    this.menuBallRenderer?.renderLists.dispose();
    this.menuBallRenderer?.dispose();
    this.menuBallRenderer = null;
  }

  private disposeThreeObject(root: THREE.Object3D): void {
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        material.dispose();
      }
    });
  }

  private cancelBallDrag(): void {
    if (!this.menuBall || this.ballPointerId === null) return;
    if (this.menuBall.hasPointerCapture(this.ballPointerId)) {
      this.menuBall.releasePointerCapture(this.ballPointerId);
    }
    this.menuBall.dataset.grabbed = 'false';
    this.ballPointerId = null;
  }

  private isResetMenuTarget(value: string | undefined): value is ResetMenuTarget {
    return value === 'normalHighScore'
      || value === 'hardHighScore'
      || value === 'achievements'
      || value === 'audio'
      || value === 'freshStart';
  }

  private getResetConfirmationCopy(target: ResetMenuTarget): string {
    if (target === 'normalHighScore') return 'Reset your Normal best score?';
    if (target === 'hardHighScore') return 'Reset your Hard best score?';
    if (target === 'achievements') return 'Reset all achievement progress?';
    if (target === 'freshStart') return 'Erase the entire local player profile?';
    return 'Restore the default sound mix?';
  }

  private getResetSuccessCopy(target: ResetMenuTarget): string {
    if (target === 'normalHighScore') return 'Normal best score reset.';
    if (target === 'hardHighScore') return 'Hard best score reset.';
    if (target === 'achievements') return 'Achievement progress reset.';
    if (target === 'freshStart') return 'Fresh start armed. Reopen the game to begin again.';
    return 'Sound settings restored.';
  }

  private closeResetConfirmation(): void {
    this.pendingReset = null;
    if (this.resetConfirmation) this.resetConfirmation.dataset.active = 'false';
    for (const choice of this.resetChoices) {
      choice.setAttribute('aria-pressed', 'false');
    }
  }

  private resetAudioSettings(): void {
    this.applyVolumeSetting(
      this.volumeInput,
      this.volumeValue,
      masterVolumeKey,
      defaultMasterVolume,
      this.options.onVolumeChange,
    );
    this.applyVolumeSetting(
      this.musicVolumeInput,
      this.musicVolumeValue,
      musicVolumeKey,
      defaultMusicVolume,
      this.options.onMusicVolumeChange,
    );
    this.applyVolumeSetting(
      this.sfxVolumeInput,
      this.sfxVolumeValue,
      sfxVolumeKey,
      defaultSfxVolume,
      this.options.onSfxVolumeChange,
    );
  }

  private applyVolumeSetting(
    input: HTMLInputElement | null,
    output: HTMLElement | null,
    key: string,
    volume: number,
    callback: (value: number) => void,
  ): void {
    if (input) input.value = String(Math.round(volume * 100));
    if (output) output.textContent = `${Math.round(volume * 100)}%`;
    this.storeVolume(key, volume);
    callback(volume);
  }

  private loadVolume(key: string, fallback: number): number {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return fallback;
      const value = Number(stored);
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
    } catch {
      return fallback;
    }
  }

  private storeVolume(key: string, volume: number): void {
    try {
      localStorage.setItem(key, String(volume));
    } catch {
      // Audio remains adjustable for the current session when storage is unavailable.
    }
  }

  private loadBoolean(key: string): boolean {
    try {
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  }

  private storeBoolean(key: string, enabled: boolean): void {
    try {
      localStorage.setItem(key, String(enabled));
    } catch {
      // Accessibility preferences remain active for the current session.
    }
  }

  protected override onDestroy(): void {
    this.volumeInput?.removeEventListener('input', this.handleVolumeInput);
    this.musicVolumeInput?.removeEventListener('input', this.handleMusicVolumeInput);
    this.sfxVolumeInput?.removeEventListener('input', this.handleSfxVolumeInput);
    this.reducedMotionInput?.removeEventListener('change', this.handleReducedMotionInput);
    this.reducedFlashesInput?.removeEventListener('change', this.handleReducedFlashesInput);
    this.playerNameInput?.removeEventListener('input', this.handlePlayerNameInput);
    this.playerNameInput?.removeEventListener('keydown', this.handlePlayerNameKeyDown);
    this.resetConfirmButton?.removeEventListener('click', this.handleResetConfirm);
    this.resetCancelButton?.removeEventListener('click', this.handleResetCancel);
    for (const button of this.resetChoices) {
      button.removeEventListener('click', this.handleResetChoice);
    }
    this.menuBall?.removeEventListener('pointerdown', this.handleBallPointerDown);
    this.menuBall?.removeEventListener('pointermove', this.handleBallPointerMove);
    this.menuBall?.removeEventListener('pointerup', this.handleBallPointerUp);
    this.menuBall?.removeEventListener('pointercancel', this.handleBallPointerUp);
    this.menuBall?.removeEventListener('click', this.handleBallClick);
    for (const button of this.wristbandButtons) {
      button.removeEventListener('click', this.handleWristbandClick);
    }
    window.removeEventListener('resize', this.handleMenuResize);
    this.stopBallPhysics();
    this.cancelBallDrag();
    this.disposeMenuBallModel();
    this.rootElement = null;
    this.volumeInput = null;
    this.volumeValue = null;
    this.musicVolumeInput = null;
    this.musicVolumeValue = null;
    this.sfxVolumeInput = null;
    this.sfxVolumeValue = null;
    this.reducedMotionInput = null;
    this.reducedFlashesInput = null;
    this.homeStarsElement = null;
    this.normalHighScoreElement = null;
    this.hardHighScoreElement = null;
    this.shopStarsElement = null;
    this.shopGoalElement = null;
    this.classicStatusElement = null;
    this.epicStatusElement = null;
    this.wristbandButtons = [];
    this.leftWristbandPreview = null;
    this.rightWristbandPreview = null;
    this.resetChoices = [];
    this.resetConfirmation = null;
    this.resetConfirmationTitle = null;
    this.resetConfirmationCopy = null;
    this.resetConfirmButton = null;
    this.resetCancelButton = null;
    this.resetStatusElement = null;
    this.resetNormalValueElement = null;
    this.resetHardValueElement = null;
    this.resetAchievementsValueElement = null;
    this.nameEntryElement = null;
    this.playerNameInput = null;
    this.playerNameStatus = null;
    this.modePlayerNameElement = null;
    this.pendingReset = null;
    this.classicActionButton = null;
    this.epicActionButton = null;
    this.menuBall = null;
    this.menuBallCanvas = null;
  }
}
