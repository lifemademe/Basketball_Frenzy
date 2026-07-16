import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { DribbleBallTrail } from './dribble-ball-trail.js';
import { DribbleBlackHoleDebris } from './dribble-blackhole-debris.js';
import { playBasketballBounce } from './dribble-bounce-audio.js';
import type { BallCosmetic } from './dribble-progression.js';

const ballModelPaths: Record<BallCosmetic | 'gold', string> = {
  classic: '@project/assets/models/ball_runtime.glb',
  epic: '@project/assets/models/ball2_runtime.glb',
  disco: '@project/assets/models/discoball_runtime.glb',
  blackhole: '@project/assets/models/blackholeball_runtime.glb',
  gold: '@project/assets/models/goldball_runtime.glb',
};

function createFrenzyVfxDefinition(): ENGINE.VFXDefinition {
  const definition = new ENGINE.VFXDefinition();
  definition.name = 'DribbleFrenzyBallAura';
  definition.particles = [Object.assign(new ENGINE.VFXParticlesSettings(), {
    nbParticles: 36,
    intensity: 2.4,
    renderMode: 'stretchBillboard' as const,
    stretchScale: 1.8,
    fadeSize: [0, 0.8] as [number, number],
    fadeAlpha: [0.08, 0.72] as [number, number],
    gravity: [0, 0.5, 0] as [number, number, number],
    appearance: 'circular' as const,
    easeFunction: 'easeOutPower2' as const,
    blendingMode: 'additive' as const,
    depthTest: false,
  })];
  definition.emitters = [Object.assign(new ENGINE.VFXEmitterSettings(), {
    particlesIndex: 0,
    loop: true,
    duration: 0.5,
    nbParticles: 12,
    spawnMode: 'time' as const,
    particlesLifetime: [0.22, 0.48] as [number, number],
    startPositionMin: [-0.24, -0.24, -0.08] as [number, number, number],
    startPositionMax: [0.24, 0.24, 0.08] as [number, number, number],
    directionMin: [-0.7, -0.25, -0.18] as [number, number, number],
    directionMax: [0.7, 1, 0.18] as [number, number, number],
    size: [0.025, 0.075] as [number, number],
    speed: [0.45, 1.25] as [number, number],
    colorStart: ['#fff8c7', '#ffd84f', '#ffb300'],
    colorEnd: ['#ffca3a', '#ff8a00'],
    useLocalDirection: true,
  })];
  return definition;
}

function createDiscoImpactVfxDefinition(): ENGINE.VFXDefinition {
  const definition = new ENGINE.VFXDefinition();
  definition.name = 'DribbleDiscoImpact';
  definition.particles = [Object.assign(new ENGINE.VFXParticlesSettings(), {
    nbParticles: 24,
    intensity: 2.2,
    renderMode: 'stretchBillboard' as const,
    stretchScale: 1.4,
    fadeSize: [0, 0.72] as [number, number],
    fadeAlpha: [0.04, 0.78] as [number, number],
    gravity: [0, -2.8, 0] as [number, number, number],
    appearance: 'circular' as const,
    easeFunction: 'easeOutPower2' as const,
    blendingMode: 'additive' as const,
    depthTest: false,
  })];
  definition.emitters = [Object.assign(new ENGINE.VFXEmitterSettings(), {
    particlesIndex: 0,
    loop: false,
    duration: 0.08,
    nbParticles: 18,
    spawnMode: 'burst' as const,
    particlesLifetime: [0.18, 0.38] as [number, number],
    startPositionMin: [-0.12, 0, -0.08] as [number, number, number],
    startPositionMax: [0.12, 0.04, 0.08] as [number, number, number],
    directionMin: [-1.6, 0.7, -0.6] as [number, number, number],
    directionMax: [1.6, 2.4, 0.6] as [number, number, number],
    size: [0.018, 0.055] as [number, number],
    speed: [0.65, 1.5] as [number, number],
    colorStart: ['#ff4fd8', '#55e9ff', '#fff46b', '#9d63ff'],
    colorEnd: ['#ff78e5', '#6ef5ff', '#ffffff'],
    useLocalDirection: true,
  })];
  return definition;
}

export type DribbleSide = 'left' | 'right';

