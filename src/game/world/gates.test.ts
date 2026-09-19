import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { RAID_CONTRACTS } from '../objectives';
import { frontDoorFor, RUN_INSERTIONS } from '../run/runGeneration';
import { getWorldMap, WORLD_MAPS, type WorldMapId } from '../worldMap';
import { dropInCaption, dropInReachedLine } from './dropIns';
import { EXTRACTION_POINTS } from './extractionPoints';
import {
  applyGates,
  gateBossIds,
  gateCaption,
  gatesByKeeper,
  jointGateCaption,
  jointGateLabel,
  gatesForMap,
  gatesOpenedLines,
  gateStateKey,
  gateStatesToVerify,
  isGateOpen,
  WORLD_GATES,
  type MapGate,
} from './gates';
import { MapSketch } from './mapGrid';
import { stepDistances } from './mapStructure';
import { buildMapLayers } from './tiles';
import type { TilesetCatalogue } from './tileset/catalogue';
import { CLASSIC_TILESET } from './tileset/classicTileset';
import { hasEncounters } from './tileset/materials';
import { trainerSightTiles } from './trainerSight';
import { bossEncounters, createRunTrainerEncounters, withoutDefeatedBosses } from './trainers';

/**
 * The rules a boss-held gate has to keep, held against the authored data.
 *
 * `mapStructure.test.ts` holds every gate state to the rules every map keeps -
 * straight walks, open ground, the hunter's arrival, a way out of every region
 * a raid can start in. What is here is what only a gate can get wrong: a door
 * nobody holds, a boss with no door, a door that gates nothing, and a chain of
 * doors that cannot be opened in any order a player could walk.
 */

const key = (tile: GridPosition): string => `${tile.x},${tile.y}`;
const MAP_IDS = Object.keys(WORLD_MAPS) as WorldMapId[];
const GATED_MAP_IDS = MAP_IDS.filter((mapId) => gatesForMap(mapId).length > 0);
const BOSSES = bossEncounters(createRunTrainerEncounters());

/** Everything authored onto a tile of this map that a gate must not swallow. */
function authoredTiles(mapId: WorldMapId): Map<string, string> {
  const map = getWorldMap(mapId);
  const tiles = new Map<string, string>();
  for (const insertion of Object.values(RUN_INSERTIONS)) {
    if (insertion.mapId === mapId) tiles.set(key(insertion.position), `insertion ${insertion.id}`);
  }
  for (const point of EXTRACTION_POINTS) {
    if (point.mapId === mapId) tiles.set(key(point.position), `exit ${point.label}`);
  }
  for (const poi of map.pois) tiles.set(key(poi.position), `landmark ${poi.id}`);
  for (const entity of map.entities) tiles.set(key(entity.position), `entity ${entity.id}`);
  for (const loot of map.loot) tiles.set(key(loot.position), `loot ${loot.id}`);
  for (const trainer of createRunTrainerEncounters()) {
    if (trainer.mapId === mapId) tiles.set(key(trainer.position), `trainer ${trainer.trainer.id}`);
  }
  for (const contract of RAID_CONTRACTS) {
    if (contract.mapId !== mapId) continue;
    for (const marker of contract.markers) tiles.set(key(marker.position), `stop ${marker.id}`);
  }
  return tiles;
}

/** The tiles a player standing at `from` can walk to, with live trainers solid. */
function reachable(mapId: WorldMapId, defeatedBosses: readonly string[], from: GridPosition) {
  const map = getWorldMap(mapId, defeatedBosses);
  const blocked = new Set([
    ...map.entities.map((entity) => key(entity.position)),
    ...withoutDefeatedBosses(createRunTrainerEncounters(), defeatedBosses)
      .filter((trainer) => trainer.mapId === mapId)
      .map((trainer) => key(trainer.position)),
  ]);
  const distances = stepDistances(map.collision, from, blocked);
  return (tile: GridPosition): boolean => (distances[tile.y]?.[tile.x] ?? -1) >= 0;
}

