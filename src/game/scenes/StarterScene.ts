import Phaser from 'phaser';
import { FIRST_STANDING } from '../base/starterTable';
import { gameBeforeChoosing } from '../save/newGame';
import { SaveManager } from '../save/SaveManager';
import { MenuOverlay } from '../ui/MenuOverlay';
import { pixelCommitBar, pixelScreen, pixelWindow } from '../ui/pixelUi';

export const CANNOT_SAVE_TITLE = 'This browser cannot save';

/** What a browser that keeps nothing is told, in place of a new game. */
export const CANNOT_SAVE_MESSAGE =
  'This browser is not letting the game save, so a new game cannot start. Allow this site to store data - or leave private browsing - then reload the page.';

export interface StarterSceneData {
  /** Oak's table was told YES and the browser would not keep the game. */
  readonly refused?: boolean;
}

/**
 * The way into a new game. The partner is chosen on Oak's table, in the lab
 * itself (`base/starterTable.ts`, `BaseScene`), so all this scene still decides
 * is whether there can be a new game at all: every screen after this one reads
 * the game back out of the save, and starting without one was a black screen.
 */
export class StarterScene extends Phaser.Scene {
  private readonly saveManager = new SaveManager();
  private overlay!: MenuOverlay;

  public constructor() {
    super('starter');
  }

  public create(data: StarterSceneData = {}): void {
    // Asked before a partner is chosen, so nobody picks one for a game that
    // cannot be kept.
    if (data.refused || !this.saveManager.canSave()) {
      this.renderCannotSave();
      return;
    }
    this.scene.start('base', { savedGame: gameBeforeChoosing(), room: 'oaks-lab', choosing: true, at: FIRST_STANDING, facing: 'up' });
  }

  /** Said plainly instead of starting a game. */
  private renderCannotSave(): void {
    this.overlay = new MenuOverlay(this, 'starter-menu pixel-ui', () => undefined);
    this.overlay.root.innerHTML = pixelScreen({
      place: 'New game',
      title: CANNOT_SAVE_TITLE,
      hints: 'ENTER back to the title',
      body: `<main class="px-body starter-shell"><p class="starter-brief">Nothing was started.</p>${pixelWindow(
        `<p class="px-wrap cannot-save">${CANNOT_SAVE_MESSAGE}</p>`,
        { heading: 'Saving is switched off' },
      )}${pixelCommitBar({
        title: 'No game to keep',
        lines: [`<span class="px-wrap">Every raid is kept in the save, so the game needs one to start.</span>`],
        actions: `<button class="px-window px-button is-primary" data-title data-sfx="confirm" data-help="Back to the title screen.">Back to title</button>`,
      })}</main>`,
    });
    this.overlay.root
      .querySelector<HTMLButtonElement>('[data-title]')
      ?.addEventListener('click', () => this.scene.start('title'));
    this.overlay.focus('[data-title]');
  }
}
