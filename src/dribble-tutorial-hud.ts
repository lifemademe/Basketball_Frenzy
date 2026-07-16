import * as ENGINE from '@gnsx/genesys.js';
import type { DribbleTutorialMode } from './dribble-tutorial-director.js';

export interface DribbleTutorialHudOptions extends ENGINE.BaseUIComponentOptions {
  onExit?: () => void;
}

export class DribbleTutorialHud extends ENGINE.BaseUIComponent<DribbleTutorialHudOptions> {
  public static metadata: ENGINE.UIComponentMetadata = {
    displayName: 'Dribble Tutorial HUD',
    category: 'hud',
    summary: 'Guided lesson card for the playable Basketball Frenzy tutorial.',
    useCases: ['tutorial', 'lesson objective', 'training'],
    optionsType: 'DribbleTutorialHudOptions',
    assetPaths: {
      template: '@project/assets/ui/dribble-tutorial-hud.html',
      styles: '@project/assets/ui/dribble-tutorial-hud.css',
    },
  };

  private rootElement: HTMLElement | null = null;
  private stepElement: HTMLElement | null = null;
  private titleElement: HTMLElement | null = null;
  private instructionElement: HTMLElement | null = null;
  private controlElement: HTMLElement | null = null;
  private progressElement: HTMLElement | null = null;

  protected override getAssetPaths(): { templatePath: string; stylesPath: string } {
    return {
      templatePath: DribbleTutorialHud.metadata.assetPaths.template,
      stylesPath: DribbleTutorialHud.metadata.assetPaths.styles,
    };
  }

  protected override getDefaultOptions(): Required<DribbleTutorialHudOptions> {
    return {
      position: 'top-center',
      visible: false,
      customClasses: [],
      customStyles: {},
      onExit: () => {},
    };
  }

  protected override getInitialData(): Record<string, string> {
    return {};
  }

  protected override cacheElements(): void {
    this.rootElement = this.layout?.querySelector('[data-tutorial-hud]') as HTMLElement | null;
    this.stepElement = this.layout?.querySelector('[data-tutorial-step]') as HTMLElement | null;
    this.titleElement = this.layout?.querySelector('[data-tutorial-title]') as HTMLElement | null;
    this.instructionElement = this.layout?.querySelector('[data-tutorial-instruction]') as HTMLElement | null;
    this.controlElement = this.layout?.querySelector('[data-tutorial-control]') as HTMLElement | null;
    this.progressElement = this.layout?.querySelector('[data-tutorial-progress]') as HTMLElement | null;
  }

  protected override async onInitialize(): Promise<void> {
    const exitSlot = this.layout?.querySelector('[data-tutorial-exit-slot]') as HTMLElement | null;
    if (!exitSlot) return;
    await this.mountChild(ENGINE.Button, {
      ...ENGINE.Button.presets.outlineSmall,
      label: 'Exit Tutorial',
      onClick: () => this.options.onExit(),
    }, exitSlot);
  }

  public setLesson(
    lessonNumber: number,
    lessonCount: number,
    title: string,
    instruction: string,
    control: string,
  ): void {
    if (this.rootElement) this.rootElement.dataset.complete = 'false';
    if (this.stepElement) this.stepElement.textContent = `TRAINING ${lessonNumber} / ${lessonCount}`;
    if (this.titleElement) this.titleElement.textContent = title;
    if (this.instructionElement) this.instructionElement.textContent = instruction;
    if (this.controlElement) this.controlElement.textContent = control;
    if (this.progressElement) {
      this.progressElement.style.setProperty('--tutorial-progress', String(lessonNumber / lessonCount));
    }
  }

  public setMode(mode: DribbleTutorialMode): void {
    if (this.rootElement) this.rootElement.dataset.mode = mode;
  }

  public setControl(control: string): void {
    if (this.controlElement) this.controlElement.textContent = control;
  }

  public showComplete(mode: DribbleTutorialMode = 'classic'): void {
    if (this.rootElement) this.rootElement.dataset.complete = 'true';
    if (this.stepElement) this.stepElement.textContent = 'TRAINING COMPLETE';
    if (this.titleElement) this.titleElement.textContent = 'Court Ready!';
    if (this.instructionElement) {
      this.instructionElement.textContent = mode === 'last-bounce'
        ? 'You are ready to outplay the AI. Protect your Risk Cards, read both hazard heights, and use recovery gates wisely.'
        : 'You know every move. Build clean streaks and control all three lanes.';
    }
    if (this.controlElement) this.controlElement.textContent = 'EXIT TUTORIAL';
    if (this.progressElement) this.progressElement.style.setProperty('--tutorial-progress', '1');
  }

  protected override onDestroy(): void {
    this.rootElement = null;
    this.stepElement = null;
    this.titleElement = null;
    this.instructionElement = null;
    this.controlElement = null;
    this.progressElement = null;
  }
}
