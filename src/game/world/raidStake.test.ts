import { describe, expect, it } from 'vitest';
import { FIRST_RAID_CHASE_MS, generateRunPlan, insertionsOn } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { isStake, isStakeMoney, isStakeTrail, prizesLeftBehind, prizeWords } from './loot';
import { stepDistances } from './mapStructure';
import {
  IN_SIGHT,
  STAKE_LEAST_WALK,
  STAKE_LEAST_WALK_OUT,
  STAKE_MOST_WALK,
  WALK_OUT_TRIP_STEPS,
  aheadOnWalk,
  hasRaidStake,
} from './raidStake';

const MAP_ID = 'greystone-vale';
const SEEDS = [1, 2, 3, 7, 11, 19, 31, 53, 89, 144];
const landings = insertionsOn(MAP_ID);

const openExitsOf = (plan: ReturnType<typeof generateRunPlan>) =>
  plan.extractionPoints.filter(
    (point) => point.mapId === MAP_ID && (point.requirement?.kind === 'always' || (point.requirement === undefined && point.unlockAtMs === 0)),
  );

describe('what a raid on the vale is for', () => {
  const map = getWorldMap(MAP_ID, []);

  it('is on the only map a save is offered, and not on a player map', () => {
    expect(hasRaidStake(MAP_ID)).toBe(true);
    expect(hasRaidStake('player-anything')).toBe(false);
  });

  it.each(landings.map((landing) => landing.id))('lays a stake a good walk from %s and a little too far from any way out', (id) => {
    const insertion = landings.find((landing) => landing.id === id)!;
    const steps = stepDistances(map.collision, insertion.position);
    const faults: string[] = [];
    for (const seed of SEEDS) {
      const plan = generateRunPlan(seed, undefined, id);
      const stake = plan.loot[MAP_ID].find((loot) => isStake(loot));
      if (!stake) {
        faults.push(`seed ${seed} has no stake`);
        continue;
      }
      const walk = steps[stake.position.y][stake.position.x];
      if (walk < STAKE_LEAST_WALK || walk > STAKE_MOST_WALK) {
        faults.push(`seed ${seed}: the stake is ${walk} steps off`);
      }
      const back = stepDistances(map.collision, stake.position);
      const out = Math.min(...openExitsOf(plan).map((exit) => back[exit.position.y][exit.position.x]).filter((each) => each >= 0));
      if (out < STAKE_LEAST_WALK_OUT) {
        faults.push(`seed ${seed}: a way out only ${out} steps from the stake`);
      }
    }
    expect(faults).toEqual([]);
  });

  it('puts the first money in sight of the landing, and every piece of the trail on its own tile', () => {
    for (const landing of landings) {
      for (const seed of SEEDS.slice(0, 4)) {
        const plan = generateRunPlan(seed, undefined, landing.id);
        const loot = plan.loot[MAP_ID];
        const first = loot.find((piece) => piece.id.endsWith('/stake-money-1'));
        expect(first, `${landing.id} ${seed}`).toBeDefined();
        expect(Math.abs(first!.position.x - landing.position.x)).toBeLessThanOrEqual(IN_SIGHT.across);
        expect(Math.abs(first!.position.y - landing.position.y)).toBeLessThanOrEqual(IN_SIGHT.down);
        const tiles = loot.map((piece) => `${piece.position.x},${piece.position.y}`);
        expect(new Set(tiles).size, `${landing.id} ${seed}`).toBe(tiles.length);
      }
    }
  });

  it('lays nothing ordinary on the ground a walk straight out could call in on', () => {
    const insertion = landings[0];
    const steps = stepDistances(map.collision, insertion.position);
    for (const seed of SEEDS) {
      const plan = generateRunPlan(seed, undefined, insertion.id);
      const near = plan.loot[MAP_ID].filter(
        (piece) => !isStakeTrail(piece) && piece.chance === undefined && piece.district === undefined,
      ).filter((piece) => {
        const walk = steps[piece.position.y]?.[piece.position.x] ?? -1;
        if (walk < 0) {
          return false;
        }
        const back = stepDistances(map.collision, piece.position);
        const out = Math.min(...openExitsOf(plan).map((exit) => back[exit.position.y][exit.position.x]).filter((each) => each >= 0));
        return walk + out < WALK_OUT_TRIP_STEPS;
      });
      expect(near, `seed ${seed}`).toEqual([]);
    }
  });

  it('moves no other roll of a seed', () => {
    const plain = generateRunPlan(5, undefined, 'greystone-vale');
    const first = generateRunPlan(5, undefined, 'greystone-vale', undefined, undefined, [], { firstRaid: true });
    const withoutTrail = (plan: typeof plain) => plan.loot[MAP_ID].filter((piece) => !isStakeTrail(piece));
    expect(withoutTrail(first)).toEqual(withoutTrail(plain));
    expect(first.trainers.map((trainer) => trainer.position)).toEqual(plain.trainers.map((trainer) => trainer.position));
    expect(first.extractionPoints).toEqual(plain.extractionPoints);
  });

  it('is the same stake for the same seed, and not the same stake every seed', () => {
    const stakeOf = (seed: number) => generateRunPlan(seed, undefined, 'greystone-vale').loot[MAP_ID].find((piece) => isStake(piece))!;
    expect(stakeOf(9)).toEqual(stakeOf(9));
    expect(new Set(SEEDS.map((seed) => `${stakeOf(seed).position.x},${stakeOf(seed).position.y}`)).size).toBeGreaterThan(5);
    expect(new Set(SEEDS.map((seed) => stakeOf(seed).itemId)).size).toBeGreaterThan(1);
  });

  it('pays a new save its first raid in money, chases it at forty seconds, and stages nothing after that', () => {
    const first = generateRunPlan(5, undefined, 'greystone-vale', undefined, undefined, [], { firstRaid: true });
    const stake = first.loot[MAP_ID].find((piece) => isStake(piece))!;
    expect(stake.itemId).toBe('money');
    expect(first.stagedChase).toBe(true);
    expect(first.hunter.spawnDelayMs).toBe(FIRST_RAID_CHASE_MS);
    const later = generateRunPlan(5, undefined, 'greystone-vale');
    expect(later.stagedChase).toBeUndefined();
    expect(later.hunter.spawnDelayMs).toBeGreaterThan(FIRST_RAID_CHASE_MS);
  });

  it('rues the stake on the result screen and never the money on the way to it', () => {
    const money = { id: 'greystone-vale/stake-money-1', position: { x: 1, y: 1 }, itemId: 'money', quantity: 10, chance: 1 } as const;
    const stake = { id: 'greystone-vale/stake', position: { x: 2, y: 2 }, itemId: 'money', quantity: 90, chance: 1 } as const;
    expect(isStakeMoney(money)).toBe(true);
    expect(prizeWords(stake)).toBe('₽90');
    expect(prizesLeftBehind({ [MAP_ID]: [money, stake] }, new Set([money.id, stake.id]), new Set())).toEqual(['₽90']);
  });

  it('points along the walk rather than straight at a wall', () => {
    const open = [
      [false, false, false, false, false],
      [true, true, true, true, false],
      [false, false, false, false, false],
    ];
    const field = stepDistances(open, { x: 0, y: 2 });
    // Straight down is a wall: the walk goes right, round the end of it.
    expect(aheadOnWalk(field, { x: 0, y: 0 }, { x: 0, y: 2 })).toEqual({ x: 2, y: 2 });
    // Off the field altogether it can only point at the thing itself.
    expect(aheadOnWalk(field, { x: 0, y: 1 }, { x: 0, y: 2 })).toEqual({ x: 0, y: 2 });
  });
});
