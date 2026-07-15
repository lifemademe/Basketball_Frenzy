import type { DribbleSide } from './dribble-ball.js';
import type { TargetKind } from './dribble-target.js';

export type TutorialLane = 'left' | 'center' | 'right' | 'active';

export type TutorialEvent =
  | 'boost-left'
  | 'boost-right'
  | 'switch-left'
  | 'switch-right'
  | 'score-hit'
  | 'center-hit'
  | 'hazard-hit'
  | 'hazard-avoided'
  | 'health-hit'
  | 'bonus-hit';

export interface TutorialSpawnRequest {
  kind: TargetKind;
  lane: TutorialLane;
  height: 'low' | 'normal' | 'high';
  rhythmTarget?: boolean;
}

export interface TutorialLesson {
  id: string;
  title: string;
  instruction: string;
  control: string;
  expectedEvent: TutorialEvent;
  spawn?: TutorialSpawnRequest;
}

const lessons: TutorialLesson[] = [
  {
    id: 'left-bounce',
    title: 'Power Bounce',
    instruction: 'The ball starts on your left. Send it high above low hazards.',
    control: 'LEFT CLICK',
    expectedEvent: 'boost-left',
  },
  {
    id: 'switch-right',
    title: 'Switch Hands',
    instruction: 'Bounce through center and catch the ball with your right hand.',
    control: 'RIGHT CLICK',
    expectedEvent: 'switch-right',
  },
  {
    id: 'right-bounce',
    title: 'Right Power Bounce',
    instruction: 'With the ball on the right, launch another high bounce.',
    control: 'RIGHT CLICK',
    expectedEvent: 'boost-right',
  },
  {
    id: 'switch-left',
    title: 'Return Left',
    instruction: 'Switch back through the center lane.',
    control: 'LEFT CLICK',
    expectedEvent: 'switch-left',
  },
  {
    id: 'score-target',
    title: 'Score Target',
    instruction: 'Keep the ball bouncing on the left to collect the yellow target.',
    control: 'HOLD YOUR LANE',
    expectedEvent: 'score-hit',
    spawn: { kind: 'score', lane: 'left', height: 'normal' },
  },
  {
    id: 'center-target',
    title: 'Center Timing',
    instruction: 'Watch the bottom meter. Switch hands as its marker reaches the center.',
    control: 'RIGHT CLICK ON BEAT',
    expectedEvent: 'center-hit',
    spawn: { kind: 'score', lane: 'center', height: 'normal', rhythmTarget: true },
  },
  {
    id: 'avoid-hazard',
    title: 'Avoid Hazards',
    instruction: 'The red target costs a life. Power-bounce over it and let it pass.',
    control: 'HIGH BOUNCE',
    expectedEvent: 'hazard-avoided',
    spawn: { kind: 'hazard', lane: 'active', height: 'low' },
  },
  {
    id: 'health-target',
    title: 'Restore Health',
    instruction: 'Collect the glowing cross to restore a missing heart.',
    control: 'HOLD YOUR LANE',
    expectedEvent: 'health-hit',
    spawn: { kind: 'health', lane: 'active', height: 'normal' },
  },
  {
    id: 'bonus-star',
    title: 'Bonus Star',
    instruction: 'Rare stars are high. Use a Power bounce to reach this one.',
    control: 'HIGH BOUNCE',
    expectedEvent: 'bonus-hit',
    spawn: { kind: 'bonus', lane: 'active', height: 'high' },
  },
  {
    id: 'frenzy',
    title: 'Frenzy Power',
    instruction: 'Long clean streaks turn the ball gold. During Frenzy, every target is good.',
    control: 'HIT THE YELLOW TARGET',
    expectedEvent: 'score-hit',
    spawn: { kind: 'score', lane: 'active', height: 'normal' },
  },
];

export class DribbleTutorialDirector {
  private lessonIndex = 0;
  private spawnPending = false;
  private spawnDelay = 0;
  private complete = false;
  private hazardBounceArmed = false;

  public reset(): void {
    this.lessonIndex = 0;
    this.complete = false;
    this.hazardBounceArmed = false;
    this.prepareLesson();
  }

  public update(deltaTime: number): void {
    this.spawnDelay = Math.max(0, this.spawnDelay - deltaTime);
  }

  public getLesson(): TutorialLesson {
    return lessons[Math.min(this.lessonIndex, lessons.length - 1)];
  }

  public getLessonNumber(): number {
    return this.lessonIndex + 1;
  }

  public getLessonCount(): number {
    return lessons.length;
  }

  public isComplete(): boolean {
    return this.complete;
  }

  public takeSpawnRequest(): TutorialSpawnRequest | null {
    const lesson = this.getLesson();
    if (this.complete || !lesson.spawn || !this.spawnPending || this.spawnDelay > 0) {
      return null;
    }
    this.spawnPending = false;
    return lesson.spawn;
  }

  public recordEvent(event: TutorialEvent): boolean {
    const lesson = this.getLesson();
    if (this.complete) return false;
    if (lesson.id === 'avoid-hazard') {
      if (event === 'boost-left' || event === 'boost-right') {
        this.hazardBounceArmed = true;
        return false;
      }
      if (event === 'hazard-avoided' && !this.hazardBounceArmed) {
        this.retryTarget();
        return false;
      }
      if (event === 'hazard-hit') {
        this.hazardBounceArmed = false;
        this.retryTarget();
        return false;
      }
    }
    if (event !== lesson.expectedEvent) {
      return false;
    }

    this.lessonIndex += 1;
    if (this.lessonIndex >= lessons.length) {
      this.lessonIndex = lessons.length - 1;
      this.complete = true;
      return true;
    }
    this.prepareLesson();
    return true;
  }

  public retryTarget(): void {
    if (!this.getLesson().spawn) return;
    this.spawnPending = true;
    this.spawnDelay = 0.75;
  }

  public resolveLane(lane: TutorialLane, activeSide: DribbleSide): DribbleSide | 'center' {
    return lane === 'active' ? activeSide : lane;
  }

  private prepareLesson(): void {
    this.hazardBounceArmed = false;
    this.spawnPending = Boolean(this.getLesson().spawn);
    this.spawnDelay = this.spawnPending ? 0.85 : 0;
  }
}
