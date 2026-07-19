import * as ENGINE from '@gnsx/genesys.js';

export interface DribbleOverlayOptions extends ENGINE.BaseUIComponentOptions {
  onResume?: () => void;
  onRestart?: () => void;
  onMainMenu?: () => void;
}

export interface DribbleRunSummary {
  bestCombo: number;
  goodHits: number;
  perfectSwitches: number;
  hazardsAvoided: number;
  starsEarned: number;
  elapsedSeconds: number;
  objectivesCompleted: number;
  objectiveCount: number;
  performanceXp: number;
  objectiveXp: number;
  bonusXp: number;
  xpEarned: number;
  playerLevel: number;
  nextObjective: string;
}

export interface DribbleVersusSummary {
  roundsPlayed: number;
  longestRally: number;
  playerReturns: number;
  aiReturns: number;
  dangerPasses: number;
  counterReads: number;
  elapsedSeconds: number;
  objectivesCompleted: number;
  objectiveCount: number;
  performanceXp: number;
  objectiveXp: number;
  bonusXp: number;
  xpEarned: number;
  playerLevel: number;
  nextObjective: string;
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
  private titleElement: HTMLElement | null = null;
  private subtitleElement: HTMLElement | null = null;
  private scoreLabelElement: HTMLElement | null = null;
  private scoreElement: HTMLElement | null = null;
  private resumeSlot: HTMLElement | null = null;
  private closeButton: HTMLButtonElement | null = null;
  private summaryElement: HTMLElement | null = null;
  private summaryComboElement: HTMLElement | null = null;
  private summaryHitsElement: HTMLElement | null = null;
  private summaryPerfectElement: HTMLElement | null = null;
  private summaryAvoidedElement: HTMLElement | null = null;
  private summaryStarsElement: HTMLElement | null = null;
  private summaryTimeElement: HTMLElement | null = null;
  private summaryObjectivesElement: HTMLElement | null = null;
  private summaryXpElement: HTMLElement | null = null;
  private summaryXpBreakdownElement: HTMLElement | null = null;
  private summaryNextElement: HTMLElement | null = null;
  private summaryLabelElements: HTMLElement[] = [];

