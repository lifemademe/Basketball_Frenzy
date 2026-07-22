import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

export type TargetKind = 'score' | 'hazard' | 'health' | 'bonus' | 'recovery';
export type TargetThreatOwner = 'player' | 'ai';

const scoreTokenModelPath = '@project/assets/models/score_token.glb';

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

function createCardGeometry(): THREE.ExtrudeGeometry {
  const width = 0.78;
  const height = 0.96;
  const radius = 0.12;
  const left = -width / 2;
  const right = width / 2;
  const bottom = -height / 2;
  const top = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(left + radius, bottom);
  shape.lineTo(right - radius, bottom);
  shape.quadraticCurveTo(right, bottom, right, bottom + radius);
  shape.lineTo(right, top - radius);
  shape.quadraticCurveTo(right, top, right - radius, top);
  shape.lineTo(left + radius, top);
  shape.quadraticCurveTo(left, top, left, top - radius);
  shape.lineTo(left, bottom + radius);
  shape.quadraticCurveTo(left, bottom, left + radius, bottom);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.13,
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
  rhythmTarget?: boolean;
  spacingGroup?: string;
}

@ENGINE.GameClass()
export class DribbleTarget extends ENGINE.Actor {
  private static readonly centerCollectZ = -1.85;
  private static readonly centerGraceRadius = 0.9;
  private static readonly centerGraceStrength = 0.18;
  private static highContrastEnabled = false;

  public kind: TargetKind = 'score';
  public laneX = 0;
  public speed = 4;
  public radius = 0.55;
  public isRhythmTarget = false;
  public spacingGroup: string | null = null;

  private hit = false;
  private gameplayActive = true;
  private removalRequested = false;
  private missedScoreTarget = false;
  private avoidedHazard = false;
  private targetMesh: ENGINE.MeshComponent | null = null;
  private scoreTokenModel: ENGINE.ModelMeshComponent | null = null;
  private readonly scoreTokenMaterialIntensity = new Map<THREE.MeshStandardMaterial, number>();
  private glowShell: ENGINE.MeshComponent | null = null;
  private glowMaterial: THREE.MeshBasicMaterial | null = null;
  private glowPhase = Math.random() * Math.PI * 2;
  private glowBaseOpacity = 0.24;
  private baseEmissiveIntensity = 2.8;
  private targetMaterial: THREE.MeshStandardMaterial | null = null;
  private pressureLevel = 0;
  private threatMarker: ENGINE.MeshComponent | null = null;
  private threatMarkerMaterial: THREE.MeshBasicMaterial | null = null;
  private spacingSpeedLimit = Number.POSITIVE_INFINITY;
  private coinMagnetActive = false;
  private coinMagnetAge = 0;
  private readonly coinMagnetTarget = new THREE.Vector3();
  private readonly coinMagnetVelocity = new THREE.Vector3();
  private readonly coinMagnetDirection = new THREE.Vector3();

