import { describe, expect, it } from 'vitest';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import { WeatherId } from '../pokemon/battle/weather';
import { generateRunPlan } from '../run/runGeneration';
import { partyOf, trainerWinRate, type MeasuredMember, type MeasuredParty } from './trainerMeasure';
import { createRunTrainerEncounters } from './trainers';
import { MISTY_BOSS_ID } from './valeQuarters';

/**
 * A gym is a puzzle with a best team, and that is measured, never argued
 * (firstmate's gyms-and-loadouts plan, section 2.1). Every quarter is held to
 * the same bands, over the real engine with the leader playing its combo
 * (`trainerAi.ts`) and the player playing a plan (`PartyPlan`: a setter opens
 * with its move, then everybody hits), three Potions in the pack as a raid
 * carries them:
 *
 *  - **the best team wins at least three fights in four**, at the leader's level;
 *  - **a named wrong team three levels higher wins between one in five and
 *    nearly half** - strong on paper, wrong, and struggling;
 *  - **the same wrong team eight levels higher wins most**, so grinding is
 *    always a way through, a slow one - struggle, never a wall;
 *  - **every starter with its best two catches wins more often than not**, so
 *    no starter is locked out, and every one has to catch for it.
 *
 * Seeded, so the numbers never move unless the fight does.
 */

const TRIALS = 200;
const POTIONS = 3;

const trainerOf = (id: string): TrainerBattle =>
  createRunTrainerEncounters().find((encounter) => encounter.trainer.id === id)!.trainer;

const misty = (): TrainerBattle => {
  const encounter = createRunTrainerEncounters().find((one) => one.bossId === MISTY_BOSS_ID)!;
  return encounter.trainer;
};

/** The level the Coast's reference teams are measured at: her lead's, the highest she fields. */
const LEVEL = misty().party[0].level;

/** A Pikachu as a player keeps one: Thunder Shock is not walked off the end, and it opens with Thunder Wave. */
const PIKACHU: MeasuredMember = {
  moves: ['Thunder Shock', 'Thunder Wave', 'Quick Attack', 'Growl'],
  opens: 'Thunder Wave',
};

/**
 * The Coast's answer, every member caught in ground open before the gym: a
 * Psyduck (The Crossing, Reedmere), whose Cloud Nine stills the rain while it is
 * out, so the Horsea loses its Swift Swim and the Water its boost; a Pikachu
 * (Pine Hollow), paralysing a swimmer and hitting Water twice as hard; a
 * Bellsprout; and a Poliwag, whose Water Absorb drinks what is thrown at it.
 */
const BEST = partyOf(
  `Psyduck, Pikachu, Bellsprout, Poliwag ${LEVEL}`,
  ['psyduck', LEVEL],
  ['pikachu', LEVEL, PIKACHU],
  ['bellsprout', LEVEL],
  ['poliwag', LEVEL],
);

/**
 * Strong on paper and wrong: Fire the rain halves, and Ground and Rock that
 * Water hits two and four times over. It leads with the Charmeleon and the
 * Sandshrew, as anybody would: a Geodude led into her loses at every level
 * measured, which is the lesson rather than the puzzle.
 */
const wrong = (up: number): MeasuredParty =>
  partyOf(
    `Charmeleon ${LEVEL + up + 1}, Sandshrew ${LEVEL + up}, Geodude ${LEVEL + up}`,
    ['charmeleon', LEVEL + up + 1],
    ['sandshrew', LEVEL + up],
    ['geodude', LEVEL + up],
  );

/** Each starter with the two catches that suit it here. */
const STARTERS: readonly MeasuredParty[] = [
  partyOf(`Bulbasaur, Pikachu, Psyduck ${LEVEL}`, ['bulbasaur', LEVEL], ['pikachu', LEVEL, PIKACHU], ['psyduck', LEVEL]),
  partyOf(`Charmander, Pikachu, Psyduck ${LEVEL}`, ['charmander', LEVEL], ['pikachu', LEVEL, PIKACHU], ['psyduck', LEVEL]),
  partyOf(`Squirtle, Pikachu, Bellsprout ${LEVEL}`, ['squirtle', LEVEL], ['pikachu', LEVEL, PIKACHU], ['bellsprout', LEVEL]),
];

const rate = (party: MeasuredParty, trainer: TrainerBattle = misty(), weather: WeatherId | null = null): number =>
  trainerWinRate(party, trainer, TRIALS, 0x51ede, weather, POTIONS);

/** Every reference party the Coast is measured against, the best team first. */
const COAST_PARTIES: readonly MeasuredParty[] = [BEST, ...STARTERS, wrong(3), wrong(8)];
const meanRate = (trainer: TrainerBattle, weather: WeatherId | null): number =>
  COAST_PARTIES.reduce((total, party) => total + rate(party, trainer, weather), 0) / COAST_PARTIES.length;

