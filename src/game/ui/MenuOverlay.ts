import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { menuClickSound } from '../audio/menuSounds';
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
    document.getElementById('app')?.append(this.root);
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
      this.snapTextBoxes();
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
      const controls = [...this.root.querySelectorAll<HTMLElement>(CURSOR_CONTROLS)];
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
    const controls = [...this.root.querySelectorAll<HTMLElement>(CURSOR_CONTROLS)];
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

  /** Tried one selector at a time - see `menuFocus.ts` for why a list cannot be. */
  private firstMatch(selectors: readonly string[]): HTMLElement | null {
    return firstMatching((selector) => this.root.querySelector<HTMLElement>(selector), selectors);
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
    this.snapTextBoxes();
    control?.focus();
    // Focus that did not move fires no event, and the help bar was just rebuilt.
    this.showHelpFor(control);
  }

  /**
   * A control can own a detail pane: `data-shows="x"` on the control, and
   * `data-shown-by="x"` on the pane. Focusing the control swaps the pane in, so
   * a list can stay one line a row and still show the Pokemon it is naming.
   */
  private showDetailFor(control: HTMLElement | null): void {
    const shows = control?.closest<HTMLElement>('[data-shows]')?.dataset.shows;
    if (shows === undefined) {
      return;
    }
    let changed = false;
    this.root.querySelectorAll<HTMLElement>('[data-shown-by]').forEach((pane) => {
      const hidden = pane.dataset.shownBy !== shows;
      changed ||= pane.hidden !== hidden;
      pane.hidden = hidden;
    });
    if (changed) {
      this.snapTextBoxes();
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
      const more = hasMoreBelow(pane);
      pane.toggleAttribute('data-more', more);
      if (!more || unit <= 0) {
        pane.style.removeProperty('--more-cover');
        return;
      }
      const box = pane.getBoundingClientRect();
      const rows = [...pane.querySelectorAll<HTMLElement>(SCROLL_ROWS)].map((row) => row.getBoundingClientRect());
      const cover = scrollCoverHeight(box, rows, unit);
      pane.style.setProperty('--more-cover', `${cover}px`);
    });
  }
}

/** What a scrolling pane's rows are: the things a cut must never go through the middle of. */
const SCROLL_ROWS = 'button, .px-row, .px-subheading, .px-empty, p';

/**
 * How tall the MORE strip on a pane's foot must be so that no row is left half
 * drawn above it: from the top of the first row the pane's bottom edge (less the
 * strip's own minimum) runs through, down to the edge, in whole game pixels. A
 * row cut through its waist - a price with its top half missing, a button with
 * no lower edge - reads as a fault rather than as "more below", and the strip is
 * already the cue, so it takes the whole row rather than the bottom of it. A row
 * taller than half the pane is left to be cut: covering it would hide the pane.
 */
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

/** Height of the MORE strip in game pixels when nothing is cut: see `.px-scroll[data-more]::after`. */
const MORE_STRIP_UNITS = 7;

/** Whether a scrolling pane still has content under its bottom edge. Half a pixel is rounding, not content. */
export function hasMoreBelow(pane: {
  readonly scrollHeight: number;
  readonly clientHeight: number;
  readonly scrollTop: number;
}): boolean {
  return pane.scrollHeight - pane.clientHeight - pane.scrollTop > 1;
}

/** Everything on a pixel-ui screen that takes its width from the words inside it. */
/** What the arrow keys can rest on: a text field is one, so a keyboard can reach it. */
const CURSOR_CONTROLS = 'button:not([disabled]), input:not([disabled])';

const TEXT_SIZED_BOXES = '.px-name, .px-tag, .px-button, .px-chip, .px-back, .px-type, .px-place, .px-rail li';

/** A control is the same control across renders if it carries the same wiring. */
function focusKeyOf(control: HTMLElement): string | null {
  const entries = Object.entries(control.dataset).filter(([name]) => name !== 'help');
  return entries.length === 0
    ? null
    : entries.map(([name, value]) => `${name}=${value}`).sort().join('|');
}

export function pokemonAvatar(dexId: number, name: string): string {
  return `<span class="pokemon-avatar" aria-label="${name}"><img src="/assets/pokemon/front/${dexId}.png" alt="${name} artwork" /><span aria-hidden="true">${name.slice(0, 1)}</span></span>`;
}

export function hpBar(current: number, max: number): string {
  const ratio = max === 0 ? 0 : Math.max(0, Math.min(1, current / max));
  const state = ratio > 0.5 ? 'healthy' : ratio > 0.2 ? 'warning' : 'critical';
  return `<div class="hp-track" aria-label="HP ${current} of ${max}"><span class="${state}" style="width:${ratio * 100}%"></span></div>`;
}

export function typeBadge(type: string): string {
  return `<span class="type-badge type-${type.toLowerCase()}">${type}</span>`;
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
