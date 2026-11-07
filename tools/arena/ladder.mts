/**
 * THE BATTLE ARENA's class ladder, measured over the real engine: every
 * reference team against every regular at each class's stage, and against each
 * class's Black Belt, all at the dojo's level (`arena/classes.ts`). Run it on
 * both sides of a change to a team:
 *
 *   npx vite-node tools/arena/ladder.mts [-- --trials=60]
 */
import { DOJO_LEVEL } from '../../src/game/arena/boutRules';
import { beltFoe, DOJO_CLASSES, foeTeamLine, foeTrainer, regularFoe } from '../../src/game/arena/classes';
import { DOJO_REGULARS } from '../../src/game/arena/dojoCounter';
import { trainerWinRate } from '../../src/game/world/trainerMeasure';
import { DOJO_REFERENCE_TEAMS } from '../../src/game/arena/arenaReferences';

const trials = Number(process.argv.find((arg) => arg.startsWith('--trials='))?.split('=')[1] ?? 60);

const rateOf = (trainer: ReturnType<typeof foeTrainer>): number =>
  DOJO_REFERENCE_TEAMS.reduce((sum, party) => sum + trainerWinRate(party, trainer, trials), 0) / DOJO_REFERENCE_TEAMS.length;

console.log(`Lv ${DOJO_LEVEL}, ${trials} fights a cell, mean over ${DOJO_REFERENCE_TEAMS.map((p) => p.name).join(' / ')}`);
for (const cls of DOJO_CLASSES) {
  const regulars = DOJO_REGULARS.map((regular) => {
    const foe = regularFoe(regular, cls.id);
    return { foe, rate: rateOf(foeTrainer(foe, 3)) };
  });
  const mean = regulars.reduce((sum, row) => sum + row.rate, 0) / regulars.length;
  const head = rateOf(foeTrainer(beltFoe(cls.head), 3));
  console.log(`\n${cls.name}: regulars ${(mean * 100).toFixed(0)}%, ${cls.head.name} ${(head * 100).toFixed(0)}%  (${foeTeamLine(beltFoe(cls.head))})`);
  for (const row of regulars) {
    console.log(`  ${row.foe.name.padEnd(11)} ${(row.rate * 100).toFixed(0).padStart(3)}%  ${foeTeamLine(row.foe)}`);
  }
}
