import Phaser from 'phaser';
import { buildObjectiveGuide } from '../objectives/ObjectiveGuide';
import type { GridPosition } from '../movement/gridMovement';
import type { ActiveRunSession } from '../run/RunSession';
import type { WorldMapId } from '../worldMap';
import { MenuOverlay } from '../ui/MenuOverlay';

export interface ObjectivesSceneData {
  readonly runSession: ActiveRunSession;
  readonly currentMapId: WorldMapId;
  readonly currentPosition: GridPosition;
  readonly activatedPoiIds: readonly string[];
  /** Only resume WorldScene when this overlay paused it. */
  readonly pausedWorld: boolean;
}

/**
 * A scene-owned overlay lets the world remain fully paused while preserving
 * its active raid state for a clean resume.
 */
export class ObjectivesScene extends Phaser.Scene {
  private menuOverlay!: MenuOverlay;
  private pausedWorld = false;

  public constructor() {
    super('objectives');
  }

  public init(data: ObjectivesSceneData): void {
    this.pausedWorld = data.pausedWorld;
    const guide = buildObjectiveGuide(data.runSession, {
      currentMapId: data.currentMapId,
      currentPosition: data.currentPosition,
      activatedPoiIds: new Set(data.activatedPoiIds),
    });
    this.createOverlay(guide);
  }

  public create(): void {
    // The DOM field guide is built during init so it is ready before the first
    // rendered frame after WorldScene pauses.
  }

  private createOverlay(guide: ReturnType<typeof buildObjectiveGuide>): void {
    this.menuOverlay = new MenuOverlay(this, 'objectives-menu', (event) => {
      if (event.key === 'o' || event.key === 'O' || event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });
    this.menuOverlay.root.setAttribute('aria-label', 'Raid field guide');
    this.menuOverlay.root.innerHTML = `<div class="field-guide-shell">
      <header class="field-guide-header">
        <div>
          <p class="eyebrow">Raid field guide</p>
          <h1>${guide.contractLabel}</h1>
        </div>
        <button class="field-guide-close" data-close aria-label="Close field guide">Close <kbd>O</kbd></button>
      </header>
      <main class="field-guide-layout">
        <section class="field-guide-panel" aria-labelledby="objectives-heading">
          <div class="field-guide-heading"><p class="eyebrow">Active objectives</p><h2 id="objectives-heading">Contract status</h2></div>
          <div class="field-guide-objectives">
            ${guide.objectives.length
              ? guide.objectives.map((objective) => `<article class="field-guide-objective ${objective.complete ? 'complete' : ''}">
                <span aria-hidden="true">${objective.complete ? '✓' : '○'}</span>
                <div><strong>${escapeHtml(objective.description)}</strong><small>${objective.progress} complete · Reward: ${escapeHtml(objective.reward)}</small></div>
              </article>`).join('')
              : '<p class="field-guide-empty">No contract objective is active. Your loot is still only safe after extraction.</p>'}
          </div>
        </section>
        <section class="field-guide-panel field-guide-notes" aria-labelledby="notes-heading">
          <div class="field-guide-heading"><p class="eyebrow">${guide.isFirstContract ? 'First run briefing' : 'Field notes'}</p><h2 id="notes-heading">What to do next</h2></div>
          <ol>${guide.hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join('')}</ol>
        </section>
      </main>
      <footer>GAME PAUSED · Press <kbd>O</kbd> or <kbd>Esc</kbd> to return</footer>
    </div>`;
    this.menuOverlay.root.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.close();
    this.menuOverlay.focus('[data-close]');
  }

  private close(): void {
    if (!this.scene.isActive('objectives')) {
      return;
    }
    const resumeWorld = this.pausedWorld && this.scene.isPaused('world');
    this.pausedWorld = false;
    this.scene.stop();
    if (resumeWorld) {
      this.scene.resume('world');
    }
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
