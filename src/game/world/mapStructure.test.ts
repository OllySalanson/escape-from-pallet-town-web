import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import {
  getWorldMap,
  WORLD_MAPS,
  type WorldMapDefinition,
  type WorldMapId,
} from '../worldMap';
import { EXTRACTION_POINTS } from './extractionPoints';
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
} from './mapStructure';
import { trainerSightTiles } from './trainerSight';
import { createRunTrainerEncounters } from './trainers';
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

/** Signs, townsfolk and live trainers block their own tile, as the engine does. */
function entityTiles(mapId: WorldMapId): Set<string> {
  const map = getWorldMap(mapId);
  const tiles = new Set(map.entities.map((entity) => `${entity.position.x},${entity.position.y}`));
  for (const trainer of createRunTrainerEncounters()) {
    if (trainer.mapId === mapId) {
      tiles.add(`${trainer.position.x},${trainer.position.y}`);
    }
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

describe('map structure', () => {
  it.each(MAP_IDS)('%s never lets a held direction cross it', (mapId) => {
    const { longest } = straightWalk(getWorldMap(mapId).collision);
    expect(longest).toBeLessThanOrEqual(LONGEST_STRAIGHT_WALK);
  });

  it.each(MAP_IDS)('%s has no open ground in it', (mapId) => {
    const open = openGround(getWorldMap(mapId).collision);
    // A single tile with nothing within three steps is a wide junction. Two of
    // them joined together is the beginning of a field.
    expect(open.blobs.filter((blob) => blob > 1)).toEqual([]);
  });

  it.each(MAP_IDS)('%s is one connected place with signs and trainers solid', (mapId) => {
    const map = getWorldMap(mapId);
    const blocked = entityTiles(mapId);
    const start = walkableTiles(map.collision).find((tile) => !blocked.has(`${tile.x},${tile.y}`));
    expect(start).toBeDefined();
    expect(unreachableTiles(map.collision, start!, blocked)).toEqual([]);
  });

  it.each(MAP_IDS)('%s can walk from every insertion to every exit and landmark', (mapId) => {
    const map = getWorldMap(mapId);
    const insertions = insertionsOn(mapId);
    expect(insertions.length).toBeGreaterThan(0);
    const blocked = entityTiles(mapId);
    for (const insertion of insertions) {
      const distances = stepDistances(map.collision, insertion.position, blocked);
      for (const landmark of landmarksOn(map)) {
        const steps = distances[landmark.position.y][landmark.position.x];
        expect(`${insertion.id} -> ${landmark.what}: ${steps < 0 ? 'unreachable' : `${steps} steps`}`)
          .toBe(`${insertion.id} -> ${landmark.what}: ${steps} steps`);
      }
    }
  });

  it.each(MAP_IDS)('%s answers a held direction from its insertion within a few steps', (mapId) => {
    for (const insertion of insertionsOn(mapId)) {
      const collision = getWorldMap(mapId).collision;
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

  it.each(MAP_IDS)('%s seals every map edge except its authored exits', (mapId) => {
    const map = getWorldMap(mapId);
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

  it.each(MAP_IDS)('%s always gives the hunter somewhere fair to arrive', (mapId) => {
    const map = getWorldMap(mapId);
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
  it.each(MAP_IDS)('%s lets a flee put real ground between hunter and player', (mapId) => {
    const map = getWorldMap(mapId);
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
  it.each(MAP_IDS)('%s never lets a trainer watch corner the player', (mapId) => {
    const map = getWorldMap(mapId);
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

    for (const trainer of createRunTrainerEncounters()) {
      if (trainer.mapId !== mapId) {
        continue;
      }
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
  it.each(MAP_IDS)('%s lets the hunter path to the player from anywhere it can arrive', (mapId) => {
    const map = getWorldMap(mapId);
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
