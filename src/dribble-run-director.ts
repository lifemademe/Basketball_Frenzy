import * as THREE from 'three';

import type { DribbleGameMode } from './dribble-main-menu.js';

export type DribbleRunModifierId = 'quick-court' | 'hazard-zone' | 'hot-streak';
export type DribbleRunPhase = 'warmup' | 'rhythm' | 'pressure' | 'star-window' | 'recovery';

export interface DribbleRunModifier {
  id: DribbleRunModifierId;
  label: string;
  shortLabel: string;
  speedScale: number;
  hazardChanceDelta: number;
  scoreScale: number;
}

export interface DribbleRunPhaseTuning {
  phase: DribbleRunPhase;
  speedScale: number;
  spawnIntervalScale: number;
  hazardChanceDelta: number;
  bonusChanceScale: number;
}

const modifiers: readonly DribbleRunModifier[] = [
  {
    id: 'quick-court',
    label: 'Quick Court',
    shortLabel: 'QUICK COURT · SCORE +8%',
    speedScale: 1.07,
    hazardChanceDelta: 0,
    scoreScale: 1.08,
  },
  {
    id: 'hazard-zone',
    label: 'Hazard Zone',
    shortLabel: 'HAZARD ZONE · SCORE +12%',
    speedScale: 1.02,
    hazardChanceDelta: 0.055,
    scoreScale: 1.12,
  },
  {
    id: 'hot-streak',
    label: 'Hot Streak',
    shortLabel: 'HOT STREAK · SCORE +15%',
    speedScale: 1,
    hazardChanceDelta: 0,
    scoreScale: 1.15,
  },
];

export class DribbleRunDirector {
  private modifier: DribbleRunModifier = modifiers[0];

  public start(mode: DribbleGameMode, rotationSeed: number): void {
    if (mode === 'last-bounce') {
      this.modifier = modifiers[0];
      return;
    }
    const modeOffset = mode === 'hard' ? 1 : 0;
    this.modifier = modifiers[(Math.abs(rotationSeed) + modeOffset) % modifiers.length];
  }

  public getModifier(): DribbleRunModifier {
    return this.modifier;
  }

  public getPhase(elapsedSeconds: number): DribbleRunPhaseTuning {
    if (elapsedSeconds < 10) {
      return {
        phase: 'warmup',
        speedScale: 0.94,
        spawnIntervalScale: 1.08,
        hazardChanceDelta: -0.06,
        bonusChanceScale: 0.65,
      };
    }

    const cycleTime = (elapsedSeconds - 10) % 60;
    if (cycleTime < 18) {
      return {
        phase: 'rhythm',
        speedScale: 1,
        spawnIntervalScale: 1,
        hazardChanceDelta: -0.015,
        bonusChanceScale: 0.9,
      };
    }
    if (cycleTime < 38) {
      return {
        phase: 'pressure',
        speedScale: 1.07,
        spawnIntervalScale: 0.92,
        hazardChanceDelta: 0.045,
        bonusChanceScale: 0.75,
      };
    }
    if (cycleTime < 50) {
      return {
        phase: 'star-window',
        speedScale: 1.02,
        spawnIntervalScale: 0.98,
        hazardChanceDelta: -0.025,
        bonusChanceScale: 1.65,
      };
    }
    return {
      phase: 'recovery',
      speedScale: 0.96,
      spawnIntervalScale: 1.1,
      hazardChanceDelta: -0.075,
      bonusChanceScale: 0.65,
    };
  }

  public scaleScore(points: number): number {
    return Math.max(1, Math.round(points * this.modifier.scoreScale / 5) * 5);
  }

  public getHazardChance(baseChance: number, elapsedSeconds: number): number {
    const phase = this.getPhase(elapsedSeconds);
    return THREE.MathUtils.clamp(
      baseChance + this.modifier.hazardChanceDelta + phase.hazardChanceDelta,
      0.48,
      0.82,
    );
  }
}
