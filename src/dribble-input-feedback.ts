import type { DribbleSide } from './dribble-ball.js';

export type DribbleHapticAction =
  | 'boost'
  | 'queued-boost'
  | 'queued-transfer'
  | 'transfer'
  | null;

interface DualRumbleActuator {
  playEffect(
    effect: 'dual-rumble',
    options: {
      duration: number;
      startDelay: number;
      strongMagnitude: number;
      weakMagnitude: number;
    },
  ): Promise<unknown>;
}

interface HapticGamepad {
  connected: boolean;
  vibrationActuator?: DualRumbleActuator;
}

export function playGamepadActionFeedback(
  gamepadIndex: number,
  side: DribbleSide,
  action: DribbleHapticAction,
): void {
  if (!action) return;
  const isPowerAction = action === 'boost' || action === 'queued-boost';
  playGamepadRumble(gamepadIndex, {
    duration: isPowerAction ? 76 : 42,
    strongMagnitude: side === 'right' ? isPowerAction ? 0.42 : 0.18 : 0.1,
    weakMagnitude: side === 'left' ? isPowerAction ? 0.46 : 0.22 : 0.12,
  });
}

export function playGamepadImpactFeedback(kind: 'score' | 'hazard' | 'frenzy'): void {
  const gamepadIndex = getFirstConnectedGamepadIndex();
  if (gamepadIndex < 0) return;
  const feedback = kind === 'hazard'
    ? { duration: 145, strongMagnitude: 0.72, weakMagnitude: 0.36 }
    : kind === 'frenzy'
      ? { duration: 110, strongMagnitude: 0.4, weakMagnitude: 0.44 }
      : { duration: 38, strongMagnitude: 0.08, weakMagnitude: 0.18 };
  playGamepadRumble(gamepadIndex, feedback);
  playDeviceVibration(kind === 'hazard' ? [28, 18, 42] : kind === 'frenzy' ? [18, 20, 24] : 8);
}

export function playGamepadUiFeedback(gamepadIndex: number, confirm = false): void {
  playGamepadRumble(gamepadIndex, {
    duration: confirm ? 45 : 24,
    strongMagnitude: confirm ? 0.14 : 0.04,
    weakMagnitude: confirm ? 0.24 : 0.12,
  });
}

function getFirstConnectedGamepadIndex(): number {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return -1;
  const gamepads = navigator.getGamepads();
  for (let index = 0; index < gamepads.length; index += 1) {
    if (gamepads[index]?.connected) return index;
  }
  return -1;
}

function playGamepadRumble(
  gamepadIndex: number,
  feedback: { duration: number; strongMagnitude: number; weakMagnitude: number },
): void {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
  const gamepad = navigator.getGamepads()[gamepadIndex] as HapticGamepad | null;
  const actuator = gamepad?.vibrationActuator;
  if (!actuator?.playEffect) return;
  void actuator.playEffect('dual-rumble', {
    duration: feedback.duration,
    startDelay: 0,
    strongMagnitude: feedback.strongMagnitude,
    weakMagnitude: feedback.weakMagnitude,
  }).catch(() => {});
}

function playDeviceVibration(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    if (localStorage.getItem('basketball-frenzy-reduced-motion') === 'true') return;
  } catch {
    // Haptics can still run when storage is unavailable.
  }
  navigator.vibrate(pattern);
}
