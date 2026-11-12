import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import { KANTO_POKEDEX_SIZE, dexStanding, pokedexOf, type Pokedex } from '../hub/pokedex';
import { sourcesOf } from '../hub/pokedexSources';
import { POKEDEX_KEY } from '../input/keyBindings';
import { SaveManager } from '../save/SaveManager';
import { MenuOverlay } from '../ui/MenuOverlay';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { pixelScreen, pixelTag, putUpPixelStatus, takeDownPixelStatus } from '../ui/pixelUi';
import {
  ENTRY_HINTS,
  dexCard,
  dexEntryBody,
  dexListBody,
  dexNumber,
  dexPitch,
  kindAt,
  neighbourPage,
  type PokedexViewState,
} from '../ui/pokedexView';
import { hideHarbourUnder } from './coverHarbour';

export interface PokedexSceneData {
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
}

/** How long after the grid is up the places every kind lives in are worked out (`warmSources`). */
const WARM_SOURCES_MS = 350;

/**
 * THE POKéDEX (`ui/pokedexView.ts` says what it shows and why): the whole
 * window over the paused harbour, opened on X anywhere in it and from Oak's PC
 * in his lab (`BaseScene.openPokedex`).
 *
 * It reads the save and writes nothing: what is owned, met and shiny is
 * registered where it happens - a bank, a fight (`SaveManager.registerSeen`) -
 * and this is only the look at it. Two views on one overlay: the grid of all
 * 151, and one kind's page, which ENTER opens and ESC leaves.
 */
export class PokedexScene extends Phaser.Scene implements ProvidesFeedbackContext {
  private overlay: MenuOverlay | undefined;
  private pausedBase = false;
  private state: PokedexViewState = { dex: { owned: [], seen: [], shiny: [] }, claimed: [] };
  /** The tile the cursor is on, by dex number: where the grid opens and where a page comes back to. */
  private cursor = 1;
  /** The page that is open, or null on the grid. */
  private openPage: number | null = null;
  private readonly saveManager = new SaveManager();

  public constructor() {
    super('pokedex');
  }

