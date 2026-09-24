import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import {
  getWorldMap,
  type WorldMapDefinition,
  type WorldMapId,
} from '../worldMap';
import { districtAt } from './districts';
import { EXTRACTION_POINTS } from './extractionPoints';
import { gateKeys, gatesForMap, gateStatesToVerify } from './gates';
import {
  doorIndex,
  collisionBlocker,
  doorsFrom,
  findHunterBreakawayTile,
  findHunterPursuitPath,
  findHunterSpawnTile,
  HUNTER_BREAKAWAY_DISTANCE,
  HUNTER_MINIMUM_SPAWN_DISTANCE,
  planHunterBreakaway,
} from './hunter';
import {
  isBlockedAt,
  openGround,
  slideLength,
  stepDistances,
  straightWalk,
  unreachableTiles,
  walkableTiles,
  walksLengthenedBy,
  type NamedGround,
} from './mapStructure';
import { idleBeatTiles, stepDirection } from './npcIdle';
import { trainerSightTiles } from './trainerSight';
import { createRunTrainerEncounters, withoutDefeatedBosses } from './trainers';
import { RAID_CONTRACTS } from '../objectives';
import { RUN_INSERTIONS } from '../run/runGeneration';

/**
 * The standard every map is held to, as machine-checkable numbers.
 *
 * A map that fails these is a field with decoration painted on it, however many
 * tiles the player can stand on. The shipped maps scored 42, 31, 33 and 26 on
 * the first line and 49%, 69%, 31% and 0% on the second.
 */
const LONGEST_STRAIGHT_WALK = 9;
/** How far you may hold a direction from an insertion before something answers. */
const INSERTION_DECISION_STEPS = 4;

/**
 * A map with boss-held gates is several maps: a shut gate is collision and an
 * open one is ground, and the hunter, the flee and every rule below read that
 * collision. So each rule is held against every state a player can be standing
 * in - every gate shut, each boss beaten, every gate open - rather than against
 * whichever one a fresh save happens to see. A map with no gates is one state
 * under its own name, exactly as before.
 */
interface MapState {
  readonly name: string;
  readonly mapId: WorldMapId;
  /** Every key turned so far: beaten boss ids, and field-move gates worked open. */
  readonly defeatedBosses: readonly string[];
  readonly map: WorldMapDefinition;
  /** Every gate open: the one state in which the map has to be a single place. */
  readonly fullyOpen: boolean;
}

/**
 * One file's share of the rules below: a map, or one of several slices of a
 * map's gate states. Every rule is asked of every tile of a map in every gate
 * state, so they are whole-map searches from every tile, and in one file they
 * ran end to end on one worker - fifteen minutes of CI on the Floodplain alone
 * while the other cores sat idle. Split into files, vitest runs them side by
 * side. Nothing is sampled or dropped to get there: `mapStructure.test.ts`
 * fails a map, or a slice of one, that no file asks about.
 */
export interface MapStructurePart {
  /** What the file hands `describeMapStructure`. */
  readonly name: string;
  readonly mapId: WorldMapId;
  /** This file is slice `part` of `of`, taking every `of`th gate state. */
  readonly part: number;
  readonly of: number;
  /** The file that asks these, beside this one. */
  readonly file: string;
}

export const MAP_STRUCTURE_PARTS: readonly MapStructurePart[] = [
  { name: 'pallet-town', mapId: 'pallet-town', part: 1, of: 1, file: 'mapStructure.palletTown.test.ts' },
  { name: 'route-1', mapId: 'route-1', part: 1, of: 1, file: 'mapStructure.route1.test.ts' },
  { name: 'viridian-forest', mapId: 'viridian-forest', part: 1, of: 1, file: 'mapStructure.viridianForest.test.ts' },
  // The Floodplain is 128 tiles square, four times any other map, with nine
  // gate states: a third of them a file keeps each slice level with the others.
  { name: 'floodplain-relay 1/3', mapId: 'floodplain-relay', part: 1, of: 3, file: 'mapStructure.floodplainRelay1.test.ts' },
  { name: 'floodplain-relay 2/3', mapId: 'floodplain-relay', part: 2, of: 3, file: 'mapStructure.floodplainRelay2.test.ts' },
  { name: 'floodplain-relay 3/3', mapId: 'floodplain-relay', part: 3, of: 3, file: 'mapStructure.floodplainRelay3.test.ts' },
];

