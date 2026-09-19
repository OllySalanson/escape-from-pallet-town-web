import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { getSpeciesById } from '../pokemon/species';
import { MINIMUM_SUPPLIES } from '../stash/Stash';
import { weatherAt } from './districts';
import { createRunTrainerEncounters } from './trainers';
import { trainerMeasure, type MeasuredParty } from './trainerMeasure';

/**
 * What RAIDER MAYA costs, measured over the real engine.
 *
 * She is the toll on the fast road down the Floodplain, and she is the only
 * authored fight a *fresh save* can be standing in front of: the first contract
 * drops a level-5 starter at the Landing, the lost kit is fifteen steps away,
 * and the shore road narrows in front of her ten steps after that. So she is
 * the one trainer in the game whose price has to be argued at level 5 rather
 * than at the levels `trainerLadder.test.ts` measures the doors at.
 *
 * The design she is pitched to, and the reasoning for it, is in the comment
 * over her party in `trainers.ts`. In one line: she holds no gate and stands up
 * again on every later raid, so there is nothing behind her to come back for -
 * her fight is meant to be paid, in the condition the player arrives in and the
 * medicine they are willing to spend, and not won or lost on a critical hit.
 *
 * These are the three facts that keep her that. They are held here rather than
 * eyeballed because every one of them has already moved once under the
 * seventeen-type chart, the move data model and the same-type bonus the
 * harnesses now play.
 */
const maya = createRunTrainerEncounters().find(
  (encounter) => encounter.trainer.id === 'floodplain-checkpoint-maya',
)!;

/** The three starters, as the picker offers them. */
const STARTERS = ['charmander', 'squirtle', 'bulbasaur'] as const;

/** What a fresh save deploys with, read off the kit rather than typed here. */
const PACK = MINIMUM_SUPPLIES.potion;

/**
 * She stands in THE REEDBEDS, which is one of the game's three rain districts,
 * so every one of these fights is fought in rain - and rain is not decoration
 * here: it halves the Fire starter's Ember, which is why the road only comes
 * free for a Charmander a level later than it does for the other two. Read off
 * the tile rather than named, so moving her or the weather moves the numbers
 * this file holds rather than quietly invalidating them.
 */
const WEATHER = weatherAt('floodplain-relay', maya.position);

const freshStarter = (speciesId: string, level: number, condition = 1): MeasuredParty => ({
  name: `${speciesId} ${level}`,
  build: () => {
    const starter = new Pokemon(getSpeciesById(speciesId)!, level);
    starter.currentHp = Math.max(1, Math.round(starter.maxHp * condition));
    return [starter];
  },
});

const TRIALS = 400;

const rate = (speciesId: string, level: number, potions: number, condition = 1): number =>
  trainerMeasure(
    freshStarter(speciesId, level, condition),
    maya.trainer,
    TRIALS,
    0x51ede,
    WEATHER,
    potions,
  ).winRate;

describe('the price of the Floodplain checkpoint', () => {
  it('is paid by a fresh level-5 starter that arrives healthy and spends the pack', () => {
    // Every starter, because her two know nothing but Tackle and Growl - there
    // is no type in this fight at all, so a spread between the three would be a
    // spread in nothing but stats and would mean one starter had been tuned to.
    const paid = STARTERS.map((starter) => `${starter} ${rate(starter, 5, PACK) >= 0.78}`);
    expect(paid).toEqual(STARTERS.map((starter) => `${starter} true`));
  });

  it('is not paid by a starter with nothing left in the pack', () => {
    // The road is not free, and this is what stops it being free. A player who
    // spent their medicine in the reeds has the reeds left, not the road: the
    // watch is shaded and captioned CANNOT BE FLED, and the junction one step
    // above it is outside her sight.
    const bare = STARTERS.map((starter) => `${starter} ${rate(starter, 5, 0) <= 0.15}`);
    expect(bare).toEqual(STARTERS.map((starter) => `${starter} true`));
  });

  it('turns on the condition the player walks in with, not on a critical hit', () => {
    // The gap between these two is the whole of the decision. If it ever closes,
    // the fight has gone back to being decided by the 6.25% roll rather than by
    // how the player got here - which is what "one crit decides an early fight"
    // meant, and why she was retuned.
    for (const starter of STARTERS) {
      const healthy = rate(starter, 5, PACK);
      const hurt = rate(starter, 5, PACK, 0.6);
      expect(`${starter} costs ${healthy - hurt > 0.12}`).toBe(`${starter} costs true`);
    }
  });

  it('opens by the second raid, which is the only thing beating her buys', () => {
    // She is not a door and there is no permanent reward for her, so the road
    // has to come free with the levels a player earns anyway. A level-6 starter
    // with the pack wins comfortably; by level 7 - one signature move later -
    // a single Potion is the whole price. Bare at 7 is deliberately not asked:
    // in this rain a Charmander's Ember is halved, so it is still fighting with
    // Scratch, and that is the weather doing its job rather than the toll.
    for (const starter of STARTERS) {
      expect(`${starter} at 6 ${rate(starter, 6, PACK) >= 0.9}`).toBe(`${starter} at 6 true`);
      expect(`${starter} at 7 ${rate(starter, 7, 1) >= 0.9}`).toBe(`${starter} at 7 true`);
      expect(`${starter} at 10 ${rate(starter, 10, 0) >= 0.9}`).toBe(`${starter} at 10 true`);
    }
  });
});
