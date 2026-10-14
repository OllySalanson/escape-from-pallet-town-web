import type { GridLinks, GridPosition } from '../movement/gridMovement';
import { linkKey } from '../movement/gridMovement';
import { formatMoney, isMaterial } from '../items/items';
import { fileDoorGates, floorHabitat, isBarredFileExit, itemSpotContents, MAP_FILE_LANDMARKS, trainerTemplate } from './mapFile';
import type { MapFile, MapFileSpot, MapFileTrainerTeam } from './mapFile';
import { mapFileGrid, spotPlacer } from './mapFileChecks';
import { isBlockedAt, stepDistances, type CollisionGrid } from './mapStructure';
import { densityOf, nearestThingSteps, SHIPPED_DENSITY } from './nearestThing';
import { partyOf, playTrainerSeries } from './trainerMeasure';
import { trainerSightTiles } from './trainerSight';

/**
 * What a reviewer is told about a player's map before playing it: the facts a
 * fair map and a cheat map differ on, as advice and never as a rule.
 *
 * The captain's answer to playtest 12's owner call (2026-10-11): player maps get
 * no fairness or economy limits beyond "does it work" (`mapFileChecks.ts`), so
 * nothing here can refuse a map. What it does is put in front of the owner the
 * four things review has to judge by eye otherwise - how many fights stand in a
 * row between a landing and the way out, how close the way out is, how much a
 * walk round it pays, and whether there is anything in it at all - measured the
 * way the game's own maps are: the nearest-thing walk `density.mts` prints, and
 * a fight played out over the real engine by `trainerMeasure.ts`.
 */

/** How near a drop-in a pickup has to be to count as there for the taking. */
export const NEAR_STEPS = 20;
/** The player a fight is measured against: a lone starter at the level published maps are met at. */
export const REFERENCE_LEVEL = 12;
/** The Potions a fresh save deploys with, drunk as the battle screen charges them. */
export const REFERENCE_POTIONS = 3;
const REFERENCE_STARTERS = ['bulbasaur', 'charmander', 'squirtle'] as const;
const TRIALS = 40;

export interface MapFileSummary {
  /**
   * The fewest fights a player must take to leave from the worst drop-in,
   * counting every trainer whose watch the way out crosses or who stands in it;
   * undefined when no drop-in can walk out at all (the checks say so).
   */
  readonly fightsOut: number | undefined;
  /** Whose teams those fights are, in the order they are met. */
  readonly fightsOutTeams: readonly MapFileTrainerTeam[];
  /** The drop-in that cheapest way out is from. */
  readonly fightsOutFrom: string | undefined;
  /** Steps to the nearest exit from the nearest and the furthest drop-in. */
  readonly exitSteps: { readonly least: number; readonly most: number } | undefined;
  /** Item spots and landmark caches a drop-in can walk to. */
  readonly pickups: number;
  readonly itemSpots: number;
  readonly caches: number;
  /** Of those, how many are within `NEAR_STEPS` of a drop-in. */
  readonly nearPickups: number;
  /** Brock's materials and money those pickups pay, laid all at once. */
  readonly materials: number;
  readonly money: number;
  /** Pickups per hundred tiles a drop-in can walk to. */
  readonly pickupsPer100: number;
  /** Mean steps from a tile to its nearest permanent authored thing (`nearestThing.ts`). */
  readonly density: number | undefined;
  /** Nothing to find, fight or catch: no pickups, trainers, berry trees, Pokemon to fight or wild ground. */
  readonly empty: boolean;
}

const summaries = new WeakMap<MapFile, MapFileSummary | undefined>();

/** The summary of a map, worked out once per version of it; undefined for one the game cannot draw. */
export function summariseMapFile(file: MapFile): MapFileSummary | undefined {
  if (!summaries.has(file)) {
    let summary: MapFileSummary | undefined;
    try {
      summary = summarise(file);
    } catch {
      summary = undefined;
    }
    summaries.set(file, summary);
  }
  return summaries.get(file);
}