export interface DribbleBallState {
  side: DribbleSide;
  position: THREE.Vector3;
  radius: number;
  isTransferring: boolean;
  isBoosting: boolean;
  isCatching: boolean;
  completedBounces: number;
}

@ENGINE.GameClass()
export class DribbleBall extends ENGINE.Actor {
  public static readonly transferDuration = 0.34;
  public static readonly boostDuration = 0.7;
  public static readonly catchDuration = 0.32;
  public readonly radius = 0.32;

  private side: DribbleSide = 'left';
  private phase = 0;
  private transferTime = 0;
  private transferFrom: DribbleSide = 'left';
  private transferTo: DribbleSide = 'right';
  private transferStart = new THREE.Vector3();
  private catchTime = 0;
  private catchEnabled = false;
  private boostTime = 0;
  private boostStart = new THREE.Vector3();
  private boostBouncePlayed = false;
  private gameplayActive = true;
  private trail: DribbleBallTrail | null = null;
  private ballModel: ENGINE.ModelMeshComponent | null = null;
  private equippedCosmetic: BallCosmetic = 'classic';
  private frenzyVfx: ENGINE.VFXComponent | null = null;
  private discoImpactVfx: ENGINE.VFXComponent | null = null;
  private blackHoleDebris: DribbleBlackHoleDebris | null = null;
  private frenzyInnerRing: ENGINE.MeshComponent | null = null;
  private frenzyOuterRing: ENGINE.MeshComponent | null = null;
  private frenzyActive = false;
  private frenzyPreloadTimer: ReturnType<typeof setTimeout> | null = null;
  private frenzyPhase = 0;
  private modelAnimationMixer: THREE.AnimationMixer | null = null;
  private modelLoadToken = 0;
  private bounceCycle = 0;
  private completedBounces = 0;
  private transferBouncePlayed = false;
  private readonly floorY = 0.08;
  private readonly handY = 1.26;
  private readonly laneZ = -1.2;
  private readonly lanes = {
    left: new THREE.Vector3(-0.95, 0, -1.2),
    center: new THREE.Vector3(0, 0, -1.85),
    right: new THREE.Vector3(0.95, 0, -1.2),
  };
  private readonly scratchPosition = new THREE.Vector3();
  private readonly localImpactPosition = new THREE.Vector3();
  private readonly ballState: DribbleBallState = {
    side: 'left',
    position: new THREE.Vector3(),
    radius: this.radius,
    isTransferring: false,
    isBoosting: false,
    isCatching: false,
    completedBounces: 0,
  };

