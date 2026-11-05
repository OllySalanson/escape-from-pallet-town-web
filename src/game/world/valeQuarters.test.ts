import { describe, expect, it } from 'vitest';
import { DIRECTION_DELTAS, linkKey, STEP_DIRECTIONS, type GridPosition } from '../movement/gridMovement';
import {
  availableInsertionIds,
  insertionsOn,
  requireInsertion,
  RUN_INSERTIONS,
  type RunInsertionId,
} from '../run/runGeneration';
import { getWorldMap, type WorldMapDefinition } from '../worldMap';
import { districtsForMap } from './districts';
import { gateKeys, gatesForMap, gateStatesToVerify } from './gates';
import { ledgeLanding, ledgesForMap } from './ledges';
import { playerLinks } from './sailing';
import { bossEncounters, createRunTrainerEncounters } from './trainers';
import {
  isLandingOpen,
  landingsHeldBack,
  MISTY_BOSS_ID,
  quarterHeldBy,
  VALE_QUARTERS,
} from './valeQuarters';

const VALE = 'greystone-vale' as const;

/**
 * Every tile a player can get to from here: walking, through every door and
 * cave ladder, on every boat, and over every ledge - as generous as the game
 * is, so "cannot get there" is a promise and not a guess.
 */
function reachable(map: WorldMapDefinition, from: GridPosition): Set<number> {
  const links = playerLinks(map);
  const ledges = ledgesForMap(VALE);
  const brows = new Map<number, (typeof ledges)[number][]>();
  for (const ledge of ledges) {
    for (const tile of ledge.brow) {
      const index = tile.y * map.width + tile.x;
      brows.set(index, [...(brows.get(index) ?? []), ledge]);
    }
  }
  const open = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < map.width && y < map.height && map.collision[y]?.[x] === false;
  const seen = new Set<number>([from.y * map.width + from.x]);
  const queue = [from.y * map.width + from.x];
  while (queue.length > 0) {
    const index = queue.pop()!;
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    const next: number[] = [];
    STEP_DIRECTIONS.forEach((direction, number) => {
      const linked = links?.get(linkKey(index, number));
      if (linked !== undefined) {
        next.push(linked);
        return;
      }
      const delta = DIRECTION_DELTAS[direction];
      if (open(x + delta.x, y + delta.y)) {
        next.push((y + delta.y) * map.width + x + delta.x);
      }
    });
    for (const ledge of brows.get(index) ?? []) {
      const landing = ledgeLanding(ledge, { x, y });
      if (open(landing.x, landing.y)) {
        next.push(landing.y * map.width + landing.x);
      }
    }
    for (const tile of next) {
      if (!seen.has(tile)) {
        seen.add(tile);
        queue.push(tile);
      }
    }
  }
  return seen;
}

/** The outdoor tiles of a quarter's districts, by the names the stitched file gives them. */
function quarterTiles(names: readonly string[], width: number): number[] {
  const tiles: number[] = [];
  for (const district of districtsForMap(VALE).filter((one) => names.includes(one.name))) {
    for (const area of district.areas) {
      for (let y = area.y; y < area.y + area.height; y += 1) {
        for (let x = area.x; x < area.x + area.width; x += 1) {
          tiles.push(y * width + x);
        }
      }
    }
  }
  return tiles;
}

const coast = VALE_QUARTERS.find((quarter) => quarter.gym?.bossId === MISTY_BOSS_ID)!;

