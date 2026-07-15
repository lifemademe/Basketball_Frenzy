import type { DribbleGameMode } from './dribble-main-menu.js';
import type { TargetKind } from './dribble-target.js';

export type PatternLane = 'left' | 'center' | 'right';
export type PatternHeight = 'low' | 'normal';

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
      this.activePattern = this.selectPattern(options.difficulty);
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
      const minimumRecovery = options.mode === 'hard' ? 3 : 4;
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

  private selectPattern(difficulty: number): DribblePatternDefinition {
    const eligible = patterns.filter(pattern => (
      pattern.minDifficulty <= difficulty && pattern.id !== this.lastPatternId
    ));
    const candidates = eligible.length > 0
      ? eligible
      : patterns.filter(pattern => pattern.minDifficulty <= difficulty);
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
