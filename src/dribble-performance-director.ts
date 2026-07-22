import * as THREE from 'three';

export type DribbleQualityTier = 'high' | 'balanced' | 'performance';

export interface DribblePerformanceChange {
  previous: DribbleQualityTier;
  current: DribbleQualityTier;
  averageFps: number;
  changed: boolean;
}

export class DribblePerformanceDirector {
  private tier: DribbleQualityTier = this.detectInitialTier();
  private sampleTime = 0;
  private sampledFrames = 0;
  private slowFrameCount = 0;
  private healthyTime = 0;
  private presentationAccumulator = 0;

  public reset(): void {
    this.sampleTime = 0;
    this.sampledFrames = 0;
    this.slowFrameCount = 0;
    this.healthyTime = 0;
    this.presentationAccumulator = 0;
  }

  public update(deltaTime: number): DribblePerformanceChange | null {
    const safeDelta = THREE.MathUtils.clamp(deltaTime, 0, 0.15);
    this.sampleTime += safeDelta;
    this.sampledFrames += 1;
    if (safeDelta >= 1 / 28) this.slowFrameCount += 1;
    if (this.sampleTime < 2) return null;

    const averageFps = this.sampledFrames / Math.max(0.001, this.sampleTime);
    const slowRatio = this.slowFrameCount / Math.max(1, this.sampledFrames);
    const previous = this.tier;
    if (averageFps < 32 || slowRatio > 0.42) {
      this.tier = this.tier === 'high' ? 'balanced' : 'performance';
      this.healthyTime = 0;
    } else if (averageFps >= 57 && slowRatio < 0.08) {
      this.healthyTime += this.sampleTime;
      if (this.healthyTime >= 10) {
        this.tier = this.tier === 'performance' ? 'balanced' : 'high';
        this.healthyTime = 0;
      }
    } else {
      this.healthyTime = Math.max(0, this.healthyTime - this.sampleTime * 0.5);
    }

    this.sampleTime = 0;
    this.sampledFrames = 0;
    this.slowFrameCount = 0;
    return {
      previous,
      current: this.tier,
      averageFps,
      changed: previous !== this.tier,
    };
  }

  public consumePresentationDelta(deltaTime: number): number {
    this.presentationAccumulator += deltaTime;
    const interval = this.tier === 'high' ? 0 : this.tier === 'balanced' ? 1 / 45 : 1 / 30;
    if (interval > 0 && this.presentationAccumulator < interval) return 0;
    const accumulated = this.presentationAccumulator;
    this.presentationAccumulator = 0;
    return accumulated;
  }

  public getTier(): DribbleQualityTier {
    return this.tier;
  }

  public getPixelRatioCap(): number {
    return this.tier === 'high' ? 1 : this.tier === 'balanced' ? 0.9 : 0.75;
  }

  private detectInitialTier(): DribbleQualityTier {
    if (typeof navigator === 'undefined') return 'balanced';
    const device = navigator as Navigator & { deviceMemory?: number };
    const memory = device.deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency ?? 8;
    const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (memory <= 4 || cores <= 4) return 'performance';
    if (coarsePointer || memory <= 6 || cores <= 6) return 'balanced';
    return 'high';
  }
}
