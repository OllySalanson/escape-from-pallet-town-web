import type { GridPosition } from '../movement/gridMovement';
import { largestMapSize, mapPicture, type MapPictureContext } from '../hub/dropIn';
import { availableInsertionIds } from '../run/runGeneration';
import type { RestoredGame } from '../save/SaveManager';
import type { Rect } from '../ui/labelPlacement';
import { districtAt, districtsForMap } from '../world/districts';
import { gatesByKeeper, gatesForMap, gateKey, jointGateLabel, openedDoors, type MapGate } from '../world/gates';
import {
  fitPicture,
  fittedSize,
  paintMinimap,
  MARK_RING,
  type Minimap,
  type PaintedPicture,
  type PictureSize,
} from '../world/minimap';
import { surveyedTiles } from '../world/survey';
import { bossEncounters, createRunTrainerEncounters } from '../world/trainers';
import { getWorldMap, WORLD_MAP_NAMES, type WorldMapDefinition, type WorldMapId } from '../worldMap';

/**
 * The wall map in Oak's Lab: the four raid maps, hung side by side on the
 * stretch of back wall the lab kept bare for them (`rooms.ts`'s
 * `OAK_WALL_MAP`).
 *
 * It is the drop-in screen's picture of a place (`hub/dropIn.ts`), four times
 * and all at once, which is the one thing the drop-in screen cannot show: how
 * far the player has got across the whole game. Everywhere a raid has walked
 * is lit and everywhere else is still dark, so the base answers "where have I
 * been" by being looked at - the captain's rule for the whole base, that
 * progress is something you see in a room rather than a number on a ledger.
 *
 * **Every keeper beaten leaves their gate's sign pinned beside the map they
 * held.** A boss opens their doors for good (`world/gates.ts`), and the map
 * already lights those doors; the sign is the trophy, pinned under the map in
 * the order the keepers stand, so a player can count what they have beaten off
 * the wall from the door mat.
 *
 * Nothing is stored. The picture is built from the maps in the gate state this
 * save has earned and from `raidProgress.surveyed`, exactly as the drop-in
 * screen's is, so the two can never disagree - and walking up to the wall and
 * pressing the interact key opens the same four pictures on a screen, drawn as
 * big as the window allows (`HubScene`'s wall map).
 */

/** The four maps, left to right: where every save starts, then the three it opens. */
export const WALL_MAP_ORDER: readonly WorldMapId[] = [
  'floodplain-relay',
  'pallet-town',
  'route-1',
  'viridian-forest',
];

/** One beaten keeper's sign: who held the doors, and what the doors are called. */
export interface WallSign {
  readonly bossId: string;
  /** The keeper's name, as the raid captions it. */
  readonly keeper: string;
  /** The doors, named in one breath (`jointGateLabel`): OVERLOOK GATE + STEPS. */
  readonly doors: string;
}

export interface WallMapEntry {
  readonly mapId: WorldMapId;
  readonly name: string;
  readonly size: PictureSize;
  /** How much of the walkable ground is known, 0 to 1. */
  readonly known: number;
  /** Whether any raid has walked this map at all, as against only knowing its doors. */
  readonly walked: boolean;
  /** Named places reached, and how many the map has. */
  readonly districtsKnown: number;
  readonly districts: number;
  /** One sign per keeper beaten on this map, in the order they stand. */
  readonly signs: readonly WallSign[];
  /** How many keepers still hold doors on this map. */
  readonly held: number;
}

/** What a picture of one map is drawn from, for this save. */
export function wallMapContext(game: RestoredGame, mapId: WorldMapId): MapPictureContext {
  const progress = game.raidProgress;
  return {
    map: getWorldMap(mapId, openedDoors(progress)),
    defeatedBosses: progress.defeatedBosses,
    completedContracts: progress.completedContracts,
    openedGates: progress.openedGates ?? [],
    surveyed: progress.surveyed,
    insertionIds: availableInsertionIds(progress),
  };
}

/** The picture of one map as it hangs on the wall, at a step the caller has fitted. */
export function wallMapPicture(game: RestoredGame, mapId: WorldMapId, step = 1): Minimap {
  return mapPicture(mapId, wallMapContext(game, mapId), { step });
}

/** The keepers of a map, keeper by keeper: their id, name and doors. */
function keepersOf(mapId: WorldMapId): readonly { readonly bossId: string; readonly keeper: string; readonly gates: readonly MapGate[] }[] {
  const bosses = bossEncounters(createRunTrainerEncounters());
  return gatesByKeeper(gatesForMap(mapId))
    .filter((gates) => gates[0]?.bossId !== undefined)
    .map((gates) => {
      const bossId = gateKey(gates[0]);
      return {
        bossId,
        keeper: bosses.find((boss) => boss.bossId === bossId)?.trainer.name ?? 'SOMEBODY',
        gates,
      };
    });
}

