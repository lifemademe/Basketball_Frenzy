import * as ENGINE from '@gnsx/genesys.js';

import type { DribbleSide } from './dribble-ball.js';

export type DribbleTouchAction =
  | 'boost'
  | 'queued-boost'
  | 'queued-transfer'
  | 'transfer'
  | null;

export interface DribbleTouchControlsOptions extends ENGINE.BaseUIComponentOptions {
  container?: HTMLElement | null;
  onAction?: (side: DribbleSide) => DribbleTouchAction;
}

export class DribbleTouchControls extends ENGINE.BaseUIComponent<DribbleTouchControlsOptions> {
  public static metadata: ENGINE.UIComponentMetadata = {
    displayName: 'Dribble Touch Controls',
    category: 'input',
    summary: 'Split-screen touch input with directional edge feedback.',
    useCases: ['touchscreen controls', 'mobile input', 'input feedback'],
    optionsType: 'DribbleTouchControlsOptions',
    assetPaths: {
      template: '@project/assets/ui/dribble-touch-controls.html',
      styles: '@project/assets/ui/dribble-touch-controls.css',
    },
  };

  private readonly feedbackElements = new Map<DribbleSide, HTMLElement>();
  private readonly pulseTimers = new Map<DribbleSide, ReturnType<typeof setTimeout>>();
  private readonly activePointers = new Set<number>();
  private inputActive = false;

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.inputActive || event.pointerType !== 'touch' || this.activePointers.has(event.pointerId)) {
      return;
    }
    const target = event.target;
    if (
      target instanceof Element
      && target.closest('button, input, textarea, select, a, [role="button"], [data-touch-ignore]')
    ) {
      return;
    }

    const container = this.options.container;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const horizontalPosition = (event.clientX - bounds.left) / bounds.width;
    const side = horizontalPosition < 0.47
      ? 'left'
      : horizontalPosition > 0.53
        ? 'right'
        : null;
    if (!side) return;

    event.preventDefault();
    event.stopPropagation();
    this.activePointers.add(event.pointerId);
    const action = this.options.onAction(side);
    this.pulse(side, action !== null);
    this.vibrateForAction(action);
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
  };

  protected override getAssetPaths(): { templatePath: string; stylesPath: string } {
    return {
      templatePath: DribbleTouchControls.metadata.assetPaths.template,
      stylesPath: DribbleTouchControls.metadata.assetPaths.styles,
    };
  }

  protected override getDefaultOptions(): Required<DribbleTouchControlsOptions> {
    return {
      position: 'center',
      visible: false,
      customClasses: [],
      customStyles: {},
      container: null,
      onAction: () => null,
    };
  }

  protected override getInitialData(): Record<string, string> {
    return {};
  }

  protected override cacheElements(): void {
    this.feedbackElements.clear();
    for (const side of ['left', 'right'] as const) {
      const element = this.layout?.querySelector(`[data-touch-feedback="${side}"]`);
      if (element instanceof HTMLElement) this.feedbackElements.set(side, element);
    }
  }

  protected override async onInitialize(): Promise<void> {
    const container = this.options.container;
    container?.addEventListener('pointerdown', this.handlePointerDown, {
      capture: true,
      passive: false,
    });
    container?.addEventListener('pointerup', this.handlePointerEnd, { capture: true });
    container?.addEventListener('pointercancel', this.handlePointerEnd, { capture: true });
  }

  public pulse(side: DribbleSide, accepted: boolean): void {
    const element = this.feedbackElements.get(side);
    if (!element) return;
    const existingTimer = this.pulseTimers.get(side);
    if (existingTimer) clearTimeout(existingTimer);
    element.dataset.accepted = accepted ? 'true' : 'false';
    element.classList.remove('is-active');
    void element.offsetWidth;
    element.classList.add('is-active');
    this.pulseTimers.set(side, setTimeout(() => {
      element.classList.remove('is-active');
      this.pulseTimers.delete(side);
    }, 340));
  }

  public setInputActive(active: boolean): void {
    this.inputActive = active;
    if (active) this.show();
    else {
      this.hide();
      this.activePointers.clear();
    }
  }

  protected override onDestroy(): void {
    const container = this.options.container;
    container?.removeEventListener('pointerdown', this.handlePointerDown, { capture: true });
    container?.removeEventListener('pointerup', this.handlePointerEnd, { capture: true });
    container?.removeEventListener('pointercancel', this.handlePointerEnd, { capture: true });
    for (const timer of this.pulseTimers.values()) clearTimeout(timer);
    this.pulseTimers.clear();
    this.activePointers.clear();
    this.feedbackElements.clear();
    this.inputActive = false;
  }

  private vibrateForAction(action: DribbleTouchAction): void {
    if (!action || typeof navigator.vibrate !== 'function') return;
    const duration = action === 'boost' || action === 'queued-boost' ? 28 : 16;
    navigator.vibrate(duration);
  }
}
