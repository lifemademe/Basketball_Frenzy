import * as ENGINE from '@gnsx/genesys.js';

export type DribbleFeedbackSound = 'score' | 'perfect' | 'star' | 'hazard' | 'frenzy' | 'round-win';
export type DribbleEventCue = 'frenzy-start' | 'mode-start';

const eventCuePaths: Readonly<Record<DribbleEventCue, string>> = {
  'frenzy-start': '@project/assets/audio/againagain.wav',
  'mode-start': '@project/assets/audio/letsgo.wav',
};

const eventCueVolumes: Readonly<Record<DribbleEventCue, number>> = {
  'frenzy-start': 0.48,
  'mode-start': 0.62,
};

interface FeedbackTone {
  frequency: number;
  endFrequency: number;
  delay: number;
  duration: number;
  gain: number;
  type: OscillatorType;
}

const feedbackTones: Readonly<Record<DribbleFeedbackSound, readonly FeedbackTone[]>> = {
  score: [{ frequency: 520, endFrequency: 640, delay: 0, duration: 0.09, gain: 0.022, type: 'sine' }],
  perfect: [
    { frequency: 660, endFrequency: 780, delay: 0, duration: 0.13, gain: 0.032, type: 'sine' },
    { frequency: 990, endFrequency: 1180, delay: 0.035, duration: 0.14, gain: 0.024, type: 'triangle' },
  ],
  star: [
    { frequency: 740, endFrequency: 880, delay: 0, duration: 0.14, gain: 0.034, type: 'sine' },
    { frequency: 1110, endFrequency: 1320, delay: 0.045, duration: 0.17, gain: 0.026, type: 'sine' },
  ],
  hazard: [
    { frequency: 124, endFrequency: 48, delay: 0, duration: 0.2, gain: 0.05, type: 'sawtooth' },
    { frequency: 74, endFrequency: 42, delay: 0.018, duration: 0.24, gain: 0.038, type: 'sine' },
  ],
  frenzy: [
    { frequency: 392, endFrequency: 520, delay: 0, duration: 0.18, gain: 0.03, type: 'triangle' },
    { frequency: 523, endFrequency: 698, delay: 0.06, duration: 0.2, gain: 0.03, type: 'triangle' },
    { frequency: 659, endFrequency: 988, delay: 0.12, duration: 0.24, gain: 0.032, type: 'sine' },
  ],
  'round-win': [
    { frequency: 440, endFrequency: 660, delay: 0, duration: 0.18, gain: 0.03, type: 'triangle' },
    { frequency: 660, endFrequency: 880, delay: 0.08, duration: 0.2, gain: 0.032, type: 'sine' },
  ],
};

export function preloadDribbleEventAudio(world: ENGINE.World): void {
  const manager = world.globalAudioManager;
  void Promise.all(Object.values(eventCuePaths).map(path => manager.loadSound(path, path)))
    .catch(error => console.warn('Could not preload Basketball Frenzy event audio', error));
}

export function playDribbleEventCue(
  world: ENGINE.World | null | undefined,
  cue: DribbleEventCue,
): void {
  if (!world) return;
  void world.globalAudioManager.playGlobalSound(eventCuePaths[cue], {
    bus: 'SFX',
    volume: eventCueVolumes[cue],
  });
}

export function playDribbleFeedback(
  world: ENGINE.World | null | undefined,
  sound: DribbleFeedbackSound,
): void {
  const context = world?.audioListener?.context;
  const listener = world?.audioListener;
  if (!world || !context || !listener || context.state !== 'running') return;
  const destination = world.globalAudioManager.getBus('SFX')?.getInput() ?? listener.getInput();
  const now = context.currentTime;
  for (const tone of feedbackTones[sound]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + tone.delay;
    const pitchVariation = 1 + (Math.random() - 0.5) * 0.018;
    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.frequency * pitchVariation, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      tone.endFrequency * pitchVariation,
      start + tone.duration,
    );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(tone.gain, start + 0.008);
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
}