/** The signs a save has earned on one map: one for every keeper it has beaten there. */
export function wallSigns(game: RestoredGame, mapId: WorldMapId): readonly WallSign[] {
  const beaten = new Set(game.raidProgress.defeatedBosses);
  return keepersOf(mapId)
    .filter((keeper) => beaten.has(keeper.bossId))
    .map((keeper) => ({
      bossId: keeper.bossId,
      keeper: keeper.keeper,
      // One line: a sign is read at a glance, and two doors with nothing in
      // common are joined across a line break for a caption, not for a plaque.
      doors: jointGateLabel(keeper.gates).replace(/\s*\n\s*/g, ' '),
    }));
}

/** Everything the wall says about one map. */
export function wallMapEntry(game: RestoredGame, mapId: WorldMapId): WallMapEntry {
  const context = wallMapContext(game, mapId);
  const picture = mapPicture(mapId, context);
  const signs = wallSigns(game, mapId);
  const surveyed = surveyedTiles(context.surveyed?.[mapId], context.map.width);
  return {
    mapId,
    name: WORLD_MAP_NAMES[mapId],
    size: { width: context.map.width, height: context.map.height },
    known: picture.walkable === 0 ? 0 : picture.knownWalkable / picture.walkable,
    walked: surveyed.size > 0,
    ...districtsReached(context.map, surveyed, mapId),
    signs,
    held: keepersOf(mapId).length - signs.length,
  };
}

function districtsReached(
  map: WorldMapDefinition,
  surveyed: ReadonlySet<number>,
  mapId: WorldMapId,
): { readonly districtsKnown: number; readonly districts: number } {
  const all = districtsForMap(mapId);
  const reached = new Set<string>();
  for (const tile of surveyed) {
    const district = districtAt(mapId, { x: tile % map.width, y: Math.floor(tile / map.width) });
    if (district) {
      reached.add(district.id);
    }
  }
  return { districtsKnown: reached.size, districts: all.length };
}

/** The four maps, in the order they hang. */
export function wallMapEntries(game: RestoredGame): readonly WallMapEntry[] {
  return WALL_MAP_ORDER.map((mapId) => wallMapEntry(game, mapId));
}

/** The biggest of the four maps, which every picture on the wall is sized against. */
export const wallMapReference = largestMapSize;

// --- the poster on the lab wall -------------------------------------------

/**
 * The wall map as it hangs in the room: a board five tiles by two, drawn a
 * game pixel at a time, with the four pictures on it at one scale and a sign
 * pinned under each for every keeper beaten there.
 *
 * It is not a tile off the sheet because nothing about it is fixed - it is a
 * picture of the save - so it is drawn here as pixels, Phaser-free, and
 * `BaseScene` makes a texture of it the way `HubScene` paints a canvas.
 * `tools/base/renderBase.mts` draws the same pixels, so the room can be judged
 * without a browser.
 */
export const POSTER_TILE = 16;

const POSTER = {
  outline: '#2e2016',
  frame: '#a86f3a',
  frameLight: '#cf9a5c',
  board: '#e6d8ab',
  boardShade: '#d2c190',
  sign: '#c98a3f',
  signEdge: '#6b4320',
  pin: '#d8342c',
} as const;

/** The board's border - an outline and a wooden frame - on each side, in pixels. */
const POSTER_BORDER = 2;
/** Pixels between two pictures, and between the board's edge and the first. */
const POSTER_GAP = 2;
/** Pixels of board above the pictures and below the signs. */
const POSTER_MARGIN = 1;
/** A pinned sign: how wide, how tall, and the pixel between two of them. */
const SIGN_WIDTH = 3;
const SIGN_HEIGHT = 3;
const SIGN_GAP = 1;
/** Pixels between the foot of a picture's ring and the head of its pins. */
const SIGN_DROP = 1;

export interface PosterLayout {
  readonly width: number;
  readonly height: number;
  /** Where each picture's ring stands, top-left, and how big the picture is. */
  readonly pictures: readonly { readonly mapId: WorldMapId; readonly at: GridPosition; readonly size: PictureSize }[];
  /** How many tiles a pixel of every picture stands for. */
  readonly step: number;
  /** Where each pinned sign stands, top-left, by map. */
  readonly signs: readonly { readonly mapId: WorldMapId; readonly at: GridPosition }[];
}

/**
 * Where everything on the board goes. The pictures share one scale - the
 * largest the biggest map fits at - and stand on one line, so their feet and
 * the signs under them are level whatever shape each map is.
 */
