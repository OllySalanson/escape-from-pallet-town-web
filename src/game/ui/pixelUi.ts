import type { GridPacking } from '../items';

/**
 * Markup for the DOM screens drawn in the game's own visual language.
 *
 * A screen built from these is laid out in game pixels (`--px`, set on `#app` by
 * `display/stageScaler.ts`), framed by the same one-pixel window `pixelWindow.ts`
 * draws on the canvas, and set in the one typeface. The styling is the
 * `.pixel-ui` block of `src/style.css`; an overlay opts in by carrying that
 * class, and everything here is a pure string so the wording and structure are
 * testable without a browser.
 */

/** The width of a health bar's fill, in game pixels. `.px-hp` is this plus its frame. */
export const HP_BAR_WIDTH = 48;

export const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export interface PixelScreenOptions {
  /** The screen's name, in the title bar. */
  readonly title: string;
  /** Where the player is, said once and small, ahead of the title. */
  readonly place?: string;
  /** The way back, if this screen has one: its label and the attribute that wires it. */
  readonly back?: { readonly label: string; readonly attribute: string };
  /** Right-hand side of the title bar: a count, or the route's progress rail. */
  readonly aside?: string;
  readonly body: string;
  /** What the keys do here. Replaced by a focused control's own `data-help`. */
  readonly hints: string;
  /** A message about what just happened. It takes the help bar while it lasts. */
  readonly status?: string;
}

/**
 * One whole screen: a title bar, the body, and a help bar along the bottom.
 *
 * The help bar is the one place words about the focused control go, so a row
 * can stay a single line and still explain itself - see `MenuOverlay`, which
 * fills `[data-help-text]` from the focused control's `data-help`.
 */
/** The status line of a `pixelScreen`, for `takeDownPixelStatus`. */
export const PIXEL_STATUS_SELECTOR = '.px-status-line';

/** Removes a screen's status line in place, leaving the help text it stood over. */
export function takeDownPixelStatus(root: Pick<ParentNode, 'querySelector'>): void {
  const line = root.querySelector(PIXEL_STATUS_SELECTOR);
  line?.parentElement?.classList.remove('has-status');
  line?.remove();
}

export function pixelScreen(options: PixelScreenOptions): string {
  const back = options.back
    ? `<button class="px-back" ${options.back.attribute}>${options.back.label}</button>`
    : '';
  const place = options.place ? `<span class="px-place">${options.place}</span>` : '';
  const aside = options.aside ? `<div class="px-title-aside">${options.aside}</div>` : '';
  // The status line stands over the help text rather than replacing it, so it
  // can be taken down by removing it - no re-render, and so no rebuilding the
  // buttons under the pointer - and the help for the focused control is there
  // underneath when it goes. `PIXEL_STATUS_SELECTOR` is how a scene finds it.
  const status = options.status
    ? `<span class="px-status-line" role="status">${options.status}</span>`
    : '';
  const help = `<p class="px-help${status ? ' has-status' : ''}"><span data-help-text data-help-default="${escapeAttribute(options.hints)}">${options.hints}</span>${status}</p>`;
  return `<div class="px-screen"><header class="px-title">${back}<h1>${place}${options.title}</h1>${aside}</header>${options.body}${help}</div>`;
}

export interface PixelWindowOptions {
  /** Extra classes: a tone (`px-tone-good`, `px-tone-risk`...) or a layout hook. */
  readonly className?: string;
  /** A caps heading, with an optional note pushed to its right. */
  readonly heading?: string;
  readonly note?: string;
  readonly tag?: 'section' | 'div' | 'article';
}

/** A framed window: the DOM twin of `drawPixelWindow`. */
export function pixelWindow(content: string, options: PixelWindowOptions = {}): string {
  const tag = options.tag ?? 'section';
  const heading = options.heading
    ? `<header class="px-heading"><h2>${options.heading}</h2>${options.note ? `<small>${options.note}</small>` : ''}</header>`
    : '';
  return `<${tag} class="px-window${options.className ? ` ${options.className}` : ''}">${heading}${content}</${tag}>`;
}

/**
 * A health bar whose fill is a whole number of game pixels. A percentage width
 * lands between pixels at most healths, and a bar is the one place on these
 * screens where a soft edge is read as a wrong number.
 */
export function pixelHpBar(current: number, max: number): string {
  const ratio = max === 0 ? 0 : Math.max(0, Math.min(1, current / max));
  const state = ratio > 0.5 ? 'healthy' : ratio > 0.2 ? 'warning' : 'critical';
  // Anyone still standing shows at least one pixel of health.
  const fill = ratio === 0 ? 0 : Math.max(1, Math.round(ratio * HP_BAR_WIDTH));
  return `<span class="px-hp" role="img" aria-label="HP ${current} of ${max}"><span class="px-hp-fill ${state}" style="--fill:${fill}"></span></span>`;
}

