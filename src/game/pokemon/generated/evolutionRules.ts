// GENERATED FILE - do not edit by hand.
//
// Written by `node tools/species/generate.mjs` from the committed snapshots in `tools/`.
// Change the snapshot or the generator, re-run it, and commit the result;
// `speciesImport.test.ts` fails if this file and the generator disagree.
import type { EvolutionRule } from '../evolution';

/**
 * Every evolution among the 151 that generation III had, from PokeAPI's
 * `/evolution-chain/` data.
 *
 * Three things the filtering does, because an evolution chain is served as the
 * *modern* one. A rule whose other end is outside the 151 is dropped, which is
 * what leaves out the baby forms (Pichu, Cleffa, Igglybuff) and the later
 * generations' additions (Espeon, Steelix, Politoed, Annihilape). A stone that
 * did not exist in generation III is dropped, which is what stops Vulpix
 * reading as an Ice Stone line and Sandshrew as an Alolan one. And where a pair
 * carries both a level and a stone, the level is generation III's - Voltorb
 * became Electrode at 30 long before a Leaf Stone did it in Hisui.
 *
 * **The four trade lines are here and nothing triggers them.** This game has no
 * trading, so Kadabra, Machoke, Graveler and Haunter cannot evolve; the rule is
 * kept because the *family* is what `evolutionFamily` reads when a save looks
 * a move up, and what `pokemonCargo.ts` counts stages with, and dropping it
 * would make an Alakazam a first-stage Pokemon in the pack.
 */
