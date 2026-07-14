import * as ENGINE from '@gnsx/genesys.js';

type MainMenuPanel = 'home' | 'how-to-play' | 'settings';

export interface DribbleMainMenuOptions extends ENGINE.BaseUIComponentOptions {
  onPlay?: () => void;
  onVolumeChange?: (volume: number) => void;
}

export class DribbleMainMenu extends ENGINE.BaseUIComponent<DribbleMainMenuOptions> {
  public static metadata: ENGINE.UIComponentMetadata = {
    displayName: 'Basketball Frenzy Main Menu',
    category: 'menu',
    summary: 'Full-screen main menu for Basketball Frenzy.',
    useCases: ['main menu', 'start screen', 'settings', 'controls'],
    optionsType: 'DribbleMainMenuOptions',
    assetPaths: {
      template: '@project/assets/ui/dribble-main-menu-sparkle.html',
      styles: '@project/assets/ui/dribble-main-menu-boogaloo.css',
    },
  };

  private rootElement: HTMLElement | null = null;
  private volumeInput: HTMLInputElement | null = null;
  private volumeValue: HTMLElement | null = null;
  private fullscreenInput: HTMLInputElement | null = null;

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
      onVolumeChange: () => {},
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
  }

  protected override async onInitialize(): Promise<void> {
    if (!this.layout) return;
    const slot = (name: string): HTMLElement | null => (
      this.layout?.querySelector(`[data-menu-${name}-slot]`) as HTMLElement | null
    );
    const playSlot = slot('play');
    const howSlot = slot('how');
    const settingsSlot = slot('settings');
    const howBackSlot = slot('how-back');
    const settingsBackSlot = slot('settings-back');
    if (!playSlot || !howSlot || !settingsSlot || !howBackSlot || !settingsBackSlot) return;

    await Promise.all([
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.primaryLarge,
        label: 'Play',
        onClick: () => this.options.onPlay(),
      }, playSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Tutorial',
        onClick: () => this.showPanel('how-to-play'),
      }, howSlot),
      this.mountChild(ENGINE.Button, {
        ...ENGINE.Button.presets.outlineLarge,
        label: 'Settings',
        onClick: () => this.showPanel('settings'),
      }, settingsSlot),
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
    ]);

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
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    this.handleFullscreenChange();
    this.showPanel('home');
  }

  public showHome(): void {
    this.showPanel('home');
    this.show();
  }

  private showPanel(panel: MainMenuPanel): void {
    if (this.rootElement) this.rootElement.dataset.panel = panel;
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
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    this.rootElement = null;
    this.volumeInput = null;
    this.volumeValue = null;
    this.fullscreenInput = null;
  }
}
