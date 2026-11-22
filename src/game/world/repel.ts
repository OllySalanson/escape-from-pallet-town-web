import type { ItemDefinition } from '../items';
import type { Pokemon } from '../pokemon';

/**
 * FireRed's Repel, in a raid.
 *
 * Sprayed from the raid's pack, it keeps wild Pokémon weaker than the lead
 * away for as many steps as the item says (`ItemEffect` `repel`): FireRed's
 * `IsWildLevelAllowedByRepel` (pret/pokefirered `src/wild_encounter.c`), which
 * lets through a wild Pokémon whose level is at least the first one in the
 * party still standing, and turns back everything below it. It is a rule about
 * the grass, the caves and the water a step rolls in, never about a meeting a
 * player walked to: the shimmering grass, a legend, a trainer, the hunter and a
 * line cast into the water are all met whatever is sprayed, as a FireRed rod
 * ignores a Repel.
 *
 * The steps left ride on the raid (`ActiveRunSession.repel`), because a fight
 * tears the world down and a Repel lasts across it, as FireRed's step counter
 * does. One sprayed while one is still working is refused and not spent,
 * FireRed's own answer, and the step it wears off on is said and rolls nothing,
 * as FireRed's step script stops the step there.
 *
 * Bartered for at Bill's in lamp oil (`../hub/trader.ts`), so the grass keeps
 * its own rate and a raid that wants a quiet walk pays for it in a material.
 */

/** What a raid remembers of a Repel: the steps left, and zero until the wearing off has been said. */
export interface RepelState {
  readonly stepsLeft: number;
}

/** FireRed's line when a Repel runs out (`gText_RepelWoreOff`). */
export const REPEL_WORE_OFF_LINE = "The Repel's effect wore off.";

/** FireRed's refusal while one is still working (`gText_RepelEffectsLingered`). */
export const REPEL_LINGERED_LINE = 'But the effects of a Repel lingered from earlier.';

/** What spraying one says, in the bag: who it keeps away and for how long. */
export function repelSprayedLine(item: ItemDefinition): string {
  const steps = item.effect.type === 'repel' ? item.effect.steps : 0;
  return `Used the ${item.displayName}. Wild Pokémon weaker than your lead keep away for ${steps} steps.`;
}

/** Whether a Repel is still working. */
export function repelWorking(repel: RepelState | undefined): boolean {
  return (repel?.stepsLeft ?? 0) > 0;
}

/**
 * Spraying one: the new state, or null when one is still working and this one
 * is not spent. A Repel that has run out and not yet been said is replaced.
 */
export function sprayRepel(repel: RepelState | undefined, item: ItemDefinition): RepelState | null {
  if (item.effect.type !== 'repel' || repelWorking(repel)) {
    return null;
  }
  return { stepsLeft: item.effect.steps };
}

/**
 * One step taken: a step off the count. The step that takes the last one
 * leaves it at zero, which is how the raid knows the wearing off is still to
 * be said; a raid with none sprayed has nothing to count.
 */
export function stepRepel(repel: RepelState | undefined): RepelState | undefined {
  if (!repelWorking(repel)) {
    return repel;
  }
  return { stepsLeft: repel!.stepsLeft - 1 };
}

/** Whether the Repel ran out on a step and nobody has been told yet. */
export function repelWoreOff(repel: RepelState | undefined): boolean {
  return repel !== undefined && repel.stepsLeft <= 0;
}

/**
 * FireRed's test: with a Repel working, a wild Pokémon is turned back when its
 * level is below the first Pokémon in the party that can still fight. A party
 * with nobody standing turns nothing back, as FireRed's loop finds nobody.
 */
export function repelKeepsAway(
  repel: RepelState | undefined,
  wildLevel: number,
  party: readonly Pick<Pokemon, 'level' | 'isFainted'>[],
): boolean {
  if (!repelWorking(repel)) {
    return false;
  }
  const lead = party.find((pokemon) => !pokemon.isFainted);
  return lead !== undefined && wildLevel < lead.level;
}
