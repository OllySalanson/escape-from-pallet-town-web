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
import { bossEncounters, createRunTrainerEncounters, withoutDefeatedBosses } from './trainers';
import { heldLandingNews } from '../hub/firstWords';
import {
  gymsBefore,
  isLandingOpen,
  KOGA_BOSS_ID,
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

const GYM_QUARTERS = VALE_QUARTERS.filter((quarter) => quarter.gym !== undefined);

describe("Greystone Vale's quarters", () => {
  it('put every landing on the vale in exactly one quarter', () => {
    const landings = insertionsOn(VALE).map((insertion) => insertion.id);
    const listed = VALE_QUARTERS.flatMap((quarter) => quarter.landings);
    expect([...listed].sort()).toEqual([...new Set(listed)].sort());
    for (const id of listed) {
      expect(Object.hasOwn(RUN_INSERTIONS, id)).toBe(true);
    }
    // The open vale's, the Coast's and the Marsh's, and nothing past a gym
    // still to be built: the Station's is Lt. Surge's.
    const unbuilt = landings.filter((id) => !listed.includes(id));
    expect(unbuilt).toEqual(['greystone-vale-the-dam']);
  });

  it("name a gym only for a boss that stands, with two doors or more, on the vale", () => {
    const bosses = bossEncounters(createRunTrainerEncounters());
    const gates = gatesForMap(VALE);
    for (const quarter of VALE_QUARTERS.filter((one) => one.gym)) {
      const gym = quarter.gym!;
      expect(bosses.find((boss) => boss.bossId === gym.bossId)?.mapId).toBe(VALE);
      // Two at least: Koga holds a third, the road down from the Station,
      // until Lt. Surge's gym holds the Station and takes it over.
      expect(gates.filter((gate) => gate.bossId === gym.bossId).length).toBeGreaterThanOrEqual(2);
      expect(quarterHeldBy(gym.bossId)).toBe(quarter);
      for (const keeper of quarter.keepersInside ?? []) {
        expect(bosses.some((boss) => boss.bossId === keeper && boss.mapId === VALE)).toBe(true);
      }
    }
  });

  /**
   * The promise a gym makes: with every other door this save could have open
   * - the Cut tree, the night track, every keeper's barricades and every other
   * gym's doors, whichever an old save beat first - nothing of its quarter can
   * be reached from any landing a save is offered, on foot, by boat, through a
   * cave or over a ledge. And with the gyms up to it beaten it all can.
   */
  it.each(GYM_QUARTERS.map((quarter) => [quarter.name, quarter] as const))(
    'keeps %s out of reach of every open landing until its gym is beaten, and opens it after',
    (_name, quarter) => {
      const gym = quarter.gym!;
      const allButGym = gateKeys(gatesForMap(VALE)).filter((key) => key !== gym.bossId);
      const shut = getWorldMap(VALE, allButGym);
      const tiles = quarterTiles(quarter.districts, shut.width);
      expect(tiles.length).toBeGreaterThan(1000);
      const offered = insertionsOn(VALE).filter((insertion) => isLandingOpen(insertion.id, allButGym));
      for (const landing of quarter.landings) {
        expect(offered.map((insertion) => insertion.id)).not.toContain(landing);
      }
      // The way up to each of the gym's doors is the quarter's own edge, and
      // the door is where the walk ends: two tiles of road or path.
      const doors = gatesForMap(VALE).filter((gate) => gate.bossId === gym.bossId).flatMap((gate) => gate.tiles);
      const approach = (tile: number): boolean =>
        doors.some(
          (door) => Math.abs(door.x - (tile % shut.width)) + Math.abs(door.y - Math.floor(tile / shut.width)) <= 2,
        );
      for (const insertion of offered) {
        const got = reachable(shut, insertion.position);
        expect(`${insertion.label}: ${tiles.filter((tile) => got.has(tile) && !approach(tile)).length} tiles of ${quarter.name}`).toBe(
          `${insertion.label}: 0 tiles of ${quarter.name}`,
        );
      }

      const open = getWorldMap(VALE, [...gymsBefore(gym.bossId), gym.bossId]);
      const fromTheFrontDoor = reachable(open, requireInsertion('greystone-vale').position);
      for (const id of quarter.landings) {
        const { position, label } = requireInsertion(id as RunInsertionId);
        expect(`${label} ${fromTheFrontDoor.has(position.y * open.width + position.x)}`).toBe(`${label} true`);
      }
    },
  );

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
  it('asks the gate states a save can walk, and only those', () => {
    const states = gateStatesToVerify(gatesForMap(VALE));
    // Every door shut; the Cut tree; the night track; Misty's; Misty's and
    // Koga's, because he fights only a holder of her badge; and every door.
    expect(states).toHaveLength(6);
    expect(states).toContainEqual([MISTY_BOSS_ID]);
    expect(states).toContainEqual([MISTY_BOSS_ID, KOGA_BOSS_ID]);
    expect(states).not.toContainEqual([KOGA_BOSS_ID]);
    expect(states).not.toContainEqual(['vale-quay-keeper']);
    expect(states.at(-1)).toEqual(expect.arrayContaining([MISTY_BOSS_ID, KOGA_BOSS_ID, 'vale-quay-keeper']));
  });

  it('offers the Marsh’s landings only with the SOUL BADGE, and tells an old save once', () => {
    const progress = {
      unlockedInsertions: [],
      reachedInsertions: ['greystone-vale-rest-house', 'greystone-vale-old-quay', 'greystone-vale-the-strand'],
      completedContracts: [],
      defeatedBosses: [MISTY_BOSS_ID] as string[],
    };
    expect(availableInsertionIds(progress)).not.toContain('greystone-vale-rest-house');
    expect(landingsHeldBack(progress)).toEqual(['greystone-vale-rest-house']);
    expect(heldLandingNews(progress)).toBe('marsh');
    expect(heldLandingNews({ ...progress, firstWordsHeard: ['marsh'] })).toBeUndefined();
    const won = { ...progress, defeatedBosses: [MISTY_BOSS_ID, KOGA_BOSS_ID] };
    expect(availableInsertionIds(won)).toContain('greystone-vale-rest-house');
    expect(heldLandingNews(won)).toBeUndefined();
    // Both quarters held back: the news is told a quarter at a time.
    const both = { ...progress, defeatedBosses: [] as string[] };
    expect(heldLandingNews(both)).toBe('marsh');
    expect(heldLandingNews({ ...both, firstWordsHeard: ['marsh'] })).toBe('coast');
  });

  it('puts Koga in his gym only for a holder of the CASCADE BADGE', () => {
    const koga = (defeated: readonly string[]) =>
      withoutDefeatedBosses(createRunTrainerEncounters(), defeated).some((one) => one.bossId === KOGA_BOSS_ID);
    expect(koga([])).toBe(false);
    expect(koga([MISTY_BOSS_ID])).toBe(true);
    expect(koga([MISTY_BOSS_ID, KOGA_BOSS_ID])).toBe(false);
    // His hall is open all the same, and his trainers stand in it.
    const hall = withoutDefeatedBosses(createRunTrainerEncounters(), []).filter((one) =>
      one.trainer.id.startsWith('vale-gym-koga-'),
    );
    expect(hall).toHaveLength(2);
  });
});
