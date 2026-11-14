/**
 * What a site plan of a map says, read off the game's own map data: every
 * place, building, door, exit and feature on it, named as the game names it,
 * where it stands on the plan. `sitePlan.mts` draws the tiles under it and
 * writes the page; this is the part with no pixels in it, so it is tested.
 *
 * The plan is the map as the game composes it (`world/mapAreas.ts`): the
 * outdoors at the origin and every room, cave and floor laid out east of it.
 * The rooms are moved a few tiles further east than the game lays them, so
 * the plan shows the outdoors and its interiors as two blocks rather than one.
 */
import {
  getWorldMap,
  worldMapName,
  type WorldMapDefinition,
  type WorldMapId,
  TILE_SIZE,
} from '../../src/game/worldMap';
import { districtsForMap, type MapDistrict } from '../../src/game/world/districts';
import {
  extractionPointsOn,
  extractionRequirementText,
} from '../../src/game/world/extractionPoints';
import { rideOnMap, EXIT_VEHICLE_NAMES } from '../../src/game/world/exitVehicles';
import { insertionsOn } from '../../src/game/run/runGeneration';
import { fileMap } from '../../src/game/world/playerMaps';
import { plantedProp, isOutdoorBuilding, type MapFileSpot } from '../../src/game/world/mapFile';
import { createRunTrainerEncounters } from '../../src/game/world/trainers';
import { VALE_QUARTERS, valeGyms } from '../../src/game/world/valeQuarters';
import type { PlacedArea } from '../../src/game/world/mapAreas';
import { buildAreaInfo, type AreaInfo, type PlanSpecies } from './areaInfo';
import { SECRETS } from '../../src/game/world/secrets';
import { hasShimmer, SHIMMER_SHINY_ODDS } from '../../src/game/world/shimmer';
import { hasOmens, OMEN_EVERY } from '../../src/game/world/omens';
import { SHINY_ODDS } from '../../src/game/pokemon/shiny';
import { RAID_DURATION_MS } from '../../src/game/run/raidClock';
import { RUN_GENERATION_BOUNDS } from '../../src/game/run/runGeneration';
import { getSpeciesById } from '../../src/game/pokemon/species';

export interface PlanRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** What a feature is; the legend has a row for each, and the page a layer. */
export type FeatureKind =
  | 'quarter'
  | 'district'
  | 'room'
  | 'building'
  | 'door'
  | 'exit'
  | 'landing'
  | 'gate'
  | 'landmark'
  | 'boss'
  | 'trainer'
  | 'sign'
  | 'berry'
  | 'boat'
  | 'wild';

export interface PlanFeature {
  readonly id: string;
  readonly kind: FeatureKind;
  /** A finer kind the legend draws differently: `center`, `shop`, `gym`, `cave`, `stairs`... */
  readonly sort?: string;
  readonly name: string;
  /** Where it stands on the plan, in tiles. A point feature is one tile. */
  readonly rects: readonly PlanRect[];
  /** Lines said about it on hover: what it is, what opens it, what it leads to. */
  readonly detail: readonly string[];
  /** The places it is in, most particular first, ending with its quarter. */
  readonly places: readonly string[];
  /** Its grid square, or the grid square of the door it is reached by. */
  readonly grid: string;
  /** For a district, how deep it is: 0 is one of the map's big blocks. */
  readonly depth?: number;
  /** The quarter a district or room belongs to, by index into `quarters`, for its colour. */
  readonly quarter?: number;
  /** Where a click on it goes, when that is somewhere else: a door's other side. */
  readonly goto?: PlanRect;
  /** A path drawn for it, as plan points: a boat's crossing. */
  readonly path?: readonly (readonly [number, number])[];
  /** A door that takes you in off the outdoors: the plan badges it and the key names it. */
  readonly enters?: boolean;
  /** The Pokemon a standing one is, for the filter and its picture. */
  readonly species?: string;
}

