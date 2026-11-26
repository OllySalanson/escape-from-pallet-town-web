/**
 * The finds the locker can keep room for (`DeploymentFlow.setSecureSquares` on
 * a found-only kind): squares held open in it for one carried out of a raid,
 * which then comes home even if the raid is lost. YOUR THINGS offers them on
 * its locker's ROOM FOR A FIND list (`scenes/ThingsScene.ts`), whether or not
 * one is at home yet - a parts crate the board wants, or the Pokédollars a
 * raid picks up.
 *
 * Phaser-free, so which kinds are offered is tested without a screen. The
 * rule is the one THE LOCKER's old panel kept: furniture and clothes come home
 * in a pack that comes home, so no room is kept for them; somebody's errand is
 * offered only while its thing is out there to be found; a piece of the sea
 * chart only once the hunt has started (AI playtest, 22 Nov 2026).
 */
import { FOUND_ONLY_IDS, isErrandItem, isFurniture, isWearableItem, type ItemId } from '../items';
import { CHART_PIECES } from '../treasure/treasureMap';
import { errandsToLay, type ErrandProgress } from './errands';

export interface FindRoomContext {
  readonly progress: Pick<ErrandProgress, 'errands'> & { readonly treasureHunt?: { readonly pinned: readonly unknown[] } };
  /** How many of a kind the player has, at home or on the fossil machine. */
  readonly held: (itemId: ItemId) => number;
  /** Whether the Pokédex owns a kind. */
  readonly owns: (speciesId: string) => boolean;
}

/** The found kinds the locker can keep room for, in the catalogue's order. */
export function findsToKeepRoomFor(context: FindRoomContext): readonly ItemId[] {
  const wanted = errandsToLay(context.progress, context.held, context.owns).map((errand) => errand.itemId as string);
  const hunting = (context.progress.treasureHunt?.pinned.length ?? 0) > 0;
  return FOUND_ONLY_IDS.filter(
    (itemId) =>
      !isFurniture(itemId) &&
      !isWearableItem(itemId) &&
      (!isErrandItem(itemId) || wanted.includes(itemId)) &&
      (hunting || !CHART_PIECES.some((piece) => piece.itemId === itemId)),
  );
}