/** A species' front sprite at its own size: one source pixel is one game pixel. */
export function pixelPortrait(dexId: number, name: string): string {
  return `<span class="px-portrait pokemon-avatar" aria-label="${escapeAttribute(name)}"><img src="/assets/pokemon/front/${dexId}.png" alt="" /><span aria-hidden="true">${name.slice(0, 1)}</span></span>`;
}

export function pixelTypeBadge(type: string): string {
  return `<span class="px-type px-type-${type.toLowerCase()}">${type}</span>`;
}

/** A short state word at the end of a row: ADDED, FIT, AT RISK. */
export function pixelTag(
  label: string,
  tone: 'good' | 'risk' | 'secure' | 'plain' = 'plain',
  /** A state that is already true carries the drawn tick; an offer does not. */
  ticked = false,
): string {
  return `<span class="px-tag px-tag-${tone}${ticked ? ' has-tick' : ''}">${label}</span>`;
}

/**
 * The route through preparation, for the title bar. `current` is one-based;
 * steps before it are done, steps after it are still to come.
 */
export function pixelRail(labels: readonly string[], current: number): string {
  return `<ol class="px-rail">${labels
    .map((label, index) => {
      const position = index + 1;
      const state = position < current ? 'done' : position === current ? 'current' : 'upcoming';
      return `<li class="${state}"${state === 'current' ? ' aria-current="step"' : ''}>${label}</li>`;
    })
    .join('')}</ol>`;
}

export interface CommitBarOptions {
  /** What this bar commits, in caps, on the same line as the actions. */
  readonly title: string;
  /** Lines under the title, already marked up. They run the full width of the bar. */
  readonly lines?: readonly string[];
  /** The buttons. The committing one goes last, so it is the one on the right. */
  readonly actions: string;
  readonly className?: string;
}

/**
 * The full-width bar every committing screen ends on. The title and the actions
 * share its first line and everything else runs underneath at full width, so a
 * long summary costs one more line rather than squeezing beside the buttons.
 */
export function pixelCommitBar(options: CommitBarOptions): string {
  return pixelWindow(
    `<div class="px-bar-head"><strong>${options.title}</strong><div class="px-bar-actions">${options.actions}</div></div>${(options.lines ?? []).join('')}`,
    { className: `confirm-bar${options.className ? ` ${options.className}` : ''}`, tag: 'div' },
  );
}

export interface PixelGridOptions {
  /** A tone class for the frame: `is-secure` for the container a wipe cannot take. */
  readonly className?: string;
  /** What a screen reader is told the container is. */
  readonly label?: string;
  /** Marks one id's squares, so a row and its blocks answer to each other. */
  readonly highlight?: string;
}

/**
 * A container drawn as the chequered squares it is.
 *
 * Two layers on one grid: every square of the container, and the packed blocks
 * laid over them. The empty squares are drawn rather than implied, because a
 * pack is read for the room it has left as much as for what is in it - the
 * question the whole grid exists to ask is "will the next thing go in".
 *
 * One square is sixteen game pixels, which is the icon set's own size, so
 * nothing here is ever resampled (`ui/icons.ts` holds that rule for the rest of
 * the game). A block wider or taller than one square spans the hairline between
 * them, so a parts crate reads as one object and not as four.
 */
export function pixelGrid(packing: GridPacking, icon: (itemId: string) => string, options: PixelGridOptions = {}): string {
  const { width, height } = packing.size;
  const cells = new Array(Math.max(0, width * height)).fill('<i></i>').join('');
  const blocks = packing.placements
    .map((placement) => {
      const marked = options.highlight === placement.itemId ? ' is-marked' : '';
      const count = placement.quantity > 1 ? `<b>${placement.quantity}</b>` : '';
      return `<span class="px-grid-block${marked}" style="grid-column:${placement.x + 1}/span ${placement.width};grid-row:${placement.y + 1}/span ${placement.height}">${icon(placement.itemId)}${count}</span>`;
    })
    .join('');
  const label = options.label ? ` aria-label="${escapeAttribute(options.label)}" role="img"` : '';
  return `<div class="px-grid${options.className ? ` ${options.className}` : ''}" style="--cols:${width};--rows:${height}"${label}><div class="px-grid-cells" aria-hidden="true">${cells}</div><div class="px-grid-blocks">${blocks}</div></div>`;
}
