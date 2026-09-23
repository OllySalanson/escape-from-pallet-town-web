import { PokemonBase, type LearnableMove } from './PokemonBase';
import { ABILITIES_BY_ID } from './abilities';
import { GENERATED_SPECIES, type GeneratedSpecies } from './generated/speciesCatalogue';
import { MOVE_CATALOGUE } from './moveCatalogue';
import { SHIPPED_DEVIATIONS } from './shippedSpecies';

/**
 * Kanto's original 151, built from the import rather than written out.
 *
 * Three things go into a species and each is owned by exactly one file, which
 * is what makes the roster reviewable at this size:
 *
 *  1. **canon**, `generated/speciesCatalogue.ts`, generated from the committed
 *     PokeAPI snapshots by `node tools/species/generate.mjs`. Its base stats and
 *     types are FireRed's own, checked against three sources by
 *     `tools/species/verifyStats.mjs`, and a species fields them untouched -
 *     nothing in this game is allowed a stat canon does not give it;
 *  2. **what this game decided differently**, `shippedSpecies.ts`, which is
 *     every disagreement with canon in one place, and is learnsets only;
 *  3. **what the engine can play**, which is asked here: a move canon teaches
 *     that `MOVE_CATALOGUE` does not hold is left out of the learnset rather
 *     than approximated, and an ability `abilities.ts` cannot express leaves
 *     its species with none - which is what `abilityId: null` has meant since
 *     Jigglypuff's Cute Charm needed a gender nothing here has.
 *
 * `docs/pokemon/roster.md` is the list of everything (3) drops, by species and
 * with the reason, and `speciesImport.test.ts` holds the floor under it: a
 * species can still field a damaging move at every level it can be met at.
 */
const applyLearnset = (row: GeneratedSpecies): readonly LearnableMove[] =>
  (SHIPPED_DEVIATIONS[row.id]?.learnset ?? row.learnset).flatMap((entry) => {
    const move = MOVE_CATALOGUE[entry.move];
    return move ? [{ level: entry.level, move }] : [];
  });

/**
 * The first of the species' generation III ability slots this engine can
 * express. A generation III Pokemon is born into one of its species' one or two
 * slots and nothing in a save records which, so every member of a species plays
 * the same - and where the first slot is one the engine has no hook for, the
 * second is asked before giving up on the species altogether.
 */
const abilityOf = (row: GeneratedSpecies): string | null =>
  row.abilityIds.find((id) => ABILITIES_BY_ID[id]) ?? null;

const build = (row: GeneratedSpecies): PokemonBase =>
  new PokemonBase({
    id: row.id,
    dexId: row.dexId,
    name: row.name,
    abilityId: abilityOf(row),
    primaryType: row.types[0],
    secondaryType: row.types[1],
    baseStats: row.baseStats,
    learnset: applyLearnset(row),
    catchRate: row.catchRate,
    baseExperience: row.baseExperience,
    growthRate: row.growthRate,
  });

export const ALL_SPECIES: readonly PokemonBase[] = GENERATED_SPECIES.map(build);

export const SPECIES_BY_ID: Readonly<Record<string, PokemonBase>> = Object.freeze(
  Object.fromEntries(ALL_SPECIES.map((species) => [species.id, species])),
);

export const getSpeciesById = (speciesId: string): PokemonBase | undefined =>
  SPECIES_BY_ID[speciesId];

const named = (id: string): PokemonBase => {
  const species = SPECIES_BY_ID[id];
  if (!species) {
    throw new Error(`${id} is not one of the 151`);
  }
  return species;
};

// The seventeen the game names directly - starters, their lines, and everything
// a trainer, a gift or a wild table was authored against before the import.
// Everything else is reached through `getSpeciesById`, because 151 exported
// constants would be a list nobody reads.
export const BULBASAUR = named('bulbasaur');
export const IVYSAUR = named('ivysaur');
export const VENUSAUR = named('venusaur');
export const CHARMANDER = named('charmander');
export const CHARMELEON = named('charmeleon');
export const CHARIZARD = named('charizard');
export const SQUIRTLE = named('squirtle');
export const WARTORTLE = named('wartortle');
export const BLASTOISE = named('blastoise');
export const BUTTERFREE = named('butterfree');
export const PIDGEY = named('pidgey');
export const PIDGEOTTO = named('pidgeotto');
export const PIDGEOT = named('pidgeot');
export const PIKACHU = named('pikachu');
export const RAICHU = named('raichu');
export const JIGGLYPUFF = named('jigglypuff');
export const WIGGLYTUFF = named('wigglytuff');
