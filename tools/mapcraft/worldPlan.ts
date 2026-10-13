/**
 * A huge map, planned coarse and drawn a district at a time.
 *
 * A world plan is a grid of districts - each the same square size, each with
 * one idea of its own - and the **crossings** where a road, a trail, a river or
 * open country passes from one district into the next. A crossing is fixed in
 * the plan before either district is drawn, so two districts drawn on
 * different days, by different programs, still meet: each district starts
 * from `startDistrict`, which seals its edge with wood everywhere except its
 * openings, and `stitch.ts` checks every seam it joins.
 *
 * Districts sit on whole grid cells, and a cell may be negative: a plan grows
 * by adding a district on any side, and the stitched map is simply laid out
 * from the plan's west and north edges again. Every district is drawn in its
 * own tiles, so nothing already drawn moves.
 *
 * Sizes, offsets and widths are even, because the Kanto sheet draws trees on
 * a 2x2 lattice: an odd seam would cut every tree along it in half.
 */
import {
  BUILT_IN_MAP_FILE_LIMITS,
  MAP_FILE_LIMITS,
  type MapFileExit,
  type MapFileHabitat,
  type MapFileLimits,
} from '../../src/game/world/mapFile';
import { MapProgram } from './program';
import type { TileRect } from './tiles';

export type Side = 'north' | 'south' | 'east' | 'west';
export type CrossingKind = 'road' | 'trail' | 'river' | 'open';

/** What a district is, at a glance: the colour it has in the plan's picture. */
export type Terrain =
  'town' | 'forest' | 'mountain' | 'river' | 'coast' | 'marsh' | 'farmland' | 'moor';

export interface PlannedDistrict {
  /** Lower-case letters, digits and dashes, unique in the plan. */
  readonly id: string;
  /** What the arrival plate says: twenty letters at most. */
  readonly name: string;
  /** Column and row in the plan's grid; either may be negative. */
  readonly cell: readonly [number, number];
  /** The district's one idea, in words: the brief its program is written to. */
  readonly idea: string;
  readonly terrain?: Terrain;
  readonly wildlife?: MapFileHabitat;
}

/** Where a way passes between two districts that share an edge. */
export interface Crossing {
  readonly between: readonly [string, string];
  /** Tiles along the shared edge, from its west or north end, to the crossing's first tile. */
  readonly at: number;
  readonly kind: CrossingKind;
  /** Defaults: a road or trail 2, a river 4, open country 8. */
  readonly width?: number;
  /** A way nobody signs: a deer path through a wood, found rather than followed. */
  readonly hidden?: boolean;
}

/** A way out of the whole map, on the plan's outer edge. */
export interface WorldExit {
  readonly district: string;
  readonly side: Side;
  readonly at: number;
  readonly name: string;
  readonly kind?: 'road' | 'trail';
  readonly width?: number;
  /**
   * When it opens; always, unless the plan says otherwise. A raid needs one way
   * out that opens later as well as one open from the start
   * (`runGeneration.test.ts`), and once every district is drawn the stand-ins
   * that used to be the later ones are gone.
   */
  readonly opens?: MapFileExit['opens'];
}

/** Something a district's program has to put on the map, roughly where the plan says. */
export interface PlannedLandmark {
  readonly district: string;
  readonly name: string;
  /** Roughly where, in the district's own tiles. */
  readonly at: readonly [number, number];
  /** A landing is where a raid can be dropped in; a secret is somewhere a raid has to find. */
  readonly kind: 'landmark' | 'landing' | 'secret';
}

/** A cave under the map: several floors, and mouths in one or more districts. */
export interface PlannedCave {
  readonly id: string;
  readonly name: string;
  readonly floors: number;
  readonly mouths: readonly { readonly district: string; readonly at: readonly [number, number] }[];
}

export interface WorldPlan {
  readonly id: string;
  readonly name: string;
  readonly maker?: string;
  /** The side of every district, in tiles. */
  readonly districtSize: number;
  readonly wildlife?: MapFileHabitat;
  readonly districts: readonly PlannedDistrict[];
  readonly crossings: readonly Crossing[];
  readonly exits: readonly WorldExit[];
  readonly landmarks?: readonly PlannedLandmark[];
  readonly caves?: readonly PlannedCave[];
  /**
   * Cells of the plan that are open sea rather than districts, columns and
   * rows as a district's `cell`, inside the districts' bounds. The stitcher
   * lays them as deep water, so a coast that faces one meets the sea rather
   * than the wood an empty cell would be.
   */
  readonly seas?: readonly (readonly [number, number])[];
  /**
   * The game's own map, not a player's: its stitched file is held to
   * `BUILT_IN_MAP_FILE_LIMITS`, as `builtInFileMap` reads it. Each district's
   * own file is still a map anybody could draw.
   */
  readonly builtIn?: true;
  /**
   * A gate locked to the Card Key in one district (`opens: { when: 'key' }`)
   * and the item spot its card lies on in another (`key: true`). A district is
   * walked alone as well, where a lock with no card or a card with no lock is
   * a fault, so `districtFile` gives each the other half as a stand-in - a card
   * just inside the lock's way in from the card's side, a lock on the card's
   * way out toward the gate - and the stitcher drops both.
   */
  readonly cardKey?: { readonly lock: string; readonly card: string };
}

