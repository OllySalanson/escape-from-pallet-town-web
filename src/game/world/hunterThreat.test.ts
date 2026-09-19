import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { BULBASAUR, CHARMANDER, PIDGEY, SQUIRTLE } from '../pokemon/species';
import { generateRunPlan, RUN_GENERATION_BOUNDS } from '../run/runGeneration';
import { createHunterTrainer, HUNTER_TIERS } from './hunter';
import {
  applyHunterThreat,
  HUNTER_ARRIVAL_LEAD_PER_TIER_MS,
  hunterThreatFor,
  hunterThreatLine,
} from './hunterThreat';

const fainted = (pokemon: Pokemon): Pokemon => {
  pokemon.takeDamage(pokemon.maxHp);
  return pokemon;
};

describe('hunterThreatFor', () => {
  it('opens on the highest tier the strongest deployed Pokemon out-levels', () => {
    for (let level = 1; level <= 30; level += 1) {
      const { openingTier, tierOffset } = hunterThreatFor([new Pokemon(CHARMANDER, level)]);
      // Never above the party: a raised hunter is always one the lead out-levels.
      if (tierOffset > 0) {
        expect(openingTier.level).toBeLessThan(level);
      }
      // And never lower than it has to be: the next tier up would not be out-levelled.
      const next = HUNTER_TIERS[tierOffset + 1];
      if (next) {
        expect(next.level).toBeGreaterThanOrEqual(level);
      }
    }
  });

  it('brings the veteran a tier up and three fresh catches the tutorial hunter', () => {
    expect(hunterThreatFor([new Pokemon(CHARMANDER, 16)]).openingTier.level).toBe(12);
    expect(hunterThreatFor([new Pokemon(CHARMANDER, 10)]).openingTier.level).toBe(9);
    expect(
      hunterThreatFor([new Pokemon(PIDGEY, 6), new Pokemon(PIDGEY, 6), new Pokemon(PIDGEY, 6)]),
    ).toMatchObject({ tierOffset: 0, arrivesSoonerMs: 0, openingTier: { level: 6 } });
  });

  it('reads the strongest Pokemon, so weak company neither raises nor lowers the price', () => {
    const alone = hunterThreatFor([new Pokemon(CHARMANDER, 13)]);
    const escorted = hunterThreatFor([
      new Pokemon(PIDGEY, 3),
      new Pokemon(CHARMANDER, 13),
      new Pokemon(PIDGEY, 4),
    ]);
    expect(escorted).toEqual(alone);
    expect(escorted.matchedTo).toEqual({ name: 'Charmander', level: 13 });
  });

  /**
   * The risk the design names: a wipe takes the team and leaves one Pokemon, and
   * the hunter must not still be priced for the team that died.
   */
  it('puts a recovering player with one Pokemon left back on the first tier', () => {
    const veterans = [new Pokemon(CHARMANDER, 16), new Pokemon(SQUIRTLE, 14), new Pokemon(PIDGEY, 9)];
    expect(hunterThreatFor(veterans).tierOffset).toBe(HUNTER_TIERS.length - 1);

    // What every recovery path hands back: a fresh level-5 starter, or the one
    // low catch the secure slot saved.
    for (const survivor of [new Pokemon(BULBASAUR, 5), new Pokemon(PIDGEY, 6)]) {
      const threat = hunterThreatFor([survivor]);
      expect(threat).toMatchObject({ tierOffset: 0, arrivesSoonerMs: 0 });
      expect(threat.openingTier).toBe(HUNTER_TIERS[0]);
      expect(threat.matchedTo).toBeUndefined();
    }
  });

  it('does not charge for a veteran who came along fainted', () => {
    const threat = hunterThreatFor([fainted(new Pokemon(CHARMANDER, 16)), new Pokemon(PIDGEY, 6)]);
    expect(threat.tierOffset).toBe(0);
    expect(hunterThreatFor([]).tierOffset).toBe(0);
  });

  it('stays inside the tiers that exist however strong the party is', () => {
    const threat = hunterThreatFor([new Pokemon(CHARMANDER, 100)]);
    expect(threat.tierOffset).toBe(HUNTER_TIERS.length - 1);
    expect(threat.openingTier).toBe(HUNTER_TIERS[HUNTER_TIERS.length - 1]);
  });
});

