/**
 * What the hunter costs, measured over the real engine rather than argued.
 *
 *   npx vite-node tools/hunter/measure.mts [-- --trials=150 --potions=0 --rival=blue]
 *
 * The hunter mirrors the party (`HUNTER_TIERS` in `src/game/world/hunter.ts`):
 * one Pokemon for each of yours, each a rung's offset below the one it is
 * paired with, led by the rival's own signature Pokemon and evolved as far as
 * its level reaches. So a rung is not one fight but one fight per party and
 * per rival, and this prints every rung - plus the enrage and an unshipped
 * "at your level" row, which is where a harder hunter would start - against a
 * spread of parties a raid actually deploys, for each of the five rivals
 * (`--rival=` measures one). The fight is `trainerMeasure.ts`'s: the player
 * throws its best move, no switching before a faint, and a pack only if
 * asked for.
 *
 * The late parties are the ones playtest 33 found the hunter could no longer
 * touch - a strong team before and after it evolves, six evolved Pokemon and a
 * Charizard-led late game - because a team that evolves is only visible
 * against parties high enough for it to have.
 *
 * Run it on both sides of a change to the ladder, the roster, the signatures
 * or the species stats and diff the output; the table in `hunter.ts`'s header
 * is its summary.
 */
import { partyOf, trainerMeasure, type MeasuredParty } from '../../src/game/world/trainerMeasure';
import {
  createHunterTrainer,
  DEFAULT_HUNTER_TUNING,
  HUNTER_TIERS,
  hunterTeamFor,
} from '../../src/game/world/hunter';
import { HUNTER_RIVALS, type HunterRivalId } from '../../src/game/world/hunters';
import { Pokemon } from '../../src/game/pokemon';
import type { TrainerBattle } from '../../src/game/pokemon/battle/battleEngine';

const arg = (name: string, fallback: number): number =>
  Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const TRIALS = arg('trials', 150);
const POTIONS = arg('potions', 0);
const ONLY_RIVAL = process.argv.find((a) => a.startsWith('--rival='))?.split('=')[1];

const EARLY_PARTIES: readonly MeasuredParty[] = [
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

const LATE_PARTIES: readonly MeasuredParty[] = [
  partyOf('strong, unevolved', ['charmander', 25], ['pidgey', 22], ['rattata', 22], ['spearow', 20]),
  partyOf('strong, evolved', ['charmeleon', 25], ['pidgeotto', 22], ['raticate', 22], ['fearow', 20]),
  partyOf('six evolved at 20', ['ivysaur', 20], ['charmeleon', 20], ['wartortle', 20], ['pidgeotto', 20], ['raticate', 20], ['fearow', 20]),
  partyOf('late: charizard 36', ['charizard', 36], ['pidgeotto', 30], ['raticate', 30]),
];

const rungsFor = (rivalId: HunterRivalId) => {
  const tuning = { ...DEFAULT_HUNTER_TUNING, rivalId };
  const rungs: readonly { readonly name: string; readonly trainer: (party: readonly Pokemon[]) => TrainerBattle }[] = [
    ...HUNTER_TIERS.map((tier, index) => ({
      name: `rung ${index + 1} (${tier.levelOffset})`,
      trainer: (party: readonly Pokemon[]) => createHunterTrainer(tier.startsAtMs, false, tuning, party),
    })),
    {
      name: 'at your level (0)',
      trainer: (party: readonly Pokemon[]) => ({
        id: 'hunter',
        name: 'HUNTER',
        party: hunterTeamFor({ levelOffset: 0 }, party, rivalId).map((m) => new Pokemon(m.species, m.level)),
      }),
    },
    {
      name: 'enraged',
      trainer: (party: readonly Pokemon[]) => createHunterTrainer(0, true, tuning, party),
    },
  ];
  return rungs;
};

const pct = (n: number): string => `${Math.round(n * 100)}%`.padStart(4);
interface Total { wins: number; worst: number; health: number; parties: number }
const blank = (): Total => ({ wins: 0, worst: 1, health: 0, parties: 0 });
const RUNG_NAMES = rungsFor('blue').map((rung) => rung.name);
const everyRival = { early: RUNG_NAMES.map(blank), late: RUNG_NAMES.map(blank) };

const add = (total: Total, winRate: number, health: number): void => {
  total.wins += winRate;
  total.health += health;
  total.worst = Math.min(total.worst, winRate);
  total.parties += 1;
};
const summary = (label: string, totals: readonly Total[]): void => {
  console.log(`\n# ${label}: mean wins / worst wins / mean HP left on a win`);
  RUNG_NAMES.forEach((name, index) => {
    const { wins, worst, health, parties } = totals[index];
    console.log(`${name.padEnd(20)} ${pct(wins / parties)} / ${pct(worst)} / ${pct(health / parties)}`);
  });
};

console.log(`# hunter fights, ${TRIALS} trials a cell, ${POTIONS} Potions in the pack`);
for (const rival of HUNTER_RIVALS.filter((r) => !ONLY_RIVAL || r.id === ONLY_RIVAL)) {
  const rungs = rungsFor(rival.id);
  const own = { early: RUNG_NAMES.map(blank), late: RUNG_NAMES.map(blank) };
  console.log(`\n## ${rival.name}, leading ${rival.signature}`);
  console.log(`${'party'.padEnd(26)}${RUNG_NAMES.map((name) => name.padStart(22)).join('')}`);
  for (const [group, parties] of [['early', EARLY_PARTIES], ['late', LATE_PARTIES]] as const) {
    for (const party of parties) {
      const cells = rungs.map((rung, index) => {
        const team = rung.trainer(party.build());
        const measured = trainerMeasure(party, team, TRIALS, 0x51ede, null, POTIONS);
        add(own[group][index], measured.winRate, measured.healthLeftOnWin);
        add(everyRival[group][index], measured.winRate, measured.healthLeftOnWin);
        const lineup = team.party.map((p) => `${p.base.name.slice(0, 4)}${p.level}`).join('/');
        return `${lineup.slice(0, 12).padStart(12)} ${pct(measured.winRate)} ${pct(measured.healthLeftOnWin)}`;
      });
      console.log(`${party.name.padEnd(26)}${cells.map((cell) => cell.padStart(22)).join('')}`);
    }
  }
  summary(`${rival.name}, early parties`, own.early);
  summary(`${rival.name}, late parties`, own.late);
}
if (!ONLY_RIVAL) {
  summary('every rival, early parties', everyRival.early);
  summary('every rival, late parties', everyRival.late);
}
