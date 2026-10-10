import {
  MAP_FILE_BUILDINGS,
  MAP_FILE_FORMAT,
  MAP_FILE_LIMITS,
  placeSlug,
  type MapFile,
  type MapFileBuilding,
  type MapFileBuildingKind,
  type MapFileDistrict,
  type MapFileDropIn,
  type MapFileExit,
  type MapFileLandmark,
  type MapFileOpens,
  type MapFilePerson,
  type MapFileSign,
  type MapFileSpot,
  type MapFileTrainer,
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
export type SpotKind = 'drop-in' | 'exit' | 'item' | 'person' | 'sign' | 'landmark' | 'trainer';

export type ThingRef =
  | { readonly kind: SpotKind; readonly index: number }
  | { readonly kind: 'building'; readonly index: number }
  | { readonly kind: 'district'; readonly index: number };

/** The list in a file each kind of one-tile thing is kept in. */
const SPOT_LISTS = {
  'drop-in': 'dropIns',
  exit: 'exits',
  item: 'itemSpots',
  person: 'people',
  sign: 'signs',
  landmark: 'landmarks',
  trainer: 'trainers',
} as const satisfies Record<SpotKind, keyof MapFile>;

/** Every one-tile thing on a map, the one drawn on top first. */
const SPOT_ORDER: readonly SpotKind[] = [
  'drop-in',
  'exit',
  'trainer',
  'person',
  'sign',
  'landmark',
  'item',
];

function spotsOf(file: MapFile, kind: SpotKind): readonly MapFileSpot[] {
  return file[SPOT_LISTS[kind]] ?? [];
}

function withSpots(file: MapFile, kind: SpotKind, spots: readonly MapFileSpot[]): MapFile {
  return { ...file, [SPOT_LISTS[kind]]: spots };
}

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
      x < BORDER || y < BORDER || x >= size.width - BORDER || y >= size.height - BORDER
        ? TREE
        : GRASS,
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
  const isLedge = (letter: string): boolean =>
    (LEDGE_LETTERS as readonly string[]).includes(letter);
  const ground = next.ground.map((row, y) =>
    rows.has(y) && [...row].some(isLedge) ? joinLedges(row) : row,
  );
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
    tiles.push({
      x: Math.round(from.x + (to.x - from.x) * t),
      y: Math.round(from.y + (to.y - from.y) * t),
    });
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
    point.x >= building.x &&
    point.y >= building.y &&
    point.x < building.x + width &&
    point.y < building.y + height
  );
}

/** The one-tile thing standing on a tile, if any. */
function spotAt(file: MapFile, point: GridPoint): ThingRef | undefined {
  for (const kind of SPOT_ORDER) {
    const index = spotsOf(file, kind).findIndex((spot) => same(spot, point));
    if (index >= 0) {
      return { kind, index };
    }
  }
  return undefined;
}

/**
 * What stands on a tile, the one on top first: a place before the building it
 * is beside, and a building before the district it is in.
 */
