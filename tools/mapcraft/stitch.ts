/**
 * The districts of a world plan, put together into one map file.
 *
 * Districts are drawn one at a time (`startDistrict`), each in its own tiles,
 * and stitched here into the map the game loads. A district that is not drawn
 * yet is wood, so a map is playable while it is incomplete and an unbuilt
 * region is simply forest beyond the road. Every seam a crossing joins is
 * checked: open on both sides, and walkable (or, for a river, water) across.
 *
 * A district file can be played on its own (`districtFile` gives it a way out
 * at every opening, for TRY IT); those stand-in ways out are dropped here, and
 * the plan's own ways out are placed on the map's rim.
 */
import {
  MAP_FILE_FORMAT,
  MAP_FILE_LIMITS,
  type MapFile,
  type MapFileDistrict,
  type MapFileDropIn,
  type MapFileExit,
  type MapFileItemSpot,
  type MapFileLink,
  type MapFileSpot,
} from '../../src/game/world/mapFile';
import type { MapProgram } from './program';
import { readTiles, walkable, walkingSteps, type TileRect } from './tiles';
import {
  checkPlan,
  districtOf,
  districtRect,
  exitTile,
  openingsOf,
  openingTiles,
  planBounds,
  SEAM_DEPTH,
  type Opening,
  type WorldPlan,
} from './worldPlan';

/**
 * A district's map file, playable on its own: its program compiled, with a way
 * out at every one of its openings (each named for where it leads) so TRY IT
 * can walk it before its neighbours exist.
 */
export function districtFile(
  plan: WorldPlan,
  id: string,
  program: MapProgram,
  details: {
    readonly dropIns: readonly MapFileDropIn[];
    readonly itemSpots?: readonly MapFileItemSpot[];
    readonly extra?: Partial<MapFile>;
  },
): MapFile {
  const district = districtOf(plan, id);
  // A river is nobody's way out: its opening is water.
  const exits: MapFileExit[] = uniqueNames(
    openingsOf(plan, id)
      .filter((opening) => opening.kind !== 'river')
      .map((opening) => {
        const [x, y] = exitTile(plan.districtSize, opening);
        const name =
          'exit' in opening.leadsTo
            ? opening.leadsTo.exit
            : `To ${districtOf(plan, opening.leadsTo.district).name}`;
        return { x, y, name, opens: { when: 'always' } };
      }),
  );
  return program.toFile({
    id: `${plan.id}-${id}`.slice(0, 40),
    name: district.name.slice(0, MAP_FILE_LIMITS.maxNameLength),
    maker: plan.maker,
    dropIns: details.dropIns,
    exits,
    itemSpots: details.itemSpots,
    wildlife: district.wildlife ?? plan.wildlife,
    extra: details.extra,
  });
}

/** The tile on the very edge of an opening, near its middle, where a way out stands. */
/**
 * When a way out into an undrawn district opens: a while into the raid, so a
 * map has a way out open from the first second (its own) and others that open
 * later, as every shipped map does.
 */
export const WAITING_EXIT_OPENS = { when: 'after', seconds: 90 } as const;

export type SeamStatus = 'joined' | 'broken' | 'waiting';

export interface SeamReport {
  readonly between: readonly [string, string];
  readonly kind: string;
  readonly status: SeamStatus;
  readonly detail: string;
}

export interface StitchResult {
  readonly file: MapFile;
  readonly seams: readonly SeamReport[];
  /** What is wrong with the plan, a district, or the stitched file's limits; empty when nothing is. */
  readonly problems: readonly string[];
}

