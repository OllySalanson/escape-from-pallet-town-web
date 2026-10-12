/**
 * What every toll costs each starter, printed.
 *
 *   npx vite-node tools/trainers/tolls.mts
 *   npx vite-node tools/trainers/tolls.mts -- --levels=7,8,10 --potions=0 --trials=200
 *
 * `report.mts` is the boss ladder's grid: one Charmander at three levels and a
 * few parties. A toll is a different question. It holds no door, it stands up
 * again every raid, and it is paid in supplies, so what has to be true of it is
 * that **every starter can pay it** - a toll that one starter walks through and
 * another cannot is a starter lottery on a road. `TOLL_BAND` in
 * `src/game/world/trainers.ts` is the rule and `tolls.test.ts` holds it.
 *
 * So this plays every trainer who holds no gate against each of the three
 * starters alone, with the pack a raid carries (three Potions, drunk a turn at
 * a time as the battle screen charges them), in the weather of the tile the
 * trainer stands on, as `bestPlay.ts` plays. By default each toll is measured
 * at the level `TOLL_BAND` says it is met at, and the row says whether it is in
 * the band; `--levels` measures every toll at the levels given instead. Raider
 * Maya is measured on the party the first contract meets her with as well.
 */
import { createRunTrainerEncounters, trainersForContract, TOLL_BAND } from '../../src/game/world/trainers';
import { weatherAt } from '../../src/game/world/districts';
import { partyOf, trainerMeasure } from '../../src/game/world/trainerMeasure';
import { FIRST_CONTRACT_ID } from '../../src/game/objectives/contracts';

const STARTERS = ['bulbasaur', 'charmander', 'squirtle'] as const;
const option = (name: string): string | undefined =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
const levels = option('levels')?.split(',').map(Number);
const potions = Number(option('potions') ?? TOLL_BAND.potions);
const trials = Number(option('trials') ?? 400);

const tolls = createRunTrainerEncounters().filter((encounter) => encounter.bossId === undefined);
const firstContract = trainersForContract(tolls, FIRST_CONTRACT_ID);

type Toll = (typeof tolls)[number];
const rates = (encounter: Toll, level: number): readonly number[] =>
  STARTERS.map(
    (starter) =>
      trainerMeasure(
        partyOf(starter, [starter, level]),
        encounter.trainer,
        trials,
        0x7011,
        weatherAt(encounter.mapId, encounter.position),
        potions,
      ).winRate,
  );
const cell = (won: readonly number[]): string =>
  won.map((rate) => `${Math.round(rate * 100)}`.padStart(3)).join(' /');

const columns = levels
  ? levels.map((level) => `L${level} bulb/char/squi`.padStart(20)).join('')
  : `${'met at'.padStart(8)}${'bulb/char/squi'.padStart(17)}`;
console.log(`${'toll'.padEnd(30)}${'party'.padEnd(28)}${columns}`);
const row = (label: string, encounter: Toll): void => {
  const party = encounter.trainer.party.map((pokemon) => `${pokemon.base.name} ${pokemon.level}`).join(', ');
  if (levels) {
    console.log(`${label.padEnd(30)}${party.padEnd(28)}${levels.map((level) => cell(rates(encounter, level)).padStart(20)).join('')}`);
    return;
  }
  if (TOLL_BAND.heldElsewhere.includes(encounter.trainer.id)) {
    console.log(`${label.padEnd(30)}${party.padEnd(28)}${'L5'.padStart(8)}${cell(rates(encounter, 5)).padStart(17)}  held in floodplainCheckpoint.test.ts`);
    return;
  }
  const level = TOLL_BAND.levelOn(encounter.mapId);
  const won = rates(encounter, level);
  const inBand =
    Math.min(...won) >= TOLL_BAND.floor && Math.max(...won) - Math.min(...won) <= TOLL_BAND.spread;
  console.log(
    `${label.padEnd(30)}${party.padEnd(28)}${`L${level}`.padStart(8)}${cell(won).padStart(17)}  ${inBand ? 'in band' : 'OUT OF BAND'}`,
  );
};
for (const [index, encounter] of tolls.entries()) {
  row(encounter.trainer.name, encounter);
  if (firstContract[index].trainer.party !== encounter.trainer.party) {
    row(`${encounter.trainer.name} (first contract)`, firstContract[index]);
  }
}
console.log(
  `\nWin %, each starter alone, best damaging move every turn, ${potions} Potions in the pack, ${trials} trials a cell, in the weather of the trainer's own tile.` +
    (levels
      ? ''
      : ` The band: every starter at least ${TOLL_BAND.floor * 100}%, none more than ${TOLL_BAND.spread * 100} points behind another.`),
);
