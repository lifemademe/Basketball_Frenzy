import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

export interface DribbleImpactBurstOptions extends ENGINE.ActorOptions {
  color?: THREE.ColorRepresentation;
}

@ENGINE.GameClass()
export class DribbleImpactBurst extends ENGINE.Actor {
  private readonly lifetime = 0.3;
  private elapsed = 0;
  private gameplayActive = true;
  private active = false;
  private material: THREE.MeshBasicMaterial | null = null;

  public override initialize(options?: DribbleImpactBurstOptions): void {
    this.material = new THREE.MeshBasicMaterial({
      color: options?.color ?? 0xffffff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });

    super.initialize({
      ...options,
      rootComponent: ENGINE.MeshComponent.create({
        name: 'Impact Ring',
        geometry: new THREE.TorusGeometry(0.48, 0.08, 8, 28),
        material: this.material,
        scale: new THREE.Vector3(0.45, 0.45, 0.45),
        physicsOptions: { enabled: false },
      }),
      actorTags: [...(options?.actorTags ?? []), 'impact-burst'],
    });
    this.rootComponent.visible = false;
  }

  public setGameplayActive(active: boolean): void {
    this.gameplayActive = active;
  }

  public play(position: THREE.Vector3, color: THREE.ColorRepresentation): void {
    this.elapsed = 0;
    this.active = true;
    this.rootComponent.visible = true;
    this.rootComponent.position.copy(position);
    this.rootComponent.rotation.set(0, 0, 0);
    this.rootComponent.scale.setScalar(0.45);
    if (this.material) {
      this.material.color.set(color);
      this.material.opacity = 0.92;
    }
  }

  public deactivate(): void {
    this.active = false;
    this.rootComponent.visible = false;
  }

  public override tickPrePhysics(deltaTime: number): void {
    super.tickPrePhysics(deltaTime);
    if (!this.gameplayActive || !this.active) {
      return;
    }

    this.elapsed += deltaTime;
    const progress = Math.min(this.elapsed / this.lifetime, 1);
    const scale = THREE.MathUtils.lerp(0.45, 2.35, 1 - Math.pow(1 - progress, 3));
    this.rootComponent.scale.setScalar(scale);
    this.rootComponent.rotation.z += deltaTime * 4;
    if (this.material) {
      this.material.opacity = 0.92 * (1 - progress);
    }

    if (progress >= 1) {
      this.deactivate();
    }
  }
}