export function stitch(plan: WorldPlan, built: Readonly<Record<string, MapFile>>): StitchResult {
  const problems = checkPlan(plan);
  const size = plan.districtSize;
  const bounds = planBounds(plan);
  const width = bounds.columns * size;
  const height = bounds.rows * size;
  const ground = Array.from({ length: height }, () => Array<string>(width).fill('T'));
  const merged = {
    buildings: [] as MapFile['buildings'][number][],
    dropIns: [] as MapFileDropIn[],
    exits: [] as MapFileExit[],
    itemSpots: [] as MapFileItemSpot[],
    people: [] as NonNullable<MapFile['people']>[number][],
    signs: [] as NonNullable<MapFile['signs']>[number][],
    landmarks: [] as NonNullable<MapFile['landmarks']>[number][],
    districts: [] as MapFileDistrict[],
    trainers: [] as NonNullable<MapFile['trainers']>[number][],
    doors: [] as NonNullable<MapFile['doors']>[number][],
    pokemon: [] as NonNullable<MapFile['pokemon']>[number][],
    areas: [] as NonNullable<MapFile['areas']>[number][],
    links: [] as MapFileLink[],
    berryTrees: [] as NonNullable<MapFile['berryTrees']>[number][],
    boulders: [] as NonNullable<MapFile['boulders']>[number][],
  };
  for (const district of plan.districts) {
    const file = built[district.id];
    if (!file) continue;
    if (file.width !== size || file.height !== size) {
      problems.push(
        `${district.id} is ${file.width}x${file.height}; every district is ${size}x${size}.`,
      );
      continue;
    }
    const rect = districtRect(plan, district.id);
    file.ground.forEach((row, y) =>
      [...row].forEach((letter, x) => (ground[rect.y + y][rect.x + x] = letter)),
    );
    const move = <T extends MapFileSpot>(spot: T): T =>
      spot.area === undefined ? { ...spot, x: spot.x + rect.x, y: spot.y + rect.y } : spot;
    const standIns = new Set(
      openingsOf(plan, district.id).flatMap((opening) =>
        openingTiles(size, opening).map(([x, y]) => `${x},${y}`),
      ),
    );
    merged.buildings.push(...file.buildings.map(move));
    merged.dropIns.push(...file.dropIns.map(move));
    merged.exits.push(
      ...file.exits
        .filter((exit) => exit.area !== undefined || !standIns.has(`${exit.x},${exit.y}`))
        .map(move),
    );
    merged.itemSpots.push(...file.itemSpots.map(move));
    merged.people.push(...(file.people ?? []).map(move));
    merged.signs.push(...(file.signs ?? []).map(move));
    merged.landmarks.push(...(file.landmarks ?? []).map(move));
    merged.trainers.push(...(file.trainers ?? []).map(move));
    merged.doors.push(
      ...(file.doors ?? []).map((door) => ({ ...door, x: door.x + rect.x, y: door.y + rect.y })),
    );
    merged.pokemon.push(...(file.pokemon ?? []).map(move));
    merged.berryTrees.push(...(file.berryTrees ?? []).map(move));
    merged.boulders.push(...(file.boulders ?? []).map(move));
    merged.districts.push(
      ...(file.districts ?? []).map((place) =>
        place.area === undefined ? { ...place, x: place.x + rect.x, y: place.y + rect.y } : place,
      ),
      {
        name: district.name,
        x: rect.x,
        y: rect.y,
        width: size,
        height: size,
        ...(district.wildlife ? { wildlife: district.wildlife } : {}),
      },
    );
    for (const area of file.areas ?? []) {
      if (merged.areas.some((other) => other.id === area.id))
        problems.push(`Two districts have a place called '${area.id}'.`);
      merged.areas.push(area);
    }
    merged.links.push(
      ...(file.links ?? []).map((link) => ({
        ends: [move(link.ends[0]), move(link.ends[1])] as const,
      })),
    );
  }
  // A road into a district not drawn yet is a way out until that district is
  // drawn, so no part of an unfinished map is a dead end a raid cannot leave.
  for (const crossing of plan.crossings) {
    const [drawn, waiting] = crossing.between.map((id) => Boolean(built[id]));
    if (drawn === waiting || crossing.kind === 'river') continue;
    const from = drawn ? crossing.between[0] : crossing.between[1];
    const to = drawn ? crossing.between[1] : crossing.between[0];
    const opening = openingsOf(plan, from).find(
      (candidate) =>
        'district' in candidate.leadsTo &&
        candidate.leadsTo.district === to &&
        candidate.at === crossing.at,
    );
    if (!opening) continue;
    const rect = districtRect(plan, from);
    const [x, y] = exitTile(size, opening);
    const name = `To ${districtOf(plan, to).name}`.slice(0, MAP_FILE_LIMITS.maxPlaceNameLength);
    merged.exits.push({ x: rect.x + x, y: rect.y + y, name, opens: WAITING_EXIT_OPENS });
  }
  for (const exit of plan.exits) {
    if (!built[exit.district]) continue;
    const rect = districtRect(plan, exit.district);
    const opening = openingsOf(plan, exit.district).find(
      (candidate) => 'exit' in candidate.leadsTo && candidate.leadsTo.exit === exit.name,
    );
    if (!opening) continue;
    const [x, y] = exitTile(size, opening);
    merged.exits.push({ x: rect.x + x, y: rect.y + y, name: exit.name, opens: { when: 'always' } });
  }
  merged.exits = uniqueNames(merged.exits);
  const file: MapFile = {
    format: MAP_FILE_FORMAT,
    id: plan.id,
    name: plan.name,
    maker: plan.maker ?? 'mapcraft',
    width,
    height,
    ground: ground.map((row) => row.join('')),
    ...merged,
    wildlife: plan.wildlife ?? 'meadow',
  };
  problems.push(...limitProblems(file));
  const seams = seamReports(plan, built, file);
  problems.push(...seams.filter((seam) => seam.status === 'broken').map((seam) => seam.detail));
  problems.push(...leaks(plan, built));
  return { file, seams, problems };
}

