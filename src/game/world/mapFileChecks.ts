import { linkTable, type GridLinks, type GridPosition } from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { RAID_DURATION_MS } from '../run/raidClock';
import { HUNTER_SPAWN_DISTANCE } from './hunter';
import {
  composeMapFile,
  doorwayOf,
  STAIRS_SIZE,
  stairsAt,
  stairsToward,
  type ComposedMap,
} from './mapAreas';
import {
  doorFront,
  fileDoorGates,
  readMapFile,
  type MapFile,
  type MapFileArea,
  type MapFileBuilding,
  type MapFileDoorwayLook,
  type MapFileLinkEnd,
  type MapFileSpot,
} from './mapFile';
import { MATERIAL_CHARS } from './tileset/materials';
import { gateKey } from './gates';
import { isBlockedAt, stepDistances, type CollisionGrid } from './mapStructure';
import { pokemonName } from './pokemonFigures';
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
 * Townsfolk, signs and standing Pokemon are walls you cannot walk into, so
 * every walk below is measured with them standing where they were put: a
 * person in the only lane to an exit is a raid with no way out, which is the
 * trap a figure on a door once sprang on the captain. A trainer is walked
 * into - that is the fight - so a trainer never shuts a walk; what one may not
 * do is watch a drop-in or an exit, because a fight forced on the first step
 * or the last is a raid nobody chose.
 */

export type MapCheckId =
  | 'loads'
  | 'standing'
  | 'apart'
  | 'doors'
  | 'way-out'
  | 'reachable'
  | 'areas'
  | 'hunter-room'
  | 'watch'
  | 'words';

export interface MapCheck {
  readonly id: MapCheckId;
  /** What the check asks, as a maker reads it. */
  readonly label: string;
  readonly passed: boolean;
  /** Why it failed, naming the places at fault; empty when it passed. */
  readonly problems: readonly string[];
}

/** What each way through is called in a problem with it. */
const DOORWAY_NAMES: Readonly<Record<MapFileDoorwayLook, string>> = {
  door: 'door',
  mat: 'way out',
  'stairs-up': 'stairs',
  'stairs-down': 'stairs',
  'cave-exit': 'way out',
  'ladder-up': 'ladder up',
  'ladder-down': 'ladder down',
};

/** The ways through a cave has, and nothing else does. */
const CAVE_LOOKS: readonly MapFileDoorwayLook[] = ['cave-exit', 'ladder-up', 'ladder-down'];

const LABELS: Readonly<Record<MapCheckId, string>> = {
  loads: 'The game can load it',
  standing: 'Everything stands on ground you can walk on',
  apart: 'No two things share a tile',
  doors: 'Every door leads somewhere you can stand',
  'way-out': 'Every drop-in can walk out before the clock runs out',
  reachable: 'Every exit and item spot can be walked to',
  areas: 'Every inside and cave can be walked into',
  'hunter-room': 'The hunter has room to arrive near every drop-in',
  watch: 'No trainer watches a drop-in or an exit',
  words: 'Every name and line is fit for everyone',
};

const at = ({ x, y }: GridPosition): string => `${x},${y}`;

/**
 * The grid a file map is played on - its own drawing, every inside laid out
 * beside it, through the game's own builder - and the ways through it, with
 * its Cut trees and Surf water shut, as a fresh save meets them, or, asked
 * for, opened.
 */
