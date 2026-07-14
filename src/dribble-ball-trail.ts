import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

@ENGINE.GameClass()
export class DribbleBallTrail extends ENGINE.Actor {
  private static readonly maxPoints = 18;

  private readonly points = Array.from(
    { length: DribbleBallTrail.maxPoints },
    () => new THREE.Vector3(),
  );
  private pointCount = 0;
  private frenzyActive = false;
  private trailMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null = null;

  public override initialize(options?: ENGINE.ActorOptions): void {
    super.initialize({
      ...options,
      rootComponent: ENGINE.SceneComponent.create({ name: 'Trail Root' }),
      actorTags: [...(options?.actorTags ?? []), 'ball-trail-vfx'],
    });

    const material = new THREE.MeshBasicMaterial({
      color: 0xffca3a,
      transparent: false,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const geometry = this.createRibbonGeometry();
    this.trailMesh = new THREE.Mesh(geometry, material);
    this.trailMesh.name = 'Ball Trail VFX';
    this.trailMesh.frustumCulled = false;
    this.trailMesh.renderOrder = 8;
    this.rootComponent.add(this.trailMesh);
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
  }

  public setFrenzyActive(active: boolean): void {
    this.frenzyActive = active;
    this.trailMesh?.material.color.set(active ? 0xfff1a1 : 0xffca3a);
    this.updateRibbon();
  }

  protected override doEndPlay(): void {
    if (this.trailMesh) {
      this.trailMesh.geometry.dispose();
      this.trailMesh.material.dispose();
      this.trailMesh.removeFromParent();
      this.trailMesh = null;
    }
    super.doEndPlay();
  }

  private createRibbonGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(DribbleBallTrail.maxPoints * 2 * 3);
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
    geometry.setDrawRange(0, 0);
    return geometry;
  }

  private updateRibbon(): void {
    if (!this.trailMesh || this.pointCount < 2) {
      return;
    }

    const positionAttribute = this.trailMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = positionAttribute.array as Float32Array;
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
      const baseWidth = THREE.MathUtils.lerp(0.004, 0.062, THREE.MathUtils.smoothstep(progress, 0, 0.82));
      const width = baseWidth * (this.frenzyActive ? 1.45 : 1);
      const offset = index * 6;

      positions[offset] = point.x + normalX * width;
      positions[offset + 1] = point.y + normalY * width;
      positions[offset + 2] = point.z + 0.012;
      positions[offset + 3] = point.x - normalX * width;
      positions[offset + 4] = point.y - normalY * width;
      positions[offset + 5] = point.z + 0.012;
    }

    positionAttribute.needsUpdate = true;
    this.trailMesh.geometry.setDrawRange(0, (this.pointCount - 1) * 6);
  }
}
