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
  type MapFileLimits,
  type MapFileFacing,
  type MapFileLink,
  type MapFileSpot,
} from '../../src/game/world/mapFile';
import type { MapProgram } from './program';
import { readTiles, walkable, walkingSteps, type TileRect } from './tiles';
import {
  cellRect,
  checkPlan,
  districtOf,
  planLimits,
  districtRect,
  exitTile,
  openingsOf,
  openingTiles,
  planBounds,
  SEAM_DEPTH,
  type Opening,
  type PlannedSailing,
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
    /** Ways out of the district's own, beside the stand-ins at its openings. */
    readonly exits?: readonly MapFileExit[];
    readonly itemSpots?: readonly MapFileItemSpot[];
    readonly extra?: Partial<MapFile>;
  },
): MapFile {
  const district = districtOf(plan, id);
  // The district holding the Card Key's card is walked alone with its way out
  // toward the gate locked, so the card opens something there too.
  const card = plan.cardKey?.card === id ? plan.cardKey : undefined;
  const lockedWay =
    card && !(details.exits ?? []).some((exit) => exit.opens.when === 'key')
      ? wayToward(plan, id, card.lock)
      : undefined;
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
        const locked = lockedWay?.side === opening.side && lockedWay.at === opening.at;
        return { x, y, name, opens: locked ? { when: 'key' } : { when: 'always' } };
      }),
  ).concat(details.exits ?? []);
  const standInCard = standInCardTile(plan, id);
  return program.toFile({
    id: `${plan.id}-${id}`.slice(0, 40),
    name: district.name.slice(0, MAP_FILE_LIMITS.maxNameLength),
    maker: plan.maker,
    dropIns: details.dropIns.length > 0 ? details.dropIns : [standInDropIn(plan, id)],
    exits,
    itemSpots:
      standInCard && !(details.itemSpots ?? []).some((spot) => spot.key)
        ? [...(details.itemSpots ?? []), { x: standInCard[0], y: standInCard[1], key: true }]
        : details.itemSpots,
    wildlife: district.wildlife ?? plan.wildlife,
    extra: details.extra,
  });
}

/**
 * A district with no landing of its own (a wood the plan gives none) still
 * needs one to be played alone in TRY IT: it is dropped in just inside its
 * first opening, and the stitcher leaves that stand-in out, as it does the
 * stand-in ways out.
 */
/**
 * The opening a district's stand-in landing is just inside: its first that is
 * not a river - and not a night track either, if it has another, because a
 * night track is shut whenever a district is checked alone and a landing just
 * inside one is a landing in a pocket.
 */
function standInOpening(plan: WorldPlan, id: string): Opening | undefined {
  const ways = openingsOf(plan, id).filter((candidate) => candidate.kind !== 'river');
  return ways.find((candidate) => candidate.opens === undefined) ?? ways[0];
}

function standInDropIn(plan: WorldPlan, id: string): MapFileDropIn {
  const opening = standInOpening(plan, id);
  if (!opening) throw new Error(`${id} has no way in to be dropped at`);
  const [x, y] = standInDropInTile(plan.districtSize, opening);
  return { x, y, name: 'Way in', description: 'A stand-in landing, for walking this district alone.' };
}

function standInDropInTile(size: number, opening: Opening): [number, number] {
  return insideOpening(size, opening, SEAM_DEPTH);
}

/** A district's way in from (or out toward) another: the opening between them, else its first. */
function wayToward(plan: WorldPlan, id: string, other: string): Opening | undefined {
  const ways = openingsOf(plan, id).filter((opening) => opening.kind !== 'river');
  return (
    ways.find((opening) => 'district' in opening.leadsTo && opening.leadsTo.district === other) ??
    ways[0]
  );
}

/**
 * Where the district holding the Card Key's gate has a stand-in card when it is
 * walked alone: a step further in than its stand-in landing, on its way in from
 * the card's district - which is where the card comes from.
 */
