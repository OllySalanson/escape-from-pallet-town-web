import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import {
  boutiqueMarkup,
  CARD_GAP,
  CARD_HEIGHT,
  CARD_MIN_WIDTH,
  gridMove,
  mirrorFigures,
  pageCount,
  pageShape,
  pageWords,
  shelfPage,
  shelvesFor,
  TIGHT_CARD_HEIGHT,
  TIGHT_CARD_MIN_WIDTH,
  wornRows,
  type BoutiqueMode,
  type BoutiqueState,
  type Shelf,
  type ShelfView,
} from '../look/boutiqueView';
import { composeLook, PIECE_HEIGHT, PIECE_WIDTH } from '../look/composeLook';
import { lookKey, readLook, wearing, type PlayerLook } from '../look/look';
import { wearablesAtlas } from '../look/lookTexture';
import { ownedWearables, wholeLookById } from '../look/wardrobe';
import { BOUTIQUE_NAME } from '../look/wearables';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { MenuOverlay } from '../ui/MenuOverlay';
import { focusDirectionForKey, RELEASE_ARMING_MS } from '../ui/spatialFocus';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { SHARED_CHARACTER_TEXTURE } from '../world/characterPresentation';

export interface BoutiqueSceneData {
  readonly mode: BoutiqueMode;
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
}

/** What the bar along the foot does. */
const BAR_ACTIONS = '[data-buy], [data-wear-it], [data-put-back]';
/** The bar's controls the cursor may stand on: the ones that would do something. */
const BAR_LIVE = '[data-buy], [data-wear-it]:not([aria-disabled="true"]), [data-put-back]:not([aria-disabled="true"])';
/** W, A, S and D are the arrows here, as they are walking. */
const WASD: Readonly<Record<string, string>> = { KeyW: 'ArrowUp', KeyA: 'ArrowLeft', KeyS: 'ArrowDown', KeyD: 'ArrowRight' };
/** A wheel turns at most a page this often, however fast it spins. */
const WHEEL_PAGE_MS = 220;
/** How many cards a page holds before the shelf has been measured. */
const FIRST_SHAPE = { perPage: 8, columns: 4 } as const;

/**
 * THE HARBOUR BOUTIQUE and the wardrobe at home: one screen over the paused
 * harbour, the way the console's GAMES menu is (`ConsoleScene`). What it says
 * is `look/boutiqueView.ts`; what may be bought and worn is
 * `look/wardrobe.ts`; the purchase and the change of clothes are
 * `SaveManager.buyAndWear` and `SaveManager.wearLook`, each one write.
 *
 * The shelves are a page at a time: as many whole cards as the shelf's room
 * holds, measured once the screen is laid out (`measure`), and a page is turned
 * by walking the cursor off its side, by its arrows, by Page Up and Page Down or
 * by the wheel - in one step, never a scroll to wherever the browser stops.
 *
 * Pointing at a card - the cursor or the mouse - puts it in the mirror and
 * commits nothing; ENTER (or a click) tries it on, which is still nothing
 * until the bar along the foot buys or wears it. Leaving puts back whatever
 * was only being tried, so walking out of the shop is never a purchase.
 */
export class BoutiqueScene extends Phaser.Scene implements ProvidesFeedbackContext {
  private overlay: MenuOverlay | undefined;
  private pausedBase = false;
  private mode: BoutiqueMode = 'shop';
  private game_: RestoredGame | undefined;
  private trying: PlayerLook = null;
  private status: string | undefined;
  private view: ShelfView = { shelf: 0, page: 0, ...FIRST_SHAPE };
  /** The card the cursor last stood on, by its place on the page: where it comes back to from the tabs and the bar. */
  private lastCard: number | null = null;
  /** When the keyboard last tried something on and landed on the bar: see `buy`. */
  private triedOnAt = Number.NEGATIVE_INFINITY;
  /** When the wheel last turned a page. */
  private wheeledAt = Number.NEGATIVE_INFINITY;
  private measureFrame: number | undefined;
  private readonly saveManager = new SaveManager();
  private readonly onResize = (): void => this.measureSoon();

