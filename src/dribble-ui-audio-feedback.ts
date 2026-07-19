import * as ENGINE from '@gnsx/genesys.js';

const uiClickPath = '@project/assets/audio/ui-type-click.wav';
const hoverCooldownMs = 55;

export class DribbleUiAudioFeedback {
  private lastHoverAt = 0;

  private readonly handlePointerOver = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    const target = this.getInteractiveTarget(event.target);
    if (!target) return;
    const previous = this.getInteractiveTarget(event.relatedTarget);
    if (previous === target) return;
    this.playHover();
  };

  private readonly handleFocusIn = (event: FocusEvent): void => {
    const target = this.getInteractiveTarget(event.target);
    if (!target) return;
    if (target.dataset.controllerFocus !== 'true' && !target.matches(':focus-visible')) return;
    this.playHover();
  };

  private readonly handleClick = (event: MouseEvent): void => {
    if (!this.getInteractiveTarget(event.target)) return;
    void this.world.globalAudioManager.playGlobalSound(uiClickPath, {
      volume: 0.2,
      bus: 'SFX',
    });
  };

  public constructor(
    private readonly world: ENGINE.World,
    private readonly container: HTMLElement,
  ) {
    container.addEventListener('pointerover', this.handlePointerOver);
    container.addEventListener('focusin', this.handleFocusIn);
    container.addEventListener('click', this.handleClick);
  }

  public destroy(): void {
    this.container.removeEventListener('pointerover', this.handlePointerOver);
    this.container.removeEventListener('focusin', this.handleFocusIn);
    this.container.removeEventListener('click', this.handleClick);
  }

  private getInteractiveTarget(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null;
    const interactive = target.closest<HTMLElement>('button, select, [role="button"]');
    if (!interactive || !this.container.contains(interactive)) return null;
    if (interactive.matches('[disabled], [aria-disabled="true"], [data-menu-ball]')) return null;
    return interactive;
  }

  private playHover(): void {
    const now = performance.now();
    if (now - this.lastHoverAt < hoverCooldownMs) return;
    this.lastHoverAt = now;
    void this.world.globalAudioManager.playGlobalSound(uiClickPath, {
      volume: 0.075,
      bus: 'SFX',
    });
  }
}
