import type { GridPosition } from '../movement/gridMovement';
import { pokedexOwned } from '../hub/pokedex';
import type { Stash } from '../stash/Stash';
import {
  cellsFacing,
  dollId,
  FURNITURE,
  furnitureNamed,
  type FurnitureDefinition,
} from './furniture';

/**
 * Where the furniture in THE BOLTHOLE stands, and the rules for putting it
 * there. Pure: the scene asks, this answers.
 *
 * **What is stored** is one list, `RaidProgress.homeLayout`: each piece put
 * down, by its furniture id, the room, the tile its top-left corner is on and
 * which way round it is. Everything else is derived. What a save *owns* is the
 * house's own pieces, the furniture in its vault and a doll for every kind in
 * its Pokédex (`ownedFurniture`); what is in the box is what it owns less what
 * stands in a room (`boxContents`). A layout is read back through the same
 * rules it was made with (`arrangeHouse`), so a piece the save no longer owns,
 * or that no longer fits, is simply back in the box - a layout can never claim
 * more than the vault holds, and never wall anybody in.
 *
 * **The rules** are the Secret Base's, with Habbo's stacking and the house's
 * one hard promise - nothing may block the door:
 *
 * - a piece stands on floor: not on a wall, not on anything the house is built
 *   with (the kitchen, the stairs, the bed), and never on a door mat or a stair
 *   mat;
 * - a mat or a rug lies on bare floor, and one thing may stand on it;
 * - a doll or a cushion may also stand on a desk or a table top;
 * - two things never stand in one place;
 * - and once it is down, the player can still walk from the door to the
 *   stairs, to wherever they are standing, and up to everything in the house
 *   that answers when spoken to - the telly, the badge case, the bed, the PC.
 */

export type HomeRoomId = 'bolthole' | 'bolthole-upstairs';
export const HOME_ROOMS: readonly HomeRoomId[] = ['bolthole', 'bolthole-upstairs'];

export function isHomeRoom(value: unknown): value is HomeRoomId {
  return typeof value === 'string' && (HOME_ROOMS as readonly string[]).includes(value);
}

/** One piece put down: what, where its top-left tile is, and which way round. */
export interface Placement {
  readonly id: string;
  readonly room: HomeRoomId;
  readonly x: number;
  readonly y: number;
  readonly facing: number;
}

/**
 * The house as every save had it before anything could be moved: the two pot
 * plants in the front room's corners and the table on its rug. A save that has
 * never decorated stands these, and the first piece it moves writes the list.
 */
export const DEFAULT_HOME_LAYOUT: readonly Placement[] = [
  { id: 'dining-table', room: 'bolthole', x: 4, y: 3, facing: 0 },
  { id: 'pot-plant', room: 'bolthole', x: 0, y: 6, facing: 0 },
  { id: 'pot-plant', room: 'bolthole', x: 14, y: 6, facing: 1 },
];

/** How many pieces a layout may hold: far more than two rooms of floor, and a cap on a hostile save. */
export const MAX_HOME_LAYOUT = 400;

/** The layout a save stands, which is the default until it has decorated. */
export function homeLayoutOf(progress: { readonly homeLayout?: readonly Placement[] }): readonly Placement[] {
  return progress.homeLayout ?? DEFAULT_HOME_LAYOUT;
}

/** A layout read out of a save: well-formed entries only, in order. */
export function readHomeLayout(value: unknown): readonly Placement[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .filter((entry): entry is Placement => {
      if (typeof entry !== 'object' || entry === null) {
        return false;
      }
      const { id, room, x, y, facing } = entry as Record<string, unknown>;
      const definition = typeof id === 'string' ? furnitureNamed(id) : undefined;
      return (
        definition !== undefined &&
        isHomeRoom(room) &&
        [x, y].every((n) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 64) &&
        Number.isInteger(facing) &&
        (facing as number) >= 0 &&
        (facing as number) < definition.facings.length
      );
    })
    .slice(0, MAX_HOME_LAYOUT)
    .map(({ id, room, x, y, facing }) => ({ id, room, x, y, facing }));
}

/**
 * Every piece a save owns, by id, and how many: the house's own, the furniture
 * in the vault, and one doll for each kind of Pokémon it has owned.
 */
