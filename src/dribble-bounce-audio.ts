import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import type { BallCosmetic } from './dribble-progression.js';

export type BallBounceStyle = BallCosmetic | 'gold';

interface BounceTone {
  type: OscillatorType;
  startFrequency: number;
  endFrequency: number;
  peakGain: number;
  duration: number;
  delay?: number;
}

export function playBasketballBounce(
  world: ENGINE.World | null | undefined,
  strength = 1,
  style: BallBounceStyle = 'classic',
): void {
  const listener = world?.audioListener;
  const context = listener?.context;
  if (!world || !listener || !context || context.state !== 'running') {
    return;
  }

  const impact = THREE.MathUtils.clamp(strength, 0.18, 1);
  const now = context.currentTime;
  const destination = world.globalAudioManager.getBus('SFX')?.getInput() ?? listener.getInput();
  for (const tone of getBounceTones(style, impact)) {
    playTone(context, destination, now, tone);
  }
}

function getBounceTones(style: BallBounceStyle, impact: number): BounceTone[] {
  const gain = THREE.MathUtils.lerp(0.045, 0.11, impact);
  if (style === 'blackhole') {
    return [
      { type: 'sine', startFrequency: 68, endFrequency: 31, peakGain: gain * 1.05, duration: 0.19 },
      { type: 'triangle', startFrequency: 145, endFrequency: 55, peakGain: gain * 0.24, duration: 0.14 },
    ];
  }
  if (style === 'disco') {
    return [
      { type: 'sine', startFrequency: 190, endFrequency: 92, peakGain: gain * 0.82, duration: 0.1 },
      { type: 'triangle', startFrequency: 660, endFrequency: 420, peakGain: gain * 0.22, duration: 0.09, delay: 0.012 },
    ];
  }
  if (style === 'epic') {
    return [
      { type: 'sine', startFrequency: 126, endFrequency: 54, peakGain: gain, duration: 0.115 },
      { type: 'triangle', startFrequency: 310, endFrequency: 135, peakGain: gain * 0.15, duration: 0.075 },
    ];
  }
  if (style === 'gold') {
    return [
      { type: 'sine', startFrequency: 118, endFrequency: 54, peakGain: gain, duration: 0.12 },
      { type: 'sine', startFrequency: 720, endFrequency: 470, peakGain: gain * 0.2, duration: 0.11, delay: 0.008 },
    ];
  }
  return [{
    type: 'sine',
    startFrequency: THREE.MathUtils.lerp(92, 112, impact),
    endFrequency: THREE.MathUtils.lerp(50, 58, impact),
    peakGain: gain,
    duration: 0.11,
  }];
}

function playTone(
  context: AudioContext,
  destination: AudioNode,
  now: number,
  tone: BounceTone,
): void {
  const start = now + (tone.delay ?? 0);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = tone.type;
  oscillator.frequency.setValueAtTime(tone.startFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, start + tone.duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(tone.peakGain, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(start);
  oscillator.stop(start + tone.duration + 0.01);
}
