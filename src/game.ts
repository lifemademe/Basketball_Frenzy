/**
 * First person game template - first-person exploration mode.
 */

import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { showDribbleBootScreen } from './dribble-boot-screen.js';
import { DribbleGameplayManager } from './dribble-gameplay.js';
import { FirstPersonPlayer, FirstPersonPlayerController } from './player.js';

@ENGINE.GameClass()
class FirstPersonGameMode extends ENGINE.GameMode {
  constructor() {
    super();
  }

  public override initialize(options?: ENGINE.GameModeOptions): void {
    super.initialize({
      ...options,
      pawnFactory: async () => FirstPersonPlayer.create(),
      playerControllerFactory: async () => FirstPersonPlayerController.create(),
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
  showDribbleBootScreen(container);
  container.addEventListener('contextmenu', event => event.preventDefault());
  const screenPercentage = ENGINE.CVarManager.getValue('r.ScreenPercentage', 100);
  if (screenPercentage === 100 && window.devicePixelRatio > 1) {
    // Avoid multiplying the full post-process stack by the browser's display scaling.
    ENGINE.CVarManager.setValue('r.ScreenPercentage', 99);
  }
  const mergedOptions: Partial<ENGINE.BaseGameLoopOptions> = {
    ...options,
    defaultGameModeClass: FirstPersonGameMode,
  };
  const game = new FirstPersonGame(container, mergedOptions);
  return game;
}
