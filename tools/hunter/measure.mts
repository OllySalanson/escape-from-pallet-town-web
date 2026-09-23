/**
 * What the hunter costs, measured over the real engine rather than argued.
 *
 *   npx vite-node tools/hunter/measure.mts [-- --trials=150 --potions=0]
 *
 * The hunter mirrors the party (`HUNTER_TIERS` in `src/game/world/hunter.ts`):
 * one Pokemon for each of yours, each a rung's offset below the one it is
 * paired with. So a rung is not one fight but one fight per party, and this
 * prints every rung - plus the enrage and an unshipped "at your level" row,
 * which is where a harder hunter would start - against a spread of parties a
 * raid actually deploys. The fight is `trainerMeasure.ts`'s: the player throws
 * its best move, no switching before a faint, and a pack only if asked for.
 *
 * Run it on both sides of a change to the ladder, the roster or the species
 * stats and diff the output; the table in `hunter.ts`'s header is its summary.
 */
import { partyOf, trainerMeasure, type MeasuredParty } from '../../src/game/world/trainerMeasure';
import {
  createHunterTrainer,
  DEFAULT_HUNTER_TUNING,
  HUNTER_TIERS,
  hunterTeamFor,
} from '../../src/game/world/hunter';
import { Pokemon } from '../../src/game/pokemon';
import type { TrainerBattle } from '../../src/game/pokemon/battle/battleEngine';

const arg = (name: string, fallback: number): number =>
  Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const TRIALS = arg('trials', 150);
const POTIONS = arg('potions', 0);

const PARTIES: readonly MeasuredParty[] = [
  ...(['bulbasaur', 'charmander', 'squirtle'] as const).flatMap((starter) =>
    [5, 8, 10, 13].map((level) => partyOf(`${starter} ${level}`, [starter, level])),
  ),
  partyOf('ivysaur 16', ['ivysaur', 16]),
  partyOf('charmeleon 16', ['charmeleon', 16]),
  partyOf('wartortle 16', ['wartortle', 16]),
  partyOf('charmander 10 + pidgey 8', ['charmander', 10], ['pidgey', 8]),
  partyOf('squirtle 10 + rattata 8', ['squirtle', 10], ['rattata', 8]),
  partyOf('trio 8-10', ['bulbasaur', 10], ['pidgey', 9], ['caterpie', 8]),
  partyOf('veteran + five', ['charmeleon', 18], ['pidgey', 10], ['rattata', 10], ['caterpie', 10], ['weedle', 10], ['spearow', 10]),
];

const RUNGS: readonly { readonly name: string; readonly trainer: (party: readonly Pokemon[]) => TrainerBattle }[] = [
  ...HUNTER_TIERS.map((tier, index) => ({
    name: `rung ${index + 1} (${tier.levelOffset})`,
    trainer: (party: readonly Pokemon[]) =>
      createHunterTrainer(tier.startsAtMs, false, DEFAULT_HUNTER_TUNING, party),
  })),
  {
    name: 'at your level (0)',
    trainer: (party: readonly Pokemon[]) => ({
      id: 'hunter',
      name: 'HUNTER',
      party: hunterTeamFor({ levelOffset: 0 }, party).map((m) => new Pokemon(m.species, m.level)),
    }),
  },
  {
    name: 'enraged',
    trainer: (party: readonly Pokemon[]) => createHunterTrainer(0, true, DEFAULT_HUNTER_TUNING, party),
  },
];

const pct = (n: number): string => `${Math.round(n * 100)}%`.padStart(4);
console.log(`# hunter fights, ${TRIALS} trials a cell, ${POTIONS} Potions in the pack`);
console.log(`${'party'.padEnd(26)}${RUNGS.map((rung) => rung.name.padStart(20)).join('')}`);
const totals = RUNGS.map(() => ({ wins: 0, worst: 1, health: 0 }));
for (const party of PARTIES) {
  const cells = RUNGS.map((rung, index) => {
    const team = rung.trainer(party.build());
    const measured = trainerMeasure(party, team, TRIALS, 0x51ede, null, POTIONS);
    totals[index].wins += measured.winRate;
    totals[index].health += measured.healthLeftOnWin;
    totals[index].worst = Math.min(totals[index].worst, measured.winRate);
    const lineup = team.party.map((p) => `${p.base.name.slice(0, 4)}${p.level}`).join('/');
    return `${lineup.slice(0, 10).padStart(10)} ${pct(measured.winRate)} ${pct(measured.healthLeftOnWin)}`;
  });
  console.log(`${party.name.padEnd(26)}${cells.map((cell) => cell.padStart(20)).join('')}`);
}
console.log('\n# per rung: mean wins / worst wins / mean HP left on a win');
RUNGS.forEach((rung, index) => {
  const { wins, worst, health } = totals[index];
  console.log(
    `${rung.name.padEnd(20)} ${pct(wins / PARTIES.length)} / ${pct(worst)} / ${pct(health / PARTIES.length)}`,
  );
});
