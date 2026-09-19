import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import {
  getWorldMap,
  WORLD_MAPS,
  type WorldMapDefinition,
  type WorldMapId,
} from '../worldMap';
import { districtAt } from './districts';
import { EXTRACTION_POINTS } from './extractionPoints';
import { gateBossIds, gatesForMap, gateStatesToVerify } from './gates';
import {
  findHunterBreakawayTile,
  findHunterPursuitPath,
  findHunterSpawnTile,
  HUNTER_BREAKAWAY_DISTANCE,
  HUNTER_MINIMUM_SPAWN_DISTANCE,
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

const MAP_IDS = Object.keys(WORLD_MAPS) as WorldMapId[];

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
  readonly defeatedBosses: readonly string[];
  readonly map: WorldMapDefinition;
  /** Every gate open: the one state in which the map has to be a single place. */
  readonly fullyOpen: boolean;
}

const MAP_STATES: readonly MapState[] = MAP_IDS.flatMap((mapId) => {
  const gates = gatesForMap(mapId);
  const bosses = gateBossIds(gates);
  return gateStatesToVerify(gates).map((defeatedBosses) => ({
    name:
      bosses.length === 0
        ? mapId
        : `${mapId} with ${defeatedBosses.length === 0 ? 'every gate shut' : `${defeatedBosses.join(' and ')} beaten`}`,
    mapId,
    defeatedBosses,
    map: getWorldMap(mapId, defeatedBosses),
    fullyOpen: bosses.every((boss) => defeatedBosses.includes(boss)),
  }));
});
const OPEN_STATES = MAP_STATES.filter((state) => state.fullyOpen);

const named = <T extends { readonly name: string }>(states: readonly T[]): [string, T][] =>
  states.map((state) => [state.name, state]);

/** The trainers still standing in this state: a beaten boss is gone for good. */
function trainersIn(state: MapState) {
  return withoutDefeatedBosses(createRunTrainerEncounters(), state.defeatedBosses).filter(
    (trainer) => trainer.mapId === state.mapId,
  );
}

/** Signs, townsfolk and live trainers block their own tile, as the engine does. */
function entityTiles(state: MapState): Set<string> {
  const tiles = new Set(
    state.map.entities.map((entity) => `${entity.position.x},${entity.position.y}`),
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

describe('map structure', () => {
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

  it.each(named(OPEN_STATES))(
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

  it.each(named(OPEN_STATES))('%s can walk from every insertion to every exit and landmark', (_name, state) => {
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

  it.each(named(MAP_STATES))('%s always gives the hunter somewhere fair to arrive', (_name, { map }) => {
    const bounds = { width: map.width, height: map.height };
    const isBlocked = (tile: { x: number; y: number }): boolean =>
      map.collision[tile.y]?.[tile.x] !== false;
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
    const isBlocked = (tile: { x: number; y: number }): boolean =>
      map.collision[tile.y]?.[tile.x] !== false;
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
      const distances = stepDistances(map.collision, player);
      const separation = distances[breakaway.y][breakaway.x];
      expect(`${mapId} ${player.x},${player.y}: separation ${separation}`)
        .toBe(`${mapId} ${player.x},${player.y}: separation ${Math.max(separation, HUNTER_MINIMUM_SPAWN_DISTANCE)}`);
      worst = Math.min(worst, separation);
      // The player still has somewhere to go with the hunter parked there.
      const withHunter = stepDistances(
        map.collision,
        player,
        new Set([`${breakaway.x},${breakaway.y}`]),
      );
      const stillOpen = [
        { x: player.x + 1, y: player.y },
        { x: player.x - 1, y: player.y },
        { x: player.x, y: player.y + 1 },
        { x: player.x, y: player.y - 1 },
      ].some((tile) => (withHunter[tile.y]?.[tile.x] ?? -1) > 0);
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
    const isBlocked = (tile: { x: number; y: number }): boolean =>
      map.collision[tile.y]?.[tile.x] !== false;
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

describe('walks lengthened by an exit', () => {
  const grid = (rows: readonly string[]) => rows.map((row) => [...row].map((cell) => cell === '#'));
  const at = (what: string, ...tiles: [number, number][]) => ({ what, tiles: tiles.map(([x, y]) => ({ x, y })) });

  it('fails an exit on the short side of a ring, which cuts nothing off', () => {
    // The exit at 2,0 strands no ground - the long way round is still there -
    // which is exactly what the passage rule cannot see.
    const ring = grid(['.....', '.###.', '.###.', '.....']);
    expect(walksLengthenedBy(ring, new Set(['2,0']), [at('west', [0, 0]), at('east', [4, 0])])).toEqual([
      'west -> east: 4 steps, 10 without crossing an exit',
    ]);
  });

  it('says so when the only way is over the exit', () => {
    const neck = grid(['...']);
    expect(walksLengthenedBy(neck, new Set(['1,0']), [at('court', [0, 0]), at('causeway', [2, 0])])).toEqual([
      'court -> causeway: 2 steps, no way without crossing an exit',
    ]);
  });

  it('lets an exit stand at the side of a two-tile lane, and in a pocket off one', () => {
    const lane = grid(['..#', '...', '..#']);
    const ends = [at('north', [0, 0], [1, 0]), at('south', [0, 2], [1, 2])];
    expect(walksLengthenedBy(lane, new Set(['0,1']), ends)).toEqual([]);
    expect(walksLengthenedBy(lane, new Set(['2,1']), ends)).toEqual([]);
  });

  it('asks again with a detour forced, where the way round is the only way', () => {
    const lane = grid(['..#', '...', '..#']);
    const ends = [at('north', [0, 0], [1, 0]), at('south', [0, 2], [1, 2])];
    expect(walksLengthenedBy(lane, new Set(['0,1']), ends, new Set(['1,1']))).toEqual([
      'north -> south: 2 steps, no way without crossing an exit',
    ]);
  });
});
