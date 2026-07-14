import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

@ENGINE.GameClass()
export class DribbleBallTrail extends ENGINE.Actor {
  private readonly points: THREE.Vector3[] = [];
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
    this.trailMesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.trailMesh.name = 'Ball Trail VFX';
    this.trailMesh.frustumCulled = false;
    this.trailMesh.renderOrder = 8;
    this.rootComponent.add(this.trailMesh);
  }

  public record(position: THREE.Vector3): void {
    const lastPoint = this.points[this.points.length - 1];
    if (lastPoint && lastPoint.distanceToSquared(position) < 0.0012) {
      return;
    }

    this.points.push(position.clone());
    if (this.points.length > 18) {
      this.points.shift();
    }
    this.rebuildTrail();
  }

  public clear(position?: THREE.Vector3): void {
    this.points.length = 0;
    if (position) {
      this.points.push(position.clone());
    }
    if (this.trailMesh) {
      this.trailMesh.geometry.dispose();
      this.trailMesh.geometry = new THREE.BufferGeometry();
    }
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

  private rebuildTrail(): void {
    if (!this.trailMesh || this.points.length < 2) {
      return;
    }

    const curve = new THREE.CatmullRomCurve3(this.points, false, 'centripetal');
    const geometry = this.createTaperedTube(curve, Math.max(8, (this.points.length - 1) * 3), 7);
    this.trailMesh.geometry.dispose();
    this.trailMesh.geometry = geometry;
  }

  private createTaperedTube(
    curve: THREE.CatmullRomCurve3,
    tubularSegments: number,
    radialSegments: number,
  ): THREE.BufferGeometry {
    const frames = curve.computeFrenetFrames(tubularSegments, false);
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const point = new THREE.Vector3();
    const normal = new THREE.Vector3();

    for (let index = 0; index <= tubularSegments; index += 1) {
      const progress = index / tubularSegments;
      const taper = THREE.MathUtils.smoothstep(progress, 0, 0.82);
      const radius = THREE.MathUtils.lerp(0.003, 0.058, taper);
      curve.getPointAt(progress, point);

      for (let radialIndex = 0; radialIndex <= radialSegments; radialIndex += 1) {
        const angle = radialIndex / radialSegments * Math.PI * 2;
        normal.copy(frames.normals[index]).multiplyScalar(Math.cos(angle));
        normal.addScaledVector(frames.binormals[index], Math.sin(angle)).normalize();
        positions.push(
          point.x + normal.x * radius,
          point.y + normal.y * radius,
          point.z + normal.z * radius,
        );
        normals.push(normal.x, normal.y, normal.z);
        uvs.push(progress, radialIndex / radialSegments);
      }
    }

    for (let index = 1; index <= tubularSegments; index += 1) {
      for (let radialIndex = 1; radialIndex <= radialSegments; radialIndex += 1) {
        const a = (radialSegments + 1) * (index - 1) + radialIndex - 1;
        const b = (radialSegments + 1) * index + radialIndex - 1;
        const c = (radialSegments + 1) * index + radialIndex;
        const d = (radialSegments + 1) * (index - 1) + radialIndex;
        indices.push(a, b, d, b, c, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeBoundingSphere();
    return geometry;
  }
}
