import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { BULBASAUR, CHARMANDER, IVYSAUR, PIDGEY, SQUIRTLE } from '../pokemon/species';
import { generateRunPlan, RUN_GENERATION_BOUNDS } from '../run/runGeneration';
import { createHunterTrainer, HUNTER_TIERS } from './hunter';
import {
  applyHunterThreat,
  HUNTER_ARRIVAL_LEAD_PER_TIER_MS,
  HUNTER_EARLIEST_ARRIVAL_MS,
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
    expect(hunterThreatFor([new Pokemon(IVYSAUR, 16)]).openingTier.level).toBe(15);
    expect(hunterThreatFor([new Pokemon(CHARMANDER, 13)]).openingTier.level).toBe(12);
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
    const veterans = [new Pokemon(IVYSAUR, 16), new Pokemon(SQUIRTLE, 14), new Pokemon(PIDGEY, 9)];
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
    const threat = hunterThreatFor([fainted(new Pokemon(IVYSAUR, 16)), new Pokemon(PIDGEY, 6)]);
    expect(threat.tierOffset).toBe(0);
    expect(hunterThreatFor([]).tierOffset).toBe(0);
  });

  /**
   * The regression the fourth rung exists for. Evolution begins at level 16, and
   * with three rungs a party that had crossed it drew the top of the ladder and
   * could never draw anything else - the failure the whole progression pass was
   * built to prevent, arriving at the moment getting stronger started to matter.
   *
   * The rung is pitched at level 15 precisely so that 16 opens it: the ladder
   * answers evolution on the level that grants it, not three levels later.
   */
  it('answers a party that has just evolved with a rung the old ladder did not have', () => {
    const justEvolved = hunterThreatFor([new Pokemon(IVYSAUR, 16), new Pokemon(PIDGEY, 14)]);
    expect(justEvolved.tierOffset).toBe(HUNTER_TIERS.length - 1);
    // The old top rung is what it used to draw, and the rung it draws now is a
    // bigger team than that - so evolving costs hunter rather than capping it.
    const oldTop = HUNTER_TIERS[HUNTER_TIERS.length - 2];
    expect(justEvolved.openingTier.party.length).toBeGreaterThan(oldTop.party.length);
    expect(justEvolved.openingTier.level).toBeGreaterThan(oldTop.level);

    // One level short of evolving is still a rung below it, so the step is the
    // evolution and not the walk up to it.
    expect(hunterThreatFor([new Pokemon(BULBASAUR, 15)]).tierOffset).toBe(HUNTER_TIERS.length - 2);
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
    const strong = planFor(7, [new Pokemon(IVYSAUR, 16)]);
    const weak = planFor(7, [new Pokemon(PIDGEY, 6)]);

    expect(createHunterTrainer(0, false, weak.hunter).party.map((pokemon) => pokemon.level)).toEqual([6]);
    expect(createHunterTrainer(0, false, strong.hunter).party.map((pokemon) => pokemon.level)).toEqual([15, 15, 15, 15]);
    // Time still escalates a matched hunter, and the offset never leaves the ladder.
    expect(createHunterTrainer(240_000, false, strong.hunter).party).toHaveLength(4);
    expect(createHunterTrainer(0, true, weak.hunter).party.map((pokemon) => pokemon.level)).toEqual([19, 19, 19, 19]);
  });

  it('arrives sooner for a stronger party, and never at the start of the raid', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const weak = planFor(seed, [new Pokemon(PIDGEY, 6)]);
      const strong = planFor(seed, [new Pokemon(IVYSAUR, 16)]);
      expect(weak.hunter.spawnDelayMs).toBeGreaterThanOrEqual(RUN_GENERATION_BOUNDS.hunterSpawnDelayMinimumMs);
      expect(weak.hunter.spawnDelayMs - strong.hunter.spawnDelayMs).toBe(
        HUNTER_ARRIVAL_LEAD_PER_TIER_MS * (HUNTER_TIERS.length - 1),
      );
      expect(strong.hunter.spawnDelayMs).toBeGreaterThanOrEqual(HUNTER_EARLIEST_ARRIVAL_MS);
    }
  });

  it('changes nothing else about the raid, so the party is priced in hunter and only in hunter', () => {
    const { hunter: weakHunter, ...weak } = planFor(11, [new Pokemon(PIDGEY, 6)]);
    const { hunter: strongHunter, ...strong } = planFor(11, [new Pokemon(IVYSAUR, 16)]);
    expect(strong).toEqual(weak);
    expect(strongHunter).not.toEqual(weakHunter);
  });

  /**
   * The lead is the one part of the price that a longer ladder could quietly
   * change: three rungs above the first at fifteen seconds each was thirty
   * seconds off a 55s floor, and a fourth rung at the same rate would have put
   * the hardest opening at ten seconds - the hunter on you before the briefing
   * is read. So it is recomputed here from the floor rather than pinned to a
   * number, and growing the ladder again fails in this file.
   */
  it('spends the whole arrival lead on the ladder and no more', () => {
    const rungsAboveTheFirst = HUNTER_TIERS.length - 1;
    expect(HUNTER_ARRIVAL_LEAD_PER_TIER_MS * rungsAboveTheFirst).toBe(
      RUN_GENERATION_BOUNDS.hunterSpawnDelayMinimumMs - HUNTER_EARLIEST_ARRIVAL_MS,
    );
    expect(HUNTER_EARLIEST_ARRIVAL_MS).toBeGreaterThan(0);
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
    const veteran = [new Pokemon(IVYSAUR, 16)];
    for (const pressure of [1, 2, 9]) {
      expect(hunterThreatFor(veteran, pressure)).toMatchObject({
        tierOffset: HUNTER_TIERS.length - 1,
        contractTiers: 0,
        arrivesSoonerMs: hunterThreatFor(veteran).arrivesSoonerMs,
      });
    }
    expect(hunterThreatFor([new Pokemon(CHARMANDER, 12)], 5)).toMatchObject({
      tierOffset: HUNTER_TIERS.length - 1,
      contractTiers: 2,
    });
  });

  it('still never arrives at the start of the raid, however much is stacked on it', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const plan = generateRunPlan(
        seed,
        undefined,
        'floodplain-relay',
        undefined,
        hunterThreatFor([new Pokemon(IVYSAUR, 16)], 9),
      );
      expect(plan.hunter.spawnDelayMs).toBeGreaterThanOrEqual(HUNTER_EARLIEST_ARRIVAL_MS);
    }
  });
});