export function thingAt(file: MapFile, point: GridPoint): ThingRef | undefined {
  const spot = spotAt(file, point);
  if (spot) {
    return spot;
  }
  // The building planted last is drawn on top, so it is the one under the pointer.
  for (let index = file.buildings.length - 1; index >= 0; index -= 1) {
    if (covers(file.buildings[index], point)) {
      return { kind: 'building', index };
    }
  }
  const districts = file.districts ?? [];
  for (let index = districts.length - 1; index >= 0; index -= 1) {
    const district = districts[index];
    if (
      point.x >= district.x &&
      point.y >= district.y &&
      point.x < district.x + district.width &&
      point.y < district.y + district.height
    ) {
      return { kind: 'district', index };
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

/** How many of each one-tile thing a map may hold, and what a maker calls it. */
const SPOT_RULES: Readonly<Record<SpotKind, { readonly max: number; readonly plural: string }>> = {
  'drop-in': { max: MAP_FILE_LIMITS.maxDropIns, plural: 'drop-ins' },
  exit: { max: MAP_FILE_LIMITS.maxExits, plural: 'exits' },
  item: { max: MAP_FILE_LIMITS.maxItemSpots, plural: 'item spots' },
  person: { max: MAP_FILE_LIMITS.maxPeople, plural: 'people' },
  sign: { max: MAP_FILE_LIMITS.maxSigns, plural: 'signs' },
  landmark: { max: MAP_FILE_LIMITS.maxLandmarks, plural: 'landmarks' },
  trainer: { max: MAP_FILE_LIMITS.maxTrainers, plural: 'trainers' },
};

const spotOf = <T extends MapFileSpot>(spot: T): MapFileSpot => spot;

/** A new one of a kind, standing on a tile, with everything about it at its plainest. */
function newSpot(file: MapFile, kind: SpotKind, spot: MapFileSpot): MapFileSpot {
  switch (kind) {
    case 'drop-in':
      return spotOf<MapFileDropIn>({ ...spot, name: nextName(file.dropIns, 'Drop-in') });
    case 'exit':
      return spotOf<MapFileExit>({
        ...spot,
        name: nextName(file.exits, 'Exit'),
        opens: { when: 'always' },
      });
    case 'item':
      return spot;
    case 'person':
      return spotOf<MapFilePerson>({
        ...spot,
        name: nextName(file.people ?? [], 'Person'),
        look: 'boy',
        facing: 'down',
        lines: [],
      });
    case 'sign':
      return spotOf<MapFileSign>({ ...spot, lines: [] });
    case 'landmark':
      return spotOf<MapFileLandmark>({
        ...spot,
        name: nextName(file.landmarks ?? [], 'Landmark'),
        kind: 'spring',
      });
    case 'trainer':
      return spotOf<MapFileTrainer>({
        ...spot,
        name: nextName(file.trainers ?? [], 'Trainer'),
        team: 'scout',
        look: 'youngster',
        facing: 'down',
        sight: 0,
        lines: [],
      });
  }
}

/**
 * Puts a one-tile thing on a tile: a drop-in, an exit, an item spot, a person,
 * a sign, a landmark or a trainer. A tile holds one of them: the checks would
 * refuse two, so the editor never makes them.
 */
export function placeSpot(file: MapFile, kind: SpotKind, point: GridPoint): PlaceOutcome {
  if (!inside(file, point)) {
    return { placed: false, reason: 'That is off the map.' };
  }
  if (spotAt(file, point)) {
    return { placed: false, reason: 'Something is already on that tile.' };
  }
  const list = spotsOf(file, kind);
  const rule = SPOT_RULES[kind];
  if (list.length >= rule.max) {
    return { placed: false, reason: `A map has at most ${rule.max} ${rule.plural}.` };
  }
  return {
    placed: true,
    file: withSpots(file, kind, [...list, newSpot(file, kind, { x: point.x, y: point.y })]),
    thing: { kind, index: list.length },
  };
}

/**
 * Marks out a district: a named part of the map. Districts may overlap - the
 * first listed wins a tile, as the game's own do - so a smaller place can be
 * drawn inside a bigger one before it.
 */
export function addDistrict(file: MapFile, from: GridPoint, to: GridPoint): PlaceOutcome {
  const districts = file.districts ?? [];
  if (districts.length >= MAP_FILE_LIMITS.maxDistricts) {
    return {
      placed: false,
      reason: `A map has at most ${MAP_FILE_LIMITS.maxDistricts} districts.`,
    };
  }
  const x = Math.max(0, Math.min(from.x, to.x));
  const y = Math.max(0, Math.min(from.y, to.y));
  const district: MapFileDistrict = {
    name: nextName(districts, 'District'),
    x,
    y,
    width: Math.min(file.width - 1, Math.max(from.x, to.x)) - x + 1,
    height: Math.min(file.height - 1, Math.max(from.y, to.y)) - y + 1,
  };
  return {
    placed: true,
    file: { ...file, districts: [...districts, district] },
    thing: { kind: 'district', index: districts.length },
  };
}

/** Changes some of what is said about one placed thing, leaving the rest. */
export function updateThing(
  file: MapFile,
  thing: ThingRef,
  changes: Readonly<Record<string, unknown>>,
): MapFile {
  if (thing.kind === 'building') {
    return file;
  }
  if (thing.kind === 'district') {
    const districts = file.districts ?? [];
    return {
      ...file,
      districts: districts.map((district, index) => {
        if (index !== thing.index) {
          return district;
        }
        const next = { ...district, ...changes } as MapFileDistrict & { wildlife?: unknown };
        if (next.wildlife === undefined) {
          const { name, x, y, width, height } = next;
          return { name, x, y, width, height };
        }
        return next;
      }),
    };
  }
  const list = spotsOf(file, thing.kind);
  return withSpots(
    file,
    thing.kind,
    list.map((spot, index) => (index === thing.index ? { ...spot, ...changes } : spot)),
  );
}

/**
 * Plants a building with its top-left corner on a tile. It has to fit on the
 * map and may not stand on another building, because two roofs on one tile
 * draw as neither.
 */
export function placeBuilding(
  file: MapFile,
  kind: MapFileBuildingKind,
  corner: GridPoint,
): PlaceOutcome {
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
  if (thing.kind === 'building') {
    return { ...file, buildings: without(file.buildings) };
  }
  if (thing.kind === 'district') {
    return { ...file, districts: without(file.districts ?? []) };
  }
  return withSpots(file, thing.kind, without(spotsOf(file, thing.kind)));
}

/**
 * Whether `thing` still names something on the map. A choice is an index into
 * a list, so once anything is taken off that list it may name the next thing
 * along or nothing at all.
 */
export function thingExists(file: MapFile, thing: ThingRef): boolean {
  const list =
    thing.kind === 'building'
      ? file.buildings
      : thing.kind === 'district'
        ? (file.districts ?? [])
        : spotsOf(file, thing.kind);
  return Number.isInteger(thing.index) && thing.index >= 0 && thing.index < list.length;
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
  if (thing.kind === 'district') {
    // A district moves whole, staying on the map.
    const district = (file.districts ?? [])[thing.index];
    const x = Math.max(0, Math.min(file.width - district.width, to.x));
    const y = Math.max(0, Math.min(file.height - district.height, to.y));
    return { placed: true, file: updateThing(file, thing, { x, y }), thing };
  }
  if (!inside(file, to)) {
    return { placed: false, reason: 'That is off the map.' };
  }
  const there = spotAt(file, to);
  if (there && !(there.kind === thing.kind && there.index === thing.index)) {
    return { placed: false, reason: 'Something is already on that tile.' };
  }
  return { placed: true, file: updateThing(file, thing, { x: to.x, y: to.y }), thing };
}

/** Renames a drop-in or an exit. */
export function renamePlace(file: MapFile, thing: ThingRef, name: string): MapFile {
  const trimmed = name.slice(0, MAP_FILE_LIMITS.maxPlaceNameLength);
  if (thing.kind === 'drop-in') {
    return {
      ...file,
      dropIns: file.dropIns.map((spot, index) =>
        index === thing.index ? { ...spot, name: trimmed } : spot,
      ),
    };
  }
  if (thing.kind === 'exit') {
    return {
      ...file,
      exits: file.exits.map((spot, index) =>
        index === thing.index ? { ...spot, name: trimmed } : spot,
      ),
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
 * What a size field holds, as a size: the number typed, or `current` when the
 * field holds no number at all. An emptied field is a maker part way through
 * typing a new size, never a request for the smallest map there is - read as
 * a number it was zero, which `clampSize` made the minimum, and the map was
 * cut down to it the moment the field lost focus.
 */
export function sizeFromField(typed: string, current: number): number {
  const value = typed.trim() === '' ? Number.NaN : Number(typed);
  return Number.isFinite(value) ? value : current;
}

/**
 * The file with everything that no longer stands on the map taken off it, and
 * every district cut to the part of it that is still on the map. A file is
 * only ever readable whole, so a single person left at 30,20 on a 20x16 map
 * makes the whole draft one the game - and the editor's own store - cannot
 * open.
 */
export function keepOnMap(file: MapFile): MapFile {
  const { width, height } = file;
  const fits = (spot: MapFileSpot): boolean =>
    spot.x >= 0 && spot.y >= 0 && spot.x < width && spot.y < height;
  const people = file.people?.filter(fits);
  const signs = file.signs?.filter(fits);
  const landmarks = file.landmarks?.filter(fits);
  const trainers = file.trainers?.filter(fits);
  const districts = file.districts?.flatMap((district): MapFileDistrict[] => {
    const x = Math.max(0, district.x);
    const y = Math.max(0, district.y);
    const right = Math.min(width, district.x + district.width);
    const bottom = Math.min(height, district.y + district.height);
    return right > x && bottom > y
      ? [{ ...district, x, y, width: right - x, height: bottom - y }]
      : [];
  });
  return {
    ...file,
    buildings: file.buildings.filter((building) => {
      const size = buildingSize(building.kind);
      return (
        building.x >= 0 &&
        building.y >= 0 &&
        building.x + size.width <= width &&
        building.y + size.height <= height
      );
    }),
    dropIns: file.dropIns.filter(fits),
    exits: file.exits.filter(fits),
    itemSpots: file.itemSpots.filter(fits),
    ...(people ? { people } : {}),
    ...(signs ? { signs } : {}),
    ...(landmarks ? { landmarks } : {}),
    ...(trainers ? { trainers } : {}),
    ...(districts ? { districts } : {}),
  };
}

/**
 * How many whole lines of trees stand at the end of a map, counting in from
 * its edge - the wood a map is ringed with, which a shrunk map keeps.
 */
function treeBand(lines: readonly string[], cap: number): number {
  let band = 0;
  while (band < cap && band < lines.length && isAllTrees(lines[lines.length - 1 - band])) {
    band += 1;
  }
  return band;
}

const isAllTrees = (line: string): boolean => line.length > 0 && [...line].every((tile) => tile === TREE);

/** The map's ground read a column at a time, top to bottom. */
function columnsOf(ground: readonly string[], width: number): string[] {
  return Array.from({ length: width }, (_, x) => ground.map((row) => row[x] ?? '').join(''));
}

/**
 * The map at another size, anchored at its top-left. New ground is trees, so
 * a map grown never opens a hole in its edge; a map shrunk keeps the band of
 * trees its east and south edges stood in, so cutting a map down never opens
 * one either (playtest 46: a new 40x30 cut to 24x18 lost its ring on two
 * sides). Anything left off the map goes, and a district part on and part off
 * is cut to the part that is on.
 */
export function resizeMap(file: MapFile, width: number, height: number): MapFile {
  const size = clampSize(width, height);
  if (size.width === file.width && size.height === file.height) {
    return file;
  }
  const east =
    size.width < file.width ? treeBand(columnsOf(file.ground, file.width), Math.floor(size.width / 2)) : 0;
  const south = size.height < file.height ? treeBand(file.ground, Math.floor(size.height / 2)) : 0;
  const ground = Array.from({ length: size.height }, (_, y) => {
    const row =
      y >= size.height - south ? file.ground[file.height - (size.height - y)] : (file.ground[y] ?? '');
    const kept = row.slice(0, size.width - east) + row.slice(file.width - east, file.width);
    return (kept + TREE.repeat(size.width)).slice(0, size.width);
  });
  return keepOnMap({ ...file, width: size.width, height: size.height, ground });
}