/** Every gate state of a map, in the order `gateStatesToVerify` gives them. */
export function mapStateNames(mapId: WorldMapId): readonly string[] {
  const gates = gatesForMap(mapId);
  const keys = gateKeys(gates);
  return gateStatesToVerify(gates).map((defeatedBosses) =>
    keys.length === 0
      ? mapId
      : `${mapId} with ${defeatedBosses.length === 0 ? 'every gate shut' : `${defeatedBosses.join(' and ')} beaten`}`,
  );
}

/** The gate states one part asks about, built only for that part. */
function mapStatesOf(part: MapStructurePart): readonly MapState[] {
  const { mapId } = part;
  const gates = gatesForMap(mapId);
  const keys = gateKeys(gates);
  const names = mapStateNames(mapId);
  return gateStatesToVerify(gates)
    .map((defeatedBosses, index) => ({ defeatedBosses, index }))
    .filter(({ index }) => index % part.of === part.part - 1)
    .map(({ defeatedBosses, index }) => ({
      name: names[index],
      mapId,
      defeatedBosses,
      map: getWorldMap(mapId, defeatedBosses),
      // Every key, not every boss: a field-move door is one of a map's doors, so
      // the state that has to be a single connected place is the one with the
      // wood cut and the reach swum as well as every keeper beaten.
      fullyOpen: keys.every((key) => defeatedBosses.includes(key)),
    }));
}

const named = <T extends { readonly name: string }>(states: readonly T[]): [string, T][] =>
  states.map((state) => [state.name, state]);

/** The trainers still standing in this state: a beaten boss is gone for good. */
function trainersIn(state: MapState) {
  return withoutDefeatedBosses(createRunTrainerEncounters(), state.defeatedBosses).filter(
    (trainer) => trainer.mapId === state.mapId,
  );
}

/**
 * Signs, townsfolk and live trainers block their own tile, as the engine does -
 * and a townsperson with a beat blocks every tile of it at once. That is
 * stricter than any position the game can be in, and it is what makes an idle
 * beat safe to author: whatever the schedules happen to line up as, the map
 * still passes every rule below.
 */
function entityTiles(state: MapState): Set<string> {
  const tiles = new Set(
    state.map.entities.flatMap((entity) =>
      idleBeatTiles(entity).map((tile) => `${tile.x},${tile.y}`),
    ),
  );
  for (const trainer of trainersIn(state)) {
    tiles.add(`${trainer.position.x},${trainer.position.y}`);
  }
  return tiles;
}

function insertionsOn(mapId: WorldMapId) {
  return Object.values(RUN_INSERTIONS).filter((insertion) => insertion.mapId === mapId);
}

/** Every authored thing a raid on this map has to be able to walk to. */
function landmarksOn(map: WorldMapDefinition) {
  return [
    ...EXTRACTION_POINTS.filter((point) => point.mapId === map.id).map((point) => ({
      what: point.label,
      position: point.position,
    })),
    ...map.pois.map((poi) => ({ what: poi.label, position: poi.position })),
    // Every stop of every contract on this map. A contract objective the
    // insertion cannot walk to is a raid the player cannot finish, and there is
    // now more than one contract that could be authored into a pocket.
    ...RAID_CONTRACTS.filter((contract) => contract.mapId === map.id).flatMap((contract) =>
      contract.markers.map((marker) => ({
        what: `${contract.id}/${marker.id}`,
        position: marker.position,
      })),
    ),
  ];
}

/**
 * The places a walk on this map runs between, for the rule that no such walk may
 * cross an exit: where a raid starts and what it is sent to, every gate with the
 * ground at its foot, and every doorway between two districts - a run of tiles
 * on one side of a boundary, so a two-tile road is one doorway, not two.
 */
