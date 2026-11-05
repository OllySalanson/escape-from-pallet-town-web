/**
 * POKéMON JUMP played thousands of times by a model player, for every team
 * worth asking about: how far each gets, what it scores and what that wins.
 *
 *   npx vite-node tools/minigames/measure.mts [-- --games=200 --jitter=2]
 *
 * The model presses as late as it safely can (the best a player can do) and
 * then misses that by up to `--jitter` frames either way, at random - a frame
 * is a sixtieth of a second, and a person is not that steady. It is how the
 * ticket lines in `minigames/tickets.ts` were set, and how a change to the
 * game is weighed: run it on both sides of the change.
 */
import { modelJumpGame } from '../../src/game/minigames/jumpModel';
import { berriesForScore } from '../../src/game/minigames/pokemonJump';
import { jumpTickets } from '../../src/game/minigames/tickets';

const args = process.argv.slice(2).filter((value) => value !== '--');
const option = (name: string, fallback: number): number => {
  const found = args.find((value) => value.startsWith(`--${name}=`));
  return found ? Number(found.split('=')[1]) : fallback;
};
const games = option('games', 200);
const jitter = option('jitter', 2);

const TEAMS: readonly (readonly string[])[] = [
  ['rattata', 'mankey', 'growlithe'],
  ['charmander', 'krabby', 'paras'],
  ['bulbasaur', 'psyduck', 'poliwag'],
  ['squirtle', 'pikachu', 'eevee'],
  ['bulbasaur', 'charmander', 'squirtle'],
  ['charmander'],
  ['bulbasaur'],
  ['squirtle'],
  ['rattata', 'rattata'],
];

console.log(`${games} games a team, jitter ±${jitter} frames\n`);
console.log('team'.padEnd(34), 'median'.padStart(7), 'p90'.padStart(7), 'best'.padStart(7), 'tickets'.padStart(8), 'berries'.padStart(8));
for (const team of TEAMS) {
  const scores: number[] = [];
  for (let seed = 1; seed <= games; seed += 1) {
    scores.push(modelJumpGame(team, seed, jitter).score);
  }
  scores.sort((a, b) => a - b);
  const at = (share: number): number => scores[Math.min(scores.length - 1, Math.floor(share * scores.length))];
  const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
  console.log(
    team.join(' ').padEnd(34),
    String(at(0.5)).padStart(7),
    String(at(0.9)).padStart(7),
    String(scores[scores.length - 1]).padStart(7),
    mean(scores.map(jumpTickets)).toFixed(1).padStart(8),
    mean(scores.map(berriesForScore)).toFixed(2).padStart(8),
  );
}
