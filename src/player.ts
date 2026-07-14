/**
 * First person player pawn - hides character mesh, camera at eye level.
 */

import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { DribbleGameplayManager } from './dribble-gameplay.js';

@ENGINE.GameClass()
export class FirstPersonPlayer extends ENGINE.CharacterPawn {
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

  public override addForwardInput(_value: number, _isAbsolute: boolean = false): void {
  }

  public override addRightInput(_value: number, _isAbsolute: boolean = false): void {
  }

  public override addLookUpInput(_value: number, _isAbsolute: boolean = false): void {
  }

  public override addLookRightInput(_value: number, _isAbsolute: boolean = false): void {
  }

  public override addZoomInput(_value: number, _isAbsolute: boolean = false): void {
  }

  protected override updateCamera(_deltaTime: number): void {
  }

  protected override setupAnimationComponent(): ENGINE.AnimationStateMachineComponent | null {
    return null;
  }

  protected override setupVisualComponent(): ENGINE.SceneComponent | null {
    return null;
  }

  public override handleKeyDown(event: KeyboardEvent): boolean {
    if (event.code === 'Escape' && !event.repeat) {
      this.getWorld()?.getActors(DribbleGameplayManager)[0]?.togglePause();
      return true;
    }
    return super.handleKeyDown(event);
  }

  public override beginFire(): boolean {
    this.getWorld()?.getActors(DribbleGameplayManager)[0]?.handleLeftClick();
    return true;
  }

  public override beginAltFire(): boolean {
    this.getWorld()?.getActors(DribbleGameplayManager)[0]?.handleRightClick();
    return true;
  }
}
