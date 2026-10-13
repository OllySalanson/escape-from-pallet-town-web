/**
 * The hard checks: what a map has to pass before anybody looks at it.
 *
 * First the game's own ten (`checkMapFile`, the same ones the map maker shows
 * and the publish workflow runs), then three a drawn district can fail that a
 * hand-drawn map rarely does:
 *
 * - **whole trees**: every 2x2 lattice cell of wood is whole, so no stray bush
 *   is left where a tree was half drawn (`MapProgram.compile` makes this true;
 *   a hand edit can break it);
 * - **one piece**: every tile somebody could stand on can be walked to from the
 *   first drop-in, so there is no walled-off lawn drawn for nothing;
 * - **walking rules**: what the district's brief promises, in steps - "the way
 *   up from the foot exists", "down by the ledges is at least six steps
 *   quicker than walking" - written beside the program that has to keep them.
 */
import { checkMapFile } from '../../src/game/world/mapFileChecks';
import type { MapFile, MapFileLimits } from '../../src/game/world/mapFile';
import { readTiles, walkable, walkingSteps, type TileMap, type TileRect } from './tiles';
import type { Point } from './program';

export interface HardCheck {
  readonly id: string;
  readonly label: string;
  readonly passed: boolean;
  readonly problems: readonly string[];
}

/** A promise a district's brief makes, measured in walking steps on the outdoor ground. */
export type WalkRule =
  | {
      /** `to` can be walked to from `from` (hopping ledges where the game would). */
      readonly kind: 'reach';
      readonly label: string;
      readonly from: Point;
      readonly to: Point;
    }
  | {
      /** Going from `from` to `to` by hopping ledges is at least `by` steps quicker than on foot alone. */
      readonly kind: 'shortcut';
      readonly label: string;
      readonly from: Point;
      readonly to: Point;
      readonly by: number;
    };

export interface WalkMeasure {
  /** Steps from `from` to `to` hopping ledges; -1 when it cannot be done. */
  readonly withHops: number;
  /** Steps on foot without a single hop; -1 when it cannot be done. */
  readonly onFoot: number;
}

export function walk(map: TileMap, from: Point, to: Point): WalkMeasure {
  return {
    withHops: walkingSteps(map, from, { hops: true })[to[1]]?.[to[0]] ?? -1,
    onFoot: walkingSteps(map, from)[to[1]]?.[to[0]] ?? -1,
  };
}

export interface HardCheckOptions {
  readonly rules?: readonly WalkRule[];
  /**
   * Where the trees are the program's own. Ground copied from a shipped map
   * keeps that map's deliberate bushes off the lattice, so a district drawn
   * under a town asks this of its own rows only.
   */
  readonly trees?: TileRect;
  /** What the file may hold: a player's map's limits unless it is the game's own (`planLimits`). */
  readonly limits?: MapFileLimits;
}

export function hardChecks(
  file: MapFile,
  { rules = [], trees, limits }: HardCheckOptions = {},
): HardCheck[] {
  const game = checkMapFile(file, { limits }).map((check) => ({
    id: `game:${check.id}`,
    label: `Game: ${check.label}`,
    passed: check.passed,
    problems: check.problems,
  }));
  if (!game[0].passed) return game;
  const map = readTiles(file);
  return [
    ...game,
    wholeTrees(file, trees),
    onePiece(file, map),
    ...rules.map((rule) => walkRule(map, rule)),
  ];
}

export function allPassed(checks: readonly HardCheck[]): boolean {
  return checks.every((check) => check.passed);
}

function wholeTrees(
  file: MapFile,
  area: TileRect = { x: 0, y: 0, width: file.width, height: file.height },
): HardCheck {
  const problems: string[] = [];
  // The lattice is the map's own, so a cell starts on an even tile whatever the area.
  for (let y = area.y - (area.y % 2); y < area.y + area.height; y += 2) {
    for (let x = area.x - (area.x % 2); x < area.x + area.width; x += 2) {
      const cell = [
        file.ground[y]?.[x],
        file.ground[y]?.[x + 1],
        file.ground[y + 1]?.[x],
        file.ground[y + 1]?.[x + 1],
      ].filter((letter) => letter !== undefined);
      const trees = cell.filter((letter) => letter === 'T').length;
      if (trees > 0 && trees < cell.length)
        problems.push(`The trees at ${x},${y} are a part of a tree: it will draw as a bush.`);
    }
  }
  return {
    id: 'whole-trees',
    label: 'Every tree is whole',
    passed: problems.length === 0,
    problems: problems.slice(0, 8),
  };
}

/**
 * Every open tile outdoors can be walked to from a drop-in - on foot, over a
 * ledge, through a door or a cave, or across the sea by boat (a sailing is a
 * link with both ends outdoors): ground reached only through the
 * Greystone Caves (Stormcrown, whose one way in is the deepest floor's mouth)
 * is ground a raid can walk to. A place behind a door is taken as one room,
 * every way through it reaching every other: whether its own floor joins them
 * is the game's check (`checkMapFile`), which walks inside it. A rock barrier
 * counts as lifted, so the Lost Garden behind the Falls Cave counts as reached:
 * whether a floor of switches can be solved is its own check (`puzzle.ts`).
 */
function onePiece(file: MapFile, map: TileMap): HardCheck {
  const reached = map.kinds.map(() => new Uint8Array(map.width));
  const walkFrom = (x: number, y: number) => {
    const steps = walkingSteps(map, [x, y], { hops: true });
    for (let j = 0; j < map.height; j += 1)
      for (let i = 0; i < map.width; i += 1) if (steps[j][i] !== -1) reached[j][i] = 1;
  };
  for (const dropIn of file.dropIns.filter((candidate) => candidate.area === undefined))
    walkFrom(dropIn.x, dropIn.y);
  const places = new Set<string>();
  for (let grew = true; grew; ) {
    grew = false;
    for (const link of file.links ?? []) {
      const [a, b] = link.ends;
      const isIn = (end: typeof a) =>
        end.area === undefined ? reached[end.y]?.[end.x] === 1 : places.has(end.area);
      if (!isIn(a) && !isIn(b)) continue;
      for (const end of [a, b]) {
        if (isIn(end)) continue;
        grew = true;
        if (end.area === undefined) walkFrom(end.x, end.y);
        else places.add(end.area);
      }
    }
  }
  const cut: string[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (walkable(map, x, y) && reached[y][x] === 0) cut.push(`${x},${y}`);
    }
  }
  return {
    id: 'one-piece',
    label: 'Every open tile can be walked to',
    passed: cut.length === 0,
    problems:
      cut.length === 0
        ? []
        : [
            `${cut.length} open tiles cannot be walked to from a drop-in, first at ${cut.slice(0, 4).join('; ')}.`,
          ],
  };
}

function walkRule(map: TileMap, rule: WalkRule): HardCheck {
  const { withHops, onFoot } = walk(map, rule.from, rule.to);
  if (rule.kind === 'reach') {
    return {
      id: `rule:${rule.label}`,
      label: rule.label,
      passed: withHops !== -1,
      problems: withHops === -1 ? [`${rule.to} cannot be walked to from ${rule.from}.`] : [],
    };
  }
  const passed = withHops !== -1 && (onFoot === -1 || withHops + rule.by <= onFoot);
  return {
    id: `rule:${rule.label}`,
    label: rule.label,
    passed,
    problems: passed
      ? []
      : [
          `By the ledges it is ${withHops} steps and on foot ${onFoot}: the ledges should save at least ${rule.by}.`,
        ],
  };
}