function summarise(file: MapFile): MapFileSummary {
  const { composed, collision, links } = mapFileGrid(file);
  const openCollision = mapFileGrid(file, true).collision;
  const onGrid = spotPlacer(composed);
  const key = ({ x, y }: GridPosition): string => `${x},${y}`;
  const people = file.people ?? [];
  const signs = file.signs ?? [];
  const landmarks = file.landmarks ?? [];
  const trainers = file.trainers ?? [];
  const pokemon = file.pokemon ?? [];
  const berryTrees = file.berryTrees ?? [];
  const boulders = file.boulders ?? [];

  // The walls every walk below is measured against, as the checks have them:
  // figures stand where they were put, a boulder is a wall on the way out and
  // pushed aside for what can be reached, and an open exit takes whoever steps
  // on it, so no walk goes over one.
  const exitTiles = file.exits.map(onGrid);
  const figureTiles = [...people, ...signs, ...pokemon, ...berryTrees].map(onGrid);
  const pushedAside = new Set([...exitTiles, ...figureTiles].map(key));
  const shut = new Set([...pushedAside, ...boulders.map((spot) => key(onGrid(spot)))]);
  const dropIns = file.dropIns.map((dropIn) => ({
    dropIn,
    tile: onGrid(dropIn),
    steps: stepDistances(collision, onGrid(dropIn), shut, links),
    opened: stepDistances(openCollision, onGrid(dropIn), pushedAside, links),
  }));

  // An exit is reached from beside it, then one step on.
  const stepsOnto = (steps: readonly Int32Array[], tile: GridPosition): number => {
    const beside = [
      steps[tile.y]?.[tile.x - 1],
      steps[tile.y]?.[tile.x + 1],
      steps[tile.y - 1]?.[tile.x],
      steps[tile.y + 1]?.[tile.x],
    ].filter((value): value is number => value !== undefined && value >= 0);
    return beside.length > 0 ? Math.min(...beside) + 1 : -1;
  };
  const openExits = file.exits.filter((exit) => !isBarredFileExit(exit)).map(onGrid);
  const nearestExit = dropIns
    .map(({ steps }) =>
      Math.min(...openExits.map((exit) => stepsOnto(steps, exit)).filter((walk) => walk >= 0)),
    )
    .filter(Number.isFinite);
  const exitSteps =
    nearestExit.length > 0
      ? { least: Math.min(...nearestExit), most: Math.max(...nearestExit) }
      : undefined;

  // Fights: each trainer stops whoever steps into their watch or walks into
  // them, once. The way out with the fewest is found per drop-in, and the
  // worst drop-in is the one reported, because a landing is chosen by the
  // player and a gauntlet behind any one of them is a gauntlet.
  const watches = new Int32Array(composed.width * composed.height);
  trainers.forEach((trainer, index) => {
    const at = onGrid(trainer);
    const seen = trainerSightTiles(
      { position: at, facing: trainer.facing, sightRange: trainer.sight },
      (tile) => isBlockedAt(collision, tile.x, tile.y),
    );
    for (const tile of [at, ...seen]) {
      watches[tile.y * composed.width + tile.x] |= 1 << index;
    }
  });
  const ways = dropIns.flatMap(({ dropIn, tile }) => {
    const way = fewestFights(
      collision,
      links,
      tile,
      new Set(
        file.exits.filter((exit) => !isBarredFileExit(exit)).map((exit) => key(onGrid(exit))),
      ),
      // An exit under rubble or behind a lock is a wall until somebody opens it, and
      // nobody has to.
      new Set(
        [
          ...figureTiles,
          ...boulders.map(onGrid),
          ...file.exits.filter(isBarredFileExit).map(onGrid),
        ].map(key),
      ),
      watches,
    );
    return way ? [{ from: dropIn.name, ...way }] : [];
  });
  const worst = ways.reduce<(typeof ways)[number] | undefined>(
    (most, way) => (most === undefined || way.met.length > most.met.length ? way : most),
    undefined,
  );

  // Pickups: what a drop-in can walk to with every door open, as the checks
  // ask what can be reached.
  const reach = (spot: MapFileSpot): number => {
    const tile = onGrid(spot);
    const walks = dropIns
      .map(({ opened }) => opened[tile.y]?.[tile.x] ?? -1)
      .filter((walk) => walk >= 0);
    return walks.length > 0 ? Math.min(...walks) : -1;
  };
  const paid = [
    // A Card Key spot is a key, not a pickup, and takes no turn in the rotation.
    ...file.itemSpots
      .filter((spot) => !spot.key)
      .map((spot, turn) => ({
        spot,
        pays: [itemSpotContents(turn)],
        cache: false,
      })),
    ...landmarks.map((spot) => ({ spot, pays: MAP_FILE_LANDMARKS[spot.kind].reward, cache: true })),
  ]
    .map((pickup) => ({ ...pickup, steps: reach(pickup.spot) }))
    .filter((pickup) => pickup.steps >= 0);
  const pays = paid.flatMap((pickup) => pickup.pays);
  const reachedTiles = new Set<number>();
  for (const { opened } of dropIns) {
    opened.forEach((row, y) =>
      row.forEach((walk, x) => {
        if (walk >= 0) {
          reachedTiles.add(y * composed.width + x);
        }
      }),
    );
  }

  // Density: the walk to the nearest permanent thing, as the game's own maps
  // are measured, over the ground with every door open.
  const things = [
    ...file.dropIns,
    ...file.exits,
    ...landmarks,
    ...people,
    ...signs,
    ...trainers,
    ...pokemon,
    ...berryTrees,
  ].map(onGrid);
  const doorTiles = fileDoorGates(file).flatMap((gate) => gate.tiles);
  const nearest = nearestThingSteps(openCollision, [...things, ...doorTiles], links);
  const density = densityOf(
    [...reachedTiles].map(
      (index) => nearest[Math.floor(index / composed.width)][index % composed.width],
    ),
  );

  const wildGround =
    composed.areas.some((area) => area.kind !== 'outdoors' && floorHabitat(area.kind, area.style) !== undefined) ||
    composed.terrain.some((row, y) =>
      row.some((material, x) => material === 'tall-grass' && !isBlockedAt(collision, x, y)),
    );
  return {
    fightsOut: worst?.met.length,
    fightsOutTeams: (worst?.met ?? []).map((index) => trainers[index].team),
    fightsOutFrom: worst?.from,
    exitSteps,
    pickups: paid.length,
    itemSpots: paid.filter((pickup) => !pickup.cache).length,
    caches: paid.filter((pickup) => pickup.cache).length,
    nearPickups: paid.filter((pickup) => pickup.steps <= NEAR_STEPS).length,
    materials: pays
      .filter((pay) => isMaterial(pay.itemId))
      .reduce((total, pay) => total + pay.quantity, 0),
    money: pays
      .filter((pay) => pay.itemId === 'money')
      .reduce((total, pay) => total + pay.quantity, 0),
    pickupsPer100: reachedTiles.size === 0 ? 0 : (paid.length * 100) / reachedTiles.size,
    density: density?.mean,
    empty:
      file.itemSpots.length === 0 &&
      landmarks.length === 0 &&
      trainers.length === 0 &&
      berryTrees.length === 0 &&
      !pokemon.some((standing) => standing.level !== undefined) &&
      !wildGround,
  };
}

