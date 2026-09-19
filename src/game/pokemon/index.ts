export type {
  AbilityBase,
  AbilityEffectKind,
  AbilityHolder,
} from './AbilityBase';
export { ABILITIES, ABILITIES_BY_ID, getAbilityById } from './abilities';
export { Move } from './Move';
export { MoveBase, MoveCategory } from './MoveBase';
export {
  experienceAwardForDefeat,
  experienceForLevel,
  computePokemonStats,
  type ExperienceResult,
  Pokemon,
  type SpeciesEvolution,
} from './Pokemon';
export {
  EVOLUTIONS,
  type EvolutionRule,
  type EvolutionTrigger,
  evolutionByStone,
  evolutionFamily,
  evolutionOnLevel,
  evolvesInto,
} from './evolution';
export {
  MACHINES,
  MACHINE_DEFINITIONS,
  canLearnFromMachine,
  machineMovesFor,
  type MachineDefinition,
  type MachineId,
} from './machines';
export { type LearnableMove, PokemonBase, type PokemonBaseInit, type PokemonStats } from './PokemonBase';
export { PARTY_LIMIT, PokemonParty } from './PokemonParty';
export { PokemonType } from './PokemonType';
export {
  AERIAL_ACE,
  BITE,
  BUBBLE,
  BULLET_SEED,
  DIG,
  EMBER,
  FEATHER_DANCE,
  FLAMETHROWER,
  GROWL,
  GUST,
  HEAT_WAVE,
  HYDRO_PUMP,
  ICE_BEAM,
  IRON_TAIL,
  METAL_CLAW,
  POISON_POWDER,
  RAZOR_LEAF,
  ROCK_SMASH,
  SCARY_FACE,
  SCRATCH,
  SING,
  SLASH,
  SLEEP_POWDER,
  SUPER_SONIC,
  TACKLE,
  TAIL_WHIP,
  THUNDER_SHOCK,
  THUNDER_WAVE,
  THUNDERBOLT,
  VINE_WHIP,
  WATER_GUN,
  WING_ATTACK,
} from './moves';
export {
  BLASTOISE,
  BULBASAUR,
  BUTTERFREE,
  CHARIZARD,
  CHARMANDER,
  CHARMELEON,
  IVYSAUR,
  JIGGLYPUFF,
  PIDGEOT,
  PIDGEOTTO,
  PIDGEY,
  PIKACHU,
  RAICHU,
  SQUIRTLE,
  VENUSAUR,
  WARTORTLE,
  WIGGLYTUFF,
  getSpeciesById,
  SPECIES_BY_ID,
} from './species';
export {
  PALLET_TALL_GRASS,
  type WildEncounterEntry,
  type WildEncounterTable,
} from './encounters';
