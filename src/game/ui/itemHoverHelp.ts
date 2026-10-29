import { getItemById } from '../items';
import { splitDescribeKey } from './hoverDescribe';
import { escapeAttribute } from './pixelUi';

/**
 * A small box saying what an item is and what it does, shown once the pointer
 * has rested on it (the captain, 2026-10-29: "if I hover over any of the items
 * in my stash ... maybe it should tell me what it does").
 *
 * The wait is well under a second, as a tooltip's is everywhere else: two or
 * three seconds reads as nothing happening. It goes the moment the pointer
 * moves off, never covers the thing it is about (it stands below it, or above
 * when there is no room below) and is held inside the screen at its edges. The
 * keyboard gets the same box on the control the cursor rests on, after the
 * same wait, so a screen with no mouse is told the same thing.
 *
 * What it says is the catalogue's own name and description - the words the
 * help bar and the shop screens already use - read off the `data-describes`
 * key a row or a pack square carries (`ui/hoverDescribe.ts`).
 */
export const HOVER_HELP_DELAY_MS = 700;

/** How far a resting pointer may wander, in screen pixels, and still be resting. */
const REST_SLOP_PX = 3;

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * Where the box stands: below what it is about if it fits, else above, and
 * slid sideways to stay inside `bounds`. Whole pixels, so its frame is crisp.
 */
export function hoverHelpPlacement(
  anchor: Box,
  size: { readonly width: number; readonly height: number },
  bounds: Box,
  gap: number,
): { readonly left: number; readonly top: number } {
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - size.height;
  const top =
    below + size.height <= bounds.bottom || above < bounds.top
      ? Math.min(below, Math.max(bounds.top, bounds.bottom - size.height))
      : above;
  const left = Math.max(bounds.left, Math.min(anchor.left, bounds.right - size.width));
  return { left: Math.round(left), top: Math.round(top) };
}

/** The words for one describe key, or null when it is not an item with any. */
export function hoverHelpWords(key: string | undefined): { readonly name: string; readonly what: string } | null {
  if (!key) {
    return null;
  }
  const { kind, id } = splitDescribeKey(key);
  if (kind !== 'item') {
    return null;
  }
  const item = getItemById(id);
  return item?.description ? { name: item.displayName, what: item.description } : null;
}

/** The box's markup. Item names and descriptions are the game's own text. */
export function hoverHelpMarkup(words: { readonly name: string; readonly what: string }): string {
  return `<strong class="px-tip-name">${escapeAttribute(words.name)}</strong><span class="px-tip-what">${escapeAttribute(words.what)}</span>`;
}

/**
 * The box on one screen. It listens on the screen's root, which outlives every
 * redraw of its markup; `redrawn` is told after each one, so a box a redraw
 * took away is put back if the pointer is still resting on the same thing.
 */
export class ItemHoverHelp {
  private readonly root: HTMLElement;
  private timer: number | undefined;
  private restingAt: { readonly x: number; readonly y: number } | undefined;
  private shownKey: string | undefined;
  private tip: HTMLElement | undefined;

  public constructor(root: HTMLElement) {
    this.root = root;
    root.addEventListener('pointermove', (event) => this.onPointerMove(event));
    root.addEventListener('pointerleave', () => this.hide());
    root.addEventListener('pointerdown', () => this.hide());
    root.addEventListener('keydown', () => this.hide(), true);
    root.addEventListener('focusin', (event) => this.onFocus(event));
    root.addEventListener('wheel', () => this.hide(), { passive: true });
  }

  /** The screen's markup was replaced: put the box back if it still applies. */
  public redrawn(): void {
    const key = this.shownKey;
    const at = this.restingAt;
    this.tip = undefined;
    if (!key) {
      return;
    }
    const anchor = at
      ? describedAt(document.elementFromPoint(at.x, at.y))
      : describedAt(document.activeElement);
    if (anchor && anchor.dataset.describes === key) {
      this.show(anchor);
    } else {
      this.hide();
    }
  }

  public hide(): void {
    window.clearTimeout(this.timer);
    this.timer = undefined;
    this.shownKey = undefined;
    this.tip?.remove();
    this.tip = undefined;
  }

  private onPointerMove(event: PointerEvent): void {
    const at = this.restingAt;
    if (at && Math.abs(event.clientX - at.x) <= REST_SLOP_PX && Math.abs(event.clientY - at.y) <= REST_SLOP_PX) {
      return;
    }
    this.restingAt = { x: event.clientX, y: event.clientY };
    const anchor = describedAt(event.target as Element | null);
    if (this.shownKey && anchor?.dataset.describes === this.shownKey) {
      // Still on the same thing: the box stays, and only moving off it goes.
      return;
    }
    this.hide();
    if (anchor && hoverHelpWords(anchor.dataset.describes)) {
      this.timer = window.setTimeout(() => this.show(anchor), HOVER_HELP_DELAY_MS);
    }
  }

  private onFocus(event: FocusEvent): void {
    const target = event.target as HTMLElement | null;
    // Only the keyboard's cursor: a click focuses as well, and the pointer has
    // its own wait.
    if (!target?.matches(':focus-visible')) {
      return;
    }
    this.restingAt = undefined;
    this.hide();
    const anchor = describedAt(target);
    if (anchor && hoverHelpWords(anchor.dataset.describes)) {
      this.timer = window.setTimeout(() => {
        if (anchor.isConnected && anchor.contains(document.activeElement)) {
          this.show(anchor);
        }
      }, HOVER_HELP_DELAY_MS);
    }
  }

  private show(anchor: HTMLElement): void {
    window.clearTimeout(this.timer);
    this.timer = undefined;
    const words = hoverHelpWords(anchor.dataset.describes);
    if (!words || !anchor.isConnected) {
      return;
    }
    this.tip?.remove();
    const tip = document.createElement('div');
    tip.className = 'px-window px-tip';
    tip.setAttribute('role', 'tooltip');
    tip.innerHTML = hoverHelpMarkup(words);
    this.root.append(tip);
    const unit = Number.parseFloat(getComputedStyle(this.root).getPropertyValue('--u')) || 1;
    const screen = this.root.getBoundingClientRect();
    const place = hoverHelpPlacement(
      anchor.getBoundingClientRect(),
      { width: tip.offsetWidth, height: tip.offsetHeight },
      screen,
      unit * 2,
    );
    // Placed against the window, stood in the screen, which is what it is
    // positioned in.
    tip.style.left = `${Math.round(place.left - screen.left + this.root.scrollLeft)}px`;
    tip.style.top = `${Math.round(place.top - screen.top + this.root.scrollTop)}px`;
    this.tip = tip;
    this.shownKey = anchor.dataset.describes;
  }
}

/** The nearest thing a box could be about, at or above `element`. */
function describedAt(element: Element | null): HTMLElement | null {
  return element?.closest<HTMLElement>('[data-describes]') ?? null;
}
