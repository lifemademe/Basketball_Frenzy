import * as ENGINE from '@gnsx/genesys.js';

type MusicState = 'menu' | 'gameplay' | 'none';

const menuMusicPath = '@project/assets/audio/733259__jadis0x__simple-video-game-music-loop (1).wav';
const gameplayMusicPath = '@project/assets/audio/251461__joshuaempyre__arcade-music-loop.wav';

export class DribbleMusicDirector {
  private state: MusicState = 'none';
  private handle: ENGINE.SoundHandle | null = null;
  private transitionToken = 0;
  private musicVolume = 0.55;
  private paused = false;
  private intensity = 0;
  private calloutDuck = 1;
  private calloutDuckTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(private readonly world: ENGINE.World) {}

  public preload(): void {
    const manager = this.world.globalAudioManager;
    void Promise.all([
      manager.loadSound(menuMusicPath, menuMusicPath),
      manager.loadSound(gameplayMusicPath, gameplayMusicPath),
    ]).catch(error => console.warn('Could not preload Basketball Frenzy music', error));
  }

  public setState(state: MusicState): void {
    if (this.state === state && this.handle) {
      this.paused = false;
      this.applyBusVolume(0.18);
      return;
    }
    this.state = state;
    this.paused = false;
    const token = ++this.transitionToken;
    void this.transitionTo(state, token);
  }

  public setVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.applyBusVolume(0.12);
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    this.applyBusVolume(0.18);
  }

  public setIntensity(intensity: number): void {
    const nextIntensity = Math.max(0, Math.min(1, intensity));
    if (Math.abs(nextIntensity - this.intensity) < 0.025) return;
    this.intensity = nextIntensity;
    this.applyBusVolume(0.16);
  }

  public duckForCallout(durationSeconds = 1.15): void {
    if (this.calloutDuckTimer) clearTimeout(this.calloutDuckTimer);
    this.calloutDuck = 0.72;
    this.applyBusVolume(0.06);
    this.calloutDuckTimer = setTimeout(() => {
      this.calloutDuck = 1;
      this.calloutDuckTimer = null;
      this.applyBusVolume(0.28);
    }, Math.max(0, durationSeconds) * 1000);
  }

  public stop(): void {
    this.state = 'none';
    this.transitionToken += 1;
    if (this.calloutDuckTimer) {
      clearTimeout(this.calloutDuckTimer);
      this.calloutDuckTimer = null;
    }
    this.calloutDuck = 1;
    if (this.handle) this.world.globalAudioManager.stopSound(this.handle);
    this.handle = null;
  }

  private async transitionTo(state: MusicState, token: number): Promise<void> {
    const manager = this.world.globalAudioManager;
    if (this.handle) {
      this.setBusVolume(0, 0.16);
      await this.delay(175);
      if (token !== this.transitionToken) return;
      manager.stopSound(this.handle);
      this.handle = null;
    }
    if (state === 'none' || token !== this.transitionToken) return;

    this.setBusVolume(0);
    const path = state === 'menu' ? menuMusicPath : gameplayMusicPath;
    const trackVolume = state === 'menu' ? 0.62 : 0.45;
    const handle = await manager.playGlobalSound(path, {
      bus: 'Music',
      loop: true,
      volume: trackVolume,
    });
    if (token !== this.transitionToken) {
      if (handle) manager.stopSound(handle);
      return;
    }
    this.handle = handle;
    this.applyBusVolume(0.34);
  }

  private applyBusVolume(rampSeconds = 0): void {
    const ducking = this.paused ? 0.38 : 1;
    const intensityLift = this.state === 'gameplay'
      ? 0.9 + this.intensity * 0.1
      : 1;
    this.setBusVolume(this.musicVolume * ducking * intensityLift * this.calloutDuck, rampSeconds);
  }

  private setBusVolume(volume: number, rampSeconds = 0): void {
    const bus = this.world.globalAudioManager.getBus('Music');
    if (!bus) return;
    if (rampSeconds <= 0) {
      bus.setVolume(volume);
      return;
    }
    const context = this.world.audioListener?.context;
    if (context) bus.setVolume(volume, context.currentTime + rampSeconds);
    else bus.setVolume(volume);
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
  }
}
