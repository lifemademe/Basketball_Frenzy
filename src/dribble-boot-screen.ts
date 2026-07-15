import * as ENGINE from '@gnsx/genesys.js';

const bootSelector = '[data-dribble-boot-screen]';

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
      [data-dribble-boot-logo] {
        display: block;
        width: min(470px, 76vw);
        height: min(310px, 38vh);
        object-fit: contain;
        opacity: 0;
        transition: opacity 180ms ease;
      }
      [data-dribble-boot-logo][data-loaded='true'] { opacity: 1; }
      [data-dribble-boot-loader] {
        display: flex;
        align-items: center;
        gap: 9px;
        height: 26px;
        margin-top: 8px;
      }
      [data-dribble-boot-loader] i {
        display: block;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #ffca3a;
        box-shadow: 0 0 10px rgba(255, 202, 58, 0.72);
        animation: dribble-boot-bounce 760ms ease-in-out infinite alternate;
      }
      [data-dribble-boot-loader] i:nth-child(2) { animation-delay: 120ms; }
      [data-dribble-boot-loader] i:nth-child(3) { animation-delay: 240ms; }
      [data-dribble-boot-label] {
        margin-top: 10px;
        color: rgba(255, 255, 255, 0.78);
        font: 400 16px/20px 'Boogaloo', 'Trebuchet MS', sans-serif;
        letter-spacing: 0;
      }
      @keyframes dribble-boot-bounce {
        from { transform: translateY(5px) scale(0.82); opacity: 0.58; }
        to { transform: translateY(-5px) scale(1); opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        [data-dribble-boot-screen],
        [data-dribble-boot-logo] { transition: none; }
        [data-dribble-boot-loader] i { animation: none; }
      }
    </style>
    <div data-dribble-boot-content>
      <img data-dribble-boot-logo alt="Basketball Frenzy">
      <div data-dribble-boot-loader aria-hidden="true"><i></i><i></i><i></i></div>
      <span data-dribble-boot-label>Loading</span>
    </div>
  `;
  container.appendChild(screen);

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
  screen.dataset.ready = 'true';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.setTimeout(() => screen.remove(), reducedMotion ? 0 : 280);
}
