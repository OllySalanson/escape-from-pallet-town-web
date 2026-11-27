/**
 * THE GAME CORNER's own Pokémon, lent at the cabinet: one that can jump and
 * one that can pick, so nobody walks out of the arcade having played nothing.
 * A cabinet plays its loan by default when the partner cannot play, and offers
 * it last after the player's own (`attract.ts`).
 *
 * Ten raids in, the harbour critic tour (26 Nov 2026) could play neither
 * cabinet: its BULBASAUR had evolved off FireRed's jumping list, and it had
 * never met a DODUO. The Battle Arena already rents Pokémon for its bouts;
 * the attendant does the same for the cabinets. A loan plays and pays exactly
 * as a Pokémon of your own does, and is never yours: it is not in a box, and
 * nothing it does is written anywhere but the score.
 */

export interface HouseLoan {
  /** Its own id, `house:` and its kind: never a stored Pokémon's. */
  readonly id: string;
  readonly species: string;
  readonly dexId: number;
  readonly name: string;
  readonly level: number;
}

/** FireRed's own jumper, a normal one (`generated/pokemonJump.ts`). */
export const HOUSE_JUMPER: HouseLoan = { id: 'house:pikachu', species: 'pikachu', dexId: 25, name: 'Pikachu', level: 10 };

/** Two heads, so it picks at a push (`berryPicking.ts`, `BERRY_PICKERS`). */
export const HOUSE_PICKER: HouseLoan = { id: 'house:doduo', species: 'doduo', dexId: 84, name: 'Doduo', level: 10 };
