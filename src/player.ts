/**
 * First person player pawn - hides character mesh, camera at eye level.
 */

import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { DribbleGameplayManager } from './dribble-gameplay.js';
import {
  playGamepadActionFeedback,
  playGamepadUiFeedback,
} from './dribble-input-feedback.js';

@ENGINE.GameClass()
export class FirstPersonPlayer extends ENGINE.CharacterPawn {
  private static readonly powerBounceImpulseDuration = 0.24;
  private static readonly gameplayCameraPullback = 0.08;
  private static readonly gameplayCameraDownwardPitch = THREE.MathUtils.degToRad(12);
  private static readonly gameplayCameraFov = 70;

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
    try {
      if (localStorage.getItem('basketball-frenzy-reduced-motion') === 'true') return;
    } catch {
      // Use the default camera response when storage is unavailable.
    }
    this.powerBounceImpulseTime = 0;
    this.powerBounceImpulseSide = side === 'left' ? -1 : 1;
  }

  protected override updateCamera(deltaTime: number): void {
    if (!this.cameraTransformCaptured) {
      this.camera.position.z += FirstPersonPlayer.gameplayCameraPullback;
      if (this.camera instanceof THREE.PerspectiveCamera) {
        this.camera.fov = FirstPersonPlayer.gameplayCameraFov;
        this.camera.updateProjectionMatrix();
      }
      this.cameraImpulseEuler.set(-FirstPersonPlayer.gameplayCameraDownwardPitch, 0, 0);
      this.cameraImpulseQuaternion.setFromEuler(this.cameraImpulseEuler);
      this.camera.quaternion.multiply(this.cameraImpulseQuaternion);
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
  private menuAxisHorizontal = 0;
  private menuAxisVertical = 0;

  public override handleKeyDown(event: KeyboardEvent): boolean {
    if (event.code === 'F8' && !event.repeat) {
      this.getWorld()?.getActors(DribbleGameplayManager)[0]?.toggleDeveloperPanel();
      return true;
    }
    if (event.code === 'F9' && !event.repeat) {
      this.getWorld()?.getActors(DribbleGameplayManager)[0]?.exportTelemetryReport();
      return true;
    }
    if (event.code === 'Escape' && !event.repeat) {
      this.getWorld()?.getActors(DribbleGameplayManager)[0]?.togglePause();
      return true;
    }
    return super.handleKeyDown(event);
  }

  public override handleMouseDown(button: ENGINE.MouseButton, event: MouseEvent): boolean {
    if (button === ENGINE.MouseButton.Left) {
      this.performSideAction('left');
      return true;
    }
    if (button === ENGINE.MouseButton.Right) {
      this.performSideAction('right');
      return true;
    }
    return super.handleMouseDown(button, event);
  }

  public override handleGamepadButtonDown(
    gamepadIndex: number,
    buttonIndex: number,
    value: number,
  ): boolean {
    if (gamepadIndex !== 0) {
      return super.handleGamepadButtonDown(gamepadIndex, buttonIndex, value);
    }
    const gameplay = this.getWorld()?.getActors(DribbleGameplayManager)[0];
    if (buttonIndex === ENGINE.GamepadButton.Start) {
      gameplay?.togglePause();
      playGamepadUiFeedback(gamepadIndex, true);
      return true;
    }
    if (gameplay?.isControllerMenuActive()) {
      if (buttonIndex === ENGINE.GamepadButton.FaceBottom) {
        if (gameplay.confirmControllerMenuSelection()) {
          playGamepadUiFeedback(gamepadIndex, true);
        }
        return true;
      }
      if (buttonIndex === ENGINE.GamepadButton.FaceRight) {
        if (gameplay.cancelControllerMenuSelection()) {
          playGamepadUiFeedback(gamepadIndex, true);
        }
        return true;
      }
      const direction = buttonIndex === ENGINE.GamepadButton.DpadUp
        ? 'up'
        : buttonIndex === ENGINE.GamepadButton.DpadDown
          ? 'down'
          : buttonIndex === ENGINE.GamepadButton.DpadLeft
            ? 'left'
            : buttonIndex === ENGINE.GamepadButton.DpadRight
              ? 'right'
              : null;
      if (direction) {
        if (gameplay.navigateControllerMenu(direction)) playGamepadUiFeedback(gamepadIndex);
        return true;
      }
    }
    if (buttonIndex === ENGINE.GamepadButton.FaceLeft) {
      this.performSideAction('left', gamepadIndex);
      return true;
    }
    if (buttonIndex === ENGINE.GamepadButton.FaceRight) {
      this.performSideAction('right', gamepadIndex);
      return true;
    }
    return super.handleGamepadButtonDown(gamepadIndex, buttonIndex, value);
  }

  public override handleGamepadAxisChange(
    gamepadIndex: number,
    axisIndex: number,
    value: number,
  ): boolean {
    if (gamepadIndex !== 0) {
      return super.handleGamepadAxisChange(gamepadIndex, axisIndex, value);
    }
    const gameplay = this.getWorld()?.getActors(DribbleGameplayManager)[0];
    if (!gameplay?.isControllerMenuActive()) {
      this.menuAxisHorizontal = 0;
      this.menuAxisVertical = 0;
      return super.handleGamepadAxisChange(gamepadIndex, axisIndex, value);
    }

    if (axisIndex === ENGINE.GamepadAxis.LeftStickX) {
      return this.handleMenuAxis(gamepadIndex, value, 'horizontal', gameplay);
    }
    if (axisIndex === ENGINE.GamepadAxis.LeftStickY) {
      return this.handleMenuAxis(gamepadIndex, value, 'vertical', gameplay);
    }
    return true;
  }

  private performSideAction(side: 'left' | 'right', gamepadIndex?: number): void {
    const gameplay = this.getWorld()?.getActors(DribbleGameplayManager)[0];
    const action = gameplay?.handleSideAction(side) ?? null;
    if (gamepadIndex === undefined) return;
    gameplay?.showDirectionalInputFeedback(side, action !== null);
    playGamepadActionFeedback(gamepadIndex, side, action);
  }

  private handleMenuAxis(
    gamepadIndex: number,
    value: number,
    axis: 'horizontal' | 'vertical',
    gameplay: DribbleGameplayManager,
  ): boolean {
    if (Math.abs(value) < 0.35) {
      if (axis === 'horizontal') this.menuAxisHorizontal = 0;
      else this.menuAxisVertical = 0;
      return true;
    }
    if (Math.abs(value) < 0.68) return true;
    const directionSign = Math.sign(value);
    const previousSign = axis === 'horizontal' ? this.menuAxisHorizontal : this.menuAxisVertical;
    if (previousSign === directionSign) return true;
    if (axis === 'horizontal') this.menuAxisHorizontal = directionSign;
    else this.menuAxisVertical = directionSign;
    const direction = axis === 'horizontal'
      ? directionSign < 0 ? 'left' : 'right'
      : directionSign < 0 ? 'up' : 'down';
    if (gameplay.navigateControllerMenu(direction)) playGamepadUiFeedback(gamepadIndex);
    return true;
  }
}
