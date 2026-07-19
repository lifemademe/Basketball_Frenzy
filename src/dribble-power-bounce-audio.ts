import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import type { BallCosmetic } from './dribble-progression.js';

type SpinStyle = BallCosmetic | 'gold';

interface SpinMix {
  filterFrequency: number;
  playbackRate: number;
  volume: number;
}

const spinMix: Readonly<Record<SpinStyle, SpinMix>> = {
  classic: { filterFrequency: 380, playbackRate: 1, volume: 0.075 },
  epic: { filterFrequency: 520, playbackRate: 1.08, volume: 0.07 },
  disco: { filterFrequency: 680, playbackRate: 1.16, volume: 0.068 },
  blackhole: { filterFrequency: 220, playbackRate: 0.78, volume: 0.085 },
  gold: { filterFrequency: 560, playbackRate: 1.12, volume: 0.075 },
};

const spinBuffers = new WeakMap<AudioContext, AudioBuffer>();

export class PowerBounceSpinAudio {
  private source: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private panner: StereoPannerNode | null = null;

  public update(
    world: ENGINE.World | null | undefined,
    airborneProgress: number,
    style: SpinStyle,
    horizontalPosition: number,
  ): void {
    const progress = THREE.MathUtils.clamp(airborneProgress, 0, 1);
    if (progress <= 0 || progress >= 1) {
      this.stop();
      return;
    }

    const listener = world?.audioListener;
    const context = listener?.context;
    if (!world || !listener || !context || context.state !== 'running') return;
    if (!this.source) {
      const destination = world.globalAudioManager.getBus('SFX')?.getInput()
        ?? listener.getInput();
      this.start(context, destination, style);
    }
    if (!this.source || !this.filter || !this.gain || !this.panner) return;

    const mix = spinMix[style];
    const now = context.currentTime;
    const fadeIn = THREE.MathUtils.smoothstep(progress, 0, 0.1);
    const fadeOut = 1 - THREE.MathUtils.smoothstep(progress, 0.82, 1);
    const verticalSpeed = Math.abs(Math.cos(progress * Math.PI));
    const apexSoftening = THREE.MathUtils.lerp(0.76, 1, verticalSpeed);
    const targetGain = mix.volume * fadeIn * fadeOut * apexSoftening;
    const rate = mix.playbackRate * THREE.MathUtils.lerp(0.92, 1.08, verticalSpeed);
    const frequency = mix.filterFrequency * THREE.MathUtils.lerp(0.86, 1.12, verticalSpeed);

    this.gain.gain.setTargetAtTime(Math.max(0.0001, targetGain), now, 0.018);
    this.source.playbackRate.setTargetAtTime(rate, now, 0.025);
    this.filter.frequency.setTargetAtTime(frequency, now, 0.025);
    this.panner.pan.setTargetAtTime(
      THREE.MathUtils.clamp(horizontalPosition * 0.18, -0.24, 0.24),
      now,
      0.025,
    );
  }

  public stop(fadeDuration = 0.07): void {
    const source = this.source;
    const gain = this.gain;
    if (!source || !gain) return;

    const now = source.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeDuration);
    source.stop(now + fadeDuration + 0.01);
    this.source = null;
    this.filter = null;
    this.gain = null;
    this.panner = null;
  }

  private start(context: AudioContext, destination: AudioNode, style: SpinStyle): void {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    const mix = spinMix[style];

    source.buffer = getSpinBuffer(context);
    source.loop = true;
    source.playbackRate.value = mix.playbackRate;
    filter.type = 'highpass';
    filter.frequency.value = mix.filterFrequency;
    filter.Q.value = style === 'blackhole' ? 0.35 : 0.5;
    gain.gain.value = 0.0001;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(destination);

    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
    source.start();
    this.source = source;
    this.filter = filter;
    this.gain = gain;
    this.panner = panner;
  }
}

function getSpinBuffer(context: AudioContext): AudioBuffer {
  const cached = spinBuffers.get(context);
  if (cached) return cached;

  const duration = 0.28;
  const frameCount = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  let smoothedNoise = 0;
  let seed = 0x6d2b79f5;
  for (let index = 0; index < frameCount; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const whiteNoise = (seed / 0xffffffff) * 2 - 1;
    smoothedNoise += (whiteNoise - smoothedNoise) * 0.16;
    const phase = index / frameCount;
    const rotationPulse = 0.18 + Math.pow(Math.sin(phase * Math.PI * 2), 2) * 0.82;
    samples[index] = (whiteNoise * 0.42 + smoothedNoise * 0.58) * rotationPulse;
  }
  spinBuffers.set(context, buffer);
  return buffer;
}