function placesOn(state: MapState): NamedGround[] {
  const { map, mapId } = state;
  const walkable = (tile: GridPosition): boolean => !isBlockedAt(map.collision, tile.x, tile.y);
  const beside = (tile: GridPosition): GridPosition[] => [
    { x: tile.x + 1, y: tile.y },
    { x: tile.x - 1, y: tile.y },
    { x: tile.x, y: tile.y + 1 },
    { x: tile.x, y: tile.y - 1 },
  ];
  const exits = new Set(EXTRACTION_POINTS.filter((point) => point.mapId === mapId).map((point) => point.label));

  const doorways = new Map<string, GridPosition[]>();
  for (const tile of walkableTiles(map.collision)) {
    const here = districtAt(mapId, tile);
    for (const next of beside(tile).filter(walkable)) {
      const there = districtAt(mapId, next);
      if (here && there && here.id !== there.id) {
        const crossing = `${here.name} into ${there.name}`;
        doorways.set(crossing, [...(doorways.get(crossing) ?? []), tile]);
      }
    }
  }

  return [
    ...insertionsOn(mapId).map((insertion) => ({ what: insertion.id, tiles: [insertion.position] })),
    ...landmarksOn(map)
      .filter((landmark) => !exits.has(landmark.what))
      .map((landmark) => ({ what: landmark.what, tiles: [landmark.position] })),
    ...gatesForMap(mapId).map((gate) => ({
      what: gate.label,
      tiles: [...gate.tiles, ...gate.tiles.flatMap(beside)].filter(walkable),
    })),
    ...[...doorways].flatMap(([crossing, tiles]) =>
      connectedRuns(tiles).map((run) => ({ what: `${crossing} at ${run[0].x},${run[0].y}`, tiles: run })),
    ),
  ];
}

/**
 * Walking steps from `from` to `to`, searching no further out than `limit`, or
 * -1 when `to` is further than that or cannot be reached at all.
 */
function stepsWithin(
  isBlocked: (tile: GridPosition) => boolean,
  from: GridPosition,
  to: GridPosition,
  limit: number,
): number {
  const seen = new Set([`${from.x},${from.y}`]);
  let ring = [from];
  for (let steps = 0; steps <= limit && ring.length > 0; steps += 1) {
    if (ring.some((tile) => tile.x === to.x && tile.y === to.y)) {
      return steps;
    }
    const next: GridPosition[] = [];
    for (const { x, y } of ring) {
      for (const tile of [
        { x, y: y - 1 },
        { x, y: y + 1 },
        { x: x - 1, y },
        { x: x + 1, y },
      ]) {
        const key = `${tile.x},${tile.y}`;
        if (!seen.has(key) && !isBlocked(tile)) {
          seen.add(key);
          next.push(tile);
        }
      }
    }
    ring = next;
  }
  return -1;
}

/** Splits tiles into the runs that touch each other. */
function connectedRuns(tiles: readonly GridPosition[]): GridPosition[][] {
  const left = new Map(tiles.map((tile) => [`${tile.x},${tile.y}`, tile]));
  const runs: GridPosition[][] = [];
  while (left.size > 0) {
    const [key, first] = left.entries().next().value!;
    left.delete(key);
    const run = [first];
    for (let index = 0; index < run.length; index += 1) {
      const { x, y } = run[index];
      for (const near of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
        const tile = left.get(near);
        if (tile) {
          left.delete(near);
          run.push(tile);
        }
      }
    }
    runs.push(run);
  }
  return runs;
}

/**
 * Every rule a map is held to, asked of one part's gate states. Each
 * `mapStructure.*.test.ts` file is one call to this.
 */
