import * as ENGINE from '@gnsx/genesys.js';

import type { DribbleSide } from './dribble-ball.js';

export type DribbleTouchControlMode = 'split-tap' | 'swipe';

export const touchControlModeKey = 'basketball-frenzy-touch-control-mode';

export type DribbleTouchAction =
  | 'boost'
  | 'queued-boost'
  | 'queued-transfer'
  | 'transfer'
  | null;

export interface DribbleTouchControlsOptions extends ENGINE.BaseUIComponentOptions {
  container?: HTMLElement | null;
  onAction?: (side: DribbleSide) => DribbleTouchAction;
  getBallSide?: () => DribbleSide;
  mode?: DribbleTouchControlMode;
}

interface TouchGestureStart {
  x: number;
  y: number;
  startedAt: number;
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
  private readonly activePointers = new Map<number, TouchGestureStart>();
  private gestureFeedbackElement: HTMLElement | null = null;
  private gesturePulseTimer: ReturnType<typeof setTimeout> | null = null;
  private mode: DribbleTouchControlMode = 'split-tap';
  private previousTouchAction = '';
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
    event.preventDefault();
    event.stopPropagation();
    this.activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startedAt: performance.now(),
    });
    if (this.mode === 'swipe') return;

    const bounds = container.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const horizontalPosition = (event.clientX - bounds.left) / bounds.width;
    const side = horizontalPosition < 0.47
      ? 'left'
      : horizontalPosition > 0.53
        ? 'right'
        : null;
    if (!side) return;

    const action = this.options.onAction(side);
    this.pulse(side, action !== null);
    this.vibrateForAction(action);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.mode !== 'swipe' || !this.activePointers.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const start = this.activePointers.get(event.pointerId);
    this.activePointers.delete(event.pointerId);
    if (!start || this.mode !== 'swipe') return;
    event.preventDefault();
    event.stopPropagation();
    this.resolveSwipe(event, start);
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
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
      getBallSide: () => 'left',
      mode: 'split-tap',
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
    const gestureElement = this.layout?.querySelector('[data-touch-feedback="up"]');
    this.gestureFeedbackElement = gestureElement instanceof HTMLElement ? gestureElement : null;
  }

  protected override async onInitialize(): Promise<void> {
    const container = this.options.container;
    this.mode = this.options.mode;
    this.previousTouchAction = container?.style.touchAction ?? '';
    container?.addEventListener('pointerdown', this.handlePointerDown, {
      capture: true,
      passive: false,
    });
    container?.addEventListener('pointermove', this.handlePointerMove, {
      capture: true,
      passive: false,
    });
    container?.addEventListener('pointerup', this.handlePointerUp, { capture: true });
    container?.addEventListener('pointercancel', this.handlePointerCancel, { capture: true });
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
    this.syncTouchAction();
    if (active) this.show();
    else {
      this.hide();
      this.activePointers.clear();
    }
  }

  public setMode(mode: DribbleTouchControlMode): void {
    this.mode = mode;
    this.activePointers.clear();
    this.syncTouchAction();
  }

  protected override onDestroy(): void {
    const container = this.options.container;
    container?.removeEventListener('pointerdown', this.handlePointerDown, { capture: true });
    container?.removeEventListener('pointermove', this.handlePointerMove, { capture: true });
    container?.removeEventListener('pointerup', this.handlePointerUp, { capture: true });
    container?.removeEventListener('pointercancel', this.handlePointerCancel, { capture: true });
    for (const timer of this.pulseTimers.values()) clearTimeout(timer);
    this.pulseTimers.clear();
    this.activePointers.clear();
    this.feedbackElements.clear();
    if (this.gesturePulseTimer) clearTimeout(this.gesturePulseTimer);
    this.gesturePulseTimer = null;
    this.gestureFeedbackElement = null;
    if (container) container.style.touchAction = this.previousTouchAction;
    this.inputActive = false;
  }

  private syncTouchAction(): void {
    const container = this.options.container;
    if (!container) return;
    container.style.touchAction = this.inputActive && this.mode === 'swipe'
      ? 'none'
      : this.previousTouchAction;
  }

  private resolveSwipe(event: PointerEvent, start: TouchGestureStart): void {
    const container = this.options.container;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const threshold = Math.max(42, Math.min(64, Math.min(bounds.width, bounds.height) * 0.075));
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const duration = performance.now() - start.startedAt;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const holder = this.options.getBallSide();

    if (duration <= 650 && dy <= -threshold && absY > absX * 1.15) {
      const action = this.options.onAction(holder);
      this.pulseGesture(action !== null);
      this.vibrateForAction(action);
      return;
    }

    if (duration <= 650 && absX >= threshold && absX > absY * 1.15) {
      const destination: DribbleSide = dx < 0 ? 'left' : 'right';
      if (destination === holder) {
        this.pulse(destination, false);
        return;
      }
      const action = this.options.onAction(destination);
      this.pulse(destination, action !== null);
      this.vibrateForAction(action);
      return;
    }

    this.pulseGesture(false);
  }

  private pulseGesture(accepted: boolean): void {
    const element = this.gestureFeedbackElement;
    if (!element) return;
    if (this.gesturePulseTimer) clearTimeout(this.gesturePulseTimer);
    element.dataset.accepted = accepted ? 'true' : 'false';
    element.classList.remove('is-active');
    void element.offsetWidth;
    element.classList.add('is-active');
    this.gesturePulseTimer = setTimeout(() => {
      element.classList.remove('is-active');
      this.gesturePulseTimer = null;
    }, 360);
  }

  private vibrateForAction(action: DribbleTouchAction): void {
    if (!action || typeof navigator.vibrate !== 'function') return;
    const duration = action === 'boost' || action === 'queued-boost' ? 28 : 16;
    navigator.vibrate(duration);
  }
}
