import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { menuClickSound } from '../audio/menuSounds';
import { menuLayer } from '../display/menuStage';
import { columnTracks, planColumns, roomFor } from './columnLayout';
import { firstMatching } from './menuFocus';
import { claimOverlayKeyboard } from './overlayKeyboard';
import { focusDirectionForKey, nextFocusIndex } from './spatialFocus';

export class MenuOverlay {
  public readonly root: HTMLElement;
  private readonly releaseKeyboard: () => void;
  private readonly artworkErrorHandler: (event: Event) => void;
  private readonly clickSoundHandler: (event: Event) => void;
  private readonly focusHandler: (event: Event) => void;
  private readonly hoverHandler: (event: Event) => void;
  private readonly resizeHandler: () => void;
  /** Which control the player was last on, so a re-render can put them back. */
  private lastFocusKey: string | null = null;

  public constructor(
    scene: Phaser.Scene,
    className: string,
    onKeyDown: (event: KeyboardEvent) => void,
  ) {
    this.root = document.createElement('section');
    this.root.className = `menu-overlay ${className}`;
    this.root.setAttribute('aria-label', 'Game menu');
    // The menu layer, not the canvas box: a screen is laid out against the
    // browser window so that room on a big display becomes rows a player can
    // see rather than the same list magnified. See `display/menuStage.ts`.
    menuLayer().append(this.root);
    // An overlay owns the keyboard for as long as it is on screen; see
    // `overlayKeyboard.ts` for why that ownership cannot live in the scenes.
    this.releaseKeyboard = claimOverlayKeyboard((event) => {
      // Every screen moves its cursor by moving focus, so focus having moved is
      // the one definition of "the cursor moved" that holds for all of them.
      const focused = document.activeElement;
      onKeyDown(event);
      if (document.activeElement !== focused && event.key.startsWith('Arrow')) {
        audioManager.play('select');
      }
    }, window);
    // Capture, so the baseline sounds before the button's own handler runs and
    // that handler's more specific effect is the one left standing.
    this.clickSoundHandler = (event) => {
      const button = (event.target as Element | null)?.closest?.('button');
      if (!button || button.disabled) {
        return;
      }
      const sound = menuClickSound(button.dataset);
      if (sound) {
        audioManager.play(sound);
      }
    };
    this.root.addEventListener('click', this.clickSoundHandler, true);
    this.artworkErrorHandler = (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.matches('.pokemon-avatar img')) {
        return;
      }
      image.remove();
      image.parentElement?.classList.add('artwork-unavailable');
    };
    this.root.addEventListener('error', this.artworkErrorHandler, true);
    // Both listeners sit on the root rather than on the controls, because every
    // screen re-renders by replacing its markup and the controls do not survive.
    this.focusHandler = (event) => {
      const control = event.target instanceof HTMLElement ? event.target : null;
      this.lastFocusKey = control ? focusKeyOf(control) : null;
      this.showHelpFor(control);
    };
    // A pixel-ui screen has one cursor, as the games it is dressed as do: the
    // pointer moves it rather than lighting a second row beside the focused one.
    this.hoverHandler = (event) => {
      if (!this.root.classList.contains('pixel-ui') || !(event.target instanceof Element)) {
        return;
      }
      const control = event.target.closest<HTMLElement>('button:not([disabled])');
      if (control && control !== document.activeElement) {
        control.focus({ preventScroll: true });
      }
    };
    this.resizeHandler = () => {
      this.relayout();
      this.markScrollCues();
    };
    // `scroll` does not bubble, so it is caught on the way down.
    this.root.addEventListener('scroll', () => this.markScrollCues(), true);
    window.addEventListener('resize', this.resizeHandler);
    // A box is as wide as its words in the face they were measured in. Boot
    // waits for Orange Kid but not for ever (`GAME_FONT_TIMEOUT_MS`), and a
    // screen snapped in the monospace fallback kept those widths when the real
    // face arrived: the starter picker's GRASS and POISON tags, a third too
    // wide, no longer fitted side by side and Bulbasaur's card stood a row
    // taller than the other two.
    document.fonts?.addEventListener?.('loadingdone', this.resizeHandler);
    this.root.addEventListener('focusin', this.focusHandler);
    this.root.addEventListener('mouseover', this.hoverHandler);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroy());
  }

  public destroy(): void {
    this.releaseKeyboard();
    this.root.removeEventListener('error', this.artworkErrorHandler, true);
    this.root.removeEventListener('click', this.clickSoundHandler, true);
    this.root.removeEventListener('focusin', this.focusHandler);
    this.root.removeEventListener('mouseover', this.hoverHandler);
    window.removeEventListener('resize', this.resizeHandler);
    document.fonts?.removeEventListener?.('loadingdone', this.resizeHandler);
    this.root.remove();
  }

  /** Starts the cursor on the first of these selectors the screen has. */
  public focus(...selectors: string[]): void {
    requestAnimationFrame(() => this.moveCursorTo(this.firstMatch(selectors)));
  }

  /**
   * Puts the cursor back after a re-render: on the control the player was on, if
   * the new markup still has it, and otherwise where `focus` would start it.
   * Toggling a row used to throw the cursor to the top of the screen, onto the
   * way out.
   */
  public refocus(...selectors: string[]): void {
    requestAnimationFrame(() => {
      const controls = this.cursorControls();
      const remembered = controls.find((control) => focusKeyOf(control) === this.lastFocusKey);
      this.moveCursorTo(remembered ?? this.firstMatch(selectors));
    });
  }

  /**
   * Moves the cursor the way an arrow key points, by where the controls are on
   * screen. Returns whether the key was one of the cursor's, so the caller knows
   * to keep it from the browser.
   */
  public moveCursor(key: string): boolean {
    const direction = focusDirectionForKey(key);
    if (!direction) {
      return false;
    }
    const controls = this.cursorControls();
    const current = controls.indexOf(document.activeElement as HTMLElement);
    const panes: HTMLElement[] = [];
    const rects = controls.map((control) => {
      const pane = scrollingAncestor(control, this.root);
      if (pane && !panes.includes(pane)) {
        panes.push(pane);
      }
      const { left, top, right, bottom } = control.getBoundingClientRect();
      return { left, top, right, bottom, ...(pane ? { group: `pane-${panes.indexOf(pane)}` } : {}) };
    });
    controls[nextFocusIndex(rects, current, direction)]?.focus();
    return true;
  }

  /**
   * Every control the cursor may rest on, *shown*.
   *
   * A screen that keeps a pane per row and hides all but one - the stash, the
   * raid party - has a hidden control for every row of every other pane, and a
   * hidden one refuses focus silently: the cursor reaches it, nothing happens,
   * and it stops dead on the row above. `offsetParent` is null for anything
   * inside `display: none`, which is what `[hidden]` resolves to here.
   */
  private cursorControls(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>(CURSOR_CONTROLS)].filter(
      (control) => control.offsetParent !== null,
    );
  }

  /** Tried one selector at a time - see `menuFocus.ts` for why a list cannot be. */
  private firstMatch(selectors: readonly string[]): HTMLElement | null {
    return firstMatching((selector) => this.root.querySelector<HTMLElement>(selector), selectors);
  }

  /**
   * Everything about a screen that can only be decided once it has been
   * measured, in the one order that works: how many columns each collection
   * takes, and then - inside the columns that answer settled - how wide each
   * box of words is.
   */
  private relayout(): void {
    this.layoutColumns();
    this.clearStickyHeads();
    this.snapTextBoxes();
  }

  /**
   * Keeps a pane from scrolling a row under its own sticky head.
   *
   * The strip that leads a list of Pokemon sticks to the top of its pane, and
   * the browser's own "bring the focused control into view" knows nothing about
   * it: at the smallest stage the strip is three lines, the cursor started on
   * the first row, the pane scrolled 24 pixels and drew that row's name behind
   * the strip. `scroll-padding-top` is what says how much of a pane is spoken
   * for, and it has to be written before the cursor is placed - which is why
   * this is in the relayout rather than beside the MORE strips, which are
   * marked after.
   */
  private clearStickyHeads(): void {
    this.root.querySelectorAll<HTMLElement>('.px-scroll').forEach((pane) => {
      const head = [...pane.children].find(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && getComputedStyle(child).position === 'sticky',
      );
      pane.style.scrollPaddingTop = head ? `${head.offsetHeight}px` : '';
    });
  }

  /**
   * Lays every collection on the screen out across the width it has.
   *
   * A pane opts in with `data-columns`, the narrowest a column of it may be in
   * game pixels; `data-columns-max` caps the count and `data-columns-widest`
   * caps a column's width, for a row of cards rather than a list of rows. The
   * tracks are counted out in `columnLayout.ts` and written here, because how
   * much room a pane has is a question only the browser can answer - and they
   * are written as whole game pixels rather than left to `1fr`, which divides
   * the room into thirds of a pixel and draws every frame in the list soft.
   */
  private layoutColumns(): void {
    const unit = Number.parseFloat(getComputedStyle(this.root).getPropertyValue('--u')) || 0;
    // How much room the screen has, as a word the stylesheet can key off. It is
    // for the one thing columns cannot say - whether a layout fits at all - and
    // exactly one rule uses it; see `roomFor`.
    if (unit > 0) {
      this.root.dataset.room = roomFor(this.root.clientWidth / unit, this.root.clientHeight / unit);
    }
    this.root.querySelectorAll<HTMLElement>('[data-columns]').forEach((pane) => {
      // Cleared first, so the room measured is the room the pane would have
      // with no columns in it - otherwise last render's tracks decide this one's.
      pane.style.removeProperty('grid-template-columns');
      const measure = Number(pane.dataset.columns) || 0;
      if (unit <= 0 || measure <= 0) {
        return;
      }
      const room = pane.clientWidth / unit;
      const plan = planColumns(room, {
        measure,
        gap: COLUMN_GAP_UNITS,
        maximum: pane.dataset.columnsMax === undefined ? undefined : Number(pane.dataset.columnsMax),
        widest: pane.dataset.columnsWidest === undefined ? undefined : Number(pane.dataset.columnsWidest),
      });
      // One column is the layout the stylesheet already draws, and saying so in
      // an inline style would stop a row stretching to the pane the way it does
      // on the narrow screen every list is still authored against.
      if (plan.columns > 1) {
        pane.style.gridTemplateColumns = columnTracks(plan, unit);
      }
    });
  }

  /**
   * Widens every box that is as wide as its words to a whole number of game
   * pixels. Text is the one thing on a pixel-ui screen whose size is not a
   * multiple of the unit, and whatever is laid out after it - a health bar
   * beside a name, the frame of a button - would otherwise start between two
   * pixels and draw its one-pixel edges soft.
   */
  private snapTextBoxes(): void {
    if (!this.root.classList.contains('pixel-ui')) {
      return;
    }
    const unit = Number.parseFloat(getComputedStyle(this.root).getPropertyValue('--u')) || 0;
    if (unit <= 0) {
      return;
    }
    const boxes = [...this.root.querySelectorAll<HTMLElement>(TEXT_SIZED_BOXES)];
    boxes.forEach((box) => { box.style.width = ''; });
    // Measured together and then written together, so this is one layout, not one a box.
    const widths = boxes.map((box) => box.getBoundingClientRect().width);
    boxes.forEach((box, index) => {
      // A box in a hidden pane measures nothing, and snapping nothing to a whole
      // pixel gave the stash's second portrait a zero-width type badge with its
      // word spilling out of it. It is snapped when its pane is shown.
      if (widths[index] > 0) {
        box.style.width = `${Math.ceil(widths[index] / unit - 0.001) * unit}px`;
      }
    });
  }

  private moveCursorTo(control: HTMLElement | null): void {
    this.relayout();
    control?.focus();
    // Focus that did not move fires no event, and the help bar was just rebuilt.
    this.showHelpFor(control);
  }

  /**
   * A control can own a detail pane: `data-shows="x"` on the control, and
   * `data-shown-by="x"` on the pane. Focusing the control swaps the pane in, so
   * a list can stay one line a row and still show the Pokemon it is naming.
   *
   * The swap is scoped to the control's own window, because a screen may hold
   * two lists that each answer for themselves - Bill's shelf and his
   * barter table are one screen and two counters. Swept across the whole
   * screen, pointing at a Potion on the shelf blanked the pane under the barter
   * table, and the table's answer only came back by pointing at the table.
   */
  private showDetailFor(control: HTMLElement | null): void {
    const shows = control?.closest<HTMLElement>('[data-shows]')?.dataset.shows;
    if (shows === undefined) {
      return;
    }
    const group = detailGroupOf(control, this.root);
    let changed = false;
    group.querySelectorAll<HTMLElement>('[data-shown-by]').forEach((pane) => {
      const hidden = pane.dataset.shownBy !== shows;
      changed ||= pane.hidden !== hidden;
      pane.hidden = hidden;
    });
    if (changed) {
      this.relayout();
    }
  }

  private showHelpFor(control: HTMLElement | null): void {
    this.showDetailFor(control);
    this.markScrollCues();
    const line = this.root.querySelector<HTMLElement>('[data-help-text]');
    if (!line) {
      return;
    }
    line.textContent =
      control?.closest<HTMLElement>('[data-help]')?.dataset.help ?? line.dataset.helpDefault ?? '';
  }

  /**
   * Marks every scrolling pane that has more below the fold, which is what the
   * stylesheet draws its MORE strip on. Asked whenever the cursor or the pointer
   * lands on a control - the focus can scroll a row into view and a detail pane
   * can change height - and whenever a pane scrolls or the screen is resized.
   */
  private markScrollCues(): void {
    const unit = Number.parseFloat(getComputedStyle(this.root).getPropertyValue('--u')) || 0;
    this.root.querySelectorAll<HTMLElement>('.px-scroll').forEach((pane) => {
      if (unit <= 0 || !hasMoreBelow(pane, unit)) {
        pane.removeAttribute('data-more');
        pane.style.removeProperty('--more-cover');
        return;
      }
      const box = pane.getBoundingClientRect();
      const rows = [...pane.querySelectorAll<HTMLElement>(SCROLL_ROWS)].map((row) => row.getBoundingClientRect());
      const cover = scrollCoverHeight(box, rows, unit);
      pane.style.setProperty('--more-cover', `${cover}px`);
      // The strip says how much is down there, because "there is more" is not
      // the same answer as "there are nine more": the first leaves a player
      // guessing whether the thing they want is one row down or off the end of
      // a list they cannot see the size of.
      const entries = [...pane.querySelectorAll<HTMLElement>(SCROLL_ENTRIES)].map((row) => row.getBoundingClientRect());
      pane.setAttribute('data-more', moreLabel(entries, box.bottom - cover));
    });
  }
}

