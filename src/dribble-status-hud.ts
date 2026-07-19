import * as ENGINE from '@gnsx/genesys.js';

import type { DribbleSide } from './dribble-ball.js';
import { RUN_OBJECTIVE_XP, type RunObjectiveProgress } from './dribble-retention-director.js';

export interface DribbleRunObjectivesHudOptions extends ENGINE.BaseUIComponentOptions {}

export class DribbleRunObjectivesHud extends ENGINE.BaseUIComponent<DribbleRunObjectivesHudOptions> {
  public static metadata: ENGINE.UIComponentMetadata = {
    displayName: 'Dribble Run Objectives HUD',
    category: 'hud',
    summary: 'Persistent three-item objective checklist for Classic runs.',
    useCases: ['run objectives', 'objective checklist', 'progress'],
    optionsType: 'DribbleRunObjectivesHudOptions',
    assetPaths: {
      template: '@project/assets/ui/dribble-run-objectives.html',
      styles: '@project/assets/ui/dribble-status-hud-layout.css',
    },
  };

  private rootElement: HTMLElement | null = null;
  private listElement: HTMLOListElement | null = null;
  private titleElement: HTMLElement | null = null;
  private timerElement: HTMLElement | null = null;
  private timerLabelElement: HTMLElement | null = null;
  private timerValueElement: HTMLElement | null = null;
  private modifierLabel = '';
  private lastSignature = '';
  private readonly itemElements = new Map<string, HTMLLIElement>();
  private readonly removalTimers = new Map<string, ReturnType<typeof setTimeout>>();

  protected override getAssetPaths(): { templatePath: string; stylesPath: string } {
    return {
      templatePath: DribbleRunObjectivesHud.metadata.assetPaths.template,
      stylesPath: DribbleRunObjectivesHud.metadata.assetPaths.styles,
    };
  }

  protected override getDefaultOptions(): Required<DribbleRunObjectivesHudOptions> {
    return {
      position: 'top-right',
      visible: false,
      customClasses: [],
      customStyles: {},
    };
  }

  protected override getInitialData(): Record<string, string> {
    return {};
  }

  protected override cacheElements(): void {
    this.rootElement = this.layout?.querySelector('[data-run-objectives]') as HTMLElement | null;
    this.listElement = this.layout?.querySelector('[data-objectives-list]') as HTMLOListElement | null;
    this.titleElement = this.layout?.querySelector('[data-objectives-title]') as HTMLElement | null;
    this.timerElement = this.layout?.querySelector('[data-run-timer]') as HTMLElement | null;
    this.timerLabelElement = this.layout?.querySelector('[data-run-timer-label]') as HTMLElement | null;
    this.timerValueElement = this.layout?.querySelector('[data-run-timer-value]') as HTMLElement | null;
  }

  public setRunTimer(
    remainingSeconds: number,
    totalSeconds: number,
    state: 'hidden' | 'steady' | 'final-push' | 'final-shot' | 'complete',
  ): void {
    if (!this.timerElement) return;
    const hidden = state === 'hidden';
    this.timerElement.hidden = hidden;
    if (hidden) return;

    const remaining = Math.max(0, remainingSeconds);
    const ratio = totalSeconds > 0 ? Math.min(1, remaining / totalSeconds) : 0;
    this.timerElement.dataset.state = state;
    this.timerElement.style.setProperty('--normal-time-remaining', String(ratio));
    if (this.timerLabelElement) {
      this.timerLabelElement.textContent = state === 'complete'
        ? 'RUN COMPLETE'
        : state === 'final-shot'
          ? 'FINAL PLAY'
          : state === 'final-push'
            ? 'FINAL PUSH'
            : 'TIME LEFT';
    }
    if (this.timerValueElement) {
      this.timerValueElement.textContent = state === 'complete'
        ? 'BUCKET MADE'
        : state === 'final-shot'
          ? 'FINAL SHOT'
          : this.formatClock(remaining);
    }
    this.timerElement.setAttribute(
      'aria-label',
      state === 'complete'
        ? 'Run complete, bucket made'
        : state === 'final-shot'
          ? 'Final play, final shot'
          : `${this.timerLabelElement?.textContent ?? 'Time left'} ${this.formatClock(remaining)}`,
    );
  }

