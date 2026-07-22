import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

function createAmbientDustDefinition(): ENGINE.VFXDefinition {
  const definition = new ENGINE.VFXDefinition();
  definition.name = 'DribbleAmbientCourtDust';
  definition.particles = [Object.assign(new ENGINE.VFXParticlesSettings(), {
    nbParticles: 48,
    intensity: 0.92,
    renderMode: 'billboard' as const,
    fadeSize: [0.04, 0.9] as [number, number],
    fadeAlpha: [0.08, 0.78] as [number, number],
    gravity: [0, 0.012, 0] as [number, number, number],
    appearance: 'circular' as const,
    easeFunction: 'easeInOutSine' as const,
    blendingMode: 'additive' as const,
    depthTest: true,
  })];
  definition.emitters = [
    Object.assign(new ENGINE.VFXEmitterSettings(), {
      particlesIndex: 0,
      loop: true,
      duration: 1.5,
      nbParticles: 6,
      spawnMode: 'time' as const,
      particlesLifetime: [5.5, 9] as [number, number],
      startPositionMin: [-3.7, -2, -7] as [number, number, number],
      startPositionMax: [3.7, 3.8, 2] as [number, number, number],
      directionMin: [-0.07, 0.04, 0.08] as [number, number, number],
      directionMax: [0.08, 0.14, 0.24] as [number, number, number],
      size: [0.018, 0.048] as [number, number],
      speed: [0.03, 0.12] as [number, number],
      colorStart: ['#fff0cf', '#ffd6a3', '#ffe8c2'],
      colorEnd: ['#e8b77f', '#ffd9a7', '#fff4dc'],
      useLocalDirection: false,
    }),
    Object.assign(new ENGINE.VFXEmitterSettings(), {
      particlesIndex: 0,
      loop: true,
      duration: 2.3,
      nbParticles: 2,
      spawnMode: 'time' as const,
      particlesLifetime: [3.5, 6.5] as [number, number],
      startPositionMin: [-2.8, -1.8, -2] as [number, number, number],
      startPositionMax: [2.8, 2.6, 2.5] as [number, number, number],
      directionMin: [-0.05, 0.03, 0.1] as [number, number, number],
      directionMax: [0.06, 0.1, 0.28] as [number, number, number],
      size: [0.035, 0.075] as [number, number],
      speed: [0.025, 0.08] as [number, number],
      colorStart: ['#fff7df', '#ffdba8'],
      colorEnd: ['#eab77e', '#ffe7bd'],
      useLocalDirection: false,
    }),
  ];
  return definition;
}

function createFrenzyDustDefinition(): ENGINE.VFXDefinition {
  const definition = new ENGINE.VFXDefinition();
  definition.name = 'DribbleFrenzyLaneMotes';
  definition.particles = [Object.assign(new ENGINE.VFXParticlesSettings(), {
    nbParticles: 24,
    intensity: 1.05,
    renderMode: 'billboard' as const,
    fadeSize: [0.02, 0.42] as [number, number],
    fadeAlpha: [0.05, 0.88] as [number, number],
    gravity: [0, 0.015, 0] as [number, number, number],
    appearance: 'circular' as const,
    easeFunction: 'easeOutCubic' as const,
    blendingMode: 'additive' as const,
    depthTest: true,
  })];
  definition.emitters = [Object.assign(new ENGINE.VFXEmitterSettings(), {
    particlesIndex: 0,
    loop: true,
    duration: 0.7,
    nbParticles: 6,
    spawnMode: 'time' as const,
    particlesLifetime: [0.8, 1.45] as [number, number],
    startPositionMin: [-2.4, -1.5, -5.5] as [number, number, number],
    startPositionMax: [2.4, 2.5, 0.5] as [number, number, number],
    directionMin: [-0.05, 0.01, 0.65] as [number, number, number],
    directionMax: [0.05, 0.08, 1.15] as [number, number, number],
    size: [0.025, 0.065] as [number, number],
    speed: [0.75, 1.45] as [number, number],
    colorStart: ['#fff8b6', '#ffd84f', '#ffae2d'],
    colorEnd: ['#ffcc36', '#ff8f1f', '#fff0a0'],
    useLocalDirection: false,
  })];
  return definition;
}

@ENGINE.GameClass()
export class DribbleAmbientDust extends ENGINE.Actor {
  private dustVfx: ENGINE.VFXComponent | null = null;
  private frenzyDustVfx: ENGINE.VFXComponent | null = null;
  private active = false;
  private frenzyActive = false;
  private reducedMotion = false;
  private readonly cameraPosition = new THREE.Vector3();
  private readonly cameraDirection = new THREE.Vector3();

  public override initialize(options?: ENGINE.ActorOptions): void {
    const dustVfx = ENGINE.VFXComponent.create({
      name: 'Sunset Dust Motes',
      vfxDefinition: createAmbientDustDefinition(),
      autoStart: false,
    });
    this.dustVfx = dustVfx;
    const frenzyDustVfx = ENGINE.VFXComponent.create({
      name: 'Frenzy Directional Court Motes',
      vfxDefinition: createFrenzyDustDefinition(),
      autoStart: false,
    });
    this.frenzyDustVfx = frenzyDustVfx;
    super.initialize({
      ...options,
      rootComponent: ENGINE.SceneComponent.create({ name: 'Ambient Dust Root' }),
      sceneComponents: [dustVfx, frenzyDustVfx],
      actorTags: [...(options?.actorTags ?? []), 'ambient-dust-vfx'],
    });
  }

  public setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    if (active) this.dustVfx?.startEmitting(true);
    else this.dustVfx?.stopEmitting();
    this.syncFrenzyEmission();
  }

  public setFrenzyActive(active: boolean): void {
    this.frenzyActive = active;
    this.syncFrenzyEmission();
  }

  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    this.syncFrenzyEmission();
  }

  public override tickPrePhysics(deltaTime: number): void {
    super.tickPrePhysics(deltaTime);
    if (!this.active) return;
    const camera = this.getWorld()?.getActiveCamera();
    if (!camera) return;
    camera.getWorldPosition(this.cameraPosition);
    camera.getWorldDirection(this.cameraDirection);
    this.rootComponent.position
      .copy(this.cameraPosition)
      .addScaledVector(this.cameraDirection, 6.5);
    this.rootComponent.position.y += 0.15;
  }

  protected override doEndPlay(): void {
    this.dustVfx?.stopEmitting();
    this.frenzyDustVfx?.stopEmitting();
    this.dustVfx = null;
    this.frenzyDustVfx = null;
    super.doEndPlay();
  }

  private syncFrenzyEmission(): void {
    if (this.active && this.frenzyActive && !this.reducedMotion) {
      this.frenzyDustVfx?.startEmitting(true);
    } else {
      this.frenzyDustVfx?.stopEmitting();
    }
  }
}