/**
 * What the MORE strip says: how many of a pane's entries are not wholly above
 * it. An entry is a row a player could put the cursor on - a heading in a list
 * is not one of them, because nobody is looking for a heading.
 */
export function moreLabel(entries: readonly { readonly bottom: number }[], fold: number): string {
  const hidden = entries.filter((entry) => entry.bottom > fold + 0.5).length;
  return hidden > 0 ? `${hidden} MORE` : 'MORE';
}

/**
 * What a scrolling pane's rows are: the things a cut must never go through the
 * middle of. A line of a dossier is one of them - the pane under a list of
 * Pokemon is made of single lines rather than of rows, and at the smallest
 * stage the fold ran through `Level 5 · 17/17 HP` and left its top half drawn
 * with no bottom edge.
 */
const SCROLL_ROWS = 'button, .px-row, .px-subheading, .px-empty, p, .px-dossier-body small';

/** What the strip counts: the entries a player is looking for, not the bands between them. */
const SCROLL_ENTRIES = 'button, .px-empty';

/**
 * How tall the MORE strip on a pane's foot must be so that no row is left half
 * drawn above it: from the top of the first row the pane's bottom edge (less the
 * strip's own minimum) runs through, down to the edge, in whole game pixels. A
 * row cut through its waist - a price with its top half missing, a button with
 * no lower edge - reads as a fault rather than as "more below", and the strip is
 * already the cue, so it takes the whole row rather than the bottom of it. A row
 * taller than half the pane is left to be cut: covering it would hide the pane.
 */
