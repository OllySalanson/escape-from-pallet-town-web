import { publicAssetUrl } from '../publicAssetUrl';
import { EVOLUTIONS } from './evolution';
import type { Pokemon } from './Pokemon';

/**
 * What a Pokemon costs to carry home, in squares of the pack.
 *
 * The captain's ruling, 2026-09-19: "Pokemon should take up four squares in the
 * bag, and then when it evolves it should take up six squares, and then when it
 * evolves after that it should take up nine squares." It is the same instinct
 * as the rest of the grid - the good thing you found has to fit, and something
 * else may have to be left behind - applied to the best thing a raid can find.
 *
 * **The stage is derived from the evolution chain, never stored on a species.**
 * `evolution.ts` already says which species comes from which, so a Pokemon's
 * size is a fact about where it stands in its own line and the day the other
 * 144 are imported not one of them needs a footprint written for it. A species
 * nothing evolves into is first stage, which is also the right answer for a
 * Butterfree: it has no pre-evolution *here*, and a table would have had to
 * guess.
 *
 * **Your party is not cargo.** A deployed Pokemon walks beside you and costs no
 * squares - six of them at four squares each would be 24 against an 18-square
 * pack, and deployment would be impossible. What costs squares is what you are
 * *bringing back*: a Pokemon caught in the field, or one handed to you there.
 * That is also where the interesting decision is, because catching now spends
 * the room you were keeping for Potions and loot.
 *
 * The shapes are rectangles rather than bare counts because the grid is drawn:
 * 2x2, then 3x2, then 3x3. The one consequence worth knowing before it
 * surprises someone is that the secure container is two squares tall, so a
 * third-stage Pokemon cannot be put in it however many columns it grows - see
 * `../objectives/contracts.ts`'s `secureGrid`, which only ever adds columns.
 */

/** The rectangle a piece of cargo takes, structurally an `items` `ItemFootprint`. */
export interface CargoFootprint {
  readonly width: number;
  readonly height: number;
}

/** First stage, second, third: four squares, six, nine. */
export const POKEMON_STAGE_FOOTPRINTS: readonly CargoFootprint[] = [
  { width: 2, height: 2 },
  { width: 3, height: 2 },
  { width: 3, height: 3 },
];

/** How far along its own line a species stands: 1, 2 or 3. */
export function evolutionStage(speciesId: string): number {
  const seen = new Set<string>([speciesId]);
  let current = speciesId;
  let stage = 1;
  for (;;) {
    const rule = EVOLUTIONS.find((candidate) => candidate.to === current && !seen.has(candidate.from));
    if (!rule) {
      return Math.min(stage, POKEMON_STAGE_FOOTPRINTS.length);
    }
    seen.add(rule.from);
    current = rule.from;
    stage += 1;
  }
}

/** The squares one of this species takes up in a container, as a rectangle. */
export function pokemonFootprint(speciesId: string): CargoFootprint {
  return POKEMON_STAGE_FOOTPRINTS[evolutionStage(speciesId) - 1];
}

/** How many squares one of this species takes up. */
export function pokemonCargoCells(speciesId: string): number {
  const footprint = pokemonFootprint(speciesId);
  return footprint.width * footprint.height;
}

/** "4 squares", for a row or a refusal that has to name the price. */
export function cargoSquaresLabel(cells: number): string {
  return cells === 1 ? '1 square' : `${cells} squares`;
}

/**
 * One Pokemon as a piece of cargo, ready for the packer.
 *
 * `cargoId` is supplied by whoever holds the list - a stash id at base, the
 * position in the raid's catch list in the field - because a Pokemon in a raid
 * has no id of its own and two Pidgey caught in one raid are two pieces.
 */
export function pokemonCargo(
  cargoId: string,
  pokemon: Pokemon,
): CargoFootprint & { readonly cargoId: string; readonly name: string; readonly art: string } {
  return {
    cargoId,
    name: pokemon.base.name,
    // The same front sprite every other screen draws it with, so a block in the
    // pack is recognisably the Pokemon and not a coloured rectangle.
    art: publicAssetUrl(`assets/pokemon/front/${pokemon.base.dexId}.png`),
    ...pokemonFootprint(pokemon.base.id),
  };
}