export const GENERATED_EVOLUTIONS: readonly EvolutionRule[] = [
  { from: 'bulbasaur', to: 'ivysaur', trigger: { kind: 'level', level: 16 } },
  { from: 'ivysaur', to: 'venusaur', trigger: { kind: 'level', level: 32 } },
  { from: 'charmander', to: 'charmeleon', trigger: { kind: 'level', level: 16 } },
  { from: 'charmeleon', to: 'charizard', trigger: { kind: 'level', level: 36 } },
  { from: 'squirtle', to: 'wartortle', trigger: { kind: 'level', level: 16 } },
  { from: 'wartortle', to: 'blastoise', trigger: { kind: 'level', level: 36 } },
  { from: 'caterpie', to: 'metapod', trigger: { kind: 'level', level: 7 } },
  { from: 'metapod', to: 'butterfree', trigger: { kind: 'level', level: 10 } },
  { from: 'weedle', to: 'kakuna', trigger: { kind: 'level', level: 7 } },
  { from: 'kakuna', to: 'beedrill', trigger: { kind: 'level', level: 10 } },
  { from: 'pidgey', to: 'pidgeotto', trigger: { kind: 'level', level: 18 } },
  { from: 'pidgeotto', to: 'pidgeot', trigger: { kind: 'level', level: 36 } },
  { from: 'rattata', to: 'raticate', trigger: { kind: 'level', level: 20 } },
  { from: 'spearow', to: 'fearow', trigger: { kind: 'level', level: 20 } },
  { from: 'ekans', to: 'arbok', trigger: { kind: 'level', level: 22 } },
  { from: 'pikachu', to: 'raichu', trigger: { kind: 'stone', itemId: 'thunder-stone' } },
  { from: 'sandshrew', to: 'sandslash', trigger: { kind: 'level', level: 22 } },
  { from: 'nidoran-f', to: 'nidorina', trigger: { kind: 'level', level: 16 } },
  { from: 'nidorina', to: 'nidoqueen', trigger: { kind: 'stone', itemId: 'moon-stone' } },
  { from: 'nidoran-m', to: 'nidorino', trigger: { kind: 'level', level: 16 } },
  { from: 'nidorino', to: 'nidoking', trigger: { kind: 'stone', itemId: 'moon-stone' } },
  { from: 'clefairy', to: 'clefable', trigger: { kind: 'stone', itemId: 'moon-stone' } },
  { from: 'vulpix', to: 'ninetales', trigger: { kind: 'stone', itemId: 'fire-stone' } },
  { from: 'jigglypuff', to: 'wigglytuff', trigger: { kind: 'stone', itemId: 'moon-stone' } },
  { from: 'zubat', to: 'golbat', trigger: { kind: 'level', level: 22 } },
  { from: 'oddish', to: 'gloom', trigger: { kind: 'level', level: 21 } },
  { from: 'gloom', to: 'vileplume', trigger: { kind: 'stone', itemId: 'leaf-stone' } },
  { from: 'paras', to: 'parasect', trigger: { kind: 'level', level: 24 } },
  { from: 'venonat', to: 'venomoth', trigger: { kind: 'level', level: 31 } },
  { from: 'diglett', to: 'dugtrio', trigger: { kind: 'level', level: 26 } },
  { from: 'meowth', to: 'persian', trigger: { kind: 'level', level: 28 } },
  { from: 'psyduck', to: 'golduck', trigger: { kind: 'level', level: 33 } },
  { from: 'mankey', to: 'primeape', trigger: { kind: 'level', level: 28 } },
  { from: 'growlithe', to: 'arcanine', trigger: { kind: 'stone', itemId: 'fire-stone' } },
  { from: 'poliwag', to: 'poliwhirl', trigger: { kind: 'level', level: 25 } },
  { from: 'poliwhirl', to: 'poliwrath', trigger: { kind: 'stone', itemId: 'water-stone' } },
  { from: 'abra', to: 'kadabra', trigger: { kind: 'level', level: 16 } },
  { from: 'kadabra', to: 'alakazam', trigger: { kind: 'trade' } },
  { from: 'machop', to: 'machoke', trigger: { kind: 'level', level: 28 } },
  { from: 'machoke', to: 'machamp', trigger: { kind: 'trade' } },
  { from: 'bellsprout', to: 'weepinbell', trigger: { kind: 'level', level: 21 } },
  { from: 'weepinbell', to: 'victreebel', trigger: { kind: 'stone', itemId: 'leaf-stone' } },
  { from: 'tentacool', to: 'tentacruel', trigger: { kind: 'level', level: 30 } },
  { from: 'geodude', to: 'graveler', trigger: { kind: 'level', level: 25 } },
  { from: 'graveler', to: 'golem', trigger: { kind: 'trade' } },
  { from: 'ponyta', to: 'rapidash', trigger: { kind: 'level', level: 40 } },
  { from: 'slowpoke', to: 'slowbro', trigger: { kind: 'level', level: 37 } },
  { from: 'magnemite', to: 'magneton', trigger: { kind: 'level', level: 30 } },
  { from: 'doduo', to: 'dodrio', trigger: { kind: 'level', level: 31 } },
  { from: 'seel', to: 'dewgong', trigger: { kind: 'level', level: 34 } },
  { from: 'grimer', to: 'muk', trigger: { kind: 'level', level: 38 } },
  { from: 'shellder', to: 'cloyster', trigger: { kind: 'stone', itemId: 'water-stone' } },
  { from: 'gastly', to: 'haunter', trigger: { kind: 'level', level: 25 } },
  { from: 'haunter', to: 'gengar', trigger: { kind: 'trade' } },
  { from: 'drowzee', to: 'hypno', trigger: { kind: 'level', level: 26 } },
  { from: 'krabby', to: 'kingler', trigger: { kind: 'level', level: 28 } },
  { from: 'voltorb', to: 'electrode', trigger: { kind: 'level', level: 30 } },
  { from: 'exeggcute', to: 'exeggutor', trigger: { kind: 'stone', itemId: 'leaf-stone' } },
  { from: 'cubone', to: 'marowak', trigger: { kind: 'level', level: 28 } },
  { from: 'koffing', to: 'weezing', trigger: { kind: 'level', level: 35 } },
  { from: 'rhyhorn', to: 'rhydon', trigger: { kind: 'level', level: 42 } },
  { from: 'horsea', to: 'seadra', trigger: { kind: 'level', level: 32 } },
  { from: 'goldeen', to: 'seaking', trigger: { kind: 'level', level: 33 } },
  { from: 'staryu', to: 'starmie', trigger: { kind: 'stone', itemId: 'water-stone' } },
  { from: 'magikarp', to: 'gyarados', trigger: { kind: 'level', level: 20 } },
  { from: 'eevee', to: 'flareon', trigger: { kind: 'stone', itemId: 'fire-stone' } },
  { from: 'eevee', to: 'jolteon', trigger: { kind: 'stone', itemId: 'thunder-stone' } },
  { from: 'eevee', to: 'vaporeon', trigger: { kind: 'stone', itemId: 'water-stone' } },
  { from: 'omanyte', to: 'omastar', trigger: { kind: 'level', level: 40 } },
  { from: 'kabuto', to: 'kabutops', trigger: { kind: 'level', level: 40 } },
  { from: 'dratini', to: 'dragonair', trigger: { kind: 'level', level: 30 } },
  { from: 'dragonair', to: 'dragonite', trigger: { kind: 'level', level: 55 } },
];
