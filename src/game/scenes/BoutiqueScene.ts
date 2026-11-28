import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { recordAction } from '../feedback/actionLog';
import type { FeedbackDetail, ProvidesFeedbackContext } from '../feedback/feedbackContext';
import { boutiqueMarkup, honoursIfChosen, mirrorFigures, shelfStep, turningFigures, wornRows, type BoutiqueMode, type BoutiqueState } from '../look/boutiqueView';
import { honourArts, honourById, honoursEarned, honoursKey, honoursWorn, isHonourId, type HonourId } from '../look/gymHonours';
import { dressIn, type WornPackBody } from '../look/wornPack';
import { composeLook, PIECE_HEIGHT, PIECE_WIDTH } from '../look/composeLook';
import { lookKey, readLook, sameLook, wearing, type PlayerLook } from '../look/look';
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
/** The gap between two rows of cards, and the MORE strip over a pane's foot, in game pixels. */
const SHELF_ROW_GAP = 4;
const SHELF_MORE_STRIP = 13;

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
  /** The shelf on show (`data-shelf-group`): one at a time. */
  private shelf: string | undefined;
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
    this.shelf = undefined;
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

  private honoursEarned(): readonly HonourId[] {
    return this.game_ ? honoursEarned(this.game_.raidProgress.defeatedBosses) : [];
  }

  private honoursWorn(): readonly HonourId[] {
    return this.game_ ? honoursWorn(this.game_.raidProgress) : [];
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
      sheet: (look, honours) => this.sheet(look, honours ?? this.honoursWorn()),
      honours: { earned: this.honoursEarned(), worn: this.honoursWorn() },
      ...(this.status ? { status: this.status } : {}),
    };
  }

  private show(): void {
    if (!this.overlay) {
      this.overlay = new MenuOverlay(this, 'boutique-screen pixel-ui wood-floor', (event) => this.onKey(event));
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
    root.querySelectorAll<HTMLButtonElement>('[data-honour]').forEach((button) => {
      button.onclick = () => this.chooseHonour(button.dataset.honour ?? '');
    });
    root.querySelectorAll<HTMLButtonElement>('[data-shelf-step]').forEach((button) => {
      button.onclick = () => this.stepShelf(button.dataset.shelfStep === '-1' ? -1 : 1);
    });
    this.wireAction(root, '[data-buy]', () => this.buy());
    this.wireAction(root, '[data-wear-it]', () => this.wearIt());
    this.wireAction(root, '[data-put-back]', () => this.tryOn(this.wearingNow(), undefined));
    // One shelf at a time: the one the cursor is going back to, else the one
    // it was on, else the one the screen starts on.
    const going = (focusOn ? root.querySelector<HTMLElement>(focusOn) : null) ?? root.querySelector<HTMLElement>('[data-cursor-start]');
    const shelfOf = (element: Element | null): string | undefined => element?.closest<HTMLElement>('[data-shelf-group]')?.dataset.shelfGroup;
    const known = this.shelf !== undefined && root.querySelector(`[data-shelf-group="${this.shelf}"]`) !== null;
    this.showShelf(shelfOf(focusOn ? going : null) ?? (known ? this.shelf : undefined) ?? shelfOf(going) ?? root.querySelector<HTMLElement>('[data-shelf-group]')?.dataset.shelfGroup);
    if (focusOn) {
      overlay.refocus(focusOn, '[data-cursor-start]', `[data-shelf-group="${this.shelf}"] .px-card`);
    } else {
      overlay.refocus('[data-cursor-start]', `[data-shelf-group="${this.shelf}"] .px-card`);
    }
  }

  /** Shows one shelf, and names it on the pager. */
  private showShelf(shelf: string | undefined): void {
    const root = this.overlay?.root;
    if (!root || shelf === undefined) return;
    this.shelf = shelf;
    root.querySelectorAll<HTMLElement>('[data-shelf-group]').forEach((group) => {
      group.hidden = group.dataset.shelfGroup !== shelf;
    });
    root.querySelectorAll<HTMLElement>('[data-pager-name]').forEach((name) => {
      name.hidden = name.dataset.pagerName !== shelf;
    });
    this.overlay?.remeasure();
    this.fitShelf();
  }

  /**
   * Two whole rows of a shelf, wherever there is room for them: on a screen
   * too low for two rows of cards at their usual size (1280x800 under the
   * controls bar), the cards draw their figures at the art's own size, so a
   * shelf is never one row over a blank band.
   */
  private fitShelf(): void {
    const list = this.overlay?.root.querySelector<HTMLElement>('[data-shelves]');
    if (!list) return;
    list.removeAttribute('data-low');
    const card = [...list.querySelectorAll<HTMLElement>('.boutique-card')].find((each) => each.offsetParent !== null);
    if (!card) return;
    const unit = Number.parseFloat(getComputedStyle(list).getPropertyValue('--u')) || 1;
    // Two rows, the gap between them and the MORE strip that sits on the second.
    if (list.clientHeight / unit < (card.offsetHeight / unit) * 2 + SHELF_ROW_GAP + SHELF_MORE_STRIP) {
      list.setAttribute('data-low', '');
      this.overlay?.remeasure();
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

  /** A shelf on show, the list at its top and the cursor on its first card. */
  private jumpTo(shelf: string): void {
    const root = this.overlay?.root;
    const list = root?.querySelector<HTMLElement>('[data-shelves]');
    const heading = list?.querySelector<HTMLElement>(`[data-shelf="${shelf}"]`);
    if (!list || !heading) return;
    this.showShelf(shelf);
    const card = this.firstCardOf(heading);
    audioManager.play('select');
    list.scrollTop = 0;
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
    const honour = target.dataset.honour;
    if (honour && isHonourId(honour)) {
      // A gym honour shows on what is in the mirror, as ENTER would leave it.
      const mirror = this.overlay?.root.querySelector<HTMLElement>('[data-mirror]');
      if (mirror) mirror.innerHTML = mirrorFigures(this.sheet(this.trying, honoursIfChosen(this.state(), honour)));
      const worn = this.overlay?.root.querySelector<HTMLElement>('[data-worn]');
      if (worn) worn.innerHTML = wornRows({ trying: this.trying, owned: this.state().owned, honours: honoursIfChosen(this.state(), honour) });
      return;
    }
    if (target.dataset.wear) look = wearing(this.trying, target.dataset.wear);
    else if (target.dataset.whole) look = wholeLookById(target.dataset.whole)?.look;
    else if (target.hasAttribute('data-classic')) look = null;
    const shown = look === undefined ? this.trying : look;
    const mirror = this.overlay?.root.querySelector<HTMLElement>('[data-mirror]');
    if (mirror) {
      mirror.innerHTML = mirrorFigures(this.sheet(shown, this.honoursWorn()));
    }
    const turns = this.overlay?.root.querySelector<HTMLElement>('[data-mirror-turns]');
    if (turns) {
      turns.innerHTML = turningFigures(this.sheet(shown, this.honoursWorn()));
    }
    // And what it is made of, so the list under the mirror is the figure in it.
    const worn = this.overlay?.root.querySelector<HTMLElement>('[data-worn]');
    if (worn) {
      worn.innerHTML = wornRows({ trying: shown, owned: this.state().owned, honours: this.honoursWorn() });
    }
    // And the mirror says it is a try-on: it stayed headed "what you have on"
    // over a look the cursor was only pointing at (the harbour re-critic).
    const note = this.overlay?.root.querySelector<HTMLElement>('.boutique-mirror-window .px-heading small');
    if (note) {
      note.textContent = sameLook(shown, this.state().wearing) ? 'what you have on' : 'trying on';
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

  /**
   * A gym honour's card: in the wardrobe, ENTER puts it on or takes it off at
   * once - there is nothing to buy or try, so nothing waits on the bar; in the
   * shop, it says where one is won.
   */
  private chooseHonour(id: string): void {
    const honour = honourById(id);
    if (!honour || !isHonourId(id)) return;
    const card = `[data-honour="${id}"]`;
    if (this.mode === 'shop' || !this.honoursEarned().includes(id)) {
      audioManager.play('denied');
      this.status = this.honoursEarned().includes(id)
        ? `The ${honour.name} is yours: put it on or take it off at YOUR WARDROBE.`
        : `Not for sale: ${honour.leader.toUpperCase()} gives the ${honour.name} to whoever beats them.`;
      this.render(card);
      return;
    }
    const on = !this.honoursWorn().includes(id);
    const game = this.saveManager.showHonour(id, on);
    if (!game) {
      audioManager.play('denied');
      this.status = 'That did not change. Nothing has.';
      this.render(card);
      return;
    }
    audioManager.play(on ? 'confirm' : 'select');
    recordAction(`${on ? 'Put on' : 'Took off'} the ${honour.name}`);
    this.game_ = game;
    this.status = on ? `You put the ${honour.name} back on.` : `You take the ${honour.name} off. Nobody sees it now.`;
    this.render(card);
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
    if (!event.repeat && (event.key === 'q' || event.key === 'Q' || event.key === 'e' || event.key === 'E')) {
      event.preventDefault();
      this.stepShelf(event.key.toLowerCase() === 'e' ? 1 : -1);
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

  /** Q and E, Page Up and Page Down, and the pager's arrows: a shelf at a time, held at both ends. */
  private stepShelf(direction: 1 | -1): void {
    const keys = [...(this.overlay?.root.querySelectorAll<HTMLElement>('[data-shelf-group]') ?? [])].map((group) => group.dataset.shelfGroup ?? '');
    if (keys.length === 0) return;
    const current = Math.max(0, keys.indexOf(this.shelf ?? ''));
    const next = shelfStep(current, true, keys.length, direction);
    if (next === current) {
      audioManager.play('denied');
      return;
    }
    this.jumpTo(keys[next]);
  }

  private firstCardOf(heading: HTMLElement): HTMLButtonElement | undefined {
    let card = heading.nextElementSibling;
    while (card && !(card instanceof HTMLButtonElement)) card = card.nextElementSibling;
    return card instanceof HTMLButtonElement ? card : undefined;
  }

  /** A look's sheet in these gym honours as a data URL, composed once each for the life of the page. */
  private sheet(look: PlayerLook, honours: readonly HonourId[]): string {
    const key = `${lookKey(look)}~${honoursKey(honours)}`;
    const kept = sheetCache.get(key);
    if (kept) return kept;
    const url = this.drawSheet(look, honours);
    sheetCache.set(key, url);
    return url;
  }

  private drawSheet(look: PlayerLook, honours: readonly HonourId[]): string {
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
      if (honours.length > 0) {
        const classic = context.getImageData(0, 0, PIECE_WIDTH, PIECE_HEIGHT);
        this.putDressed(context, 'classic', { width: PIECE_WIDTH, under: classic.data }, honours);
      }
      return canvas.toDataURL();
    }
    const atlas = wearablesAtlas(this.textures);
    if (!atlas) return '';
    if (honours.length > 0) {
      const { under, head } = composeLook(atlas, look, 'layers');
      this.putDressed(context, 'firered', { width: PIECE_WIDTH, under, head }, honours);
      return canvas.toDataURL();
    }
    const image = context.createImageData(PIECE_WIDTH, PIECE_HEIGHT);
    image.data.set(composeLook(atlas, look));
    context.putImageData(image, 0, 0);
    return canvas.toDataURL();
  }

  /** A figure with the gym honours on, put on the canvas: drawn as it is in the harbour (`wornPack.ts`). */
  private putDressed(
    context: CanvasRenderingContext2D,
    body: WornPackBody,
    figure: Parameters<typeof dressIn>[0],
    honours: readonly HonourId[],
  ): void {
    const image = context.createImageData(PIECE_WIDTH, PIECE_HEIGHT);
    image.data.set(dressIn(figure, body, honourArts(honours)));
    context.putImageData(image, 0, 0);
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
