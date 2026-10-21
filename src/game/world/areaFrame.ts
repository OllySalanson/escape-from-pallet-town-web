import { TILE_SIZE } from '../worldMap';
import { CHARACTER_FEET_PIXEL_Y } from '../playerFrames';
import { PLAYER_MARKER_GROUND_LAYERS } from './characterPresentation';

/**
 * How far below the tile it stands on a figure is drawn, in game pixels: the
 * player's soles rest on the first row of the tile below (`CHARACTER_FEET_PIXEL_Y`
 * is a frame's row 27, and the frame stands 27 rows above that tile's top), and
 * the ground ring's outline is a row under the soles. Read off the marker
 * itself, so a redrawn ring moves the frame with it.
 */
export const FIGURE_OVERHANG_PX = Math.max(
  1,
  ...PLAYER_MARKER_GROUND_LAYERS.flatMap((layer) => layer.rects.map((rect) => rect.y + rect.height)),
) - CHARACTER_FEET_PIXEL_Y;

/** A rectangle in world pixels. */
export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What frames one place of a map made of several (`WorldScene.frameArea`). */
export interface AreaFrame {
  /** The camera's bounds: the place centred in the view when it is smaller. */
  readonly bounds: PixelRect;
  /** Four slabs of dark round the place, each reaching a screen past it. */
  readonly slabs: readonly PixelRect[];
}

/**
 * The dark round a place and the camera's bounds over it, in world pixels.
 *
 * The dark is drawn over every figure, so its bottom edge stands
 * `FIGURE_OVERHANG_PX` below the place's last row: somebody standing on that
 * row - a room's door mat is always there - is drawn a little into the tile
 * below, and a slab laid at the row's own edge cut their feet and ring off.
 * Places are laid at least a tile apart (`layOutAreas`), so those pixels never
 * show anything of the place beyond. An inside taller than the view lets the
 * camera down onto them too; the outdoors does not, because nobody stands on
 * its last row and the strip would be a black edge under its trees.
 */
export function areaFrame(
  area: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  view: { readonly width: number; readonly height: number },
  outdoors = false,
): AreaFrame {
  const x = area.x * TILE_SIZE;
  const y = area.y * TILE_SIZE;
  const width = area.width * TILE_SIZE;
  const height = area.height * TILE_SIZE;
  const drawn = height + FIGURE_OVERHANG_PX;
  const left = width < view.width ? x + Math.floor((width - view.width) / 2) : x;
  const top = height < view.height ? y + Math.floor((height - view.height) / 2) : y;
  const reach = Math.max(view.width, view.height) * 2;
  return {
    bounds: { x: left, y: top, width: Math.max(width, view.width), height: Math.max(outdoors ? height : drawn, view.height) },
    slabs: [
      { x: x - reach, y: y - reach, width: width + reach * 2, height: reach },
      { x: x - reach, y: y + drawn, width: width + reach * 2, height: reach },
      { x: x - reach, y, width: reach, height: drawn },
      { x: x + width, y, width: reach, height: drawn },
    ],
  };
}
