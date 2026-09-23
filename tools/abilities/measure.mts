/**
 * What abilities moved, measured over the real engine rather than argued.
 *
 *   npx vite-node tools/abilities/measure.mts
 *
 * Two things abilities touch and one of them is the hunter, so both are printed
 * together: every district's table against each starter (the numbers
 * `districtEncounters.test.ts` holds), and every hunter rung against three Lv 10
 * starters (`tools/hunter/measure.mts` is the whole hunter table). Run it
 * on both sides of a change to abilities and diff the output.
 */
import { WORLD_MAPS } from '../../src/game/worldMap';
import { districtsForMap } from '../../src/game/world/districts';
import { measureTable } from '../../src/game/world/encounterMeasure';
import { createHunterTrainer, DEFAULT_HUNTER_TUNING, HUNTER_TIERS } from '../../src/game/world/hunter';
import { Pokemon } from '../../src/game/pokemon';
import {
  createBattleState,
  replacePlayerPokemon,
  resolveTurn,
  type BattleState,
} from '../../src/game/pokemon/battle/battleEngine';
import { getTypeEffectiveness } from '../../src/game/pokemon/battle/typeChart';
import { MoveCategory } from '../../src/game/pokemon/MoveBase';
import { getSpeciesById } from '../../src/game/pokemon/species';
import { createSeededRng } from '../../src/game/run/rng';

const STARTERS = ['bulbasaur', 'charmander', 'squirtle'] as const;
const TRIALS = Number(process.argv.find((a) => a.startsWith('--trials='))?.slice(9) ?? 120);

console.log(`# wild tables (${TRIALS} trials each)`);
for (const map of Object.values(WORLD_MAPS)) {
  const level = map.id === 'viridian-forest' ? 8 : 5;
  for (const district of districtsForMap(map.id).filter((entry) => entry.encounters)) {
    // The place's own weather, because that is the fight the player has: a
    // rainy district is a different table against a Fire lead, and two of the
    // abilities here are only ever about the weather.
    const wins = STARTERS.map(
      (starter) =>
        `${starter.slice(0, 4)} ${(measureTable(district.encounters!, starter, level, TRIALS, district.weather ?? null).winRate * 100).toFixed(0)}%`,
    ).join('  ');
    const sky = district.weather ? ` (${district.weather})` : '';
    console.log(`${map.id.padEnd(18)} ${district.name.padEnd(22)} Lv${level}  ${wins}${sky}`);
  }
}

/**
 * The hunter mirrors the party, so a rung is measured against one party - three
 * starters at Lv 10 - played by the same always-its-best-move driver the wild
 * tables use.
 */
const bestMove = (state: BattleState): number => {
  const types = [
    state.enemy.pokemon.base.primaryType,
    ...(state.enemy.pokemon.base.secondaryType ? [state.enemy.pokemon.base.secondaryType] : []),
  ];
  let best = 0;
  let bestScore = -1;
  state.player.moves.forEach((move, index) => {
    if (move.pp <= 0 || move.base.category === MoveCategory.Status || move.base.power <= 0) return;
    const score = move.base.power * getTypeEffectiveness(move.base.type, types);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
};

console.log(`\n# hunter rungs (${TRIALS} trials each, three Lv 10 starters against the team the hunter mirrors them with)`);
for (const [index, tier] of HUNTER_TIERS.entries()) {
  const level = 10;
  const rng = createSeededRng(0x5eed + index);
  const random = (): number => rng.next();
  let wins = 0;
  let healthLeft = 0;
  let fielded = 0;
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const party = STARTERS.map((starter) => new Pokemon(getSpeciesById(starter)!, level));
    const trainer = createHunterTrainer(tier.startsAtMs, false, DEFAULT_HUNTER_TUNING, party);
    fielded = trainer.party.length;
    let state = createBattleState(party[0], trainer.party[0]);
    state = { ...state, trainer };
    for (let turn = 0; turn < 400 && state.outcome === 'active'; turn += 1) {
      state = resolveTurn(state, bestMove(state), random).state;
      if (state.outcome === 'defeat') {
        // A party is only beaten once everyone is: the next one up comes out,
        // which is what the scene does when the player is forced to replace.
        const next = party.find((member) => member.currentHp > 0 && member !== state.player.pokemon);
        if (next) {
          state = replacePlayerPokemon({ ...state, outcome: 'active' }, next).state;
        }
      }
      // The engine writes HP to the combatant, so the party copy has to be told.
      party.forEach((member) => {
        if (member === state.player.pokemon) member.currentHp = state.player.currentHp;
      });
    }
    if (state.outcome === 'victory') {
      wins += 1;
      healthLeft +=
        party.reduce((total, member) => total + member.currentHp, 0) /
        party.reduce((total, member) => total + member.maxHp, 0);
    }
  }
  console.log(
    `rung ${index + 1} (offset ${tier.levelOffset} x${fielded})  party Lv${level}  ` +
      `win ${((wins / TRIALS) * 100).toFixed(0)}%  party HP left ${wins ? ((healthLeft / wins) * 100).toFixed(0) : '-'}%`,
  );
}
