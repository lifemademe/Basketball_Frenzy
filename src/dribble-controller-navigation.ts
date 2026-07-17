import * as ENGINE from '@gnsx/genesys.js';

export type ControllerMenuDirection = 'up' | 'down' | 'left' | 'right';

export interface DribbleControllerNavigationOptions extends ENGINE.BaseUIComponentOptions {
  container?: HTMLElement | null;
}

export class DribbleControllerNavigation extends ENGINE.BaseUIComponent<DribbleControllerNavigationOptions> {
  public static metadata: ENGINE.UIComponentMetadata = {
    displayName: 'Dribble Controller Navigation',
    category: 'navigation',
    summary: 'Spatial controller focus for Basketball Frenzy menus.',
    useCases: ['controller navigation', 'menu focus', 'gamepad UI'],
    optionsType: 'DribbleControllerNavigationOptions',
    assetPaths: {
      template: '@project/assets/ui/dribble-controller-navigation.html',
      styles: '@project/assets/ui/dribble-controller-navigation.css',
    },
  };

  private frameElement: HTMLElement | null = null;
  private focusedElement: HTMLElement | null = null;
  private navigationActive = false;

  private readonly handlePointerInput = (): void => {
    if (!this.navigationActive) return;
    this.clearFocus();
  };

  private readonly handleResize = (): void => {
    this.updateFrame();
  };

  protected override getAssetPaths(): { templatePath: string; stylesPath: string } {
    return {
      templatePath: DribbleControllerNavigation.metadata.assetPaths.template,
      stylesPath: DribbleControllerNavigation.metadata.assetPaths.styles,
    };
  }

  protected override getDefaultOptions(): Required<DribbleControllerNavigationOptions> {
    return {
      position: 'center',
      visible: false,
      customClasses: [],
      customStyles: {},
      container: null,
    };
  }

  protected override getInitialData(): Record<string, string> {
    return {};
  }

  protected override cacheElements(): void {
    this.frameElement = this.layout?.querySelector('[data-controller-focus-frame]') as HTMLElement | null;
  }

  protected override async onInitialize(): Promise<void> {
    this.options.container?.addEventListener('pointerdown', this.handlePointerInput, { capture: true });
    this.options.container?.addEventListener('scroll', this.handleResize, { capture: true });
    window.addEventListener('resize', this.handleResize);
  }

  public setNavigationActive(active: boolean): void {
    this.navigationActive = active;
    if (!active) this.clearFocus();
  }

  public move(direction: ControllerMenuDirection): boolean {
    if (!this.navigationActive) return false;
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return false;

    if (this.adjustRange(direction)) return true;
    const current = this.getCurrentElement(focusable);
    const next = current
      ? this.findDirectionalCandidate(current, focusable, direction)
      : this.getDefaultElement(focusable);
    this.focusElement(next ?? this.getWrappedElement(focusable, direction));
    return true;
  }

  public confirm(): boolean {
    if (!this.navigationActive) return false;
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return false;
    const element = this.getCurrentElement(focusable) ?? this.getDefaultElement(focusable);
    if (!element) return false;
    this.focusElement(element);
    if (element instanceof HTMLInputElement && element.type === 'text') {
      element.focus();
      return true;
    }
    element.click();
    requestAnimationFrame(() => this.focusDefaultVisibleElement());
    return true;
  }

  public refresh(): void {
    if (!this.navigationActive || !this.focusedElement) return;
    requestAnimationFrame(() => this.focusDefaultVisibleElement());
  }

  protected override onDestroy(): void {
    this.options.container?.removeEventListener('pointerdown', this.handlePointerInput, { capture: true });
    this.options.container?.removeEventListener('scroll', this.handleResize, { capture: true });
    window.removeEventListener('resize', this.handleResize);
    this.clearFocus();
    this.frameElement = null;
  }