export function describeMapStructure(partName: string): void {
  const part = MAP_STRUCTURE_PARTS.find((candidate) => candidate.name === partName);
  if (!part) {
    throw new Error(`no map structure part '${partName}'`);
  }
  const MAP_STATES = mapStatesOf(part);
  const OPEN_STATES = MAP_STATES.filter((state) => state.fullyOpen);
  // Only one slice of a map holds its every-gate-open state, and `it.each`
  // of nothing is not a test.
  const eachOpenState = (
    title: string,
    rule: (name: string, state: MapState) => void,
  ): void => {
    if (OPEN_STATES.length > 0) {
      it.each(named(OPEN_STATES))(title, rule);
    }
  };

  describe(`map structure: ${partName}`, () => {
    it.each(named(MAP_STATES))('%s never lets a held direction cross it', (_name, { map }) => {
      const { longest } = straightWalk(map.collision);
      expect(longest).toBeLessThanOrEqual(LONGEST_STRAIGHT_WALK);
    });

    it.each(named(MAP_STATES))('%s has no open ground in it', (_name, { map }) => {
      const open = openGround(map.collision);
      // A single tile with nothing within three steps is a wide junction. Two of
      // them joined together is the beginning of a field.
      expect(open.blobs.filter((blob) => blob > 1)).toEqual([]);
    });

    eachOpenState(
      '%s is one connected place with signs and trainers solid',
      (_name, state) => {
        const { map } = state;
        const blocked = entityTiles(state);
        const start = walkableTiles(map.collision).find(
          (tile) => !blocked.has(`${tile.x},${tile.y}`),
        );
        expect(start).toBeDefined();
        expect(unreachableTiles(map.collision, start!, blocked)).toEqual([]);
      },
    );

    /**
     * A shut gate cuts a map into regions, and a raid can start inside any of
     * them that holds an insertion. The clock does not care which: a region with
     * no way out is a raid that can only end by running out of time, so every
     * region a raid can start in has to hold an exit it can open from inside -
     * one on no condition, or one whose landmark is in the same region.
     */
    it.each(named(MAP_STATES))(
      '%s gives every region a raid can start in its own way out',
      (_name, state) => {
        const { map, mapId } = state;
        const blocked = entityTiles(state);
        for (const insertion of insertionsOn(mapId)) {
          const distances = stepDistances(map.collision, insertion.position, blocked);
          const within = (position: GridPosition): boolean =>
            (distances[position.y]?.[position.x] ?? -1) >= 0;
          const usable = EXTRACTION_POINTS.filter((point) => {
            if (point.mapId !== mapId || !within(point.position)) {
              return false;
            }
            const requirement = point.requirement;
            if (requirement?.kind !== 'poi-activated') {
              return true;
            }
            const poi = map.pois.find((candidate) => candidate.id === requirement.poiId);
            return poi !== undefined && within(poi.position);
          });
          expect(`${insertion.id}: ${usable.length === 0 ? 'no way out' : 'has a way out'}`)
            .toBe(`${insertion.id}: has a way out`);
        }
      },
    );

    eachOpenState('%s can walk from every insertion to every exit and landmark', (_name, state) => {
      const { map, mapId } = state;
      const insertions = insertionsOn(mapId);
      expect(insertions.length).toBeGreaterThan(0);
      const blocked = entityTiles(state);
      for (const insertion of insertions) {
        const distances = stepDistances(map.collision, insertion.position, blocked);
        for (const landmark of landmarksOn(map)) {
          const steps = distances[landmark.position.y][landmark.position.x];
          expect(`${insertion.id} -> ${landmark.what}: ${steps < 0 ? 'unreachable' : `${steps} steps`}`)
            .toBe(`${insertion.id} -> ${landmark.what}: ${steps} steps`);
        }
      }
    });

    it.each(named(MAP_STATES))('%s answers a held direction from its insertion within a few steps', (_name, { map, mapId }) => {
      for (const insertion of insertionsOn(mapId)) {
        const collision = map.collision;
        for (const [dx, dy] of [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ]) {
          expect(slideLength(collision, insertion.position, dx, dy)).toBeLessThanOrEqual(
            INSERTION_DECISION_STEPS,
          );
        }
      }
    });

    it.each(named(MAP_STATES))('%s seals every map edge except its authored exits', (_name, { map, mapId }) => {
      const gates = new Set(
        EXTRACTION_POINTS.filter((point) => point.mapId === mapId).map(
          (point) => `${point.position.x},${point.position.y}`,
        ),
      );
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          const onEdge = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
          if (!onEdge || map.collision[y][x]) {
            continue;
          }
          expect({ mapId, x, y, gate: gates.has(`${x},${y}`) }).toMatchObject({ gate: true });
        }
      }
    });

    /**
     * An open exit takes whoever steps on it, with no prompt, so to anyone who is
     * not leaving it is a wall - and every one of them can be open at once. An
     * exit standing in a passage therefore shuts the passage: the Floodplain's
     * Radio Exit once stood in the one-tile gap that was the way round a watched
     * road. Held here for every map, with every exit shut at once: whatever a raid
     * can walk to, it can still walk to without stepping on a way out.
     */
    it.each(named(MAP_STATES))('%s never stands an exit in a passage', (_name, state) => {
      const { map, mapId } = state;
      const exits = new Set(
        EXTRACTION_POINTS.filter((point) => point.mapId === mapId).map(
          (point) => `${point.position.x},${point.position.y}`,
        ),
      );
      for (const insertion of insertionsOn(mapId)) {
        const open = stepDistances(map.collision, insertion.position);
        const shut = stepDistances(map.collision, insertion.position, exits);
        const cutOff = walkableTiles(map.collision).filter(
          (tile) =>
            !exits.has(`${tile.x},${tile.y}`) && open[tile.y][tile.x] >= 0 && shut[tile.y][tile.x] < 0,
        );
        expect(`${insertion.id}: ${cutOff.map((tile) => `${tile.x},${tile.y}`).join(' ')}`).toBe(
          `${insertion.id}: `,
        );
      }
    });

    /**
     * The same fact, asked of the ways a map is walked rather than of its ground:
     * an exit that cuts nothing off can still stand in the way. The Floodplain's
     * Signal Fire stood in the neck between Beacon Keep's court and the old
     * causeway, so the walk the sluice keeper's fall opens - the map turning out to
     * be a ring - ended the raid halfway along it. So no walk between two places
     * may be shorter over an exit than round it: between one district's doorway
     * and another's, between a gate and anything it opens onto, between any two
     * things a raid is sent to - and again with each trainer's watched ground
     * shut, because the way round a watch is a way somebody drew on purpose. An
     * exit is a pocket a player steps into to leave, never a through-tile.
     */
    it.each(named(MAP_STATES))('%s never stands an exit on the way between two places', (_name, state) => {
      const { map, mapId } = state;
      const exits = new Set(
        EXTRACTION_POINTS.filter((point) => point.mapId === mapId).map(
          (point) => `${point.position.x},${point.position.y}`,
        ),
      );
      const places = placesOn(state);
      expect(walksLengthenedBy(map.collision, exits, places)).toEqual([]);

      const isSightBlocked = (tile: GridPosition): boolean => map.collision[tile.y]?.[tile.x] !== false;
      for (const trainer of trainersIn(state)) {
        const watched = trainerSightTiles(trainer, isSightBlocked);
        if (watched.length === 0) {
          continue;
        }
        const detour = new Set([trainer.position, ...watched].map((tile) => `${tile.x},${tile.y}`));
        expect(
          walksLengthenedBy(map.collision, exits, places, detour).map(
            (walk) => `round ${trainer.trainer.id}: ${walk}`,
          ),
        ).toEqual([]);
      }
    });

    /**
     * A townsperson with a beat is a wall that moves, so the beat is held to the
     * same rule an exit is: whatever tile of it they are standing on, no walk
     * between two named places may be longer than it was. And nothing a raid is
     * *for* may be stood on - an exit, a drop-in, a contract stop, a landmark or
     * the ground a trainer is charging for - because a figure that wandered onto
     * one would put a door, a stake or a price behind a person for as long as the
     * schedule felt like it.
     */
    it.each(named(MAP_STATES))('%s never lets a townsperson wander onto a route', (_name, state) => {
      const { map, mapId } = state;
      const beats = map.entities.filter((entity) => entity.idle !== undefined);
      const roamed = new Set(
        beats.flatMap((entity) => idleBeatTiles(entity).map((tile) => `${tile.x},${tile.y}`)),
      );
      if (roamed.size === 0) {
        return;
      }
      // Every tile of a beat is walkable ground one step from the last: a beat is
      // walked, not teleported along.
      for (const entity of beats) {
        const beat = idleBeatTiles(entity);
        for (const tile of beat) {
          expect(`${entity.id} stands on ${tile.x},${tile.y}: ${isBlockedAt(map.collision, tile.x, tile.y) ? 'a wall' : 'ground'}`)
            .toBe(`${entity.id} stands on ${tile.x},${tile.y}: ground`);
        }
        for (const tile of beat.slice(1)) {
          expect(`${entity.id} reaches ${tile.x},${tile.y}: ${beat.some((other) => stepDirection(other, tile) !== null)}`)
            .toBe(`${entity.id} reaches ${tile.x},${tile.y}: true`);
        }
      }

      const exits = new Set(
        EXTRACTION_POINTS.filter((point) => point.mapId === mapId).map(
          (point) => `${point.position.x},${point.position.y}`,
        ),
      );
      const isSightBlocked = (tile: GridPosition): boolean => map.collision[tile.y]?.[tile.x] !== false;
      const watched = trainersIn(state).flatMap((trainer) => trainerSightTiles(trainer, isSightBlocked));
      const sacred = new Map<string, string>();
      for (const point of EXTRACTION_POINTS.filter((point) => point.mapId === mapId)) {
        sacred.set(`${point.position.x},${point.position.y}`, point.label);
      }
      for (const insertion of insertionsOn(mapId)) {
        sacred.set(`${insertion.position.x},${insertion.position.y}`, insertion.id);
      }
      for (const landmark of landmarksOn(map)) {
        sacred.set(`${landmark.position.x},${landmark.position.y}`, landmark.what);
      }
      for (const tile of watched) {
        sacred.set(`${tile.x},${tile.y}`, 'watched ground');
      }
      const taken = [...roamed].filter((key) => sacred.has(key));
      expect(taken.map((key) => `${key} is ${sacred.get(key)}`)).toEqual([]);

      expect(
        walksLengthenedBy(map.collision, exits, placesOn(state), roamed).map(
          (walk) => `with everyone off their mark: ${walk}`,
        ),
      ).toEqual([]);
    });

    /**
     * Who may stand where, asked as one rule about doors.
     *
     * A figure is collision, so wherever one stops is a door, and a door in the
     * neck of a pocket is a wall round whoever is inside it. The captain played
     * into one on 2026-09-19: he fled, the hunter settled in the gap he had come
     * through, and it would neither fight him nor move. So every figure that can
     * stand on walkable ground is held to one of two things, and `doorsFrom` is
     * what names the ground the question is about - a tile is a door when standing
     * on it takes ground away from somebody beside it.
     *
     * - **A figure the player may walk into** may stand on a door, because walking
     *   into them is the way through it. The hunter is caught by
     *   (`WorldScene.tryWalkIntoHunter`), and a trainer is fought
     *   (`askForTrainerChallenge`) - a beaten one is never rebuilt, so the tile
     *   comes back for good. Both are a price; neither is a wall. What that needs
     *   is that whoever is shut in can reach them, which is asked below.
     * - **A figure the player may not walk into** - a sign, a townsperson keeping
     *   a beat - may not stand on a door at all, at any tile of that beat. There
     *   is nothing to pay and nothing to wait for, so a door they stop in is the
     *   raid over.
     *
     * Every authored figure passes this today. Nothing held them to it, which is
     * the whole reason for the rule: the answer to a class of fault is not the one
     * fix, it is the test that fails the next map to draw it.
     */
    it.each(named(MAP_STATES))('%s never lets a figure stand where it would wall the player in', (_name, state) => {
      const { map } = state;
      const bounds = { width: map.width, height: map.height };
      const isBlocked = collisionBlocker(map.collision);
      const beside = (tile: GridPosition): GridPosition[] =>
        [
          { x: tile.x + 1, y: tile.y },
          { x: tile.x - 1, y: tile.y },
          { x: tile.x, y: tile.y + 1 },
          { x: tile.x, y: tile.y - 1 },
        ].filter((step) => !isBlocked(step));

      /**
       * Asked from next door, which is where the player is when it matters, and
       * which is also what keeps the answer honest: `doorsFrom` never names its
       * own root, because that is the tile the person asking is standing on.
       */
      const isDoor = (tile: GridPosition): boolean => {
        const asker = beside(tile)[0];
        return asker !== undefined && doorsFrom(asker, bounds, isBlocked).doors.has(doorIndex(tile, bounds));
      };

      // Signs and townsfolk: every tile of every beat, which is stricter than any
      // position the schedules can ever put them in.
      for (const entity of map.entities) {
        for (const tile of idleBeatTiles(entity)) {
          expect(`${entity.id} stands on ${tile.x},${tile.y}: ${isDoor(tile) ? 'the only way through' : 'ground you can walk round'}`)
            .toBe(`${entity.id} stands on ${tile.x},${tile.y}: ground you can walk round`);
        }
      }

      // A trainer may hold a door - that is what a toll is - as long as whoever is
      // shut in by them can walk up and be charged. Every region a trainer's tile
      // separates touches that tile, so a trainer with a side to be approached
      // from is a trainer everyone they shut in can challenge.
      for (const trainer of trainersIn(state)) {
        expect(`${trainer.trainer.id} can be challenged from ${beside(trainer.position).length} sides`)
          .not.toBe(`${trainer.trainer.id} can be challenged from 0 sides`);
      }
    });

    /**
     * The hunter stands anywhere at all, so nothing can be asked of where it
     * stops - only that its tile is one the player may enter, which is a fact
     * about the scene and is held in `hunterWall.test.ts`. What belongs to the map
     * is the escape that used to create the trap: a flee moves the hunter
     * `HUNTER_BREAKAWAY_DISTANCE` walking steps back and holds it there, blind,
     * and it used to choose that tile knowing nothing about where the player could
     * still go. On the Floodplain that put it across the player's only route to
     * every exit on 379 of the tile-and-heading pairs below. Asked for every tile
     * of every map, in every gate state, for every way the player could have been
     * walking when they broke contact.
     */
    it.each(named(MAP_STATES))('%s never lets a flee leave the hunter across the last way out', (_name, state) => {
      const { map, mapId } = state;
      const bounds = { width: map.width, height: map.height };
      const isBlocked = collisionBlocker(map.collision);
      const exits = EXTRACTION_POINTS.filter((point) => point.mapId === mapId).map(
        (point) => point.position,
      );
      for (const player of walkableTiles(map.collision)) {
        const contact = [
          { x: player.x + 1, y: player.y },
          { x: player.x - 1, y: player.y },
          { x: player.x, y: player.y + 1 },
          { x: player.x, y: player.y - 1 },
        ].find((tile) => !isBlocked(tile));
        if (!contact) {
          continue;
        }
        // Only exits this player could have reached in the first place are exits a
        // flee can take away; where a shut gate has already taken them all, that is
        // the gate rules' business rather than this one's.
        // Asked once and handed to all four headings: the doors of the map seen
        // from this tile are the same whichever way the player was walking, and
        // this runs from every tile of every map in every gate state.
        // `planHunterBreakaway` is `findHunterBreakawayTile` with the searches
        // done once for all four headings, which only break its last tie.
        const doors = doorsFrom(player, bounds, isBlocked, exits);
        const { sealsIn } = doors;
        const breakaway = planHunterBreakaway(
          contact,
          player,
          bounds,
          isBlocked,
          HUNTER_BREAKAWAY_DISTANCE,
          exits,
          doors,
        );
        for (const heading of ['up', 'down', 'left', 'right'] as const) {
          const away = breakaway(heading);
          const verdict = sealsIn.has(doorIndex(away, bounds)) ? 'no way out' : 'a way out';
          expect(`fled from ${player.x},${player.y} going ${heading}, hunter to ${away.x},${away.y}: ${verdict}`)
            .toBe(`fled from ${player.x},${player.y} going ${heading}, hunter to ${away.x},${away.y}: a way out`);
        }
      }
    });

    it.each(named(MAP_STATES))('%s always gives the hunter somewhere fair to arrive', (_name, { map }) => {
      const bounds = { width: map.width, height: map.height };
      const isBlocked = collisionBlocker(map.collision);
      for (const tile of walkableTiles(map.collision)) {
        const spawn = findHunterSpawnTile(tile, bounds, isBlocked);
        expect(`${tile.x},${tile.y}: ${spawn === null ? 'nowhere fair' : 'spawn found'}`)
          .toBe(`${tile.x},${tile.y}: spawn found`);
      }
    });

    /**
     * Fleeing moves the hunter six *walking* steps away and holds it there,
     * blind, for ten seconds - and the player cannot walk through it. In a
     * one-tile lane that separation is six tiles back along the lane, which is
     * what you want; the failure it must never have is landing on the only door
     * out of wherever the player is standing.
     */
    it.each(named(MAP_STATES))('%s lets a flee put real ground between hunter and player', (_name, { map, name: mapId }) => {
      const bounds = { width: map.width, height: map.height };
      const isBlocked = collisionBlocker(map.collision);
      const tiles = walkableTiles(map.collision);
      let worst = HUNTER_BREAKAWAY_DISTANCE;
      for (const player of tiles) {
        const contact = [
          { x: player.x + 1, y: player.y },
          { x: player.x - 1, y: player.y },
          { x: player.x, y: player.y + 1 },
          { x: player.x, y: player.y - 1 },
        ].find((tile) => !isBlocked(tile));
        if (!contact) {
          continue;
        }
        const breakaway = findHunterBreakawayTile(contact, player, bounds, isBlocked);
        // Walked out no further than a flee ever sends the hunter, which is
        // what keeps this from being a second whole-map search per tile: a
        // separation past that is a flee that overshot, and fails as surely as
        // one that fell short.
        const separation = stepsWithin(isBlocked, player, breakaway, HUNTER_BREAKAWAY_DISTANCE);
        expect(`${mapId} ${player.x},${player.y}: separation ${separation}`)
          .toBe(`${mapId} ${player.x},${player.y}: separation ${Math.max(separation, HUNTER_MINIMUM_SPAWN_DISTANCE)}`);
        worst = Math.min(worst, separation);
        // The player still has somewhere to go with the hunter parked there: a
        // step onto open ground that is not the hunter's tile. (This was a walk
        // of the whole map with the hunter's tile shut, read only at the four
        // tiles beside the player - where a walk can only ever say 1 or nothing.)
        const stillOpen = [
          { x: player.x + 1, y: player.y },
          { x: player.x - 1, y: player.y },
          { x: player.x, y: player.y + 1 },
          { x: player.x, y: player.y - 1 },
        ].some((tile) => !isBlocked(tile) && (tile.x !== breakaway.x || tile.y !== breakaway.y));
        expect(`${mapId} ${player.x},${player.y} fled to ${breakaway.x},${breakaway.y}: ${stillOpen ? 'still has a way out' : 'walled in'}`)
          .toBe(`${mapId} ${player.x},${player.y} fled to ${breakaway.x},${breakaway.y}: still has a way out`);
      }
      expect(worst).toBeGreaterThanOrEqual(HUNTER_MINIMUM_SPAWN_DISTANCE);
    });

    /**
     * A trainer's watch is a price on a route, so it has to be a price the player
     * walks into on purpose. These are the ways it stops being one: it reaches
     * the tile the raid drops you on, it reaches the door you leave by, or it
     * covers ground with no way back out of it.
     */
    it.each(named(MAP_STATES))('%s never lets a trainer watch corner the player', (_name, state) => {
      const { map, mapId } = state;
      const isSightBlocked = (tile: GridPosition): boolean =>
        map.collision[tile.y]?.[tile.x] !== false;
      const doors = [
        ...insertionsOn(mapId).map((insertion) => ({
          what: insertion.id,
          position: insertion.position,
        })),
        ...EXTRACTION_POINTS.filter((point) => point.mapId === mapId).map((point) => ({
          what: point.label,
          position: point.position,
        })),
        // Arriving through a warp is no more a choice than dropping in is.
        ...map.warps.map((warp) => ({
          what: `arrival from ${warp.destinationMapId}`,
          position: warp.destination,
        })),
      ];

      for (const trainer of trainersIn(state)) {
        const watched = trainerSightTiles(trainer, isSightBlocked);
        if (watched.length === 0) {
          // A trainer with no watch is one the player has to speak to, which is
          // its own answer to every question below.
          continue;
        }
        const watch = new Set(watched.map((tile) => `${tile.x},${tile.y}`));

        for (const door of doors) {
          const key = `${door.position.x},${door.position.y}`;
          expect(`${trainer.trainer.id} watches ${door.what}: ${watch.has(key)}`)
            .toBe(`${trainer.trainer.id} watches ${door.what}: false`);
        }

        // The challenge fires on the first watched tile, so what matters is that
        // the watch has an outside to be approached from: a watch nothing borders
        // is one the player can only ever be inside, which is an ambush.
        const approaches = watched.filter((tile) =>
          [
            { x: tile.x + 1, y: tile.y },
            { x: tile.x - 1, y: tile.y },
            { x: tile.x, y: tile.y + 1 },
            { x: tile.x, y: tile.y - 1 },
          ].some(
            (step) =>
              !isBlockedAt(map.collision, step.x, step.y) && !watch.has(`${step.x},${step.y}`),
          ),
        );
        expect(`${trainer.trainer.id} watch approaches: ${approaches.length}`)
          .not.toBe(`${trainer.trainer.id} watch approaches: 0`);
      }
    });

    /**
     * The hunter closes with a real shortest-path search, so a map can strand it
     * in a way a spawn check never sees: it arrives somewhere fair and then finds
     * no route to the player. Walking the whole route proves the search actually
     * reaches contact rather than stopping at the nearest tile it can stand on.
     */
    it.each(named(MAP_STATES))('%s lets the hunter path to the player from anywhere it can arrive', (_name, { map, name: mapId }) => {
      const bounds = { width: map.width, height: map.height };
      const isBlocked = collisionBlocker(map.collision);
      const tiles = walkableTiles(map.collision);
      // Every tile as the player, against the spawn the hunter would really get.
      for (const player of tiles) {
        const spawn = findHunterSpawnTile(player, bounds, isBlocked);
        expect(spawn).not.toBeNull();
        const route = findHunterPursuitPath(spawn!, player, bounds, isBlocked);
        const last = route[route.length - 1] ?? spawn!;
        const contact = Math.abs(last.x - player.x) + Math.abs(last.y - player.y);
        expect(`${mapId} ${spawn!.x},${spawn!.y} -> ${player.x},${player.y}: ends ${contact} away`)
          .toBe(`${mapId} ${spawn!.x},${spawn!.y} -> ${player.x},${player.y}: ends ${contact > 1 ? 'stranded' : contact} away`);
      }
    });
  });
}
