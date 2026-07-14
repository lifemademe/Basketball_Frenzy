/**
 * First person game template - first-person exploration mode.
 */

import * as ENGINE from '@gnsx/genesys.js';

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
}

class FirstPersonGame extends ENGINE.BaseGameLoop {
}

export function main(container: HTMLElement, options?: Partial<ENGINE.BaseGameLoopOptions>): ENGINE.IGameLoop {
  const mergedOptions: Partial<ENGINE.BaseGameLoopOptions> = {
    ...options,
    defaultGameModeClass: FirstPersonGameMode,
  };
  const game = new FirstPersonGame(container, mergedOptions);
  return game;
}