describe('a raid generated for a party', () => {
  const planFor = (seed: number, party: readonly Pokemon[]) =>
    generateRunPlan(seed, undefined, 'floodplain-relay', undefined, hunterThreatFor(party));

  it('fields the matched team at first contact and the same team a weak party would meet later', () => {
    const strong = planFor(7, [new Pokemon(CHARMANDER, 16)]);
    const weak = planFor(7, [new Pokemon(PIDGEY, 6)]);

    expect(createHunterTrainer(0, false, weak.hunter).party.map((pokemon) => pokemon.level)).toEqual([6]);
    expect(createHunterTrainer(0, false, strong.hunter).party.map((pokemon) => pokemon.level)).toEqual([12, 12, 12]);
    // Time still escalates a matched hunter, and the offset never leaves the ladder.
    expect(createHunterTrainer(240_000, false, strong.hunter).party).toHaveLength(3);
    expect(createHunterTrainer(0, true, weak.hunter).party.map((pokemon) => pokemon.level)).toEqual([15, 15, 15]);
  });

  it('arrives sooner for a stronger party, and never at the start of the raid', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const weak = planFor(seed, [new Pokemon(PIDGEY, 6)]);
      const strong = planFor(seed, [new Pokemon(CHARMANDER, 16)]);
      expect(weak.hunter.spawnDelayMs).toBeGreaterThanOrEqual(RUN_GENERATION_BOUNDS.hunterSpawnDelayMinimumMs);
      expect(weak.hunter.spawnDelayMs - strong.hunter.spawnDelayMs).toBe(
        HUNTER_ARRIVAL_LEAD_PER_TIER_MS * (HUNTER_TIERS.length - 1),
      );
      expect(strong.hunter.spawnDelayMs).toBeGreaterThanOrEqual(20_000);
    }
  });

  it('changes nothing else about the raid, so the party is priced in hunter and only in hunter', () => {
    const { hunter: weakHunter, ...weak } = planFor(11, [new Pokemon(PIDGEY, 6)]);
    const { hunter: strongHunter, ...strong } = planFor(11, [new Pokemon(CHARMANDER, 16)]);
    expect(strong).toEqual(weak);
    expect(strongHunter).not.toEqual(weakHunter);
  });

  it('leaves a tuning it is not given a threat for exactly as seeded', () => {
    const plan = generateRunPlan(11, undefined, 'floodplain-relay');
    expect(applyHunterThreat(plan.hunter, hunterThreatFor([]))).toEqual(plan.hunter);
  });
});

describe('contract pressure', () => {
  it('adds tiers on the party’s own ladder, so a weak party loses its discount', () => {
    const rookie = [new Pokemon(BULBASAUR, 5)];
    expect(hunterThreatFor(rookie, 0)).toEqual(hunterThreatFor(rookie));
    expect(hunterThreatFor(rookie, 1)).toMatchObject({
      tierOffset: 1,
      contractTiers: 1,
      openingTier: { level: 9 },
      arrivesSoonerMs: HUNTER_ARRIVAL_LEAD_PER_TIER_MS,
    });
    // Nothing the player brought raised it, so no Pokemon is named for it.
    expect(hunterThreatFor(rookie, 2).matchedTo).toBeUndefined();
  });

  it('never leaves the ladder: a veteran already at the top pays nothing more', () => {
    const veteran = [new Pokemon(CHARMANDER, 16)];
    for (const pressure of [1, 2, 9]) {
      expect(hunterThreatFor(veteran, pressure)).toMatchObject({
        tierOffset: HUNTER_TIERS.length - 1,
        contractTiers: 0,
        arrivesSoonerMs: hunterThreatFor(veteran).arrivesSoonerMs,
      });
    }
    expect(hunterThreatFor([new Pokemon(CHARMANDER, 12)], 5)).toMatchObject({
      tierOffset: HUNTER_TIERS.length - 1,
      contractTiers: 1,
    });
  });

  it('still never arrives at the start of the raid, however much is stacked on it', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const plan = generateRunPlan(
        seed,
        undefined,
        'floodplain-relay',
        undefined,
        hunterThreatFor([new Pokemon(CHARMANDER, 16)], 9),
      );
      expect(plan.hunter.spawnDelayMs).toBeGreaterThanOrEqual(20_000);
    }
  });
});

describe('hunterThreatLine', () => {
  it('says what the contract added, beside what the party did', () => {
    expect(hunterThreatLine(hunterThreatFor([new Pokemon(CHARMANDER, 12)], 1))).toEqual({
      heading: 'Hunter tier 3 of 3',
      detail: 'Lv 12 team of 3, arrives 30s sooner - your Lv 12 Charmander, +1 contract',
    });
    expect(hunterThreatLine(hunterThreatFor([new Pokemon(BULBASAUR, 5)], 1))).toEqual({
      heading: 'Hunter tier 2 of 3',
      detail: 'Lv 9 team of 2, arrives 15s sooner - +1 for the contract',
    });
  });

  it('names the tier, the team and the Pokemon that set it', () => {
    expect(hunterThreatLine(hunterThreatFor([new Pokemon(CHARMANDER, 12)]))).toEqual({
      heading: 'Hunter tier 2 of 3',
      detail: 'Lv 9 team of 2, arrives 15s sooner - matched to your Lv 12 Charmander',
    });
  });

  it('says plainly when the party has not raised it', () => {
    expect(hunterThreatLine(hunterThreatFor([new Pokemon(BULBASAUR, 5)]))).toEqual({
      heading: 'Hunter tier 1 of 3',
      detail: 'Lv 6 team of 1 - nothing you are bringing out-levels it',
    });
  });
});
