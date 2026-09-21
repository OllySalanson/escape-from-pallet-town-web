import { itemRefAt, pieceRefKey, type GridPacking } from '../items';
import { CHARACTER_FEET_PIXEL_Y } from '../playerFrames';
import {
  characterDesignAssetPath,
  getCharacterDesign,
  type CharacterDesignId,
} from '../world/characterDesigns';
import { describeKey } from './hoverDescribe';

/**
 * Markup for the DOM screens drawn in the game's own visual language.
 *
 * A screen built from these is laid out in game pixels (`--px`, set on the menu
 * layer by `display/menuStage.ts` - the screens are sized against the browser
 * window, not against the canvas), framed by the same one-pixel window `pixelWindow.ts`
 * draws on the canvas, and set in the one typeface. The styling is the
 * `.pixel-ui` block of `src/style.css`; an overlay opts in by carrying that
 * class, and everything here is a pure string so the wording and structure are
 * testable without a browser.
 */

/** The width of a health bar's fill, in game pixels. `.px-hp` is this plus its frame. */
export const HP_BAR_WIDTH = 48;

/**
 * How narrow a column of a given kind of row may be before a list drops one.
 *
 * A list is laid out across the width it has (`ui/columnLayout.ts`), and the
 * one thing it has to be told is the *measure* of its own rows: the width at
 * which the longest name, its bar and its tag still stand on one line. These
 * are those widths, in game pixels, measured off the rows as they are drawn -
 * a name at ten letters, a health bar at 50, the cursor's own 8 of padding.
 *
 * They are here rather than typed into each screen so that two lists of the
 * same kind of thing - the stash's Pokemon and the loadout's - cannot drift
 * into different shapes on the same display.
 */
export const COLUMN_MEASURES = {
  /** Name, health bar, a state tag, and a line of condition under them. */
  pokemon: 200,
  /** A 16-pixel icon, a name, and a count or a stepper on the end. */
  supply: 168,
  /** A supply row with a +/- selector beside it, which is 30 pixels wider. */
  countedSupply: 196,
  /** A name over a wrapped sentence: a contract, a workshop rung, a deal. */
  brief: 260,
  /**
   * The same, with a price in a column of its own on the right: the shelves.
   *
   * Wider than `brief` by exactly what a price of two materials takes - "2×
   * Mooring rope" is the longest one the game ships - because the price is
   * beside the name rather than under it (`ui/shopDetail.ts`), and a column
   * that dropped it onto a second line would put the shelf back where it was.
   */
  priced: 340,
  /** A priced row with a +/- selector beside it, which is 32 pixels wider. */
  pricedCounted: 372,
  /** One line: a way in, a move, an exit, a door, a species on a table. */
  line: 176,
} as const;

/**
 * The attributes that lay a collection out across its width. `measure` is one
 * of `COLUMN_MEASURES`; `maximum` caps the count where the set is fixed (three
 * starters are three at any width) and `widest` caps a column, which together
 * make a centred row of cards rather than a list stretched to the frame.
 */
export function pixelColumns(
  measure: number,
  options: { readonly maximum?: number; readonly widest?: number } = {},
): string {
  return `data-columns="${measure}"${options.maximum === undefined ? '' : ` data-columns-max="${options.maximum}"`}${options.widest === undefined ? '' : ` data-columns-widest="${options.widest}"`}`;
}

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

/**
 * An experience bar, drawn on the same grid as the health bar above it.
 *
 * The fill is handed over already counted in game pixels, because how far along
 * a level a Pokemon is comes off the experience curve - `experienceBarFill` in
 * `pokemonSummary.ts` - and that is a rule about the game rather than about a
 * bar. This is only the markup.
 */
export function pixelXpBar(fill: number, label: string): string {
  return `<span class="px-xp" role="img" aria-label="${escapeAttribute(label)}"><span class="px-xp-fill" style="--fill:${fill}"></span></span>`;
}

/**
 * One of the base's four people, standing at their own size: Professor Oak,
 * Nurse Joy, Brock or Bill, drawn from the very sheet the overworld draws a
 * figure from (`world/characterDesigns.ts`) so a person on a screen and a
 * person on a map are the same art at the same scale.
 *
 * It is the design's down-idle frame and nothing else - the one a figure stands
 * in when it is looking at you - cropped to the ink: a frame is 32 pixels deep
 * with a head at `headPixelY` and soles on `CHARACTER_FEET_PIXEL_Y`, so the
 * blank rows above and below are taken off here rather than left as a gap a
 * layout has to guess at. The crop is read off the registry, so a design with a
 * taller hat needs nothing written here.
 */
export function pixelFigure(design: CharacterDesignId, name: string): string {
  const top = Math.max(0, getCharacterDesign(design).headPixelY - 1);
  const height = CHARACTER_FEET_PIXEL_Y + 2 - top;
  // The sheet is the element's own background rather than an `<img>` inside it:
  // a child four times the width of its clipping box is a box, and every audit
  // that asks "is anything drawn outside this screen?" answers yes on the card
  // nearest the edge. A background is clipped by the box it is on and has no
  // box of its own - the same reason `pixelWindow.ts` draws a frame this way.
  const style = `--figure-top:${top};--figure-height:${height};--figure-sheet:url('/${characterDesignAssetPath(design)}')`;
  return `<span class="px-figure" role="img" aria-label="${escapeAttribute(name)}" style="${style}"></span>`;
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
  /** Drawn ahead of the title on the same line: the figure whose counter this is. */
  readonly lead?: string;
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
    `<div class="px-bar-head">${options.lead ?? ''}<strong>${options.title}</strong><div class="px-bar-actions">${options.actions}</div></div>${(options.lines ?? []).join('')}`,
    { className: `confirm-bar${options.className ? ` ${options.className}` : ''}`, tag: 'div' },
  );
}