  private readonly stopPointerEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private readonly handleClose = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    if (this.rootElement?.dataset.mode === 'game-over') {
      this.options.onMainMenu();
      return;
    }
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
      title: 'PAUSED',
      subtitle: 'Take a breath. The court is waiting.',
      scoreLabel: 'CURRENT SCORE',
      score: '0',
    };
  }

  protected override cacheElements(): void {
    if (!this.layout) return;
    this.rootElement = this.layout.querySelector('[data-dribble-overlay]') as HTMLElement | null;
    this.titleElement = this.layout.querySelector('[data-overlay-title]') as HTMLElement | null;
    this.subtitleElement = this.layout.querySelector('[data-overlay-subtitle]') as HTMLElement | null;
    this.scoreLabelElement = this.layout.querySelector('[data-overlay-score-label]') as HTMLElement | null;
    this.scoreElement = this.layout.querySelector('[data-overlay-score]') as HTMLElement | null;
    this.resumeSlot = this.layout.querySelector('[data-overlay-resume-slot]') as HTMLElement | null;
    this.closeButton = this.layout.querySelector('[data-overlay-close]') as HTMLButtonElement | null;
    this.summaryElement = this.layout.querySelector('[data-overlay-summary]') as HTMLElement | null;
    this.summaryComboElement = this.layout.querySelector('[data-summary-combo]') as HTMLElement | null;
    this.summaryHitsElement = this.layout.querySelector('[data-summary-hits]') as HTMLElement | null;
    this.summaryPerfectElement = this.layout.querySelector('[data-summary-perfect]') as HTMLElement | null;
    this.summaryAvoidedElement = this.layout.querySelector('[data-summary-avoided]') as HTMLElement | null;
    this.summaryStarsElement = this.layout.querySelector('[data-summary-stars]') as HTMLElement | null;
    this.summaryTimeElement = this.layout.querySelector('[data-summary-time]') as HTMLElement | null;
    this.summaryObjectivesElement = this.layout.querySelector('[data-summary-objectives]') as HTMLElement | null;
    this.summaryXpElement = this.layout.querySelector('[data-summary-xp]') as HTMLElement | null;
    this.summaryXpBreakdownElement = this.layout.querySelector('[data-summary-xp-breakdown]') as HTMLElement | null;
    this.summaryNextElement = this.layout.querySelector('[data-summary-next]') as HTMLElement | null;
    this.summaryLabelElements = [
      this.layout.querySelector('[data-summary-combo-label]'),
      this.layout.querySelector('[data-summary-hits-label]'),
      this.layout.querySelector('[data-summary-perfect-label]'),
      this.layout.querySelector('[data-summary-avoided-label]'),
      this.layout.querySelector('[data-summary-stars-label]'),
      this.layout.querySelector('[data-summary-time-label]'),
    ].filter((element): element is HTMLElement => element instanceof HTMLElement);
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
      title: 'PAUSED',
      subtitle: 'Take a breath. The court is waiting.',
      scoreLabel: 'CURRENT SCORE',
      score,
      showResume: true,
      summary: null,
      summaryKind: null,
    });
    this.show();
  }

  public handleControllerBack(): void {
    if (this.rootElement?.dataset.mode === 'game-over') this.options.onMainMenu();
    else this.options.onResume();
  }

  public showGameOver(
    score: number,
    highScore: number,
    mode: 'normal' | 'hard',
    summary: DribbleRunSummary,
    completedRun = false,
  ): void {
    const modeLabel = mode === 'hard' ? 'Hard' : 'Normal';
    this.setContent({
      mode: 'game-over',
      title: completedRun ? 'RUN COMPLETE' : 'GAME OVER',
      subtitle: completedRun ? `Final bucket made · ${modeLabel} best: ${highScore}` : `${modeLabel} best: ${highScore}`,
      scoreLabel: completedRun ? 'FINAL SCORE' : 'POINTS',
      score,
      showResume: false,
      summary,
      summaryKind: 'run',
    });
    this.show();
  }

  public showVersusPause(playerLosses: number, aiLosses: number): void {
    this.setContent({
      mode: 'pause',
      title: 'PAUSED',
      subtitle: 'Last Bounce match in progress.',
      scoreLabel: 'ROUND LOSSES  ·  YOU / AI',
      score: `${playerLosses} - ${aiLosses}`,
      showResume: true,
      summary: null,
      summaryKind: null,
    });
    this.show();
  }

  public showVersusGameOver(
    playerWon: boolean,
    playerLosses: number,
    aiLosses: number,
    summary: DribbleVersusSummary,
  ): void {
    this.setContent({
      mode: 'game-over',
      title: playerWon ? 'VICTORY' : 'DEFEAT',
      subtitle: playerWon ? 'You outplayed the left hand.' : 'The AI held its nerve.',
      scoreLabel: 'ROUND LOSSES  ·  YOU / AI',
      score: `${playerLosses} - ${aiLosses}`,
      showResume: false,
      summary: {
        bestCombo: summary.roundsPlayed,
        goodHits: summary.longestRally,
        perfectSwitches: summary.playerReturns,
        hazardsAvoided: summary.aiReturns,
        starsEarned: summary.counterReads,
        elapsedSeconds: summary.elapsedSeconds,
        objectivesCompleted: summary.objectivesCompleted,
        objectiveCount: summary.objectiveCount,
        performanceXp: summary.performanceXp,
        objectiveXp: summary.objectiveXp,
        bonusXp: summary.bonusXp,
        xpEarned: summary.xpEarned,
        playerLevel: summary.playerLevel,
        nextObjective: summary.nextObjective,
      },
      summaryKind: 'versus',
    });
    this.setSummaryLabels(['ROUNDS', 'LONGEST RALLY', 'YOUR RETURNS', 'AI RETURNS', 'COUNTER READS', 'MATCH TIME']);
    this.show();
  }

  private setContent(content: {
    mode: 'pause' | 'game-over';
    title: string;
    subtitle: string;
    scoreLabel: string;
    score: number | string;
    showResume: boolean;
    summary: DribbleRunSummary | null;
    summaryKind: 'run' | 'versus' | null;
  }): void {
    if (this.rootElement) this.rootElement.dataset.mode = content.mode;
    this.closeButton?.setAttribute(
      'aria-label',
      content.mode === 'game-over' ? 'Go to main menu' : 'Resume game',
    );
    if (this.titleElement) this.titleElement.textContent = content.title;
    if (this.subtitleElement) this.subtitleElement.textContent = content.subtitle;
    if (this.scoreLabelElement) this.scoreLabelElement.textContent = content.scoreLabel;
    if (this.scoreElement) this.scoreElement.textContent = String(content.score);
    if (this.resumeSlot) this.resumeSlot.style.display = content.showResume ? '' : 'none';
    if (this.summaryElement) this.summaryElement.dataset.active = content.summary ? 'true' : 'false';
    if (content.summary) {
      if (content.summaryKind === 'run') {
        this.setSummaryLabels(['BEST COMBO', 'GOOD HITS', 'PERFECT', 'HAZARDS AVOIDED', 'STARS EARNED', 'RUN TIME']);
      }
      if (this.summaryComboElement) {
        this.summaryComboElement.textContent = content.summaryKind === 'versus'
          ? String(content.summary.bestCombo)
          : `x${content.summary.bestCombo}`;
      }
      if (this.summaryHitsElement) this.summaryHitsElement.textContent = String(content.summary.goodHits);
      if (this.summaryPerfectElement) this.summaryPerfectElement.textContent = String(content.summary.perfectSwitches);
      if (this.summaryAvoidedElement) this.summaryAvoidedElement.textContent = String(content.summary.hazardsAvoided);
      if (this.summaryStarsElement) {
        this.summaryStarsElement.textContent = content.summaryKind === 'versus'
          ? String(content.summary.starsEarned)
          : `+${content.summary.starsEarned}`;
      }
      if (this.summaryTimeElement) this.summaryTimeElement.textContent = this.formatDuration(content.summary.elapsedSeconds);
      if (this.summaryObjectivesElement) {
        this.summaryObjectivesElement.textContent = `${content.summary.objectivesCompleted} / ${content.summary.objectiveCount} OBJECTIVES`;
      }
      if (this.summaryXpElement) {
        this.summaryXpElement.textContent = `+${content.summary.xpEarned} XP  ·  LEVEL ${content.summary.playerLevel}`;
      }
      if (this.summaryXpBreakdownElement) {
        this.summaryXpBreakdownElement.textContent = [
          `PERFORMANCE +${content.summary.performanceXp}`,
          `OBJECTIVES +${content.summary.objectiveXp}`,
          `BONUS +${content.summary.bonusXp}`,
        ].join('  ·  ');
      }
      if (this.summaryNextElement) this.summaryNextElement.textContent = content.summary.nextObjective;
    }
  }

  private setSummaryLabels(labels: readonly string[]): void {
    for (let index = 0; index < this.summaryLabelElements.length; index += 1) {
      this.summaryLabelElements[index].textContent = labels[index] ?? '';
    }
  }

  private formatDuration(seconds: number): string {
    const wholeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(wholeSeconds / 60);
    return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`;
  }

  protected override onDestroy(): void {
    this.closeButton?.removeEventListener('pointerdown', this.stopPointerEvent);
    this.closeButton?.removeEventListener('mousedown', this.stopPointerEvent);
    this.closeButton?.removeEventListener('click', this.handleClose);
    this.rootElement = null;
    this.titleElement = null;
    this.subtitleElement = null;
    this.scoreLabelElement = null;
    this.scoreElement = null;
    this.resumeSlot = null;
    this.closeButton = null;
    this.summaryElement = null;
    this.summaryComboElement = null;
    this.summaryHitsElement = null;
    this.summaryPerfectElement = null;
    this.summaryAvoidedElement = null;
    this.summaryStarsElement = null;
    this.summaryTimeElement = null;
    this.summaryObjectivesElement = null;
    this.summaryXpElement = null;
    this.summaryXpBreakdownElement = null;
    this.summaryNextElement = null;
    this.summaryLabelElements = [];
  }
}