export interface PlanData {
  readonly mapId: string;
  readonly title: string;
  readonly tileSize: number;
  /** The whole plan, in tiles. */
  readonly width: number;
  readonly height: number;
  /** The outdoors on the plan: the gridded part. */
  readonly outdoors: PlanRect;
  /** The block the rooms stand in, if the map has any. */
  readonly annex?: PlanRect;
  /** Tiles a grid square is across. */
  readonly gridCell: number;
  readonly columns: number;
  readonly rows: number;
  readonly quarters: readonly string[];
  readonly features: readonly PlanFeature[];
  /** What each place - a district or a room, by feature id - holds and does (`areaInfo.ts`). */
  readonly info: Readonly<Record<string, AreaInfo>>;
  /** Every Pokemon the plan names, by id. */
  readonly species: Readonly<Record<string, PlanSpecies>>;
  /** What holds everywhere on the map, for the panel's legend. */
  readonly rules: PlanRules;
}

export interface PlanRules {
  readonly raidMinutes: number;
  readonly shinyOdds: number;
  readonly shimmerShinyOdds: number;
  readonly levelSwing: number;
  readonly omenEvery?: number;
  readonly shimmer: boolean;
}

/** Tiles of paper between the outdoors and the block of rooms. */
export const ANNEX_GAP = 24;

