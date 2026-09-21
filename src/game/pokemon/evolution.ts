import type { PokemonBase } from './PokemonBase';
import { GENERATED_EVOLUTIONS } from './generated/evolutionRules';
import { getSpeciesById } from './species';

/**
 * Why an evolution happens. A level evolution is crossed by winning fights; a
 * stone evolution is bought with something found in a raid and spent by hand,
 * which is the whole reason the stone lines are worth having - they are the one
 * kind of progress that is *carried* rather than earned, so it can be lost in
 * the field like anything else in the pack.
 */
export type EvolutionTrigger =
  | { readonly kind: 'level'; readonly level: number }
  /**
   * `itemId` is a plain string rather than an `ItemId`: `items.ts` reads the
   * Pokemon module, so naming its type here would close the loop.
   */
  | { readonly kind: 'stone'; readonly itemId: string }
  /**
   * Trading, which this game does not have and is not going to: Kadabra,
   * Machoke, Graveler and Haunter therefore cannot evolve. The rule is carried
   * anyway because it is what makes the *family* right - `evolutionFamily`
   * reads it when a save looks a move up, and `pokemonCargo.ts` counts pack
   * squares by how far along a line a species is, so dropping it would make an
   * Alakazam a first-stage Pokemon. Nothing triggers it: `evolutionOnLevel` and
   * `evolutionByStone` are the only two questions asked, and neither matches.
   */
  | { readonly kind: 'trade' };

export interface EvolutionRule {
  readonly from: string;
  readonly to: string;
  readonly trigger: EvolutionTrigger;
}

/**
 * Every evolution among Kanto's original 151, as generation III had them.
 *
 * **The list is generated.** `generated/evolutionRules.ts` is written by
 * `node tools/species/generate.mjs` from the committed PokeAPI snapshot in
 * `tools/species/frlg-species.json`, and its header says what the filtering
 * throws away - the baby forms, the later generations' additions, and the
 * stones that did not exist yet. Unity carries no evolution data at all
 * (`PokemonBase.cs` has no field for it), which is why PokeAPI is the whole
 * source here.
 *
 * **Seventeen of these need a stone the game does not have.** Only the Thunder
 * Stone is an item (`items.ts`); Fire, Water, Leaf and Moon Stones are named by
 * rules here and nothing hands one out, so those lines are as unreachable as
 * the trade ones until a stone is put somewhere a raid can find it. That is a
 * question about loot and Bill's shelf rather than about this table,
 * and a stone that does nothing is a worse find than no stone.
 *
 * **What a move a species cannot express does to a learnset** is
 * `docs/pokemon/roster.md`, not this file. It used to be written out here; the
 * import made it a generated list.
 */
export const EVOLUTIONS: readonly EvolutionRule[] = GENERATED_EVOLUTIONS;

/** The species this one turns into on reaching `level`, if any. */
export function evolutionOnLevel(speciesId: string, level: number): PokemonBase | undefined {
  const rule = EVOLUTIONS.find(
    (candidate) =>
      candidate.from === speciesId &&
      candidate.trigger.kind === 'level' &&
      level >= candidate.trigger.level,
  );
  return rule ? getSpeciesById(rule.to) : undefined;
}

/** The species this one turns into when `itemId` is used on it, if any. */
export function evolutionByStone(speciesId: string, itemId: string): PokemonBase | undefined {
  const rule = EVOLUTIONS.find(
    (candidate) =>
      candidate.from === speciesId &&
      candidate.trigger.kind === 'stone' &&
      candidate.trigger.itemId === itemId,
  );
  return rule ? getSpeciesById(rule.to) : undefined;
}

/** Whether `speciesId` is somewhere further along the same line than `fromId`. */
export function evolvesInto(fromId: string, speciesId: string): boolean {
  if (fromId === speciesId) {
    return false;
  }
  const seen = new Set<string>([fromId]);
  let frontier = [fromId];
  while (frontier.length > 0) {
    const next = EVOLUTIONS.filter((rule) => frontier.includes(rule.from)).map((rule) => rule.to);
    if (next.includes(speciesId)) {
      return true;
    }
    frontier = next.filter((id) => !seen.has(id));
    frontier.forEach((id) => seen.add(id));
  }
  return false;
}

/**
 * Every species in one line, pre-evolutions and evolutions alike.
 *
 * A save stores the moves a Pokemon knows by name and looks each one up in its
 * species' own learnset, which is the right rule right up until a species can
 * change: an Ivysaur that evolved out of this game's Bulbasaur still knows the
 * Super Sonic that only Bulbasaur teaches, and looking in Ivysaur's learnset
 * alone would have quietly deleted it on the next load. The lookup is widened
 * to the line rather than to every move in the game, so a corrupt save still
 * cannot hand a Pidgey a Hydro Pump.
 */
export function evolutionFamily(speciesId: string): readonly PokemonBase[] {
  const family = new Set<string>([speciesId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of EVOLUTIONS) {
      if (family.has(rule.from) && !family.has(rule.to)) {
        family.add(rule.to);
        changed = true;
      }
      if (family.has(rule.to) && !family.has(rule.from)) {
        family.add(rule.from);
        changed = true;
      }
    }
  }
  return [...family].flatMap((id) => {
    const species = getSpeciesById(id);
    return species ? [species] : [];
  });
}
