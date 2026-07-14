import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

export interface DribbleComboPopupOptions extends ENGINE.ActorOptions {
  label?: string;
  color?: string;
}

@ENGINE.GameClass()
export class DribbleComboPopup extends ENGINE.Actor {
  private readonly lifetime = 0.78;
  private readonly startPosition = new THREE.Vector3();
  private elapsed = 0;
  private driftX = 0;
  private gameplayActive = true;
  private active = false;
  private spriteMaterial: THREE.SpriteMaterial | null = null;
  private textComponent: ENGINE.TextComponent | null = null;

  public override initialize(options?: DribbleComboPopupOptions): void {
    const text = ENGINE.TextComponent.create({
      name: 'Combo Popup Text',
      text: options?.label ?? 'COMBO x2',
      fontSize: 58,
      fontFamily: 'Boogaloo',
      fontWeight: '400',
      textColor: options?.color ?? '#ffca3a',
      backgroundOpacity: 0,
      padding: 0,
      canvasWidth: 512,
      canvasHeight: 128,
      depthTest: false,
      depthWrite: false,
    });

    super.initialize({
      ...options,
      rootComponent: text,
      actorTags: [...(options?.actorTags ?? []), 'combo-popup-vfx'],
    });

    this.textComponent = text;
    this.startPosition.copy(this.rootComponent.position);
    this.driftX = THREE.MathUtils.randFloatSpread(0.18);
    this.rootComponent.scale.setScalar(0.1);
    this.rootComponent.traverse(object => {
      if (object instanceof THREE.Sprite) {
        this.spriteMaterial = object.material;
        object.renderOrder = 20;
      }
    });
    this.rootComponent.visible = false;
  }

  public setGameplayActive(active: boolean): void {
    this.gameplayActive = active;
  }

  public play(position: THREE.Vector3, label: string, color: string): void {
    this.elapsed = 0;
    this.active = true;
    this.startPosition.copy(position);
    this.driftX = THREE.MathUtils.randFloatSpread(0.18);
    this.rootComponent.visible = true;
    this.rootComponent.position.copy(position);
    this.rootComponent.scale.setScalar(0.1);
    if (this.textComponent) {
      this.textComponent.textColor = color;
      this.textComponent.updateText(label);
    }
    if (this.spriteMaterial) {
      this.spriteMaterial.opacity = 1;
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
    const rise = 1 - Math.pow(1 - progress, 3);
    const scale = progress < 0.2
      ? THREE.MathUtils.lerp(0.1, 0.32, THREE.MathUtils.smootherstep(progress / 0.2, 0, 1))
      : THREE.MathUtils.lerp(0.32, 0.25, THREE.MathUtils.smoothstep(progress, 0.2, 1));

    this.rootComponent.position.set(
      this.startPosition.x + this.driftX * rise,
      this.startPosition.y + rise * 0.9,
      this.startPosition.z + 0.04,
    );
    this.rootComponent.scale.setScalar(scale);
    if (this.spriteMaterial) {
      this.spriteMaterial.opacity = 1 - THREE.MathUtils.smoothstep(progress, 0.52, 1);
    }

    if (progress >= 1) {
      this.deactivate();
    }
  }
}