/** The letters a site plan's columns go by: A to Z, then AA, AB... */
export function columnLetter(index: number): string {
  let value = index;
  let letters = '';
  do {
    letters = String.fromCharCode(65 + (value % 26)) + letters;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return letters;
}

/** The grid square a tile of the outdoors is in: `D7`. */
export function gridRef(x: number, y: number, cell: number): string {
  return `${columnLetter(Math.floor(x / cell))}${Math.floor(y / cell) + 1}`;
}

/** A grid square about a dozen across the outdoors, in a power of two so it falls on the map's own blocks. */
export function gridCellFor(width: number): number {
  return Math.max(8, 2 ** Math.round(Math.log2(width / 12)));
}

const STRUCTURES = new Set([
  'house',
  'house-door',
  'house-flowers',
  'cottage',
  'cottage-door',
  'pokemon-center',
  'pokemon-center-door',
  'poke-mart',
  'poke-mart-door',
  'gym',
  'forest-gate',
  'route-gate',
  'league-gate',
  'cave-mouth',
  'shop',
  'market-stall',
  'striped-stall',
  'grey-house',
  'orange-house',
  'shed',
  'warden-house',
  'jetty',
  'flower-house',
  'purple-house',
  'blue-house',
  'hut',
  'stone-fountain',
  'round-fountain',
  'fountain',
  'shrine',
  'fuchsia-gym',
  'cerulean-gym',
  'timber-house',
  'roundhouse',
  'ferry',
  'tower',
  'blue-cottage',
  'power-plant',
  'brick-shops',
  'safari-gate',
  'green-cottage',
  'ss-anne',
  'green-house',
  'small-flats',
  'pokemon-mansion',
  'pokemon-tower',
  'town-map',
  'notice-board',
  'strange-stone',
  'grave-statue',
  'gym-statue',
  'lapras-doll',
  'rock-stair',
]);

/** What a building with no name of its own is called on the plan, where its file word would read oddly. */
const STRUCTURE_NAMES: Record<string, string> = {
  'house-door': 'House',
  'house-flowers': 'House',
  'flower-house': 'House',
  'timber-house': 'House',
  'grey-house': 'House',
  'orange-house': 'House',
  'purple-house': 'House',
  'blue-house': 'House',
  'green-house': 'House',
  'cottage-door': 'Cottage',
  'blue-cottage': 'Cottage',
  'green-cottage': 'Cottage',
  'striped-stall': 'Market stall',
  'round-fountain': 'Fountain',
  'stone-fountain': 'Fountain',
  'strange-stone': 'Standing stone',
  'grave-statue': 'Statue',
  'rock-stair': 'Rock steps',
  'ss-anne': 'Ship',
  'small-flats': 'Flats',
  'brick-shops': 'Row of shops',
  'pokemon-mansion': 'Burnt mansion',
  'pokemon-tower': 'Tower',
  tower: 'Stone tower',
  'cave-mouth': 'Cave mouth',
  'power-plant': 'Power plant',
};

/** A file's word for a thing, as a reader would say it: `warden-house` is a Warden house. */
export function humanise(word: string): string {
  const text = word.replace(/-/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A name as a sign says it, in capitals, said as a plan says it. */
export function titleCase(name: string): string {
  if (name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .replace(
      /(^|[\s(\-/])([\p{L}])/gu,
      (_, before: string, letter: string) => before + letter.toUpperCase(),
    )
    .replace(/\b(Of|And|The|To|In|On|At|By)\b/g, (word, _w, offset: number) =>
      offset === 0 ? word : word.toLowerCase(),
    )
    .replace(/\bB(\d)f\b/g, 'B$1F')
    .replace(/\b(\d)f\b/g, '$1F')
    .replace(/’S\b/g, '’s')
    .replace(/'S\b/g, "'s");
}

function areaOfRoom(style: string | undefined, name: string, kind: string): string {
  if (style === 'center') return 'center';
  if (style === 'mart' || /\b(shop|mart|store)\b/i.test(name)) return 'shop';
  if (/\bgym\b/i.test(name)) return 'gym';
  if (kind === 'cave' || style === 'cave' || style === 'ice' || style === 'ember') return 'cave';
  if (/\b(inn|duck|ponyta|canteen|kitchen)\b/i.test(name)) return 'inn';
  return 'room';
}

/** What is worth saying about a kind of room beyond its name. */
const ROOM_WORDS: Record<string, string> = {
  gym: 'A gym leader holds a quarter from here.',
};

const inside = (
  rect: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
) => x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
const touches = (a: PlanRect, b: PlanRect, margin = 0) =>
  a.x - margin < b.x + b.w &&
  b.x - margin < a.x + a.w &&
  a.y - margin < b.y + b.h &&
  b.y - margin < a.y + a.h;

/** Everything a site plan of a map says. */
export function buildPlanData(mapId: WorldMapId): PlanData {
  const map = getWorldMap(mapId);
  const file = fileMap(mapId)?.file;
  const areas: readonly PlacedArea[] = map.areas ?? [
    {
      id: undefined,
      name: worldMapName(mapId),
      kind: 'outdoors',
      rect: { x: 0, y: 0, width: map.width, height: map.height },
    },
  ];
  const outdoorsRect = areas[0].rect;
  const outdoors: PlanRect = { x: 0, y: 0, w: outdoorsRect.width, h: outdoorsRect.height };
  const shift = (x: number) => (x >= outdoorsRect.width ? x + ANNEX_GAP : x);
  const toPlan = (x: number, y: number, w = 1, h = 1): PlanRect => ({ x: shift(x), y, w, h });
  const rooms = areas.slice(1);
  const annex =
    rooms.length > 0
      ? (() => {
          const left = Math.min(...rooms.map((room) => room.rect.x));
          const right = Math.max(...rooms.map((room) => room.rect.x + room.rect.width));
          const top = Math.min(...rooms.map((room) => room.rect.y));
          const bottom = Math.max(...rooms.map((room) => room.rect.y + room.rect.height));
          return { x: shift(left), y: top, w: right - left, h: bottom - top };
        })()
      : undefined;
  const cell = gridCellFor(outdoors.w);
  const columns = Math.ceil(outdoors.w / cell);
  const rows = Math.ceil(outdoors.h / cell);

  const roomAt = (x: number, y: number) => rooms.find((room) => inside(room.rect, x, y));
  const areaOffset = (spot: MapFileSpot) => {
    if (!spot.area) return { x: 0, y: 0 };
    const placed = areas.find((candidate) => candidate.id === spot.area);
    return placed ? { x: placed.rect.x, y: placed.rect.y } : { x: 0, y: 0 };
  };

  // How each room is reached from the outdoors: the outdoor end of the first
  // chain of doors into it, found by walking the doors outward from the outdoors.
  const entryOf = new Map<string | undefined, { x: number; y: number }>();
  {
    const queue: { id: string | undefined; door: { x: number; y: number } }[] = [];
    for (const warp of map.warps) {
      if (roomAt(warp.source.x, warp.source.y)) continue;
      const room = roomAt(warp.destination.x, warp.destination.y);
      if (room && !entryOf.has(room.id)) {
        entryOf.set(room.id, warp.source);
        queue.push({ id: room.id, door: warp.source });
      }
    }
    while (queue.length > 0) {
      const { id, door } = queue.shift()!;
      const onwards = [
        ...map.warps.map((warp) => ({ from: warp.source, to: warp.destination })),
        // A lift's floors are joined to each other, both ways.
        ...(map.lifts ?? []).flatMap((lift) =>
          lift.stops.flatMap((stop) =>
            lift.stops.map((other) => ({ from: stop.landing, to: other.landing })),
          ),
        ),
      ];
      for (const way of onwards) {
        const from = roomAt(way.from.x, way.from.y);
        if (!from || from.id !== id) continue;
        const to = roomAt(way.to.x, way.to.y);
        if (to && !entryOf.has(to.id)) {
          entryOf.set(to.id, door);
          queue.push({ id: to.id, door });
        }
      }
    }
  }

  // Places, most particular first.
  const districts = districtsForMap(mapId);
  const quarterNames =
    mapId === 'greystone-vale' ? VALE_QUARTERS.map((quarter) => titleCase(quarter.name)) : [];
  const quarterOfDistrict = new Map<string, number>();
  if (mapId === 'greystone-vale') {
    VALE_QUARTERS.forEach((quarter, index) => {
      for (const name of quarter.districts) quarterOfDistrict.set(name, index);
    });
  }
  const districtArea = (district: MapDistrict) =>
    district.areas.reduce((sum, rect) => sum + rect.width * rect.height, 0);
  const placesAt = (x: number, y: number): string[] => {
    const room = roomAt(x, y);
    const containing = districts
      .filter((district) => district.areas.some((rect) => inside(rect, x, y)))
      .sort((a, b) => districtArea(a) - districtArea(b));
    const names = containing.map((district) => titleCase(district.name));
    if (room) {
      const door = entryOf.get(room.id);
      if (door) names.push(...placesAt(door.x, door.y));
    } else {
      const top = containing[containing.length - 1];
      const quarter = top ? quarterOfDistrict.get(top.name) : undefined;
      if (quarter !== undefined) names.push(quarterNames[quarter]);
    }
    return [...new Set(names)];
  };
  const gridAt = (x: number, y: number): string => {
    const room = roomAt(x, y);
    if (!room) return gridRef(x, y, cell);
    const door = entryOf.get(room.id);
    return door ? `Inside, door at ${gridRef(door.x, door.y, cell)}` : 'Inside';
  };
  const quarterAt = (x: number, y: number): number | undefined => {
    const room = roomAt(x, y);
    const door = room ? entryOf.get(room.id) : { x, y };
    if (!door) return undefined;
    const containing = districts
      .filter((district) => district.areas.some((rect) => inside(rect, door.x, door.y)))
      .sort((a, b) => districtArea(b) - districtArea(a));
    return containing[0] ? quarterOfDistrict.get(containing[0].name) : undefined;
  };

  const features: PlanFeature[] = [];
  const point = (
    id: string,
    kind: FeatureKind,
    name: string,
    x: number,
    y: number,
    detail: readonly string[],
    extra: Partial<PlanFeature> = {},
  ) => {
    features.push({
      id,
      kind,
      name,
      rects: [toPlan(x, y)],
      detail,
      places: placesAt(x, y),
      grid: gridAt(x, y),
      ...extra,
    });
  };

  // Districts, with how deep each one sits inside the others.
  const outdoorDistricts = districts.filter((district) => !district.id.includes('/inside-'));
  const contains = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x <= b.x && a.y <= b.y && a.x + a.width >= b.x + b.width && a.y + a.height >= b.y + b.height;
  for (const district of outdoorDistricts) {
    const first = district.areas[0];
    if (!first || roomAt(first.x, first.y)) continue;
    const depth = outdoorDistricts.filter(
      (other) =>
        other !== district &&
        districtArea(other) > districtArea(district) &&
        other.areas.some((rect) => contains(rect, first)),
    ).length;
    // What it is in: the bigger places round it, then its quarter - never the smaller ones inside it.
    const around = outdoorDistricts
      .filter(
        (other) =>
          other !== district &&
          districtArea(other) > districtArea(district) &&
          other.areas.some((rect) => contains(rect, first)),
      )
      .sort((a, b) => districtArea(a) - districtArea(b));
    const top = around[around.length - 1] ?? district;
    const quarter = quarterOfDistrict.get(top.name);
    const parents = [
      ...around.map((other) => titleCase(other.name)),
      ...(quarter !== undefined ? [quarterNames[quarter]] : []),
    ];
    features.push({
      id: district.id,
      kind: 'district',
      name: titleCase(district.name),
      rects: district.areas.map((rect) => toPlan(rect.x, rect.y, rect.width, rect.height)),
      detail: [],
      places: parents,
      grid: gridRef(first.x + first.width / 2, first.y + first.height / 2, cell),
      depth,
      quarter: quarterAt(first.x, first.y),
    });
  }

  // Quarters: each the blocks of the districts it lists.
  VALE_QUARTERS.forEach((quarter, index) => {
    if (mapId !== 'greystone-vale') return;
    const rects = quarter.districts.flatMap((name) =>
      (districts.find((district) => district.name === name)?.areas ?? []).map((rect) =>
        toPlan(rect.x, rect.y, rect.width, rect.height),
      ),
    );
    if (rects.length === 0) return;
    features.push({
      id: `quarter-${quarter.id}`,
      kind: 'quarter',
      name: titleCase(quarter.name),
      rects,
      detail: quarter.gym
        ? [
            `Held by ${quarter.gym.leader} of ${quarter.gym.building}. Win there for the ${titleCase(quarter.gym.badge)}.`,
            ...quarter.threat,
          ]
        : ['The open vale: no gym holds it.'],
      places: [],
      grid: '',
      quarter: index,
    });
  });

  // Rooms, caves and floors.
  for (const room of rooms) {
    const sort = areaOfRoom(room.style, room.name, room.kind);
    const door = entryOf.get(room.id);
    features.push({
      id: `room-${room.id}`,
      kind: 'room',
      sort,
      name: room.name,
      rects: [toPlan(room.rect.x, room.rect.y, room.rect.width, room.rect.height)],
      detail: ROOM_WORDS[sort] ? [ROOM_WORDS[sort]] : [],
      places: door ? placesAt(door.x, door.y) : [],
      grid: gridAt(room.rect.x, room.rect.y),
      quarter: quarterAt(room.rect.x, room.rect.y),
      goto: door ? toPlan(door.x - 4, door.y - 4, 9, 9) : undefined,
    });
  }

  // Buildings: what stands outdoors big enough to find, named by the room
  // behind its door or the landmark at it.
  const doorsOut = map.warps.filter(
    (warp) => !roomAt(warp.source.x, warp.source.y) && !warp.secondary,
  );
  const landmarks = (file?.landmarks ?? []).filter((landmark) => !landmark.area);
  for (const [index, building] of (file?.buildings ?? []).entries()) {
    if (building.area || !isOutdoorBuilding(building.kind) || !STRUCTURES.has(building.kind))
      continue;
    const prop = plantedProp(building.kind);
    const rect = toPlan(building.x, building.y, prop.width, prop.height);
    const door = doorsOut.find((warp) => {
      const art = warp.art ?? { x: warp.source.x, y: warp.source.y - 1, width: 1, height: 1 };
      return touches(rect, toPlan(art.x, art.y, art.width, art.height));
    });
    const room = door ? roomAt(door.destination.x, door.destination.y) : undefined;
    const landmark = landmarks.find((candidate) =>
      touches(rect, toPlan(candidate.x, candidate.y), 1),
    );
    const sort = room
      ? areaOfRoom(room.style, room.name, room.kind)
      : building.kind.includes('stall')
        ? 'stall'
        : 'structure';
    const name =
      room?.name ?? landmark?.name ?? STRUCTURE_NAMES[building.kind] ?? humanise(building.kind);
    features.push({
      id: `building-${index}`,
      kind: 'building',
      sort,
      name,
      rects: [rect],
      detail: room
        ? [...(ROOM_WORDS[sort] ? [ROOM_WORDS[sort]] : []), `Door leads in to ${room.name}.`]
        : landmark
          ? [humanise(building.kind)]
          : [],
      places: placesAt(building.x, building.y + prop.height - 1),
      grid: gridRef(building.x, building.y + prop.height - 1, cell),
      quarter: quarterAt(building.x, building.y),
      goto: room ? toPlan(room.rect.x, room.rect.y, room.rect.width, room.rect.height) : undefined,
    });
  }

  // Doors: every way between two places, at the tile it is used from.
  for (const [index, warp] of map.warps.entries()) {
    if (warp.secondary) continue;
    const from = roomAt(warp.source.x, warp.source.y);
    const to = roomAt(warp.destination.x, warp.destination.y);
    const toName = to?.name ?? areas[0].name;
    const art = warp.art ?? { x: warp.source.x, y: warp.source.y, width: 1, height: 1 };
    const sort =
      !from && to && (to.kind === 'cave' || to.style === 'cave')
        ? 'cave'
        : from && to
          ? 'stairs'
          : 'door';
    features.push({
      id: `door-${index}`,
      kind: 'door',
      sort,
      name: from ? `Way to ${toName}` : `Door to ${toName}`,
      rects: [toPlan(art.x, art.y, art.width, art.height)],
      detail: [from ? `From ${from.name} to ${toName}.` : `Leads in to ${toName}.`],
      places: placesAt(warp.source.x, warp.source.y),
      grid: gridAt(warp.source.x, warp.source.y),
      // In off the outdoors, the whole room is what a click goes to see.
      goto:
        !from && to
          ? toPlan(to.rect.x, to.rect.y, to.rect.width, to.rect.height)
          : toPlan(warp.destination.x - 4, warp.destination.y - 4, 9, 9),
      ...(!from && to ? { enters: true } : {}),
    });
  }

  // Ways out.
  for (const [index, exit] of extractionPointsOn(mapId).entries()) {
    const ride = rideOnMap(map, exit.position);
    const requirement = exit.requirement ?? { kind: 'elapsed', unlockAtMs: exit.unlockAtMs };
    const opens =
      requirement.kind === 'always' ||
      (requirement.kind === 'elapsed' && requirement.unlockAtMs <= 0)
        ? 'Open from the start of a raid.'
        : requirement.kind === 'elapsed'
          ? `Opens ${Math.round(requirement.unlockAtMs / 1000)} seconds into a raid.`
          : requirement.kind === 'poi-activated'
            ? `Shut until ${titleCase(requirement.poiLabel)} is worked.`
            : requirement.kind === 'dug'
              ? 'Behind rubble: dig it out with a Pickaxe.'
              : `Locked: ${titleCase(extractionRequirementText(exit, 0)).replace(/^Needs/, 'needs')}.`;
    point(
      `exit-${index}`,
      'exit',
      titleCase(exit.label),
      exit.position.x,
      exit.position.y,
      [`Way out, by ${EXIT_VEHICLE_NAMES[ride.vehicle].toLowerCase()}.`, opens],
      { sort: ride.vehicle },
    );
  }

  // Ways in.
  for (const insertion of insertionsOn(mapId)) {
    point(
      `landing-${insertion.id}`,
      'landing',
      insertion.label,
      insertion.position.x,
      insertion.position.y,
      [
        'Landing: a raid can start here.',
        ...(insertion.description ? [insertion.description] : []),
      ],
    );
  }

  // Doors that are shut until something opens them.
  for (const gate of map.gates) {
    const tiles = gate.tiles;
    const left = Math.min(...tiles.map((tile) => tile.x));
    const top = Math.min(...tiles.map((tile) => tile.y));
    const right = Math.max(...tiles.map((tile) => tile.x)) + 1;
    const bottom = Math.max(...tiles.map((tile) => tile.y)) + 1;
    const why =
      'bossId' in gate && gate.bossId
        ? `Barred until ${keeperName(gate.bossId)} is beaten.`
        : 'fieldMove' in gate && gate.fieldMove
          ? `Needs ${gate.fieldMove.toUpperCase()} to get through.`
          : 'Open only at night.';
    features.push({
      id: gate.id,
      kind: 'gate',
      sort:
        'bossId' in gate && gate.bossId
          ? 'boss'
          : 'fieldMove' in gate && gate.fieldMove
            ? gate.fieldMove
            : 'night',
      name: titleCase(gate.label),
      rects: [toPlan(left, top, right - left, bottom - top)],
      detail: [why],
      places: placesAt(left, top),
      grid: gridAt(left, top),
    });
  }

  // Landmarks: what can be searched, worked or opened.
  for (const poi of map.pois) {
    point(
      poi.id,
      'landmark',
      titleCase(poi.label),
      poi.position.x,
      poi.position.y,
      [
        poi.description,
        ...(poi.locked ? ['Locked: open it with a Lockpick.'] : []),
        ...(poi.effect === 'unlock-extraction' && poi.unlockedExtractionLabel
          ? [`Working it opens ${titleCase(poi.unlockedExtractionLabel)}.`]
          : []),
      ],
      { sort: poi.locked ? 'locked' : undefined },
    );
  }

  // Bosses: gym leaders and keepers, who stand where they stand.
  const bosses = createRunTrainerEncounters().filter(
    (encounter) => encounter.mapId === mapId && encounter.bossId,
  );
  for (const boss of bosses) {
    const holds = map.gates
      .filter((gate) => 'bossId' in gate && gate.bossId === boss.bossId)
      .map((gate) => titleCase(gate.label));
    const gym = valeGyms().find((candidate) => candidate.bossId === boss.bossId);
    point(
      `boss-${boss.trainer.id}`,
      'boss',
      titleCase(boss.trainer.name),
      boss.position.x,
      boss.position.y,
      [
        gym
          ? `Gym leader of ${gym.building}: the ${titleCase(gym.badge)}.`
          : 'Keeper: a boss who holds the way on.',
        ...(holds.length ? [`Holds ${holds.join(' and ')}.`] : []),
      ],
    );
  }
  const bossTiles = new Set(bosses.map((boss) => `${boss.position.x},${boss.position.y}`));

  // Trainers who stand their ground: the map's own, and those the game stands on it.
  const trainerTiles = new Set(bossTiles);
  for (const [index, trainer] of (file?.trainers ?? []).entries()) {
    const offset = areaOffset(trainer);
    const x = trainer.x + offset.x;
    const y = trainer.y + offset.y;
    if (trainerTiles.has(`${x},${y}`)) continue;
    trainerTiles.add(`${x},${y}`);
    point(`trainer-${index}`, 'trainer', trainer.name, x, y, [
      'Trainer: walk into their sight and they fight.',
      ...trainer.lines.slice(0, 1),
    ]);
  }
  for (const encounter of createRunTrainerEncounters()) {
    const { x, y } = encounter.position;
    if (encounter.mapId !== mapId || encounter.bossId || trainerTiles.has(`${x},${y}`)) continue;
    trainerTiles.add(`${x},${y}`);
    point(`trainer-${encounter.trainer.id}`, 'trainer', titleCase(encounter.trainer.name), x, y, [
      'Trainer: walk into their sight and they fight.',
      ...encounter.introLines.slice(0, 1),
    ]);
  }

  // Signs, as they read.
  for (const entity of map.entities) {
    if (entity.kind !== 'sign') continue;
    const [first = 'Sign', ...rest] = entity.dialogLines;
    point(
      entity.id,
      'sign',
      first.length <= 40 ? titleCase(first) : 'Sign',
      entity.position.x,
      entity.position.y,
      first.length <= 40 ? rest : [...entity.dialogLines],
    );
  }

  // Berry trees.
  for (const [index, tree] of (file?.berryTrees ?? []).entries()) {
    const offset = areaOffset(tree);
    point(
      `berry-${index}`,
      'berry',
      `${humanise(tree.berry)} Berry tree`,
      tree.x + offset.x,
      tree.y + offset.y,
      ['Berries to pick, once a raid.'],
    );
  }

  // Boats, with the water they cross.
  for (const [index, sailing] of (map.sailings ?? []).entries()) {
    for (const [end, landing] of sailing.ends.entries()) {
      const other = sailing.ends[1 - end];
      point(
        `boat-${index}-${end}`,
        'boat',
        sailing.name,
        landing.landing.x,
        landing.landing.y,
        [
          // No craft is the ferry (`MapSailing.craft`).
          `A ${sailing.craft ?? 'ferry'} across the water.`,
          ...(sailing.runsFromMs > 0
            ? [`Sails from ${Math.round(sailing.runsFromMs / 1000)} seconds into a raid.`]
            : []),
          ...(sailing.runsUntilMs < Number.MAX_SAFE_INTEGER
            ? [`Runs for the first ${Math.round(sailing.runsUntilMs / 60000)} minutes of a raid.`]
            : []),
        ],
        {
          path: sailing.course.map(({ x, y }) => [shift(x) + 0.5, y + 0.5] as const),
          goto: other ? toPlan(other.landing.x - 4, other.landing.y - 4, 9, 9) : undefined,
        },
      );
    }
  }

  // Lifts: one marker a floor.
  for (const lift of map.lifts ?? []) {
    for (const stop of lift.stops) {
      point(
        `lift-${lift.id}-${stop.area}`,
        'boat',
        `Lift: ${stop.name}`,
        stop.landing.x,
        stop.landing.y,
        [
          `Rides to ${lift.stops
            .filter((other) => other !== stop)
            .map((other) => other.name)
            .join(', ')}.`,
        ],
        { sort: 'lift' },
      );
    }
  }

  // Pokemon that stand their ground and fight when spoken to.
  for (const [index, figure] of (file?.pokemon ?? []).entries()) {
    if (figure.level === undefined) continue;
    const offset = areaOffset(figure);
    const secret = figure.secret ? SECRETS.find((each) => each.id === figure.secret) : undefined;
    const name = getSpeciesById(figure.species)?.name ?? humanise(figure.species);
    point(
      `wild-${index}`,
      'wild',
      name,
      figure.x + offset.x,
      figure.y + offset.y,
      [
        figure.legendary
          ? `A legend at Lv ${figure.level}: no ball until it is beaten, then one throw.`
          : `Stands here at Lv ${figure.level}: speak to it to fight or catch it, once a raid.`,
        ...(secret
          ? [`Part of the secret ${titleCase(secret.name)}: see the place's panel for when.`]
          : []),
      ],
      {
        species: figure.species,
        sort: figure.legendary ? 'legend' : secret ? 'secret' : undefined,
      },
    );
  }

  // What every place holds, read off the same rules a raid reads.
  const targets = [
    ...features
      .filter((feature) => feature.kind === 'district')
      .map((feature) => {
        const district = districts.find((candidate) => candidate.id === feature.id)!;
        return { id: feature.id, name: district.name, rects: district.areas };
      }),
    ...rooms.map((room) => ({
      id: `room-${room.id}`,
      name: room.name,
      rects: [room.rect],
      // The places drawn inside it: THE DIGGINGS is a room of the caves.
      alsoNames: districts
        .filter(
          (district) =>
            district.areas[0] && inside(room.rect, district.areas[0].x, district.areas[0].y),
        )
        .map((district) => district.name),
    })),
  ];
  const { info, species } = buildAreaInfo(mapId, map, file, areas, targets, titleCase);
  for (const feature of features)
    if (feature.species && !species[feature.species]) {
      const base = getSpeciesById(feature.species);
      if (base)
        (species as Record<string, PlanSpecies>)[feature.species] = {
          name: base.name,
          dex: base.dexId,
          types: [base.primaryType, ...(base.secondaryType ? [base.secondaryType] : [])],
        };
    }

  return {
    mapId,
    title: worldMapName(mapId),
    tileSize: TILE_SIZE,
    width: annex ? annex.x + annex.w + 1 : outdoors.w,
    height: Math.max(outdoors.h, annex ? annex.y + annex.h : 0),
    outdoors,
    annex,
    gridCell: cell,
    columns,
    rows,
    quarters: quarterNames,
    features,
    info,
    species,
    rules: {
      raidMinutes: RAID_DURATION_MS / 60000,
      shinyOdds: SHINY_ODDS,
      shimmerShinyOdds: SHIMMER_SHINY_ODDS,
      levelSwing: RUN_GENERATION_BOUNDS.encounterLevelVariance,
      ...(hasOmens(mapId) ? { omenEvery: OMEN_EVERY } : {}),
      shimmer: hasShimmer(mapId),
    },
  };
}

function keeperName(bossId: string): string {
  const boss = createRunTrainerEncounters().find((encounter) => encounter.bossId === bossId);
  return boss ? titleCase(boss.trainer.name) : 'its keeper';
}

/** The map's composed grid, for the picture: the same definition the plan was read from. */
export function planSource(mapId: WorldMapId): WorldMapDefinition {
  return getWorldMap(mapId);
}