  private getFocusableElements(): HTMLElement[] {
    const container = this.options.container;
    if (!container) return [];
    const activeScope = container.querySelector<HTMLElement>(
      '[data-reset-confirmation][data-active="true"], [data-name-entry][data-active="true"]',
    ) ?? container;
    const candidates = Array.from(activeScope.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"]), [role="button"]',
    ));
    return candidates.filter(element => (
      !element.matches('[data-menu-ball], [data-controller-nav="false"]')
      && !element.closest('[aria-hidden="true"]')
      && this.isElementVisible(element)
    ));
  }

  private isElementVisible(element: HTMLElement): boolean {
    const style = getComputedStyle(element);
    if (
      style.display === 'none'
      || style.visibility === 'hidden'
      || (!(element instanceof HTMLInputElement) && Number(style.opacity) <= 0.02)
    ) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2;
  }

  private getCurrentElement(focusable: HTMLElement[]): HTMLElement | null {
    if (this.focusedElement && focusable.includes(this.focusedElement)) return this.focusedElement;
    const activeElement = document.activeElement;
    return activeElement instanceof HTMLElement && focusable.includes(activeElement) ? activeElement : null;
  }

  private getDefaultElement(focusable: HTMLElement[]): HTMLElement | null {
    const resetCancel = this.options.container?.querySelector<HTMLElement>(
      '[data-reset-confirmation][data-active="true"] [data-reset-cancel]',
    );
    if (resetCancel && focusable.includes(resetCancel)) return resetCancel;
    const nameInput = this.options.container?.querySelector<HTMLElement>(
      '[data-name-entry][data-active="true"] [data-player-name-input]',
    );
    if (nameInput && focusable.includes(nameInput)) return nameInput;
    const root = this.options.container?.querySelector<HTMLElement>('[data-main-menu]');
    const panel = root && this.isElementVisible(root) ? root.dataset.panel : undefined;
    const selectors = panel === 'home'
      ? ['[data-menu-play-slot] button']
      : panel === 'mode-select'
        ? ['[data-menu-normal-mode-slot] button']
        : panel === 'tutorial-select'
          ? ['[data-menu-classic-tutorial-slot] button']
          : panel === 'settings'
            ? ['[data-menu-volume]']
            : panel === 'shop'
              ? ['[data-menu-classic-action-slot] button', '[data-menu-epic-action-slot] button']
              : panel === 'reset'
                ? ['[data-reset-choice]']
                : panel === 'achievements'
                  ? ['[data-menu-achievements-back-slot] button']
                  : [
                    '[data-menu-name-confirm-slot] button',
                    '[data-overlay-resume-slot] button',
                    '[data-overlay-restart-slot] button',
                  ];
    for (const selector of selectors) {
      const candidate = this.options.container?.querySelector<HTMLElement>(selector);
      if (candidate && focusable.includes(candidate)) return candidate;
    }
    return focusable[0] ?? null;
  }

  private findDirectionalCandidate(
    current: HTMLElement,
    focusable: HTMLElement[],
    direction: ControllerMenuDirection,
  ): HTMLElement | null {
    const currentRect = this.getNavigationRect(current);
    const currentX = currentRect.left + currentRect.width / 2;
    const currentY = currentRect.top + currentRect.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of focusable) {
      if (candidate === current) continue;
      const rect = this.getNavigationRect(candidate);
      const deltaX = rect.left + rect.width / 2 - currentX;
      const deltaY = rect.top + rect.height / 2 - currentY;
      const primary = direction === 'left'
        ? -deltaX
        : direction === 'right'
          ? deltaX
          : direction === 'up'
            ? -deltaY
            : deltaY;
      if (primary <= 4) continue;
      const secondary = direction === 'left' || direction === 'right'
        ? Math.abs(deltaY)
        : Math.abs(deltaX);
      const score = primary + secondary * 1.85;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }

  private getWrappedElement(
    focusable: HTMLElement[],
    direction: ControllerMenuDirection,
  ): HTMLElement | null {
    const horizontal = direction === 'left' || direction === 'right';
    const descending = direction === 'left' || direction === 'up';
    return [...focusable].sort((first, second) => {
      const firstRect = this.getNavigationRect(first);
      const secondRect = this.getNavigationRect(second);
      const firstValue = horizontal ? firstRect.left : firstRect.top;
      const secondValue = horizontal ? secondRect.left : secondRect.top;
      return descending ? secondValue - firstValue : firstValue - secondValue;
    })[0] ?? null;
  }

  private adjustRange(direction: ControllerMenuDirection): boolean {
    if (!(this.focusedElement instanceof HTMLInputElement) || this.focusedElement.type !== 'range') {
      return false;
    }
    if (direction !== 'left' && direction !== 'right') return false;
    const input = this.focusedElement;
    const step = Number(input.step) || 1;
    const minimum = Number(input.min) || 0;
    const maximum = Number(input.max) || 100;
    const nextValue = Number(input.value) + (direction === 'right' ? step : -step);
    input.value = String(Math.max(minimum, Math.min(maximum, nextValue)));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    this.updateFrame();
    return true;
  }

  private focusDefaultVisibleElement(): void {
    if (!this.navigationActive) {
      this.clearFocus();
      return;
    }
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) {
      this.clearFocus();
      return;
    }
    const current = this.getCurrentElement(focusable);
    this.focusElement(current ?? this.getDefaultElement(focusable));
  }

  private focusElement(element: HTMLElement | null): void {
    if (!element) return;
    this.focusedElement?.removeAttribute('data-controller-focus');
    this.focusedElement = element;
    element.dataset.controllerFocus = 'true';
    element.focus({ preventScroll: true });
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    this.show();
    requestAnimationFrame(() => this.updateFrame());
  }

  private clearFocus(): void {
    this.focusedElement?.removeAttribute('data-controller-focus');
    this.focusedElement = null;
    this.hide();
  }

  private updateFrame(): void {
    if (!this.frameElement || !this.focusedElement || !this.isElementVisible(this.focusedElement)) {
      this.hide();
      return;
    }
    const containerRect = this.options.container?.getBoundingClientRect();
    const elementRect = this.getNavigationRect(this.focusedElement);
    if (!containerRect) return;
    this.frameElement.style.setProperty('--focus-left', `${elementRect.left - containerRect.left}px`);
    this.frameElement.style.setProperty('--focus-top', `${elementRect.top - containerRect.top}px`);
    this.frameElement.style.setProperty('--focus-width', `${elementRect.width}px`);
    this.frameElement.style.setProperty('--focus-height', `${elementRect.height}px`);
  }

  private getNavigationRect(element: HTMLElement): DOMRect {
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      const label = element.closest('label');
      if (label instanceof HTMLElement) return label.getBoundingClientRect();
    }
    return element.getBoundingClientRect();
  }
}