  public override initialize(options?: ENGINE.ActorOptions): void {
    const ballModel = ENGINE.ModelMeshComponent.create({
      name: 'Ball Model',
      modelUrl: ballModelPaths.classic,
      castShadow: true,
      physicsOptions: { enabled: false },
    });
    const modelScale = (this.radius * 2) / 1.1889150142669678;
    ballModel.scale.setScalar(modelScale);
    ballModel.position.set(
      -0.00157850980758667 * modelScale,
      -0.5943385567499189 * modelScale,
      0.0017669298794641408 * modelScale,
    );
    this.ballModel = ballModel;

    const frenzyMaterial = new THREE.MeshBasicMaterial({
      color: 0xffca3a,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.frenzyInnerRing = ENGINE.MeshComponent.create({
      name: 'Frenzy Inner Aura',
      geometry: new THREE.TorusGeometry(0.43, 0.018, 6, 32),
      material: frenzyMaterial,
      physicsOptions: { enabled: false },
    });
    this.frenzyInnerRing.visible = false;
    this.frenzyOuterRing = ENGINE.MeshComponent.create({
      name: 'Frenzy Outer Aura',
      geometry: new THREE.TorusGeometry(0.55, 0.01, 5, 32),
      material: frenzyMaterial.clone(),
      physicsOptions: { enabled: false },
    });
    this.frenzyOuterRing.visible = false;
    this.frenzyVfx = ENGINE.VFXComponent.create({
      name: 'Frenzy Ball Sparks',
      vfxDefinition: createFrenzyVfxDefinition(),
      autoStart: false,
    });
    this.discoImpactVfx = ENGINE.VFXComponent.create({
      name: 'Disco Bounce Sparkles',
      vfxDefinition: createDiscoImpactVfxDefinition(),
      autoStart: false,
    });
    super.initialize({
      ...options,
      rootComponent: ENGINE.SceneComponent.create({ name: 'Ball Root' }),
      sceneComponents: [
        ballModel,
        this.frenzyInnerRing,
        this.frenzyOuterRing,
        this.frenzyVfx,
        this.discoImpactVfx,
      ],
      actorTags: [...(options?.actorTags ?? []), 'dribble-ball'],
    });
    this.updateBouncePosition(0);
  }

  public getState(): DribbleBallState {
    this.ballState.side = this.side;
    this.ballState.position.copy(this.rootComponent.position);
    this.ballState.isTransferring = this.transferTime > 0;
    this.ballState.isBoosting = this.boostTime > 0;
    this.ballState.isCatching = this.catchTime > 0;
    this.ballState.completedBounces = this.completedBounces;
    return this.ballState;
  }

  public transferToRight(): boolean {
    return this.startTransfer('left', 'right');
  }

  public transferToLeft(): boolean {
    return this.startTransfer('right', 'left');
  }

  public boostLeft(): boolean {
    return this.startBoost('left');
  }

  public boostRight(): boolean {
    return this.startBoost('right');
  }

  public setGameplayActive(active: boolean): void {
    this.gameplayActive = active;
    if (!active) this.blackHoleDebris?.deactivate();
    this.applyCosmeticVisualState();
  }

  public setCatchEnabled(enabled: boolean): void {
    this.catchEnabled = enabled;
    if (!enabled) this.catchTime = 0;
  }

  public setFrenzyActive(active: boolean): void {
    if (this.frenzyActive === active) {
      return;
    }
    this.frenzyActive = active;
    this.frenzyPhase = 0;
    this.applyBallModel();
    this.trail?.setFrenzyActive(active);
    this.applyCosmeticVisualState();
  }

  public setEquippedCosmetic(cosmetic: BallCosmetic): void {
    if (this.equippedCosmetic === cosmetic) {
      return;
    }
    this.equippedCosmetic = cosmetic;
    this.applyBallModel();
    this.trail?.setCosmetic(cosmetic);
    this.applyCosmeticVisualState();
  }

  public reset(side: DribbleSide = 'left'): void {
    this.setFrenzyActive(false);
    this.side = side;
    this.phase = 0;
    this.transferTime = 0;
    this.catchTime = 0;
    this.boostTime = 0;
    this.transferFrom = side;
    this.transferTo = side === 'left' ? 'right' : 'left';
    this.bounceCycle = 0;
    this.completedBounces = 0;
    this.transferBouncePlayed = false;
    this.boostBouncePlayed = false;
    this.rootComponent.scale.setScalar(1);
    this.updateBouncePosition(0);
    this.trail?.setPowerBounceActive(false);
    this.trail?.clear(this.rootComponent.position);
  }

  protected override doBeginPlay(): void {
    super.doBeginPlay();
    const world = this.getWorld();
    if (!world || this.trail) {
      return;
    }
    this.trail = DribbleBallTrail.create({ name: 'Dribble Ball Trail VFX' });
    world.addActor(this.trail);
    this.blackHoleDebris = DribbleBlackHoleDebris.create({ name: 'Black Hole Bounce Debris' });
    world.addActor(this.blackHoleDebris);
    this.trail.setCosmetic(this.equippedCosmetic);
    this.trail.setFrenzyActive(this.frenzyActive);
    this.trail.record(this.rootComponent.position);
    void this.ballModel?.waitForLoad().then(() => this.startModelAnimations());
    this.frenzyPreloadTimer = setTimeout(() => {
      this.frenzyPreloadTimer = null;
      void ENGINE.resourceManager.loadModel(ENGINE.AssetPath.fromString(ballModelPaths.gold))
        .catch(error => console.warn('Could not preload the frenzy basketball model', error));
    }, 600);
  }

  protected override doEndPlay(): void {
    if (this.frenzyPreloadTimer) {
      clearTimeout(this.frenzyPreloadTimer);
      this.frenzyPreloadTimer = null;
    }
    this.trail?.destroy();
    this.trail = null;
    this.blackHoleDebris?.destroy();
    this.blackHoleDebris = null;
    this.modelAnimationMixer?.stopAllAction();
    this.modelAnimationMixer = null;
    super.doEndPlay();
  }

  public override tickPrePhysics(deltaTime: number): void {
    super.tickPrePhysics(deltaTime);
    if (!this.gameplayActive) {
      return;
    }

    this.phase += deltaTime * 5.8;

    if (this.transferTime > 0) {
      this.transferTime = Math.min(this.transferTime + deltaTime, DribbleBall.transferDuration);
      const transferProgress = this.transferTime / DribbleBall.transferDuration;
      this.updateTransferPosition(transferProgress);
      if (transferProgress >= 0.5 && !this.transferBouncePlayed) {
        this.transferBouncePlayed = true;
        this.playBounceSound();
      }
      if (this.transferTime >= DribbleBall.transferDuration) {
        this.side = this.transferTo;
        this.transferTime = 0;
        this.catchTime = this.catchEnabled ? 0.001 : 0;
        this.phase = Math.PI / 2;
        this.bounceCycle = 0;
        this.rootComponent.scale.setScalar(1);
        this.rootComponent.position.set(this.lanes[this.side].x, this.handY, this.laneZ);
        if (this.catchTime > 0) this.playCatchSound();
      }
    } else if (this.catchTime > 0) {
      this.catchTime = Math.min(this.catchTime + deltaTime, DribbleBall.catchDuration);
      this.updateCatchPosition(this.catchTime / DribbleBall.catchDuration);
      if (this.catchTime >= DribbleBall.catchDuration) {
        this.catchTime = 0;
        this.phase = Math.PI / 2;
        this.bounceCycle = 0;
        this.rootComponent.scale.setScalar(1);
      }
    } else if (this.boostTime > 0) {
      this.boostTime = Math.min(this.boostTime + deltaTime, DribbleBall.boostDuration);
      const boostProgress = this.boostTime / DribbleBall.boostDuration;
      this.updateBoostPosition(boostProgress);
      if (boostProgress >= 0.18 && !this.boostBouncePlayed) {
        this.boostBouncePlayed = true;
        this.completedBounces += 1;
        this.playBounceSound();
      }
      if (this.boostTime >= DribbleBall.boostDuration) {
        this.boostTime = 0;
        this.phase = 0;
        this.bounceCycle = 0;
        this.rootComponent.scale.setScalar(1);
      }
    } else {
      const bounceCycle = Math.floor(this.phase / Math.PI);
      if (bounceCycle > this.bounceCycle) {
        this.bounceCycle = bounceCycle;
        this.completedBounces += 1;
        this.playBounceSound();
      }
      this.updateBouncePosition(deltaTime);
    }

    this.trail?.setPowerBounceActive(this.boostTime > 0);
    this.trail?.record(this.rootComponent.position);
    this.modelAnimationMixer?.update(deltaTime);
    this.updateCosmeticVisuals(deltaTime);
  }

  private applyCosmeticVisualState(): void {
    const cosmeticAura = this.equippedCosmetic === 'disco' || this.equippedCosmetic === 'blackhole';
    const visible = this.gameplayActive && (this.frenzyActive || cosmeticAura);
    if (this.frenzyInnerRing) this.frenzyInnerRing.visible = visible;
    if (this.frenzyOuterRing) this.frenzyOuterRing.visible = visible;
    this.updateAuraMaterials();
    if (this.frenzyActive && this.gameplayActive) this.frenzyVfx?.startEmitting(false);
    else this.frenzyVfx?.stopEmitting();
  }

  private applyBallModel(): void {
    const modelPath = this.frenzyActive ? ballModelPaths.gold : ballModelPaths[this.equippedCosmetic];
    if (!this.ballModel || this.ballModel.modelUrl === modelPath) {
      return;
    }
    const loadToken = ++this.modelLoadToken;
    this.modelAnimationMixer?.stopAllAction();
    this.modelAnimationMixer = null;
    void this.ballModel.loadModel(ENGINE.AssetPath.fromString(modelPath))
      .then(() => {
        if (loadToken !== this.modelLoadToken) return;
        this.startModelAnimations();
      })
      .catch(error => {
        console.warn(`Could not load basketball model: ${modelPath}`, error);
      });
  }

  private updateCosmeticVisuals(deltaTime: number): void {
    if (!this.frenzyActive && this.equippedCosmetic !== 'disco' && this.equippedCosmetic !== 'blackhole') {
      return;
    }

    this.frenzyPhase += deltaTime * (this.equippedCosmetic === 'blackhole' ? 5.4 : 8);
    const pulse = 1 + Math.sin(this.frenzyPhase) * 0.08;
    if (this.frenzyInnerRing) {
      this.frenzyInnerRing.scale.setScalar(pulse);
      this.frenzyInnerRing.rotation.z += deltaTime * 1.8;
    }
    if (this.frenzyOuterRing) {
      this.frenzyOuterRing.scale.setScalar(1.05 - Math.sin(this.frenzyPhase * 0.78) * 0.1);
      this.frenzyOuterRing.rotation.z -= deltaTime * 1.2;
    }
    if (!this.frenzyActive && this.equippedCosmetic === 'disco') {
      const hue = (this.frenzyPhase * 0.045) % 1;
      const innerMaterial = this.frenzyInnerRing?.material as THREE.MeshBasicMaterial | undefined;
      const outerMaterial = this.frenzyOuterRing?.material as THREE.MeshBasicMaterial | undefined;
      innerMaterial?.color.setHSL(hue, 1, 0.62);
      outerMaterial?.color.setHSL((hue + 0.42) % 1, 1, 0.62);
    }
  }

  private updateAuraMaterials(): void {
    const innerMaterial = this.frenzyInnerRing?.material as THREE.MeshBasicMaterial | undefined;
    const outerMaterial = this.frenzyOuterRing?.material as THREE.MeshBasicMaterial | undefined;
    if (!innerMaterial || !outerMaterial) return;
    if (this.frenzyActive) {
      innerMaterial.color.set(0xffca3a);
      outerMaterial.color.set(0xfff1a1);
      innerMaterial.opacity = 0.82;
      outerMaterial.opacity = 0.7;
    } else if (this.equippedCosmetic === 'blackhole') {
      innerMaterial.color.set(0x8c20ff);
      outerMaterial.color.set(0xff641f);
      innerMaterial.opacity = 0.55;
      outerMaterial.opacity = 0.72;
    } else {
      innerMaterial.color.set(0x4ef4ff);
      outerMaterial.color.set(0xff4fd8);
      innerMaterial.opacity = 0.64;
      outerMaterial.opacity = 0.55;
    }
  }

  private startModelAnimations(): void {
    const model = this.ballModel?.getModel();
    const clips = this.ballModel?.getAnimations() ?? [];
    if (!model || clips.length === 0) return;
    this.modelAnimationMixer?.stopAllAction();
    this.modelAnimationMixer = new THREE.AnimationMixer(model);
    for (const clip of clips) {
      this.modelAnimationMixer.clipAction(clip).play();
    }
  }

  private startTransfer(from: DribbleSide, to: DribbleSide): boolean {
    if (
      this.transferTime > 0
      || this.side !== from
      || (this.boostTime > 0 && !this.isBoostReturningToHand())
    ) {
      return false;
    }

    this.transferFrom = from;
    this.transferTo = to;
    this.transferTime = 0.001;
    this.catchTime = 0;
    this.boostTime = 0;
    this.transferBouncePlayed = false;
    this.transferStart.copy(this.rootComponent.position);
    return true;
  }

  private isBoostReturningToHand(): boolean {
    const boostProgress = this.boostTime / DribbleBall.boostDuration;
    const handHeightTolerance = 0.2;
    return boostProgress > 0.6
      && Math.abs(this.rootComponent.position.y - this.handY) <= handHeightTolerance;
  }

  private startBoost(side: DribbleSide): boolean {
    if (this.transferTime > 0 || this.catchTime > 0 || this.boostTime > 0 || this.side !== side) {
      return false;
    }

    this.boostTime = 0.001;
    this.boostBouncePlayed = false;
    this.boostStart.copy(this.rootComponent.position);
    return true;
  }

  private updateBouncePosition(_deltaTime: number): void {
    const lane = this.lanes[this.side];
    const bounce = Math.abs(Math.sin(this.phase));
    const floorImpact = Math.pow(1 - bounce, 8);
    this.rootComponent.position.set(
      lane.x,
      THREE.MathUtils.lerp(this.floorY, this.handY, bounce),
      this.laneZ,
    );
    this.rootComponent.scale.set(1 + floorImpact * 0.1, 1 - floorImpact * 0.16, 1 + floorImpact * 0.1);
    this.rootComponent.rotation.x += 0.08;
    this.rootComponent.rotation.z += this.side === 'left' ? 0.06 : -0.06;
  }

  private updateTransferPosition(progress: number): void {
    const eased = 1 - Math.pow(1 - progress, 2);
    const target = this.lanes[this.transferTo];
    const center = this.lanes.center;

    if (progress < 0.5) {
      const t = THREE.MathUtils.smootherstep(progress / 0.5, 0, 1);
      this.scratchPosition.set(center.x, this.floorY, center.z);
      this.rootComponent.position.lerpVectors(this.transferStart, this.scratchPosition, t);
      const impact = Math.pow(t, 6);
      this.rootComponent.scale.set(1 + impact * 0.16, 1 - impact * 0.24, 1 + impact * 0.16);
    } else {
      const t = THREE.MathUtils.smootherstep((progress - 0.5) / 0.5, 0, 1);
      const arrival = THREE.MathUtils.smootherstep(t, 0, 1);
      const arc = Math.sin(t * Math.PI) * 0.18;
      this.rootComponent.position.set(
        THREE.MathUtils.lerp(center.x, target.x, t),
        THREE.MathUtils.lerp(this.floorY, this.handY, arrival) + arc,
        THREE.MathUtils.lerp(center.z, this.laneZ, eased),
      );
      this.rootComponent.scale.set(1 - arc * 0.05, 1 + arc * 0.09, 1 - arc * 0.05);
    }

    this.rootComponent.rotation.x += 0.16;
    this.rootComponent.rotation.z += this.transferFrom === 'left' ? -0.12 : 0.12;
  }

  private updateCatchPosition(progress: number): void {
    const lane = this.lanes[this.side];
    const settle = 1 - THREE.MathUtils.smootherstep(progress, 0, 1);
    const handPulse = Math.sin(progress * Math.PI) * 0.025;
    this.rootComponent.position.set(lane.x, this.handY + handPulse, this.laneZ);
    this.rootComponent.scale.set(
      1 + settle * 0.08,
      1 - settle * 0.1,
      1 + settle * 0.08,
    );
    this.rootComponent.rotation.x += 0.035;
    this.rootComponent.rotation.z += this.side === 'left' ? 0.025 : -0.025;
  }

  private updateBoostPosition(progress: number): void {
    const lane = this.lanes[this.side];
    const boostedY = this.floorY + (this.handY - this.floorY) * 2;

    if (progress < 0.18) {
      const impactProgress = THREE.MathUtils.smootherstep(progress / 0.18, 0, 1);
      this.rootComponent.position.lerpVectors(
        this.boostStart,
        this.scratchPosition.set(lane.x, this.floorY, this.laneZ),
        impactProgress,
      );
      const squash = Math.pow(impactProgress, 5);
      this.rootComponent.scale.set(1 + squash * 0.18, 1 - squash * 0.28, 1 + squash * 0.18);
    } else {
      const arcProgress = (progress - 0.18) / 0.82;
      const arc = Math.pow(Math.sin(arcProgress * Math.PI), 0.88);
      this.rootComponent.position.set(
        lane.x,
        THREE.MathUtils.lerp(this.floorY, boostedY, arc),
        this.laneZ,
      );
      this.rootComponent.scale.set(1 - arc * 0.07, 1 + arc * 0.18, 1 - arc * 0.07);
    }

    this.rootComponent.rotation.x += 0.2;
    this.rootComponent.rotation.z += this.side === 'left' ? 0.14 : -0.14;
  }

  private playBounceSound(): void {
    const style = this.frenzyActive ? 'gold' : this.equippedCosmetic;
    playBasketballBounce(this.getWorld(), 1, style);
    if (!this.frenzyActive && this.equippedCosmetic === 'disco') {
      this.discoImpactVfx?.emitAtPosition(this.localImpactPosition, true);
    } else if (!this.frenzyActive && this.equippedCosmetic === 'blackhole') {
      this.blackHoleDebris?.play(this.rootComponent.position);
    }
  }

  private playCatchSound(): void {
    void this.getWorld()?.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
      volume: 0.22,
      bus: 'SFX',
    });
  }
}
