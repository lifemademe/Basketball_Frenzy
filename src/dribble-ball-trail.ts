import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import type { BallCosmetic } from './dribble-progression.js';

@ENGINE.GameClass()
export class DribbleBallTrail extends ENGINE.Actor {
  private static readonly maxPoints = 22;

  private readonly points = Array.from(
    { length: DribbleBallTrail.maxPoints },
    () => new THREE.Vector3(),
  );
  private pointCount = 0;
  private cosmetic: BallCosmetic = 'classic';
  private frenzyActive = false;
  private shieldActive = false;
  private powerBounceActive = false;
  private colorPhase = 0;
  private readonly scratchColor = new THREE.Color();
  private readonly scratchCoreColor = new THREE.Color();
  private readonly whiteColor = new THREE.Color(0xffffff);
  private trailMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null = null;
  private trailCore: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | null = null;

  public override initialize(options?: ENGINE.ActorOptions): void {
    super.initialize({
      ...options,
      rootComponent: ENGINE.SceneComponent.create({ name: 'Trail Root' }),
      actorTags: [...(options?.actorTags ?? []), 'ball-trail-vfx'],
    });

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: false,
      opacity: 1,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const geometry = this.createRibbonGeometry();
    this.trailMesh = new THREE.Mesh(geometry, material);
    this.trailMesh.name = 'Ball Trail VFX';
    this.trailMesh.frustumCulled = false;
    this.trailMesh.renderOrder = -4;
    this.rootComponent.add(this.trailMesh);

    const coreMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.trailCore = new THREE.Line(this.createCoreGeometry(), coreMaterial);
    this.trailCore.name = 'Ball Trail Luminous Core';
    this.trailCore.frustumCulled = false;
    this.trailCore.renderOrder = -3;
    this.rootComponent.add(this.trailCore);
  }

  public record(position: THREE.Vector3): void {
    const lastPoint = this.pointCount > 0 ? this.points[this.pointCount - 1] : null;
    if (lastPoint && lastPoint.distanceToSquared(position) < 0.0012) {
      return;
    }

    if (this.pointCount < DribbleBallTrail.maxPoints) {
      this.points[this.pointCount].copy(position);
      this.pointCount += 1;
    } else {
      for (let index = 1; index < DribbleBallTrail.maxPoints; index += 1) {
        this.points[index - 1].copy(this.points[index]);
      }
      this.points[DribbleBallTrail.maxPoints - 1].copy(position);
    }
    this.colorPhase += 0.018;
    this.updateRibbon();
  }

  public clear(position?: THREE.Vector3): void {
    this.pointCount = 0;
    if (position) {
      this.points[0].copy(position);
      this.pointCount = 1;
    }
    if (this.trailMesh) {
      this.trailMesh.geometry.setDrawRange(0, 0);
    }
    if (this.trailCore) {
      this.trailCore.geometry.setDrawRange(0, 0);
    }
  }

  public setFrenzyActive(active: boolean): void {
    this.frenzyActive = active;
    this.updateRibbon();
  }

  public setShieldActive(active: boolean): void {
    this.shieldActive = active;
    this.updateRibbon();
  }

  public setCosmetic(cosmetic: BallCosmetic): void {
    this.cosmetic = cosmetic;
    this.colorPhase = 0;
    this.updateRibbon();
  }

  public setPowerBounceActive(active: boolean): void {
    if (this.powerBounceActive === active) return;
    this.powerBounceActive = active;
    this.updateRibbon();
  }

  protected override doEndPlay(): void {
    if (this.trailMesh) {
      this.trailMesh.geometry.dispose();
      this.trailMesh.material.dispose();
      this.trailMesh.removeFromParent();
      this.trailMesh = null;
    }
    if (this.trailCore) {
      this.trailCore.geometry.dispose();
      this.trailCore.material.dispose();
      this.trailCore.removeFromParent();
      this.trailCore = null;
    }
    super.doEndPlay();
  }

