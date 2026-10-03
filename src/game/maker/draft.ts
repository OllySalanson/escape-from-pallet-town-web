import {
  MAP_FILE_BUILDINGS,
  MAP_FILE_FORMAT,
  MAP_FILE_LIMITS,
  placeSlug,
  type MapFile,
  type MapFileBuilding,
  type MapFileBuildingKind,
  type MapFileDropIn,
  type MapFileExit,
  type MapFileOpens,
  type MapFileSpot,
} from '../world/mapFile';
import { KANTO_TILESET } from '../world/tileset/kantoTileset';
import { joinLedges, LEDGE_LETTERS, type GroundBrush } from './palette';
import { MATERIAL_CHARS } from '../world/tileset/materials';

/**
 * Everything the map maker does to a map, as pure functions of a map file.
 *
 * The editor never holds a map in any shape but the file it will save: every
 * stroke is a new `MapFile`, which is what makes undo a list of files, the
 * checks a function of what is on screen, and "what you see is what you
 * submit" true by construction. Nothing here knows a canvas or a key.
 */

export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

/** What a placed thing is, and which one. */
export type ThingRef =
  | { readonly kind: 'drop-in'; readonly index: number }
  | { readonly kind: 'exit'; readonly index: number }
  | { readonly kind: 'item'; readonly index: number }
  | { readonly kind: 'building'; readonly index: number };

export const TREE = MATERIAL_CHARS.tree;
export const GRASS = MATERIAL_CHARS.grass;

/** How deep the wood round a new map is: one whole FireRed tree. */
const BORDER = 2;

/** A size a map can be, clamped to what a file may describe. */
export function clampSize(width: number, height: number): { width: number; height: number } {
  const clamp = (value: number, low: number, high: number): number =>
    Math.max(low, Math.min(high, Math.round(Number.isFinite(value) ? value : low)));
  return {
    width: clamp(width, MAP_FILE_LIMITS.minWidth, MAP_FILE_LIMITS.maxWidth),
    height: clamp(height, MAP_FILE_LIMITS.minHeight, MAP_FILE_LIMITS.maxHeight),
  };
}

/**
 * A new map: grass in a ring of whole trees, and nothing on it. It does not
 * pass the checks - it has no way in and no way out - and the checks panel is
 * what tells the maker what to do first.
 */
export function blankMap(width = 40, height = 30, name = 'My map'): MapFile {
  const size = clampSize(width, height);
  const ground = Array.from({ length: size.height }, (_, y) =>
    Array.from({ length: size.width }, (_, x) =>
      x < BORDER || y < BORDER || x >= size.width - BORDER || y >= size.height - BORDER ? TREE : GRASS,
    ).join(''),
  );
  return {
    format: MAP_FILE_FORMAT,
    id: idFor(name),
    name,
    maker: '',
    width: size.width,
    height: size.height,
    ground,
    buildings: [],
    dropIns: [],
    exits: [],
    itemSpots: [],
    wildlife: 'meadow',
  };
}

/** A map's id, from its name: the part of a published map's id a maker chooses. */
export function idFor(name: string): string {
  return placeSlug(name).slice(0, 40).replace(/-+$/, '') || 'map';
}

const inside = (file: MapFile, { x, y }: GridPoint): boolean =>
  x >= 0 && y >= 0 && x < file.width && y < file.height;

const same = (a: GridPoint, b: GridPoint): boolean => a.x === b.x && a.y === b.y;

/** The ground letter at a tile, or undefined off the map. */
export function groundAt(file: MapFile, point: GridPoint): string | undefined {
  return inside(file, point) ? file.ground[point.y][point.x] : undefined;
}

/** Writes one letter onto every tile given. The same file when nothing changed. */
export function paint(file: MapFile, tiles: readonly GridPoint[], letter: string): MapFile {
  const byRow = new Map<number, number[]>();
  for (const tile of tiles) {
    if (inside(file, tile) && file.ground[tile.y][tile.x] !== letter) {
      byRow.set(tile.y, [...(byRow.get(tile.y) ?? []), tile.x]);
    }
  }
  if (byRow.size === 0) {
    return file;
  }
  const ground = file.ground.map((row, y) => {
    const columns = byRow.get(y);
    if (!columns) {
      return row;
    }
    const letters = [...row];
    for (const x of columns) {
      letters[x] = letter;
    }
    return letters.join('');
  });
  return { ...file, ground };
}

