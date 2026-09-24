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
import { FIRST_HUNTER_RIVAL } from './hunters';

const fainted = (pokemon: Pokemon): Pokemon => {
  pokemon.takeDamage(pokemon.maxHp);
  return pokemon;
};

describe('hunterThreatFor', () => {
  /**
   * The captain, 2026-09-23: "when you've just got one Pokemon the Hunter
   * should also have one Pokemon". The team is counted off the party, and every
   * one of its Pokemon stands below the one of yours it is paired with.
   */
  it('brings as many Pokemon as the party, each below the one it answers', () => {
    for (let size = 1; size <= 6; size += 1) {
      const party = Array.from({ length: size }, (_, index) => new Pokemon(PIDGEY, 6 + index));
      const { openingTeam } = hunterThreatFor(party);
      expect(openingTeam).toHaveLength(size);
      const levels = party.map((pokemon) => pokemon.level).sort((a, b) => b - a);
      openingTeam.forEach((member, index) => expect(member.level).toBeLessThan(levels[index]));
    }
  });

  it('meets a lone Lv 5 starter with one Pokemon at the floor', () => {
    const threat = hunterThreatFor([new Pokemon(BULBASAUR, 5)]);
    expect(threat).toMatchObject({ tierOffset: 0, arrivesSoonerMs: 0, contractTiers: 0 });
    expect(threat.openingTeam.map((member) => [member.species.id, member.level])).toEqual([['rattata', 2]]);
    expect(threat.matchedTo).toEqual({ name: 'Bulbasaur', level: 5 });
  });

  /**
   * The ladder this replaced read only the strongest Pokemon and grew the
   * team on the clock, so a lone veteran met four. A strong party now meets a
   * strong team of its own size, and nothing else about the raid moves.
   */
  it('prices a strong party in levels, never in extra Pokemon or an earlier arrival', () => {
    const veteran = hunterThreatFor([new Pokemon(IVYSAUR, 16)]);
    const rookie = hunterThreatFor([new Pokemon(BULBASAUR, 5)]);
    expect(veteran.openingTeam).toHaveLength(1);
    expect(veteran.openingTeam[0].level).toBe(12);
    expect(veteran.tierOffset).toBe(rookie.tierOffset);
    expect(veteran.arrivesSoonerMs).toBe(rookie.arrivesSoonerMs);
  });

  it('does not answer a Pokemon that came along fainted', () => {
    const threat = hunterThreatFor([fainted(new Pokemon(IVYSAUR, 16)), new Pokemon(PIDGEY, 6)]);
    expect(threat.openingTeam).toHaveLength(1);
    expect(threat.openingTeam[0].level).toBe(2);
    expect(threat.matchedTo).toEqual({ name: 'Pidgey', level: 6 });
    expect(hunterThreatFor([]).tierOffset).toBe(0);
  });

  it('carries whose turn it is into the raid', () => {
    expect(hunterThreatFor([new Pokemon(SQUIRTLE, 5)]).rival).toBe(FIRST_HUNTER_RIVAL);
    expect(hunterThreatFor([new Pokemon(SQUIRTLE, 5)], 0, 'koga').rival).toBe('koga');
  });
});

describe('a raid generated for a party', () => {
  const planFor = (seed: number, party: readonly Pokemon[], pressure = 0) =>
    generateRunPlan(seed, undefined, 'floodplain-relay', undefined, hunterThreatFor(party, pressure));

  it('fights the party it catches, rung by rung, and past it once enraged', () => {
    const plan = planFor(7, [new Pokemon(CHARMANDER, 10)]);
    const party = [new Pokemon(CHARMANDER, 10), new Pokemon(PIDGEY, 7)];
    const levelsAt = (elapsedMs: number, enraged = false) =>
      createHunterTrainer(elapsedMs, enraged, plan.hunter, party).party.map((pokemon) => pokemon.level);

    expect(levelsAt(0)).toEqual([6, 3]);
    expect(levelsAt(240_000)).toEqual([9, 6]);
    expect(levelsAt(0, true)).toEqual([13, 10]);
    // The party it catches, not the party that deployed: the plan was drawn
    // for one Pokemon, the fight is against the two now carried.
    expect(createHunterTrainer(0, false, plan.hunter, party).party).toHaveLength(2);
  });

  it('is fought as this raid\'s rival, in their own words', () => {
    const plan = generateRunPlan(
      3,
      undefined,
      'floodplain-relay',
      undefined,
      hunterThreatFor([new Pokemon(SQUIRTLE, 5)], 0, 'sabrina'),
    );
    const trainer = createHunterTrainer(0, false, plan.hunter, [new Pokemon(SQUIRTLE, 5)]);
    expect(trainer.name).toBe('SABRINA');
    expect(trainer.defeatText).toBeTruthy();
    expect(trainer.getawayText).toBeTruthy();
  });

  it('changes nothing about the raid for a stronger party, which is priced at the fight', () => {
    const { hunter: weakHunter, ...weak } = planFor(11, [new Pokemon(PIDGEY, 6)]);
    const { hunter: strongHunter, ...strong } = planFor(11, [new Pokemon(IVYSAUR, 16)]);
    expect(strong).toEqual(weak);
    expect(strongHunter).toEqual(weakHunter);
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
  it('opens the hunter rungs closer to the party and brings it sooner', () => {
    const rookie = [new Pokemon(CHARMANDER, 12)];
    expect(hunterThreatFor(rookie, 0)).toEqual(hunterThreatFor(rookie));
    const pressed = hunterThreatFor(rookie, 1);
    expect(pressed).toMatchObject({
      tierOffset: 1,
      contractTiers: 1,
      arrivesSoonerMs: HUNTER_ARRIVAL_LEAD_PER_TIER_MS,
    });
    expect(pressed.openingTeam[0].level).toBe(hunterThreatFor(rookie).openingTeam[0].level + 1);
  });

  it('never leaves the ladder, so even the top of the board is below the party', () => {
    for (const pressure of [3, 9]) {
      const threat = hunterThreatFor([new Pokemon(IVYSAUR, 16)], pressure);
      expect(threat.tierOffset).toBe(HUNTER_TIERS.length - 1);
      expect(threat.openingTeam[0].level).toBeLessThan(16);
    }
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
  it('names who is coming, how many and how strong, against which of yours', () => {
    expect(hunterThreatLine(hunterThreatFor([new Pokemon(CHARMANDER, 12)]))).toEqual({
      heading: 'Hunter: BLUE',
      detail: '1 Pokémon to your 1 · lead Lv 8 to your Lv 12 Charmander',
    });
    expect(
      hunterThreatLine(hunterThreatFor([new Pokemon(BULBASAUR, 5), new Pokemon(PIDGEY, 3)], 0, 'misty')),
    ).toEqual({
      heading: 'Hunter: MISTY',
      detail: '2 Pokémon to your 2 · lead Lv 2 to your Lv 5 Bulbasaur',
    });
  });

  it('says what the contract added', () => {
    expect(hunterThreatLine(hunterThreatFor([new Pokemon(CHARMANDER, 12)], 1))).toEqual({
      heading: 'Hunter: BLUE',
      detail: '1 Pokémon to your 1 · lead Lv 9 to your Lv 12 Charmander, +1 contract, 10s sooner',
    });
  });
});
