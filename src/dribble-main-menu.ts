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
  type WristbandColor,
  type WristbandSide,
} from './dribble-progression.js';

export type DribbleGameMode = 'normal' | 'hard';

type MainMenuPanel = 'home' | 'mode-select' | 'how-to-play' | 'settings' | 'shop' | 'achievements';

export interface DribbleMainMenuOptions extends ENGINE.BaseUIComponentOptions {
  onPlay?: (mode: DribbleGameMode) => void;
  onTutorial?: () => void;
  onVolumeChange?: (volume: number) => void;
  onBallBounce?: (strength: number) => void;
  progression?: DribbleProgressionState;
  onPurchaseBall?: (cosmetic: BallCosmetic) => DribbleProgressionState;
  onEquipBall?: (cosmetic: BallCosmetic) => DribbleProgressionState;
  onWristbandColorChange?: (side: WristbandSide, color: WristbandColor) => DribbleProgressionState;
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
  private fullscreenInput: HTMLInputElement | null = null;
  private homeStarsElement: HTMLElement | null = null;
  private normalHighScoreElement: HTMLElement | null = null;
  private hardHighScoreElement: HTMLElement | null = null;
  private shopStarsElement: HTMLElement | null = null;
  private classicStatusElement: HTMLElement | null = null;
  private epicStatusElement: HTMLElement | null = null;
  private discoStatusElement: HTMLElement | null = null;
  private blackHoleStatusElement: HTMLElement | null = null;
  private achievementCountElement: HTMLElement | null = null;
  private achievementRows: HTMLElement[] = [];
  private wristbandButtons: HTMLButtonElement[] = [];
  private leftWristbandPreview: HTMLElement | null = null;
  private rightWristbandPreview: HTMLElement | null = null;
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
    try {
      localStorage.setItem('basketball-frenzy-master-volume', String(volume));
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
    this.options.onVolumeChange(volume);
  };

  private readonly handleFullscreenChange = (): void => {
    if (this.fullscreenInput) this.fullscreenInput.checked = document.fullscreenElement !== null;
  };

  private readonly handleFullscreenInput = (): void => {
    void this.toggleFullscreen();
  };

  private readonly handleWristbandClick = (event: Event): void => {
    const button = event.currentTarget as HTMLButtonElement;
    const side = button.dataset.wristbandSide as WristbandSide | undefined;
    const color = button.dataset.wristbandColor as WristbandColor | undefined;
    if (!side || !color || !wristbandColors.includes(color)) return;
    this.setProgression(this.options.onWristbandColorChange(side, color));
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
      onBallBounce: () => {},
      progression: createDefaultProgressionState(),
      onPurchaseBall: () => createDefaultProgressionState(),
      onEquipBall: () => createDefaultProgressionState(),
      onWristbandColorChange: () => createDefaultProgressionState(),
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
    this.fullscreenInput = this.layout.querySelector('[data-menu-fullscreen]') as HTMLInputElement | null;
    this.homeStarsElement = this.layout.querySelector('[data-menu-stars]') as HTMLElement | null;
    this.normalHighScoreElement = this.layout.querySelector('[data-menu-normal-high-score]') as HTMLElement | null;
    this.hardHighScoreElement = this.layout.querySelector('[data-menu-hard-high-score]') as HTMLElement | null;
    this.shopStarsElement = this.layout.querySelector('[data-shop-stars]') as HTMLElement | null;
    this.classicStatusElement = this.layout.querySelector('[data-shop-classic-status]') as HTMLElement | null;
    this.epicStatusElement = this.layout.querySelector('[data-shop-epic-status]') as HTMLElement | null;
    this.discoStatusElement = this.layout.querySelector('[data-shop-disco-status]') as HTMLElement | null;
    this.blackHoleStatusElement = this.layout.querySelector('[data-shop-blackhole-status]') as HTMLElement | null;
    this.achievementCountElement = this.layout.querySelector('[data-achievement-count]') as HTMLElement | null;
    this.achievementRows = Array.from(this.layout.querySelectorAll('[data-achievement-id]')) as HTMLElement[];
    this.wristbandButtons = Array.from(this.layout.querySelectorAll('[data-wristband-color]')) as HTMLButtonElement[];
    this.leftWristbandPreview = this.layout.querySelector('[data-wristband-preview="left"]') as HTMLElement | null;
    this.rightWristbandPreview = this.layout.querySelector('[data-wristband-preview="right"]') as HTMLElement | null;
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
    const modeBackSlot = slot('mode-back');
    const howSlot = slot('how');
    const settingsSlot = slot('settings');
    const shopSlot = slot('shop');
    const achievementsSlot = slot('achievements');
    const howBackSlot = slot('how-back');
    const settingsBackSlot = slot('settings-back');
    const shopBackSlot = slot('shop-back');
    const achievementsBackSlot = slot('achievements-back');
    const classicActionSlot = slot('classic-action');
    const epicActionSlot = slot('epic-action');
    const discoActionSlot = slot('disco-action');
    const blackHoleActionSlot = slot('blackhole-action');
    if (
      !playSlot || !normalModeSlot || !hardModeSlot || !modeBackSlot
      || !howSlot || !settingsSlot || !shopSlot || !achievementsSlot || !howBackSlot
      || !settingsBackSlot || !shopBackSlot || !achievementsBackSlot || !classicActionSlot || !epicActionSlot
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
        label: 'Back',
        onClick: () => this.showPanel('home'),
      }, modeBackSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Tutorial',
        onClick: () => this.options.onTutorial(),
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
        ...ENGINE.Button.presets.primaryLarge,
        label: 'Equipped',
        disabled: true,
        onClick: () => this.handleClassicAction(),
      }, classicActionSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.primaryLarge,
        label: `Buy - ${epicBallPrice} Star`,
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
    this.setProgression(this.options.progression);

