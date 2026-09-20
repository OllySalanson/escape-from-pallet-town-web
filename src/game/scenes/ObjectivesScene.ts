import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { buildObjectiveGuide } from '../objectives/ObjectiveGuide';
import type { GridPosition } from '../movement/gridMovement';
import type { ActiveRunSession } from '../run/RunSession';
import type { WorldMapId } from '../worldMap';
import { MenuOverlay } from '../ui/MenuOverlay';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import {
  COLUMN_MEASURES,
  pixelColumns,
  pixelScreen,
  pixelTag,
  pixelWindow,
} from '../ui/pixelUi';
import { objectiveIcon } from '../ui/icons';

export interface ObjectivesSceneData {
  readonly runSession: ActiveRunSession;
  readonly currentMapId: WorldMapId;
  readonly currentPosition: GridPosition;
  readonly activatedPoiIds: readonly string[];
  /** Only resume WorldScene when this overlay paused it. */
  readonly pausedWorld: boolean;
}

/**
 * The raid field guide, in the game's own visual language.
 *
 * A scene-owned overlay lets the world remain fully paused while preserving its
 * active raid state for a clean resume.
 *
 * It used to be a third look again - a green terminal with its own header, its
 * own panels and its own footer - beside a rounded bag and a pixel-ui lobby.
 * It is two windows of rows now, like every other screen: what the contract
 * still wants, and what to do about it. Every row is a control the cursor can
 * rest on even though none of them does anything, because a pane with nothing
 * focusable in it cannot be scrolled with the arrow keys, and this is the one
 * screen in a raid whose panes are made of sentences.
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
    this.menuOverlay = new MenuOverlay(this, 'objectives-menu pixel-ui', (event) => {
      if (isOverlayDismissKey(event, 'o')) {
        event.preventDefault();
        this.close();
        return;
      }
      if (this.menuOverlay.moveCursor(event.key)) {
        event.preventDefault();
      }
    });
    this.menuOverlay.root.setAttribute('aria-label', 'Raid field guide');
    const done = guide.objectives.filter((objective) => objective.complete).length;
    const objectives = guide.objectives.length
      ? guide.objectives
          .map(
            (objective) =>
              // No `data-help`: the row is the whole sentence already, and the
              // help bar is two lines - a long note put in both places spilled
              // out of the bar it was written into.
              `<button class="px-row has-icon px-tall" aria-disabled="true">${objectiveIcon('Contract')}<span class="px-row-main"><span class="px-wrap">${escapeHtml(
                objective.description,
              )}</span><small class="px-wrap">Reward: ${escapeHtml(objective.reward)}</small></span>${
                objective.complete
                  ? pixelTag('Done', 'good', true)
                  : pixelTag(objective.progress, 'plain')
              }</button>`,
          )
          .join('')
      : '<p class="px-empty px-wrap">No contract objective is active. Your loot is still only safe after extraction.</p>';
    // Numbered, because the notes are a route read in order and the typeface
    // has no list marker: the number stands in a gutter of its own.
    const notes = guide.hints
      .map(
        (hint, index) =>
          `<button class="px-row has-number px-tall" aria-disabled="true"><span class="px-number">${index + 1}</span><span class="px-row-main"><span class="px-wrap">${escapeHtml(hint)}</span></span></button>`,
      )
      .join('');
    const body = `<main class="px-body raid-guide-layout">${pixelWindow(
      `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.brief)}>${objectives}</div>`,
      {
        heading: 'Contract status',
        note: guide.objectives.length ? `${done} of ${guide.objectives.length} done` : 'nothing owed',
      },
    )}${pixelWindow(`<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.brief)}>${notes}</div>`, {
      heading: 'What to do next',
      note: guide.isFirstContract ? 'first run briefing' : 'field notes',
    })}</main>`;
    this.menuOverlay.root.innerHTML = pixelScreen({
      title: escapeHtml(guide.contractLabel),
      back: { label: 'Raid', attribute: 'data-close' },
      aside: 'Raid paused',
      body,
      hints: 'ARROWS read · O or ESC back to the raid',
    });
    this.menuOverlay.root.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.close();
    this.menuOverlay.focus('.px-list button', '[data-close]');
  }

  private close(): void {
    if (!this.scene.isActive('objectives')) {
      return;
    }
    const resumeWorld = this.pausedWorld && this.scene.isPaused('world');
    this.pausedWorld = false;
    audioManager.play('menuClose');
    this.scene.stop();
    if (resumeWorld) {
      this.scene.resume('world');
    }
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