  public setModifier(label: string): void {
    if (label === this.modifierLabel) return;
    this.modifierLabel = label;
    if (this.titleElement) {
      this.titleElement.textContent = label ? `RUN OBJECTIVES · ${label}` : 'RUN OBJECTIVES';
    }
  }

  public setObjectives(objectives: readonly RunObjectiveProgress[], showHeader = true): void {
    const signature = objectives
      .map(objective => `${objective.id}:${objective.completed ? 1 : 0}`)
      .concat(showHeader ? 'header' : 'compact')
      .join('|');
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    if (!this.listElement) return;

    const currentIds = new Set(objectives.map(objective => objective.id));
    for (const [id, item] of this.itemElements) {
      if (currentIds.has(id)) continue;
      const timer = this.removalTimers.get(id);
      if (timer) clearTimeout(timer);
      this.removalTimers.delete(id);
      item.remove();
      this.itemElements.delete(id);
    }

    const completedCount = objectives.filter(objective => objective.completed).length;
    const allComplete = objectives.length > 0 && completedCount === objectives.length;
    const completionSummary = this.listElement.querySelector('[data-objectives-complete]');
    if (!allComplete) completionSummary?.remove();
    for (const objective of objectives) {
      let item = this.itemElements.get(objective.id);
      if (!item && !objective.completed) {
        item = this.createObjectiveItem(objective);
        this.itemElements.set(objective.id, item);
      }
      if (!item) continue;

      if (objective.completed) {
        if (item.classList.contains('is-completing')) continue;
        item.classList.add('is-completing');
        item.setAttribute('aria-hidden', 'true');
        const timer = setTimeout(() => {
          item?.remove();
          this.itemElements.delete(objective.id);
          this.removalTimers.delete(objective.id);
          if (this.itemElements.size === 0 && this.rootElement) {
            if (allComplete) this.showCompletionSummary();
            else this.rootElement.dataset.empty = 'true';
          }
        }, 240);
        this.removalTimers.set(objective.id, timer);
      } else {
        const timer = this.removalTimers.get(objective.id);
        if (timer) clearTimeout(timer);
        this.removalTimers.delete(objective.id);
        item.classList.remove('is-completing');
        item.removeAttribute('aria-hidden');
        const label = item.querySelector('.dribble-run-objective-label');
        if (label) label.textContent = objective.shortLabel;
        this.listElement.appendChild(item);
      }
    }

    if (allComplete && this.itemElements.size === 0 && this.removalTimers.size === 0) {
      this.showCompletionSummary();
    }

    if (this.rootElement) {
      const hasActiveObjectives = objectives.some(objective => !objective.completed);
      this.rootElement.dataset.empty = hasActiveObjectives || allComplete || this.removalTimers.size > 0
        ? 'false'
        : 'true';
      this.rootElement.dataset.showHeader = showHeader ? 'true' : 'false';
      this.rootElement.setAttribute(
        'aria-label',
        `Run objectives, ${completedCount} of ${objectives.length} complete`,
      );
    }
  }

  private createObjectiveItem(objective: RunObjectiveProgress): HTMLLIElement {
    const item = document.createElement('li');
    item.dataset.objectiveId = objective.id;

    const marker = document.createElement('span');
    marker.className = 'dribble-run-objective-marker';
    marker.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'dribble-run-objective-label';
    label.textContent = objective.shortLabel;

    const reward = document.createElement('span');
    reward.className = 'dribble-run-objective-reward';
    reward.textContent = `+${RUN_OBJECTIVE_XP} XP`;

    item.append(marker, label, reward);
    this.listElement?.appendChild(item);
    return item;
  }

  private showCompletionSummary(): void {
    if (!this.listElement || this.listElement.querySelector('[data-objectives-complete]')) return;
    const item = document.createElement('li');
    item.className = 'dribble-run-objective-complete';
    item.dataset.objectivesComplete = 'true';

    const marker = document.createElement('span');
    marker.className = 'dribble-run-objective-check';
    marker.textContent = '✓';
    marker.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'dribble-run-objective-label';
    label.textContent = 'All objectives complete';
    item.append(marker, label);
    this.listElement.appendChild(item);
    if (this.rootElement) this.rootElement.dataset.empty = 'false';
  }