  public init(data: PokedexSceneData): void {
    this.overlay = undefined;
    this.pausedBase = data.pausedBase;
    this.openPage = null;
    const game = this.saveManager.load();
    this.state = {
      dex: game ? pokedexOf(game.raidProgress, game.stash) : { owned: [], seen: [], shiny: [] },
      claimed: game?.raidProgress.pokedexRewards ?? [],
    };
    // Open on the first kind there is something to say about, so the first
    // thing under the cursor is a Pokémon and not an empty ball.
    this.cursor = this.state.dex.seen[0] ?? 1;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
    });
    recordAction('Opened the Pokédex');
  }

  public create(): void {
    const overlay = new MenuOverlay(this, 'pokedex-menu pixel-ui', (event) => this.onKey(event));
    this.overlay = overlay;
    overlay.root.setAttribute('aria-label', 'Pokédex');
    overlay.onMeasure = (unit) => this.fitTiles(unit);
    // The cursor is answered in place: the card beside the grid is written
    // for the tile it lands on, and the screen is never drawn again for it.
    overlay.root.addEventListener('focusin', (event) => {
      const tile = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-dex]') : null;
      if (tile) {
        this.showCard(Number(tile.dataset.dex));
      }
    });
    if (this.pausedBase) {
      hideHarbourUnder(this);
    }
    this.render();
    this.time?.delayedCall?.(WARM_SOURCES_MS, () => this.warmSources());
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    const { dex } = this.state;
    return [
      { label: 'Screen', value: this.openPage === null ? 'Pokédex' : `Pokédex, ${dexNumber(this.openPage)}` },
      { label: 'Pokédex', value: `${dex.owned.length} owned, ${dex.seen.length} met, ${dex.shiny.length} shiny` },
    ];
  }

  /** For a playtest driver: the page that is open, or null on the grid. */
  public get page(): number | null {
    return this.openPage;
  }

  /** For a playtest driver: what the screen was drawn from. */
  public get pokedex(): Pokedex {
    return this.state.dex;
  }

  /**
   * Where a kind lives is asked of every tile of every map on offer the first
   * time a page wants it (`hub/pokedexSources.ts`), which is most of a second
   * on a slow machine. It is asked here, once the grid is up and being looked
   * at, so the first page opens at once.
   */
  private warmSources(): void {
    sourcesOf(kindAt(this.cursor)?.id ?? '');
    // The card beside the grid left its places out until now.
    this.showCard(this.cursor, true);
  }

  /**
   * Gives every tile as much room as the pane has with all 151 still in view
   * (`dexPitch`), before anything else on the screen is measured.
   */
  private fitTiles(unit: number): void {
    const root = this.overlay?.root;
    const main = root?.querySelector<HTMLElement>('[data-dex-main]');
    const tiles = root?.querySelector<HTMLElement>('.dex-tiles');
    if (!root || !main || !tiles) {
      return;
    }
    // The window's own frame and pixel of padding, above and below the tiles.
    const pitch = dexPitch(Math.floor(tiles.clientWidth / unit), Math.floor(main.clientHeight / unit) - 2);
    root.style.setProperty('--dex-pitch', String(pitch));
  }

  private render(): void {
    const overlay = this.overlay;
    if (!overlay) {
      return;
    }
    const { dex } = this.state;
    const page = this.openPage === null ? undefined : dexEntryBody(dex, this.openPage);
    if (page !== undefined) {
      overlay.root.innerHTML = pixelScreen({
        title: 'Pokédex',
        back: { label: 'List', attribute: 'data-dex-list' },
        aside: pixelTag(`${dex.owned.length} of ${KANTO_POKEDEX_SIZE}`),
        body: page,
        hints: ENTRY_HINTS,
      });
      overlay.root.querySelectorAll<HTMLButtonElement>('[data-dex-list]').forEach((button) => {
        button.onclick = () => this.backToList();
      });
      overlay.root.querySelectorAll<HTMLButtonElement>('[data-dex-cry]').forEach((button) => {
        button.onclick = () => this.cry();
      });
      overlay.root.querySelectorAll<HTMLButtonElement>('[data-dex-turn]').forEach((button) => {
        button.onclick = () => this.turnTo(Number(button.dataset.dexTurn));
      });
      overlay.focus('[data-cursor-start]', '[data-dex-list]');
      return;
    }
    this.openPage = null;
    overlay.root.innerHTML = pixelScreen({
      title: 'Pokédex',
      back: { label: 'Close', attribute: 'data-close' },
      // Said here only where the band has no room to say it (`.dex-aside`).
      aside: `<span class="dex-aside">${pixelTag(`${dex.owned.length} of ${KANTO_POKEDEX_SIZE}`)}</span>`,
      body: dexListBody(this.state, this.cursor),
      hints: `ARROWS move · ENTER opens a page · ${POKEDEX_KEY} close`,
    });
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((button) => {
      button.onclick = () => this.close();
    });
    overlay.root.querySelectorAll<HTMLButtonElement>('[data-dex]').forEach((button) => {
      button.onclick = () => this.openEntry(Number(button.dataset.dex));
    });
    overlay.focus(`[data-dex="${this.cursor}"]`, '[data-close]');
  }

  /** The card beside the grid, written for the tile the cursor is on. */
  private showCard(dexId: number, again = false): void {
    const overlay = this.overlay;
    if (!overlay || this.openPage !== null) {
      return;
    }
    if (dexId !== this.cursor) {
      // The cursor has moved off the tile a refusal was about.
      takeDownPixelStatus(overlay.root);
    }
    this.cursor = dexId;
    const pane = overlay.root.querySelector<HTMLElement>('[data-dex-card]');
    // Only where the card is on screen: a window too narrow for it hides it,
    // and the help bar is what names the tile there.
    if (!pane || pane.offsetParent === null || (!again && pane.dataset.dexCard === String(dexId))) {
      return;
    }
    pane.innerHTML = dexCard(this.state.dex, dexId);
    pane.dataset.dexCard = String(dexId);
    overlay.remeasure();
  }

  private onKey(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    // The key that opened it, still held, repeats: it must not close it again.
    if (event.repeat && key === POKEDEX_KEY.toLowerCase()) {
      event.preventDefault();
      return;
    }
    if (this.openPage !== null) {
      if (isOverlayDismissKey(event, 'Backspace')) {
        event.preventDefault();
        this.backToList();
        return;
      }
      if (isOverlayDismissKey(event, POKEDEX_KEY) && key !== 'escape') {
        event.preventDefault();
        this.close();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        this.turnTo(neighbourPage(this.state.dex, this.openPage, event.key === 'ArrowRight' ? 1 : -1));
        return;
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        // A page has one thing to press. Up and Down read on through where it
        // is found, when that is longer than its pane.
        event.preventDefault();
        this.overlay?.root.querySelector<HTMLElement>('.dex-where')?.scrollBy({ top: event.key === 'ArrowDown' ? 24 : -24 });
        return;
      }
      return;
    }
    if (isOverlayDismissKey(event, POKEDEX_KEY, 'Backspace')) {
      event.preventDefault();
      this.close();
      return;
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  /** ENTER on a tile: its page, or a word about why an empty ball has none. */
  private openEntry(dexId: number): void {
    const overlay = this.overlay;
    if (!overlay) {
      return;
    }
    this.cursor = dexId;
    if (dexStanding(this.state.dex, dexId) === 'unknown') {
      audioManager.play('denied');
      putUpPixelStatus(overlay.root, `${dexNumber(dexId)} has not been met yet. A fight with one puts it here.`);
      return;
    }
    audioManager.play('select');
    recordAction(`Opened ${dexNumber(dexId)} ${kindAt(dexId)?.name ?? ''}`.trim());
    this.openPage = dexId;
    // Asked for before it is wanted, so CRY sounds the sample and not its stand-in.
    void audioManager.loadCries([dexId]);
    this.render();
  }

  /** LEFT and RIGHT on a page: the next kind there is a page for, that way. */
  private turnTo(dexId: number): void {
    if (this.openPage === null || dexId === this.openPage || dexStanding(this.state.dex, dexId) === 'unknown') {
      audioManager.play('denied');
      return;
    }
    audioManager.play('select');
    this.cursor = dexId;
    this.openPage = dexId;
    void audioManager.loadCries([dexId]);
    this.render();
  }

  private cry(): void {
    if (this.openPage !== null) {
      audioManager.play('cry', { species: this.openPage });
    }
  }

  private backToList(): void {
    audioManager.play('cancel');
    this.openPage = null;
    this.render();
  }

  private close(): void {
    audioManager.play('menuClose');
    const resumeBase = this.pausedBase && this.scene.isPaused('base');
    this.pausedBase = false;
    this.scene.stop();
    if (resumeBase) {
      this.scene.resume('base');
    }
  }
}
