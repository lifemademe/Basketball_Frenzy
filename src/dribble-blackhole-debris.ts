import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

@ENGINE.GameClass()
export class DribbleBlackHoleDebris extends ENGINE.Actor {
  private static readonly particleCount = 14;
  private static readonly lifetime = 0.68;

  private readonly positions = Array.from(
    { length: DribbleBlackHoleDebris.particleCount },
    () => new THREE.Vector3(),
  );
  private readonly velocities = Array.from(
    { length: DribbleBlackHoleDebris.particleCount },
    () => new THREE.Vector3(),
  );
  private readonly rotations = Array.from(
    { length: DribbleBlackHoleDebris.particleCount },
    () => new THREE.Euler(),
  );
  private readonly rotationSpeeds = Array.from(
    { length: DribbleBlackHoleDebris.particleCount },
    () => new THREE.Vector3(),
  );
  private readonly scales = new Float32Array(DribbleBlackHoleDebris.particleCount);
  private readonly scratchMatrix = new THREE.Matrix4();
  private readonly scratchQuaternion = new THREE.Quaternion();
  private readonly scratchScale = new THREE.Vector3();
  private readonly scratchColor = new THREE.Color();
  private debrisMesh: THREE.InstancedMesh<THREE.TetrahedronGeometry, THREE.MeshBasicMaterial> | null = null;
  private elapsed = 0;
  private active = false;

  public override initialize(options?: ENGINE.ActorOptions): void {
    super.initialize({
      ...options,
      rootComponent: ENGINE.SceneComponent.create({ name: 'Black Hole Debris Root' }),
      actorTags: [...(options?.actorTags ?? []), 'blackhole-debris-vfx'],
    });

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.debrisMesh = new THREE.InstancedMesh(
      new THREE.TetrahedronGeometry(0.045, 0),
      material,
      DribbleBlackHoleDebris.particleCount,
    );
    this.debrisMesh.name = 'Black Hole Rising Debris';
    this.debrisMesh.frustumCulled = false;
    this.debrisMesh.renderOrder = 9;
    this.debrisMesh.visible = false;
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rootComponent.add(this.debrisMesh);
  }

  public play(position: THREE.Vector3): void {
    if (!this.debrisMesh) return;
    this.elapsed = 0;
    this.active = true;
    this.rootComponent.position.copy(position);
    this.debrisMesh.visible = true;
    this.debrisMesh.material.opacity = 1;

    for (let index = 0; index < DribbleBlackHoleDebris.particleCount; index += 1) {
      const angle = (index / DribbleBlackHoleDebris.particleCount) * Math.PI * 2;
      const spread = 0.06 + (index % 4) * 0.035;
      this.positions[index].set(Math.cos(angle) * spread, 0.02, Math.sin(angle) * spread * 0.5);
      this.velocities[index].set(
        Math.cos(angle) * (0.45 + (index % 3) * 0.2),
        1.85 + (index % 5) * 0.28,
        Math.sin(angle) * (0.22 + (index % 2) * 0.16),
      );
      this.rotations[index].set(angle, angle * 0.7, angle * 1.3);
      this.rotationSpeeds[index].set(3.2 + index * 0.08, 4.5 - index * 0.06, 2.6 + index * 0.1);
      this.scales[index] = 0.75 + (index % 4) * 0.16;
      this.scratchColor.set(index % 3 === 0 ? 0xffb43b : index % 3 === 1 ? 0x9b3cff : 0xff5426);
      this.debrisMesh.setColorAt(index, this.scratchColor);
    }
    this.debrisMesh.instanceColor!.needsUpdate = true;
    this.updateInstances(0);
  }

  public deactivate(): void {
    this.active = false;
    if (this.debrisMesh) this.debrisMesh.visible = false;
  }

  public override tickPrePhysics(deltaTime: number): void {
    super.tickPrePhysics(deltaTime);
    if (!this.active || !this.debrisMesh) return;

    this.elapsed += deltaTime;
    const progress = Math.min(this.elapsed / DribbleBlackHoleDebris.lifetime, 1);
    this.debrisMesh.material.opacity = 1 - THREE.MathUtils.smoothstep(progress, 0.56, 1);
    this.updateInstances(deltaTime);
    if (progress >= 1) this.deactivate();
  }

  protected override doEndPlay(): void {
    if (this.debrisMesh) {
      this.debrisMesh.geometry.dispose();
      this.debrisMesh.material.dispose();
      this.debrisMesh.removeFromParent();
      this.debrisMesh = null;
    }
    super.doEndPlay();
  }

  private updateInstances(deltaTime: number): void {
    if (!this.debrisMesh) return;
    const progress = Math.min(this.elapsed / DribbleBlackHoleDebris.lifetime, 1);
    for (let index = 0; index < DribbleBlackHoleDebris.particleCount; index += 1) {
      const velocity = this.velocities[index];
      velocity.y -= 5.2 * deltaTime;
      this.positions[index].addScaledVector(velocity, deltaTime);
      const rotation = this.rotations[index];
      const rotationSpeed = this.rotationSpeeds[index];
      rotation.x += rotationSpeed.x * deltaTime;
      rotation.y += rotationSpeed.y * deltaTime;
      rotation.z += rotationSpeed.z * deltaTime;
      this.scratchQuaternion.setFromEuler(rotation);
      const scale = this.scales[index] * (1 - progress * 0.52);
      this.scratchScale.set(scale, scale * 1.7, scale);
      this.scratchMatrix.compose(this.positions[index], this.scratchQuaternion, this.scratchScale);
      this.debrisMesh.setMatrixAt(index, this.scratchMatrix);
    }
    this.debrisMesh.instanceMatrix.needsUpdate = true;
  }
}
