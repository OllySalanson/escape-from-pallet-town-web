/**
 * What weather costs a real fight, measured over the real engine.
 *
 *   npx vite-node tools/weather/measure.mts            # all three halves
 *   npx vite-node tools/weather/measure.mts -- --wild  # the district tables only
 *   npx vite-node tools/weather/measure.mts -- --lead
 *   npx vite-node tools/weather/measure.mts -- --hunter
 *
 * Two questions, because weather lands on two very different fights.
 *
 * A **lead** is the same wild fight played with the lead's own typed move
 * whatever the chart says about it, which is the half that says what rain is
 * worth: weather bends Fire and Water, so a fight with no Water move in it is a
 * fight rain cannot touch, and a lead that is *resisted* is exactly the case
 * `bestDamagingMove` will correctly decline to play. It once had a second
 * reason - the shared harnesses scored a move as power times effectiveness and
 * could not see the same-type bonus, so every measured starter answered every
 * fight with Tackle - and that is fixed: `world/bestPlay.ts` pays the bonus and
 * both harnesses read it from there.
 *
 * A **wild** fight is short and one-sided: the shipped tables die to one swing
 * from anything that has learnt these moves, so the only thing weather can
 * really do there is chip the partner on the way past, or halve the one move
 * they win with. This half plays every district's own table with each starter.
 *
 * A **hunter** fight is the long one, and the one the raid is tuned around:
 * every rung of `HUNTER_TIERS` is pitched below the party it mirrors, and
 * `tools/hunter/measure.mts` is what it was measured with. Weather chips
 * both sides, so whether it tightens or loosens a rung is not something to
 * reason about from the multiplier - this half re-measures each rung the way the
 * rung was set, clear and then under each weather.
 */
import { Pokemon } from '../../src/game/pokemon';
import {
  createBattleState,
  resolveTurn,
} from '../../src/game/pokemon/battle/battleEngine';
import { getSpeciesById } from '../../src/game/pokemon/species';
import { createSeededRng } from '../../src/game/run/rng';
import { WeatherId, weatherLabel } from '../../src/game/pokemon/battle/weather';
import { createHunterTrainer, DEFAULT_HUNTER_TUNING, HUNTER_TIERS } from '../../src/game/world/hunter';
import { MAP_DISTRICTS, districtsForMap } from '../../src/game/world/districts';
import { WORLD_MAPS } from '../../src/game/worldMap';
import { measureTable } from '../../src/game/world/encounterMeasure';
import { partyOf, trainerMeasure } from '../../src/game/world/trainerMeasure';

const WEATHERS = [null, ...Object.values(WeatherId)] as const;
const label = (weather: WeatherId | null): string => (weather === null ? 'CLEAR' : weatherLabel(weather));
const STARTERS = ['bulbasaur', 'charmander', 'squirtle'] as const;
/** The leads the `--lead` half is played with: one of each, at two levels. */
const LEADS: readonly (readonly [string, number])[] = [
  ['squirtle', 9],
  ['charmander', 9],
  ['bulbasaur', 9],
  ['squirtle', 14],
  ['charmander', 14],
];
const pct = (value: number): string => `${(value * 100).toFixed(0)}%`.padStart(4);

const wanted = process.argv.slice(2);
const runWild = wanted.length === 0 || wanted.includes('--wild');
const runLead = wanted.length === 0 || wanted.includes('--lead');
const runHunter = wanted.length === 0 || wanted.includes('--hunter');
/** Fights per hunter cell. Sixty is readable; a decision wants several hundred. */
const HUNTER_TRIALS = Number(wanted.find((a) => a.startsWith('--trials='))?.slice(9) ?? 60);

if (runWild) {
  console.log('\nWild fights: the chance a fresh starter wins one encounter on each place\'s own table');
  console.log('(100 trials per level per entry, partner always uses its best damaging move)\n');
  for (const map of Object.values(WORLD_MAPS)) {
    const partnerLevel = map.id === 'viridian-forest' ? 8 : 5;
    const districts = districtsForMap(map.id).filter((district) => district.encounters);
    if (districts.length === 0) continue;
    console.log(`${map.id}, level-${partnerLevel} partner`);
    console.log(`  ${'place'.padEnd(16)} ${'weather'.padEnd(10)} ${STARTERS.map((s) => s.slice(0, 4).padStart(5)).join(' ')}`);
    for (const district of districts) {
      for (const weather of WEATHERS) {
        const rates = STARTERS.map((starter) =>
          pct(measureTable(district.encounters!, starter, partnerLevel, 100, weather).winRate),
        );
        console.log(`  ${district.name.padEnd(16)} ${label(weather).padEnd(10)} ${rates.join(' ')}`);
      }
    }
    console.log('');
  }
}