/** What a plan's stitched file may hold. */
export function planLimits(plan: WorldPlan): MapFileLimits {
  return plan.builtIn === true ? BUILT_IN_MAP_FILE_LIMITS : MAP_FILE_LIMITS;
}

/** One gap in a district's sealed edge, in the district's own tiles. */
export interface Opening {
  readonly side: Side;
  /** Along the edge: the first tile of the gap, and how many tiles wide it is. */
  readonly at: number;
  readonly width: number;
  readonly kind: CrossingKind;
  /** The district on the other side, or the exit's name for a way out of the map. */
  readonly leadsTo: { readonly district: string } | { readonly exit: string };
  readonly hidden?: boolean;
}

/** How deep a district's sealed border is: one lattice cell, so its trees are whole. */
export const SEAM_DEPTH = 2;

const DEFAULT_WIDTH: Readonly<Record<CrossingKind, number>> = {
  road: 2,
  trail: 2,
  river: 4,
  open: 8,
};

/** The ground letter an opening is laid in. */
export const OPENING_LETTER: Readonly<Record<CrossingKind, string>> = {
  road: 'd',
  trail: '.',
  river: 'W',
  open: '.',
};

export function crossingWidth(crossing: Pick<Crossing, 'kind' | 'width'>): number {
  return crossing.width ?? DEFAULT_WIDTH[crossing.kind];
}

export function districtOf(plan: WorldPlan, id: string): PlannedDistrict {
  const district = plan.districts.find((candidate) => candidate.id === id);
  if (!district) throw new Error(`the plan has no district '${id}'`);
  return district;
}

/** The plan's extent in cells: the west and north cells and how many across and down. */
export function planBounds(plan: WorldPlan): {
  column: number;
  row: number;
  columns: number;
  rows: number;
} {
  const columns = plan.districts.map((district) => district.cell[0]);
  const rows = plan.districts.map((district) => district.cell[1]);
  const column = Math.min(...columns);
  const row = Math.min(...rows);
  return {
    column,
    row,
    columns: Math.max(...columns) - column + 1,
    rows: Math.max(...rows) - row + 1,
  };
}

/** Where a district lies in the stitched map, in tiles. */
export function districtRect(plan: WorldPlan, id: string): TileRect {
  return cellRect(plan, districtOf(plan, id).cell);
}

/** Where a cell of the plan lies in the stitched map, in tiles. */
export function cellRect(plan: WorldPlan, cell: readonly [number, number]): TileRect {
  const bounds = planBounds(plan);
  return {
    x: (cell[0] - bounds.column) * plan.districtSize,
    y: (cell[1] - bounds.row) * plan.districtSize,
    width: plan.districtSize,
    height: plan.districtSize,
  };
}

/** Which side of `from` the district `to` is on, if they share an edge. */
function sideTowards(from: PlannedDistrict, to: PlannedDistrict): Side | null {
  const dx = to.cell[0] - from.cell[0];
  const dy = to.cell[1] - from.cell[1];
  if (dx === 1 && dy === 0) return 'east';
  if (dx === -1 && dy === 0) return 'west';
  if (dx === 0 && dy === 1) return 'south';
  if (dx === 0 && dy === -1) return 'north';
  return null;
}

/** Every gap in one district's edge: its crossings and any way out of the map. */
export function openingsOf(plan: WorldPlan, id: string): Opening[] {
  const district = districtOf(plan, id);
  const openings: Opening[] = [];
  for (const crossing of plan.crossings) {
    const index = crossing.between.indexOf(id);
    if (index === -1) continue;
    const other = districtOf(plan, crossing.between[1 - index]);
    const side = sideTowards(district, other);
    if (!side) continue;
    openings.push({
      side,
      at: crossing.at,
      width: crossingWidth(crossing),
      kind: crossing.kind,
      leadsTo: { district: other.id },
      hidden: crossing.hidden,
    });
  }
  for (const exit of plan.exits) {
    if (exit.district !== id) continue;
    const kind = exit.kind ?? 'road';
    openings.push({
      side: exit.side,
      at: exit.at,
      width: exit.width ?? DEFAULT_WIDTH[kind],
      kind,
      leadsTo: { exit: exit.name },
    });
  }
  return openings;
}

