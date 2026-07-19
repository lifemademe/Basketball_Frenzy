import type { DribbleGameMode } from './dribble-main-menu.js';
import { t, type TranslationKey } from './dribble-localization.js';

export const RUN_OBJECTIVE_XP = 25;

export type RunObjectiveMetric =
  | 'score'
  | 'goodHits'
  | 'perfectSwitches'
  | 'hazardsAvoided'
  | 'bestCombo'
  | 'starsEarned'
  | 'elapsedSeconds'
  | 'roundsWon'
  | 'longestRally'
  | 'playerReturns'
  | 'dangerPasses';

export interface RunObjectiveSnapshot {
  score: number;
  goodHits: number;
  perfectSwitches: number;
  hazardsAvoided: number;
  bestCombo: number;
  starsEarned: number;
  elapsedSeconds: number;
  roundsWon: number;
  longestRally: number;
  playerReturns: number;
  dangerPasses: number;
}

export interface RunObjectiveProgress {
  id: string;
  label: string;
  shortLabel: string;
  current: number;
  target: number;
  completed: boolean;
}

interface RunObjectiveDefinition {
  id: string;
  label: string;
  shortLabel: string;
  metric: RunObjectiveMetric;
  target: number;
  modes: readonly DribbleGameMode[];
}

const definitions: readonly RunObjectiveDefinition[] = [
  { id: 'score-1200', label: 'Score 1,200 points', shortLabel: 'Score 1,200', metric: 'score', target: 1200, modes: ['normal'] },
  { id: 'score-1800', label: 'Score 1,800 points', shortLabel: 'Score 1,800', metric: 'score', target: 1800, modes: ['hard'] },
  { id: 'hit-15', label: 'Collect 15 scoring targets', shortLabel: 'Hit 15 Targets', metric: 'goodHits', target: 15, modes: ['normal', 'hard'] },
  { id: 'perfect-4', label: 'Make 4 perfect switches', shortLabel: '4 Perfect Switches', metric: 'perfectSwitches', target: 4, modes: ['normal', 'hard'] },
  { id: 'avoid-10', label: 'Clear 10 hazards', shortLabel: 'Clear 10 Hazards', metric: 'hazardsAvoided', target: 10, modes: ['normal', 'hard'] },
  { id: 'combo-6', label: 'Reach a combo of 6', shortLabel: 'Reach Combo x6', metric: 'bestCombo', target: 6, modes: ['normal', 'hard'] },
  { id: 'survive-45', label: 'Stay on court for 45 seconds', shortLabel: 'Survive 45s', metric: 'elapsedSeconds', target: 45, modes: ['normal', 'hard'] },
  { id: 'star-1', label: 'Collect a Frenzy Star', shortLabel: 'Collect Frenzy Star', metric: 'starsEarned', target: 1, modes: ['normal', 'hard'] },
  { id: 'rounds-2', label: 'Win 2 Last Bounce rounds', shortLabel: '2 rounds', metric: 'roundsWon', target: 2, modes: ['last-bounce'] },
  { id: 'rally-8', label: 'Build an 8-pass rally', shortLabel: '8-pass rally', metric: 'longestRally', target: 8, modes: ['last-bounce'] },
  { id: 'returns-7', label: 'Return the ball 7 times', shortLabel: '7 returns', metric: 'playerReturns', target: 7, modes: ['last-bounce'] },
  { id: 'risk-1', label: 'Land a Risk Pass', shortLabel: '1 Risk Pass', metric: 'dangerPasses', target: 1, modes: ['last-bounce'] },
  { id: 'versus-45', label: 'Hold the rally for 45 seconds', shortLabel: '45 seconds', metric: 'elapsedSeconds', target: 45, modes: ['last-bounce'] },
];

export class DribbleRetentionDirector {
  private objectives: RunObjectiveDefinition[] = [];
  private completed = new Set<string>();

  public start(mode: DribbleGameMode, rotationSeed: number): void {
    const candidates = definitions.filter(definition => definition.modes.includes(mode));
    const offset = candidates.length > 0 ? Math.abs(rotationSeed) % candidates.length : 0;
    const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
    const selected: RunObjectiveDefinition[] = [];
    for (const definition of rotated) {
      if (selected.some(entry => entry.metric === definition.metric)) continue;
      selected.push(definition);
      if (selected.length === 3) break;
    }
    this.objectives = selected;
    this.completed.clear();
  }

  public update(snapshot: RunObjectiveSnapshot): RunObjectiveProgress[] {
    const newlyCompleted: RunObjectiveProgress[] = [];
    for (const objective of this.objectives) {
      if (this.completed.has(objective.id)) continue;
      const current = Math.max(0, Math.floor(snapshot[objective.metric]));
      if (current < objective.target) continue;
      this.completed.add(objective.id);
      newlyCompleted.push(this.toProgress(objective, current));
    }
    return newlyCompleted;
  }

  public getProgress(snapshot: RunObjectiveSnapshot): RunObjectiveProgress[] {
    return this.objectives.map(objective => this.toProgress(
      objective,
      Math.max(0, Math.floor(snapshot[objective.metric])),
    ));
  }

  public getCompletedCount(): number {
    return this.completed.size;
  }

  public getObjectiveCount(): number {
    return this.objectives.length;
  }

  public getBriefing(): string {
    return this.objectives.map(objective => (
      t(`objective.${objective.id}` as TranslationKey)
    )).join('  |  ');
  }

  private toProgress(objective: RunObjectiveDefinition, current: number): RunObjectiveProgress {
    return {
      id: objective.id,
      label: t(`objective.${objective.id}` as TranslationKey),
      shortLabel: t(`objective.${objective.id}` as TranslationKey),
      current: Math.min(current, objective.target),
      target: objective.target,
      completed: this.completed.has(objective.id) || current >= objective.target,
    };
  }
}