function standInCardTile(plan: WorldPlan, id: string): [number, number] | undefined {
  if (plan.cardKey?.lock !== id) return undefined;
  const way = wayToward(plan, id, plan.cardKey.card);
  return way ? insideOpening(plan.districtSize, way, SEAM_DEPTH + 1) : undefined;
}

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
  // The sea, and every island not drawn yet: open water until it is.
  const undrawnIslands = plan.districts
    .filter((district) => district.island === true && !built[district.id])
    .map((district) => district.cell);
  for (const sea of [...(plan.seas ?? []), ...undrawnIslands]) {
    const rect = cellRect(plan, sea);
    for (let y = rect.y; y < rect.y + rect.height; y += 1)
      for (let x = rect.x; x < rect.x + rect.width; x += 1) if (ground[y]) ground[y][x] = 'W';
  }
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
    const standInLanding = standInOpening(plan, district.id);
    const standInAt = standInLanding ? standInDropInTile(size, standInLanding).join(',') : '';
    merged.dropIns.push(
      ...file.dropIns
        .filter(
          (dropIn) =>
            dropIn.area !== undefined ||
            `${dropIn.x},${dropIn.y}` !== standInAt ||
            dropIn.name !== 'Way in',
        )
        .map(move),
    );
    merged.exits.push(
      ...file.exits
        .filter((exit) => exit.area !== undefined || !standIns.has(`${exit.x},${exit.y}`))
        .map(move),
    );
    const standInCard = standInCardTile(plan, district.id)?.join(',');
    merged.itemSpots.push(
      ...file.itemSpots
        .filter((spot) => !(spot.key && spot.area === undefined && `${spot.x},${spot.y}` === standInCard))
        .map(move),
    );
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
        ...(district.rain ? { rain: true } : {}),
      },
    );
    // A place two districts both carry (a cave whose floors ride in one
    // district's file and are carried by another with a mouth onto them, so
    // each district passes its checks alone) is taken once, as is a way
    // between two such places; carried differently, it is two places.
    for (const area of file.areas ?? []) {
      const other = merged.areas.find((candidate) => candidate.id === area.id);
      if (other && JSON.stringify(other) === JSON.stringify(area)) continue;
      if (other) problems.push(`Two districts have a place called '${area.id}'.`);
      merged.areas.push(area);
    }
    for (const link of file.links ?? []) {
      // A boat a district keeps to itself (a punt on its own water) sails on with it.
      const sails = link.sails && {
        ...link.sails,
        course: link.sails.course.map((turn) => ({ x: turn.x + rect.x, y: turn.y + rect.y })),
      };
      const moved: MapFileLink = { ends: [move(link.ends[0]), move(link.ends[1])], ...(sails ? { sails } : {}) };
      const shared = link.ends.every((end) => end.area !== undefined);
      if (shared && merged.links.some((other) => JSON.stringify(other) === JSON.stringify(moved)))
        continue;
      merged.links.push(moved);
    }
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
    merged.exits.push({ x: rect.x + x, y: rect.y + y, name: exit.name, opens: exit.opens ?? { when: 'always' } });
  }
  merged.exits = uniqueNames(merged.exits);
  // A boat runs once both its jetties are drawn: a link sailed across the sea
  // cells the plan routes it through.
  for (const sailing of plan.sailings ?? []) {
    if (!built[sailing.from.district] || !built[sailing.to.district]) continue;
    const boat = sailingLink(plan, sailing, ground);
    if (typeof boat === 'string') problems.push(boat);
    else merged.links.push(boat);
  }
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
  problems.push(...limitProblems(file, planLimits(plan)));
  const seams = seamReports(plan, built, file);
  problems.push(...seams.filter((seam) => seam.status === 'broken').map((seam) => seam.detail));
  problems.push(...leaks(plan, built));
  return { file, seams, problems };
}

const STEPS: readonly (readonly [MapFileFacing, number, number])[] = [
  ['up', 0, -1],
  ['down', 0, 1],
  ['left', -1, 0],
  ['right', 1, 0],
];

/**
 * A planned boat as the link it ships as (`MapFileSailing`): its two jetties,
 * each boarded by pressing onto the deep water beside it, and the fewest
 * straight legs of deep water between them that stay inside the cells the
 * plan routes it through - its jetties' districts and its `via` sea.
 */