/**
 * Exits with every name its own, within a map file's name length: a second
 * road into the same district is "To TANGLEWOOD 2", because a map file names
 * each way out once.
 */
function uniqueNames(exits: readonly MapFileExit[]): MapFileExit[] {
  const limit = MAP_FILE_LIMITS.maxPlaceNameLength;
  const seen = new Map<string, number>();
  return exits.map((exit) => {
    const base = exit.name.slice(0, limit);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? { ...exit, name: base } : { ...exit, name: `${base.slice(0, limit - 2)} ${count}` };
  });
}

function limitProblems(file: MapFile): string[] {
  const limits: [string, number, number][] = [
    ['drop-ins', file.dropIns.length, MAP_FILE_LIMITS.maxDropIns],
    ['ways out', file.exits.length, MAP_FILE_LIMITS.maxExits],
    ['item spots', file.itemSpots.length, MAP_FILE_LIMITS.maxItemSpots],
    ['people', file.people?.length ?? 0, MAP_FILE_LIMITS.maxPeople],
    ['signs', file.signs?.length ?? 0, MAP_FILE_LIMITS.maxSigns],
    ['landmarks', file.landmarks?.length ?? 0, MAP_FILE_LIMITS.maxLandmarks],
    ['named places', file.districts?.length ?? 0, MAP_FILE_LIMITS.maxDistricts],
    ['trainers', file.trainers?.length ?? 0, MAP_FILE_LIMITS.maxTrainers],
    ['doors', file.doors?.length ?? 0, MAP_FILE_LIMITS.maxDoors],
    ['Pokemon', file.pokemon?.length ?? 0, MAP_FILE_LIMITS.maxPokemon],
    ['berry trees', file.berryTrees?.length ?? 0, MAP_FILE_LIMITS.maxBerryTrees],
    ['boulders', file.boulders?.length ?? 0, MAP_FILE_LIMITS.maxBoulders],
    ['insides and caves', file.areas?.length ?? 0, MAP_FILE_LIMITS.maxAreas],
    ['ways between places', file.links?.length ?? 0, MAP_FILE_LIMITS.maxLinks],
  ];
  const problems = limits
    .filter(([, count, limit]) => count > limit)
    .map(([what, count, limit]) => `The map has ${count} ${what}; a map file holds ${limit}.`);
  const bytes = JSON.stringify(file).length;
  if (bytes > MAP_FILE_LIMITS.maxBytes)
    problems.push(`The map is ${bytes} bytes; a map file is ${MAP_FILE_LIMITS.maxBytes} at most.`);
  return problems;
}

