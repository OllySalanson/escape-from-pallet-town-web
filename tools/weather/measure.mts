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
 * A **lead** is the same wild fight with the honest move choice: `bestMove`,
 * which both shared harnesses use, scores a move by power times type
 * effectiveness and **cannot see the same-type bonus**, so it answers a Pidgey
 * with Tackle where every player answers it with Water Gun - and a fight with
 * no Water move in it is a fight rain cannot touch. That is not a fault to fix
 * here (the shipped tables and the trainer ladder are measured through it and
 * hold floors on its numbers), so this half plays the lead's own typed move
 * instead and is the one that says what rain is worth.
 *
 * A **wild** fight is short and one-sided: the shipped tables die to one swing
 * from anything that has learnt these moves, so the only thing weather can
 * really do there is chip the partner on the way past, or halve the one move
 * they win with. This half plays every district's own table with each starter.
 *
 * A **hunter** fight is the long one, and the one the raid is tuned around:
 * every rung of `HUNTER_TIERS` is pitched at "a win costing a third to a half of
 * the party's health", measured against the party that opens it. Weather chips
 * both sides, so whether it tightens or loosens a rung is not something to
 * reason about from the multiplier - this half re-measures each rung the way the
 * rung was set, clear and then under each weather.
 */
import { Pokemon } from '../../src/game/pokemon';
import {
  createBattleState,
  resolveTurn,
  type TrainerBattle,
} from '../../src/game/pokemon/battle/battleEngine';
import { getSpeciesById } from '../../src/game/pokemon/species';
import { createSeededRng } from '../../src/game/run/rng';
import { WeatherId, weatherLabel } from '../../src/game/pokemon/battle/weather';
import { HUNTER_TIERS } from '../../src/game/world/hunter';
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
   * A rung is met by the party that opens it: `hunterThreatFor` gives a rung to
   * the highest-level Pokemon that out-levels it, so a rung at level N is
   * fought by a party at N+1. The party is the three starters at that level,
   * played through `trainerMeasure` - the same harness the authored trainers
   * are measured with, so these numbers sit beside `tools/trainers/report.mts`
   * rather than beside a second harness of their own.
   */
  console.log('\nHunter rungs: the chance the party that opens a rung beats it, and the health it keeps');
  console.log(`(${HUNTER_TRIALS} fights a cell, the whole team on both sides, always the best damaging move)\n`);
  console.log(`  ${'rung'.padEnd(18)} ${'weather'.padEnd(10)}  wins   HP left`);
  for (const [index, tier] of HUNTER_TIERS.entries()) {
    const partyLevel = tier.level + 1;
    const party = partyOf(
      `starters ${partyLevel}`,
      ...STARTERS.map((id) => [id, partyLevel] as [string, number]),
    );
    const hunter: TrainerBattle = {
      id: 'hunter',
      name: 'RIVAL HUNTER',
      party: tier.party.map((base) => new Pokemon(base, tier.level)),
    };
    for (const weather of WEATHERS) {
      // A fresh team for the hunter too: `playTrainerBattle` writes HP onto the
      // Pokemon it is handed, so a reused enemy party would arrive beaten.
      const measure = trainerMeasure(
        party,
        { ...hunter, party: tier.party.map((base) => new Pokemon(base, tier.level)) },
        HUNTER_TRIALS,
        0x51ede,
        weather,
      );
      console.log(
        `  ${`${index + 1}: Lv${tier.level} x${tier.party.length}`.padEnd(18)} ${label(weather).padEnd(10)} ${pct(
          measure.winRate,
        )}  ${measure.winRate > 0 ? pct(measure.healthLeftOnWin) : '   -'}`,
      );
    }
  }
  console.log('');
}