/** The tiles of an opening on the district's very edge, in the district's tiles. */
export function openingTiles(size: number, opening: Opening, depth = 1): [number, number][] {
  const tiles: [number, number][] = [];
  for (let along = opening.at; along < opening.at + opening.width; along += 1) {
    for (let inward = 0; inward < depth; inward += 1) {
      if (opening.side === 'north') tiles.push([along, inward]);
      if (opening.side === 'south') tiles.push([along, size - 1 - inward]);
      if (opening.side === 'west') tiles.push([inward, along]);
      if (opening.side === 'east') tiles.push([size - 1 - inward, along]);
    }
  }
  return tiles;
}

/**
 * What is wrong with a plan, in words; empty when it can be drawn. Asked before
 * anything is drawn, because a crossing in the wrong place costs two districts.
 */
export function checkPlan(plan: WorldPlan): string[] {
  const problems: string[] = [];
  const size = plan.districtSize;
  const held = planLimits(plan);
  if (size % 2 !== 0 || size < 16)
    problems.push(`districtSize ${size} has to be even and at least 16.`);
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const district of plan.districts) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(district.id))
      problems.push(
        `District id '${district.id}' has to be lower-case letters, digits and dashes.`,
      );
    if (ids.has(district.id)) problems.push(`Two districts are called '${district.id}'.`);
    ids.add(district.id);
    const key = district.cell.join(',');
    if (cells.has(key)) problems.push(`Two districts stand on cell ${key}.`);
    cells.add(key);
    if (district.name.length > held.maxPlaceNameLength)
      problems.push(
        `'${district.name}' is longer than ${held.maxPlaceNameLength} letters.`,
      );
  }
  if (plan.cardKey) {
    for (const id of [plan.cardKey.lock, plan.cardKey.card])
      if (!plan.districts.some((district) => district.id === id))
        problems.push(`The Card Key names '${id}', which is not a district of the plan.`);
    if (plan.cardKey.lock === plan.cardKey.card)
      problems.push('The Card Key lies in the district it opens: name two districts, or none.');
  }
  if (plan.districts.length > held.maxDistricts)
    problems.push(
      `A map file holds ${held.maxDistricts} districts at most; the plan has ${plan.districts.length}.`,
    );
  if (plan.districts.length > 0) {
    const bounds = planBounds(plan);
    for (const sea of plan.seas ?? []) {
      const key = sea.join(',');
      if (cells.has(key)) problems.push(`Cell ${key} is a sea or a district, not both, and once.`);
      cells.add(key);
      const [column, row] = sea;
      if (
        column < bounds.column ||
        row < bounds.row ||
        column >= bounds.column + bounds.columns ||
        row >= bounds.row + bounds.rows
      )
        problems.push(`The sea at cell ${key} is outside the districts' bounds.`);
    }
    if (
      bounds.columns * size > held.maxWidth ||
      bounds.rows * size > held.maxHeight
    ) {
      problems.push(
        `The plan is ${bounds.columns * size}x${bounds.rows * size} tiles; a map file is ${held.maxWidth}x${held.maxHeight} at most.`,
      );
    }
  }
  const gap = (what: string, at: number, width: number) => {
    if (at % 2 !== 0 || width % 2 !== 0)
      problems.push(`${what} has to start on an even tile and be an even width.`);
    if (at < SEAM_DEPTH || at + width > size - SEAM_DEPTH)
      problems.push(
        `${what} runs into a corner: keep it ${SEAM_DEPTH} tiles from each end of the edge.`,
      );
  };
  for (const crossing of plan.crossings) {
    const what = `The ${crossing.kind} between ${crossing.between.join(' and ')}`;
    const [a, b] = crossing.between.map((id) =>
      plan.districts.find((district) => district.id === id),
    );
    if (!a || !b) {
      problems.push(`${what} names a district the plan does not have.`);
      continue;
    }
    if (!sideTowards(a, b)) problems.push(`${what} joins two districts that do not share an edge.`);
    gap(what, crossing.at, crossingWidth(crossing));
  }
  for (const exit of plan.exits) {
    const what = `The way out '${exit.name}'`;
    const district = plan.districts.find((candidate) => candidate.id === exit.district);
    if (!district) {
      problems.push(`${what} is in a district the plan does not have.`);
      continue;
    }
    const step: Record<Side, readonly [number, number]> = {
      north: [0, -1],
      south: [0, 1],
      east: [1, 0],
      west: [-1, 0],
    };
    const beyond = [
      district.cell[0] + step[exit.side][0],
      district.cell[1] + step[exit.side][1],
    ].join(',');
    if (cells.has(beyond))
      problems.push(
        `${what} leads into another district: a way out has to be on the plan's outer edge.`,
      );
    gap(what, exit.at, exit.width ?? DEFAULT_WIDTH[exit.kind ?? 'road']);
  }
  const inside = (what: string, district: string, at: readonly [number, number]) => {
    if (!plan.districts.some((candidate) => candidate.id === district)) {
      problems.push(`${what} is in a district the plan does not have.`);
    } else if (at.some((value) => value < SEAM_DEPTH || value >= size - SEAM_DEPTH)) {
      problems.push(`${what} is off its district or on its sealed edge.`);
    }
  };
  for (const landmark of plan.landmarks ?? [])
    inside(`The landmark '${landmark.name}'`, landmark.district, landmark.at);
  for (const cave of plan.caves ?? []) {
    for (const mouth of cave.mouths) inside(`A mouth of ${cave.name}`, mouth.district, mouth.at);
  }
  const landings = (plan.landmarks ?? []).filter((landmark) => landmark.kind === 'landing').length;
  if (landings > held.maxDropIns)
    problems.push(
      `A map file holds ${held.maxDropIns} drop-ins at most; the plan has ${landings} landings.`,
    );
  const floors = (plan.caves ?? []).reduce((total, cave) => total + cave.floors, 0);
  if (floors > held.maxAreas)
    problems.push(
      `A map file holds ${held.maxAreas} insides and cave floors at most; the plan's caves have ${floors}.`,
    );
  if (plan.exits.length > held.maxExits)
    problems.push(`A map file holds ${held.maxExits} ways out at most.`);
  return problems;
}

