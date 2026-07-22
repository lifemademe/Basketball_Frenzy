import * as THREE from 'three';

export type DribbleVersusPacePhase = 'rally' | 'fast-break' | 'clutch' | 'sudden-death';

export interface DribbleVersusPacingState {
  phase: DribbleVersusPacePhase;
  paceBonus: number;
  spawnIntervalScale: number;
  pressureDurationScale: number;
  recoveryEnabled: boolean;
}

export class DribbleVersusPacingDirector {
  private elapsed = 0;
  private phase: DribbleVersusPacePhase = 'rally';

  public reset(): void {
    this.elapsed = 0;
    this.phase = 'rally';
  }

  public update(deltaTime: number, rally: number, round: number): DribbleVersusPacingState {
    this.elapsed += deltaTime;
    this.phase = this.elapsed >= 52
      ? 'sudden-death'
      : this.elapsed >= 34
        ? 'clutch'
        : this.elapsed >= 18
          ? 'fast-break'
          : 'rally';
    const phaseRank = this.phase === 'sudden-death' ? 3 : this.phase === 'clutch' ? 2 : this.phase === 'fast-break' ? 1 : 0;
    const rallyPressure = THREE.MathUtils.smoothstep(rally, 5, 18);
    const roundPressure = Math.min(0.08, Math.max(0, round - 1) * 0.015);
    return {
      phase: this.phase,
      paceBonus: phaseRank * 0.075 + rallyPressure * 0.06 + roundPressure,
      spawnIntervalScale: Math.max(0.68, 1 - phaseRank * 0.085 - rallyPressure * 0.08),
      pressureDurationScale: Math.max(0.7, 1 - phaseRank * 0.075),
      recoveryEnabled: phaseRank < 2,
    };
  }
}