  public constructor() {
    super('boutique');
  }

  public init(data: BoutiqueSceneData): void {
    this.overlay = undefined;
    this.pausedBase = data.pausedBase;
    this.mode = data.mode;
    this.status = undefined;
    this.view = { shelf: 0, page: 0, ...FIRST_SHAPE };
    this.lastCard = null;
    this.triedOnAt = Number.NEGATIVE_INFINITY;
    this.wheeledAt = Number.NEGATIVE_INFINITY;
    this.game_ = this.saveManager.load() ?? undefined;
    this.trying = this.wearingNow();
    window.addEventListener('resize', this.onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('resize', this.onResize);
      if (this.measureFrame !== undefined) cancelAnimationFrame(this.measureFrame);
      this.measureFrame = undefined;
      this.overlay?.destroy();
      this.overlay = undefined;
    });
    recordAction(this.mode === 'shop' ? `Opened ${BOUTIQUE_NAME}` : 'Opened the wardrobe');
    this.show();
  }

  public create(): void {
    // Everything is drawn in the page over the paused harbour.
  }

  public feedbackContext(): readonly FeedbackDetail[] {
    const shelf = this.shelves()[this.view.shelf];
    return [
      { label: 'Screen', value: this.mode === 'shop' ? BOUTIQUE_NAME : 'Wardrobe' },
      { label: 'Shelf', value: shelf ? `${shelf.tab}, ${pageWords(shelf, this.view) || 'one page'}` : 'none' },
      { label: 'Trying on', value: lookKey(this.trying) },
    ];
  }

  private wearingNow(): PlayerLook {
    return readLook(this.game_?.raidProgress.look);
  }

  private state(): BoutiqueState {
    const stash = this.game_?.stash;
    return {
      mode: this.mode,
      trying: this.trying,
      wearing: this.wearingNow(),
      owned: ownedWearables(this.game_?.raidProgress.wardrobe, stash),
      held: (itemId) => stash?.itemCount(itemId) ?? 0,
      sheet: (look) => this.sheet(look),
      ...(this.status ? { status: this.status } : {}),
    };
  }

  private shelves(): readonly Shelf[] {
    return shelvesFor(this.state());
  }

  private show(): void {
    if (!this.overlay) {
      this.overlay = new MenuOverlay(this, 'boutique-screen pixel-ui', (event) => this.onKey(event));
      const root = this.overlay.root;
      // The mirror answers whatever the cursor is on, and commits nothing.
      root.addEventListener('focusin', (event) => this.cursorOn(event.target));
      root.addEventListener('click', (event) => this.onClick(event));
      root.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
    }
    this.overlay.root.setAttribute('aria-label', this.mode === 'shop' ? BOUTIQUE_NAME : 'Wardrobe');
    this.render();
  }

  /** The whole screen again, on the same shelf and page: after a try-on, a purchase or a change. */
  private render(focusOn?: string): void {
    const overlay = this.overlay;
    if (!overlay) {
      return;
    }
    this.view = { ...this.view, shelf: Math.min(this.view.shelf, Math.max(0, this.shelves().length - 1)) };
    overlay.redraw(boutiqueMarkup(this.state(), this.view));
    // Measured now, before the cursor is placed: the screen is in the page, so
    // its room can be read at once, and a page cut again after the cursor was
    // put on it would take the cursor with it.
    this.measure();
    this.markTurns();
    if (focusOn) {
      overlay.refocus(focusOn, '[data-cursor-start]');
    } else {
      overlay.refocus('[data-cursor-start]');
    }
  }

  /** Measured again once a resized window is laid out: how many whole cards the shelf holds. */
  private measureSoon(): void {
    if (this.measureFrame !== undefined) cancelAnimationFrame(this.measureFrame);
    this.measureFrame = requestAnimationFrame(() => {
      this.measureFrame = undefined;
      this.measure();
    });
  }

  /**
   * Counts the page out from the room the shelf has, and draws the page again
   * if it holds a different number of cards - keeping the card the cursor is on
   * on screen, and the cursor on it.
   */
  private measure(): void {
    const root = this.overlay?.root;
    const grid = root?.querySelector<HTMLElement>('[data-page-grid]');
    const unit = root ? Number.parseFloat(getComputedStyle(root).getPropertyValue('--u')) || 0 : 0;
    if (!root || !grid || unit <= 0) return;
    this.overlay?.layout();
    const width = grid.clientWidth / unit;
    const height = grid.clientHeight / unit;
    const tight = root.dataset.room === 'tight';
    const { columns, rows } = pageShape(width, height, {
      height: this.cardHeight(),
      minWidth: tight ? TIGHT_CARD_MIN_WIDTH : CARD_MIN_WIDTH,
      gap: CARD_GAP,
    });
    const perPage = columns * rows;
    const same = perPage === this.view.perPage && columns === this.view.columns;
    if (!same) {
      const focused = this.focusedCard();
      const first = this.view.page * this.view.perPage + (focused ?? this.lastCard ?? 0);
      const page = Math.floor(first / perPage);
      this.view = { ...this.view, perPage, columns, page };
      this.drawPage(focused === null ? null : first - page * perPage, 0);
    }
    this.shapePage(grid);
    grid.dataset.measured = '';
  }

  private cardHeight(): number {
    return this.overlay?.root.dataset.room === 'tight' ? TIGHT_CARD_HEIGHT : CARD_HEIGHT;
  }

  /** The page's columns as whole game pixels, which `1fr` would share out in thirds of one and draw every frame soft. */
  private shapePage(grid: HTMLElement | null | undefined): void {
    const root = this.overlay?.root;
    const unit = root ? Number.parseFloat(getComputedStyle(root).getPropertyValue('--u')) || 0 : 0;
    if (!grid || unit <= 0) return;
    const columns = this.view.columns;
    const track = Math.max(1, Math.floor((grid.clientWidth / unit - CARD_GAP * (columns - 1)) / columns));
    grid.style.setProperty('--columns', String(columns));
    grid.style.setProperty('--track', String(track));
    grid.style.setProperty('--card-height', String(this.cardHeight()));
  }

  /**
   * Draws the shelf's page in place - the tabs, the cards, the page count and
   * its arrows - and puts the cursor on the card at `focusIndex` on it. The
   * mirror and the bar stay as they are, so the figures keep walking.
   */
  private drawPage(focusIndex: number | null, turned: -1 | 0 | 1): void {
    const root = this.overlay?.root;
    const grid = root?.querySelector<HTMLElement>('[data-page-grid]');
    if (!root || !grid) return;
    const shelves = this.shelves();
    const shelf = shelves[this.view.shelf];
    grid.innerHTML = shelfPage(this.state(), shelf, this.view);
    grid.classList.remove('is-turning-next', 'is-turning-back');
    if (turned !== 0) {
      // Read back so the animation starts again on a second turn the same way.
      void grid.offsetWidth;
      grid.classList.add(turned === 1 ? 'is-turning-next' : 'is-turning-back');
    }
    root.querySelectorAll<HTMLElement>('[data-tab]').forEach((tab) => {
      tab.classList.toggle('is-here', Number(tab.dataset.tab) === this.view.shelf);
    });
    const note = root.querySelector<HTMLElement>('.boutique-shelves-window > .px-heading small');
    if (note && shelf) note.textContent = pageWords(shelf, this.view);
    this.markTurns();
    if (focusIndex !== null) {
      const cards = grid.querySelectorAll<HTMLElement>('[data-index]');
      cards[Math.max(0, Math.min(focusIndex, cards.length - 1))]?.focus({ preventScroll: true });
    }
  }

  /** The arrows either side of the page: lit while there is a page that way. */
  private markTurns(): void {
    const root = this.overlay?.root;
    const shelf = this.shelves()[this.view.shelf];
    const pages = pageCount(shelf?.cards.length ?? 0, this.view.perPage);
    root?.querySelectorAll<HTMLButtonElement>('[data-turn]').forEach((button) => {
      const step = Number(button.dataset.turn);
      button.disabled = this.view.page + step < 0 || this.view.page + step >= pages;
    });
  }

  /** Where the cursor is on the page, if it is on a card. */
  private focusedCard(): number | null {
    const at = document.activeElement;
    if (!(at instanceof HTMLElement) || !this.overlay?.root.contains(at) || at.dataset.index === undefined) return null;
    return Number(at.dataset.index);
  }

  /** A page that way, if there is one; the cursor keeps its place on the page if it was on one. */
  private turnPage(step: -1 | 1): boolean {
    const shelf = this.shelves()[this.view.shelf];
    const page = this.view.page + step;
    if (!shelf || page < 0 || page >= pageCount(shelf.cards.length, this.view.perPage)) return false;
    const focused = this.focusedCard();
    this.view = { ...this.view, page };
    audioManager.play('select');
    this.drawPage(focused, step);
    return true;
  }

  /** Another shelf, at its first page, with the cursor on its tab. */
  private openShelf(index: number): void {
    const shelves = this.shelves();
    if (index < 0 || index >= shelves.length) return;
    if (index !== this.view.shelf) {
      this.view = { ...this.view, shelf: index, page: 0 };
      this.lastCard = null;
      audioManager.play('select');
      this.drawPage(null, 0);
    }
    this.overlay?.root.querySelector<HTMLElement>(`[data-tab="${index}"]`)?.focus({ preventScroll: true });
  }

  private onClick(event: MouseEvent): void {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (!button || !this.overlay?.root.contains(button)) return;
    const data = button.dataset;
    if (data.close !== undefined) {
      this.close();
    } else if (data.tab !== undefined) {
      this.openShelf(Number(data.tab));
    } else if (data.turn !== undefined) {
      this.turnPage(Number(data.turn) < 0 ? -1 : 1);
    } else if (data.wear !== undefined) {
      this.tryOnCard(wearing(this.trying, data.wear), event);
    } else if (data.whole !== undefined) {
      const whole = wholeLookById(data.whole);
      if (whole) this.tryOnCard(whole.look, event);
    } else if (button.hasAttribute('data-classic')) {
      this.tryOnCard(null, event);
    } else if (button.matches(BAR_ACTIONS)) {
      if (button.getAttribute('aria-disabled') === 'true') {
        audioManager.play('denied');
      } else if (data.buy !== undefined) {
        this.buy();
      } else if (data.wearIt !== undefined) {
        this.wearIt();
      } else {
        this.tryOn(this.wearingNow(), undefined);
      }
    }
  }

  /** The wheel over the shelves turns a page, a notch at a time. */
  private onWheel(event: WheelEvent): void {
    const over = event.target instanceof Element ? event.target.closest('.boutique-shelf') : null;
    if (!over || event.deltaY === 0) return;
    event.preventDefault();
    if (performance.now() - this.wheeledAt < WHEEL_PAGE_MS) return;
    if (this.turnPage(event.deltaY > 0 ? 1 : -1)) this.wheeledAt = performance.now();
  }

  /** The cursor has landed somewhere: the mirror answers, and a card is remembered to come back to. */
  private cursorOn(target: EventTarget | null): void {
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.index !== undefined) this.lastCard = Number(target.dataset.index);
    this.preview(target);
  }

  private preview(target: HTMLElement): void {
    let look: PlayerLook | undefined;
    if (target.dataset.wear) look = wearing(this.trying, target.dataset.wear);
    else if (target.dataset.whole) look = wholeLookById(target.dataset.whole)?.look;
    else if (target.hasAttribute('data-classic')) look = null;
    const shown = look === undefined ? this.trying : look;
    const mirror = this.overlay?.root.querySelector<HTMLElement>('[data-mirror]');
    if (mirror) {
      mirror.innerHTML = mirrorFigures(this.sheet(shown));
    }
    // And what it is made of, so the list under the mirror is the figure in it.
    const worn = this.overlay?.root.querySelector<HTMLElement>('[data-worn]');
    if (worn) {
      const state = this.state();
      worn.innerHTML = wornRows({ trying: shown, owned: state.owned, held: state.held });
    }
  }

  /**
   * A card tried on. By the keyboard the cursor goes to the bar, because that is
   * what trying something on is for; the mirror has already shown it, and Up
   * comes back to this card. The mouse is left where it is: it can reach the
   * bar for itself.
   */
  private tryOnCard(look: PlayerLook, event: MouseEvent): void {
    const card = this.focusedCard() ?? this.lastCard;
    const selector = card === null ? undefined : `[data-index="${card}"]`;
    this.tryOn(look, selector);
    // A key on a button is a click no pointer made.
    if (event.detail !== 0) return;
    this.overlay?.focus('[data-buy]', '[data-wear-it]:not([aria-disabled="true"])', ...(selector ? [selector] : []));
    this.triedOnAt = performance.now();
  }

  private tryOn(look: PlayerLook, focusOn: string | undefined): void {
    audioManager.play('select');
    this.trying = look;
    this.status = undefined;
    this.render(focusOn);
  }

  private buy(): void {
    // ENTER tried it on and the cursor is now on BUY, so the second press of a
    // double-tap must not be what spends the money.
    if (performance.now() - this.triedOnAt < RELEASE_ARMING_MS) return;
    if (!this.trying) return;
    const result = this.saveManager.buyAndWear(this.trying);
    if (!result.ok || !result.game) {
      audioManager.play('denied');
      this.status = result.message;
      this.render('[data-buy]');
      return;
    }
    audioManager.play('itemObtained');
    recordAction(`Bought a look at ${BOUTIQUE_NAME}`);
    this.game_ = result.game;
    this.trying = this.wearingNow();
    this.status = result.message;
    this.render(this.lastCard === null ? undefined : `[data-index="${this.lastCard}"]`);
  }

  private wearIt(): void {
    const game = this.saveManager.wearLook(this.trying);
    if (!game) {
      audioManager.play('denied');
      this.status = 'That did not go on. Nothing has changed.';
      this.render();
      return;
    }
    audioManager.play('confirm');
    this.game_ = game;
    this.trying = this.wearingNow();
    this.status = this.mode === 'shop' ? 'You change in the fitting room.' : 'You change into it.';
    this.render(this.lastCard === null ? undefined : `[data-index="${this.lastCard}"]`);
  }

  private onKey(event: KeyboardEvent): void {
    if (isOverlayDismissKey(event)) {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'PageDown' || event.key === 'PageUp') {
      event.preventDefault();
      this.turnPage(event.key === 'PageDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      this.crossToOrFromBar();
      return;
    }
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
    const key = plain ? (WASD[event.code] ?? event.key) : event.key;
    const direction = focusDirectionForKey(key);
    if (!direction) return;
    event.preventDefault();
    const before = document.activeElement;
    this.move(direction, key);
    // The overlay sounds a cursor moved by an arrow; W, A, S and D are heard here.
    if (!event.key.startsWith('Arrow') && document.activeElement !== before) audioManager.play('select');
  }

  /**
   * One arrow key, and the cursor goes one place: across a row of cards and
   * over the page's edge, up to the shelf's tab, down to the bar. On the tabs
   * Left and Right go from shelf to shelf; on the bar, from button to button.
   */
  private move(direction: 'up' | 'down' | 'left' | 'right', key: string): void {
    const root = this.overlay?.root;
    const at = document.activeElement;
    if (!root || !(at instanceof HTMLElement) || !root.contains(at)) {
      this.overlay?.moveCursor(key);
      return;
    }
    if (at.dataset.index !== undefined) {
      const shelf = this.shelves()[this.view.shelf];
      const move = gridMove({ page: this.view.page, index: Number(at.dataset.index) }, direction, {
        count: shelf?.cards.length ?? 0,
        perPage: this.view.perPage,
        columns: this.view.columns,
      });
      if (move.to === 'card') {
        if (move.page !== this.view.page) {
          this.view = { ...this.view, page: move.page };
          this.drawPage(move.index, move.turned);
        } else {
          root.querySelector<HTMLElement>(`[data-page-grid] [data-index="${move.index}"]`)?.focus({ preventScroll: true });
        }
      } else if (move.to === 'tabs') {
        root.querySelector<HTMLElement>(`[data-tab="${this.view.shelf}"]`)?.focus({ preventScroll: true });
      } else if (move.to === 'bar') {
        root.querySelector<HTMLElement>(BAR_LIVE)?.focus({ preventScroll: true });
      }
      return;
    }
    if (at.dataset.tab !== undefined) {
      if (direction === 'left' || direction === 'right') {
        this.openShelf(Number(at.dataset.tab) + (direction === 'right' ? 1 : -1));
      } else if (direction === 'down') {
        this.backToCard();
      }
      return;
    }
    if (at.matches(BAR_ACTIONS)) {
      if (direction === 'up') {
        this.backToCard();
      } else if (direction === 'left' || direction === 'right') {
        const live = [...root.querySelectorAll<HTMLElement>(BAR_LIVE)];
        const here = live.indexOf(at);
        live[here + (direction === 'right' ? 1 : -1)]?.focus({ preventScroll: true });
      }
      return;
    }
    this.overlay?.moveCursor(key);
  }

  /** The card the cursor last stood on, or the page's first. */
  private backToCard(): void {
    const cards = this.overlay?.root.querySelectorAll<HTMLElement>('[data-page-grid] [data-index]');
    if (!cards || cards.length === 0) return;
    cards[Math.min(this.lastCard ?? 0, cards.length - 1)].focus({ preventScroll: true });
  }

  /**
   * Tab goes straight between the shelves and the bar, whichever the cursor is
   * in, and back to the card it left rather than to whatever is nearest the
   * button. Says whether it moved the cursor.
   */
  private crossToOrFromBar(): boolean {
    const root = this.overlay?.root;
    const at = document.activeElement;
    const onBar = at instanceof Element && at.matches(BAR_ACTIONS);
    if (!root) return false;
    if (onBar) {
      this.backToCard();
      audioManager.play('select');
      return true;
    }
    const target = root.querySelector<HTMLElement>(BAR_LIVE);
    if (!target) return false;
    audioManager.play('select');
    target.focus();
    return true;
  }

  /** A look's sheet as a data URL, composed once a look for the life of the page. */
  private sheet(look: PlayerLook): string {
    const key = lookKey(look);
    const kept = sheetCache.get(key);
    if (kept) return kept;
    const url = this.drawSheet(look);
    sheetCache.set(key, url);
    return url;
  }

  private drawSheet(look: PlayerLook): string {
    const canvas = document.createElement('canvas');
    canvas.width = PIECE_WIDTH;
    canvas.height = PIECE_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) return '';
    if (!look) {
      // The classic figure is its own sheet; its first four columns are the same grid.
      const source = this.textures.exists(SHARED_CHARACTER_TEXTURE)
        ? (this.textures.get(SHARED_CHARACTER_TEXTURE).getSourceImage() as CanvasImageSource)
        : undefined;
      if (source) context.drawImage(source, 0, 0, PIECE_WIDTH, PIECE_HEIGHT, 0, 0, PIECE_WIDTH, PIECE_HEIGHT);
      return canvas.toDataURL();
    }
    const atlas = wearablesAtlas(this.textures);
    if (!atlas) return '';
    const image = context.createImageData(PIECE_WIDTH, PIECE_HEIGHT);
    image.data.set(composeLook(atlas, look));
    context.putImageData(image, 0, 0);
    return canvas.toDataURL();
  }

  private close(): void {
    if (!this.scene.isActive('boutique')) {
      return;
    }
    const resumeBase = this.pausedBase && this.scene.isPaused('base');
    this.pausedBase = false;
    audioManager.play('menuClose');
    this.scene.stop();
    if (resumeBase) {
      this.scene.resume('base');
    }
  }
}

/** Sheets composed this page, kept across visits: a look is the same picture every time. */
const sheetCache = new Map<string, string>();
