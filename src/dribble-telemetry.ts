import type { DribbleGameMode } from './dribble-main-menu.js';

export type DribbleRunOutcome = 'completed' | 'won' | 'lost' | 'abandoned';

export interface DribbleTelemetryReport {
  id: string;
  startedAt: string;
  mode: DribbleGameMode;
  outcome: DribbleRunOutcome;
  durationSeconds: number;
  score: number;
  scoreHits: number;
  bonusHits: number;
  perfectSwitches: number;
  missedScoreTargets: number;
  hazardHits: number;
  hazardsAvoided: number;
  frenzyActivations: number;
  passes: number;
  riskyPasses: number;
  roundsWon: number;
  roundsLost: number;
  longestRally: number;
  peakDifficulty: number;
  aiOpponent: string;
  patterns: Record<string, number>;
}

const telemetryStorageKey = 'basketball-frenzy-telemetry-v1';
const maximumStoredReports = 24;

export class DribbleTelemetry {
  private reports: DribbleTelemetryReport[] = this.loadReports();
  private current: DribbleTelemetryReport | null = null;

  public startRun(mode: DribbleGameMode, aiOpponent = ''): void {
    if (this.current) this.finishRun('abandoned', this.current.score, this.current.durationSeconds);
    const now = new Date();
    this.current = {
      id: `${now.getTime()}-${Math.floor(Math.random() * 10000)}`,
      startedAt: now.toISOString(),
      mode,
      outcome: 'abandoned',
      durationSeconds: 0,
      score: 0,
      scoreHits: 0,
      bonusHits: 0,
      perfectSwitches: 0,
      missedScoreTargets: 0,
      hazardHits: 0,
      hazardsAvoided: 0,
      frenzyActivations: 0,
      passes: 0,
      riskyPasses: 0,
      roundsWon: 0,
      roundsLost: 0,
      longestRally: 0,
      peakDifficulty: 0,
      aiOpponent,
      patterns: {},
    };
  }

  public update(durationSeconds: number, score: number, difficulty: number): void {
    if (!this.current) return;
    this.current.durationSeconds = Math.max(this.current.durationSeconds, durationSeconds);
    this.current.score = Math.max(this.current.score, score);
    this.current.peakDifficulty = Math.max(this.current.peakDifficulty, difficulty);
  }

  public recordScoreHit(perfect: boolean, bonus: boolean): void {
    if (!this.current) return;
    this.current.scoreHits += 1;
    if (perfect) this.current.perfectSwitches += 1;
    if (bonus) this.current.bonusHits += 1;
  }

  public recordMissedScore(): void {
    if (this.current) this.current.missedScoreTargets += 1;
  }

  public recordHazardHit(): void {
    if (this.current) this.current.hazardHits += 1;
  }

  public recordHazardAvoided(): void {
    if (this.current) this.current.hazardsAvoided += 1;
  }

  public recordFrenzy(): void {
    if (this.current) this.current.frenzyActivations += 1;
  }

  public recordPass(risky: boolean, rally: number): void {
    if (!this.current) return;
    this.current.passes += 1;
    if (risky) this.current.riskyPasses += 1;
    this.current.longestRally = Math.max(this.current.longestRally, rally);
  }

  public recordRound(playerWon: boolean): void {
    if (!this.current) return;
    if (playerWon) this.current.roundsWon += 1;
    else this.current.roundsLost += 1;
  }

  public recordPattern(patternId: string): void {
    if (!this.current) return;
    this.current.patterns[patternId] = (this.current.patterns[patternId] ?? 0) + 1;
  }

  public finishRun(outcome: DribbleRunOutcome, score: number, durationSeconds: number): void {
    if (!this.current) return;
    this.current.outcome = outcome;
    this.current.score = score;
    this.current.durationSeconds = durationSeconds;
    this.reports.unshift(structuredClone(this.current));
    this.reports.length = Math.min(this.reports.length, maximumStoredReports);
    this.current = null;
    this.persistReports();
  }

  public getSnapshot(): { current: DribbleTelemetryReport | null; reports: DribbleTelemetryReport[] } {
    return {
      current: this.current ? structuredClone(this.current) : null,
      reports: structuredClone(this.reports),
    };
  }

  private loadReports(): DribbleTelemetryReport[] {
    try {
      const value = localStorage.getItem(telemetryStorageKey);
      if (!value) return [];
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter(report => typeof report === 'object' && report !== null).slice(0, maximumStoredReports) as DribbleTelemetryReport[]
        : [];
    } catch {
      return [];
    }
  }

  private persistReports(): void {
    try {
      localStorage.setItem(telemetryStorageKey, JSON.stringify(this.reports));
    } catch {
      // Telemetry remains available for the current session when storage is blocked.
    }
  }
}
