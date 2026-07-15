import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

export function playBasketballBounce(world: ENGINE.World | null | undefined, strength = 1): void {
  const listener = world?.audioListener;
  const context = listener?.context;
  if (!world || !listener || !context || context.state !== 'running') {
    return;
  }

  const impact = THREE.MathUtils.clamp(strength, 0.18, 1);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(THREE.MathUtils.lerp(92, 112, impact), now);
  oscillator.frequency.exponentialRampToValueAtTime(THREE.MathUtils.lerp(50, 58, impact), now + 0.1);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(THREE.MathUtils.lerp(0.045, 0.11, impact), now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
  oscillator.connect(gain);
  gain.connect(world.globalAudioManager.getBus('SFX')?.getInput() ?? listener.getInput());
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(now);
  oscillator.stop(now + 0.12);
}
