import { createRunTrainerEncounters } from './trainers';

/**
 * What a gym's door sign says about the team inside, worked out from the team
 * itself (`trainers.ts`), so a leader re-measured and re-levelled is never
 * advertised at the old levels.
 *
 * The 20 Nov AI playtest walked into both gyms blind: MISTY was "a big step up
 * from everything else" with nothing saying how strong to be first (#124), and
 * KOGA's KOFFING Self-Destructed a lone partner and wiped the raid on its first
 * Pokemon (#20). Olly's pick of 22 Nov: a level guide at each gym door, which
 * is words, and no change to the teams.
 *
 * The level to bring is the lead's: every gym's party is measured over the real
 * engine against parties at its lead's level (`quarterPuzzle.test.ts`), so that
 * is the level the measure means. A leader who sends two out at once is met by
 * two, so the line asks for as many. A move that knocks out its own user takes
 * one of yours with it, and the line names it.
 *
 * One line, because a sign says at most four (`mapFile.ts`).
 */
export function gymDoorGuide(bossId: string): string {
  const leader = createRunTrainerEncounters().find((encounter) => encounter.bossId === bossId);
  if (!leader) {
    throw new Error(`No gym leader ${bossId}.`);
  }
  const { name, party, unitCount = 1 } = leader.trainer;
  const levels = party.map((pokemon) => pokemon.level);
  const low = Math.min(...levels);
  const high = Math.max(...levels);
  const spread = low === high ? `Lv ${high}` : `Lv ${low} to ${high}`;
  const atOnce = unitCount > 1 ? `, ${count(unitCount)} out at once` : '';
  const bring = unitCount > 1 ? count(unitCount) : 'one';
  const spends = party.find((pokemon) => pokemon.moves.some((move) => move.base.userFaints));
  const move = spends?.moves.find((known) => known.base.userFaints);
  const warning = spends && move ? ` ${spends.base.name.toUpperCase()} knows ${move.base.name.toUpperCase()}!` : '';
  return `${name}: ${count(party.length)} Pokémon, ${spread}${atOnce}. Bring ${bring} at Lv ${party[0].level} or more.${warning}`;
}

/**
 * The level a gym's leader leads with, the level its door sign asks the player
 * to bring (`gymDoorGuide`), for anybody else who says it - the Gym Guide in
 * the hall.
 */
export function gymLeadLevel(bossId: string): number {
  const leader = createRunTrainerEncounters().find((encounter) => encounter.bossId === bossId);
  if (!leader) {
    throw new Error(`No gym leader ${bossId}.`);
  }
  return leader.trainer.party[0].level;
}

/** A small number as a sign spells it. */
const count = (n: number): string => NUMBER_WORDS[n] ?? String(n);

const NUMBER_WORDS: Readonly<Record<number, string>> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six' };
