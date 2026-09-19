import type { PokemonType } from '../PokemonType';
import { PokemonType as Types } from '../PokemonType';

/**
 * **Generation III's whole type chart: seventeen types, 289 cells.**
 *
 * Fifteen of the rows and columns came from `PokemonBase.cs` in the Unity
 * project, which took them from a tutorial whose author invented his own
 * monsters and so never needed Dark, Steel or Fairy. That absence was written
 * up as though it were canon - "fifteen types is the whole chart for the
 * original 151" - and it is not. It is true of **generation I only**. Dark and
 * Steel arrived in generation II and are live in FireRed/LeafGreen, which is
 * the generation this game is:
 *
 * - Magnemite and Magneton are Electric/Steel from generation II onward.
 * - Twelve Dark and Steel moves are learnt by level in FRLG by fifty of the
 *   151 - including **Charmander's Metal Claw** and **Squirtle's Bite**, so two
 *   of the three starters carry one in the first hours of the game.
 *
 * At fifteen types those moves were simply the wrong damage. **Fairy is the one
 * that genuinely postdates this generation** (it is generation VI) and it stays
 * out, which is why this is seventeen and not eighteen.
 *
 * Every multiplier below is generation III canon, taken cell by cell from
 * PokeAPI's `/type/{name}` damage relations back-dated to generation III (an
 * attacking type's `past_damage_relations` entry for the earliest generation at
 * or after III, else its current relations). The three cells Unity had wrong -
 * Water and Grass both doing double damage to Electric, Electric doing double
 * to Ice, all three neutral in canon - were corrected when the roster grew (the
 * captain's ruling of 2026-09-19) and are still neutral here.
 *
 * Three back-dated cells are worth naming, because a modern chart disagrees
 * with all three and copying one in would be the easy mistake: in generation
 * III **Dark into Steel, Ghost into Steel are both 0.5x** (generation VI raised
 * them to neutral), and **Steel has no super-effective answer to Fairy** because
 * there is no Fairy.
 *
 * `battleEngine.test.ts` holds all 289 cells against a second copy of the
 * matrix, so a mistyped row fails there rather than in a battle.
 */
const GENERATION_THREE_TYPE_ORDER: readonly PokemonType[] = [
  Types.Normal,
  Types.Fire,
  Types.Water,
  Types.Electric,
  Types.Grass,
  Types.Ice,
  Types.Fighting,
  Types.Poison,
  Types.Ground,
  Types.Flying,
  Types.Psychic,
  Types.Bug,
  Types.Rock,
  Types.Ghost,
  Types.Dragon,
  Types.Dark,
  Types.Steel,
];

//         nor  fir  wat  ele  gra  ice  fig  poi  gro  fly  psy  bug  roc  gho  dra  dar  ste
const TYPE_CHART: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.5, 0, 1, 1, 0.5], // Normal
  [1, 0.5, 0.5, 1, 2, 2, 1, 1, 1, 1, 1, 2, 0.5, 1, 0.5, 1, 2], // Fire
  [1, 2, 0.5, 1, 0.5, 1, 1, 1, 2, 1, 1, 1, 2, 1, 0.5, 1, 1], // Water
  [1, 1, 2, 0.5, 0.5, 1, 1, 1, 0, 2, 1, 1, 1, 1, 0.5, 1, 1], // Electric
  [1, 0.5, 2, 1, 0.5, 1, 1, 0.5, 2, 0.5, 1, 0.5, 2, 1, 0.5, 1, 0.5], // Grass
  [1, 0.5, 0.5, 1, 2, 0.5, 1, 1, 2, 2, 1, 1, 1, 1, 2, 1, 0.5], // Ice
  [2, 1, 1, 1, 1, 2, 1, 0.5, 1, 0.5, 0.5, 0.5, 2, 0, 1, 2, 2], // Fighting
  [1, 1, 1, 1, 2, 1, 1, 0.5, 0.5, 1, 1, 1, 0.5, 0.5, 1, 1, 0], // Poison
  [1, 2, 1, 2, 0.5, 1, 1, 2, 1, 0, 1, 0.5, 2, 1, 1, 1, 2], // Ground
  [1, 1, 1, 0.5, 2, 1, 2, 1, 1, 1, 1, 2, 0.5, 1, 1, 1, 0.5], // Flying
  [1, 1, 1, 1, 1, 1, 2, 2, 1, 1, 0.5, 1, 1, 1, 1, 0, 0.5], // Psychic
  [1, 0.5, 1, 1, 2, 1, 0.5, 0.5, 1, 0.5, 2, 1, 1, 0.5, 1, 2, 0.5], // Bug
  [1, 2, 1, 1, 1, 2, 0.5, 1, 0.5, 2, 1, 2, 1, 1, 1, 1, 0.5], // Rock
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 0.5, 0.5], // Ghost
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 0.5], // Dragon
  [1, 1, 1, 1, 1, 1, 0.5, 1, 1, 1, 2, 1, 1, 2, 1, 0.5, 0.5], // Dark
  [1, 0.5, 0.5, 0.5, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 0.5], // Steel
];

export const getTypeEffectiveness = (
  attackingType: PokemonType,
  defendingTypes: readonly PokemonType[],
): number =>
  defendingTypes.reduce(
    (multiplier, defendingType) =>
      multiplier *
      TYPE_CHART[GENERATION_THREE_TYPE_ORDER.indexOf(attackingType)][
        GENERATION_THREE_TYPE_ORDER.indexOf(defendingType)
      ],
    1,
  );