/**
 * Paints with a brush: each tile gets the letter the brush writes over what is
 * there, and every row touched has its ledges joined up again, so a ledge drawn
 * or cut in one stroke always has its two ends.
 */
export function paintWith(file: MapFile, tiles: readonly GridPoint[], brush: GroundBrush): MapFile {
  const byLetter = new Map<string, GridPoint[]>();
  for (const tile of tiles) {
    const under = groundAt(file, tile);
    if (under !== undefined) {
      const letter = brush.letterFor(under);
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), tile]);
    }
  }
  let next = file;
  for (const [letter, group] of byLetter) {
    next = paint(next, group, letter);
  }
  if (next === file) {
    return file;
  }
  const rows = new Set(tiles.map((tile) => tile.y));
  const isLedge = (letter: string): boolean => (LEDGE_LETTERS as readonly string[]).includes(letter);
  const ground = next.ground.map((row, y) => (rows.has(y) && [...row].some(isLedge) ? joinLedges(row) : row));
  return { ...next, ground };
}

/** Every tile of the rectangle two corners make, either way round. */
export function rectangle(from: GridPoint, to: GridPoint): GridPoint[] {
  const tiles: GridPoint[] = [];
  for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y += 1) {
    for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x += 1) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

/** Every tile of a straight-ish line between two tiles, so a fast drag leaves no gaps. */
export function line(from: GridPoint, to: GridPoint): GridPoint[] {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  const tiles: GridPoint[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = steps === 0 ? 0 : step / steps;
    tiles.push({ x: Math.round(from.x + (to.x - from.x) * t), y: Math.round(from.y + (to.y - from.y) * t) });
  }
  return tiles;
}

/** The ground of one letter joined to this tile, side by side: what a fill paints. */
export function fillRegion(file: MapFile, start: GridPoint): GridPoint[] {
  const letter = groundAt(file, start);
  if (letter === undefined) {
    return [];
  }
  const seen = new Set<number>([start.y * file.width + start.x]);
  const region: GridPoint[] = [start];
  for (let index = 0; index < region.length; index += 1) {
    const { x, y } = region[index];
    for (const next of [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ]) {
      const key = next.y * file.width + next.x;
      if (inside(file, next) && !seen.has(key) && file.ground[next.y][next.x] === letter) {
        seen.add(key);
        region.push(next);
      }
    }
  }
  return region;
}

/** A building's footprint in tiles, from the catalogue it is drawn from. */
export function buildingSize(kind: MapFileBuildingKind): { width: number; height: number } {
  const prop = KANTO_TILESET.props[MAP_FILE_BUILDINGS[kind]];
  return { width: prop.width, height: prop.height };
}

function covers(building: MapFileBuilding, point: GridPoint): boolean {
  const { width, height } = buildingSize(building.kind);
  return (
    point.x >= building.x && point.y >= building.y && point.x < building.x + width && point.y < building.y + height
  );
}

/** What stands on a tile, the one on top first: a place before the building it is beside. */
export function thingAt(file: MapFile, point: GridPoint): ThingRef | undefined {
  const dropIn = file.dropIns.findIndex((spot) => same(spot, point));
  if (dropIn >= 0) {
    return { kind: 'drop-in', index: dropIn };
  }
  const exit = file.exits.findIndex((spot) => same(spot, point));
  if (exit >= 0) {
    return { kind: 'exit', index: exit };
  }
  const item = file.itemSpots.findIndex((spot) => same(spot, point));
  if (item >= 0) {
    return { kind: 'item', index: item };
  }
  // The building planted last is drawn on top, so it is the one under the pointer.
  for (let index = file.buildings.length - 1; index >= 0; index -= 1) {
    if (covers(file.buildings[index], point)) {
      return { kind: 'building', index };
    }
  }
  return undefined;
}

/** A place's next free default name: Drop-in 1, Drop-in 2, ... */
function nextName(taken: readonly { readonly name: string }[], stem: string): string {
  const used = new Set(taken.map((spot) => placeSlug(spot.name)));
  for (let number = 1; ; number += 1) {
    const name = `${stem} ${number}`;
    if (!used.has(placeSlug(name))) {
      return name;
    }
  }
}

