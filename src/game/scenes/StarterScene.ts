import Phaser from 'phaser';
import { countPlay } from '../analytics/playCounter';
import { Bag } from '../items';
import { PokemonParty, type PokemonBase } from '../pokemon';
import { SaveManager } from '../save/SaveManager';
import {
  createStartingStash,
  getStarterSpecies,
  STARTER_SPECIES,
  type StarterSpeciesId,
} from '../stash';
import { MenuOverlay } from '../ui/MenuOverlay';
import { pixelColumns, pixelCommitBar, pixelScreen, pixelWindow } from '../ui/pixelUi';
import { starterCardHelp, starterCards, starterLoadoutSummary } from '../ui/starterPicker';

export const CANNOT_SAVE_TITLE = 'This browser cannot save';

/** What a browser that keeps nothing is told, in place of a new game. */
export const CANNOT_SAVE_MESSAGE =
  'This browser is not letting the game save, so a new game cannot start. Allow this site to store data - or leave private browsing - then reload the page.';

const confirmLabel = (species: PokemonBase): string => `Confirm ${species.name}`;
const confirmHelp = (species: PokemonBase): string => `Locks in ${species.name} as your first Pokémon.`;

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
    // The pointer only previews, because this is a choice of who: moving the
    // mouse from Bulbasaur to CONFIRM crosses Charmander's card on the way, and
    // a pointer that moved the cursor changed the partner under it
    // (`ui/pointerPreview.ts`). A click chooses, as the arrow keys do.
    this.overlay.pointerRule = 'previews';
    // The choice follows the cursor: arrowing to Charmander used to leave the
    // bar reading CONFIRM BULBASAUR until Enter was pressed on the card
    // (playtest 47). Moving the cursor still commits nothing - CONFIRM is one
    // deliberate step down. On the way down, so the card's help line is already
    // the chosen one when the overlay's own listener reads it out.
    this.overlay.root.addEventListener('focusin', (event) => this.followCursor(event.target), true);
    this.render();
  }

  /**
   * Makes the card the cursor is on the chosen one. Asked on `focusin` and
   * again after an arrow key, because a page without the window's focus moves
   * the cursor without firing a focus event (`MenuOverlay.moveCursorTo`).
   */
  private followCursor(target: EventTarget | null): void {
    const card = (target as Element | null)?.closest?.<HTMLElement>('[data-starter]');
    const starter = STARTER_SPECIES.find((species) => species.id === card?.dataset.starter)?.id;
    if (starter) {
      this.choose(starter);
    }
  }

  /**
   * Says the choice on the screen already drawn. Choosing is never a redraw: a
   * cursor that lands on a card is inside a focus event, so rebuilding the
   * screen there threw away the control it had just landed on and the columns
   * measured for it, and the cards stood at their unmeasured width with no
   * cursor (the captain, 30 Oct 2026). Rebuilt from a click, the card under the
   * mouse was gone before the button came up.
   */
  private choose(starter: StarterSpeciesId): void {
    if (starter === this.selectedStarterId) {
      return;
    }
    this.selectedStarterId = starter;
    const { root } = this.overlay;
    root.querySelectorAll<HTMLElement>('[data-starter]').forEach((card) => {
      const chosen = card.dataset.starter === starter;
      card.classList.toggle('is-selected', chosen);
      card.setAttribute('aria-pressed', String(chosen));
      card.dataset.help = starterCardHelp(card.dataset.starter ?? '', starter);
    });
    const selected = getStarterSpecies(starter);
    root.querySelector<HTMLElement>('[data-chosen-name]')!.textContent = selected.name;
    root.querySelector<HTMLElement>('[data-chosen-kit]')!.textContent = starterLoadoutSummary(selected);
    const confirm = root.querySelector<HTMLElement>('[data-confirm]')!;
    confirm.textContent = confirmLabel(selected);
    confirm.dataset.help = confirmHelp(selected);
    // The button is as wide as its words, and its width is snapped to the grid.
    this.overlay.layout();
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
      this.followCursor(document.activeElement);
    }
  }

  private render(): void {
    const selected = getStarterSpecies(this.selectedStarterId);
    this.overlay.root.innerHTML = pixelScreen({
      place: 'First raid briefing',
      title: 'Choose your partner',
      hints: 'ARROWS choose · ENTER on CONFIRM to begin',
      body: `<main class="px-body starter-shell"><p class="starter-brief">Your partner enters the lost field kit raid with you. Choose carefully.</p><div class="starter-grid" ${pixelColumns(100, { maximum: 3, widest: 132 })}>${starterCards(this.selectedStarterId)}</div>${pixelCommitBar({
        title: `<span data-chosen-name>${selected.name}</span>`,
        // The bar's title is the name and the button confirms it by name, so
        // the line is only what the name does not say.
        lines: [`<span class="px-wrap" data-chosen-kit>${starterLoadoutSummary(selected)}</span>`],
        actions: `<button class="px-window px-button is-primary" data-confirm data-sfx="confirm" data-help="${confirmHelp(selected)}">${confirmLabel(selected)}</button>`,
      })}</main>`,
    });
    this.overlay.root.querySelectorAll<HTMLButtonElement>('[data-starter]').forEach((button) => {
      // Mostly the focus a press gave the button has chosen it already; Enter on
      // a card, and a browser that gives a clicked button no focus, come here.
      button.onclick = () => {
        this.choose(button.dataset.starter as StarterSpeciesId);
        button.focus();
      };
    });
    this.overlay.root.querySelector<HTMLButtonElement>('[data-confirm]')?.addEventListener('click', () => this.confirmStarter());
    // The cursor starts on the card that is chosen, never on CONFIRM: this is the
    // first decision in the game, and a cursor on the commit button turned one
    // press of Enter into taking Bulbasaur unread. Choosing a card keeps the
    // cursor on it, so committing is always a deliberate step down to CONFIRM.
    this.overlay.focus('[data-starter][aria-pressed="true"]', '[data-confirm]');
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
    countPlay({ kind: 'starter', detail: this.selectedStarterId });
    this.scene.start('base', { savedGame });
  }
}