/**
 * The window a control's detail pane lives in - the nearest `.px-window` that
 * actually holds one, not simply the nearest one.
 *
 * `.px-window` is the frame, and a button or a chip wears it too (a window that
 * is also a button keeps its frame). So `closest('.px-window')` from a chip or
 * from the KEEP THEM button on Bill's armed deal returns *that control*,
 * whose own subtree holds no panes at all - and the pane under the list stopped
 * answering for the thing being asked about. Walking up until a window with a
 * pane in it is found skips the control-shaped ones; a screen with no panes at
 * all falls back to the root, where there is nothing to swap either way.
 */
function detailGroupOf(control: HTMLElement | null, root: HTMLElement): HTMLElement {
  for (
    let node = control?.closest<HTMLElement>('.px-window') ?? null;
    node !== null;
    node = node.parentElement?.closest<HTMLElement>('.px-window') ?? null
  ) {
    if (node.querySelector('[data-shown-by]')) {
      return node;
    }
  }
  return root;
}

export function scrollCoverHeight(
  pane: { readonly top: number; readonly bottom: number },
  rows: readonly { readonly top: number; readonly bottom: number }[],
  unit: number,
): number {
  const minimum = MORE_STRIP_UNITS * unit;
  const line = pane.bottom - minimum;
  const cut = rows.filter((row) => row.top < line - 0.5 && row.bottom > line + 0.5 && row.top >= pane.top);
  const top = Math.min(line, ...cut.map((row) => row.top));
  const cover = pane.bottom - top;
  if (cover > ((pane.bottom - pane.top) * 3) / 4) {
    return minimum;
  }
  return Math.ceil(cover / unit - 0.001) * unit;
}