describe('hunterThreatLine', () => {
  it('says what the contract added, beside what the party did', () => {
    expect(hunterThreatLine(hunterThreatFor([new Pokemon(CHARMANDER, 12)], 1))).toEqual({
      heading: 'Hunter tier 3 of 4',
      detail: 'Lv 12 team of 3, arrives 20s sooner - your Lv 12 Charmander, +1 contract',
    });
    expect(hunterThreatLine(hunterThreatFor([new Pokemon(BULBASAUR, 5)], 1))).toEqual({
      heading: 'Hunter tier 2 of 4',
      detail: 'Lv 9 team of 2, arrives 10s sooner - +1 for the contract',
    });
  });

  it('names the tier, the team and the Pokemon that set it', () => {
    expect(hunterThreatLine(hunterThreatFor([new Pokemon(CHARMANDER, 12)]))).toEqual({
      heading: 'Hunter tier 2 of 4',
      detail: 'Lv 9 team of 2, arrives 10s sooner - matched to your Lv 12 Charmander',
    });
  });

  it('says plainly when the party has not raised it', () => {
    expect(hunterThreatLine(hunterThreatFor([new Pokemon(BULBASAUR, 5)]))).toEqual({
      heading: 'Hunter tier 1 of 4',
      detail: 'It fields a Lv 6 team of 1 - nothing you bring out-levels it',
    });
  });
});