export function mapFileGrid(
  file: MapFile,
  doorsOpen = false,
): {
  readonly composed: ComposedMap;
  readonly collision: CollisionGrid;
  readonly links: GridLinks;
} {
  const composed = composeMapFile(file, doorsOpen ? fileDoorGates(file).map(gateKey) : []);
  return {
    composed,
    collision: composed.layers.collision,
    links: linkTable(composed.doorways, composed.width),
  };
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
    (Object.keys(LABELS) as MapCheckId[])
      .filter((id) => id !== 'doors' && id !== 'areas')
      .map((id) => (id === 'loads' ? check(id, problems) : { ...check(id, []), passed: false }));
  const reading = readMapFile(value);
  if (!reading.ok) {
    return unloadable(reading.problems);
  }
  const file = reading.file;
  // The shape check is meant to refuse anything the game cannot draw, but the
  // checks are asked of every map in the editor, the review queue and the
  // publish run: a file that slipped past it must fail here, not throw, or one
  // bad map bricks every screen that opens it.
  let grid: ReturnType<typeof mapFileGrid>;
  let openCollision: CollisionGrid;
  try {
    grid = mapFileGrid(file);
    openCollision = mapFileGrid(file, true).collision;
  } catch (error) {
    return unloadable([
      `The game cannot draw it: ${error instanceof Error ? error.message : String(error)}.`,
    ]);
  }
  const { composed, collision, links } = grid;
  // Everything in the file is placed in its own area's tiles, and measured on
  // the one grid every area is laid out in. A problem names the tile as the
  // maker placed it, and the area it is in.
  const origins = new Map(composed.areas.map((placed) => [placed.id, placed]));
  const onGrid = (spot: MapFileSpot): GridPosition => {
    const origin = origins.get(spot.area)?.rect ?? composed.areas[0].rect;
    return { x: origin.x + spot.x, y: origin.y + spot.y };
  };
  const tileOf = (spot: MapFileSpot): string => {
    const area = spot.area === undefined ? undefined : origins.get(spot.area);
    return area ? `${at(spot)} in ${area.name}` : at(spot);
  };
  const walkable = (spot: MapFileSpot): boolean => {
    const tile = onGrid(spot);
    return !isBlockedAt(collision, tile.x, tile.y);
  };
  const people = file.people ?? [];
  const signs = file.signs ?? [];
  const landmarks = file.landmarks ?? [];
  const trainers = file.trainers ?? [];
  const pokemon = file.pokemon ?? [];
  const named = [
    ...file.dropIns.map((spot) => ({ spot, what: `Drop-in ${spot.name}` })),
    ...file.exits.map((spot) => ({ spot, what: `Exit ${spot.name}` })),
    ...file.itemSpots.map((spot, index) => ({ spot, what: `Item spot ${index + 1}` })),
    ...landmarks.map((spot) => ({ spot, what: `Landmark ${spot.name}` })),
    ...people.map((spot) => ({ spot, what: `${spot.name}` })),
    ...signs.map((spot, index) => ({ spot, what: `Sign ${index + 1}` })),
    ...trainers.map((spot) => ({ spot, what: `Trainer ${spot.name}` })),
    ...pokemon.map((spot) => ({ spot, what: pokemonName(spot.species) })),
  ];

  const standing = named
    .filter(({ spot }) => !walkable(spot))
    .map(({ spot, what }) => `${what} at ${tileOf(spot)} is on something solid.`);

  // Where each way through is stood on, named by what it goes through.
  const fileLinks = file.links ?? [];
  const areaName = (end: MapFileLinkEnd): string =>
    end.area === undefined ? 'outside' : (origins.get(end.area)?.name ?? end.area);
  const areaOf = (end: MapFileLinkEnd): MapFileArea | undefined =>
    end.area === undefined ? undefined : file.areas?.find((area) => area.id === end.area);
  /** The building whose door a way through outdoors is stood in front of. */
  const buildingAt = (end: MapFileLinkEnd): MapFileBuilding | undefined =>
    end.area === undefined
      ? file.buildings.find((candidate) => {
          const front = doorFront(candidate);
          return front !== undefined && front.x === end.x && front.y === end.y;
        })
      : undefined;
  const doorwayName = (end: MapFileLinkEnd, other: MapFileLinkEnd): string => {
    const named =
      end.look === 'door' && buildingAt(end)?.kind === 'cave-mouth'
        ? 'cave mouth'
        : DOORWAY_NAMES[end.look];
    return `The ${named} at ${tileOf(end)} to ${areaName(other)}`;
  };
  const landings = fileLinks.flatMap((link) => [
    { spot: link.ends[0], what: doorwayName(link.ends[0], link.ends[1]) },
    { spot: link.ends[1], what: doorwayName(link.ends[1], link.ends[0]) },
  ]);

  const holders = new Map<string, { tile: string; whats: string[] }>();
  for (const { spot, what } of [...named, ...landings]) {
    const key = at(onGrid(spot));
    const holding = holders.get(key) ?? { tile: tileOf(spot), whats: [] };
    holding.whats.push(what);
    holders.set(key, holding);
  }
  const apart = [...holders.values()]
    .filter(({ whats }) => whats.length > 1)
    .map(({ tile, whats }) => `${whats.join(' and ')} share the tile ${tile}.`);

  const doors = fileLinks.flatMap((link) =>
    link.ends.flatMap((end, index) => {
      const other = link.ends[1 - index];
      const what = doorwayName(end, other);
      const found: string[] = [];
      if (!walkable(end)) {
        found.push(`${what} is on something solid.`);
      }
      const area = areaOf(end);
      const kind = area?.kind;
      const ground = (x: number, y: number): string | undefined => area?.ground[y]?.[x];
      const doorway = doorwayOf(end);
      if (end.look === 'door') {
        const building = buildingAt(end);
        if (!building || end.toward !== 'up') {
          found.push(`${what} is not in front of a building's door.`);
        } else if (building.kind === 'cave-mouth') {
          // FireRed cuts a cave's mouth into the foot of a rock face.
          const rock = (x: number, y: number): boolean => file.ground[y]?.[x] === MATERIAL_CHARS.cliff;
          if (
            !rock(building.x, building.y) ||
            !rock(building.x - 1, building.y) ||
            !rock(building.x + 1, building.y) ||
            !rock(building.x, building.y - 1)
          ) {
            found.push(`${what} has to be cut into the foot of a rock face, with rock either side of it and above it.`);
          }
          if (areaOf(other)?.kind !== 'cave') {
            found.push(`${what} has to lead into a cave.`);
          }
        } else if (areaOf(other)?.kind !== 'inside') {
          found.push(`${what} has to lead into the inside of a building.`);
        }
      } else if (CAVE_LOOKS.includes(end.look) && kind !== 'cave') {
        found.push(`${what} belongs in a cave.`);
      } else if (!CAVE_LOOKS.includes(end.look) && kind === 'cave') {
        found.push(`${what} belongs in a building: a cave's way out is cut into its south wall.`);
      } else if (end.look === 'cave-exit') {
        // Daylight in a notch of the south wall, with rock either side of it.
        const wall = (x: number): boolean => ground(x, doorway.y) === MATERIAL_CHARS.wall;
        if (end.toward !== 'down' || !wall(doorway.x) || !wall(doorway.x - 1) || !wall(doorway.x + 1)) {
          found.push(`${what} has to be cut into the cave's south wall, with rock either side of it.`);
        }
      } else if (end.look === 'ladder-up') {
        if (end.toward !== 'up' || ground(end.x, end.y - 1) === undefined) {
          found.push(`${what} needs a tile above it for the ladder.`);
        }
      } else if (end.look === 'ladder-down') {
        const under = ground(doorway.x, doorway.y);
        if (under === undefined || under === MATERIAL_CHARS.wall) {
          found.push(`${what} has to have floor for its hole, the way it faces.`);
        }
      } else if (end.look === 'stairs-up' || end.look === 'stairs-down') {
        // A staircase stands against the back wall of a room: the row above
        // its top is wall, and all of it is on the room.
        const top = stairsAt(end);
        const fits =
          area !== undefined &&
          end.toward === stairsToward(end.look) &&
          top.x >= 0 &&
          top.y >= 1 &&
          top.x + STAIRS_SIZE.width <= area.width &&
          end.y + 1 < area.height &&
          [...area.ground[top.y - 1].slice(top.x, top.x + STAIRS_SIZE.width)].every(
            (letter) => letter === 'B',
          );
        if (!fits) {
          found.push(`${what} has to stand against the back wall of the room.`);
        }
      } else {
        const againstTheEdge =
          area !== undefined &&
          (doorway.x < 0 ||
            doorway.y < 0 ||
            doorway.x >= area.width ||
            doorway.y >= area.height ||
            area.ground[doorway.y]?.[doorway.x] === 'B');
        if (!againstTheEdge) {
          found.push(`${what} has to be against the room's wall, stepped off the way it faces.`);
        }
      }
      return found;
    }),
  );
  // A cave mouth is a way in or it is a hole in a hill that goes nowhere.
  for (const building of file.buildings) {
    const front = doorFront(building);
    if (
      building.kind === 'cave-mouth' &&
      front &&
      !fileLinks.some((link) =>
        link.ends.some((end) => end.area === undefined && end.x === front.x && end.y === front.y),
      )
    ) {
      doors.push(`The cave mouth at ${at(building)} leads nowhere: make its cave, or take it away.`);
    }
  }

  // Every walk is measured with every exit but the one being walked to shut,
  // because an open exit takes whoever steps on it: a way out that is only
  // reached across another exit is not a way out, it is that exit.
  const exitTiles = new Set(file.exits.map((exit) => at(onGrid(exit))));
  const figureTiles = [...people, ...signs, ...pokemon].map((spot) => at(onGrid(spot)));
  const shut = new Set([...exitTiles, ...figureTiles]);
  // A raid has to be leavable by a player who brought no Pokemon that knows Cut
  // or Surf, so the way out is walked with every door shut; what is behind a
  // door is still somewhere a map is for, so reaching it is walked with them open.
  const fromDropIn = file.dropIns.map((dropIn) => ({
    dropIn,
    steps: stepDistances(collision, onGrid(dropIn), shut, links),
    opened: stepDistances(openCollision, onGrid(dropIn), shut, links),
  }));
  const stepsTo = (steps: readonly Int32Array[], placed: MapFileSpot): number => {
    const spot = onGrid(placed);
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
    .filter(({ spot }) => fromDropIn.every(({ opened }) => stepsTo(opened, spot) < 0))
    .map(({ spot, what }) => `${what} at ${tileOf(spot)} cannot be walked to from any drop-in.`);

  // An inside is walked into when any tile of it can be walked to. Drop-ins
  // that cannot leave are already a problem above, so a map with none says
  // nothing here.
  const areas =
    file.dropIns.length === 0
      ? []
      : composed.areas.slice(1).flatMap((placed) => {
          const { rect } = placed;
          const reached = fromDropIn.some(({ opened: steps }) => {
            for (let y = rect.y; y < rect.y + rect.height; y += 1) {
              for (let x = rect.x; x < rect.x + rect.width; x += 1) {
                if ((steps[y]?.[x] ?? -1) >= 0) {
                  return true;
                }
              }
            }
            return false;
          });
          return reached ? [] : [`${placed.name} cannot be walked into from any drop-in.`];
        });

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

  const ends = new Set([...file.dropIns, ...file.exits].map((spot) => at(onGrid(spot))));
  const watch = trainers.flatMap((trainer) => {
    const seen = trainerSightTiles(
      { position: onGrid(trainer), facing: trainer.facing, sightRange: trainer.sight },
      (tile) => isBlockedAt(collision, tile.x, tile.y),
    );
    return seen.some((tile) => ends.has(at(tile)))
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
    ...(file.areas ?? []).map((area) => ({ what: `The inside ${area.name}`, text: area.name })),
  ];
  const words = said
    .filter(({ text }) => refusedWords(text).length > 0)
    .map(({ what }) => `${what} says something the game will not show. Reword it.`);

  // The two checks about insides are only asked of a map that has one: a
  // tick against "every door leads somewhere" on a map with no doors says
  // nothing, and every line on that list is one a maker reads.
  const hasInsides =
    (file.areas ?? []).length > 0 ||
    fileLinks.length > 0 ||
    file.buildings.some((building) => building.kind === 'cave-mouth');
  return [
    check('loads', []),
    check('standing', standing),
    check('apart', apart),
    ...(hasInsides ? [check('doors', doors)] : []),
    check('way-out', wayOut),
    check('reachable', reachable),
    ...(hasInsides ? [check('areas', areas)] : []),
    check('hunter-room', hunterRoom),
    check('watch', watch),
    check('words', [...new Set(words)]),
  ];
}

/** Whether every check passed. */
export function mapFileWorks(value: unknown): boolean {
  return checkMapFile(value).every((check) => check.passed);
}