describe("Greystone Vale's quarters", () => {
  it('put every landing on the vale in exactly one quarter', () => {
    const landings = insertionsOn(VALE).map((insertion) => insertion.id);
    const listed = VALE_QUARTERS.flatMap((quarter) => quarter.landings);
    expect([...listed].sort()).toEqual([...new Set(listed)].sort());
    for (const id of listed) {
      expect(Object.hasOwn(RUN_INSERTIONS, id)).toBe(true);
    }
    // The open vale's and the Coast's, and nothing past a gym still to be built.
    const unbuilt = landings.filter((id) => !listed.includes(id));
    expect(unbuilt).toEqual([
      'greystone-vale-the-dam',
      'greystone-vale-rest-house',
      'greystone-vale-salvage-camp',
    ]);
  });

  it("name a gym only for a boss that stands, with two doors, on the vale", () => {
    const bosses = bossEncounters(createRunTrainerEncounters());
    const gates = gatesForMap(VALE);
    for (const quarter of VALE_QUARTERS.filter((one) => one.gym)) {
      const gym = quarter.gym!;
      expect(bosses.find((boss) => boss.bossId === gym.bossId)?.mapId).toBe(VALE);
      expect(gates.filter((gate) => gate.bossId === gym.bossId)).toHaveLength(2);
      expect(quarterHeldBy(gym.bossId)).toBe(quarter);
      for (const keeper of quarter.keepersInside ?? []) {
        expect(bosses.some((boss) => boss.bossId === keeper && boss.mapId === VALE)).toBe(true);
      }
    }
  });

  /**
   * The promise the gym makes: with every other door this save could have open
   * - the Cut tree, the night track, and Boatswain Cragg's barricades, which an
   * old save beat before Misty held the Coast - nothing of the Coast can be
   * reached from any landing a save is offered, on foot, by boat, through a
   * cave or over a ledge. And with her beaten it all can.
   */
  it('keeps the Coast out of reach of every open landing until Misty is beaten, and opens it after', () => {
    const allButMisty = gateKeys(gatesForMap(VALE)).filter((key) => key !== MISTY_BOSS_ID);
    const shut = getWorldMap(VALE, allButMisty);
    const tiles = quarterTiles(coast.districts, shut.width);
    expect(tiles.length).toBeGreaterThan(1000);
    const offered = insertionsOn(VALE).filter((insertion) => isLandingOpen(insertion.id, allButMisty));
    expect(offered.map((insertion) => insertion.id)).not.toContain('greystone-vale-old-quay');
    // The way up to each of her doors is the Coast's own edge, and the door is
    // where the walk ends: two tiles of jetty and two of deer path.
    const doors = gatesForMap(VALE).filter((gate) => gate.bossId === MISTY_BOSS_ID).flatMap((gate) => gate.tiles);
    const approach = (tile: number): boolean =>
      doors.some(
        (door) => Math.abs(door.x - (tile % shut.width)) + Math.abs(door.y - Math.floor(tile / shut.width)) <= 2,
      );
    for (const insertion of offered) {
      const got = reachable(shut, insertion.position);
      expect(`${insertion.label}: ${tiles.filter((tile) => got.has(tile) && !approach(tile)).length} Coast tiles`).toBe(
        `${insertion.label}: 0 Coast tiles`,
      );
    }

    const open = getWorldMap(VALE, [MISTY_BOSS_ID]);
    const fromTheFrontDoor = reachable(open, requireInsertion('greystone-vale').position);
    for (const id of coast.landings) {
      const { position, label } = requireInsertion(id as RunInsertionId);
      expect(`${label} ${fromTheFrontDoor.has(position.y * open.width + position.x)}`).toBe(`${label} true`);
    }
  });

  it('offers the Coast’s landings only with the CASCADE BADGE, and keeps them reached', () => {
    const progress = {
      unlockedInsertions: [],
      reachedInsertions: ['greystone-vale-old-quay', 'greystone-vale-the-strand'],
      completedContracts: [],
      defeatedBosses: [] as string[],
    };
    const before = availableInsertionIds(progress);
    expect(before).toContain('greystone-vale-the-strand');
    expect(before).not.toContain('greystone-vale-old-quay');
    expect(landingsHeldBack(progress)).toEqual(['greystone-vale-old-quay']);
    const after = availableInsertionIds({ ...progress, defeatedBosses: [MISTY_BOSS_ID] });
    expect(after).toContain('greystone-vale-old-quay');
    expect(landingsHeldBack({ ...progress, defeatedBosses: [MISTY_BOSS_ID] })).toEqual([]);
  });

  /**
   * A keeper behind a gym's doors is asked about with them open, never alone:
   * with the gym shut nobody can walk to his doors, and asking that state too
   * would add a whole sweep of the vale per gym (`gateStatesToVerify`).
   */
  it('asks the gate states a save can walk, and no more of them than before the gym', () => {
    const states = gateStatesToVerify(gatesForMap(VALE));
    expect(states).toHaveLength(5);
    expect(states).toContainEqual([MISTY_BOSS_ID]);
    expect(states).not.toContainEqual(['vale-quay-keeper']);
    expect(states.at(-1)).toEqual(expect.arrayContaining([MISTY_BOSS_ID, 'vale-quay-keeper']));
  });
});
