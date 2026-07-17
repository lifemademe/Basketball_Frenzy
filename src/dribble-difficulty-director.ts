import * as THREE from 'three';

import type { DribbleGameMode } from './dribble-main-menu.js';

export type DribbleIntensityTier = 'warmup' | 'flow' | 'heat' | 'overdrive';

export class DribbleDifficultyDirector {
  private mode: DribbleGameMode = 'normal';
  private momentum = 0;
  private recovery = 0;
  private intensity = 0;
  private tier: DribbleIntensityTier = 'warmup';

  public reset(mode: DribbleGameMode): void {
    this.mode = mode;
    this.momentum = 0;
    this.recovery = 0;
    this.intensity = mode === 'hard' ? 0.12 : 0;
    this.tier = 'warmup';
  }

  public update(deltaTime: number, baseDifficulty: number, combo: number, livesRatio: number): void {
    const comboPressure = THREE.MathUtils.smoothstep(combo, 3, 10) * 0.18;
    const survivalPressure = THREE.MathUtils.smoothstep(livesRatio, 0.35, 1) * 0.06;
    const target = THREE.MathUtils.clamp(
      baseDifficulty + this.momentum + comboPressure + survivalPressure - this.recovery,
      0,
      1,
    );
    const response = 1 - Math.exp(-deltaTime * (target > this.intensity ? 0.72 : 1.35));
    this.intensity = THREE.MathUtils.lerp(this.intensity, target, response);
    this.recovery = Math.max(0, this.recovery - deltaTime * 0.022);
    this.momentum = THREE.MathUtils.lerp(this.momentum, 0, 1 - Math.exp(-deltaTime * 0.08));
  }

  public recordSuccess(perfect = false): void {
    this.momentum = THREE.MathUtils.clamp(
      this.momentum + (perfect ? 0.026 : 0.012),
      -0.08,
      0.14,
    );
    this.recovery = Math.max(0, this.recovery - 0.012);
  }

  public recordFailure(severe = false): void {
    this.momentum = Math.max(-0.08, this.momentum - (severe ? 0.075 : 0.04));
    this.recovery = Math.min(0.18, this.recovery + (severe ? 0.11 : 0.065));
  }

  public getDifficulty(baseDifficulty: number): number {
    const modeFloor = this.mode === 'hard' ? 0.1 : 0;
    return THREE.MathUtils.clamp(
      Math.max(modeFloor, baseDifficulty + this.momentum - this.recovery),
      0,
      1,
    );
  }

  public getIntensity(): number {
    return this.intensity;
  }

  public getSpawnIntervalScale(): number {
    return THREE.MathUtils.lerp(1.04, 0.9, this.intensity);
  }

  public takeTierChange(): DribbleIntensityTier | null {
    const nextTier: DribbleIntensityTier = this.intensity >= 0.82
      ? 'overdrive'
      : this.intensity >= 0.56
        ? 'heat'
        : this.intensity >= 0.24
          ? 'flow'
          : 'warmup';
    if (nextTier === this.tier) return null;
    const previousTier = this.tier;
    this.tier = nextTier;
    return this.getTierRank(nextTier) > this.getTierRank(previousTier) ? nextTier : null;
  }

  private getTierRank(tier: DribbleIntensityTier): number {
    if (tier === 'overdrive') return 3;
    if (tier === 'heat') return 2;
    if (tier === 'flow') return 1;
    return 0;
  }
}
