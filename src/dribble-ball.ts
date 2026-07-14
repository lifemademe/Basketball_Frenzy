import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { DribbleBallTrail } from './dribble-ball-trail.js';

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

  public override initialize(options?: ENGINE.ActorOptions): void {
    const ballModel = ENGINE.ModelMeshComponent.create({
      name: 'Ball Model',
      modelUrl: '@project/assets/models/ball.glb',
    });
    const modelScale = (this.radius * 2) / 1.1889150142669678;
    ballModel.scale.setScalar(modelScale);
    ballModel.position.set(
      -0.00157850980758667 * modelScale,
      -0.5943385567499189 * modelScale,
      0.0017669298794641408 * modelScale,
    );

    super.initialize({
      ...options,
      rootComponent: ENGINE.SceneComponent.create({ name: 'Ball Root' }),
      sceneComponents: [ballModel],
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
  }

  public reset(): void {
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
      this.rootComponent.position.lerpVectors(this.transferStart, new THREE.Vector3(center.x, this.floorY, center.z), t);
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
        new THREE.Vector3(lane.x, this.floorY, this.laneZ),
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
