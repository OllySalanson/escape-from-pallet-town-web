import {
  BUILT_IN_MAP_FILE_LIMITS,
  beatSpots,
  buildPlayerMap,
  buildingDoorways,
  playerMapId,
  type MapFile,
  type MapFileSpot,
} from '../../../../src/game/world/mapFile';
import { registerPlayerMap, unregisterPlayerMap } from '../../../../src/game/world/playerMaps';
import { getWorldMap } from '../../../../src/game/worldMap';

/**
 * A district of the stitched vale walked two abreast (the captain, 11 Nov 2026:
 * "when you're walking around, there's just often things in your way, and it's
 * quite fiddly to get through places"). A walker two tiles wide - which is what
 * a street is - goes from where a player comes in over the stitched map's
 * collision, with every figure standing on every tile of its beat and signs,
 * berry trees, landmarks and trainers solid, because that is where a walker
 * meets them. `millbrook.test.ts` and `tanglewood.test.ts` ask it, each naming
 * its own starts and what is narrow on purpose.
 */
export interface DistrictWalk {
  /** Free to stand on for one walker: open ground with no figure, sign or tree on it. */
  readonly free: (x: number, y: number) => boolean;
  /** Steps single file from the starts, or -1. */
  readonly single: (x: number, y: number) => number;
  /** Steps to a tile walking two abreast, or -1: the nearest 2x2 block that covers it. */
  readonly twoAbreast: (x: number, y: number) => number;
  /** Steps to stand on a tile: two abreast all the way, or two abreast to beside it and one step in. */
  readonly toStand: (x: number, y: number) => number;
  /** Steps to face a thing that stands on its tile: to stand beside it. */
  readonly toFace: (x: number, y: number) => number;
  /** Everything a player walks to, with how far it is two abreast (-1: a pair cannot get there). */
  readonly places: () => readonly WalkedPlace[];
  /**
   * The ways out and doors that are further two abreast than single file, in
   * words - or, given the same district walked bare (`bareDistrict`), further
   * than a pair walks it with nothing standing in it.
   */
  readonly longerTwoAbreast: (than?: DistrictWalk) => readonly string[];
  /** Tiles of the given ground letters that are not free, off the district's rim. */
  readonly blockedOn: (
    letters: string,
    except?: (x: number, y: number) => boolean,
  ) => readonly string[];
}

export interface WalkedPlace {
  readonly name: string;
  readonly steps: number;
  readonly x: number;
  readonly y: number;
}

const SIZE = 64;
const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const CORNERS = [
  [0, 0],
  [-1, 0],
  [0, -1],
  [-1, -1],
] as const;
const OUTDOORS = (spot: { readonly area?: string }) => spot.area === undefined;
const outdoors = <T extends { readonly area?: string }>(spots: readonly T[] | undefined): T[] =>
  (spots ?? []).filter(OUTDOORS);

/** What is solid in a district of the stitched vale, in the district's own tiles. */
export function valeSolid(
  origin: MapFileSpot,
  opened: readonly string[] = [],
): (x: number, y: number) => boolean {
  const map = getWorldMap('greystone-vale', opened);
  return (x, y) => map.collision[origin.y + y][origin.x + x];
}

