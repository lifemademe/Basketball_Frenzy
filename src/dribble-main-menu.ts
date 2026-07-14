import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
      template: '@project/assets/ui/dribble-main-menu-model-ball.html',
      styles: '@project/assets/ui/dribble-main-menu-model-ball-cursor.css',
    },
  };

  private rootElement: HTMLElement | null = null;
  private volumeInput: HTMLInputElement | null = null;
  private volumeValue: HTMLElement | null = null;
  private fullscreenInput: HTMLInputElement | null = null;
  private menuBall: HTMLButtonElement | null = null;
  private menuBallCanvas: HTMLCanvasElement | null = null;
  private menuBallRenderer: THREE.WebGLRenderer | null = null;
  private menuBallScene: THREE.Scene | null = null;
  private menuBallCamera: THREE.PerspectiveCamera | null = null;
  private menuBallModel: THREE.Group | null = null;
  private menuBallModelLoadToken = 0;
  private ballAnimationFrame: number | null = null;
  private ballPointerId: number | null = null;
  private ballX = 0;
  private ballY = 0;
  private ballVelocityX = 0;
  private ballVelocityY = 0;
  private ballRotation = 0;
  private ballGrabOffsetX = 0;
  private ballGrabOffsetY = 0;
  private ballLastPointerX = 0;
  private ballLastPointerY = 0;
  private ballLastPointerTime = 0;
  private ballLastFrameTime = 0;
  private ballHasPosition = false;

  private readonly handleBallPointerDown = (event: PointerEvent): void => {
    if (!this.menuBall || !this.rootElement || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rootBounds = this.rootElement.getBoundingClientRect();
    const ballBounds = this.menuBall.getBoundingClientRect();
    this.ballPointerId = event.pointerId;
    this.ballGrabOffsetX = event.clientX - ballBounds.left;
    this.ballGrabOffsetY = event.clientY - ballBounds.top;
    this.ballLastPointerX = event.clientX;
    this.ballLastPointerY = event.clientY;
    this.ballLastPointerTime = performance.now();
    this.ballVelocityX = 0;
    this.ballVelocityY = 0;
    this.stopBallPhysics();
    this.menuBall.dataset.grabbed = 'true';
    this.menuBall.setPointerCapture(event.pointerId);
    this.ballX = ballBounds.left - rootBounds.left;
    this.ballY = ballBounds.top - rootBounds.top;
  };

  private readonly handleBallPointerMove = (event: PointerEvent): void => {
    if (!this.menuBall || !this.rootElement || event.pointerId !== this.ballPointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const now = performance.now();
    const elapsed = Math.max((now - this.ballLastPointerTime) / 1000, 1 / 240);
    const rootBounds = this.rootElement.getBoundingClientRect();
    const maxX = Math.max(0, rootBounds.width - this.menuBall.offsetWidth);
    const maxY = Math.max(0, rootBounds.height - this.menuBall.offsetHeight);
    this.ballX = Math.max(0, Math.min(maxX, event.clientX - rootBounds.left - this.ballGrabOffsetX));
    this.ballY = Math.max(0, Math.min(maxY, event.clientY - rootBounds.top - this.ballGrabOffsetY));
    this.ballVelocityX = (event.clientX - this.ballLastPointerX) / elapsed;
    this.ballVelocityY = (event.clientY - this.ballLastPointerY) / elapsed;
    this.ballLastPointerX = event.clientX;
    this.ballLastPointerY = event.clientY;
    this.ballLastPointerTime = now;
    this.ballRotation += (this.ballVelocityX * elapsed / this.menuBall.offsetWidth) * 57.3;
    this.renderMenuBall();
  };

  private readonly handleBallPointerUp = (event: PointerEvent): void => {
    if (!this.menuBall || event.pointerId !== this.ballPointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (this.menuBall.hasPointerCapture(event.pointerId)) {
      this.menuBall.releasePointerCapture(event.pointerId);
    }
    this.menuBall.dataset.grabbed = 'false';
    this.ballPointerId = null;
    this.startBallPhysics();
  };

  private readonly handleBallClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly handleMenuResize = (): void => {
    this.clampMenuBall();
    this.resizeMenuBallRenderer();
    this.renderMenuBall();
  };

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
    this.menuBall = this.layout.querySelector('[data-menu-ball]') as HTMLButtonElement | null;
    this.menuBallCanvas = this.layout.querySelector('[data-menu-ball-canvas]') as HTMLCanvasElement | null;
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
    this.menuBall?.addEventListener('pointerdown', this.handleBallPointerDown);
    this.menuBall?.addEventListener('pointermove', this.handleBallPointerMove);
    this.menuBall?.addEventListener('pointerup', this.handleBallPointerUp);
    this.menuBall?.addEventListener('pointercancel', this.handleBallPointerUp);
    this.menuBall?.addEventListener('click', this.handleBallClick);
    window.addEventListener('resize', this.handleMenuResize);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    this.handleFullscreenChange();
    this.showPanel('home');
    void this.setupMenuBallModel();
    requestAnimationFrame(() => {
      this.resetMenuBall();
      this.startBallPhysics();
    });
  }

  public showHome(): void {
    this.showPanel('home');
    this.show();
  }

  private showPanel(panel: MainMenuPanel): void {
    if (this.rootElement) this.rootElement.dataset.panel = panel;
    if (panel === 'home') this.startBallPhysics();
    else {
      this.stopBallPhysics();
      this.cancelBallDrag();
    }
  }

  protected override onShow(): void {
    if (this.rootElement?.dataset.panel === 'home') this.startBallPhysics();
    if (!this.menuBallRenderer) void this.setupMenuBallModel();
  }

  protected override onHide(): void {
    this.stopBallPhysics();
    this.cancelBallDrag();
    this.disposeMenuBallModel();
  }

  private resetMenuBall(): void {
    if (!this.rootElement || !this.menuBall) return;
    const bounds = this.rootElement.getBoundingClientRect();
    this.ballX = Math.max(12, bounds.width * 0.76 - this.menuBall.offsetWidth * 0.5);
    this.ballY = Math.max(24, bounds.height * 0.16);
    this.ballVelocityX = -80;
    this.ballVelocityY = 30;
    this.ballRotation = 0;
    this.ballHasPosition = true;
    this.clampMenuBall();
    this.renderMenuBall();
  }

  private startBallPhysics(): void {
    if (this.ballAnimationFrame !== null || !this.menuBall || !this.rootElement) return;
    if (!this.ballHasPosition) this.resetMenuBall();
    this.ballLastFrameTime = performance.now();
    this.ballAnimationFrame = requestAnimationFrame(this.updateBallPhysics);
  }

  private stopBallPhysics(): void {
    if (this.ballAnimationFrame !== null) cancelAnimationFrame(this.ballAnimationFrame);
    this.ballAnimationFrame = null;
  }

  private readonly updateBallPhysics = (time: number): void => {
    this.ballAnimationFrame = null;
    if (!this.menuBall || !this.rootElement || this.rootElement.dataset.panel !== 'home') return;
    const deltaTime = Math.min(Math.max((time - this.ballLastFrameTime) / 1000, 0), 1 / 30);
    this.ballLastFrameTime = time;

    if (this.ballPointerId === null) {
      const size = this.menuBall.offsetWidth;
      const maxX = Math.max(0, this.rootElement.clientWidth - size);
      const floorY = this.getMenuBallFloorY();
      this.ballVelocityY += 1850 * deltaTime;
      this.ballX += this.ballVelocityX * deltaTime;
      this.ballY += this.ballVelocityY * deltaTime;
      this.ballRotation += (this.ballVelocityX * deltaTime / Math.max(size, 1)) * 57.3;

      if (this.ballX <= 0 || this.ballX >= maxX) {
        this.ballX = Math.max(0, Math.min(maxX, this.ballX));
        this.ballVelocityX *= -0.72;
      }
      if (this.ballY <= 0) {
        this.ballY = 0;
        this.ballVelocityY = Math.abs(this.ballVelocityY) * 0.68;
      }
      if (this.ballY >= floorY) {
        this.ballY = floorY;
        if (this.ballVelocityY > 52) this.ballVelocityY *= -0.68;
        else if (this.ballVelocityY >= 0) this.ballVelocityY = 0;
        this.ballVelocityX *= Math.pow(0.76, deltaTime * 8);
        if (Math.abs(this.ballVelocityX) < 4) this.ballVelocityX = 0;
      }
      this.renderMenuBall();
      if (this.ballVelocityX === 0 && this.ballVelocityY === 0 && this.ballY >= floorY) {
        return;
      }
    }

    this.ballAnimationFrame = requestAnimationFrame(this.updateBallPhysics);
  };

  private clampMenuBall(): void {
    if (!this.rootElement || !this.menuBall) return;
    this.ballX = Math.max(
      0,
      Math.min(Math.max(0, this.rootElement.clientWidth - this.menuBall.offsetWidth), this.ballX),
    );
    this.ballY = Math.max(0, Math.min(this.getMenuBallFloorY(), this.ballY));
  }

  private getMenuBallFloorY(): number {
    if (!this.rootElement || !this.menuBall) return 0;
    const collisionLine = this.rootElement.clientHeight * 0.76;
    return Math.max(0, collisionLine - this.menuBall.offsetHeight);
  }

  private renderMenuBall(): void {
    if (!this.menuBall) return;
    this.menuBall.style.transform = `translate3d(${this.ballX}px, ${this.ballY}px, 0)`;
    if (this.menuBallModel) {
      const rotation = THREE.MathUtils.degToRad(this.ballRotation);
      this.menuBallModel.rotation.set(rotation * 0.34, rotation, -rotation * 0.18);
    }
    if (this.menuBallRenderer && this.menuBallScene && this.menuBallCamera) {
      this.menuBallRenderer.render(this.menuBallScene, this.menuBallCamera);
    }
  }

  private async setupMenuBallModel(): Promise<void> {
    if (!this.menuBallCanvas || this.menuBallRenderer) return;
    const loadToken = ++this.menuBallModelLoadToken;
    const renderer = new THREE.WebGLRenderer({
      canvas: this.menuBallCanvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 20);
    camera.position.set(0, 0.05, 3.1);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffe1bd, 0x29466c, 2.15));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
    keyLight.position.set(-2.5, 3.5, 4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x65d5ff, 1.35);
    rimLight.position.set(3, 1, -2);
    scene.add(rimLight);

    this.menuBallRenderer = renderer;
    this.menuBallScene = scene;
    this.menuBallCamera = camera;
    this.resizeMenuBallRenderer();
    this.renderMenuBall();

    try {
      const modelUrl = await ENGINE.resolveAssetPathsInText('@project/assets/models/ball.glb');
      const gltf = await new GLTFLoader().loadAsync(modelUrl);
      if (loadToken !== this.menuBallModelLoadToken || !this.menuBallScene) {
        this.disposeThreeObject(gltf.scene);
        return;
      }
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const model = new THREE.Group();
      gltf.scene.position.copy(center).multiplyScalar(-1);
      model.add(gltf.scene);
      model.scale.setScalar(1.72 / Math.max(size.x, size.y, size.z, 0.001));
      model.rotation.set(-0.12, 0.45, -0.08);
      this.menuBallModel = model;
      this.menuBallScene.add(model);
      this.renderMenuBall();
    } catch (error) {
      if (loadToken === this.menuBallModelLoadToken) {
        console.warn('Could not load the main-menu basketball model', error);
      }
    }
  }

  private resizeMenuBallRenderer(): void {
    if (!this.menuBallRenderer || !this.menuBall || !this.menuBallCamera) return;
    const size = Math.max(this.menuBall.offsetWidth, 1);
    this.menuBallRenderer.setSize(size, size, false);
    this.menuBallCamera.aspect = 1;
    this.menuBallCamera.updateProjectionMatrix();
  }

  private disposeMenuBallModel(): void {
    this.menuBallModelLoadToken += 1;
    if (this.menuBallModel) this.disposeThreeObject(this.menuBallModel);
    this.menuBallModel?.removeFromParent();
    this.menuBallModel = null;
    this.menuBallScene = null;
    this.menuBallCamera = null;
    this.menuBallRenderer?.renderLists.dispose();
    this.menuBallRenderer?.dispose();
    this.menuBallRenderer = null;
  }

  private disposeThreeObject(root: THREE.Object3D): void {
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        material.dispose();
      }
    });
  }

  private cancelBallDrag(): void {
    if (!this.menuBall || this.ballPointerId === null) return;
    if (this.menuBall.hasPointerCapture(this.ballPointerId)) {
      this.menuBall.releasePointerCapture(this.ballPointerId);
    }
    this.menuBall.dataset.grabbed = 'false';
    this.ballPointerId = null;
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
    this.menuBall?.removeEventListener('pointerdown', this.handleBallPointerDown);
    this.menuBall?.removeEventListener('pointermove', this.handleBallPointerMove);
    this.menuBall?.removeEventListener('pointerup', this.handleBallPointerUp);
    this.menuBall?.removeEventListener('pointercancel', this.handleBallPointerUp);
    this.menuBall?.removeEventListener('click', this.handleBallClick);
    window.removeEventListener('resize', this.handleMenuResize);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    this.stopBallPhysics();
    this.cancelBallDrag();
    this.disposeMenuBallModel();
    this.rootElement = null;
    this.volumeInput = null;
    this.volumeValue = null;
    this.fullscreenInput = null;
    this.menuBall = null;
    this.menuBallCanvas = null;
  }
}
