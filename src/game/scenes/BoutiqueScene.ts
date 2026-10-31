import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import { boutiqueMarkup, mirrorFigures, shelfStep, wornRows, type BoutiqueMode, type BoutiqueState } from '../look/boutiqueView';
import { composeLook, PIECE_HEIGHT, PIECE_WIDTH } from '../look/composeLook';
import { lookKey, readLook, wearing, type PlayerLook } from '../look/look';
import { wearablesAtlas } from '../look/lookTexture';
import { ownedWearables, wholeLookById } from '../look/wardrobe';
import { BOUTIQUE_NAME } from '../look/wearables';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { MenuOverlay } from '../ui/MenuOverlay';
import { RELEASE_ARMING_MS } from '../ui/spatialFocus';
import { isOverlayDismissKey } from '../ui/overlayKeyboard';
import { SHARED_CHARACTER_TEXTURE } from '../world/characterPresentation';

export interface BoutiqueSceneData {
  readonly mode: BoutiqueMode;
  /** Only resume the harbour when this screen paused it. */
  readonly pausedBase: boolean;
}

/**
 * THE HARBOUR BOUTIQUE and the wardrobe at home: one screen over the paused
 * harbour, the way the console's GAMES menu is (`ConsoleScene`). What it says
 * is `look/boutiqueView.ts`; what may be bought and worn is
 * `look/wardrobe.ts`; the purchase and the change of clothes are
 * `SaveManager.buyAndWear` and `SaveManager.wearLook`, each one write.
 *
 * Pointing at a card - the cursor or the mouse - puts it in the mirror and
 * commits nothing; ENTER (or a click) tries it on, which is still nothing
 * until the bar along the foot buys or wears it. Leaving puts back whatever
 * was only being tried, so walking out of the shop is never a purchase.
 */
/** What the bar along the foot does. */
const BAR_ACTIONS = '[data-buy], [data-wear-it], [data-put-back]';

/** The selector that finds this card again after a redraw, or null if it is not a card. */
function cardSelector(target: HTMLElement): string | null {
  if (target.dataset.wear) return `[data-wear="${target.dataset.wear}"]`;
  if (target.dataset.whole) return `[data-whole="${target.dataset.whole}"]`;
  return target.hasAttribute('data-classic') ? '[data-classic]' : null;
}

export class BoutiqueScene extends Phaser.Scene implements ProvidesFeedbackContext {
  private overlay: MenuOverlay | undefined;
  private pausedBase = false;
  private mode: BoutiqueMode = 'shop';
  private game_: RestoredGame | undefined;
  private trying: PlayerLook = null;
  private status: string | undefined;
  /** The card the cursor last stood on, which is where it comes back to from the bar. */
  private lastCard: string | null = null;
  /** When the keyboard last tried something on and landed on the bar: see `buy`. */
  private triedOnAt = Number.NEGATIVE_INFINITY;
  private readonly saveManager = new SaveManager();

  public constructor() {
    super('boutique');
  }

