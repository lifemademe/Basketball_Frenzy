/**
 * First person game template - first-person exploration mode.
 */

import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { DribbleGameplayManager } from './dribble-gameplay.js';
import { FirstPersonPlayer } from './player.js';

@ENGINE.GameClass()
class FirstPersonGameMode extends ENGINE.GameMode {
  constructor() {
    super();
  }

  public override initialize(options?: ENGINE.GameModeOptions): void {
    super.initialize({
      ...options,
      pawnFactory: async () => FirstPersonPlayer.create(),
    });
  }

  public override async restartPlayerAtPlayerStart(
    controller: ENGINE.PlayerController,
    playerStart: ENGINE.PlayerStart,
  ): Promise<void> {
    await super.restartPlayerAtPlayerStart(controller, playerStart);
    const pawn = controller.getPawn();
    if (pawn) {
      pawn.setWorldPosition(new THREE.Vector3(0, 0.65, 1.2));
      pawn.setWorldRotation(new THREE.Euler(0, 0, 0));
    }
  }

  protected override doBeginPlay(): void {
    super.doBeginPlay();
    if (!this.getWorld()?.getActors(DribbleGameplayManager).length) {
      this.getWorld()?.addActor(DribbleGameplayManager.create({ name: 'Dribble Gameplay Manager' }));
    }
  }
}

class FirstPersonGame extends ENGINE.BaseGameLoop {
}

export function main(container: HTMLElement, options?: Partial<ENGINE.BaseGameLoopOptions>): ENGINE.IGameLoop {
  container.addEventListener('contextmenu', event => event.preventDefault());
  const mergedOptions: Partial<ENGINE.BaseGameLoopOptions> = {
    ...options,
    defaultGameModeClass: FirstPersonGameMode,
  };
  const game = new FirstPersonGame(container, mergedOptions);
  return game;
}