/**
 * The way out of one drop-in that meets the fewest trainers, and who they are
 * in the order they are met. A step costs the trainers watching the tile it
 * lands on that were not watching the tile it left, which counts a trainer
 * once for walking down their line of sight; a way that leaves a watch and
 * walks back into it is charged twice, which only ever makes the search pass
 * it over. The trainers named are the ones the chosen way actually meets.
 */
function fewestFights(
  collision: CollisionGrid,
  links: GridLinks,
  from: GridPosition,
  exits: ReadonlySet<string>,
  walls: ReadonlySet<string>,
  watches: Int32Array,
): { readonly met: readonly number[] } | undefined {
  const height = collision.length;
  const width = collision[0]?.length ?? 0;
  const passable = (index: number): boolean => {
    const x = index % width;
    const y = (index - x) / width;
    return !isBlockedAt(collision, x, y) && !walls.has(`${x},${y}`);
  };
  const isExit = (index: number): boolean =>
    exits.has(`${index % width},${Math.floor(index / width)}`);
  const start = from.y * width + from.x;
  if (!passable(start)) {
    return undefined;
  }
  const cost = new Int32Array(width * height).fill(-1);
  const previous = new Int32Array(width * height).fill(-1);
  const buckets: number[][] = [];
  const push = (index: number, value: number, before: number): void => {
    if (cost[index] !== -1 && cost[index] <= value) {
      return;
    }
    cost[index] = value;
    previous[index] = before;
    (buckets[value] ??= []).push(index);
  };
  push(start, popCount(watches[start]), -1);
  for (let value = 0; value < buckets.length; value += 1) {
    const bucket = buckets[value] ?? [];
    for (let at = 0; at < bucket.length; at += 1) {
      const here = bucket[at];
      if (cost[here] !== value) {
        continue;
      }
      if (here !== start && isExit(here)) {
        return { met: trainersMet(here, previous, watches) };
      }
      const x = here % width;
      const y = (here - x) / width;
      const next = [
        y > 0 ? here - width : -1,
        y < height - 1 ? here + width : -1,
        x > 0 ? here - 1 : -1,
        x < width - 1 ? here + 1 : -1,
        ...[0, 1, 2, 3].map((direction) => links.get(linkKey(here, direction)) ?? -1),
      ];
      for (const index of next) {
        // An exit is stepped onto, never through, and anything else must be ground.
        if (index < 0 || (!isExit(index) && !passable(index))) {
          continue;
        }
        if (isExit(index) && isBlockedAt(collision, index % width, Math.floor(index / width))) {
          continue;
        }
        push(index, value + popCount(watches[index] & ~watches[here]), here);
      }
    }
  }
  return undefined;
}

