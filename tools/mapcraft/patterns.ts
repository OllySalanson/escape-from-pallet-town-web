/**
 * The pattern language as checks: what human mappers do, asked of a map.
 *
 * Every check here is advice, never a gate - the only gate on a map is whether
 * it works (`checks.ts`, and the game's own `checkMapFile`), the rule the
 * captain set for every map on 2026-10-03. Advice is what an author reads
 * before the look-and-fix round, so each one names the move, the number, what
 * FireRed's routes do and what to change.
 *
 * The moves and their sources are in `README.md` ("The pattern language"):
 * PokeCommunity and Eevee Expo mapping tutorials, Game Freak's own Gold/Silver
 * drafts against the shipped maps, The Level Design Book, and the measures in
 * `measures.ts` taken on 23 FireRed routes. Two moves no code can check are left
 * to the author and the judges: one idea per route, and something worth seeing
 * on every screen.
 */
import type { MapFile, MapFileSpot } from '../../src/game/world/mapFile';
import { ledgeRuns, measureTileMap, type DesignMoves } from './measures';
import {
  readTiles,
  regions,
  STEPS,
  walkable,
  walkingSteps,
  type TileMap,
  type TileRect,
} from './tiles';

/**
 * Medians over the 23 FireRed routes in pret/pokefirered (037335f), measured
 * by `measures.ts` in round 3 of the map research (2026-10-12). Individual
 * routes vary a lot - Route 9 has a two-tile border, Route 25 a seven-tile one -
 * which is why the checks below ask for a range, not the number.
 */
export const FIRERED_ROUTE_MEDIANS = {
  frameDepth: 5,
  roadShare: 0.37,
  tallShare: 0.11,
  plainShare: 0.42,
  beds: 2,
  bedSize: 39,
  /** Ledge pieces on FireRed's ledge routes run three to six tiles. */
  ledgeLen: 4,
  ledgeParallel: 0.6,
  clusterSize: 3,
  fenceRuns: 5,
  biggestQuiet: 0.19,
  eventsPer10: 2.4,
} as const;

export interface PatternAdvice {
  readonly id: string;
  /** The move, as the pattern language names it. */
  readonly move: string;
  /** True when the map already does what FireRed's mappers do. */
  readonly ok: boolean;
  /** What this map does, in words and numbers. */
  readonly found: string;
  /** What to change when it is not ok. */
  readonly advice: string;
}