describe('THE COAST: Misty, two on two in the rain', () => {
  it('fields two at once and plays her combo', () => {
    const trainer = misty();
    expect(trainer.unitCount).toBe(2);
    expect(trainer.ai).toBe('gym');
    expect(trainer.party[0].moves.map((move) => move.base.name)).toContain('Rain Dance');
    expect(trainer.party[1].base.abilityId).toBe('swift-swim');
  });

  it('keeps her taught moves in a raid, not the ones her levels would leave her', () => {
    // A raid's trainers are rebuilt fresh from the authored ones; rebuilt from
    // species and level alone, her Staryu forgot Rain Dance in every real fight.
    const plan = generateRunPlan(1, undefined, 'greystone-vale-the-strand');
    const raidMisty = plan.trainers.find((trainer) => trainer.bossId === MISTY_BOSS_ID)!;
    expect(raidMisty.trainer.party.map((pokemon) => pokemon.moves.map((move) => move.base.name))).toEqual(
      misty().party.map((pokemon) => pokemon.moves.map((move) => move.base.name)),
    );
  });

  it('is beaten by the best team at least three fights in four', () => {
    expect(rate(BEST)).toBeGreaterThanOrEqual(0.75);
  });

  it('makes a wrong team three levels up struggle, and lets one eight levels up through', () => {
    const three = rate(wrong(3));
    expect(three).toBeGreaterThanOrEqual(0.2);
    expect(three).toBeLessThanOrEqual(0.45);
    expect(rate(wrong(8))).toBeGreaterThanOrEqual(0.65);
  });

  it('locks no starter out once it has caught for her', () => {
    const failing = STARTERS.map((party) => ({ party: party.name, rate: rate(party) })).filter(
      (result) => result.rate < 0.55,
    );
    expect(failing).toEqual([]);
  });

  /**
   * Her two trainers show the combo first, a few levels under her: the rain
   * and a swimmer, then sleep and a hit. They are the gym teaching itself, so
   * the best team walks through them and the wrong team finds them easier than
   * Misty - a lesson, not a second wall.
   */
  it('has two trainers who show the combo and are easier than she is', () => {
    for (const id of ['vale-gym-misty-diana', 'vale-gym-misty-luis']) {
      const trainer = trainerOf(id);
      expect(`${trainer.name} ${trainer.ai}`).toBe(`${trainer.name} gym`);
      expect(rate(BEST, trainer)).toBeGreaterThanOrEqual(0.9);
      expect(rate(wrong(3), trainer)).toBeGreaterThan(rate(wrong(3)));
    }
  });

  /**
   * Past her doors the quarter fights the way her gym does (the plan's step
   * 3). Two trainers stand off its roads (`coastQuarter.test.ts`), each a pair
   * that plays a combo in the rain THE COAST is always in: a Tentacool's
   * Supersonic and a Goldeen swimming first, a Horsea's Smokescreen and a
   * Krabby behind it. They are its tolls, held to the quarter's band rather
   * than the toll band (`TOLL_BAND.heldElsewhere`): every starter with the two
   * catches that suit the Coast pays them, no starter is more than the toll
   * band's spread behind another, the best team walks through, and the wrong
   * team finds them easier than Misty - the lesson again, never a second wall.
   */
  it('has two trainers past her doors who fight her way and are a toll at its band', () => {
    for (const id of ['vale-coast-fisherman-hal', 'vale-coast-swimmer-nell']) {
      const trainer = trainerOf(id);
      expect(`${trainer.name} ${trainer.ai} ${trainer.unitCount}`).toBe(`${trainer.name} gym 2`);
      expect(rate(BEST, trainer, WeatherId.Rain)).toBeGreaterThanOrEqual(0.9);
      const starters = STARTERS.map((party) => rate(party, trainer, WeatherId.Rain));
      expect(Math.min(...starters), trainer.name).toBeGreaterThanOrEqual(0.6);
      expect(Math.max(...starters) - Math.min(...starters), trainer.name).toBeLessThanOrEqual(0.35);
      expect(rate(wrong(3), trainer, WeatherId.Rain)).toBeGreaterThan(rate(wrong(3)));
    }
  });

  /**
   * Boatswain Cragg holds the drowned town, inside her quarter, so whoever
   * meets him has beaten her: he sits above her over the same reference
   * parties, fought where he stands - in the Coast's rain - while staying a
   * fight every one of them can win, and one more levels still get through.
   */
  it('puts Boatswain Cragg above her, fought in the Coast’s rain', () => {
    const cragg = trainerOf('vale-quay-keeper-cragg');
    expect(meanRate(cragg, WeatherId.Rain)).toBeLessThan(meanRate(misty(), null));
    expect(rate(BEST, cragg, WeatherId.Rain)).toBeGreaterThanOrEqual(0.6);
    for (const party of STARTERS) {
      expect(`${party.name} ${rate(party, cragg, WeatherId.Rain) >= 0.45}`).toBe(`${party.name} true`);
    }
    expect(rate(wrong(8), cragg, WeatherId.Rain)).toBeGreaterThanOrEqual(0.65);
  });
});
