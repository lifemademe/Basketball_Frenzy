import * as ENGINE from '@gnsx/genesys.js';

export interface DribbleOverlayOptions extends ENGINE.BaseUIComponentOptions {
  onResume?: () => void;
  onRestart?: () => void;
  onMainMenu?: () => void;
}

export class DribbleOverlay extends ENGINE.BaseUIComponent<DribbleOverlayOptions> {
  public static metadata: ENGINE.UIComponentMetadata = {
    displayName: 'Dribble Game Overlay',
    category: 'menu',
    summary: 'Pause and game-over overlay for the dribble game.',
    useCases: ['pause menu', 'game over', 'final score'],
    optionsType: 'DribbleOverlayOptions',
    assetPaths: {
      template: '@project/assets/ui/dribble-overlay-pause-art.html',
      styles: '@project/assets/ui/dribble-overlay-glass.css',
    },
  };

  private rootElement: HTMLElement | null = null;
  private eyebrowElement: HTMLElement | null = null;
  private titleElement: HTMLElement | null = null;
  private subtitleElement: HTMLElement | null = null;
  private scoreLabelElement: HTMLElement | null = null;
  private scoreElement: HTMLElement | null = null;
  private resumeSlot: HTMLElement | null = null;
  private closeButton: HTMLButtonElement | null = null;

  private readonly stopPointerEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private readonly handleClose = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.options.onResume();
  };

  protected override getAssetPaths(): { templatePath: string; stylesPath: string } {
    return {
      templatePath: DribbleOverlay.metadata.assetPaths.template,
      stylesPath: DribbleOverlay.metadata.assetPaths.styles,
    };
  }

  protected override getDefaultOptions(): Required<DribbleOverlayOptions> {
    return {
      position: 'center',
      visible: false,
      customClasses: [],
      customStyles: {},
      onResume: () => {},
      onRestart: () => {},
      onMainMenu: () => {},
    };
  }

  protected override getInitialData(): Record<string, string> {
    return {
      eyebrow: 'RUN PAUSED',
      title: 'PAUSED',
      subtitle: 'Take a breath. The court is waiting.',
      scoreLabel: 'CURRENT SCORE',
      score: '0',
    };
  }

  protected override cacheElements(): void {
    if (!this.layout) return;
    this.rootElement = this.layout.querySelector('[data-dribble-overlay]') as HTMLElement | null;
    this.eyebrowElement = this.layout.querySelector('[data-overlay-eyebrow]') as HTMLElement | null;
    this.titleElement = this.layout.querySelector('[data-overlay-title]') as HTMLElement | null;
    this.subtitleElement = this.layout.querySelector('[data-overlay-subtitle]') as HTMLElement | null;
    this.scoreLabelElement = this.layout.querySelector('[data-overlay-score-label]') as HTMLElement | null;
    this.scoreElement = this.layout.querySelector('[data-overlay-score]') as HTMLElement | null;
    this.resumeSlot = this.layout.querySelector('[data-overlay-resume-slot]') as HTMLElement | null;
    this.closeButton = this.layout.querySelector('[data-overlay-close]') as HTMLButtonElement | null;
  }

  protected override async onInitialize(): Promise<void> {
    const restartSlot = this.layout?.querySelector('[data-overlay-restart-slot]') as HTMLElement | null;
    const mainMenuSlot = this.layout?.querySelector('[data-overlay-main-menu-slot]') as HTMLElement | null;
    if (!this.resumeSlot || !restartSlot || !mainMenuSlot) {
      return;
    }

    await Promise.all([
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.successLarge,
        label: 'Resume',
        onClick: () => this.options.onResume(),
      }, this.resumeSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Restart',
        onClick: () => this.options.onRestart(),
      }, restartSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Main Menu',
        onClick: () => this.options.onMainMenu(),
      }, mainMenuSlot),
    ]);

    this.closeButton?.addEventListener('pointerdown', this.stopPointerEvent);
    this.closeButton?.addEventListener('mousedown', this.stopPointerEvent);
    this.closeButton?.addEventListener('click', this.handleClose);
  }

  public showPause(score: number): void {
    this.setContent({
      mode: 'pause',
      eyebrow: 'RUN PAUSED',
      title: 'PAUSED',
      subtitle: 'Take a breath. The court is waiting.',
      scoreLabel: 'CURRENT SCORE',
      score,
      showResume: true,
    });
    this.show();
  }

  public showGameOver(score: number, highScore: number, mode: 'normal' | 'hard'): void {
    const modeLabel = mode === 'hard' ? 'Hard' : 'Normal';
    this.setContent({
      mode: 'game-over',
      eyebrow: 'RUN COMPLETE',
      title: 'GAME OVER',
      subtitle: `${modeLabel} best: ${highScore}`,
      scoreLabel: 'POINTS',
      score,
      showResume: false,
    });
    this.show();
  }

  private setContent(content: {
    mode: 'pause' | 'game-over';
    eyebrow: string;
    title: string;
    subtitle: string;
    scoreLabel: string;
    score: number;
    showResume: boolean;
  }): void {
    if (this.rootElement) this.rootElement.dataset.mode = content.mode;
    if (this.eyebrowElement) this.eyebrowElement.textContent = content.eyebrow;
    if (this.titleElement) this.titleElement.textContent = content.title;
    if (this.subtitleElement) this.subtitleElement.textContent = content.subtitle;
    if (this.scoreLabelElement) this.scoreLabelElement.textContent = content.scoreLabel;
    if (this.scoreElement) this.scoreElement.textContent = String(content.score);
    if (this.resumeSlot) this.resumeSlot.style.display = content.showResume ? '' : 'none';
  }

  protected override onDestroy(): void {
    this.closeButton?.removeEventListener('pointerdown', this.stopPointerEvent);
    this.closeButton?.removeEventListener('mousedown', this.stopPointerEvent);
    this.closeButton?.removeEventListener('click', this.handleClose);
    this.rootElement = null;
    this.eyebrowElement = null;
    this.titleElement = null;
    this.subtitleElement = null;
    this.scoreLabelElement = null;
    this.scoreElement = null;
    this.resumeSlot = null;
    this.closeButton = null;
  }
}
