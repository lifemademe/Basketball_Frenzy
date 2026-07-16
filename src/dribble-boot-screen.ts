import * as ENGINE from '@gnsx/genesys.js';

const bootSelector = '[data-dribble-boot-screen]';
const bootProgressTimers = new WeakMap<HTMLElement, number>();

function setBootProgress(screen: HTMLElement, progress: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  screen.style.setProperty('--dribble-boot-progress', `${clamped}%`);
  const label = screen.querySelector('[data-dribble-boot-percent]');
  if (label) label.textContent = `${clamped}%`;
  screen.setAttribute('aria-label', `Loading Basketball Frenzy ${clamped}%`);
}

export function showDribbleBootScreen(container: HTMLElement): void {
  container.querySelector(bootSelector)?.remove();

  const screen = document.createElement('div');
  screen.dataset.dribbleBootScreen = 'true';
  screen.setAttribute('role', 'status');
  screen.setAttribute('aria-live', 'polite');
  screen.innerHTML = `
    <style>
      [data-dribble-boot-screen] {
        position: fixed;
        inset: 0;
        z-index: 50000;
        display: grid;
        place-items: center;
        overflow: hidden;
        background: #000000;
        color: #ffffff;
        opacity: 1;
        transition: opacity 260ms ease;
        pointer-events: all;
      }
      [data-dribble-boot-screen][data-ready='true'] {
        opacity: 0;
        pointer-events: none;
      }
      [data-dribble-boot-content] {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: min(520px, 82vw);
      }
      [data-dribble-boot-logo-frame] {
        position: relative;
        width: min(470px, 76vw);
        height: min(310px, 38vh);
        overflow: hidden;
      }
      [data-dribble-boot-logo] {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        filter: grayscale(1) saturate(0) brightness(0.82);
        opacity: 0;
        transition: opacity 180ms ease;
      }
      [data-dribble-boot-logo][data-loaded='true'] { opacity: 1; }
      [data-dribble-boot-logo-mask] {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: calc(100% - var(--dribble-boot-progress));
        background:
          linear-gradient(
            90deg,
            rgba(0, 0, 0, 0.72) 0%,
            rgba(0, 0, 0, 0.82) 18%,
            rgba(0, 0, 0, 0.9) 100%
          );
        transition: width 140ms linear;
        pointer-events: none;
      }
      [data-dribble-boot-label] {
        display: flex;
        align-items: baseline;
        justify-content: center;
        gap: 8px;
        margin-top: 10px;
        color: #ffca3a;
        font: 400 20px/24px 'Boogaloo', 'Trebuchet MS', sans-serif;
        letter-spacing: 0;
        text-shadow: 0 0 12px rgba(255, 202, 58, 0.28);
      }
      [data-dribble-boot-percent] {
        color: #ffdc63;
        font-size: 22px;
      }
      @media (prefers-reduced-motion: reduce) {
        [data-dribble-boot-screen],
        [data-dribble-boot-logo] { transition: none; }
        [data-dribble-boot-logo-mask] { transition: none; }
      }
    </style>
    <div data-dribble-boot-content>
      <div data-dribble-boot-logo-frame>
        <img data-dribble-boot-logo alt="Basketball Frenzy">
        <i data-dribble-boot-logo-mask aria-hidden="true"></i>
      </div>
      <span data-dribble-boot-label><b>LOADING</b><b data-dribble-boot-percent>0%</b></span>
    </div>
  `;
  container.appendChild(screen);
  setBootProgress(screen, 0);
  let simulatedProgress = 0;
  const progressTimer = window.setInterval(() => {
    simulatedProgress = Math.min(92, simulatedProgress + Math.max(1, (92 - simulatedProgress) * 0.075));
    setBootProgress(screen, simulatedProgress);
  }, 90);
  bootProgressTimers.set(screen, progressTimer);

  const logo = screen.querySelector('[data-dribble-boot-logo]') as HTMLImageElement | null;
  void ENGINE.resolveAssetPathsInText('@project/assets/textures/Basketball_frenzy_logo.png')
    .then(url => {
      if (!logo?.isConnected) return;
      logo.addEventListener('load', () => { logo.dataset.loaded = 'true'; }, { once: true });
      logo.src = url;
      if (logo.complete) logo.dataset.loaded = 'true';
    });
}

export function hideDribbleBootScreen(container: HTMLElement): void {
  const screen = container.querySelector(bootSelector) as HTMLElement | null;
  if (!screen) return;
  const progressTimer = bootProgressTimers.get(screen);
  if (progressTimer !== undefined) window.clearInterval(progressTimer);
  bootProgressTimers.delete(screen);
  setBootProgress(screen, 100);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.setTimeout(() => {
    screen.dataset.ready = 'true';
    window.setTimeout(() => screen.remove(), reducedMotion ? 0 : 280);
  }, reducedMotion ? 0 : 180);
}
