const compactLandscapeMaxHeight = 620;
const compactLandscapeMinAspect = 1.25;

export interface DribbleResponsiveUiController {
  dispose(): void;
  refresh(): void;
}

export function createDribbleResponsiveUiController(
  root: HTMLElement,
  container: HTMLElement | null | undefined,
): DribbleResponsiveUiController {
  const target = container ?? root;

  const refresh = (): void => {
    const width = target.clientWidth || window.innerWidth;
    const height = target.clientHeight || window.innerHeight;
    const aspect = width / Math.max(1, height);
    const compactLandscape = height <= compactLandscapeMaxHeight
      && aspect >= compactLandscapeMinAspect;
    root.dataset.compactLandscape = String(compactLandscape);
  };

  const resizeObserver = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(refresh);
  resizeObserver?.observe(target);
  window.addEventListener('orientationchange', refresh);
  window.addEventListener('resize', refresh);
  refresh();

  return {
    refresh,
    dispose: () => {
      resizeObserver?.disconnect();
      window.removeEventListener('orientationchange', refresh);
      window.removeEventListener('resize', refresh);
      delete root.dataset.compactLandscape;
    },
  };
}