export function walkDistrict(
  file: MapFile,
  solid: (x: number, y: number) => boolean,
  starts: readonly MapFileSpot[],
): DistrictWalk {
  const held = new Set<string>();
  for (const figure of [...outdoors(file.people), ...outdoors(file.pokemon)]) {
    for (const spot of [figure, ...beatSpots(figure)]) held.add(`${spot.x},${spot.y}`);
  }
  for (const thing of [
    ...outdoors(file.trainers),
    ...outdoors(file.signs),
    ...outdoors(file.berryTrees),
    ...outdoors(file.landmarks),
  ]) {
    held.add(`${thing.x},${thing.y}`);
  }
  const free = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < SIZE && y < SIZE && !solid(x, y) && !held.has(`${x},${y}`);
  const walk = (
    fits: (x: number, y: number) => boolean,
    from: readonly (readonly [number, number])[],
  ) => {
    const steps = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(-1));
    const queue = from.filter(([x, y]) => fits(x, y)).map(([x, y]) => [x, y] as [number, number]);
    for (const [x, y] of queue) steps[y][x] = 0;
    for (let k = 0; k < queue.length; k += 1) {
      const [x, y] = queue[k];
      for (const [dx, dy] of STEPS) {
        if (fits(x + dx, y + dy) && steps[y + dy][x + dx] < 0) {
          steps[y + dy][x + dx] = steps[y][x] + 1;
          queue.push([x + dx, y + dy]);
        }
      }
    }
    return steps;
  };
  /** A pair walking side by side: the 2x2 block whose top-left is (x, y), all of it free. */
  const pair = (x: number, y: number) =>
    free(x, y) && free(x + 1, y) && free(x, y + 1) && free(x + 1, y + 1);
  const singleSteps = walk(
    free,
    starts.map((start) => [start.x, start.y] as const),
  );
  const abreast = walk(
    pair,
    starts.flatMap((start) => CORNERS.map(([ox, oy]) => [start.x + ox, start.y + oy] as const)),
  );
  const single = (x: number, y: number) => singleSteps[y]?.[x] ?? -1;
  const twoAbreast = (x: number, y: number): number => {
    const reached = CORNERS.map(([ox, oy]) => abreast[y + oy]?.[x + ox] ?? -1).filter(
      (steps) => steps >= 0,
    );
    return reached.length > 0 ? Math.min(...reached) : -1;
  };
  const toStand = (x: number, y: number): number => {
    if (!free(x, y)) return -1;
    const reached = [
      twoAbreast(x, y),
      ...STEPS.filter(([dx, dy]) => free(x + dx, y + dy) && twoAbreast(x + dx, y + dy) >= 0).map(
        ([dx, dy]) => twoAbreast(x + dx, y + dy) + 1,
      ),
    ].filter((steps) => steps >= 0);
    return reached.length > 0 ? Math.min(...reached) : -1;
  };
  const toFace = (x: number, y: number): number => {
    const reached = STEPS.map(([dx, dy]) => toStand(x + dx, y + dy)).filter((steps) => steps >= 0);
    return reached.length > 0 ? Math.min(...reached) : -1;
  };
  const doors = () =>
    outdoors(file.buildings).flatMap((building) =>
      buildingDoorways(building).map((door) => ({
        name: `the door of the ${building.kind} at ${building.x},${building.y}`,
        x: door.x,
        y: door.y,
      })),
    );
  const places = (): WalkedPlace[] => {
    const named: WalkedPlace[] = [];
    const add = (name: string, x: number, y: number, steps: number) =>
      named.push({ name, steps, x, y });
    for (const exit of outdoors(file.exits))
      add(`the way out ${exit.name}`, exit.x, exit.y, toStand(exit.x, exit.y));
    for (const door of doors()) {
      // A shed searched at its door is a landmark on the doorstep: faced, not stood on.
      const searched = outdoors(file.landmarks).some(
        (landmark) => landmark.x === door.x && landmark.y === door.y,
      );
      add(door.name, door.x, door.y, searched ? toFace(door.x, door.y) : toStand(door.x, door.y));
    }
    for (const sign of outdoors(file.signs))
      add(`the sign ${sign.lines[0]}`, sign.x, sign.y, toFace(sign.x, sign.y));
    for (const landmark of outdoors(file.landmarks))
      add(landmark.name, landmark.x, landmark.y, toFace(landmark.x, landmark.y));
    for (const tree of outdoors(file.berryTrees))
      add(`the ${tree.berry} tree`, tree.x, tree.y, toFace(tree.x, tree.y));
    for (const person of outdoors(file.people))
      add(person.name, person.x, person.y, toFace(person.x, person.y));
    for (const trainer of outdoors(file.trainers))
      add(trainer.name, trainer.x, trainer.y, toFace(trainer.x, trainer.y));
    for (const spot of outdoors(file.itemSpots))
      add(`the find at ${spot.x},${spot.y}`, spot.x, spot.y, toStand(spot.x, spot.y));
    return named;
  };
  const longerTwoAbreast = (than?: DistrictWalk) => {
    // Longer two abreast is a prop or a figure narrowing the shortest way to one tile.
    const [measure, words] = than
      ? [than.toStand, 'with nothing in the way']
      : [single, 'single file'];
    return [
      ...outdoors(file.exits).map((exit) => ({ name: exit.name, x: exit.x, y: exit.y })),
      ...doors(),
    ]
      .filter(({ x, y }) => free(x, y) && measure(x, y) >= 0)
      .filter(({ x, y }) => toStand(x, y) > measure(x, y))
      .map(
        ({ name, x, y }) =>
          `${name}: ${toStand(x, y)} steps two abreast, ${measure(x, y)} ${words}`,
      );
  };
  const blockedOn = (letters: string, except: (x: number, y: number) => boolean = () => false) => {
    const blocked: string[] = [];
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const rim = x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1;
        if (!rim && letters.includes(file.ground[y][x]) && !free(x, y) && !except(x, y))
          blocked.push(`${x},${y}`);
      }
    }
    return blocked;
  };
  return { free, single, twoAbreast, toStand, toFace, places, longerTwoAbreast, blockedOn };
}

/**
 * The district with nothing standing in it - no figure, sign, berry tree,
 * landmark, prop or broadleaf, only the ground, the wood and the buildings with
 * doors - and what is solid there. A pair walks a winding wood further than one
 * walker does, a step for every time its lanes double back, so in a maze the
 * fair measure of a prop or a figure in the way is the same pair walking the
 * same lanes bare.
 */
export function bareDistrict(file: MapFile): {
  readonly file: MapFile;
  readonly solid: (x: number, y: number) => boolean;
} {
  const bare: MapFile = {
    ...file,
    buildings: (file.buildings ?? []).filter(
      (building) => building.area !== undefined || buildingDoorways(building).length > 0,
    ),
    people: (file.people ?? []).filter((person) => person.area !== undefined),
    pokemon: (file.pokemon ?? []).filter((pokemon) => pokemon.area !== undefined),
    trainers: (file.trainers ?? []).filter((trainer) => trainer.area !== undefined),
    signs: (file.signs ?? []).filter((sign) => sign.area !== undefined),
    berryTrees: (file.berryTrees ?? []).filter((tree) => tree.area !== undefined),
    landmarks: (file.landmarks ?? []).filter((landmark) => landmark.area !== undefined),
  };
  const map = buildPlayerMap(bare, BUILT_IN_MAP_FILE_LIMITS);
  registerPlayerMap(map);
  try {
    const { collision } = getWorldMap(playerMapId(bare));
    return { file: bare, solid: (x, y) => collision[y][x] };
  } finally {
    unregisterPlayerMap(map.id);
  }
}
