import type { GridPosition } from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { RAID_DURATION_MS } from '../run/raidClock';
import { HUNTER_SPAWN_DISTANCE } from './hunter';
import { readMapFile, sketchMapFile, type MapFile } from './mapFile';
import { isBlockedAt, stepDistances, type CollisionGrid } from './mapStructure';
import { buildMapLayers } from './tiles';
import { KANTO_TILESET } from './tileset/kantoTileset';
import { trainerSightTiles } from './trainerSight';
import { refusedWords } from './wordFilter';

/**
 * Whether a map works - and nothing else.
 *
 * The captain's rule for player maps (2026-10-03, D2 and P3): no design rules,
 * only "does it work" checks. A map may be one open field or one long corridor;
 * what it may not be is a raid somebody cannot finish. Every check here is a
 * way a map can break a raid, said in the words a maker reads, and they are the
 * same checks whether the map is in the editor, in the review queue or being
 * published - so a map that passes in the editor is never refused later for a
 * reason nobody showed its maker.
 *
 * One of the plan's checks is not here because it is not a fact about the
 * file: that the maker walked it out in the editor's TRY IT. It joins the list
 * where that fact lives (`maker/makerView.ts`).
 *
 * Townsfolk and signs are walls you cannot walk into, so every walk below is
 * measured with them standing where they were put: a person in the only lane
 * to an exit is a raid with no way out, which is the trap a figure on a door
 * once sprang on the captain. A trainer is walked into - that is the fight -
 * so a trainer never shuts a walk; what one may not do is watch a drop-in or
 * an exit, because a fight forced on the first step or the last is a raid
 * nobody chose.
 */

export type MapCheckId =
  'loads' | 'standing' | 'apart' | 'way-out' | 'reachable' | 'hunter-room' | 'watch' | 'words';

export interface MapCheck {
  readonly id: MapCheckId;
  /** What the check asks, as a maker reads it. */
  readonly label: string;
  readonly passed: boolean;
  /** Why it failed, naming the places at fault; empty when it passed. */
  readonly problems: readonly string[];
}

const LABELS: Readonly<Record<MapCheckId, string>> = {
  loads: 'The game can load it',
  standing: 'Everything stands on ground you can walk on',
  apart: 'No two things share a tile',
  'way-out': 'Every drop-in can walk out before the clock runs out',
  reachable: 'Every exit and item spot can be walked to',
  'hunter-room': 'The hunter has room to arrive near every drop-in',
  watch: 'No trainer watches a drop-in or an exit',
  words: 'Every name and line is fit for everyone',
};

const at = ({ x, y }: GridPosition): string => `${x},${y}`;

/** The collision a file map is played on: its own drawing through the game's own builder. */
export function mapFileCollision(file: MapFile): CollisionGrid {
  return buildMapLayers(sketchMapFile(file), KANTO_TILESET).collision;
}

/**
 * Every check, in the order a maker fixes them. A file that does not load
 * cannot be asked anything else, so it answers the first check and fails the
 * rest with nothing to say about them.
 */