  public override initialize(options?: DribbleTargetOptions): void {
    this.kind = options?.kind ?? this.kind;
    this.laneX = options?.laneX ?? this.laneX;
    this.speed = options?.speed ?? this.speed;
    this.isRhythmTarget = options?.rhythmTarget ?? false;
    this.spacingGroup = options?.spacingGroup ?? null;
    this.radius = this.kind === 'bonus' ? 0.58 : this.kind === 'recovery' ? 0.52 : 0.55;

    const color = this.getDisplayColor();
    const geometry = this.kind === 'score'
      ? new THREE.TorusGeometry(0.42, 0.12, 12, 28)
      : this.kind === 'health'
        ? new THREE.BoxGeometry(0.2, 0.9, 0.18)
        : this.kind === 'recovery'
          ? createCardGeometry()
        : this.kind === 'bonus'
          ? createStarGeometry()
          : new THREE.OctahedronGeometry(0.55, 0);
    this.baseEmissiveIntensity = this.kind === 'bonus'
      ? 4.2
      : this.kind === 'health' || this.kind === 'recovery'
        ? 3.2
        : 2.8;
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: this.baseEmissiveIntensity,
      roughness: 0.3,
      metalness: 0.12,
    });
    this.targetMaterial = material;
    const rootComponent = ENGINE.MeshComponent.create({
      name: 'Target Mesh',
      geometry,
      material,
      castShadow: true,
      physicsOptions: { enabled: false },
    });
    this.targetMesh = rootComponent;

    this.glowBaseOpacity = this.kind === 'bonus'
      ? 0.4
      : this.kind === 'score'
        ? 0.18
      : this.kind === 'health' || this.kind === 'recovery'
        ? 0.3
        : 0.24;
    this.glowMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: this.glowBaseOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const glowGeometry = this.kind === 'score'
      ? new THREE.TorusGeometry(0.515, 0.014, 6, 32)
      : geometry.clone();
    this.glowShell = ENGINE.MeshComponent.create({
      name: 'Target Glow Shell',
      geometry: glowGeometry,
      material: this.glowMaterial,
      scale: new THREE.Vector3(
        this.kind === 'score' ? 1.04 : 1.14,
        this.kind === 'score' ? 1.04 : 1.14,
        this.kind === 'score' ? 1.04 : 1.14,
      ),
      physicsOptions: { enabled: false },
    });
    rootComponent.add(this.glowShell);

    if (this.kind === 'score') {
      this.attachScoreTokenModel(rootComponent, false);
    }

    if (this.kind === 'health') {
      rootComponent.add(ENGINE.MeshComponent.create({
        name: 'Health Crossbar',
        geometry: new THREE.BoxGeometry(0.9, 0.2, 0.18),
        material,
        physicsOptions: { enabled: false },
      }));
    } else if (this.kind === 'recovery') {
      const recoveryMarkMaterial = new THREE.MeshBasicMaterial({
        color: 0xf4fff9,
        toneMapped: false,
      });
      rootComponent.add(ENGINE.MeshComponent.create({
        name: 'Recovery Card Vertical Mark',
        geometry: new THREE.BoxGeometry(0.14, 0.5, 0.045),
        material: recoveryMarkMaterial,
        position: new THREE.Vector3(0, 0, 0.105),
        physicsOptions: { enabled: false },
      }));
      rootComponent.add(ENGINE.MeshComponent.create({
        name: 'Recovery Card Horizontal Mark',
        geometry: new THREE.BoxGeometry(0.5, 0.14, 0.045),
        material: recoveryMarkMaterial,
        position: new THREE.Vector3(0, 0, 0.105),
        physicsOptions: { enabled: false },
      }));
    } else if (this.kind === 'bonus') {
      rootComponent.add(ENGINE.MeshComponent.create({
        name: 'Bonus Star Contrast Outline',
        geometry: geometry.clone(),
        material: new THREE.MeshBasicMaterial({
          color: 0x4a2800,
          side: THREE.BackSide,
          toneMapped: false,
        }),
        scale: new THREE.Vector3(1.075, 1.075, 1.075),
        physicsOptions: { enabled: false },
      }));
    }

    super.initialize({
      ...options,
      rootComponent,
      actorTags: [
        ...(options?.actorTags ?? []),
        'dribble-target',
        this.kind,
        ...(this.isRhythmTarget ? ['center-rhythm'] : []),
      ],
    });
  }

  public override tickPrePhysics(deltaTime: number): void {
    super.tickPrePhysics(deltaTime);
    if (!this.gameplayActive) {
      return;
    }

    if (this.coinMagnetActive && this.kind === 'score') {
      this.updateCoinMagnetMotion(deltaTime);
    } else {
      this.rootComponent.position.z += this.getApproachSpeed() * deltaTime;
    }
    const pressureSpeed = 1 + this.pressureLevel * 1.15;
    const magnetVisualStrength = this.coinMagnetActive
      ? THREE.MathUtils.smoothstep(this.coinMagnetAge, 0, 0.18)
      : 0;
    this.glowPhase += deltaTime
      * (this.isRhythmTarget ? 6.5 : this.kind === 'bonus' ? 7 : 4.5)
      * pressureSpeed
      * (1 + magnetVisualStrength * 0.65);
    const glowPulse = Math.sin(this.glowPhase);
    const glowScale = this.kind === 'score' ? 1.04 : 1.14;
    this.glowShell?.scale.setScalar(
      glowScale
      + this.pressureLevel * 0.1
      + magnetVisualStrength * 0.1
      + glowPulse * (0.045 + magnetVisualStrength * 0.025),
    );
    if (this.glowMaterial) {
      this.glowMaterial.opacity = this.glowBaseOpacity
        + this.pressureLevel * 0.17
        + magnetVisualStrength * 0.24
        + glowPulse * (0.07 + this.pressureLevel * 0.03 + magnetVisualStrength * 0.04);
    }
    if (this.targetMaterial) {
      this.targetMaterial.emissiveIntensity = this.baseEmissiveIntensity
        + this.pressureLevel * 2.2
        + magnetVisualStrength * 1.4;
    }
    for (const [material, baseIntensity] of this.scoreTokenMaterialIntensity) {
      material.emissiveIntensity = baseIntensity
        + this.pressureLevel * 1.4
        + magnetVisualStrength * 1.15
        + Math.max(0, glowPulse) * 0.32;
    }
    this.threatMarker?.scale.setScalar(0.92 + glowPulse * 0.08);
    if (this.threatMarkerMaterial) {
      this.threatMarkerMaterial.opacity = 0.72 + glowPulse * 0.16;
    }
    if (this.kind === 'bonus') {
      this.rootComponent.rotation.y += deltaTime * 0.45;
      this.rootComponent.rotation.z += deltaTime * 2.2;
    } else if (this.kind === 'recovery') {
      this.rootComponent.rotation.y += deltaTime * 1.15;
      this.rootComponent.rotation.z = Math.sin(this.glowPhase * 0.5) * 0.08;
    } else if (this.kind === 'score') {
      const rotationSpeed = 1 + this.pressureLevel * 0.85 + magnetVisualStrength * 1.25;
      this.rootComponent.rotation.x += deltaTime * 2.5 * rotationSpeed;
      this.rootComponent.rotation.y += deltaTime * 1.2 * rotationSpeed;
    } else {
      const rotationSpeed = 1 + this.pressureLevel * 0.85;
      this.rootComponent.rotation.x += deltaTime * 2.5 * rotationSpeed;
      this.rootComponent.rotation.y += deltaTime
        * (this.kind === 'health' ? 1.7 : -2.0)
        * rotationSpeed;
    }

    if (this.rootComponent.position.z > 2.5) {
      this.missedScoreTarget = this.kind === 'score';
      this.avoidedHazard = this.kind === 'hazard' && !this.hit;
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
    return Math.min(this.getUnconstrainedApproachSpeed(), this.spacingSpeedLimit);
  }

  public setSpacingSpeedLimit(limit: number | null): void {
    this.spacingSpeedLimit = limit ?? Number.POSITIVE_INFINITY;
  }

  public setPressureLevel(level: number): void {
    this.pressureLevel = THREE.MathUtils.clamp(level, 0, 1);
  }

  public setCoinMagnetTarget(target: THREE.Vector3 | null): void {
    if (this.kind !== 'score' || this.hit || this.removalRequested) return;
    if (!target) {
      this.coinMagnetActive = false;
      this.coinMagnetAge = 0;
      this.coinMagnetVelocity.set(0, 0, 0);
      return;
    }
    if (!this.coinMagnetActive) {
      this.coinMagnetActive = true;
      this.coinMagnetAge = 0;
      this.coinMagnetVelocity.set(0, 0, this.getApproachSpeed() * 0.35);
    }
    this.coinMagnetTarget.copy(target);
  }

  public isCoinMagnetized(): boolean {
    return this.coinMagnetActive;
  }

  public setThreatOwner(owner: TargetThreatOwner): void {
    if (this.kind !== 'hazard') return;
    const color = owner === 'player' ? 0x65c4ff : 0xff675f;
    if (!this.threatMarker) {
      this.threatMarkerMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
        toneMapped: false,
      });
      this.threatMarker = ENGINE.MeshComponent.create({
        name: 'Threat Ownership Chevron',
        geometry: new THREE.ConeGeometry(0.14, 0.25, 3),
        material: this.threatMarkerMaterial,
        position: new THREE.Vector3(0, 0.88, 0),
        rotation: new THREE.Euler(0, 0, Math.PI),
        physicsOptions: { enabled: false },
      });
      this.rootComponent.add(this.threatMarker);
    }
    this.threatMarkerMaterial?.color.setHex(color);
  }

  public static setHighContrastEnabled(enabled: boolean): void {
    DribbleTarget.highContrastEnabled = enabled;
  }

  public static preloadScoreToken(): void {
    void ENGINE.resourceManager.loadModel(ENGINE.AssetPath.fromString(scoreTokenModelPath))
      .catch(error => {
        console.warn(`Could not preload score token model: ${scoreTokenModelPath}`, error);
      });
  }

  public applyAccessibilityPalette(): void {
    const color = this.getDisplayColor();
    this.targetMaterial?.color.setHex(color);
    this.targetMaterial?.emissive.setHex(color);
    this.glowMaterial?.color.setHex(color);
    this.updateScoreTokenMaterials();
  }

  public convertHazardToScore(): boolean {
    if (this.kind !== 'hazard' || this.hit || this.removalRequested) return false;

    this.kind = 'score';
    this.pressureLevel = 0;
    this.baseEmissiveIntensity = 2.8;
    this.glowBaseOpacity = 0.24;
    this.rootComponent.rotation.set(0, 0, 0);
    if (this.threatMarker) this.threatMarker.visible = false;

    const scoreGeometry = new THREE.TorusGeometry(0.42, 0.12, 12, 28);
    const scoreGlowGeometry = new THREE.TorusGeometry(0.515, 0.014, 6, 32);
    const oldTargetGeometry = this.targetMesh?.geometry;
    const oldGlowGeometry = this.glowShell?.geometry;
    if (this.targetMesh) this.targetMesh.geometry = scoreGeometry;
    if (this.glowShell) this.glowShell.geometry = scoreGlowGeometry;
    oldTargetGeometry?.dispose();
    oldGlowGeometry?.dispose();
    this.glowShell?.scale.setScalar(1.04);
    this.attachScoreTokenModel(this.rootComponent, true);
    this.applyAccessibilityPalette();
    if (this.targetMaterial) this.targetMaterial.emissiveIntensity = this.baseEmissiveIntensity;
    if (this.glowMaterial) this.glowMaterial.opacity = this.glowBaseOpacity;
    return true;
  }

  private attachScoreTokenModel(parent: ENGINE.SceneComponent, loadImmediately: boolean): void {
    if (this.scoreTokenModel) return;

    const model = ENGINE.ModelMeshComponent.create({
      name: 'Basketball Score Token',
      modelUrl: scoreTokenModelPath,
      useDynamicMaterials: true,
      castShadow: true,
      receiveShadow: true,
      scale: new THREE.Vector3(0.96, 0.96, 0.96),
      rotation: new THREE.Euler(Math.PI / 2, 0, 0),
      physicsOptions: { enabled: false },
    });
    model.onMeshLoaded.add((_component, modelRoot) => {
      if (this.removalRequested) return;
      this.scoreTokenMaterialIntensity.clear();
      modelRoot.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) {
          if (!(material instanceof THREE.MeshStandardMaterial)) continue;
          const edgeMaterial = material.name.toLowerCase().includes('amber');
          this.scoreTokenMaterialIntensity.set(material, edgeMaterial ? 1.15 : 2.65);
        }
      });
      this.updateScoreTokenMaterials();
      if (this.targetMesh) this.targetMesh.mesh.visible = false;
    });
    this.scoreTokenModel = model;
    parent.add(model);

    if (loadImmediately) {
      void model.loadModel(ENGINE.AssetPath.fromString(scoreTokenModelPath))
        .catch(error => {
          console.warn(`Could not load score token model: ${scoreTokenModelPath}`, error);
        });
    }
  }

  private updateScoreTokenMaterials(): void {
    for (const [material, baseIntensity] of this.scoreTokenMaterialIntensity) {
      const edgeMaterial = material.name.toLowerCase().includes('amber');
      material.emissive.setHex(
        DribbleTarget.highContrastEnabled
          ? 0xfff066
          : edgeMaterial
            ? 0xb33d00
            : 0xffb20f,
      );
      material.emissiveIntensity = DribbleTarget.highContrastEnabled
        ? baseIntensity + 0.45
        : baseIntensity;
      material.needsUpdate = true;
    }
  }

  public isRemovalPending(): boolean {
    return this.removalRequested;
  }

  public didMissScoreTarget(): boolean {
    return this.missedScoreTarget;
  }

  public didAvoidHazard(): boolean {
    return this.avoidedHazard;
  }

  private getUnconstrainedApproachSpeed(): number {
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

  private updateCoinMagnetMotion(deltaTime: number): void {
    this.coinMagnetAge += deltaTime;
    this.coinMagnetDirection.subVectors(this.coinMagnetTarget, this.rootComponent.position);
    const distance = this.coinMagnetDirection.length();
    if (distance <= 0.001) {
      this.rootComponent.position.copy(this.coinMagnetTarget);
      this.coinMagnetVelocity.set(0, 0, 0);
      return;
    }

    const proximity = 1 - THREE.MathUtils.clamp(distance / 4.5, 0, 1);
    const desiredSpeed = THREE.MathUtils.lerp(7.2, 15.5, proximity * proximity);
    this.coinMagnetDirection.multiplyScalar(desiredSpeed / distance);
    const steering = 1 - Math.exp(-9.5 * deltaTime);
    this.coinMagnetVelocity.lerp(this.coinMagnetDirection, steering);
    this.rootComponent.position.addScaledVector(this.coinMagnetVelocity, deltaTime);
  }

  private getDisplayColor(): number {
    if (!DribbleTarget.highContrastEnabled) {
      if (this.kind === 'score' || this.kind === 'bonus') return 0xffca3a;
      if (this.kind === 'health' || this.kind === 'recovery') return 0x4de6b8;
      return 0xff453a;
    }
    if (this.kind === 'score' || this.kind === 'bonus') return 0xfff000;
    if (this.kind === 'health' || this.kind === 'recovery') return 0x00eaff;
    return 0xff1744;
  }

  public setGameplayActive(active: boolean): void {
    this.gameplayActive = active;
  }
}
