/**
 * What every authored trainer costs, printed.
 *
 *   npx vite-node tools/trainers/report.mts
 *
 * The grid `trainerLadder.test.ts` guards one row of: every trainer in the
 * game against a spread of parties, played out over the real engine. Use it
 * when choosing or changing a boss's party - a guessed one was two rungs above
 * the map it stands on, and only this said so.
 */
import { createRunTrainerEncounters } from '../../src/game/world/trainers';
import { partyOf, trainerWinRate } from '../../src/game/world/trainerMeasure';

const PARTIES = [
  partyOf('starter 5', ['charmander', 5]),
  partyOf('Char 10', ['charmander', 10]),
  partyOf('Char 14', ['charmander', 14]),
  partyOf('Squirt 14', ['squirtle', 14]),
  partyOf('Bulba 14', ['bulbasaur', 14]),
  partyOf('Char 12 + Pidgey 10', ['charmander', 12], ['pidgey', 10]),
  partyOf('three at 10-12', ['squirtle', 12], ['butterfree', 11], ['pidgey', 10]),
];
const trials = Number(process.argv.find((arg) => arg.startsWith('--trials='))?.split('=')[1] ?? 200);

console.log(['trainer'.padEnd(26), ...PARTIES.map((party) => party.name.padStart(21))].join(''));
for (const encounter of createRunTrainerEncounters()) {
  const label = `${encounter.trainer.name}${encounter.bossId ? ' *' : ''}`;
  const cells = PARTIES.map(
    (party) => `${Math.round(trainerWinRate(party, encounter.trainer, trials) * 100)}%`.padStart(21),
  );
  console.log(label.padEnd(26) + cells.join(''));
}
console.log('\n* holds a gate. Best damaging move every turn, no items, no switching.');