export function ownedFurniture(game: {
  readonly stash: Stash;
  readonly raidProgress: { readonly pokedexOwned?: readonly number[] };
}): ReadonlyMap<string, number> {
  const owned = new Map<string, number>();
  for (const definition of FURNITURE) {
    const { source } = definition;
    if (source.kind === 'house') {
      owned.set(definition.id, source.count);
    } else if (source.kind === 'found') {
      const count = game.stash.itemCount(source.itemId);
      if (count > 0) {
        owned.set(definition.id, count);
      }
    }
  }
  for (const dexId of pokedexOwned(game.raidProgress.pokedexOwned, game.stash)) {
    owned.set(dollId(dexId), 1);
  }
  return owned;
}

/**
 * What a room offers furniture, read off the room as it is built without any:
 * which tiles are already solid, which are bare floor, the mats nothing may
 * cover, and everything that must still be walked up to.
 */
export interface FloorPlan {
  readonly room: HomeRoomId;
  readonly width: number;
  readonly height: number;
  /** Solid before any furniture: walls, the kitchen, the bed. */
  readonly blocked: readonly (readonly boolean[])[];
  /** Floor with nothing of the house drawn on it: where a mat may lie. */
  readonly bare: readonly (readonly boolean[])[];
  /** The door mat and the stair mats. Nothing is put on one, and each must still be reached. */
  readonly ways: readonly GridPosition[];
  /** What answers when spoken to, by name, and the tiles it can be spoken to from. */
  readonly mustReach: readonly { readonly name: string; readonly from: readonly GridPosition[] }[];
}

/** A piece standing in a room, with its tiles turned the way it is facing. */
export interface PlacedPiece extends Placement {
  readonly definition: FurnitureDefinition;
  readonly cells: readonly string[];
}

export function placedPiece(placement: Placement): PlacedPiece | undefined {
  const definition = furnitureNamed(placement.id);
  if (!definition || placement.facing < 0 || placement.facing >= definition.facings.length) {
    return undefined;
  }
  return { ...placement, definition, cells: cellsFacing(definition, placement.facing) };
}

/** Every tile a piece covers, with what it is there. */
export function pieceTiles(piece: PlacedPiece): readonly { readonly x: number; readonly y: number; readonly cell: string }[] {
  return piece.cells.flatMap((row, dy) => [...row].map((cell, dx) => ({ x: piece.x + dx, y: piece.y + dy, cell })));
}

const isSolidCell = (cell: string): boolean => cell === '#' || cell === 'T';

/** The tiles a piece stops anybody walking onto. */
export function solidTiles(piece: PlacedPiece): readonly GridPosition[] {
  return pieceTiles(piece)
    .filter((tile) => isSolidCell(tile.cell))
    .map(({ x, y }) => ({ x, y }));
}

/** Why a piece cannot go where it was put. */
export type Refusal =
  | { readonly kind: 'off-floor' }
  | { readonly kind: 'on-a-mat' }
  | { readonly kind: 'not-bare' }
  | { readonly kind: 'in-the-way'; readonly by: string }
  | { readonly kind: 'under-you' }
  | { readonly kind: 'blocks'; readonly what: string };

/** What the decorating panel says about a refusal: the reason, as the house would put it. */
export function refusalLine(refusal: Refusal): string {
  switch (refusal.kind) {
    case 'off-floor':
      return 'IT HAS TO GO ON THE FLOOR';
    case 'on-a-mat':
      return 'KEEP THE MATS CLEAR';
    case 'not-bare':
      return 'A MAT GOES ON BARE FLOOR';
    case 'in-the-way':
      return `${refusal.by} IS IN THE WAY`;
    case 'under-you':
      return 'YOU ARE STANDING THERE';
    case 'blocks':
      return `IT WOULD BLOCK ${refusal.what}`;
  }
}

interface Stack {
  floor?: { readonly cell: string; readonly by: string };
  standing?: { readonly cell: string; readonly by: string };
  small?: { readonly by: string };
}

/**
 * Whether one more thing may go on a tile that already holds this. A mat
 * under anything that stands; a doll or a cushion on a desk or a table top;
 * otherwise one thing a tile.
 */
