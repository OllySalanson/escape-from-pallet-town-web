import { ITEM_DEFINITIONS, fitsInGrid, lastBlockOf, type Bag, type GridCargo } from '../items';
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
 * Makes room for one more Pokemon where the squares are there and only the
 * arrangement is in the way.
 *
 * A refusal has to mean "there is no room", never "there is no room the way you
 * have packed it" - the second is a wall the player cannot get over from inside
 * a battle, which is the fault the make-room screen exists to answer and which
 * a re-pack answers for free. The pack gives up its arrangement rather than
 * keeping it, because the Pokemon is not in the contents the packer could seat
 * around yet; `reseated` is what the caller says out loud.
 *
 * @returns Whether the pack can now take it, and whether it had to re-pack.
 */
export function clearPackRoomForPokemon(
  bag: Bag,
  pokemon: Pokemon,
): { readonly fits: boolean; readonly reseated: boolean } {
  if (packHasRoomForPokemon(bag, pokemon)) {
    return { fits: true, reseated: false };
  }
  if (!bag.tidyWouldFitCargo(pokemonCargo('incoming', pokemon))) {
    return { fits: false, reseated: false };
  }
  bag.unarrange();
  return { fits: packHasRoomForPokemon(bag, pokemon), reseated: true };
}

/**
 * What the raid says when the pack has no room for a Pokemon.
 *
 * It names the Pokemon and its price in squares, because the grid's whole
 * promise is that a refusal tells the player exactly what they would have to
 * put down - "the pack is full" on its own is a wall, not a decision.
 */
export function packFullForPokemonLine(pokemon: Pokemon, bag?: Pick<Bag, 'layout'>): string {
  const squares = cargoSquaresLabel(pokemonCargoCells(pokemon.base.id));
  return `No room in the pack! ${pokemon.name.toUpperCase()} needs ${squares}${bag ? `, and ${freeSquaresLabel(bag, pokemonCargoCells(pokemon.base.id))}` : ''}.`;
}

/**
 * How many of the pack's squares are empty, as the refusal says it beside what
 * the catch needs. Without it a player putting things down one at a time could
 * not tell how far off they were, and dropped Potions they needed (AI
 * playtest, 20 Nov 2026). Free squares may still be the wrong shape, which the
 * rows below say drop by drop (`packRoomPrompt`).
 */
function freeSquaresLabel(bag: Pick<Bag, 'layout'>, needed: number): string {
  const { cellsUsed, cellsTotal } = bag.layout();
  const free = Math.max(0, cellsTotal - cellsUsed);
  const count = free === 0 ? 'none are free' : free === 1 ? '1 is free' : `${free} are free`;
  // Enough squares that are not in its shape: said, or "needs 4, and 4 are free" reads as a fault.
  return free >= needed ? `${count}, but not in its shape` : count;
}

/**
 * One thing in the pack that could be put down to make room, priced in squares.
 *
 * `freesEnough` is asked of the packer rather than reasoned about: four free
 * squares scattered around a Potion are not a seat for a 2x2 Pidgey, so whether
 * one Potion is the answer can only be found by taking it out and re-packing.
 */
export interface PackRoomChoice {
  readonly itemId: string;
  /** What the row calls it, in the catalogue's own words. */
  readonly displayName: string;
  readonly carried: number;
  /**
   * How many one press puts down: one, or for a find that stacks on a square
   * (money), what stands on its last square - a single ₽1 out of a bundle of
   * two hundred and fifty frees nothing at all.
   */
  readonly drops: number;
  /** The squares putting `drops` down frees. */
  readonly squares: number;
  /** Whether putting `drops` down is room enough on its own. */
  readonly freesEnough: boolean;
}

/**
 * What the pack could put down to make room for a Pokemon, in catalogue order.
 *
 * Only supplies: what is already being carried home is what the raid was for,
 * and letting a fight talk a player out of a Pokemon they have already caught
 * is a decision for a screen with more room than a battle panel. An empty list
 * therefore means there is genuinely nothing here to trade, which is a fact the
 * refusal has to be able to state rather than a case it can ignore.
 *
 * `keepOne` is the thing the room is being made *for* - the ball waiting to be
 * thrown. The last of it is never offered, because a list that invites the
 * player to put down the ball that would make the catch is a second trap in
 * the same breath as the first.
 */
export function packRoomChoices(
  bag: Bag,
  pokemon: Pokemon,
  keepOne?: string,
): readonly PackRoomChoice[] {
  const incoming = pokemonCargo('incoming', pokemon);
  const contents = bag.toJSON();
  const capacity = bag.capacity;
  return ITEM_DEFINITIONS.filter(
    (item) => (contents[item.id] ?? 0) > (item.id === keepOne ? 1 : 0),
  ).map((item) => {
    const carried = contents[item.id];
    const drops = lastBlockOf(item.id, carried);
    return {
      itemId: item.id,
      displayName: item.displayName,
      carried,
      drops,
      squares: item.footprint.width * item.footprint.height,
      freesEnough:
        capacity === null ||
        fitsInGrid({ ...contents, [item.id]: carried - drops }, capacity, [...bag.cargo, incoming]),
    };
  });
}

/**
 * Whether the pack could hold this Pokemon at all, with everything that can be
 * put down put down: only the Pokemon already carried and the one ball being
 * thrown (`keepOne`) left in. When it cannot, the make-room panel has nothing
 * to offer - a 12-square Satchel carrying a 6-square Ivysaur can never seat a
 * 9-square Alakazam, and the panel took four items off a veteran one at a
 * time before the throw was given up (playtest, 20 Nov 2026).
 */
export function packCouldEverHoldPokemon(bag: Bag, pokemon: Pokemon, keepOne?: string): boolean {
  const capacity = bag.capacity;
  return (
    capacity === null ||
    fitsInGrid(keepOne ? { [keepOne]: 1 } : {}, capacity, [...bag.cargo, pokemonCargo('incoming', pokemon)])
  );
}

/** What the raid says when no amount of putting things down would make room. */
export function packNeverFitsPokemonLine(pokemon: Pokemon): string {
  return `${packFullForPokemonLine(pokemon)} Even with everything else put down, this pack cannot hold it.`;
}
