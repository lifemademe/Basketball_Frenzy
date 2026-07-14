import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

export type TargetKind = 'score' | 'hazard' | 'health' | 'bonus';

function createStarGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  for (let index = 0; index < 10; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const radius = index % 2 === 0 ? 0.58 : 0.27;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    bevelSegments: 2,
  });
  geometry.center();
  return geometry;
}

export interface DribbleTargetOptions extends ENGINE.ActorOptions {
  kind?: TargetKind;
  laneX?: number;
  speed?: number;
}

@ENGINE.GameClass()
export class DribbleTarget extends ENGINE.Actor {
  private static readonly centerCollectZ = -1.85;
  private static readonly centerGraceRadius = 0.9;
  private static readonly centerGraceStrength = 0.18;

  public kind: TargetKind = 'score';
  public laneX = 0;
  public speed = 4;
  public radius = 0.55;

  private hit = false;
  private gameplayActive = true;
  private removalRequested = false;
  private glowShell: ENGINE.MeshComponent | null = null;
  private glowMaterial: THREE.MeshBasicMaterial | null = null;
  private glowPhase = Math.random() * Math.PI * 2;
  private glowBaseOpacity = 0.24;

  public override initialize(options?: DribbleTargetOptions): void {
    this.kind = options?.kind ?? this.kind;
    this.laneX = options?.laneX ?? this.laneX;
    this.speed = options?.speed ?? this.speed;
    this.radius = this.kind === 'bonus' ? 0.58 : 0.55;

    const color = this.kind === 'score'
      ? 0x30d158
      : this.kind === 'health'
        ? 0x4de6b8
        : this.kind === 'bonus'
          ? 0xffca3a
          : 0xff453a;
    const geometry = this.kind === 'score'
      ? new THREE.TorusGeometry(0.42, 0.12, 12, 28)
      : this.kind === 'health'
        ? new THREE.BoxGeometry(0.2, 0.9, 0.18)
        : this.kind === 'bonus'
          ? createStarGeometry()
          : new THREE.OctahedronGeometry(0.55, 0);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: this.kind === 'bonus' ? 4.2 : this.kind === 'health' ? 3.2 : 2.8,
      roughness: 0.3,
      metalness: 0.12,
    });
    const rootComponent = ENGINE.MeshComponent.create({
      name: 'Target Mesh',
      geometry,
      material,
      physicsOptions: { enabled: false },
    });

    this.glowBaseOpacity = this.kind === 'bonus' ? 0.4 : this.kind === 'health' ? 0.3 : 0.24;
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: this.glowBaseOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.glowShell = ENGINE.MeshComponent.create({
      name: 'Target Glow Shell',
      geometry: geometry.clone(),
      material: this.glowMaterial,
      scale: new THREE.Vector3(1.14, 1.14, 1.14),
      physicsOptions: { enabled: false },
    });
    rootComponent.add(this.glowShell);

    if (this.kind === 'health') {
      rootComponent.add(ENGINE.MeshComponent.create({
        name: 'Health Crossbar',
        geometry: new THREE.BoxGeometry(0.9, 0.2, 0.18),
        material,
        physicsOptions: { enabled: false },
      }));
    } else if (this.kind === 'bonus') {
      rootComponent.add(ENGINE.PointLightComponent.create({
        name: 'Bonus Star Glow',
        color,
        intensity: 1.8,
        distance: 2.6,
        decay: 2,
        castShadow: false,
      }));
    }

    super.initialize({
      ...options,
      rootComponent,
      actorTags: [...(options?.actorTags ?? []), 'dribble-target', this.kind],
    });
  }

  public override tickPrePhysics(deltaTime: number): void {
    super.tickPrePhysics(deltaTime);
    if (!this.gameplayActive) {
      return;
    }

    this.rootComponent.position.z += this.getApproachSpeed() * deltaTime;
    this.glowPhase += deltaTime * (this.kind === 'bonus' ? 7 : 4.5);
    const glowPulse = Math.sin(this.glowPhase);
    this.glowShell?.scale.setScalar(1.14 + glowPulse * 0.045);
    if (this.glowMaterial) {
      this.glowMaterial.opacity = this.glowBaseOpacity + glowPulse * 0.07;
    }
    if (this.kind === 'bonus') {
      this.rootComponent.rotation.y += deltaTime * 0.45;
      this.rootComponent.rotation.z += deltaTime * 2.2;
    } else {
      this.rootComponent.rotation.x += deltaTime * 2.5;
      this.rootComponent.rotation.y += deltaTime * (this.kind === 'score' ? 1.2 : this.kind === 'health' ? 1.7 : -2.0);
    }

    if (this.rootComponent.position.z > 2.5) {
      this.destroy();
    }
  }

  public override destroy(): void {
    if (this.removalRequested) {
      return;
    }

    this.removalRequested = true;
    this.gameplayActive = false;
    super.destroy();
  }

  public consumeHit(): boolean {
    if (this.hit) {
      return false;
    }
    this.hit = true;
    return true;
  }

  public getApproachSpeed(): number {
    if (this.kind !== 'score' || Math.abs(this.laneX) > 0.01) {
      return this.speed;
    }

    const distance = Math.abs(this.rootComponent.position.z - DribbleTarget.centerCollectZ);
    const influence = 1 - THREE.MathUtils.smoothstep(
      distance,
      0,
      DribbleTarget.centerGraceRadius,
    );
    return this.speed * (1 - influence * DribbleTarget.centerGraceStrength);
  }

  public setGameplayActive(active: boolean): void {
    this.gameplayActive = active;
  }
}
