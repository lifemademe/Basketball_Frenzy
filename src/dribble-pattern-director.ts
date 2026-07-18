import * as THREE from 'three';

import type { DribbleGameMode } from './dribble-main-menu.js';
import type { TargetKind } from './dribble-target.js';

export type PatternLane = 'left' | 'center' | 'right';
export type PatternHeight = 'low' | 'normal' | 'high';

export interface DribblePatternStep {
  kind: Extract<TargetKind, 'score' | 'hazard'>;
  lane: PatternLane;
  height?: PatternHeight;
  intervalScale?: number;
  speedScale?: number;
}

export interface DirectedPatternStep extends DribblePatternStep {
  patternId: string;
  patternLabel: string;
  startsPattern: boolean;
}

interface DribblePatternDefinition {
  id: string;
  label: string;
  minDifficulty: number;
  weight: number;
  modes?: readonly DribbleGameMode[];
  steps: readonly DribblePatternStep[];
}

const patterns: readonly DribblePatternDefinition[] = [
  {
    id: 'lane-sweep',
    label: 'LANE SWEEP',
    minDifficulty: 0,
    weight: 1.2,
    steps: [
      { kind: 'score', lane: 'left' },
      { kind: 'hazard', lane: 'center', height: 'low', intervalScale: 0.96 },
      { kind: 'score', lane: 'right', intervalScale: 0.94 },
      { kind: 'hazard', lane: 'center', height: 'low', intervalScale: 0.92 },
      { kind: 'score', lane: 'left', intervalScale: 0.94 },
    ],
  },
  {
    id: 'cross-court',
    label: 'CROSS COURT',
    minDifficulty: 0.08,
    weight: 1,
    steps: [
      { kind: 'score', lane: 'left' },
      { kind: 'score', lane: 'right', intervalScale: 0.92 },
      { kind: 'hazard', lane: 'center', height: 'low', intervalScale: 0.9 },
      { kind: 'score', lane: 'left', intervalScale: 0.92 },
      { kind: 'score', lane: 'right', intervalScale: 0.9 },
    ],
  },
  {
    id: 'high-road',
    label: 'HIGH ROAD',
    minDifficulty: 0.16,
    weight: 1.1,
    steps: [
      { kind: 'hazard', lane: 'left', height: 'low' },
      { kind: 'score', lane: 'left', intervalScale: 0.9 },
      { kind: 'hazard', lane: 'right', height: 'low', intervalScale: 0.92 },
      { kind: 'score', lane: 'right', intervalScale: 0.88 },
    ],
  },
  {
    id: 'center-lock',
    label: 'CENTER LOCK',
    minDifficulty: 0.28,
    weight: 0.9,
    steps: [
      { kind: 'hazard', lane: 'center', height: 'low' },
      { kind: 'score', lane: 'left', intervalScale: 0.9 },
      { kind: 'hazard', lane: 'center', height: 'low', intervalScale: 0.88 },
      { kind: 'score', lane: 'right', intervalScale: 0.88 },
      { kind: 'hazard', lane: 'center', height: 'low', intervalScale: 0.86 },
    ],
  },
  {
    id: 'switchback',
    label: 'SWITCHBACK',
    minDifficulty: 0.42,
    weight: 0.75,
    steps: [
      { kind: 'score', lane: 'left', speedScale: 1.02 },
      { kind: 'hazard', lane: 'left', height: 'low', intervalScale: 0.88 },
      { kind: 'score', lane: 'right', intervalScale: 0.86, speedScale: 1.02 },
      { kind: 'hazard', lane: 'right', height: 'low', intervalScale: 0.86 },
      { kind: 'score', lane: 'center', intervalScale: 0.9 },
      { kind: 'hazard', lane: 'center', height: 'low', intervalScale: 0.84 },
    ],
  },
  {
    id: 'give-and-go',
    label: 'GIVE & GO',
    minDifficulty: 0.34,
    weight: 0.82,
    steps: [
      { kind: 'score', lane: 'center' },
      { kind: 'hazard', lane: 'left', height: 'low', intervalScale: 0.92 },
      { kind: 'score', lane: 'right', intervalScale: 0.86, speedScale: 1.02 },
      { kind: 'hazard', lane: 'right', height: 'low', intervalScale: 0.84 },
      { kind: 'score', lane: 'center', intervalScale: 0.9 },
    ],
  },
  {
    id: 'split-decision',
    label: 'SPLIT DECISION',
    minDifficulty: 0.56,
    weight: 0.7,
    steps: [
      { kind: 'hazard', lane: 'left', height: 'low' },
      { kind: 'hazard', lane: 'right', height: 'low', intervalScale: 0.9 },
      { kind: 'score', lane: 'center', intervalScale: 0.88, speedScale: 1.03 },
      { kind: 'hazard', lane: 'center', height: 'low', intervalScale: 0.84 },
      { kind: 'score', lane: 'left', intervalScale: 0.9 },
      { kind: 'score', lane: 'right', intervalScale: 0.86 },
    ],
  },
  {
    id: 'power-play',
    label: 'POWER PLAY',
    minDifficulty: 0.68,
    weight: 0.58,
    steps: [
      { kind: 'hazard', lane: 'left', height: 'low', speedScale: 1.04 },
      { kind: 'score', lane: 'left', intervalScale: 0.82 },
      { kind: 'hazard', lane: 'center', height: 'low', intervalScale: 0.86 },
      { kind: 'hazard', lane: 'right', height: 'low', intervalScale: 0.82, speedScale: 1.04 },
      { kind: 'score', lane: 'right', intervalScale: 0.82 },
    ],
  },
  {
    id: 'rhythm-ladder',
    label: 'RHYTHM LADDER',
    minDifficulty: 0.18,
    weight: 0.94,
    steps: [
      { kind: 'score', lane: 'left' },
      { kind: 'score', lane: 'center', intervalScale: 0.92 },
      { kind: 'score', lane: 'right', intervalScale: 0.9 },
      { kind: 'hazard', lane: 'right', height: 'low', intervalScale: 0.86 },
      { kind: 'score', lane: 'center', intervalScale: 0.9 },
      { kind: 'hazard', lane: 'left', height: 'low', intervalScale: 0.86 },
    ],
  },
  {
    id: 'pump-fake',
    label: 'PUMP FAKE',
    minDifficulty: 0.38,
    weight: 0.78,
    steps: [
      { kind: 'hazard', lane: 'left', height: 'high' },
      { kind: 'score', lane: 'right', intervalScale: 0.92 },
      { kind: 'hazard', lane: 'right', height: 'low', intervalScale: 0.86 },
      { kind: 'score', lane: 'center', intervalScale: 0.9 },
      { kind: 'hazard', lane: 'left', height: 'low', intervalScale: 0.86 },
    ],
  },
  {
    id: 'clutch-window',
    label: 'CLUTCH WINDOW',
    minDifficulty: 0.58,
    weight: 0.66,
    steps: [
      { kind: 'hazard', lane: 'center', height: 'low', speedScale: 1.03 },
      { kind: 'score', lane: 'left', intervalScale: 0.82 },
      { kind: 'hazard', lane: 'left', height: 'low', intervalScale: 0.8 },
      { kind: 'score', lane: 'right', intervalScale: 0.82, speedScale: 1.04 },
      { kind: 'hazard', lane: 'right', height: 'high', intervalScale: 0.8 },
      { kind: 'score', lane: 'center', intervalScale: 0.86 },
    ],
  },
  {
    id: 'hard-crossfire',
    label: 'CROSSFIRE',
    minDifficulty: 0.18,
    weight: 1.05,
    modes: ['hard'],
    steps: [
      { kind: 'hazard', lane: 'left', height: 'low' },
      { kind: 'score', lane: 'right', intervalScale: 0.84 },
      { kind: 'hazard', lane: 'center', height: 'low', intervalScale: 0.82 },
      { kind: 'score', lane: 'left', intervalScale: 0.84 },
      { kind: 'hazard', lane: 'right', height: 'low', intervalScale: 0.8 },
      { kind: 'score', lane: 'center', intervalScale: 0.86 },
    ],
  },
  {
    id: 'hard-overtime-press',
    label: 'OVERTIME PRESS',
    minDifficulty: 0.78,
    weight: 0.64,
    modes: ['hard'],
    steps: [
      { kind: 'hazard', lane: 'left', height: 'low', speedScale: 1.06 },
      { kind: 'hazard', lane: 'center', height: 'high', intervalScale: 0.76 },
      { kind: 'score', lane: 'right', intervalScale: 0.76, speedScale: 1.06 },
      { kind: 'hazard', lane: 'right', height: 'low', intervalScale: 0.74 },
      { kind: 'score', lane: 'left', intervalScale: 0.76, speedScale: 1.07 },
      { kind: 'hazard', lane: 'center', height: 'low', intervalScale: 0.74 },
    ],
  },
  {
    id: 'hard-pressure-line',
    label: 'PRESSURE LINE',
    minDifficulty: 0.48,
    weight: 0.8,
    modes: ['hard'],
    steps: [
      { kind: 'score', lane: 'center', speedScale: 1.03 },
      { kind: 'hazard', lane: 'left', height: 'low', intervalScale: 0.8 },
      { kind: 'hazard', lane: 'right', height: 'low', intervalScale: 0.82 },
      { kind: 'score', lane: 'left', intervalScale: 0.84, speedScale: 1.03 },
      { kind: 'hazard', lane: 'center', height: 'low', intervalScale: 0.8 },
      { kind: 'score', lane: 'right', intervalScale: 0.84, speedScale: 1.03 },
    ],
  },
  {
    id: 'hard-double-bind',
    label: 'DOUBLE BIND',
    minDifficulty: 0.34,
    weight: 0.95,
    modes: ['hard'],
    steps: [
      { kind: 'hazard', lane: 'left', height: 'low' },
      { kind: 'score', lane: 'left', intervalScale: 0.8 },
      { kind: 'hazard', lane: 'right', height: 'low', intervalScale: 0.78 },
      { kind: 'score', lane: 'center', intervalScale: 0.82, speedScale: 1.04 },
      { kind: 'hazard', lane: 'center', height: 'low', intervalScale: 0.78 },
      { kind: 'score', lane: 'right', intervalScale: 0.82 },
    ],
  },
  {
    id: 'hard-three-point-press',
    label: 'THREE-POINT PRESS',
    minDifficulty: 0.66,
    weight: 0.78,
    modes: ['hard'],
    steps: [
      { kind: 'hazard', lane: 'center', height: 'low', speedScale: 1.05 },
      { kind: 'score', lane: 'right', intervalScale: 0.78 },
      { kind: 'hazard', lane: 'right', height: 'low', intervalScale: 0.76 },
      { kind: 'score', lane: 'left', intervalScale: 0.78, speedScale: 1.05 },
      { kind: 'hazard', lane: 'left', height: 'low', intervalScale: 0.76 },
      { kind: 'score', lane: 'center', intervalScale: 0.8, speedScale: 1.06 },
    ],
  },
];

