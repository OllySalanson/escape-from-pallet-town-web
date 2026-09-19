/**
 * What every authored trainer costs, printed.
 *
 *   npx vite-node tools/trainers/report.mts
 *   npx vite-node tools/trainers/report.mts -- --potions=3
 *
 * The grid `trainerLadder.test.ts` guards one row of: every trainer in the
 * game against a spread of parties, played out over the real engine. Use it
 * when choosing or changing a boss's party - a guessed one was two rungs above
 * the map it stands on, and only this said so.
 *
 * `--potions=N` hands the measured player the pack a raid actually carries
 * (a fresh save deploys with three), drunk a turn at a time as the battle
 * screen charges them. A door is meant to be measured bare, which is the
 * default; a *toll* on a route is paid in supplies as much as in health, and
 * measuring one with an empty pack measures a player who does not exist -
 * see `floodplainCheckpoint.test.ts`.
 */
import { createRunTrainerEncounters } from '../../src/game/world/trainers';
import { partyOf, trainerMeasure } from '../../src/game/world/trainerMeasure';

const PARTIES = [
  partyOf('starter 5', ['charmander', 5]),
  partyOf('Char 10', ['charmander', 10]),
  partyOf('Char 14', ['charmander', 14]),
  partyOf('Squirt 14', ['squirtle', 14]),
  partyOf('Bulba 14', ['bulbasaur', 14]),
  partyOf('Char 12 + Pidgey 10', ['charmander', 12], ['pidgey', 10]),
  partyOf('three at 10-12', ['squirtle', 12], ['butterfree', 11], ['pidgey', 10]),
];
const argument = (name: string, fallback: number): number =>
  Number(process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const trials = argument('trials', 200);
const potions = argument('potions', 0);

console.log(['trainer'.padEnd(26), ...PARTIES.map((party) => party.name.padStart(21))].join(''));
for (const encounter of createRunTrainerEncounters()) {
  const label = `${encounter.trainer.name}${encounter.bossId ? ' *' : ''}`;
  const cells = PARTIES.map((party) => {
    const measure = trainerMeasure(party, encounter.trainer, trials, 0x51ede, null, potions);
    const won = `${Math.round(measure.winRate * 100)}%`;
    return (potions > 0 ? `${won} ${measure.potionsOnWin.toFixed(1)}p` : won).padStart(21);
  });
  console.log(label.padEnd(26) + cells.join(''));
}
console.log(
  `\n* holds a gate. Best damaging move every turn, no switching, ${
    potions > 0 ? `${potions} Potions in the pack` : 'no items'
  }.`,
);
