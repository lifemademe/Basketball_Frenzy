/**
 * First person player pawn - hides character mesh, camera at eye level.
 */

import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { DribbleGameplayManager } from './dribble-gameplay.js';

@ENGINE.GameClass()
export class FirstPersonPlayer extends ENGINE.CharacterPawn {
  private static readonly powerBounceImpulseDuration = 0.24;

  private powerBounceImpulseTime = FirstPersonPlayer.powerBounceImpulseDuration;
  private powerBounceImpulseSide = 1;
  private cameraTransformCaptured = false;
  private readonly cameraBasePosition = new THREE.Vector3();
  private readonly cameraBaseQuaternion = new THREE.Quaternion();
  private readonly cameraImpulseQuaternion = new THREE.Quaternion();
  private readonly cameraImpulseEuler = new THREE.Euler();

  protected override getInitialCameraPositions(): {
    pivotPosition: THREE.Vector3;
    cameraPosition: THREE.Vector3;
    } {
    const cameraPosition = new THREE.Vector3(0, ENGINE.CHARACTER_HEIGHT * 0.68, 0);
    return {
      pivotPosition: cameraPosition,
      cameraPosition: cameraPosition,
    };
  }

  public override moveForward(_value: number, _isAbsolute: boolean = false): void {
  }

  public override moveRight(_value: number, _isAbsolute: boolean = false): void {
  }

  public override lookUp(_value: number, _isAbsolute: boolean = false): void {
  }

  public override lookRight(_value: number, _isAbsolute: boolean = false): void {
  }

  public override zoom(_value: number, _isAbsolute: boolean = false): void {
  }

  public playPowerBounceCameraImpulse(side: 'left' | 'right'): void {
    this.powerBounceImpulseTime = 0;
    this.powerBounceImpulseSide = side === 'left' ? -1 : 1;
  }

  protected override updateCamera(deltaTime: number): void {
    if (!this.cameraTransformCaptured) {
      this.cameraBasePosition.copy(this.camera.position);
      this.cameraBaseQuaternion.copy(this.camera.quaternion);
      this.cameraTransformCaptured = true;
    }

    const duration = FirstPersonPlayer.powerBounceImpulseDuration;
    if (this.powerBounceImpulseTime >= duration) {
      this.camera.position.copy(this.cameraBasePosition);
      this.camera.quaternion.copy(this.cameraBaseQuaternion);
      return;
    }

    this.powerBounceImpulseTime = Math.min(duration, this.powerBounceImpulseTime + deltaTime);
    const progress = this.powerBounceImpulseTime / duration;
    const lift = Math.sin(progress * Math.PI) * (1 - progress * 0.18);
    const settle = Math.sin(progress * Math.PI * 4) * (1 - progress) * 0.22;

    this.camera.position.copy(this.cameraBasePosition);
    this.camera.position.y += lift * 0.034 + settle * 0.004;
    this.camera.position.z += lift * 0.016;

    this.cameraImpulseEuler.set(
      -lift * 0.011 + settle * 0.003,
      0,
      this.powerBounceImpulseSide * lift * 0.008,
    );
    this.cameraImpulseQuaternion.setFromEuler(this.cameraImpulseEuler);
    this.camera.quaternion.copy(this.cameraBaseQuaternion).multiply(this.cameraImpulseQuaternion);
  }

  protected override setupAnimationComponent(): ENGINE.AnimationStateMachineComponent | null {
    return null;
  }

  protected override setupVisualComponent(): ENGINE.SceneComponent | null {
    return null;
  }

}

@ENGINE.GameClass()
export class FirstPersonPlayerController extends ENGINE.DefaultPlayerController {
  public override handleKeyDown(event: KeyboardEvent): boolean {
    if (event.code === 'Escape' && !event.repeat) {
      this.getWorld()?.getActors(DribbleGameplayManager)[0]?.togglePause();
      return true;
    }
    return super.handleKeyDown(event);
  }

  public override handleMouseDown(button: ENGINE.MouseButton, event: MouseEvent): boolean {
    const gameplay = this.getWorld()?.getActors(DribbleGameplayManager)[0];
    if (button === ENGINE.MouseButton.Left) {
      const action = gameplay?.handleLeftClick();
      if (action === 'boost' && this.pawn instanceof FirstPersonPlayer) {
        this.pawn.playPowerBounceCameraImpulse('left');
      }
      return true;
    }
    if (button === ENGINE.MouseButton.Right) {
      const action = gameplay?.handleRightClick();
      if (action === 'boost' && this.pawn instanceof FirstPersonPlayer) {
        this.pawn.playPowerBounceCameraImpulse('right');
      }
      return true;
    }
    return super.handleMouseDown(button, event);
  }
}
