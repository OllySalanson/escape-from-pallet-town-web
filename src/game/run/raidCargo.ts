import type { Bag, GridCargo } from '../items';
import type { Pokemon } from '../pokemon';
import { cargoSquaresLabel, pokemonCargo, pokemonCargoCells } from '../pokemon/pokemonCargo';
import type { RunSnapshot } from './RunManager';

/**
 * The raid side of a Pokemon's footprint: what the pack is carrying home, and
 * what it says when the next one will not go in.
 *
 * The raid's own catch list (`RunSnapshot.caughtPokemon`, which gifts join) is
 * the single truth, and it already holds a caught Pokemon whether it went into
 * the party or into the raid's stash - both are cargo, because neither was
 * deployed. The pack is told this list rather than a piece at a time, so a
 * battle that rebuilds the world cannot charge for the same Pidgey twice.
 */

/** Every Pokemon this raid is carrying home, as squares of the pack. */
export function raidPackCargo(carried: readonly Pokemon[]): readonly GridCargo[] {
  return carried.map((pokemon, index) => pokemonCargo(`carried-${index}`, pokemon));
}

/** Points a raid pack at what the raid is carrying. Safe to call every frame. */
export function syncPackCargo(bag: Bag, snapshot: Pick<RunSnapshot, 'caughtPokemon'>): void {
  bag.setCargo(raidPackCargo(snapshot.caughtPokemon));
}

/** Whether one more Pokemon would go into the pack beside what is in it. */
export function packHasRoomForPokemon(bag: Bag, pokemon: Pokemon): boolean {
  return bag.fitsCargo(pokemonCargo('incoming', pokemon));
}

/**
 * What the raid says when the pack has no room for a Pokemon.
 *
 * It names the Pokemon and its price in squares, because the grid's whole
 * promise is that a refusal tells the player exactly what they would have to
 * put down - "the pack is full" on its own is a wall, not a decision.
 */
export function packFullForPokemonLine(pokemon: Pokemon): string {
  const squares = cargoSquaresLabel(pokemonCargoCells(pokemon.base.id));
  return `No room in the pack! ${pokemon.base.name.toUpperCase()} needs ${squares}.`;
}
