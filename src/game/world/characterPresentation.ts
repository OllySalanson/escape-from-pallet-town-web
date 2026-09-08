import {
  CHARACTER_FEET_PIXEL_Y,
  CHARACTER_FRAME_WIDTH,
  CHARACTER_HEAD_PIXEL_Y,
} from '../playerFrames';

/**
 * Every overworld figure - the player, townsfolk, trainers and the hunter - is
 * drawn from the single `character` sprite sheet, so the art alone can never
 * say which one is you. A stationary player standing beside a townsperson was
 * genuinely indistinguishable, and was once read as a missing player sprite.
 *
 * Two rules fix that, and both hold while standing still:
 *  - role tinting: the player is the only figure in the sheet's true colours;
 *  - the player marker: the player is the only figure carrying it.
 *
 * The values live here rather than in `WorldScene` so the rules are assertable
 * without a running Phaser scene, the way `battlePresentation.ts` is.
 */

export const WORLD_CHARACTER_ROLES = ['player', 'npc', 'trainer', 'hunter'] as const;

export type WorldCharacterRole = (typeof WORLD_CHARACTER_ROLES)[number];

export interface WorldCharacterLook {
  /** Multiply tint applied to the shared sheet, or null for its true colours. */
  readonly tint: number | null;
  /** Whether the persistent "this is you" marker is drawn on this character. */
  readonly marked: boolean;
}

/**
 * Townsfolk are shaded rather than recoloured - a cool, gentle wash that reads
 * as background at a glance. A heavier tint turned their faces grey and looked
 * like broken art, and would in any case compete with the amber trainer and
 * red hunter, which are warnings and must stay the loudest figures on screen.
 */
export const WORLD_CHARACTER_LOOKS: Record<WorldCharacterRole, WorldCharacterLook> = {
  player: { tint: null, marked: true },
  npc: { tint: 0xc6d1e2, marked: false },
  trainer: { tint: 0xfbbf24, marked: false },
  hunter: { tint: 0xef4444, marked: false },
};

export function getWorldCharacterLook(role: WorldCharacterRole): WorldCharacterLook {
  return WORLD_CHARACTER_LOOKS[role];
}

/** Phaser's identity multiply: the sheet drawn in its own colours. */
export const NO_TINT = 0xffffff;

export function worldCharacterTint(role: WorldCharacterRole): number {
  return getWorldCharacterLook(role).tint ?? NO_TINT;
}

/**
 * `--menu-accent` from `src/style.css`, the interface's own accent, and used
 * nowhere else in the overworld: extraction is green and red, loot amber,
 * caches and the field kit blue. Nothing else on the map can be mistaken for
 * it, and it is not an alarm colour.
 */
export const PLAYER_MARKER_COLOUR = 0x55d6be;

/** Behind the accent, so both marks hold on sand, grass and water alike. */
export const PLAYER_MARKER_SHADE_COLOUR = 0x0d2b2c;

/**
 * Figures sort at `2 + tile y / 1000` and world markers at `3 + tile y / 1000`,
 * so the head mark sits just under 3: above every figure any map can hold, and
 * below every marker, so it can neither be buried by a neighbour nor hide an
 * objective. The ground mark instead rides the player's own depth - it is light
 * on the ground the player is standing on, so a figure standing in front of the
 * player should cover it, and the head mark is what keeps the player findable
 * when one does.
 */
export const PLAYER_MARKER_DEPTH = 2.999;

export interface MarkerRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MarkerLayer {
  readonly colour: number;
  readonly alpha: number;
  readonly rects: readonly MarkerRect[];
}

/**
 * The marker is centred on the tile, not on the figure: the sprite's own
 * centre shifts by a pixel between facings, and it is the tile the player is
 * standing on that the ring is describing. Every row is therefore an even
 * width, so both marks stay symmetric about the seam at the tile's middle.
 */
const CENTRE_X = CHARACTER_FRAME_WIDTH / 2;
/** The ring is laid flat on the sole line, so it reads as ground, not water. */
const RING_BASE_Y = CHARACTER_FEET_PIXEL_Y;
/** Clear of the hair by its own outline, close enough to belong to the figure. */
const CHEVRON_TIP_Y = CHARACTER_HEAD_PIXEL_Y - 3;
const CHEVRON_TOP_WIDTH = 8;

function row(y: number, width: number): MarkerRect {
  return { x: CENTRE_X - width / 2, y, width, height: 1 };
}

/**
 * A shallow pixel ellipse under the boots. Kept two rows tall so its outline
 * hugs the sole line rather than rising up the character's legs.
 */
function ringShadowRows(): MarkerRect[] {
  return [row(RING_BASE_Y - 1, 6), row(RING_BASE_Y, 8)];
}

/** Rows shrinking by two, so the chevron narrows to a blunt point at the tip. */
function chevronRows(): MarkerRect[] {
  const rows: MarkerRect[] = [];
  for (let width = CHEVRON_TOP_WIDTH; width >= 2; width -= 2) {
    rows.push(row(CHEVRON_TIP_Y - (width - 2) / 2, width));
  }
  return rows;
}

/**
 * The one-pixel halo around a pixel shape: every four-neighbour of a filled
 * pixel that is not itself filled. Drawing the ring as the outline of the
 * shadow, and the chevron's edge as the outline of the chevron, keeps both
 * marks crisp at any zoom without hand-authoring a second set of rows.
 */
export function outlineRects(rects: readonly MarkerRect[]): MarkerRect[] {
  const filled = new Set<string>();
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        filled.add(`${x},${y}`);
      }
    }
  }

  const outline = new Set<string>();
  for (const key of filled) {
    const [x, y] = key.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const neighbour = `${x + dx},${y + dy}`;
      if (!filled.has(neighbour)) {
        outline.add(neighbour);
      }
    }
  }

  return [...outline]
    .map((key) => key.split(',').map(Number))
    .map(([x, y]) => ({ x, y, width: 1, height: 1 }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * The marker, in sprite-frame pixels: x from the left edge of the 16x32 frame,
 * y from its top, so it is drawn by offsetting from the player sprite's own
 * position. Each group is painted in order, back to front.
 *
 * Two marks rather than one, because either can be covered on its own: a
 * figure standing one tile south overlaps the ring, and the HUD and route
 * labels sit over the chevron. Neither is animated - the marker travels with
 * the player, so it needs no motion of its own to be found, and a pulse under
 * a closing hunter would only add noise.
 */
export const PLAYER_MARKER_GROUND_LAYERS: readonly MarkerLayer[] = [
  { colour: PLAYER_MARKER_SHADE_COLOUR, alpha: 0.35, rects: ringShadowRows() },
  { colour: PLAYER_MARKER_COLOUR, alpha: 1, rects: outlineRects(ringShadowRows()) },
];

export const PLAYER_MARKER_HEAD_LAYERS: readonly MarkerLayer[] = [
  { colour: PLAYER_MARKER_SHADE_COLOUR, alpha: 0.85, rects: outlineRects(chevronRows()) },
  { colour: PLAYER_MARKER_COLOUR, alpha: 1, rects: chevronRows() },
];
