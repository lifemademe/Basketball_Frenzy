import * as ENGINE from '@gnsx/genesys.js';

import type { DribbleTelemetryReport } from './dribble-telemetry.js';

export interface DribbleDeveloperPanelOptions extends ENGINE.BaseUIComponentOptions {}

export class DribbleDeveloperPanel extends ENGINE.BaseUIComponent<DribbleDeveloperPanelOptions> {
  public static metadata: ENGINE.UIComponentMetadata = {
    displayName: 'Basketball Frenzy Developer Telemetry',
    category: 'hud',
    summary: 'Development-only run balance telemetry.',
    useCases: ['telemetry', 'balance', 'debug'],
    optionsType: 'DribbleDeveloperPanelOptions',
    assetPaths: {
      template: '@project/assets/ui/dribble-developer-panel.html',
      styles: '@project/assets/ui/dribble-developer-panel.css',
    },
  };

  private currentElement: HTMLElement | null = null;
  private gridElement: HTMLElement | null = null;

  protected override getAssetPaths(): { templatePath: string; stylesPath: string } {
    return {
      templatePath: DribbleDeveloperPanel.metadata.assetPaths.template,
      stylesPath: DribbleDeveloperPanel.metadata.assetPaths.styles,
    };
  }

  protected override getDefaultOptions(): Required<DribbleDeveloperPanelOptions> {
    return { position: 'top-right', visible: false, customClasses: [], customStyles: {} };
  }

  protected override getInitialData(): Record<string, string> {
    return {};
  }

  protected override cacheElements(): void {
    this.currentElement = this.layout?.querySelector('[data-developer-current]') as HTMLElement | null;
    this.gridElement = this.layout?.querySelector('[data-developer-grid]') as HTMLElement | null;
  }

  public setReport(current: DribbleTelemetryReport | null, reports: DribbleTelemetryReport[]): void {
    const report = current ?? reports[0] ?? null;
    if (this.currentElement) {
      this.currentElement.textContent = current
        ? `LIVE ${current.mode.toUpperCase()} - ${Math.round(current.durationSeconds)}s`
        : report
          ? `LAST ${report.mode.toUpperCase()} - ${report.outcome.toUpperCase()}`
          : 'No run telemetry yet';
    }
    if (!this.gridElement) return;
    this.gridElement.replaceChildren();
    const values: Array<[string, string | number]> = report
      ? [
        ['SCORE', report.score],
        ['HITS', report.scoreHits],
        ['MISSES', report.missedScoreTargets],
        ['HAZARD HITS', report.hazardHits],
        ['AVOIDED', report.hazardsAvoided],
        ['PERFECT', report.perfectSwitches],
        ['FRENZY', report.frenzyActivations],
        ['RISK PASSES', report.riskyPasses],
        ['PEAK', `${Math.round(report.peakDifficulty * 100)}%`],
      ]
      : [];
    for (const [label, value] of values) {
      const cell = document.createElement('div');
      const caption = document.createElement('small');
      const number = document.createElement('b');
      caption.textContent = label;
      number.textContent = String(value);
      cell.append(caption, number);
      this.gridElement.append(cell);
    }
  }

  protected override onDestroy(): void {
    this.currentElement = null;
    this.gridElement = null;
  }
}