if (runLead) {
  console.log('\nA typed lead in the places that have weather: what the lead\'s own move is worth');
  console.log('(200 fights a cell, the lead always uses its signature move - see the note above)\n');
  console.log(`  ${'place'.padEnd(14)} ${'lead'.padEnd(13)} ${'weather'.padEnd(10)}  wins   HP left`);
  /** The first damaging move of the lead's own type: its signature, and its STAB. */
  const signature = (pokemon: Pokemon): number => {
    const index = pokemon.moves.findIndex(
      (move) => move.base.power > 0 && move.base.type === pokemon.base.primaryType,
    );
    return index < 0 ? 0 : index;
  };
  for (const district of MAP_DISTRICTS.filter((place) => place.weather)) {
    for (const [speciesId, level] of LEADS) {
      for (const weather of [null, district.weather!]) {
        let wins = 0;
        let health = 0;
        const trials = 200;
        for (let trial = 0; trial < trials; trial += 1) {
          const rng = createSeededRng(0x5eed + trial * 31);
          const random = (): number => rng.next();
          const lead = new Pokemon(getSpeciesById(speciesId)!, level);
          // Every entry of the table in turn, so the mix is the place's own.
          const entry = district.encounters!.entries[trial % district.encounters!.entries.length]!;
          const foe = new Pokemon(
            getSpeciesById(entry.speciesId)!,
            entry.minLevel + (trial % (entry.maxLevel - entry.minLevel + 1)),
          );
          let state = createBattleState(lead, foe, weather);
          const move = signature(lead);
          for (let turn = 0; turn < 60 && state.outcome === 'active'; turn += 1) {
            state = resolveTurn(state, move, random).state;
          }
          if (state.outcome === 'victory') {
            wins += 1;
            health += state.player.currentHp / lead.maxHp;
          }
        }
        console.log(
          `  ${district.name.padEnd(14)} ${`${speciesId} ${level}`.padEnd(13)} ${label(weather).padEnd(10)} ${pct(
            wins / trials,
          )}  ${wins > 0 ? pct(health / wins) : '   -'}`,
        );
      }
    }
  }
  console.log('');
}

if (runHunter) {
  /**
   * The hunter mirrors the party (`HUNTER_TIERS` in `world/hunter.ts`): one
   * Pokemon for each of yours, a rung's offset below it. So a rung is fought
   * here by one representative party - the three starters at Lv 10 - against
   * the team `createHunterTrainer` builds for that party, played through
   * `trainerMeasure`, the same harness the authored trainers are measured with.
   */
  console.log('\nHunter rungs: the chance three Lv 10 starters beat a rung, and the health they keep');
  console.log(`(${HUNTER_TRIALS} fights a cell, the whole team on both sides, always the best damaging move)\n`);
  console.log(`  ${'rung'.padEnd(18)} ${'weather'.padEnd(10)}  wins   HP left`);
  const party = partyOf('starters 10', ...STARTERS.map((id) => [id, 10] as [string, number]));
  for (const [index, tier] of HUNTER_TIERS.entries()) {
    for (const weather of WEATHERS) {
      // A fresh team for the hunter every cell: `playTrainerBattle` writes HP
      // onto the Pokemon it is handed, so a reused enemy party would arrive beaten.
      const hunter = createHunterTrainer(tier.startsAtMs, false, DEFAULT_HUNTER_TUNING, party.build());
      const measure = trainerMeasure(party, hunter, HUNTER_TRIALS, 0x51ede, weather);
      console.log(
        `  ${`${index + 1}: ${tier.levelOffset} x${hunter.party.length}`.padEnd(18)} ${label(weather).padEnd(10)} ${pct(
          measure.winRate,
        )}  ${measure.winRate > 0 ? pct(measure.healthLeftOnWin) : '   -'}`,
      );
    }
  }
  console.log('');
}