    let volume = 0.8;
    try {
      const storedValue = localStorage.getItem('basketball-frenzy-master-volume');
      const storedVolume = storedValue === null ? Number.NaN : Number(storedValue);
      if (Number.isFinite(storedVolume)) volume = Math.max(0, Math.min(1, storedVolume));
    } catch {
      // Keep the default when storage is unavailable.
    }
    if (this.volumeInput) {
      this.volumeInput.value = String(Math.round(volume * 100));
      this.volumeInput.addEventListener('input', this.handleVolumeInput);
    }
    if (this.volumeValue) this.volumeValue.textContent = `${Math.round(volume * 100)}%`;
    this.options.onVolumeChange(volume);

    this.fullscreenInput?.addEventListener('change', this.handleFullscreenInput);
    this.menuBall?.addEventListener('pointerdown', this.handleBallPointerDown);
    this.menuBall?.addEventListener('pointermove', this.handleBallPointerMove);
    this.menuBall?.addEventListener('pointerup', this.handleBallPointerUp);
    this.menuBall?.addEventListener('pointercancel', this.handleBallPointerUp);
    this.menuBall?.addEventListener('click', this.handleBallClick);
    for (const button of this.wristbandButtons) {
      button.addEventListener('click', this.handleWristbandClick);
    }
    window.addEventListener('resize', this.handleMenuResize);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    this.handleFullscreenChange();
    this.showPanel('home');
    await this.preloadCriticalMenuAssets();
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

  private showPanel(panel: MainMenuPanel): void {
    if (this.rootElement) this.rootElement.dataset.panel = panel;
    if (panel === 'shop' || panel === 'achievements') this.refreshProgressionUi();
    if (panel === 'home') this.startBallPhysics();
    else {
      this.stopBallPhysics();
      this.cancelBallDrag();
    }
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

  private async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      this.handleFullscreenChange();
    }
  }

  protected override onDestroy(): void {
    this.volumeInput?.removeEventListener('input', this.handleVolumeInput);
    this.fullscreenInput?.removeEventListener('change', this.handleFullscreenInput);
    this.menuBall?.removeEventListener('pointerdown', this.handleBallPointerDown);
    this.menuBall?.removeEventListener('pointermove', this.handleBallPointerMove);
    this.menuBall?.removeEventListener('pointerup', this.handleBallPointerUp);
    this.menuBall?.removeEventListener('pointercancel', this.handleBallPointerUp);
    this.menuBall?.removeEventListener('click', this.handleBallClick);
    for (const button of this.wristbandButtons) {
      button.removeEventListener('click', this.handleWristbandClick);
    }
    window.removeEventListener('resize', this.handleMenuResize);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    this.stopBallPhysics();
    this.cancelBallDrag();
    this.disposeMenuBallModel();
    this.rootElement = null;
    this.volumeInput = null;
    this.volumeValue = null;
    this.fullscreenInput = null;
    this.homeStarsElement = null;
    this.normalHighScoreElement = null;
    this.hardHighScoreElement = null;
    this.shopStarsElement = null;
    this.classicStatusElement = null;
    this.epicStatusElement = null;
    this.wristbandButtons = [];
    this.leftWristbandPreview = null;
    this.rightWristbandPreview = null;
    this.classicActionButton = null;
    this.epicActionButton = null;
    this.menuBall = null;
    this.menuBallCanvas = null;
  }
}