  private createRibbonGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(DribbleBallTrail.maxPoints * 2 * 3);
    const colors = new Float32Array(DribbleBallTrail.maxPoints * 2 * 3);
    const indices = new Uint16Array((DribbleBallTrail.maxPoints - 1) * 6);
    for (let index = 0; index < DribbleBallTrail.maxPoints - 1; index += 1) {
      const vertex = index * 2;
      const offset = index * 6;
      indices.set([vertex, vertex + 2, vertex + 1, vertex + 2, vertex + 3, vertex + 1], offset);
    }
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setDrawRange(0, 0);
    return geometry;
  }

  private createCoreGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array(DribbleBallTrail.maxPoints * 3),
        3,
      ).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(
        new Float32Array(DribbleBallTrail.maxPoints * 3),
        3,
      ).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setDrawRange(0, 0);
    return geometry;
  }

  private updateRibbon(): void {
    if (!this.trailMesh || this.pointCount < 2) {
      return;
    }

    const positionAttribute = this.trailMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colorAttribute = this.trailMesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    const positions = positionAttribute.array as Float32Array;
    const colors = colorAttribute.array as Float32Array;
    const corePositionAttribute = this.trailCore?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const coreColorAttribute = this.trailCore?.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    const corePositions = corePositionAttribute?.array as Float32Array | undefined;
    const coreColors = coreColorAttribute?.array as Float32Array | undefined;
    for (let index = 0; index < this.pointCount; index += 1) {
      const point = this.points[index];
      const previous = this.points[Math.max(0, index - 1)];
      const next = this.points[Math.min(this.pointCount - 1, index + 1)];
      const tangentX = next.x - previous.x;
      const tangentY = next.y - previous.y;
      const tangentLength = Math.hypot(tangentX, tangentY) || 1;
      const normalX = -tangentY / tangentLength;
      const normalY = tangentX / tangentLength;
      const progress = index / (this.pointCount - 1);
      const baseWidth = THREE.MathUtils.lerp(0.004, 0.108, THREE.MathUtils.smoothstep(progress, 0, 0.82));
      const width = baseWidth * this.getWidthScale();
      const offset = index * 6;

      positions[offset] = point.x + normalX * width;
      positions[offset + 1] = point.y + normalY * width - 0.025;
      positions[offset + 2] = point.z - 0.045;
      positions[offset + 3] = point.x - normalX * width;
      positions[offset + 4] = point.y - normalY * width - 0.025;
      positions[offset + 5] = point.z - 0.045;
      this.setTrailColor(progress);
      colors[offset] = this.scratchColor.r;
      colors[offset + 1] = this.scratchColor.g;
      colors[offset + 2] = this.scratchColor.b;
      colors[offset + 3] = this.scratchColor.r;
      colors[offset + 4] = this.scratchColor.g;
      colors[offset + 5] = this.scratchColor.b;

      if (corePositions && coreColors) {
        const coreOffset = index * 3;
        corePositions[coreOffset] = point.x;
        corePositions[coreOffset + 1] = point.y - 0.025;
        corePositions[coreOffset + 2] = point.z - 0.04;
        const whiteBlend = this.cosmetic === 'blackhole'
          ? 0.12 + progress * 0.12
          : 0.4 + progress * (this.frenzyActive ? 0.58 : 0.48);
        this.scratchCoreColor.copy(this.scratchColor).lerp(this.whiteColor, whiteBlend);
        coreColors[coreOffset] = this.scratchCoreColor.r;
        coreColors[coreOffset + 1] = this.scratchCoreColor.g;
        coreColors[coreOffset + 2] = this.scratchCoreColor.b;
      }
    }

    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
    this.trailMesh.geometry.setDrawRange(0, (this.pointCount - 1) * 6);
    if (corePositionAttribute && coreColorAttribute && this.trailCore) {
      corePositionAttribute.needsUpdate = true;
      coreColorAttribute.needsUpdate = true;
      this.trailCore.geometry.setDrawRange(0, this.pointCount);
      this.trailCore.material.opacity = this.powerBounceActive || this.frenzyActive || this.shieldActive
        ? 1
        : 0.88;
    }
  }

  private getWidthScale(): number {
    const powerScale = this.powerBounceActive ? 1.45 : 1.12;
    if (this.frenzyActive) return 1.62 * powerScale;
    if (this.shieldActive) return 1.48 * powerScale;
    if (this.cosmetic === 'blackhole') return 1.4 * powerScale;
    if (this.cosmetic === 'disco') return 1.28 * powerScale;
    return powerScale;
  }

  private setTrailColor(progress: number): void {
    if (this.frenzyActive) {
      this.scratchColor.setRGB(
        1,
        THREE.MathUtils.lerp(0.56, 0.96, progress),
        THREE.MathUtils.lerp(0.03, 0.55, progress),
      );
      return;
    }
    if (this.shieldActive) {
      this.scratchColor.setRGB(
        THREE.MathUtils.lerp(0.08, 0.48, progress),
        THREE.MathUtils.lerp(0.62, 1, progress),
        1,
      );
      return;
    }
    if (this.cosmetic === 'disco') {
      this.scratchColor.setHSL((progress * 0.8 + this.colorPhase * 0.42) % 1, 1, 0.62);
      return;
    }
    if (this.cosmetic === 'blackhole') {
      if (progress < 0.68) {
        this.scratchColor.setRGB(
          THREE.MathUtils.lerp(0.03, 0.42, progress / 0.68),
          THREE.MathUtils.lerp(0.005, 0.02, progress / 0.68),
          THREE.MathUtils.lerp(0.08, 0.72, progress / 0.68),
        );
      } else {
        const heat = (progress - 0.68) / 0.32;
        this.scratchColor.setRGB(THREE.MathUtils.lerp(0.42, 1, heat), 0.02 + heat * 0.3, 0.72 - heat * 0.6);
      }
      return;
    }
    if (this.cosmetic === 'epic') {
      this.scratchColor.setRGB(0.03 + progress * 0.08, 0.32 + progress * 0.58, 1);
      return;
    }
    this.scratchColor.setRGB(1, 0.45 + progress * 0.33, 0.03 + progress * 0.12);
  }
}