  private formatClock(seconds: number): string {
    const wholeSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(wholeSeconds / 60);
    return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`;
  }

  protected override onDestroy(): void {
    for (const timer of this.removalTimers.values()) clearTimeout(timer);
    this.removalTimers.clear();
    this.itemElements.clear();
    this.rootElement = null;
    this.listElement = null;
    this.titleElement = null;
    this.timerElement = null;
    this.timerLabelElement = null;
    this.timerValueElement = null;
    this.modifierLabel = '';
    this.lastSignature = '';
  }
}

export interface DribblePauseButtonOptions extends ENGINE.BaseUIComponentOptions {
  onPause?: () => void;
}

export class DribblePauseButton extends ENGINE.BaseUIComponent<DribblePauseButtonOptions> {
  public static metadata: ENGINE.UIComponentMetadata = {
    displayName: 'Dribble Pause Button',
    category: 'control',
    summary: 'Clickable pause control for the gameplay HUD.',
    useCases: ['pause', 'hud button', 'game controls'],
    optionsType: 'DribblePauseButtonOptions',
    assetPaths: {
      template: '@project/assets/ui/dribble-pause-button-fixed.html',
      styles: '@project/assets/ui/dribble-pause-button-no-cursor.css',
    },
  };

  private buttonElement: HTMLButtonElement | null = null;

  private readonly stopPointerEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    if (event.button === 0) this.options.onPause();
  };

  private readonly handleClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.options.onPause();
  };

  protected override getAssetPaths(): { templatePath: string; stylesPath: string } {
    return {
      templatePath: DribblePauseButton.metadata.assetPaths.template,
      stylesPath: DribblePauseButton.metadata.assetPaths.styles,
    };
  }

  protected override getDefaultOptions(): Required<DribblePauseButtonOptions> {
    return {
      position: 'top-left',
      visible: false,
      customClasses: [],
      customStyles: {},
      onPause: () => {},
    };
  }

  protected override getInitialData(): Record<string, string> {
    return {};
  }

  protected override cacheElements(): void {
    this.buttonElement = this.layout?.querySelector('[data-pause-button]') as HTMLButtonElement | null;
  }

  protected override async onInitialize(): Promise<void> {
    this.buttonElement?.addEventListener('pointerdown', this.handlePointerDown);
    this.buttonElement?.addEventListener('mousedown', this.stopPointerEvent);
    this.buttonElement?.addEventListener('contextmenu', this.stopPointerEvent);
    this.buttonElement?.addEventListener('click', this.handleClick);
  }

  protected override onDestroy(): void {
    this.buttonElement?.removeEventListener('pointerdown', this.handlePointerDown);
    this.buttonElement?.removeEventListener('mousedown', this.stopPointerEvent);
    this.buttonElement?.removeEventListener('contextmenu', this.stopPointerEvent);
    this.buttonElement?.removeEventListener('click', this.handleClick);
    this.buttonElement = null;
  }
}

export interface DribbleSideHintsOptions extends ENGINE.BaseUIComponentOptions {}

export class DribbleSideHints extends ENGINE.BaseUIComponent<DribbleSideHintsOptions> {
  public static metadata: ENGINE.UIComponentMetadata = {
    displayName: 'Dribble Side Hints',
    category: 'hud',
    summary: 'Left and right edge indicators for the current dribble side.',
    useCases: ['left indicator', 'right indicator', 'dribble side'],
    optionsType: 'DribbleSideHintsOptions',
    assetPaths: {
      template: '@project/assets/ui/dribble-side-hints.html',
      styles: '@project/assets/ui/dribble-side-hints-clean.css',
    },
  };

  private rootElement: HTMLElement | null = null;

  protected override getAssetPaths(): { templatePath: string; stylesPath: string } {
    return {
      templatePath: DribbleSideHints.metadata.assetPaths.template,
      stylesPath: DribbleSideHints.metadata.assetPaths.styles,
    };
  }

  protected override getDefaultOptions(): Required<DribbleSideHintsOptions> {
    return {
      position: 'center',
      visible: false,
      customClasses: [],
      customStyles: {},
    };
  }

  protected override getInitialData(): Record<string, string> {
    return {};
  }

  protected override cacheElements(): void {
    this.rootElement = this.layout?.querySelector('[data-side-hints]') as HTMLElement | null;
  }

  public setState(side: DribbleSide, transferring: boolean): void {
    if (!this.rootElement) return;
    this.rootElement.dataset.side = side;
    this.rootElement.dataset.transferring = transferring ? 'true' : 'false';
  }

  protected override onDestroy(): void {
    this.rootElement = null;
  }
}

export interface DribbleLivesDisplayOptions extends ENGINE.BaseUIComponentOptions {
  initialLives?: number;
  maxLives?: number;
}

export class DribbleLivesDisplay extends ENGINE.BaseUIComponent<DribbleLivesDisplayOptions> {
  public static metadata: ENGINE.UIComponentMetadata = {
    displayName: 'Dribble Lives Display',
    category: 'hud',
    summary: 'Heart-icon lives display for the dribble game.',
    useCases: ['lives', 'health icons', 'hearts'],
    optionsType: 'DribbleLivesDisplayOptions',
    assetPaths: {
      template: '@project/assets/ui/dribble-lives-icons-only.html',
      styles: '@project/assets/ui/dribble-status-hud-layout.css',
    },
  };

  private rootElement: HTMLElement | null = null;
  private heartsElement: HTMLElement | null = null;
  private heartMarkup = '';
  private lives = 3;
  private maxLives = 3;
  private hitTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(ui: ENGINE.UIManager, options: DribbleLivesDisplayOptions = {}) {
    super(ui, options);
    this.lives = this.options.initialLives;
    this.maxLives = this.options.maxLives;
  }

  protected override getAssetPaths(): { templatePath: string; stylesPath: string } {
    return {
      templatePath: DribbleLivesDisplay.metadata.assetPaths.template,
      stylesPath: DribbleLivesDisplay.metadata.assetPaths.styles,
    };
  }

  protected override getDefaultOptions(): Required<DribbleLivesDisplayOptions> {
    return {
      position: 'top-right',
      visible: true,
      customClasses: [],
      customStyles: {},
      initialLives: 3,
      maxLives: 3,
    };
  }

  protected override getInitialData(): Record<string, string> {
    return {};
  }

  protected override cacheElements(): void {
    if (!this.layout) return;
    this.rootElement = this.layout.querySelector('[data-dribble-lives]') as HTMLElement | null;
    this.heartsElement = this.layout.querySelector('[data-lives-hearts]') as HTMLElement | null;
  }

  protected override async onInitialize(): Promise<void> {
    this.heartMarkup = await ENGINE.resolveAssetPathsInText(
      '<img src="@project/assets/textures/Heart.png" alt="">',
    );
    this.renderHearts();
  }

  public setLives(lives: number): void {
    const nextLives = Math.max(0, Math.min(this.maxLives, lives));
    const lostLife = nextLives < this.lives;
    const gainedLife = nextLives > this.lives;
    this.lives = nextLives;
    const changedIndex = lostLife ? nextLives : nextLives - 1;
    this.renderHearts(lostLife ? 'lost' : gainedLife ? 'gained' : null, changedIndex);

    if ((lostLife || gainedLife) && this.rootElement) {
      if (this.hitTimer) clearTimeout(this.hitTimer);
      this.rootElement.dataset.hit = lostLife ? 'true' : 'false';
      this.rootElement.dataset.healed = gainedLife ? 'true' : 'false';
      this.hitTimer = setTimeout(() => {
        if (this.rootElement) {
          this.rootElement.dataset.hit = 'false';
          this.rootElement.dataset.healed = 'false';
        }
        this.hitTimer = null;
      }, 320);
    }
  }

  public resetLives(lives: number, maxLives: number): void {
    this.maxLives = Math.max(1, Math.floor(maxLives));
    this.lives = Math.max(0, Math.min(this.maxLives, lives));
    if (this.hitTimer) {
      clearTimeout(this.hitTimer);
      this.hitTimer = null;
    }
    if (this.rootElement) {
      this.rootElement.dataset.hit = 'false';
      this.rootElement.dataset.healed = 'false';
    }
    this.renderHearts();
  }

  private renderHearts(change: 'lost' | 'gained' | null = null, changedIndex = -1): void {
    if (!this.heartsElement) {
      return;
    }
    if (this.rootElement) {
      this.rootElement.dataset.critical = this.lives === 1 && this.maxLives > 1 ? 'true' : 'false';
      this.rootElement.setAttribute(
        'aria-label',
        `${this.lives} of ${this.maxLives} ${this.maxLives === 1 ? 'life' : 'lives'} remaining`,
      );
    }
    this.heartsElement.replaceChildren();
    for (let index = 0; index < this.maxLives; index += 1) {
      const heart = document.createElement('span');
      heart.className = 'dribble-life-heart';
      heart.dataset.active = index < this.lives ? 'true' : 'false';
      if (change && index === changedIndex) heart.dataset.change = change;
      heart.innerHTML = this.heartMarkup;
      this.heartsElement.appendChild(heart);
    }
  }

  protected override onDestroy(): void {
    if (this.hitTimer) {
      clearTimeout(this.hitTimer);
      this.hitTimer = null;
    }
    this.rootElement = null;
    this.heartsElement = null;
  }
}

export interface DribbleTimingMeterOptions extends ENGINE.BaseUIComponentOptions {}

export class DribbleTimingMeter extends ENGINE.BaseUIComponent<DribbleTimingMeterOptions> {
  public static metadata: ENGINE.UIComponentMetadata = {
    displayName: 'Dribble Timing Meter',
    category: 'hud',
    summary: 'Moving timing marker for center-lane hand switches.',
    useCases: ['timing meter', 'switch indicator', 'center target'],
    optionsType: 'DribbleTimingMeterOptions',
    assetPaths: {
      template: '@project/assets/ui/dribble-timing-meter.html',
      styles: '@project/assets/ui/dribble-status-hud-layout.css',
    },
  };

  private rootElement: HTMLElement | null = null;
  private stateElement: HTMLElement | null = null;
  private lastProgress = -1;
  private lastActive: boolean | null = null;
  private lastReady: boolean | null = null;
  private lastPerfect: boolean | null = null;

  protected override getAssetPaths(): { templatePath: string; stylesPath: string } {
    return {
      templatePath: DribbleTimingMeter.metadata.assetPaths.template,
      stylesPath: DribbleTimingMeter.metadata.assetPaths.styles,
    };
  }

  protected override getDefaultOptions(): Required<DribbleTimingMeterOptions> {
    return {
      position: 'top-center',
      visible: true,
      customClasses: [],
      customStyles: {},
    };
  }

  protected override getInitialData(): Record<string, string> {
    return { label: 'CENTER SWITCH', state: 'SCANNING' };
  }

  protected override cacheElements(): void {
    if (!this.layout) return;
    this.rootElement = this.layout.querySelector('[data-dribble-timing]') as HTMLElement | null;
    this.stateElement = this.layout.querySelector('[data-timing-state]') as HTMLElement | null;
  }

  public setTiming(progress: number, active: boolean, ready: boolean, perfect = false): void {
    if (!this.rootElement) {
      return;
    }
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const stateChanged = active !== this.lastActive
      || ready !== this.lastReady
      || perfect !== this.lastPerfect;
    if (Math.abs(clampedProgress - this.lastProgress) >= 0.0025) {
      this.lastProgress = clampedProgress;
      this.rootElement.style.setProperty('--timing-progress', `${clampedProgress * 100}%`);
      this.rootElement.setAttribute('aria-valuenow', String(Math.round(clampedProgress * 100)));
    }
    if (active !== this.lastActive) {
      this.lastActive = active;
      this.rootElement.dataset.active = active ? 'true' : 'false';
    }
    if (ready !== this.lastReady) {
      this.lastReady = ready;
      this.rootElement.dataset.ready = ready ? 'true' : 'false';
    }
    if (perfect !== this.lastPerfect) {
      this.lastPerfect = perfect;
      this.rootElement.dataset.perfect = perfect ? 'true' : 'false';
    }
    if (stateChanged && this.stateElement) {
      const label = !active ? 'SCANNING' : perfect ? 'PERFECT!' : ready ? 'SWITCH NOW' : 'TRACKING';
      if (this.stateElement.textContent !== label) {
        this.stateElement.textContent = label;
      }
    }
    if (stateChanged) {
      this.rootElement.setAttribute(
        'aria-valuetext',
        !active
          ? 'Scanning for a center target'
          : perfect
            ? 'Perfect switch timing'
            : ready
              ? 'Switch now'
              : 'Tracking center target',
      );
    }
  }

  protected override onDestroy(): void {
    this.rootElement = null;
    this.stateElement = null;
    this.lastProgress = -1;
    this.lastActive = null;
    this.lastReady = null;
    this.lastPerfect = null;
  }
}

export interface DribbleJuiceHudOptions extends ENGINE.BaseUIComponentOptions {}

export class DribbleJuiceHud extends ENGINE.BaseUIComponent<DribbleJuiceHudOptions> {
  public static metadata: ENGINE.UIComponentMetadata = {
    displayName: 'Dribble Juice HUD',
    category: 'hud',
    summary: 'Frenzy timer and animated score praise callouts.',
    useCases: ['frenzy meter', 'score praise', 'juice feedback'],
    optionsType: 'DribbleJuiceHudOptions',
    assetPaths: {
      template: '@project/assets/ui/dribble-juice-hud.html',
      styles: '@project/assets/ui/dribble-status-hud-layout.css',
    },
  };

  private rootElement: HTMLElement | null = null;
  private frenzyElement: HTMLElement | null = null;
  private timeElement: HTMLElement | null = null;
  private praiseElement: HTMLElement | null = null;
  private coachElement: HTMLElement | null = null;
  private coachTitleElement: HTMLElement | null = null;
  private coachBodyElement: HTMLElement | null = null;
  private praiseTimer: ReturnType<typeof setTimeout> | null = null;
  private praisePriority = 0;
  private praiseVisibleUntil = 0;
  private activationTimer: ReturnType<typeof setTimeout> | null = null;
  private coachTimer: ReturnType<typeof setTimeout> | null = null;
  private frenzyActive = false;
  private frenzyUrgent = false;
  private lastFrenzyPercent = -1;
  private lastFrenzyTimeText = '';

  protected override getAssetPaths(): { templatePath: string; stylesPath: string } {
    return {
      templatePath: DribbleJuiceHud.metadata.assetPaths.template,
      stylesPath: DribbleJuiceHud.metadata.assetPaths.styles,
    };
  }

  protected override getDefaultOptions(): Required<DribbleJuiceHudOptions> {
    return {
      position: 'top-center',
      visible: true,
      customClasses: [],
      customStyles: {},
    };
  }

  protected override getInitialData(): Record<string, string> {
    return { label: 'FRENZY MODE', time: '8.0' };
  }

  protected override cacheElements(): void {
    if (!this.layout) return;
    this.rootElement = this.layout.querySelector('[data-dribble-juice]') as HTMLElement | null;
    this.frenzyElement = this.layout.querySelector('[data-frenzy-meter]') as HTMLElement | null;
    this.timeElement = this.layout.querySelector('[data-frenzy-time]') as HTMLElement | null;
    this.praiseElement = this.layout.querySelector('[data-score-praise]') as HTMLElement | null;
    this.coachElement = this.layout.querySelector('[data-dribble-coach]') as HTMLElement | null;
    this.coachTitleElement = this.layout.querySelector('[data-dribble-coach-title]') as HTMLElement | null;
    this.coachBodyElement = this.layout.querySelector('[data-dribble-coach-body]') as HTMLElement | null;
  }

  public setFrenzy(progress: number, remaining: number, active: boolean): void {
    const clamped = Math.max(0, Math.min(1, progress));
    const percent = Math.round(clamped * 100);
    if (percent !== this.lastFrenzyPercent) {
      this.lastFrenzyPercent = percent;
      const renderedProgress = percent / 100;
      this.rootElement?.style.setProperty('--frenzy-progress', String(renderedProgress));
      this.rootElement?.style.setProperty('--frenzy-inset', `${(1 - renderedProgress) * 50}%`);
      this.frenzyElement?.setAttribute('aria-valuenow', String(percent));
    }
    if (this.rootElement && active !== this.frenzyActive) {
      this.rootElement.dataset.frenzyActive = active ? 'true' : 'false';
      if (active) {
        if (this.activationTimer) clearTimeout(this.activationTimer);
        this.rootElement.classList.remove('is-frenzy-activating');
        void this.rootElement.offsetWidth;
        this.rootElement.classList.add('is-frenzy-activating');
        this.activationTimer = setTimeout(() => {
          this.rootElement?.classList.remove('is-frenzy-activating');
          this.activationTimer = null;
        }, 900);
      } else {
        this.rootElement.classList.remove('is-frenzy-activating');
      }
    }
    this.frenzyActive = active;
    const urgent = active && remaining > 0 && remaining <= 1.5;
    if (this.rootElement && urgent !== this.frenzyUrgent) {
      this.rootElement.dataset.frenzyUrgent = urgent ? 'true' : 'false';
    }
    if (this.frenzyElement) {
      this.frenzyElement.dataset.active = active ? 'true' : 'false';
      if (urgent !== this.frenzyUrgent) {
        this.frenzyElement.dataset.urgent = urgent ? 'true' : 'false';
      }
    }
    this.frenzyUrgent = urgent;
    const timeText = Math.max(0, remaining).toFixed(1);
    if (this.timeElement && timeText !== this.lastFrenzyTimeText) {
      this.lastFrenzyTimeText = timeText;
      this.timeElement.textContent = timeText;
    }
  }

  public showPraise(
    label: string,
    tone: 'green' | 'gold',
    duration = 760,
    priority = 1,
  ): void {
    if (!this.praiseElement) {
      return;
    }
    const now = performance.now();
    if (now < this.praiseVisibleUntil && priority < this.praisePriority) return;
    if (this.praiseTimer) clearTimeout(this.praiseTimer);
    this.praisePriority = priority;
    this.praiseVisibleUntil = now + Math.max(400, duration);
    this.praiseElement.textContent = label;
    this.praiseElement.dataset.tone = tone;
    this.praiseElement.dataset.long = label.length > 28 ? 'true' : 'false';
    this.praiseElement.style.setProperty('--praise-duration', `${Math.max(400, duration)}ms`);
    this.praiseElement.classList.remove('is-visible');
    void this.praiseElement.offsetWidth;
    this.praiseElement.classList.add('is-visible');
    this.praiseTimer = setTimeout(() => {
      this.praiseElement?.classList.remove('is-visible');
      this.praiseTimer = null;
      this.praisePriority = 0;
      this.praiseVisibleUntil = 0;
    }, Math.max(400, duration));
  }

  public showCoach(title: string, body: string, duration = 3200): void {
    if (!this.coachElement) return;
    if (this.coachTimer) clearTimeout(this.coachTimer);
    if (this.coachTitleElement) this.coachTitleElement.textContent = title;
    if (this.coachBodyElement) this.coachBodyElement.textContent = body;
    this.coachElement.dataset.active = 'true';
    this.coachTimer = setTimeout(() => {
      if (this.coachElement) this.coachElement.dataset.active = 'false';
      this.coachTimer = null;
    }, duration);
  }

  protected override onDestroy(): void {
    if (this.praiseTimer) {
      clearTimeout(this.praiseTimer);
      this.praiseTimer = null;
    }
    if (this.activationTimer) {
      clearTimeout(this.activationTimer);
      this.activationTimer = null;
    }
    if (this.coachTimer) {
      clearTimeout(this.coachTimer);
      this.coachTimer = null;
    }
    this.rootElement = null;
    this.frenzyElement = null;
    this.timeElement = null;
    this.praiseElement = null;
    this.coachElement = null;
    this.coachTitleElement = null;
    this.coachBodyElement = null;
    this.frenzyActive = false;
    this.frenzyUrgent = false;
    this.lastFrenzyPercent = -1;
    this.lastFrenzyTimeText = '';
    this.praisePriority = 0;
    this.praiseVisibleUntil = 0;
  }
}