/** Each crossing: joined when both sides are drawn and the way goes through; waiting when one side is not drawn yet. */
function seamReports(
  plan: WorldPlan,
  built: Readonly<Record<string, MapFile>>,
  file: MapFile,
): SeamReport[] {
  const map = readTiles(file);
  return plan.crossings.map((crossing) => {
    const [a, b] = crossing.between;
    const report = (status: SeamStatus, detail: string): SeamReport => ({
      between: crossing.between,
      kind: crossing.kind,
      status,
      detail,
    });
    const missing = [a, b].filter((id) => !built[id]);
    if (missing.length > 0)
      return report(
        'waiting',
        `The ${crossing.kind} from ${a} to ${b} waits for ${missing.join(' and ')}.`,
      );
    const opening = openingsOf(plan, a).find(
      (candidate) =>
        'district' in candidate.leadsTo &&
        candidate.leadsTo.district === b &&
        candidate.at === crossing.at,
    );
    if (!opening)
      return report('broken', `The ${crossing.kind} from ${a} to ${b} is not on a shared edge.`);
    const rect = districtRect(plan, a);
    const inA = toWorld(rect, insideOpening(plan.districtSize, opening, SEAM_DEPTH));
    const inB = toWorld(
      districtRect(plan, b),
      insideOpening(plan.districtSize, mirror(opening), SEAM_DEPTH),
    );
    if (crossing.kind === 'river') {
      const water = (point: [number, number]) => map.kinds[point[1]]?.[point[0]] === 'water';
      return water(inA) && water(inB)
        ? report('joined', `The river from ${a} to ${b} runs through.`)
        : report('broken', `The river from ${a} to ${b} does not run across the seam at ${inA}.`);
    }
    if (!walkable(map, ...inA) || !walkable(map, ...inB)) {
      return report(
        'broken',
        `The ${crossing.kind} from ${a} to ${b} is blocked at the seam (${inA} to ${inB}).`,
      );
    }
    const there = walkingSteps(map, inA)[inB[1]][inB[0]];
    return there === -1
      ? report('broken', `The ${crossing.kind} from ${a} to ${b} cannot be walked across.`)
      : report('joined', `The ${crossing.kind} from ${a} to ${b} goes through in ${there} steps.`);
  });
}

/** Walkable tiles on a district's very edge that are not one of its openings: a way through the seam nobody planned. */
function leaks(plan: WorldPlan, built: Readonly<Record<string, MapFile>>): string[] {
  const problems: string[] = [];
  const size = plan.districtSize;
  for (const district of plan.districts) {
    const file = built[district.id];
    if (!file || file.width !== size) continue;
    const map = readTiles(file);
    const allowed = new Set(
      openingsOf(plan, district.id).flatMap((opening) =>
        openingTiles(size, opening).map(([x, y]) => `${x},${y}`),
      ),
    );
    const edge: [number, number][] = [];
    for (let i = 0; i < size; i += 1) edge.push([i, 0], [i, size - 1], [0, i], [size - 1, i]);
    const open = edge.filter(([x, y]) => walkable(map, x, y) && !allowed.has(`${x},${y}`));
    if (open.length > 0)
      problems.push(
        `${district.id} is open at its edge where no crossing is planned, first at ${open[0]}.`,
      );
  }
  return problems;
}

/** The opening seen from the district on its other side. */
function mirror(opening: Opening): Opening {
  const across: Record<Opening['side'], Opening['side']> = {
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east',
  };
  return { ...opening, side: across[opening.side] };
}

/** A tile in the middle of an opening, `inward` tiles in from the edge. */
function insideOpening(size: number, opening: Opening, inward: number): [number, number] {
  const middle = { ...opening, at: opening.at + Math.floor((opening.width - 1) / 2), width: 1 };
  const tiles = openingTiles(size, middle, inward + 1);
  return tiles[tiles.length - 1];
}

function toWorld(rect: TileRect, [x, y]: [number, number]): [number, number] {
  return [rect.x + x, rect.y + y];
}
