import type { GridPoint } from './draft';

/**
 * The ghost a placement casts before the click, tile by tile: where the thing
 * would stand, green when it may and red when it may not; the tiles that
 * refuse it, red and crossed; its doorsteps; and, faintly, the trees, bushes
 * and clutter it would clear - so a maker sees a Gym's clearing before the
 * Gym is in it (`placement.ts` decides; this only draws what it said).
 *
 * It is drawn on a canvas only as big as the ghost, one canvas pixel to a game
 * pixel, so every line is a whole pixel at any zoom - the game's pixel style -
 * and a 256x256 map costs nothing more than a house does.
 */

export interface GhostTiles {
  readonly footprint: readonly GridPoint[];
  /** What it would hang over without standing on: a crown, an arch's span. */
  readonly overhang?: readonly GridPoint[];
  /** Where its picture reaches and nothing else does: the top of a broadleaf's crown. Room is made for it. */
  readonly drawn?: readonly GridPoint[];
  readonly doorsteps: readonly GridPoint[];
  readonly clears: readonly GridPoint[];
  readonly blocked: readonly GridPoint[];
  /** Whether it may go there. */
  readonly ok: boolean;
}

export interface GhostBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The tiles the ghost covers, as a rectangle; undefined when it covers none. */
export function ghostBounds(ghost: GhostTiles): GhostBounds | undefined {
  const tiles = [
    ...ghost.footprint,
    ...(ghost.overhang ?? []),
    ...(ghost.drawn ?? []),
    ...ghost.doorsteps,
    ...ghost.clears,
    ...ghost.blocked,
  ];
  if (tiles.length === 0) {
    return undefined;
  }
  const xs = tiles.map((tile) => tile.x);
  const ys = tiles.map((tile) => tile.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x + 1, height: Math.max(...ys) - y + 1 };
}

/** The colours it is drawn in: the map maker's own marks, and the warning red. */
export const GHOST_COLOURS = {
  fits: 'rgba(96, 214, 140, 0.32)',
  /** Over the thing's own picture, lighter: the picture is what is being shown. */
  fitsOverArt: 'rgba(96, 214, 140, 0.2)',
  /** Pale, to be seen against grass as well as against a wood. */
  fitsEdge: '#b8ffd0',
  refused: 'rgba(255, 90, 80, 0.26)',
  refusedOverArt: 'rgba(255, 90, 80, 0.34)',
  refusedEdge: '#ff5a50',
  /** Light enough that whatever refuses it is still seen under it. */
  blocked: 'rgba(255, 58, 46, 0.36)',
  cross: '#fff3e6',
  clears: 'rgba(255, 214, 92, 0.30)',
  clearsEdge: '#ffd65c',
  doorstep: '#f8f7dd',
} as const;

const key = ({ x, y }: GridPoint): string => `${x},${y}`;

/**
 * Paints the ghost onto a canvas the size of its bounds, `zoom` game pixels to
 * a tile. The canvas is sized here. `art` draws the thing itself first, given
 * the tile at the canvas's corner, so the colours lie over its picture.
 */
export function paintGhost(
  canvas: HTMLCanvasElement,
  ghost: GhostTiles,
  zoom: number,
  art?: (context: CanvasRenderingContext2D, origin: GridPoint) => void,
): GhostBounds | undefined {
  const bounds = ghostBounds(ghost);
  const context = canvas.getContext('2d');
  if (!bounds || !context) {
    return bounds;
  }
  canvas.width = bounds.width * zoom;
  canvas.height = bounds.height * zoom;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (art) {
    // A thing that will not go is shown fainter than one that will.
    context.globalAlpha = ghost.ok ? 1 : 0.7;
    art(context, { x: bounds.x, y: bounds.y });
    context.globalAlpha = 1;
  }
  const left = (tile: GridPoint): number => (tile.x - bounds.x) * zoom;
  const top = (tile: GridPoint): number => (tile.y - bounds.y) * zoom;
  const fill = (tiles: readonly GridPoint[], colour: string): void => {
    context.fillStyle = colour;
    for (const tile of tiles) {
      context.fillRect(left(tile), top(tile), zoom, zoom);
    }
  };
  /** A one-pixel line round the outside of a set of tiles, dotted if asked. */
  const outline = (tiles: readonly GridPoint[], colour: string, dotted = false): void => {
    const inside = new Set(tiles.map(key));
    context.fillStyle = colour;
    const line = (x: number, y: number, width: number, height: number): void => {
      if (!dotted) {
        context.fillRect(x, y, width, height);
        return;
      }
      for (let step = 0; step < Math.max(width, height); step += 2) {
        context.fillRect(x + (width > 1 ? step : 0), y + (height > 1 ? step : 0), 1, 1);
      }
    };
    for (const tile of tiles) {
      const x = left(tile);
      const y = top(tile);
      if (!inside.has(key({ x: tile.x, y: tile.y - 1 }))) line(x, y, zoom, 1);
      if (!inside.has(key({ x: tile.x, y: tile.y + 1 }))) line(x, y + zoom - 1, zoom, 1);
      if (!inside.has(key({ x: tile.x - 1, y: tile.y }))) line(x, y, 1, zoom);
      if (!inside.has(key({ x: tile.x + 1, y: tile.y }))) line(x + zoom - 1, y, 1, zoom);
    }
  };
  const footprint = new Set([...ghost.footprint, ...(ghost.overhang ?? [])].map(key));
  // What it would clear, outside where it stands and hangs: the edge of the clearing.
  const cleared = ghost.clears.filter((tile) => !footprint.has(key(tile)));
  fill(cleared, GHOST_COLOURS.clears);
  outline(cleared, GHOST_COLOURS.clearsEdge, true);
  const whole = [...ghost.footprint, ...(ghost.overhang ?? [])];
  fill(
    whole,
    ghost.ok
      ? art
        ? GHOST_COLOURS.fitsOverArt
        : GHOST_COLOURS.fits
      : art
        ? GHOST_COLOURS.refusedOverArt
        : GHOST_COLOURS.refused,
  );
  outline(whole, ghost.ok ? GHOST_COLOURS.fitsEdge : GHOST_COLOURS.refusedEdge);
  // A doorstep is a step in front of the door: a bar along the tile's top
  // edge, the side the door is on, and its outline dotted.
  for (const step of ghost.doorsteps) {
    if (footprint.has(key(step))) {
      continue;
    }
    outline([step], ghost.ok ? GHOST_COLOURS.doorstep : GHOST_COLOURS.refusedEdge, true);
  }
  fill(ghost.blocked, GHOST_COLOURS.blocked);
  outline(ghost.blocked, GHOST_COLOURS.refusedEdge);
  // A cross on every tile that refuses it, once a tile is big enough to hold one.
  if (zoom >= 8) {
    context.fillStyle = GHOST_COLOURS.cross;
    const inset = Math.max(2, Math.floor(zoom / 4));
    for (const tile of ghost.blocked) {
      for (let step = inset; step < zoom - inset; step += 1) {
        context.fillRect(left(tile) + step, top(tile) + step, 1, 1);
        context.fillRect(left(tile) + zoom - 1 - step, top(tile) + step, 1, 1);
      }
    }
  }
  return bounds;
}