export function posterLayout(area: Rect, signCounts: Readonly<Record<string, number>>): PosterLayout {
  const width = area.width * POSTER_TILE;
  const height = area.height * POSTER_TILE;
  const reference = wallMapReference();
  const sizes = WALL_MAP_ORDER.map((mapId) => {
    const map = getWorldMap(mapId, []);
    return { mapId, width: map.width, height: map.height };
  });
  const innerWidth = width - POSTER_BORDER * 2 - POSTER_GAP * (WALL_MAP_ORDER.length + 1);
  const innerHeight =
    height - POSTER_BORDER * 2 - POSTER_MARGIN * 2 - SIGN_DROP - SIGN_HEIGHT;
  // Every ring is a pixel each side, so the room a picture has is two short.
  const totalTiles = sizes.reduce((sum, size) => sum + size.width, 0);
  let step = fitPicture(reference, { width: innerWidth, height: innerHeight - 2 }).step;
  const across = (candidate: number): number =>
    sizes.reduce((sum, size) => sum + Math.ceil(size.width / candidate) + 2, 0);
  while (across(step) > innerWidth && step < totalTiles) {
    step += 1;
  }
  const drawn = sizes.map((size) => fittedSize(size, { step, zoom: 1 }));
  const used = drawn.reduce((sum, size) => sum + size.width + 2, 0);
  const spare = innerWidth - used;
  const tallest = Math.max(...drawn.map((size) => size.height)) + 2;
  const baseline = POSTER_BORDER + POSTER_MARGIN + tallest;
  let x = POSTER_BORDER + POSTER_GAP + Math.floor(spare / 2);
  const pictures: { mapId: WorldMapId; at: GridPosition; size: PictureSize }[] = [];
  const signs: { mapId: WorldMapId; at: GridPosition }[] = [];
  sizes.forEach((size, index) => {
    const picture = drawn[index];
    const ring = { width: picture.width + 2, height: picture.height + 2 };
    pictures.push({ mapId: size.mapId, at: { x, y: baseline - ring.height }, size: picture });
    const count = signCounts[size.mapId] ?? 0;
    const row = count * SIGN_WIDTH + Math.max(0, count - 1) * SIGN_GAP;
    let signX = x + Math.floor((ring.width - row) / 2);
    for (let sign = 0; sign < count; sign += 1) {
      signs.push({ mapId: size.mapId, at: { x: signX, y: baseline + SIGN_DROP } });
      signX += SIGN_WIDTH + SIGN_GAP;
    }
    x += ring.width + POSTER_GAP;
  });
  return { width, height, pictures, step, signs };
}

/** The board as pixels, for this save. */
export function wallMapPoster(game: RestoredGame, area: Rect): PaintedPicture {
  const signCounts = Object.fromEntries(
    WALL_MAP_ORDER.map((mapId) => [mapId, wallSigns(game, mapId).length]),
  );
  const layout = posterLayout(area, signCounts);
  const { width, height } = layout;
  const data = new Uint8ClampedArray(width * height * 4);
  const fill = (x: number, y: number, w: number, h: number, ink: string): void => {
    const rgb = [1, 3, 5].map((at) => Number.parseInt(ink.slice(at, at + 2), 16));
    for (let py = Math.max(0, y); py < Math.min(height, y + h); py += 1) {
      for (let px = Math.max(0, x); px < Math.min(width, x + w); px += 1) {
        const at = (py * width + px) * 4;
        data.set([rgb[0], rgb[1], rgb[2], 255], at);
      }
    }
  };
  // The board: an outline, a wooden frame lit along its top and left, and the
  // paper the maps are pasted to, shaded a pixel under the frame's lip.
  fill(0, 0, width, height, POSTER.outline);
  fill(1, 1, width - 2, height - 2, POSTER.frame);
  fill(1, 1, width - 2, 1, POSTER.frameLight);
  fill(1, 1, 1, height - 2, POSTER.frameLight);
  fill(POSTER_BORDER, POSTER_BORDER, width - POSTER_BORDER * 2, height - POSTER_BORDER * 2, POSTER.board);
  fill(POSTER_BORDER, POSTER_BORDER, width - POSTER_BORDER * 2, 1, POSTER.boardShade);
  fill(POSTER_BORDER, POSTER_BORDER, 1, height - POSTER_BORDER * 2, POSTER.boardShade);
  for (const placed of layout.pictures) {
    const painted = paintMinimap(wallMapPicture(game, placed.mapId, layout.step), 1);
    fill(placed.at.x, placed.at.y, painted.width + 2, painted.height + 2, MARK_RING);
    for (let y = 0; y < painted.height; y += 1) {
      for (let x = 0; x < painted.width; x += 1) {
        const from = (y * painted.width + x) * 4;
        const to = ((placed.at.y + 1 + y) * width + placed.at.x + 1 + x) * 4;
        data.set(painted.data.subarray(from, from + 4), to);
      }
    }
  }
  // A sign: a little plaque with its edge along the foot, and a red pin in it.
  for (const sign of layout.signs) {
    fill(sign.at.x, sign.at.y, SIGN_WIDTH, SIGN_HEIGHT, POSTER.sign);
    fill(sign.at.x, sign.at.y + SIGN_HEIGHT - 1, SIGN_WIDTH, 1, POSTER.signEdge);
    fill(sign.at.x + Math.floor(SIGN_WIDTH / 2), sign.at.y, 1, 1, POSTER.pin);
  }
  return { width, height, data };
}

/** What the caption over the wall map says under its name: the one number it adds up to. */
export function wallMapNote(game: RestoredGame): string {
  const entries = wallMapEntries(game);
  const beaten = entries.reduce((sum, entry) => sum + entry.signs.length, 0);
  const keepers = entries.reduce((sum, entry) => sum + entry.signs.length + entry.held, 0);
  const walked = entries.filter((entry) => entry.walked).length;
  return beaten === 0
    ? `${walked} of ${entries.length} maps walked`
    : `${beaten} of ${keepers} keepers beaten`;
}