describe('authored gates', () => {
  it('names every gate once, on a map that exists, with tiles to stand in', () => {
    const ids = WORLD_GATES.map((gate) => gate.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const gate of WORLD_GATES) {
      expect(MAP_IDS).toContain(gate.mapId);
      expect(gate.tiles.length).toBeGreaterThan(0);
      expect(gate.label).toBe(gate.label.toUpperCase());
    }
  });

  it('is solid when shut and ground when open, however the author drew the two states', () => {
    for (const gate of WORLD_GATES) {
      const shut = getWorldMap(gate.mapId);
      const open = getWorldMap(gate.mapId, [gate.bossId]);
      // Read off the built collision rather than the material, because a state
      // may be a walkable material with a solid landmark planted across it.
      for (const tile of gate.tiles) {
        expect(`${gate.id} ${key(tile)} shut: ${shut.collision[tile.y][tile.x]}`)
          .toBe(`${gate.id} ${key(tile)} shut: true`);
        expect(`${gate.id} ${key(tile)} open: ${open.collision[tile.y][tile.x]}`)
          .toBe(`${gate.id} ${key(tile)} open: false`);
        // An open gate of tall grass costs encounters like any other grass.
        expect(open.tallGrass[tile.y][tile.x]).toBe(hasEncounters(gate.open.material));
      }
    }
  });

  /**
   * A state's landmarks block like any planted prop, and they come and go with
   * the gate. A gatehouse whose solid cells overhang the door would open a
   * second, unauthored way through the moment the boss fell - so a boss's win
   * may change what is solid on that boss's own gate tiles and nowhere else.
   */
  it('changes what is solid on its own tiles and nowhere else', () => {
    for (const bossId of gateBossIds(WORLD_GATES)) {
      const gates = WORLD_GATES.filter((gate) => gate.bossId === bossId);
      for (const mapId of new Set(gates.map((gate) => gate.mapId))) {
        const own = new Set(
          gates.filter((gate) => gate.mapId === mapId).flatMap((gate) => gate.tiles.map(key)),
        );
        const shut = getWorldMap(mapId);
        const open = getWorldMap(mapId, [bossId]);
        for (let y = 0; y < shut.height; y += 1) {
          for (let x = 0; x < shut.width; x += 1) {
            if (shut.collision[y][x] !== open.collision[y][x]) {
              expect(`${bossId} changes ${x},${y}: ${own.has(`${x},${y}`) ? 'its own tile' : 'not a gate tile'}`)
                .toBe(`${bossId} changes ${x},${y}: its own tile`);
            }
          }
        }
      }
    }
  });

  it('names only landmarks its map\'s own tileset can draw', () => {
    for (const gate of WORLD_GATES) {
      const known = Object.keys(getWorldMap(gate.mapId).tileset.props);
      for (const prop of [...(gate.closed.props ?? []), ...(gate.open.props ?? [])]) {
        expect(known).toContain(prop.name);
      }
    }
  });

  it('keeps every gate tile inside the map edge and off everything else authored', () => {
    const claimed = new Map<string, string>();
    for (const gate of WORLD_GATES) {
      const map = getWorldMap(gate.mapId);
      const authored = authoredTiles(gate.mapId);
      for (const tile of gate.tiles) {
        // The outer ring is the sealed border. A gate there is a hole in it.
        expect(tile.x > 0 && tile.y > 0 && tile.x < map.width - 1 && tile.y < map.height - 1)
          .toBe(true);
        expect(`${gate.id} ${key(tile)} covers ${authored.get(key(tile)) ?? 'nothing'}`)
          .toBe(`${gate.id} ${key(tile)} covers nothing`);
        const owner = claimed.get(`${gate.mapId}:${key(tile)}`);
        expect(`${gate.id} ${key(tile)} shared with ${owner ?? 'nobody'}`)
          .toBe(`${gate.id} ${key(tile)} shared with nobody`);
        claimed.set(`${gate.mapId}:${key(tile)}`, gate.id);
      }
    }
  });

  it('gives every gate a boss on its own map, and every boss a gate', () => {
    const bossIds = BOSSES.map((boss) => boss.bossId);
    expect(new Set(bossIds).size).toBe(bossIds.length);
    for (const gate of WORLD_GATES) {
      const boss = BOSSES.find((candidate) => candidate.bossId === gate.bossId);
      expect(`${gate.id} is held by ${boss?.trainer.id ?? 'nobody'}`)
        .not.toBe(`${gate.id} is held by nobody`);
      expect(boss?.mapId).toBe(gate.mapId);
    }
    for (const boss of BOSSES) {
      expect(`${boss.bossId} holds ${WORLD_GATES.filter((gate) => gate.bossId === boss.bossId).length} gates`)
        .not.toBe(`${boss.bossId} holds 0 gates`);
      // A boss that a seed could move would be a door whose guard wanders off.
      expect(boss.fixedPosition).toBe(true);
    }
  });

  /**
   * A gate that is a panel in a fence with a gap beside it gates nothing. Shut,
   * every gate has to take something away from the raid that starts at the
   * front door - and opening it has to give exactly that back.
   */
  it.each(WORLD_GATES.map((gate) => [gate.id, gate] as const))(
    '%s actually closes something off',
    (_id, gate) => {
      const door = frontDoorFor(gate.mapId)!;
      const open = getWorldMap(gate.mapId, gateBossIds(gatesForMap(gate.mapId)));
      const canReachShut = reachable(gate.mapId, [], door.position);
      const canReachOpen = reachable(gate.mapId, gateBossIds(gatesForMap(gate.mapId)), door.position);
      let sealed = 0;
      for (let y = 0; y < open.height; y += 1) {
        for (let x = 0; x < open.width; x += 1) {
          if (canReachOpen({ x, y }) && !canReachShut({ x, y })) sealed += 1;
        }
      }
      expect(sealed).toBeGreaterThan(gate.tiles.length);
    },
  );

  /**
   * The progression has to be walkable: starting at the front door with nothing
   * beaten, beat every boss you can walk up to, and repeat. If that stops short,
   * some door is behind itself - and if it ends with a drop-in point still out
   * of reach, that landing can never be unlocked.
   */
  it.each(GATED_MAP_IDS)('%s can be opened door by door from its front door', (mapId) => {
    const door = frontDoorFor(mapId)!;
    const bossesHere = BOSSES.filter((boss) => boss.mapId === mapId);
    const beaten: string[] = [];
    for (let round = 0; round <= bossesHere.length; round += 1) {
      const map = getWorldMap(mapId, beaten);
      const canReach = reachable(mapId, beaten, door.position);
      const isSightBlocked = (tile: GridPosition): boolean => map.collision[tile.y]?.[tile.x] !== false;
      const challengeable = bossesHere.filter((boss) => {
        if (beaten.includes(boss.bossId)) return false;
        // A boss is fought by walking into their watch or by speaking to them
        // from a neighbouring tile.
        const approaches = [
          ...trainerSightTiles(boss, isSightBlocked),
          { x: boss.position.x + 1, y: boss.position.y },
          { x: boss.position.x - 1, y: boss.position.y },
          { x: boss.position.x, y: boss.position.y + 1 },
          { x: boss.position.x, y: boss.position.y - 1 },
        ];
        return approaches.some(canReach);
      });
      if (challengeable.length === 0) break;
      beaten.push(...challengeable.map((boss) => boss.bossId));
    }
    expect(beaten.sort()).toEqual(bossesHere.map((boss) => boss.bossId).sort());

    const canReach = reachable(mapId, beaten, door.position);
    for (const insertion of Object.values(RUN_INSERTIONS)) {
      if (insertion.mapId !== mapId) continue;
      expect(`${insertion.id}: ${canReach(insertion.position) ? 'reachable' : 'never reachable'}`)
        .toBe(`${insertion.id}: reachable`);
    }
  });
});

