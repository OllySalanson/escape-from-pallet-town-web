/**
 * What THE BATTLE ARENA is to a new player: their starter as Oak's table hands
 * it over (Lv 5, its own moves), copied to the bout's level as the counter
 * copies it (`flatLevelCopy`, which teaches what it would learn on the way up),
 * one on one against each regular's lead at the POKé BALL class. Run it on both
 * sides of a change to the dojo's copies or a regular's team:
 *
 *   npx vite-node tools/arena/newcomer.mts [-- --trials=60]
 */
import { flatLevelCopy } from '../../src/game/arena/boutRules';
import { foeTrainer, regularFoe, DOJO_CLASSES } from '../../src/game/arena/classes';
import { DOJO_REGULARS } from '../../src/game/arena/dojoCounter';
import { Move, Pokemon } from '../../src/game/pokemon';
import { SPECIES_BY_ID } from '../../src/game/pokemon/species';
import { trainerWinRate } from '../../src/game/world/trainerMeasure';

const trials = Number(process.argv.find((arg) => arg.startsWith('--trials='))?.split('=')[1] ?? 60);
const starters = ['bulbasaur', 'charmander', 'squirtle'];
const firstClass = DOJO_CLASSES[0].id;

for (const id of starters) {
  const starter = new Pokemon(SPECIES_BY_ID[id], 5);
  const copy = flatLevelCopy(starter);
  // What the dojo did before the copy filled its free slots: Lv 30, Lv 5 moves.
  const ownMovesOnly = (): Pokemon[] => {
    const bare = flatLevelCopy(starter);
    bare.moves = starter.moves.map((move) => new Move(move.base));
    return [bare];
  };
  const rows = DOJO_REGULARS.map((regular) => {
    const trainer = foeTrainer(regularFoe(regular, firstClass), 1);
    return {
      name: regular.bot.name,
      rate: trainerWinRate({ name: id, build: () => [flatLevelCopy(starter)] }, trainer, trials),
      before: trainerWinRate({ name: `${id} (own moves)`, build: ownMovesOnly }, trainer, trials),
    };
  });
  const mean = (pick: (row: (typeof rows)[number]) => number): number => rows.reduce((sum, row) => sum + pick(row), 0) / rows.length;
  const winnable = rows.filter((row) => row.rate >= 0.5).length;
  console.log(
    `\n${id} (${copy.moves.map((move) => move.base.name).join(', ')}): mean ${(mean((row) => row.rate) * 100).toFixed(0)}% (own Lv 5 moves only: ${(mean((row) => row.before) * 100).toFixed(0)}%), ${winnable} of ${rows.length} regulars won at least half the time`,
  );
  for (const row of rows) console.log(`  ${row.name.padEnd(11)} ${(row.rate * 100).toFixed(0).padStart(3)}%  (was ${(row.before * 100).toFixed(0)}%)`);
}