export type PlaceOutcome =
  | { readonly placed: true; readonly file: MapFile; readonly thing: ThingRef }
  | { readonly placed: false; readonly reason: string };

/**
 * Puts a drop-in, an exit or an item spot on a tile. A tile holds one place:
 * the checks would refuse two, so the editor never makes them.
 */
export function placeSpot(
  file: MapFile,
  kind: 'drop-in' | 'exit' | 'item',
  point: GridPoint,
): PlaceOutcome {
  if (!inside(file, point)) {
    return { placed: false, reason: 'That is off the map.' };
  }
  const there = thingAt(file, point);
  if (there && there.kind !== 'building') {
    return { placed: false, reason: 'Something is already on that tile.' };
  }
  const spot = { x: point.x, y: point.y };
  if (kind === 'drop-in') {
    if (file.dropIns.length >= MAP_FILE_LIMITS.maxDropIns) {
      return { placed: false, reason: `A map has at most ${MAP_FILE_LIMITS.maxDropIns} drop-ins.` };
    }
    const dropIn: MapFileDropIn = { ...spot, name: nextName(file.dropIns, 'Drop-in') };
    return { placed: true, file: { ...file, dropIns: [...file.dropIns, dropIn] }, thing: { kind, index: file.dropIns.length } };
  }
  if (kind === 'exit') {
    if (file.exits.length >= MAP_FILE_LIMITS.maxExits) {
      return { placed: false, reason: `A map has at most ${MAP_FILE_LIMITS.maxExits} exits.` };
    }
    const exit: MapFileExit = { ...spot, name: nextName(file.exits, 'Exit'), opens: { when: 'always' } };
    return { placed: true, file: { ...file, exits: [...file.exits, exit] }, thing: { kind, index: file.exits.length } };
  }
  if (file.itemSpots.length >= MAP_FILE_LIMITS.maxItemSpots) {
    return { placed: false, reason: `A map has at most ${MAP_FILE_LIMITS.maxItemSpots} item spots.` };
  }
  return {
    placed: true,
    file: { ...file, itemSpots: [...file.itemSpots, spot] },
    thing: { kind, index: file.itemSpots.length },
  };
}

/**
 * Plants a building with its top-left corner on a tile. It has to fit on the
 * map and may not stand on another building, because two roofs on one tile
 * draw as neither.
 */
export function placeBuilding(file: MapFile, kind: MapFileBuildingKind, corner: GridPoint): PlaceOutcome {
  const { width, height } = buildingSize(kind);
  const footprint = rectangle(corner, { x: corner.x + width - 1, y: corner.y + height - 1 });
  if (!footprint.every((tile) => inside(file, tile))) {
    return { placed: false, reason: 'It does not fit there: part of it is off the map.' };
  }
  if (footprint.some((tile) => file.buildings.some((other) => covers(other, tile)))) {
    return { placed: false, reason: 'Another building is standing there.' };
  }
  const building: MapFileBuilding = { x: corner.x, y: corner.y, kind };
  return {
    placed: true,
    file: { ...file, buildings: [...file.buildings, building] },
    thing: { kind: 'building', index: file.buildings.length },
  };
}

/** Takes one placed thing off the map. */
export function removeThing(file: MapFile, thing: ThingRef): MapFile {
  const without = <T>(list: readonly T[]): T[] => list.filter((_, index) => index !== thing.index);
  switch (thing.kind) {
    case 'drop-in':
      return { ...file, dropIns: without(file.dropIns) };
    case 'exit':
      return { ...file, exits: without(file.exits) };
    case 'item':
      return { ...file, itemSpots: without(file.itemSpots) };
    case 'building':
      return { ...file, buildings: without(file.buildings) };
  }
}