function stackRefusal(stack: Stack, layer: FurnitureDefinition['layer'], cell: string): string | null {
  if (layer === 'floor') {
    if (stack.floor) return stack.floor.by;
    // A rug slides under what stands on it, but its table is solid.
    if (cell !== '.') return stack.standing?.by ?? stack.small?.by ?? null;
    return null;
  }
  if (layer === 'standing') {
    if (stack.standing) return stack.standing.by;
    if (stack.small) return stack.small.by;
    if (stack.floor && stack.floor.cell !== '.') return stack.floor.by;
    return null;
  }
  if (stack.small) return stack.small.by;
  if (stack.standing) return stack.standing.cell === 'T' ? null : stack.standing.by;
  if (stack.floor && stack.floor.cell === '#') return stack.floor.by;
  return null;
}

/** What each tile holds, for the pieces given. */
function stacksOf(pieces: readonly PlacedPiece[]): Map<string, Stack> {
  const stacks = new Map<string, Stack>();
  for (const piece of pieces) {
    for (const tile of pieceTiles(piece)) {
      const key = `${tile.x},${tile.y}`;
      const stack = stacks.get(key) ?? {};
      const entry = { cell: tile.cell, by: piece.definition.name };
      if (piece.definition.layer === 'floor') stack.floor = entry;
      else if (piece.definition.layer === 'standing') stack.standing = entry;
      else stack.small = { by: piece.definition.name };
      stacks.set(key, stack);
    }
  }
  return stacks;
}

/**
 * Whether the room can still be walked as the house promises with these
 * pieces down: from the way in to every other way in, to wherever anybody is
 * standing, and up to everything that answers. Null when it can; otherwise
 * what it would block.
 */
export function blockedBy(
  plan: FloorPlan,
  pieces: readonly PlacedPiece[],
  standing: readonly GridPosition[] = [],
  extraSolid: readonly GridPosition[] = [],
): string | null {
  const solid = plan.blocked.map((row) => [...row]);
  for (const tile of [...pieces.flatMap(solidTiles), ...extraSolid]) {
    if (solid[tile.y]?.[tile.x] !== undefined) solid[tile.y][tile.x] = true;
  }
  const [start] = plan.ways;
  if (!start) {
    return null;
  }
  const seen = plan.blocked.map((row) => row.map(() => false));
  const queue: GridPosition[] = [];
  if (!solid[start.y][start.x]) {
    seen[start.y][start.x] = true;
    queue.push(start);
  }
  for (let head = 0; head < queue.length; head += 1) {
    const { x, y } = queue[head];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny < 0 || nx < 0 || ny >= plan.height || nx >= plan.width || seen[ny][nx] || solid[ny][nx]) continue;
      seen[ny][nx] = true;
      queue.push({ x: nx, y: ny });
    }
  }
  const reached = (tile: GridPosition): boolean => seen[tile.y]?.[tile.x] === true;
  for (const way of plan.ways) {
    if (!reached(way)) return way === start ? 'THE DOOR' : 'THE STAIRS';
  }
  for (const thing of plan.mustReach) {
    if (!thing.from.some(reached)) return thing.name;
  }
  if (!standing.every(reached)) return 'YOUR WAY OUT';
  return null;
}

/**
 * Whether a piece may go here, with these already down: null if it may,
 * otherwise why not. `standing` is wherever somebody is standing, which no
 * solid part of it may land on and which must still lead out.
 */
export function placementRefusal(
  plan: FloorPlan,
  pieces: readonly PlacedPiece[],
  candidate: PlacedPiece,
  standing: readonly GridPosition[] = [],
): Refusal | null {
  const tiles = pieceTiles(candidate);
  for (const tile of tiles) {
    if (tile.x < 0 || tile.y < 0 || tile.x >= plan.width || tile.y >= plan.height || plan.blocked[tile.y][tile.x]) {
      return { kind: 'off-floor' };
    }
    if (plan.ways.some((way) => way.x === tile.x && way.y === tile.y)) {
      return { kind: 'on-a-mat' };
    }
    if (candidate.definition.layer === 'floor' && !plan.bare[tile.y][tile.x]) {
      return { kind: 'not-bare' };
    }
  }
  const stacks = stacksOf(pieces);
  for (const tile of tiles) {
    const by = stackRefusal(stacks.get(`${tile.x},${tile.y}`) ?? {}, candidate.definition.layer, tile.cell);
    if (by !== null) {
      return { kind: 'in-the-way', by };
    }
    if (isSolidCell(tile.cell) && standing.some((at) => at.x === tile.x && at.y === tile.y)) {
      return { kind: 'under-you' };
    }
  }
  const what = blockedBy(plan, [...pieces, candidate], standing);
  return what === null ? null : { kind: 'blocks', what };
}