  public init(data: BoutiqueSceneData): void {
    this.overlay = undefined;
    this.pausedBase = data.pausedBase;
    this.mode = data.mode;
    this.status = undefined;
    this.lastCard = null;
    this.triedOnAt = Number.NEGATIVE_INFINITY;
    this.game_ = this.saveManager.load() ?? undefined;
    this.trying = this.wearingNow();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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
    return [
      { label: 'Screen', value: this.mode === 'shop' ? BOUTIQUE_NAME : 'Wardrobe' },
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

  private show(): void {
    if (!this.overlay) {
      this.overlay = new MenuOverlay(this, 'boutique-screen pixel-ui', (event) => this.onKey(event));
      // The mirror answers whatever the cursor is on, and commits nothing.
      this.overlay.root.addEventListener('focusin', (event) => this.cursorOn(event.target));
    }
    this.overlay.root.setAttribute('aria-label', this.mode === 'shop' ? BOUTIQUE_NAME : 'Wardrobe');
    this.render();
  }

  private render(focusOn?: string): void {
    const overlay = this.overlay;
    if (!overlay) {
      return;
    }
    const root = overlay.root;
    // Kept where it was: the shelves hold two hundred pieces, and the cursor can
    // go down to the bar and come back to the card it left.
    overlay.redraw(boutiqueMarkup(this.state()));
    root.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.close();
    root.querySelectorAll<HTMLButtonElement>('[data-wear]').forEach((button) => {
      button.onclick = (event) =>
        this.tryOnCard(wearing(this.trying, button.dataset.wear ?? ''), `[data-wear="${button.dataset.wear}"]`, event);
    });
    root.querySelectorAll<HTMLButtonElement>('[data-whole]').forEach((button) => {
      const whole = wholeLookById(button.dataset.whole ?? '');
      button.onclick = (event) => whole && this.tryOnCard(whole.look, `[data-whole="${whole.id}"]`, event);
    });
    root.querySelector<HTMLButtonElement>('[data-classic]')!.onclick = (event) => this.tryOnCard(null, '[data-classic]', event);
    root.querySelectorAll<HTMLButtonElement>('[data-jump]').forEach((button) => {
      button.onclick = () => this.jumpTo(button.dataset.jump ?? '');
    });
    this.wireAction(root, '[data-buy]', () => this.buy());
    this.wireAction(root, '[data-wear-it]', () => this.wearIt());
    this.wireAction(root, '[data-put-back]', () => this.tryOn(this.wearingNow(), undefined));
    if (focusOn) {
      overlay.refocus(focusOn, '[data-cursor-start]');
    } else {
      overlay.refocus('[data-cursor-start]');
    }
  }

  private wireAction(root: HTMLElement, selector: string, act: () => void): void {
    const button = root.querySelector<HTMLButtonElement>(selector);
    if (!button) return;
    button.onclick = () => {
      if (button.getAttribute('aria-disabled') === 'true') {
        audioManager.play('denied');
        return;
      }
      act();
    };
  }

  /** A jump chip: the shelf's heading to the top of the list, and the cursor on its first card. */
  private jumpTo(shelf: string): void {
    const root = this.overlay?.root;
    const list = root?.querySelector<HTMLElement>('[data-shelves]');
    const heading = list?.querySelector<HTMLElement>(`[data-shelf="${shelf}"]`);
    if (!list || !heading) return;
    const card = this.firstCardOf(heading);
    audioManager.play('select');
    list.scrollTop = heading.offsetTop - list.offsetTop;
    card?.focus({ preventScroll: true });
  }

  /** The cursor has landed somewhere: the mirror answers, and a card is remembered to come back to. */
  private cursorOn(target: EventTarget | null): void {
    if (!(target instanceof HTMLElement)) return;
    const card = cardSelector(target);
    if (card) this.lastCard = card;
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
      worn.innerHTML = wornRows({ trying: shown, owned: this.state().owned });
    }
  }

  /**
   * A card tried on. By the keyboard the cursor goes to the bar, because that is
   * what trying something on is for, and the bar was out of reach: Down walks the
   * shelves, two hundred pieces of it, and a playtest gave up after fifteen presses
   * with BUY still on the screen. The mirror has already shown it; Up comes back to
   * this card. The mouse is left where it is: it can reach the bar for itself.
   */
  private tryOnCard(look: PlayerLook, card: string, event: MouseEvent): void {
    this.tryOn(look, card);
    // A key on a button is a click no pointer made.
    if (event.detail !== 0) return;
    this.overlay?.focus('[data-buy]', '[data-wear-it]:not([aria-disabled="true"])', card);
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
    this.render('[data-put-back]');
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
    this.render('[data-put-back]');
  }

  private onKey(event: KeyboardEvent): void {
    if (isOverlayDismissKey(event)) {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'PageDown' || event.key === 'PageUp') {
      event.preventDefault();
      this.stepShelf(event.key === 'PageDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Tab' || event.key === 'ArrowUp') {
      if (this.crossToOrFromBar(event.key)) {
        event.preventDefault();
        return;
      }
    }
    if (this.overlay?.moveCursor(event.key)) {
      event.preventDefault();
    }
  }

  /**
   * Tab goes straight between the shelves and the bar, whichever the cursor is
   * in, and Up from the bar goes back to the card it left rather than to whatever
   * is nearest the button. Says whether it moved the cursor.
   */
  private crossToOrFromBar(key: string): boolean {
    const root = this.overlay?.root;
    const at = document.activeElement;
    const onBar = at instanceof Element && at.matches(BAR_ACTIONS);
    if (!root || (key === 'ArrowUp' && !onBar)) return false;
    const target = onBar
      ? ((this.lastCard ? root.querySelector<HTMLElement>(this.lastCard) : null) ?? root.querySelector<HTMLElement>('[data-cursor-start]'))
      : root.querySelector<HTMLElement>(`[data-buy], [data-wear-it]:not([aria-disabled="true"]), [data-put-back]:not([aria-disabled="true"])`);
    if (!target) return false;
    audioManager.play('select');
    target.focus();
    return true;
  }

  /** Page Down and Page Up: a shelf at a time, from the one the cursor is in. */
  private stepShelf(direction: 1 | -1): void {
    const headings = [...(this.overlay?.root.querySelectorAll<HTMLElement>('[data-shelves] [data-shelf]') ?? [])];
    if (headings.length === 0) return;
    const at = document.activeElement;
    const inside = at instanceof HTMLElement && at.closest('[data-shelves]') !== null;
    // The shelf the cursor is in is the last heading before it; off the list, it is before the first.
    const current = inside
      ? headings.reduce((found, heading, index) => (heading.compareDocumentPosition(at) & Node.DOCUMENT_POSITION_FOLLOWING ? index : found), 0)
      : -1;
    const first = current < 0 ? undefined : this.firstCardOf(headings[current]);
    const next = current < 0 ? (direction === 1 ? 0 : -1) : shelfStep(current, at === first, headings.length, direction);
    if (next < 0) return;
    this.jumpTo(headings[next].dataset.shelf ?? '');
  }

  private firstCardOf(heading: HTMLElement): HTMLButtonElement | undefined {
    let card = heading.nextElementSibling;
    while (card && !(card instanceof HTMLButtonElement)) card = card.nextElementSibling;
    return card instanceof HTMLButtonElement ? card : undefined;
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