/** Spots a road may end at: ways in and out, and anything else the author names. */
export interface PatternContext {
  readonly crop?: TileRect;
  /** Extra tiles a road may end at (a sign, a landmark), in the crop's tiles. */
  readonly destinations?: readonly MapFileSpot[];
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function patternAdvice(file: MapFile, context: PatternContext = {}): PatternAdvice[] {
  const map = readTiles(file, context.crop);
  const moves = measureTileMap(map);
  const shift = context.crop ?? { x: 0, y: 0 };
  const destinations = [...file.dropIns, ...file.exits, ...(context.destinations ?? [])]
    .filter((spot) => spot.area === undefined)
    .map((spot) => [spot.x - shift.x, spot.y - shift.y] as [number, number]);
  return [
    roadAdvice(moves),
    openGroundAdvice(moves),
    lawnAdvice(moves),
    ...ledgeAdvice(map, moves),
    borderAdvice(moves),
    fenceAdvice(moves),
    copseAdvice(moves),
    crumbAdvice(moves),
    repetitionAdvice(moves),
    pathEndAdvice(map, destinations),
  ];
}

function roadAdvice(moves: DesignMoves): PatternAdvice {
  const ok = moves.roadShare >= 0.25;
  return {
    id: 'road',
    move: 'A road you can see, that goes somewhere',
    ok,
    found: `road is ${percent(moves.roadShare)} of the walkable ground (FireRed routes: ${percent(FIRERED_ROUTE_MEDIANS.roadShare)})`,
    advice:
      'Lay a two-wide sand road where people walk: from each way in to each way out, along each shelf of a terrace.',
  };
}

function openGroundAdvice(moves: DesignMoves): PatternAdvice {
  const tooEmpty = moves.biggestQuiet > 0.3;
  const tooFull = moves.biggestQuiet < 0.1;
  return {
    id: 'open-ground',
    move: 'Restraint: open ground left on purpose',
    ok: !tooEmpty && !tooFull,
    found: `the biggest open patch is ${percent(moves.biggestQuiet)} of the walkable ground (FireRed: about ${percent(FIRERED_ROUTE_MEDIANS.biggestQuiet)})`,
    advice: tooEmpty
      ? 'One empty field dominates: shrink the map or break the field with a copse, a pond or a ledge line rather than sprinkling props.'
      : 'Every screen is filled: leave one patch of plain ground about a fifth of the walkable area. The AI-drawn routes that read as generated filled every gap.',
  };
}

function lawnAdvice(moves: DesignMoves): PatternAdvice {
  return {
    id: 'lawn',
    move: 'Small and full, not big and empty',
    ok: moves.plainShare <= 0.55,
    found: `plain lawn is ${percent(moves.plainShare)} of the walkable ground (FireRed: ${percent(FIRERED_ROUTE_MEDIANS.plainShare)})`,
    advice:
      'Too much of the ground is plain lawn: turn the walked lines into road, and give grass beds a place the walk has to cross.',
  };
}

function ledgeAdvice(map: TileMap, moves: DesignMoves): PatternAdvice[] {
  if (moves.ledges === 0) return [];
  const advice: PatternAdvice[] = [
    {
      id: 'short-ledges',
      move: 'Ledges are short pieces, not ruled lines',
      ok: moves.ledgeLen <= 7,
      found: `ledge pieces run ${moves.ledgeLen} tiles (median; FireRed: three to six)`,
      advice:
        'Break long ledges into pieces of three to six that end against a tree, a rock or a bush.',
    },
    {
      id: 'anchored-ledges',
      move: 'Every ledge ends against something',
      ok: (moves.ledgeAnchored ?? 1) >= 0.75,
      found: `${percent(moves.ledgeAnchored ?? 0)} of ledge pieces end against something solid at both ends`,
      advice:
        'A ledge end standing in open lawn reads as drawn: stop each piece on a tree, a rock, a bush, a fence or the map edge.',
    },
  ];
  if (moves.ledges >= 3) {
    advice.push({
      id: 'terraces',
      move: 'Ledges stack into terraces',
      ok: (moves.ledgeParallel ?? 0) >= 0.3,
      found: `${percent(moves.ledgeParallel ?? 0)} of ledge pieces sit above or below another of the same span (FireRed: ${percent(FIRERED_ROUTE_MEDIANS.ledgeParallel)})`,
      advice:
        'Line pieces up a few rows apart so the slope reads as steps, with the gaps staggered so the way up zigzags.',
    });
  }
  const idle = idleLedges(map);
  advice.push({
    id: 'ledge-jobs',
    move: 'A ledge needs a job, or it goes',
    ok: idle.length === 0,
    found:
      idle.length === 0
        ? 'every ledge saves a walk or makes a one-way drop'
        : `${idle.length} ledge piece${idle.length === 1 ? '' : 's'} save fewer than four steps: ${idle
            .slice(0, 4)
            .map((run) => `row ${run.y} x ${run.x0}-${run.x1}`)
            .join(', ')}`,
    advice:
      'A ledge that saves nothing is a wall that looks like a path. Game Freak cut its pointless ones (the shipped Ecruteak has "75% fewer ledges" than its draft): make each one the quick way back, or take it out.',
  });
  return advice;
}

/** Ledge pieces whose hop saves fewer than four steps over walking round. */
export function idleLedges(map: TileMap): { y: number; x0: number; x1: number }[] {
  return ledgeRuns(map).filter((run) => {
    const middle = Math.floor((run.x0 + run.x1) / 2);
    const brow: [number, number] = [middle, run.y - 1];
    const landing: [number, number] = [middle, run.y + 1];
    if (!walkable(map, ...brow) || !walkable(map, ...landing)) return false;
    const onFoot = walkingSteps(map, brow)[landing[1]][landing[0]];
    return onFoot !== -1 && onFoot - 1 < 4;
  });
}

function borderAdvice(moves: DesignMoves): PatternAdvice {
  return {
    id: 'border',
    move: 'A thick, ragged border',
    ok: moves.frameDepth >= 3,
    found: `the border runs ${moves.frameDepth} tiles deep (FireRed: ${FIRERED_ROUTE_MEDIANS.frameDepth}, often four to six)`,
    advice:
      'Thicken the wall along the map edge to four or more, step it in and out, and mix trees with rock and a fence run.',
  };
}

function fenceAdvice(moves: DesignMoves): PatternAdvice {
  return {
    id: 'fences',
    move: 'Fences are structure',
    ok: moves.fenceRuns >= 2,
    found: `${moves.fenceRuns} fence run${moves.fenceRuns === 1 ? '' : 's'} (FireRed: about ${FIRERED_ROUTE_MEDIANS.fenceRuns})`,
    advice:
      'Use fences to finish a ledge line, pen a garden or guide a road; they read as made by somebody.',
  };
}

function copseAdvice(moves: DesignMoves): PatternAdvice {
  return {
    id: 'unique-copses',
    move: 'Woods as masses; never the same copse twice',
    ok: moves.repeatedClusters === 0,
    found:
      moves.repeatedClusters === 0
        ? 'no copse shape repeats'
        : `${moves.repeatedClusters} copses share an exact shape with another`,
    advice:
      'A repeated clump is the clearest generator signature: change the outline of each repeat, or join it to the border.',
  };
}

function crumbAdvice(moves: DesignMoves): PatternAdvice {
  return {
    id: 'crumbs',
    move: 'Nothing stray',
    ok: moves.crumbsPer1000 <= 2,
    found: `${moves.crumbsPer1000} lone solid tiles per thousand`,
    advice:
      'Single trees or rocks alone in the open read as noise: join them to a group, or take them away.',
  };
}

function repetitionAdvice(moves: DesignMoves): PatternAdvice {
  return {
    id: 'repetition',
    move: 'Nothing ruled or stamped',
    ok: moves.repetition <= 0.15,
    found: `${percent(moves.repetition)} of 6x6 windows occur more than once`,
    advice: 'The same arrangement repeats: vary the spacing and shape of what was stamped.',
  };
}

function pathEndAdvice(
  map: TileMap,
  destinations: readonly (readonly [number, number])[],
): PatternAdvice {
  const dead = roadEnds(map).filter(([x, y]) => !endsAtSomething(map, x, y, destinations));
  return {
    id: 'path-ends',
    move: 'Paths go somewhere',
    ok: dead.length === 0,
    found:
      dead.length === 0
        ? 'every road ends at something'
        : `${dead.length} road end${dead.length === 1 ? ' stops' : 's stop'} in the open: ${dead
            .slice(0, 4)
            .map(([x, y]) => `${x},${y}`)
            .join('; ')}`,
    advice:
      'A road that stops in grass has no reason: end it at a door, a sign, a ledge, water, a way out or another road, or let it thin into grass.',
  };
}

/** The two far ends of each piece of road: where somebody walking it arrives. */
export function roadEnds(map: TileMap): [number, number][] {
  const ends: [number, number][] = [];
  for (const piece of regions(map, (kind) => kind === 'road')) {
    if (piece.length < 4) continue;
    const inPiece = new Set(piece.map(([x, y]) => `${x},${y}`));
    const farthest = (from: readonly [number, number]): [number, number] => {
      const seen = new Map([[`${from[0]},${from[1]}`, 0]]);
      const queue: [number, number][] = [[from[0], from[1]]];
      let last = queue[0];
      for (let head = 0; head < queue.length; head += 1) {
        const [x, y] = queue[head];
        last = [x, y];
        for (const [dx, dy] of STEPS) {
          const key = `${x + dx},${y + dy}`;
          if (inPiece.has(key) && !seen.has(key)) {
            seen.set(key, 0);
            queue.push([x + dx, y + dy]);
          }
        }
      }
      return last;
    };
    const one = farthest(piece[0]);
    ends.push(one, farthest(one));
  }
  return ends;
}

function endsAtSomething(
  map: TileMap,
  x: number,
  y: number,
  destinations: readonly (readonly [number, number])[],
): boolean {
  if (x <= 1 || y <= 1 || x >= map.width - 2 || y >= map.height - 2) return true;
  if (destinations.some(([dx, dy]) => Math.abs(dx - x) <= 2 && Math.abs(dy - y) <= 2)) return true;
  for (let j = -2; j <= 2; j += 1) {
    for (let i = -2; i <= 2; i += 1) {
      const kind = map.kinds[y + j]?.[x + i];
      if (kind === 'building' || kind === 'ledge' || kind === 'water' || kind === 'ford')
        return true;
    }
  }
  return false;
}
