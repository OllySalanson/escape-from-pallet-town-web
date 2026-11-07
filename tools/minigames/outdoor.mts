/**
 * The promenade's three outdoor games played thousands of times by model
 * players, for every Pokémon worth asking about: where each finishes the
 * PROMENADE DERBY, what each digs up at THE DIG, and what each lead lands in
 * the FISHING DERBY - and the tickets each is worth.
 *
 *   npx vite-node tools/minigames/outdoor.mts [-- --games=300 --skill=0.8]
 *
 * It is how the ticket tiers in `minigames/tickets.ts` were set, and how a
 * change to a game's rules is weighed: run it on both sides of the change.
 * `--skill` is how often the model rider eases off into a corner (1 never
 * stumbles).
 */
import { DERBY_ENTRANTS, FIELD_SIZE, playerPlace, raceTime, type DerbyEntrant } from '../../src/game/minigames/derby';
import { modelDerby, modelDig } from '../../src/game/minigames/outdoorModels';
import { modelFishingDerby } from '../../src/game/minigames/fishingDerby';
import { harbourBite } from '../../src/game/base/harbourFishing';
import { derbyTickets, digTickets, fishingDerbyTickets } from '../../src/game/minigames/tickets';
import { traits, roller } from '../../src/game/minigames/traits';

const args = process.argv.slice(2).filter((value) => value !== '--');
const option = (name: string, fallback: number): number => {
  const found = args.find((value) => value.startsWith(`--${name}=`));
  return found ? Number(found.split('=')[1]) : fallback;
};
const games = option('games', 300);
const skill = option('skill', 0.8);

const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

/** A field for each game: five of the twelve, by seed, as a day's field is. */
function fieldFor(seed: number): readonly DerbyEntrant[] {
  const roll = roller(seed * 7919);
  const pool = [...DERBY_ENTRANTS];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(roll() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, FIELD_SIZE);
}

console.log(`THE PROMENADE DERBY: ${games} races each, model skill ${skill}\n`);
console.log('racer'.padEnd(14), 'going'.padEnd(6), 'win%'.padStart(6), 'top3%'.padStart(6), 'place'.padStart(6), 'time'.padStart(8), 'tickets'.padStart(8));
const RACERS = [
  'ponyta', 'rapidash', 'tauros', 'doduo', 'spearow', 'pidgeotto', 'rattata', 'horsea', 'pikachu',
  'charmander', 'squirtle', 'bulbasaur', 'venusaur', 'blastoise', 'charizard', 'golem', 'snorlax', 'geodude',
];
for (const species of RACERS) {
  for (const wet of [false, true]) {
    if (wet && !['horsea', 'squirtle', 'blastoise', 'ponyta'].includes(species)) continue;
    const racer = traits(species);
    const places: number[] = [];
    const times: number[] = [];
    for (let seed = 1; seed <= games; seed += 1) {
      const race = modelDerby(racer, fieldFor(seed), wet, seed, skill);
      places.push(playerPlace(race) ?? 6);
      times.push(race.runners[0].finishedMs ?? 60_000);
    }
    console.log(
      species.padEnd(14),
      (wet ? 'wet' : 'dry').padEnd(6),
      ((places.filter((place) => place === 1).length / games) * 100).toFixed(0).padStart(6),
      ((places.filter((place) => place <= 3).length / games) * 100).toFixed(0).padStart(6),
      mean(places).toFixed(2).padStart(6),
      raceTime(mean(times)).padStart(8),
      mean(places.map((place) => derbyTickets(7 - place))).toFixed(1).padStart(8),
    );
  }
}

console.log(`\nTHE DIG: ${games} digs each\n`);
console.log('digger'.padEnd(26), 'finds'.padStart(6), 'score'.padStart(6), 'all%'.padStart(6), 'tickets'.padStart(8));
const DIGGERS: readonly (readonly [string, readonly string[]])[] = [
  ['diglett', ['dig']],
  ['diglett', []],
  ['sandshrew', []],
  ['sandshrew', ['dig']],
  ['cubone', []],
  ['meowth', []],
  ['pidgey', []],
  ['spearow', []],
  ['charmander', ['dig']],
  ['charmander', []],
  ['squirtle', ['dig']],
  ['bulbasaur', []],
  ['psyduck', []],
  ['pidgeotto', []],
];
for (const [species, moves] of DIGGERS) {
  const digger = traits(species, moves);
  const finds: number[] = [];
  const scores: number[] = [];
  let all = 0;
  for (let seed = 1; seed <= games; seed += 1) {
    const game = modelDig(digger, seed);
    finds.push(game.found.length);
    scores.push(game.score);
    if (game.buried.every((thing) => game.found.some((found) => found.x === thing.x && found.y === thing.y))) all += 1;
  }
  console.log(
    `${species}${moves.length ? ` +${moves.join(',')}` : ''}`.padEnd(26),
    mean(finds).toFixed(2).padStart(6),
    mean(scores).toFixed(1).padStart(6),
    ((all / games) * 100).toFixed(0).padStart(6),
    mean(scores.map(digTickets)).toFixed(1).padStart(8),
  );
}

console.log(`\nTHE FISHING DERBY: ${games} derbies each\n`);
console.log('lead / water'.padEnd(26), 'casts'.padStart(6), 'caught'.padStart(7), 'score'.padStart(6), 'tickets'.padStart(8));
for (const [species, deep] of [
  ['staryu', true],
  ['starmie', true],
  ['charmander', true],
  ['charmander', false],
  ['grimer', true],
  ['muk', true],
] as const) {
  const lead = traits(species);
  const scores: number[] = [];
  const caught: number[] = [];
  const casts: number[] = [];
  for (let seed = 1; seed <= games; seed += 1) {
    const rng = roller(seed);
    const state = modelFishingDerby(
      lead,
      (roll) => {
        const bite = harbourBite({ x: 80, y: deep ? 30 : 18 }, roll);
        return { speciesId: bite?.name ?? 'MAGIKARP', level: bite?.level ?? 5 };
      },
      rng,
    );
    scores.push(state.score);
    caught.push(state.catches);
    casts.push(state.casts);
  }
  console.log(
    `${species} / ${deep ? 'deep' : 'shallows'}`.padEnd(26),
    mean(casts).toFixed(1).padStart(6),
    mean(caught).toFixed(1).padStart(7),
    mean(scores).toFixed(1).padStart(6),
    mean(scores.map(fishingDerbyTickets)).toFixed(1).padStart(8),
  );
}
