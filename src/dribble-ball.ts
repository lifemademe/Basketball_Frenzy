import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { DribbleBallTrail } from './dribble-ball-trail.js';

function createFrenzyVfxDefinition(): ENGINE.VFXDefinition {
  const definition = new ENGINE.VFXDefinition();
  definition.name = 'DribbleFrenzyBallAura';
  definition.particles = [Object.assign(new ENGINE.VFXParticlesSettings(), {
    nbParticles: 56,
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
    nbParticles: 18,
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

export type DribbleSide = 'left' | 'right';

export interface DribbleBallState {
  side: DribbleSide;
  position: THREE.Vector3;
  radius: number;
  isTransferring: boolean;
  isBoosting: boolean;
}

@ENGINE.GameClass()
export class DribbleBall extends ENGINE.Actor {
  public static readonly transferDuration = 0.34;
  public static readonly boostDuration = 0.7;
  public readonly radius = 0.32;

  private side: DribbleSide = 'left';
  private phase = 0;
  private transferTime = 0;
  private transferFrom: DribbleSide = 'left';
  private transferTo: DribbleSide = 'right';
  private transferStart = new THREE.Vector3();
  private boostTime = 0;
  private boostStart = new THREE.Vector3();
  private boostBouncePlayed = false;
  private gameplayActive = true;
  private trail: DribbleBallTrail | null = null;
  private frenzyVfx: ENGINE.VFXComponent | null = null;
  private frenzyInnerRing: ENGINE.MeshComponent | null = null;
  private frenzyOuterRing: ENGINE.MeshComponent | null = null;
  private frenzyActive = false;
  private frenzyPhase = 0;
  private bounceCycle = 0;
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

  public override initialize(options?: ENGINE.ActorOptions): void {
    const ballModel = ENGINE.ModelMeshComponent.create({
      name: 'Ball Model',
      modelUrl: '@project/assets/models/ball.glb',
      physicsOptions: { enabled: false },
    });
    const modelScale = (this.radius * 2) / 1.1889150142669678;
    ballModel.scale.setScalar(modelScale);
    ballModel.position.set(
      -0.00157850980758667 * modelScale,
      -0.5943385567499189 * modelScale,
      0.0017669298794641408 * modelScale,
    );

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

    super.initialize({
      ...options,
      rootComponent: ENGINE.SceneComponent.create({ name: 'Ball Root' }),
      sceneComponents: [ballModel, this.frenzyInnerRing, this.frenzyOuterRing, this.frenzyVfx],
      actorTags: [...(options?.actorTags ?? []), 'dribble-ball'],
    });
    this.updateBouncePosition(0);
  }

  public getState(): DribbleBallState {
    return {
      side: this.side,
      position: this.rootComponent.position.clone(),
      radius: this.radius,
      isTransferring: this.transferTime > 0,
      isBoosting: this.boostTime > 0,
    };
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
    this.applyFrenzyVisualState();
  }

  public setFrenzyActive(active: boolean): void {
    if (this.frenzyActive === active) {
      return;
    }
    this.frenzyActive = active;
    this.frenzyPhase = 0;
    this.trail?.setFrenzyActive(active);
    this.applyFrenzyVisualState();
  }

  public reset(): void {
    this.setFrenzyActive(false);
    this.side = 'left';
    this.phase = 0;
    this.transferTime = 0;
    this.boostTime = 0;
    this.transferFrom = 'left';
    this.transferTo = 'right';
    this.bounceCycle = 0;
    this.transferBouncePlayed = false;
    this.boostBouncePlayed = false;
    this.rootComponent.scale.setScalar(1);
    this.updateBouncePosition(0);
    this.trail?.clear(this.getWorldPosition());
  }

  protected override doBeginPlay(): void {
    super.doBeginPlay();
    const world = this.getWorld();
    if (!world || this.trail) {
      return;
    }
    this.trail = DribbleBallTrail.create({ name: 'Dribble Ball Trail VFX' });
    world.addActor(this.trail);
    this.trail.setFrenzyActive(this.frenzyActive);
    this.trail.record(this.getWorldPosition());
  }

  protected override doEndPlay(): void {
    this.trail?.destroy();
    this.trail = null;
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
        this.phase = 0;
        this.bounceCycle = 0;
        this.rootComponent.scale.setScalar(1);
      }
    } else if (this.boostTime > 0) {
      this.boostTime = Math.min(this.boostTime + deltaTime, DribbleBall.boostDuration);
      const boostProgress = this.boostTime / DribbleBall.boostDuration;
      this.updateBoostPosition(boostProgress);
      if (boostProgress >= 0.18 && !this.boostBouncePlayed) {
        this.boostBouncePlayed = true;
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
        this.playBounceSound();
      }
      this.updateBouncePosition(deltaTime);
    }

    this.trail?.record(this.getWorldPosition());
    this.updateFrenzyVisuals(deltaTime);
  }

  private applyFrenzyVisualState(): void {
    const visible = this.frenzyActive && this.gameplayActive;
    if (this.frenzyInnerRing) this.frenzyInnerRing.visible = visible;
    if (this.frenzyOuterRing) this.frenzyOuterRing.visible = visible;
    if (visible) this.frenzyVfx?.startEmitting(false);
    else this.frenzyVfx?.stopEmitting();
  }

  private updateFrenzyVisuals(deltaTime: number): void {
    if (!this.frenzyActive) {
      return;
    }

    this.frenzyPhase += deltaTime * 8;
    const pulse = 1 + Math.sin(this.frenzyPhase) * 0.08;
    if (this.frenzyInnerRing) {
      this.frenzyInnerRing.scale.setScalar(pulse);
      this.frenzyInnerRing.rotation.z += deltaTime * 1.8;
    }
    if (this.frenzyOuterRing) {
      this.frenzyOuterRing.scale.setScalar(1.05 - Math.sin(this.frenzyPhase * 0.78) * 0.1);
      this.frenzyOuterRing.rotation.z -= deltaTime * 1.2;
    }
  }

  private startTransfer(from: DribbleSide, to: DribbleSide): boolean {
    if (this.transferTime > 0 || this.boostTime > 0 || this.side !== from) {
      return false;
    }

    this.transferFrom = from;
    this.transferTo = to;
    this.transferTime = 0.001;
    this.transferBouncePlayed = false;
    this.transferStart.copy(this.rootComponent.position);
    return true;
  }

  private startBoost(side: DribbleSide): boolean {
    if (this.transferTime > 0 || this.boostTime > 0 || this.side !== side) {
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
      const arc = Math.sin(t * Math.PI);
      this.rootComponent.position.set(
        THREE.MathUtils.lerp(center.x, target.x, t),
        THREE.MathUtils.lerp(this.floorY, this.handY, arc),
        THREE.MathUtils.lerp(center.z, this.laneZ, eased),
      );
      this.rootComponent.scale.set(1 - arc * 0.08, 1 + arc * 0.14, 1 - arc * 0.08);
    }

    this.rootComponent.rotation.x += 0.16;
    this.rootComponent.rotation.z += this.transferFrom === 'left' ? -0.12 : 0.12;
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
      const arc = Math.sin(arcProgress * Math.PI);
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
    const world = this.getWorld();
    const listener = world?.audioListener;
    const context = listener?.context;
    if (!world || !listener || !context || context.state !== 'running') {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(112, now);
    oscillator.frequency.exponentialRampToValueAtTime(58, now + 0.1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    oscillator.connect(gain);
    gain.connect(world.globalAudioManager.getBus('SFX')?.getInput() ?? listener.getInput());
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + 0.12);
  }
}