/**
 * Height of the MORE strip in game pixels when nothing is cut: one line of the
 * one type size, plus the rule above it. It carries a count now, so it is a line
 * of writing rather than an arrow in the margin - see `.px-scroll[data-more]::after`.
 */
const MORE_STRIP_UNITS = 13;

/**
 * Whether a scrolling pane still has content under its bottom edge.
 *
 * Measured in *game* pixels, because that is the size of the smallest thing
 * that can be down there: rows are laid out from text, so a pane routinely
 * overflows itself by a fraction of a game pixel, and asking whether that is
 * more than one *screen* pixel gave a different answer at every scale - the
 * Bill's shelf fitted its five rows at 2x and grew a MORE strip over the
 * fifth at 4x, off half a game pixel of rounding.
 */
export function hasMoreBelow(
  pane: {
    readonly scrollHeight: number;
    readonly clientHeight: number;
    readonly scrollTop: number;
  },
  unit = 1,
): boolean {
  return pane.scrollHeight - pane.clientHeight - pane.scrollTop > Math.max(1, unit);
}

/** Everything on a pixel-ui screen that takes its width from the words inside it. */
/** What the arrow keys can rest on: a text field is one, so a keyboard can reach it. */
const CURSOR_CONTROLS = 'button:not([disabled]), input:not([disabled])';

const TEXT_SIZED_BOXES = '.px-name, .px-tag, .px-button, .px-chip, .px-back, .px-type, .px-place, .px-rail li';

/**
 * Game pixels between two columns of a list. Four, as every gap on these
 * screens is: it is the stylesheet's own `--u * 4` and the width of the space
 * a window leaves round what is in it.
 */
export const COLUMN_GAP_UNITS = 4;

/** A control is the same control across renders if it carries the same wiring. */
function focusKeyOf(control: HTMLElement): string | null {
  const entries = Object.entries(control.dataset).filter(([name]) => name !== 'help');
  return entries.length === 0
    ? null
    : entries.map(([name, value]) => `${name}=${value}`).sort().join('|');
}

/**
 * The nearest ancestor that scrolls its own contents, or null. A control inside
 * one reports a position the pane may not be showing, which is why a vertical
 * move is kept inside it - see `FocusRect.group` in `spatialFocus.ts`.
 */
function scrollingAncestor(control: HTMLElement, root: HTMLElement): HTMLElement | null {
  for (let node = control.parentElement; node && node !== root; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
}
