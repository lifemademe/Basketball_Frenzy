import * as ENGINE from '@gnsx/genesys.js';

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
      template: '@project/assets/ui/dribble-lives.html',
      styles: '@project/assets/ui/dribble-status-hud.css',
    },
  };

  private rootElement: HTMLElement | null = null;
  private heartsElement: HTMLElement | null = null;
  private lives = 3;
  private hitTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(ui: ENGINE.UIManager, options: DribbleLivesDisplayOptions = {}) {
    super(ui, options);
    this.lives = this.options.initialLives;
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
    return { label: 'LIVES' };
  }

  protected override cacheElements(): void {
    if (!this.layout) return;
    this.rootElement = this.layout.querySelector('[data-dribble-lives]') as HTMLElement | null;
    this.heartsElement = this.layout.querySelector('[data-lives-hearts]') as HTMLElement | null;
  }

  protected override async onInitialize(): Promise<void> {
    this.renderHearts();
  }

  public setLives(lives: number): void {
    const nextLives = Math.max(0, Math.min(this.options.maxLives, lives));
    const lostLife = nextLives < this.lives;
    const gainedLife = nextLives > this.lives;
    this.lives = nextLives;
    this.renderHearts();

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

  private renderHearts(): void {
    if (!this.heartsElement) {
      return;
    }
    this.heartsElement.replaceChildren();
    for (let index = 0; index < this.options.maxLives; index += 1) {
      const heart = document.createElement('span');
      heart.className = 'dribble-life-heart';
      heart.dataset.active = index < this.lives ? 'true' : 'false';
      heart.innerHTML = ENGINE.Icons.heart;
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
      styles: '@project/assets/ui/dribble-status-hud.css',
    },
  };

  private rootElement: HTMLElement | null = null;
  private stateElement: HTMLElement | null = null;

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
    return { label: 'CENTER TARGET', state: 'SCANNING' };
  }

  protected override cacheElements(): void {
    if (!this.layout) return;
    this.rootElement = this.layout.querySelector('[data-dribble-timing]') as HTMLElement | null;
    this.stateElement = this.layout.querySelector('[data-timing-state]') as HTMLElement | null;
  }

  public setTiming(progress: number, active: boolean, ready: boolean): void {
    if (!this.rootElement) {
      return;
    }
    const clampedProgress = Math.max(0, Math.min(1, progress));
    this.rootElement.style.setProperty('--timing-progress', `${clampedProgress * 100}%`);
    this.rootElement.dataset.active = active ? 'true' : 'false';
    this.rootElement.dataset.ready = ready ? 'true' : 'false';
    if (this.stateElement) {
      this.stateElement.textContent = !active ? 'SCANNING' : ready ? 'SWITCH' : 'TRACKING';
    }
  }

  protected override onDestroy(): void {
    this.rootElement = null;
    this.stateElement = null;
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
      styles: '@project/assets/ui/dribble-status-hud.css',
    },
  };

  private rootElement: HTMLElement | null = null;
  private frenzyElement: HTMLElement | null = null;
  private timeElement: HTMLElement | null = null;
  private praiseElement: HTMLElement | null = null;
  private praiseTimer: ReturnType<typeof setTimeout> | null = null;

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
    return { label: 'FRENZY', time: '8.0' };
  }

  protected override cacheElements(): void {
    if (!this.layout) return;
    this.rootElement = this.layout.querySelector('[data-dribble-juice]') as HTMLElement | null;
    this.frenzyElement = this.layout.querySelector('[data-frenzy-meter]') as HTMLElement | null;
    this.timeElement = this.layout.querySelector('[data-frenzy-time]') as HTMLElement | null;
    this.praiseElement = this.layout.querySelector('[data-score-praise]') as HTMLElement | null;
  }

  public setFrenzy(progress: number, remaining: number, active: boolean): void {
    const clamped = Math.max(0, Math.min(1, progress));
    this.rootElement?.style.setProperty('--frenzy-progress', String(clamped));
    this.rootElement?.style.setProperty('--frenzy-inset', `${(1 - clamped) * 50}%`);
    if (this.frenzyElement) this.frenzyElement.dataset.active = active ? 'true' : 'false';
    if (this.timeElement) this.timeElement.textContent = remaining.toFixed(1);
  }

  public showPraise(label: string, tone: 'green' | 'gold'): void {
    if (!this.praiseElement) {
      return;
    }
    if (this.praiseTimer) clearTimeout(this.praiseTimer);
    this.praiseElement.textContent = label;
    this.praiseElement.dataset.tone = tone;
    this.praiseElement.classList.remove('is-visible');
    void this.praiseElement.offsetWidth;
    this.praiseElement.classList.add('is-visible');
    this.praiseTimer = setTimeout(() => {
      this.praiseElement?.classList.remove('is-visible');
      this.praiseTimer = null;
    }, 760);
  }

  protected override onDestroy(): void {
    if (this.praiseTimer) {
      clearTimeout(this.praiseTimer);
      this.praiseTimer = null;
    }
    this.rootElement = null;
    this.frenzyElement = null;
    this.timeElement = null;
    this.praiseElement = null;
  }
}
