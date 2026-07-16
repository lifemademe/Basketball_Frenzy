import * as ENGINE from '@gnsx/genesys.js';

export type VersusOwner = 'player' | 'ai';
export type VersusCalloutTone = 'gold' | 'danger' | 'blue';

export interface DribbleVersusHudOptions extends ENGINE.BaseUIComponentOptions {}

export class DribbleVersusHud extends ENGINE.BaseUIComponent<DribbleVersusHudOptions> {
  public static metadata: ENGINE.UIComponentMetadata = {
    displayName: 'Last Bounce HUD',
    category: 'hud',
    summary: 'Round, possession, and pressure presentation for Last Bounce mode.',
    useCases: ['versus hud', 'round score', 'possession'],
    optionsType: 'DribbleVersusHudOptions',
    assetPaths: {
      template: '@project/assets/ui/dribble-versus-hud.html',
      styles: '@project/assets/ui/dribble-versus-hud.css',
    },
  };

  private rootElement: HTMLElement | null = null;
  private roundElement: HTMLElement | null = null;
  private ownerElement: HTMLElement | null = null;
  private actionElement: HTMLElement | null = null;
  private pressureElement: HTMLElement | null = null;
  private playerRoundsElement: HTMLElement | null = null;
  private aiRoundsElement: HTMLElement | null = null;
  private calloutElement: HTMLElement | null = null;
  private calloutTitleElement: HTMLElement | null = null;
  private calloutSubtitleElement: HTMLElement | null = null;
  private calloutTimer: ReturnType<typeof setTimeout> | null = null;
  private renderedPlayerLosses = -1;
  private renderedAiLosses = -1;

  protected override getAssetPaths(): { templatePath: string; stylesPath: string } {
    return {
      templatePath: DribbleVersusHud.metadata.assetPaths.template,
      stylesPath: DribbleVersusHud.metadata.assetPaths.styles,
    };
  }

  protected override getDefaultOptions(): Required<DribbleVersusHudOptions> {
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
    this.rootElement = this.layout?.querySelector('[data-versus-hud]') as HTMLElement | null;
    this.roundElement = this.layout?.querySelector('[data-versus-round]') as HTMLElement | null;
    this.ownerElement = this.layout?.querySelector('[data-versus-owner]') as HTMLElement | null;
    this.actionElement = this.layout?.querySelector('[data-versus-action]') as HTMLElement | null;
    this.pressureElement = this.layout?.querySelector('[data-versus-pressure]') as HTMLElement | null;
    this.playerRoundsElement = this.layout?.querySelector('[data-versus-player-rounds]') as HTMLElement | null;
    this.aiRoundsElement = this.layout?.querySelector('[data-versus-ai-rounds]') as HTMLElement | null;
    this.calloutElement = this.layout?.querySelector('[data-versus-callout]') as HTMLElement | null;
    this.calloutTitleElement = this.layout?.querySelector('[data-versus-callout-title]') as HTMLElement | null;
    this.calloutSubtitleElement = this.layout?.querySelector('[data-versus-callout-subtitle]') as HTMLElement | null;
  }

  public setMatchState(
    owner: VersusOwner,
    round: number,
    playerLosses: number,
    aiLosses: number,
    pressure: number,
    receiving: boolean,
    catching: boolean,
    returnLocked: boolean,
  ): void {
    const clampedPressure = Math.max(0, Math.min(1, pressure));
    if (this.rootElement) {
      this.rootElement.dataset.owner = owner;
      this.rootElement.dataset.catching = catching ? 'true' : 'false';
      this.rootElement.dataset.returnLocked = returnLocked ? 'true' : 'false';
      this.rootElement.dataset.pressure = clampedPressure >= 1
        ? 'critical'
        : clampedPressure >= 0.68
          ? 'warning'
          : 'calm';
    }
    if (this.roundElement) this.roundElement.textContent = `ROUND ${round}`;
    if (this.ownerElement) this.ownerElement.textContent = owner === 'player' ? 'YOUR POSSESSION' : 'AI POSSESSION';
    if (this.actionElement) {
      this.actionElement.textContent = receiving
        ? 'BALL IN TRANSIT'
        : catching
          ? returnLocked
            ? 'SECURE THE CATCH'
            : owner === 'player'
              ? 'CATCH WINDOW - LEFT: RETURN'
              : 'AI RETURN WINDOW'
          : clampedPressure >= 1
            ? 'LANE OVERDRIVE - PASS OR POWER'
            : owner === 'player'
              ? 'LEFT: PASS - RIGHT: POWER'
              : 'READ THE AI';
    }
    if (this.pressureElement) {
      this.pressureElement.style.width = `${Math.round(clampedPressure * 100)}%`;
    }
    if (playerLosses !== this.renderedPlayerLosses) {
      this.renderedPlayerLosses = playerLosses;
      this.renderLosses(this.playerRoundsElement, playerLosses);
    }
    if (aiLosses !== this.renderedAiLosses) {
      this.renderedAiLosses = aiLosses;
      this.renderLosses(this.aiRoundsElement, aiLosses);
    }
  }

  public showCallout(
    title: string,
    subtitle: string,
    tone: VersusCalloutTone = 'gold',
    duration = 1100,
  ): void {
    if (this.calloutTimer !== null) clearTimeout(this.calloutTimer);
    if (this.calloutTitleElement) this.calloutTitleElement.textContent = title;
    if (this.calloutSubtitleElement) this.calloutSubtitleElement.textContent = subtitle;
    if (this.calloutElement) {
      this.calloutElement.dataset.tone = tone;
      this.calloutElement.dataset.active = 'true';
    }
    this.calloutTimer = setTimeout(() => {
      this.calloutTimer = null;
      if (this.calloutElement) this.calloutElement.dataset.active = 'false';
    }, duration);
  }

  private renderLosses(element: HTMLElement | null, losses: number): void {
    if (!element) return;
    element.replaceChildren();
    for (let index = 0; index < 3; index += 1) {
      const marker = document.createElement('i');
      marker.dataset.lost = String(index < losses);
      element.append(marker);
    }
  }

  protected override onDestroy(): void {
    if (this.calloutTimer !== null) clearTimeout(this.calloutTimer);
    this.calloutTimer = null;
    this.rootElement = null;
    this.roundElement = null;
    this.ownerElement = null;
    this.actionElement = null;
    this.pressureElement = null;
    this.playerRoundsElement = null;
    this.aiRoundsElement = null;
    this.calloutElement = null;
    this.calloutTitleElement = null;
    this.calloutSubtitleElement = null;
    this.renderedPlayerLosses = -1;
    this.renderedAiLosses = -1;
  }
}