describe('gate state', () => {
  const gate: MapGate = {
    id: 'test-gate',
    mapId: 'route-1',
    bossId: 'test-boss',
    label: 'TEST GATE',
    tiles: [{ x: 1, y: 1 }],
    closed: { material: 'fence' },
    open: { material: 'earth' },
  };
  const second: MapGate = { ...gate, id: 'second-gate', bossId: 'second-boss', label: 'FAR GATE' };

  it('opens on its own boss and on nothing else', () => {
    expect(isGateOpen(gate, [])).toBe(false);
    expect(isGateOpen(gate, ['second-boss'])).toBe(false);
    expect(isGateOpen(gate, ['second-boss', 'test-boss'])).toBe(true);
  });

  it('remembers a map by which doors are open, not by who has been beaten', () => {
    expect(gateStateKey([gate, second], [])).toBe('');
    expect(gateStateKey([gate, second], ['a-boss-on-another-map'])).toBe('');
    expect(gateStateKey([gate, second], ['second-boss', 'test-boss']))
      .toBe(gateStateKey([second, gate], ['test-boss', 'second-boss']));
    // One boss may hold two doors, and both open together.
    const twin = { ...second, bossId: gate.bossId };
    expect(gateStateKey([gate, twin], [gate.bossId])).toBe('second-gate+test-gate');
  });

  it('hands back the very same built map for the same doors', () => {
    const boss = WORLD_GATES[0].bossId;
    const mapId = WORLD_GATES[0].mapId;
    expect(getWorldMap(mapId, [boss])).toBe(getWorldMap(mapId, [boss, 'someone-else']));
    expect(getWorldMap(mapId, ['someone-else'])).toBe(WORLD_MAPS[mapId]);
    expect(getWorldMap(mapId, [boss])).not.toBe(WORLD_MAPS[mapId]);
    // A map is remembered by its OWN doors: a boss beaten on another map opens
    // nothing here, so this is the fresh-save map again.
    expect(getWorldMap('viridian-forest', [boss])).toBe(WORLD_MAPS['viridian-forest']);
  });

  it('verifies every door shut, each boss alone, and every door open', () => {
    expect(gateStatesToVerify([])).toEqual([[]]);
    expect(gateStatesToVerify([gate])).toEqual([[], ['test-boss']]);
    expect(gateStatesToVerify([gate, second])).toEqual([
      [],
      ['test-boss'],
      ['second-boss'],
      ['test-boss', 'second-boss'],
    ]);
  });

  /**
   * The second way to author a door: the lane is drawn straight through and the
   * shut state is a landmark planted across it. Nothing about the gate's tiles
   * is solid as a material, so this is the prop's own footprint doing the work.
   */
  it('can be a landmark planted across a lane rather than a wall material', () => {
    const tileset: TilesetCatalogue = {
      ...CLASSIC_TILESET,
      props: {
        'test-barrier': {
          width: 2,
          height: 1,
          label: 'BARRIER',
          cells: [
            { tile: 0, solid: true },
            { tile: 0, solid: true },
          ],
        },
      },
    };
    const barred: MapGate = {
      ...gate,
      tiles: [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
      ],
      closed: { material: 'earth', props: [{ name: 'test-barrier', x: 2, y: 2 }] },
      open: { material: 'earth' },
    };
    const build = (defeatedBosses: readonly string[]) =>
      buildMapLayers(
        applyGates(
          new MapSketch({ width: 6, height: 5, fill: 'T' }).draw(1, 2, [',,,,']),
          [barred],
          defeatedBosses,
        ),
        tileset,
      );

    const shut = build([]);
    const open = build([barred.bossId]);
    expect(shut.collision[2].slice(1, 5)).toEqual([false, true, true, false]);
    expect(open.collision[2].slice(1, 5)).toEqual([false, false, false, false]);
    // The landmark is drawn while it stands and gone when it does not.
    expect(shut.detail.tiles[2][2]).toBe(0);
    expect(open.detail.tiles[2][2]).toBe(-1);
  });

  it('says who holds a shut gate and that an open one is open', () => {
    expect(gateCaption(gate, false, 'WARDEN WREN')).toBe('TEST GATE\nHELD BY WARDEN WREN');
    expect(gateCaption(gate, false, undefined)).toBe('TEST GATE\nSHUT');
    expect(gateCaption(gate, true, 'WARDEN WREN')).toBe('TEST GATE\nOPEN');
  });

  it('names one keeper\'s doors in one caption, saying shared words once', () => {
    const doorsOf = (bossId: string) => WORLD_GATES.filter((one) => one.bossId === bossId);

    expect(jointGateCaption(doorsOf('overlook-warden'), false, 'WARDEN WREN')).toBe(
      'OVERLOOK GATE + STEPS\nHELD BY WARDEN WREN',
    );
    expect(jointGateCaption(doorsOf('overlook-warden'), true, 'WARDEN WREN')).toBe(
      'OVERLOOK GATE + STEPS\nOPEN',
    );
    // Doors with no word in common take a line each: on one line the caption
    // is wider than the ground either door has beside it.
    expect(jointGateCaption(doorsOf('floodplain-toll-keeper'), false, undefined)).toBe(
      'TOLL BRIDGE +\nORCHARD FORD\nSHUT',
    );
    // A shared word is only dropped from the front, and never the whole label.
    expect(jointGateLabel([gate, { ...gate, label: 'TEST' }])).toBe('TEST GATE +\nTEST');
  });

  it('groups a map\'s doors by keeper, front door first', () => {
    // Every gated map now, which is every map but none: two doors per keeper
    // is the shape, and a keeper with one door would be a boss who opens no
    // way back.
    for (const mapId of GATED_MAP_IDS) {
      const groups = gatesByKeeper(gatesForMap(mapId));
      expect(groups.flat()).toHaveLength(gatesForMap(mapId).length);
      for (const doors of groups) {
        expect(new Set(doors.map((door) => door.bossId)).size).toBe(1);
        expect(doors).toHaveLength(2);
      }
    }
  });

  it('announces the doors a win opened, and says they stay open', () => {
    expect(gatesOpenedLines([])).toEqual([]);
    expect(gatesOpenedLines([gate])).toEqual([
      'TEST GATE is open - and stays open on every raid from now on.',
    ]);
    expect(gatesOpenedLines([gate, second])).toEqual([
      'TEST GATE and FAR GATE are open - and stay open on every raid from now on.',
    ]);
  });
});

describe('drop-in wording', () => {
  it('says whether the lobby offers the landing yet', () => {
    expect(dropInCaption(false)).toBe('DROP-IN POINT');
    expect(dropInCaption(true)).toBe('DROP-IN READY');
  });

  it('tells the player the landing is theirs even if this raid is lost', () => {
    const line = dropInReachedLine('Overlook Landing');
    expect(line).toContain('OVERLOOK LANDING');
    expect(line).toContain('whether or not this one gets home');
  });
});