export function sailingLink(
  plan: WorldPlan,
  sailing: PlannedSailing,
  ground: readonly (readonly string[])[],
): MapFileLink | string {
  const what = `The boat '${sailing.name}'`;
  const cells = [districtOf(plan, sailing.from.district).cell, ...sailing.via, districtOf(plan, sailing.to.district).cell];
  const inRoute = (x: number, y: number): boolean =>
    cells.some((cell) => {
      const rect = cellRect(plan, cell);
      return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
    });
  const water = (x: number, y: number): boolean => ground[y]?.[x] === 'W' && inRoute(x, y);
  const jetty = (end: PlannedSailing['from']): [number, number] => {
    const rect = districtRect(plan, end.district);
    return [rect.x + end.at[0], rect.y + end.at[1]];
  };
  const [from, to] = [jetty(sailing.from), jetty(sailing.to)];
  const moorings = ([x, y]: [number, number]) =>
    STEPS.filter(([, dx, dy]) => water(x + dx, y + dy)).map(([toward, dx, dy]) => ({ toward, boat: [x + dx, y + dy] as const }));
  const starts = moorings(from);
  const ends = moorings(to);
  if (starts.length === 0 || ends.length === 0)
    return `${what} has no deep water beside its jetty at ${starts.length === 0 ? from : to}.`;
  // The fewest legs: a breadth-first search in which one move is a whole leg,
  // as far as the water goes in a straight line.
  const width = ground[0]?.length ?? 0;
  const key = (x: number, y: number) => y * width + x;
  let best: { legs: [number, number][]; start: (typeof starts)[number]; end: (typeof ends)[number] } | undefined;
  for (const start of starts) {
    const legs = new Map<number, number>([[key(...start.boat), 0]]);
    const back = new Map<number, number>();
    const queue: [number, number][] = [[start.boat[0], start.boat[1]]];
    for (let head = 0; head < queue.length; head += 1) {
      const [x, y] = queue[head];
      const turns = legs.get(key(x, y))!;
      for (const [, dx, dy] of STEPS) {
        for (let nx = x + dx, ny = y + dy; water(nx, ny); nx += dx, ny += dy) {
          const known = legs.get(key(nx, ny));
          if (known !== undefined && known <= turns) continue;
          if (known === undefined) {
            legs.set(key(nx, ny), turns + 1);
            back.set(key(nx, ny), key(x, y));
            queue.push([nx, ny]);
          }
        }
      }
    }
    for (const end of ends) {
      if (!legs.has(key(...end.boat))) continue;
      const path: [number, number][] = [];
      for (let at: number | undefined = key(...end.boat); at !== undefined; at = back.get(at))
        path.unshift([at % width, Math.floor(at / width)]);
      if (!best || path.length < best.legs.length) best = { legs: path, start, end };
    }
  }
  if (!best) return `${what} cannot sail from ${from} to ${to} over deep water by the route the plan gives it.`;
  return {
    ends: [
      { x: from[0], y: from[1], toward: best.start.toward, look: 'boat' },
      { x: to[0], y: to[1], toward: best.end.toward, look: 'boat' },
    ],
    sails: {
      name: sailing.name,
      from: sailing.runs.from,
      until: sailing.runs.until,
      course: best.legs.slice(1, -1).map(([x, y]) => ({ x, y })),
    },
  };
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

function limitProblems(file: MapFile, held: MapFileLimits): string[] {
  const limits: [string, number, number][] = [
    ['drop-ins', file.dropIns.length, held.maxDropIns],
    ['ways out', file.exits.length, held.maxExits],
    ['item spots', file.itemSpots.length, held.maxItemSpots],
    ['people', file.people?.length ?? 0, held.maxPeople],
    ['signs', file.signs?.length ?? 0, held.maxSigns],
    ['landmarks', file.landmarks?.length ?? 0, held.maxLandmarks],
    ['named places', file.districts?.length ?? 0, held.maxDistricts],
    ['trainers', file.trainers?.length ?? 0, held.maxTrainers],
    ['doors', file.doors?.length ?? 0, held.maxDoors],
    ['Pokemon', file.pokemon?.length ?? 0, held.maxPokemon],
    ['berry trees', file.berryTrees?.length ?? 0, held.maxBerryTrees],
    ['boulders', file.boulders?.length ?? 0, held.maxBoulders],
    ['insides and caves', file.areas?.length ?? 0, held.maxAreas],
    ['ways between places', file.links?.length ?? 0, held.maxLinks],
  ];
  const problems = limits
    .filter(([, count, limit]) => count > limit)
    .map(([what, count, limit]) => `The map has ${count} ${what}; a map file holds ${limit}.`);
  const bytes = JSON.stringify(file).length;
  if (bytes > held.maxBytes)
    problems.push(`The map is ${bytes} bytes; a map file is ${held.maxBytes} at most.`);
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
