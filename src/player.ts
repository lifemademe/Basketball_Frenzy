/**
 * First person player pawn - hides character mesh, camera at eye level.
 */

import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

@ENGINE.GameClass()
export class FirstPersonPlayer extends ENGINE.CharacterPawn {
  protected override getInitialCameraPositions(): {
    pivotPosition: THREE.Vector3;
    cameraPosition: THREE.Vector3;
    } {
    const cameraPosition = new THREE.Vector3(0, ENGINE.CHARACTER_HEIGHT * 0.4, 0);
    return {
      pivotPosition: cameraPosition,
      cameraPosition: cameraPosition,
    };
  }

  protected override setupAnimationComponent(): ENGINE.AnimationStateMachineComponent | null {
    return null;
  }

  protected override setupVisualComponent(): ENGINE.SceneComponent | null {
    return null;
  }
}