/**
 * A district's program, ready to draw in: all wood, its edge sealed two tiles
 * deep and locked, except at its openings, which are cut through the seal in
 * their own ground (a road's sand, a river's water) and run `stub` tiles in.
 * Whatever the program draws, it can only leave by its openings - which is
 * what lets districts drawn apart be stitched together.
 */
export function startDistrict(
  plan: WorldPlan,
  id: string,
  { stub = 2 }: { stub?: number } = {},
): MapProgram {
  const size = plan.districtSize;
  const p = new MapProgram(size, size, 'T');
  p.lock(0, 0, size, SEAM_DEPTH).lock(0, size - SEAM_DEPTH, size, SEAM_DEPTH);
  p.lock(0, 0, SEAM_DEPTH, size).lock(size - SEAM_DEPTH, 0, SEAM_DEPTH, size);
  for (const opening of openingsOf(plan, id)) {
    const letter = OPENING_LETTER[opening.kind];
    const tiles = openingTiles(size, opening, SEAM_DEPTH + stub);
    p.unlock(tiles);
    for (const [x, y] of tiles) p.put(x, y, letter);
    if ('exit' in opening.leadsTo) {
      // A way off the map is one tile at its rim, as on every shipped map, so
      // the exit is a pocket a raid steps into: the rest of the rim is a bush.
      const [ex, ey] = exitTile(size, opening);
      for (const [x, y] of openingTiles(size, opening)) if (x !== ex || y !== ey) p.put(x, y, 'o');
    }
    p.lock(...lockRect(size, opening));
  }
  return p;
}

/** Where an opening's way out stands: its middle tile on the district's rim. */
export function exitTile(size: number, opening: Opening): [number, number] {
  return openingTiles(size, {
    ...opening,
    at: opening.at + Math.floor((opening.width - 1) / 2),
    width: 1,
  })[0];
}

/** The seal's part of an opening, as a rectangle to lock. */
function lockRect(size: number, opening: Opening): [number, number, number, number] {
  if (opening.side === 'north') return [opening.at, 0, opening.width, SEAM_DEPTH];
  if (opening.side === 'south') return [opening.at, size - SEAM_DEPTH, opening.width, SEAM_DEPTH];
  if (opening.side === 'west') return [0, opening.at, SEAM_DEPTH, opening.width];
  return [size - SEAM_DEPTH, opening.at, SEAM_DEPTH, opening.width];
}

/**
 * Districts nobody can walk to from `from` by the plan's crossings (a river is
 * not a way across). A district reached only through a cave is still listed:
 * the plan says so on purpose or by mistake, and the author should know which.
 */
export function unreachableDistricts(plan: WorldPlan, from: string): string[] {
  const reached = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const here = queue.shift()!;
    for (const crossing of plan.crossings) {
      if (crossing.kind === 'river' || !crossing.between.includes(here)) continue;
      const there = crossing.between[crossing.between[0] === here ? 1 : 0];
      if (!reached.has(there)) {
        reached.add(there);
        queue.push(there);
      }
    }
  }
  return plan.districts.map((district) => district.id).filter((id) => !reached.has(id));
}