/** The trainers a way meets, in order, each once. */
function trainersMet(end: number, previous: Int32Array, watches: Int32Array): number[] {
  const way: number[] = [];
  for (let at = end; at !== -1; at = previous[at]) {
    way.unshift(at);
  }
  const met: number[] = [];
  for (const tile of way) {
    for (let bits = watches[tile], index = 0; bits !== 0; bits >>>= 1, index += 1) {
      if (bits & 1 && !met.includes(index)) {
        met.push(index);
      }
    }
  }
  return met;
}

function popCount(bits: number): number {
  let count = 0;
  for (let rest = bits; rest !== 0; rest &= rest - 1) {
    count += 1;
  }
  return count;
}

const chances = new Map<string, number>();

/**
 * How often a lone starter at `REFERENCE_LEVEL`, with the fresh save's
 * Potions, gets through every one of these fights in the order they come -
 * carrying its health and its pack from each into the next
 * (`playTrainerSeries`) - as the mean over the three starters. Nobody levels
 * between fights, so it leans hard; it is advice, read beside the count.
 * Worked out once per run of teams and kept, because a reviewer reopens a map.
 */
export function chanceThrough(teams: readonly MapFileTrainerTeam[]): number {
  if (teams.length === 0) {
    return 1;
  }
  const cached = teams.join('/');
  if (!chances.has(cached)) {
    const trainers = teams.map((team) => trainerTemplate(team).trainer);
    let through = 0;
    for (const starter of REFERENCE_STARTERS) {
      const party = partyOf(starter, [starter, REFERENCE_LEVEL]);
      for (let trial = 0; trial < TRIALS; trial += 1) {
        if (
          playTrainerSeries(party.build(), trainers, 0x51ede + trial * 7919, REFERENCE_POTIONS).won
        ) {
          through += 1;
        }
      }
    }
    chances.set(cached, through / (TRIALS * REFERENCE_STARTERS.length));
  }
  return chances.get(cached)!;
}

const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

/**
 * The one line a review list row carries. Each fact is held together with
 * no-break spaces, so a narrow row breaks between facts and never leaves a
 * number at the end of one line and its noun at the start of the next.
 */
export function summaryLine(summary: MapFileSummary): string {
  const parts = [
    summary.fightsOut === undefined ? 'no way out' : plural(summary.fightsOut, 'fight'),
    summary.exitSteps ? `exit ${plural(summary.exitSteps.least, 'step')}` : '',
    plural(summary.pickups, 'pickup'),
    summary.materials > 0 ? plural(summary.materials, 'material') : '',
    summary.empty ? 'EMPTY' : '',
  ];
  return parts
    .filter(Boolean)
    .map((part) => part.replaceAll(' ', '\u00a0'))
    .join(' · ');
}

/** The whole summary of the map open for review, a fact a line. */
export function summaryLines(
  summary: MapFileSummary,
  chance = chanceThrough(summary.fightsOutTeams),
): string[] {
  const fights =
    summary.fightsOut === undefined
      ? 'Fights out: no drop-in can walk out.'
      : summary.fightsOut === 0
        ? 'Fights out: none.'
        : `Fights out: ${summary.fightsOut} in a row from ${summary.fightsOutFrom}. A lone Lv ${REFERENCE_LEVEL} starter with ${REFERENCE_POTIONS} Potions gets through them all ${Math.round(chance * 100)}% of the time.`;
  const exit = summary.exitSteps
    ? summary.exitSteps.least === summary.exitSteps.most
      ? `Nearest exit: ${plural(summary.exitSteps.least, 'step')} from a drop-in.`
      : `Nearest exit: ${summary.exitSteps.least}-${summary.exitSteps.most} steps from a drop-in.`
    : 'Nearest exit: none can be walked to.';
  const paysOut = [
    summary.materials > 0 ? plural(summary.materials, 'material') : '',
    summary.money > 0 ? formatMoney(summary.money) : '',
  ].filter(Boolean);
  const payout =
    summary.pickups === 0
      ? 'Payout: nothing to pick up.'
      : `Payout: ${plural(summary.pickups, 'pickup')} (${plural(summary.itemSpots, 'item spot')}, ${plural(summary.caches, 'cache')})${
          paysOut.length > 0 ? `, paying ${paysOut.join(' and ')}` : ''
        }; ${summary.nearPickups} within ${NEAR_STEPS} steps of a drop-in, ${summary.pickupsPer100.toFixed(1)} per 100 tiles.`;
  const density =
    summary.density === undefined
      ? ''
      : `Nearest thing: ${summary.density.toFixed(1)} steps on average (the game's own maps: ${SHIPPED_DENSITY.least}-${SHIPPED_DENSITY.most}).`;
  return [
    ...(summary.empty ? ['EMPTY: nothing to find, fight or catch.'] : []),
    fights,
    exit,
    payout,
    density,
  ].filter(Boolean);
}
