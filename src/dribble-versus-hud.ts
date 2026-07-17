import * as ENGINE from '@gnsx/genesys.js';

export type VersusOwner = 'player' | 'ai';
export type VersusCalloutTone = 'gold' | 'danger' | 'blue' | 'recovery';
export type VersusTutorialFocus = 'lives' | 'risk' | null;

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
  private playerRiskCardsElement: HTMLElement | null = null;
  private aiRiskCardsElement: HTMLElement | null = null;
  private calloutElement: HTMLElement | null = null;
  private calloutTitleElement: HTMLElement | null = null;
  private calloutSubtitleElement: HTMLElement | null = null;
  private opponentNameElement: HTMLElement | null = null;
  private calloutTimer: ReturnType<typeof setTimeout> | null = null;
  private roundResultTimer: ReturnType<typeof setTimeout> | null = null;
  private renderedPlayerLosses = -1;
  private renderedAiLosses = -1;
  private renderedPlayerRiskCards = -1;
  private renderedAiRiskCards = -1;
  private renderedOwner: VersusOwner | null = null;
  private renderedRound = -1;
  private renderedAction = '';
  private renderedPressurePercent = -1;
  private renderedPressureState = '';
  private renderedCatching: boolean | null = null;
  private renderedReturnLocked: boolean | null = null;

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
    this.playerRiskCardsElement = this.layout?.querySelector('[data-versus-player-risk-cards]') as HTMLElement | null;
    this.aiRiskCardsElement = this.layout?.querySelector('[data-versus-ai-risk-cards]') as HTMLElement | null;
    this.calloutElement = this.layout?.querySelector('[data-versus-callout]') as HTMLElement | null;
    this.calloutTitleElement = this.layout?.querySelector('[data-versus-callout-title]') as HTMLElement | null;
    this.calloutSubtitleElement = this.layout?.querySelector('[data-versus-callout-subtitle]') as HTMLElement | null;
    this.opponentNameElement = this.layout?.querySelector('[data-versus-opponent-name]') as HTMLElement | null;
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
    playerRiskCards: number,
    aiRiskCards: number,
  ): void {
    const clampedPressure = Math.max(0, Math.min(1, pressure));
    const ownerRiskCards = owner === 'player' ? playerRiskCards : aiRiskCards;
    const pressurePercent = Math.round(clampedPressure * 100);
    const pressureState = clampedPressure >= 1
      ? 'critical'
      : clampedPressure >= 0.68
        ? 'warning'
        : 'calm';
    const action = receiving
      ? 'BALL IN TRANSIT'
      : catching
        ? returnLocked
          ? 'SECURE THE CATCH'
          : owner === 'player'
            ? 'CATCH WINDOW - LEFT: RETURN'
            : 'AI RETURN WINDOW'
        : ownerRiskCards === 0
          ? 'NO RISK CARDS - CLEAN PASSES ONLY'
          : clampedPressure >= 1
            ? 'LANE OVERDRIVE - PASS OR POWER'
            : owner === 'player'
              ? 'LEFT: PASS - RIGHT: POWER'
              : 'READ THE AI';
    if (this.rootElement) {
      if (owner !== this.renderedOwner) this.rootElement.dataset.owner = owner;
      if (catching !== this.renderedCatching) this.rootElement.dataset.catching = catching ? 'true' : 'false';
      if (returnLocked !== this.renderedReturnLocked) {
        this.rootElement.dataset.returnLocked = returnLocked ? 'true' : 'false';
      }
      if (playerRiskCards !== this.renderedPlayerRiskCards) {
        this.rootElement.dataset.playerRisk = playerRiskCards === 0 ? 'empty' : 'ready';
      }
      if (aiRiskCards !== this.renderedAiRiskCards) {
        this.rootElement.dataset.aiRisk = aiRiskCards === 0 ? 'empty' : 'ready';
      }
      if (pressureState !== this.renderedPressureState) this.rootElement.dataset.pressure = pressureState;
    }
    if (this.roundElement && round !== this.renderedRound) this.roundElement.textContent = `ROUND ${round}`;
    if (this.ownerElement && owner !== this.renderedOwner) {
      this.ownerElement.textContent = owner === 'player' ? 'YOUR POSSESSION' : 'AI POSSESSION';
    }
    if (this.actionElement && action !== this.renderedAction) this.actionElement.textContent = action;
    if (this.pressureElement && pressurePercent !== this.renderedPressurePercent) {
      this.pressureElement.style.width = `${pressurePercent}%`;
    }
    if (playerLosses !== this.renderedPlayerLosses) {
      this.renderedPlayerLosses = playerLosses;
      this.renderLosses(this.playerRoundsElement, playerLosses);
    }
    if (aiLosses !== this.renderedAiLosses) {
      this.renderedAiLosses = aiLosses;
      this.renderLosses(this.aiRoundsElement, aiLosses);
    }
    if (playerRiskCards !== this.renderedPlayerRiskCards) {
      this.renderedPlayerRiskCards = playerRiskCards;
      this.renderRiskCards(this.playerRiskCardsElement, playerRiskCards);
    }
    if (aiRiskCards !== this.renderedAiRiskCards) {
      this.renderedAiRiskCards = aiRiskCards;
      this.renderRiskCards(this.aiRiskCardsElement, aiRiskCards);
    }
    this.renderedOwner = owner;
    this.renderedRound = round;
    this.renderedAction = action;
    this.renderedPressurePercent = pressurePercent;
    this.renderedPressureState = pressureState;
    this.renderedCatching = catching;
    this.renderedReturnLocked = returnLocked;
  }

  public setTutorialLayout(active: boolean): void {
    if (this.rootElement) this.rootElement.dataset.tutorial = active ? 'true' : 'false';
  }

  public setTutorialFocus(focus: VersusTutorialFocus): void {
    if (!this.rootElement) return;
    if (focus) this.rootElement.dataset.tutorialFocus = focus;
    else delete this.rootElement.dataset.tutorialFocus;
  }

  public setOpponentName(name: string): void {
    if (this.opponentNameElement) this.opponentNameElement.textContent = name;
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

  public showRoundResult(playerWon: boolean, title: string, subtitle: string): void {
    if (this.roundResultTimer !== null) clearTimeout(this.roundResultTimer);
    if (this.rootElement) this.rootElement.dataset.roundResult = playerWon ? 'win' : 'loss';
    this.showCallout(title, subtitle, playerWon ? 'blue' : 'danger', 1400);
    this.roundResultTimer = setTimeout(() => {
      this.roundResultTimer = null;
      if (this.rootElement) delete this.rootElement.dataset.roundResult;
    }, 780);
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

  private renderRiskCards(element: HTMLElement | null, available: number): void {
    if (!element) return;
    while (element.children.length < 3) {
      const card = document.createElement('i');
      element.append(card);
    }
    for (let index = 0; index < 3; index += 1) {
      const card = element.children.item(index) as HTMLElement | null;
      if (card) card.dataset.available = String(index < available);
    }
  }

  protected override onDestroy(): void {
    if (this.calloutTimer !== null) clearTimeout(this.calloutTimer);
    if (this.roundResultTimer !== null) clearTimeout(this.roundResultTimer);
    this.calloutTimer = null;
    this.roundResultTimer = null;
    this.rootElement = null;
    this.roundElement = null;
    this.ownerElement = null;
    this.actionElement = null;
    this.pressureElement = null;
    this.playerRoundsElement = null;
    this.aiRoundsElement = null;
    this.playerRiskCardsElement = null;
    this.aiRiskCardsElement = null;
    this.calloutElement = null;
    this.calloutTitleElement = null;
    this.calloutSubtitleElement = null;
    this.opponentNameElement = null;
    this.renderedPlayerLosses = -1;
    this.renderedAiLosses = -1;
    this.renderedPlayerRiskCards = -1;
    this.renderedAiRiskCards = -1;
    this.renderedOwner = null;
    this.renderedRound = -1;
    this.renderedAction = '';
    this.renderedPressurePercent = -1;
    this.renderedPressureState = '';
    this.renderedCatching = null;
    this.renderedReturnLocked = null;
  }
}
