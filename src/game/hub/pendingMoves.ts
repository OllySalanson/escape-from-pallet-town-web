import type { StashedPokemon } from '../stash';

/**
 * Which queued move base asks about next, and what "decide later" puts off.
 *
 * A level-up that found four moves already known queues the new one on the
 * Pokemon (`Pokemon.pendingMoves`), and base asks it on the way in. Asked as
 * "the first Pokemon with anything queued", a deferral blocked the queue behind
 * it - every other Pokemon's move went unasked - and because the base is four
 * buildings, the same question greeted every door (playtest 32 #4).
 *
 * So "later" means *after the next raid*: a Pokemon put off is skipped until
 * the save has deployed again, and the next one in the queue is asked instead.
 * Nothing is stored. A reload asks once more, which is the honest reading of a
 * question nobody answered; and a deferral is keyed by the raid count the save
 * already keeps (`raidsDeployed`), so it lapses by itself with no list to clear.
 */
const deferredAt = new Map<string, number>();

/** "Decide later" on everything this Pokemon has queued, until the next raid. */
export function deferPendingMoves(pokemonId: string, raidsDeployed: number): void {
  deferredAt.set(pokemonId, raidsDeployed);
}

/** The next Pokemon base should ask about a queued move, if any. */
export function nextPendingMoveOffer(
  pokemon: readonly StashedPokemon[],
  raidsDeployed: number,
): StashedPokemon | undefined {
  return pokemon.find(
    ({ id, pokemon: one }) => one.pendingMoves.length > 0 && deferredAt.get(id) !== raidsDeployed,
  );
}