/** Moves a placed thing to another tile, keeping its name and settings. */
export function moveThing(file: MapFile, thing: ThingRef, to: GridPoint): PlaceOutcome {
  if (thing.kind === 'building') {
    const building = file.buildings[thing.index];
    const rest = removeThing(file, thing);
    const outcome = placeBuilding(rest, building.kind, to);
    if (!outcome.placed) {
      return outcome;
    }
    // Back into its own place in the list, so what is drawn on top does not change.
    const buildings = [...rest.buildings];
    buildings.splice(thing.index, 0, { ...building, x: to.x, y: to.y });
    return { placed: true, file: { ...rest, buildings }, thing };
  }
  if (!inside(file, to)) {
    return { placed: false, reason: 'That is off the map.' };
  }
  const there = thingAt(file, to);
  if (there && there.kind !== 'building' && !(there.kind === thing.kind && there.index === thing.index)) {
    return { placed: false, reason: 'Something is already on that tile.' };
  }
  const moved = <T extends MapFileSpot>(list: readonly T[]): T[] =>
    list.map((spot, index) => (index === thing.index ? { ...spot, x: to.x, y: to.y } : spot));
  const next =
    thing.kind === 'drop-in'
      ? { ...file, dropIns: moved(file.dropIns) }
      : thing.kind === 'exit'
        ? { ...file, exits: moved(file.exits) }
        : { ...file, itemSpots: moved(file.itemSpots) };
  return { placed: true, file: next, thing };
}

/** Renames a drop-in or an exit. */
export function renamePlace(file: MapFile, thing: ThingRef, name: string): MapFile {
  const trimmed = name.slice(0, MAP_FILE_LIMITS.maxPlaceNameLength);
  if (thing.kind === 'drop-in') {
    return {
      ...file,
      dropIns: file.dropIns.map((spot, index) => (index === thing.index ? { ...spot, name: trimmed } : spot)),
    };
  }
  if (thing.kind === 'exit') {
    return {
      ...file,
      exits: file.exits.map((spot, index) => (index === thing.index ? { ...spot, name: trimmed } : spot)),
    };
  }
  return file;
}

/** What a drop-in says about itself on the drop-in screen. Empty takes it away. */
export function describeDropIn(file: MapFile, index: number, description: string): MapFile {
  const text = description.slice(0, MAP_FILE_LIMITS.maxDescriptionLength);
  return {
    ...file,
    dropIns: file.dropIns.map((spot, at) => {
      if (at !== index) {
        return spot;
      }
      const rest: MapFileDropIn = { x: spot.x, y: spot.y, name: spot.name };
      return text.trim().length > 0 ? { ...rest, description: text } : rest;
    }),
  };
}

/** When an exit opens. */
export function setExitOpens(file: MapFile, index: number, opens: MapFileOpens): MapFile {
  return {
    ...file,
    exits: file.exits.map((spot, at) => (at === index ? { ...spot, opens } : spot)),
  };
}

/** The map's own name, which also chooses its id. */
export function renameMap(file: MapFile, name: string): MapFile {
  const trimmed = name.slice(0, MAP_FILE_LIMITS.maxNameLength);
  return { ...file, name: trimmed, id: idFor(trimmed) };
}

export function setMaker(file: MapFile, maker: string): MapFile {
  return { ...file, maker: maker.slice(0, MAP_FILE_LIMITS.maxMakerLength) };
}

/**
 * The map at another size, anchored at its top-left. New ground is trees, so
 * a map grown never opens a hole in its edge; anything left off the map goes.
 */
export function resizeMap(file: MapFile, width: number, height: number): MapFile {
  const size = clampSize(width, height);
  if (size.width === file.width && size.height === file.height) {
    return file;
  }
  const ground = Array.from({ length: size.height }, (_, y) => {
    const row = file.ground[y] ?? '';
    return (row.slice(0, size.width) + TREE.repeat(size.width)).slice(0, size.width);
  });
  const fits = (spot: MapFileSpot): boolean => spot.x < size.width && spot.y < size.height;
  const next: MapFile = {
    ...file,
    width: size.width,
    height: size.height,
    ground,
    dropIns: file.dropIns.filter(fits),
    exits: file.exits.filter(fits),
    itemSpots: file.itemSpots.filter(fits),
  };
  return {
    ...next,
    buildings: file.buildings.filter((building) => {
      const { width: w, height: h } = buildingSize(building.kind);
      return building.x + w <= size.width && building.y + h <= size.height;
    }),
  };
}