export interface PixelGridOptions {
  /** A tone class for the frame: `is-secure` for the container a wipe cannot take. */
  readonly className?: string;
  /** What a screen reader is told the container is. */
  readonly label?: string;
  /** Marks one id's squares, so a row and its blocks answer to each other. It
   * matches a cargo piece's `cargoId` too, so pointing at a Pokemon lights up
   * the squares it is standing on. */
  readonly highlight?: string;
  /**
   * Makes the container one the player arranges: every block becomes a control
   * they can pick up, carry and put down. Without it the squares are a picture,
   * which is what every read-only container stays.
   */
  readonly arrange?: PixelGridArranging;
}

/** What the screen is carrying over this container, if anything. */
export interface PixelGridGhost {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** False when the square under it would not take it: the red outline. */
  readonly valid: boolean;
}

export interface PixelGridArranging {
  /** Names this container to the controller, and to the markup that finds it. */
  readonly name: string;
  readonly ghost?: PixelGridGhost;
  /** What the help bar says while the cursor is on a block. */
  readonly help?: string;
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
 *
 * Cargo - a Pokemon being carried home, which takes four squares, six or nine
 * by its evolution stage - is drawn over the same squares from the same
 * packing, in its own tone, so a player reading the pack for room sees at once
 * what is taking it.
 */
export function pixelGrid(packing: GridPacking, icon: (itemId: string) => string, options: PixelGridOptions = {}): string {
  const { width, height } = packing.size;
  const arranging = options.arrange;
  const held = arranging?.ghost;
  const cells = new Array(Math.max(0, width * height)).fill('<i></i>').join('');
  // A block is a `<span>` on a container that is only a picture and a `<button>`
  // on one the player arranges, because a control the cursor cannot land on can
  // never be picked up - and a screen with no mouse is the one that has to work.
  // The block says what is in it, in the same key its row carries
  // (`ui/hoverDescribe.ts`), so pointing at either answers the same question
  // and lights the other - and a screen can light the squares the cursor is
  // over without re-rendering the container.
  const block = (
    key: string,
    className: string,
    describes: string,
    placement: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
    body: string,
    extra = '',
  ): string => {
    const seat = `grid-column:${placement.x + 1}/span ${placement.width};grid-row:${placement.y + 1}/span ${placement.height}`;
    const carried = held?.key === key ? ' is-carried' : '';
    const says = ` data-describes="${escapeAttribute(describes)}"`;
    if (!arranging) {
      return `<span class="${className}${carried}"${says} style="${seat}"${extra}>${body}</span>`;
    }
    return `<button type="button" class="${className}${carried}"${says} style="${seat}" data-grid-piece="${escapeAttribute(key)}" data-grid-owner="${escapeAttribute(arranging.name)}"${extra}${arranging.help ? ` data-help="${escapeAttribute(arranging.help)}"` : ''}>${body}</button>`;
  };
  const blocks = packing.placements
    .map((placement, index) => {
      const marked = options.highlight === placement.itemId ? ' is-marked' : '';
      const count = placement.quantity > 1 ? `<b>${placement.quantity}</b>` : '';
      return block(
        pieceRefKey(itemRefAt(packing, index)),
        `px-grid-block${marked}${placement.rotated ? ' is-turned' : ''}`,
        describeKey('item', placement.itemId),
        placement,
        `${icon(placement.itemId)}${count}`,
      );
    })
    .join('');
  const cargo = packing.cargo
    .map((placement) =>
      block(
        pieceRefKey({ kind: 'cargo', cargoId: placement.cargoId }),
        `px-grid-block is-cargo${options.highlight === placement.cargoId ? ' is-marked' : ''}`,
        describeKey('cargo', placement.cargoId),
        placement,
        // The sprite and nothing else: a species name is eight to ten letters
        // and the block is two squares wide, so writing it in there spilled
        // over the frame and over the art. The name is the row the cursor is
        // on, and the screen reader gets it from the label.
        placement.art ? `<img src="${placement.art}" alt="" />` : `<em>${escapeAttribute(placement.name.slice(0, 1))}</em>`,
        // A picture of a Pokemon is a picture; the same block on a container
        // the player arranges is a button, and a button is not an image.
        ` aria-label="${escapeAttribute(placement.name)}"${arranging ? '' : ' role="img"'}`,
      ),
    )
    .join('');
  // The ghost is what the player is carrying, drawn where it would land. It is
  // the whole of the "will this go here" answer, which is why it is a shape on
  // the grid and not a line of text under it.
  const ghost = held
    ? `<span class="px-grid-ghost${held.valid ? '' : ' is-bad'}" aria-hidden="true" style="grid-column:${held.x + 1}/span ${held.width};grid-row:${held.y + 1}/span ${held.height}"></span>`
    : '';
  const label = options.label ? ` aria-label="${escapeAttribute(options.label)}" role="img"` : '';
  const grid = arranging ? ` data-grid="${escapeAttribute(arranging.name)}" data-grid-cols="${width}" data-grid-rows="${height}"` : '';
  return `<div class="px-grid${options.className ? ` ${options.className}` : ''}${arranging ? ' is-arranging' : ''}" style="--cols:${width};--rows:${height}"${label}${grid}><div class="px-grid-cells" aria-hidden="true">${cells}</div><div class="px-grid-blocks">${cargo}${blocks}${ghost}</div></div>`;
}