export function checkMapFile(value: unknown): readonly MapCheck[] {
  const check = (id: MapCheckId, problems: readonly string[]): MapCheck => ({
    id,
    label: LABELS[id],
    passed: problems.length === 0,
    problems,
  });
  const unloadable = (problems: readonly string[]): readonly MapCheck[] =>
    (Object.keys(LABELS) as MapCheckId[]).map((id) =>
      id === 'loads' ? check(id, problems) : { ...check(id, []), passed: false },
    );
  const reading = readMapFile(value);
  if (!reading.ok) {
    return unloadable(reading.problems);
  }
  const file = reading.file;
  // The shape check is meant to refuse anything the game cannot draw, but the
  // checks are asked of every map in the editor, the review queue and the
  // publish run: a file that slipped past it must fail here, not throw, or one
  // bad map bricks every screen that opens it.
  let collision: CollisionGrid;
  try {
    collision = mapFileCollision(file);
  } catch (error) {
    return unloadable([
      `The game cannot draw it: ${error instanceof Error ? error.message : String(error)}.`,
    ]);
  }
  const walkable = (spot: GridPosition): boolean => !isBlockedAt(collision, spot.x, spot.y);
  const people = file.people ?? [];
  const signs = file.signs ?? [];
  const landmarks = file.landmarks ?? [];
  const trainers = file.trainers ?? [];
  const named = [
    ...file.dropIns.map((spot) => ({ spot, what: `Drop-in ${spot.name}` })),
    ...file.exits.map((spot) => ({ spot, what: `Exit ${spot.name}` })),
    ...file.itemSpots.map((spot, index) => ({ spot, what: `Item spot ${index + 1}` })),
    ...landmarks.map((spot) => ({ spot, what: `Landmark ${spot.name}` })),
    ...people.map((spot) => ({ spot, what: `${spot.name}` })),
    ...signs.map((spot, index) => ({ spot, what: `Sign ${index + 1}` })),
    ...trainers.map((spot) => ({ spot, what: `Trainer ${spot.name}` })),
  ];

  const standing = named
    .filter(({ spot }) => !walkable(spot))
    .map(({ spot, what }) => `${what} at ${at(spot)} is on something solid.`);

  const holders = new Map<string, string[]>();
  for (const { spot, what } of named) {
    holders.set(at(spot), [...(holders.get(at(spot)) ?? []), what]);
  }
  const apart = [...holders]
    .filter(([, whats]) => whats.length > 1)
    .map(([tile, whats]) => `${whats.join(' and ')} share the tile ${tile}.`);

  // Every walk is measured with every exit but the one being walked to shut,
  // because an open exit takes whoever steps on it: a way out that is only
  // reached across another exit is not a way out, it is that exit.
  const exitTiles = new Set(file.exits.map(at));
  const figureTiles = [...people, ...signs].map(at);
  const shut = new Set([...exitTiles, ...figureTiles]);
  const fromDropIn = file.dropIns.map((dropIn) => ({
    dropIn,
    steps: stepDistances(collision, dropIn, shut),
  }));
  const stepsTo = (steps: readonly Int32Array[], spot: GridPosition): number => {
    // A spot is reached by reaching any walkable tile beside it, then one step.
    if (exitTiles.has(at(spot))) {
      const beside = [
        { x: spot.x + 1, y: spot.y },
        { x: spot.x - 1, y: spot.y },
        { x: spot.x, y: spot.y + 1 },
        { x: spot.x, y: spot.y - 1 },
      ]
        .map((tile) => steps[tile.y]?.[tile.x] ?? -1)
        .filter((distance) => distance >= 0);
      return beside.length > 0 ? Math.min(...beside) + 1 : -1;
    }
    return steps[spot.y]?.[spot.x] ?? -1;
  };

  const wayOut = fromDropIn.flatMap(({ dropIn, steps }) => {
    const best = Math.min(
      ...file.exits.map((exit) => {
        const walk = stepsTo(steps, exit);
        if (walk < 0) {
          return Infinity;
        }
        const opensAtMs = exit.opens.when === 'after' ? exit.opens.seconds * 1_000 : 0;
        return Math.max(walk * STEP_DURATION_MS, opensAtMs);
      }),
    );
    if (best === Infinity) {
      return [`Drop-in ${dropIn.name} cannot walk to any exit.`];
    }
    return best > RAID_DURATION_MS
      ? [`Drop-in ${dropIn.name} cannot reach an open exit in time.`]
      : [];
  });

  const reachable = [
    ...file.exits.map((spot) => ({ spot, what: `Exit ${spot.name}` })),
    ...file.itemSpots.map((spot, index) => ({ spot, what: `Item spot ${index + 1}` })),
    ...landmarks.map((spot) => ({ spot, what: `Landmark ${spot.name}` })),
  ]
    .filter(({ spot }) => walkable(spot))
    .filter(({ spot }) => fromDropIn.every(({ steps }) => stepsTo(steps, spot) < 0))
    .map(({ spot, what }) => `${what} at ${at(spot)} cannot be walked to from any drop-in.`);

  // The hunter arrives exactly this many steps from the player, never closer
  // (`findHunterSpawnTile`), so a drop-in with no ground that far out is a raid
  // the hunter can never join.
  const hunterRoom = fromDropIn
    .filter(({ dropIn }) => walkable(dropIn))
    .filter(({ steps }) => !steps.some((row) => row.includes(HUNTER_SPAWN_DISTANCE)))
    .map(
      ({ dropIn }) =>
        `Drop-in ${dropIn.name} has no ground ${HUNTER_SPAWN_DISTANCE} steps away for the hunter to arrive on.`,
    );

  const doors = new Set([...file.dropIns, ...file.exits].map(at));
  const watch = trainers.flatMap((trainer) => {
    const seen = trainerSightTiles(
      { position: trainer, facing: trainer.facing, sightRange: trainer.sight },
      (tile) => isBlockedAt(collision, tile.x, tile.y),
    );
    return seen.some((tile) => doors.has(at(tile)))
      ? [`Trainer ${trainer.name} can see a drop-in or an exit. Turn them, or watch less far.`]
      : [];
  });

  const said = [
    { what: "The map's name", text: file.name },
    { what: "The maker's name", text: file.maker },
    ...file.dropIns.flatMap((spot) => [
      { what: `Drop-in ${spot.name}`, text: spot.name },
      { what: `Drop-in ${spot.name}`, text: spot.description ?? '' },
    ]),
    ...file.exits.map((spot) => ({ what: `Exit ${spot.name}`, text: spot.name })),
    ...landmarks.map((spot) => ({ what: `Landmark ${spot.name}`, text: spot.name })),
    ...people.map((spot) => ({ what: spot.name, text: [spot.name, ...spot.lines].join(' ') })),
    ...signs.map((spot, index) => ({ what: `Sign ${index + 1}`, text: spot.lines.join(' ') })),
    ...trainers.map((spot) => ({
      what: `Trainer ${spot.name}`,
      text: [spot.name, ...spot.lines].join(' '),
    })),
    ...(file.districts ?? []).map((district) => ({
      what: `District ${district.name}`,
      text: district.name,
    })),
  ];
  const words = said
    .filter(({ text }) => refusedWords(text).length > 0)
    .map(({ what }) => `${what} says something the game will not show. Reword it.`);

  return [
    check('loads', []),
    check('standing', standing),
    check('apart', apart),
    check('way-out', wayOut),
    check('reachable', reachable),
    check('hunter-room', hunterRoom),
    check('watch', watch),
    check('words', [...new Set(words)]),
  ];
}

/** Whether every check passed. */
export function mapFileWorks(value: unknown): boolean {
  return checkMapFile(value).every((check) => check.passed);
}
