import Phaser from 'phaser';
import { Bag } from '../items';
import { PokemonParty } from '../pokemon';
import { SaveManager } from '../save/SaveManager';
import {
  createStartingStash,
  getStarterSpecies,
  type StarterSpeciesId,
} from '../stash';
import { MenuOverlay } from '../ui/MenuOverlay';
import { pixelColumns, pixelCommitBar, pixelScreen, pixelWindow } from '../ui/pixelUi';
import { starterCards, starterLoadoutSummary } from '../ui/starterPicker';

export const CANNOT_SAVE_TITLE = 'This browser cannot save';

/** What a browser that keeps nothing is told, in place of a new game. */
export const CANNOT_SAVE_MESSAGE =
  'This browser is not letting the game save, so a new game cannot start. Allow this site to store data - or leave private browsing - then reload the page.';

export class StarterScene extends Phaser.Scene {
  private readonly saveManager = new SaveManager();
  private selectedStarterId: StarterSpeciesId = 'bulbasaur';
  private overlay!: MenuOverlay;

  public constructor() {
    super('starter');
  }

  public create(): void {
    this.overlay = new MenuOverlay(this, 'starter-menu pixel-ui', (event) => this.handleKey(event));
    // Asked before a partner is chosen, so nobody picks one for a game that
    // cannot be kept.
    if (!this.saveManager.canSave()) {
      this.renderCannotSave();
      return;
    }
    this.render();
  }

  /**
   * Said plainly instead of starting a game: every screen after this one reads
   * the game back out of the save, and starting without one was a black screen.
   */
  private renderCannotSave(): void {
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

  private handleKey(event: KeyboardEvent): void {
    if (this.overlay.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  private render(): void {
    const selected = getStarterSpecies(this.selectedStarterId);
    this.overlay.root.innerHTML = pixelScreen({
      place: 'First raid briefing',
      title: 'Choose your partner',
      hints: 'ARROWS move · ENTER choose',
      body: `<main class="px-body starter-shell"><p class="starter-brief">Your partner enters the lost field kit raid with you. Choose carefully.</p><div class="starter-grid" ${pixelColumns(100, { maximum: 3, widest: 132 })}>${starterCards(this.selectedStarterId)}</div>${pixelCommitBar({
        title: selected.name,
        // The bar's title is the name and the button confirms it by name, so
        // the line is only what the name does not say.
        lines: [`<span class="px-wrap">${starterLoadoutSummary(selected)}</span>`],
        actions: `<button class="px-window px-button is-primary" data-confirm data-sfx="confirm" data-help="Locks in ${selected.name} as your first Pokémon.">Confirm ${selected.name}</button>`,
      })}</main>`,
    });
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-starter]').forEach((button) => {
      button.onclick = () => {
        this.selectedStarterId = button.dataset.starter as StarterSpeciesId;
        this.render();
      };
    });
    this.overlay.root.querySelector<HTMLButtonElement>('[data-confirm]')?.addEventListener('click', () => this.confirmStarter());
    // The cursor starts on the card that is chosen, never on CONFIRM: this is the
    // first decision in the game, and a cursor on the commit button turned one
    // press of Enter into taking Bulbasaur unread. Choosing a card keeps the
    // cursor on it, so committing is always a deliberate step down to CONFIRM.
    this.overlay.focus(`[data-starter="${this.selectedStarterId}"]`, '[data-confirm]');
  }

  private confirmStarter(): void {
    const starter = getStarterSpecies(this.selectedStarterId);
    const newGame = {
      party: new PokemonParty([]),
      mapId: 'pallet-town' as const,
      position: { x: 6, y: 8 },
      items: [],
      bag: new Bag(),
      stash: createStartingStash(starter),
      starterSpeciesId: this.selectedStarterId,
    };
    const savedGame = this.saveManager.save(newGame) ? this.saveManager.load() : null;
    if (!savedGame) {
      this.renderCannotSave();
      return;
    }
    this.scene.start('base', { savedGame });
  }
}