/**
 * A layout as it stands in the house: every entry the save owns a piece for
 * and that is allowed where it was put, in the order it was put down - the
 * rest stay in the box. Ownership is shared between the two rooms, so the
 * whole house is arranged at once.
 */
export function arrangeHouse(
  plans: Readonly<Record<HomeRoomId, FloorPlan>>,
  layout: readonly Placement[],
  owned: ReadonlyMap<string, number>,
): readonly PlacedPiece[] {
  const used = new Map<string, number>();
  const placed: PlacedPiece[] = [];
  for (const placement of inLayerOrder(layout)) {
    const piece = placedPiece(placement);
    if (!piece || (used.get(piece.id) ?? 0) >= (owned.get(piece.id) ?? 0)) {
      continue;
    }
    const plan = plans[piece.room];
    const inRoom = placed.filter((each) => each.room === piece.room);
    if (placementRefusal(plan, inRoom, piece) !== null) {
      continue;
    }
    used.set(piece.id, (used.get(piece.id) ?? 0) + 1);
    placed.push(piece);
  }
  return placed;
}

const LAYER_ORDER = { floor: 0, standing: 1, small: 2 } as const;

/**
 * A layout in the order it is read back in: what lies on the floor, then what
 * stands, then what stands on something - so a doll is always checked after
 * the desk it is on, whatever order the two were put down in.
 */
export function inLayerOrder(layout: readonly Placement[]): readonly Placement[] {
  const layer = (placement: Placement): number => {
    const definition = furnitureNamed(placement.id);
    return definition ? LAYER_ORDER[definition.layer] : 0;
  };
  return layout
    .map((placement, index) => ({ placement, index }))
    .sort((a, b) => layer(a.placement) - layer(b.placement) || a.index - b.index)
    .map(({ placement }) => placement);
}

/** Whether one piece lies under another: a rug under a chair, a desk under a doll. */
export function layerBelow(lower: FurnitureDefinition, upper: FurnitureDefinition): boolean {
  return LAYER_ORDER[lower.layer] < LAYER_ORDER[upper.layer];
}

/** One kind of piece waiting in the box, and how many. */
export interface BoxEntry {
  readonly definition: FurnitureDefinition;
  readonly count: number;
}

/**
 * What is in the box: everything owned less everything standing, in the
 * catalogue's order - the house's own, then the finds, then the dolls by
 * dex number.
 */
export function boxContents(owned: ReadonlyMap<string, number>, placed: readonly Placement[]): readonly BoxEntry[] {
  const standing = new Map<string, number>();
  for (const placement of placed) {
    standing.set(placement.id, (standing.get(placement.id) ?? 0) + 1);
  }
  return FURNITURE.flatMap((definition) => {
    const count = (owned.get(definition.id) ?? 0) - (standing.get(definition.id) ?? 0);
    return count > 0 ? [{ definition, count }] : [];
  });
}

/** The piece whose tiles include this one, the one on top first. */
export function pieceAt(pieces: readonly PlacedPiece[], tile: GridPosition): PlacedPiece | undefined {
  const order: Record<FurnitureDefinition['layer'], number> = { small: 0, standing: 1, floor: 2 };
  return pieces
    .filter((piece) => pieceTiles(piece).some((each) => each.x === tile.x && each.y === tile.y))
    .sort((a, b) => order[a.definition.layer] - order[b.definition.layer])[0];
}

/** Whether a piece is the very one in a list - the same entry, not merely the same kind. */
export function samePlacement(a: Placement, b: Placement): boolean {
  return a.id === b.id && a.room === b.room && a.x === b.x && a.y === b.y && a.facing === b.facing;
}