export class DribblePatternDirector {
  private activePattern: DribblePatternDefinition | null = null;
  private activeStepIndex = 0;
  private randomSpawnsRemaining = 6;
  private lastPatternId = '';

  public reset(mode: DribbleGameMode): void {
    this.activePattern = null;
    this.activeStepIndex = 0;
    this.lastPatternId = '';
    this.randomSpawnsRemaining = mode === 'hard' ? 4 : 6;
  }

  public cancel(): void {
    this.activePattern = null;
    this.activeStepIndex = 0;
    this.randomSpawnsRemaining = Math.max(this.randomSpawnsRemaining, 3);
  }

  public isActive(): boolean {
    return this.activePattern !== null;
  }

  public recordUnscriptedSpawn(): void {
    if (!this.activePattern) {
      this.randomSpawnsRemaining = Math.max(0, this.randomSpawnsRemaining - 1);
    }
  }

  public takeStep(options: {
    difficulty: number;
    elapsedTime: number;
    activeTargetCount: number;
    mode: DribbleGameMode;
  }): DirectedPatternStep | null {
    if (!this.activePattern) {
      if (
        this.randomSpawnsRemaining > 0
        || options.elapsedTime < (options.mode === 'hard' ? 8 : 11)
        || options.activeTargetCount > 4
      ) {
        return null;
      }
      this.activePattern = this.selectPattern(options.difficulty, options.mode);
      this.activeStepIndex = 0;
    }

    const pattern = this.activePattern;
    const step = pattern.steps[this.activeStepIndex];
    const startsPattern = this.activeStepIndex === 0;
    this.activeStepIndex += 1;

    if (this.activeStepIndex >= pattern.steps.length) {
      this.lastPatternId = pattern.id;
      this.activePattern = null;
      this.activeStepIndex = 0;
      const minimumRecovery = options.mode === 'hard' ? 5 : 7;
      const recoveryRange = options.mode === 'hard' ? 3 : 4;
      this.randomSpawnsRemaining = minimumRecovery + Math.floor(Math.random() * recoveryRange);
    }

    return {
      ...step,
      intervalScale: (step.intervalScale ?? 1) * (options.mode === 'hard' ? 0.94 : 1),
      patternId: pattern.id,
      patternLabel: pattern.label,
      startsPattern,
    };
  }

  private selectPattern(difficulty: number, mode: DribbleGameMode): DribblePatternDefinition {
    const eligible = patterns.filter(pattern => (
      pattern.minDifficulty <= difficulty
      && (!pattern.modes || pattern.modes.includes(mode))
      && pattern.id !== this.lastPatternId
    ));
    const fallbackCandidates = eligible.length > 0
      ? eligible
      : patterns.filter(pattern => (
        pattern.minDifficulty <= difficulty && (!pattern.modes || pattern.modes.includes(mode))
      ));
    const hardExclusive = fallbackCandidates.filter(pattern => pattern.modes?.includes('hard'));
    const candidates = mode === 'hard'
      && difficulty >= 0.28
      && hardExclusive.length > 0
      && Math.random() < THREE.MathUtils.lerp(0.48, 0.72, difficulty)
      ? hardExclusive
      : fallbackCandidates;
    const totalWeight = candidates.reduce((sum, pattern) => sum + pattern.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const pattern of candidates) {
      roll -= pattern.weight;
      if (roll <= 0) {
        return pattern;
      }
    }
    return candidates[candidates.length - 1] ?? patterns[0];
  }
}
