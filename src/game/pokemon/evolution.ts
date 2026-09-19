import type { PokemonBase } from './PokemonBase';
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
  | { readonly kind: 'stone'; readonly itemId: string };

export interface EvolutionRule {
  readonly from: string;
  readonly to: string;
  readonly trigger: EvolutionTrigger;
}

/**
 * Every evolution the shipped species have, and where each one comes from.
 *
 * **Unity carries none of this.** `Assets/Scripts/Pokemons/PokemonBase.cs` in
 * `OllySalanson/escapeFromPalletTown` has fields for name, sprites, two types,
 * six base stats and a learnable-move list, and nothing else - there is no
 * evolution concept anywhere in that project, and none of the ten evolved
 * species exist in its six `Pokemons/*.asset` files. AGENTS.md makes Unity the
 * first place to look for a mechanical fact; it was looked in, and it is
 * silent, so every rule below is PokeAPI's `/evolution-chain/` data, read on
 * 2026-09-19:
 *
 * | Line | Rule | Chain |
 * | --- | --- | --- |
 * | Bulbasaur -> Ivysaur -> Venusaur | level 16, level 32 | `/evolution-chain/1` |
 * | Charmander -> Charmeleon -> Charizard | level 16, level 36 | `/evolution-chain/2` |
 * | Squirtle -> Wartortle -> Blastoise | level 16, level 36 | `/evolution-chain/3` |
 * | Pidgey -> Pidgeotto -> Pidgeot | level 18, level 36 | `/evolution-chain/6` |
 * | Pikachu -> Raichu | Thunder Stone | `/evolution-chain/10` |
 * | Jigglypuff -> Wigglytuff | Moon Stone | `/evolution-chain/14` |
 *
 * Butterfree is the seventh shipped species and has no evolution: it is already
 * the end of the Caterpie line (`/evolution-chain/4`).
 *
 * Two things the table deliberately does not carry. The baby forms - Pichu into
 * Pikachu, Cleffa into Clefairy - are friendship evolutions of species this
 * game does not have, and friendship is not a number anything here tracks. And
 * the Moon Stone rule ships **without a Moon Stone item**: Jigglypuff is only
 * ever a trainer's Pokemon today, so nothing a player can own would respond to
 * one, and a stone that does nothing is a worse find than no stone. The rule is
 * here so that the day a Jigglypuff can be caught, the item is the only thing
 * missing.
 *
 * This file used to carry a long list of moves these species learn in
 * FireRed/LeafGreen that the engine could not represent - healing, two-turn, a
 * stat boost on the user, an accuracy or evasion stage, priority, multi-hit,
 * a raised critical rate - "left out rather than approximated". **That list is
 * mostly gone.** `MoveBase` now carries each of those as a field and
 * `battleEngine.ts` reads them, so Synthesis, Solar Beam, Agility, Smokescreen,
 * Double Team, Quick Attack, Double Slap, Double-Edge, Body Slam and Psybeam
 * are ordinary data rows; Metal Claw and Bite came back when the type chart
 * grew to seventeen. `tools/moves/coverage.mjs` is the current count.
 *
 * What is still left out, and why: **Leech Seed, Fire Spin, Rapid Spin,
 * Whirlwind, Mirror Move, Disable, Protect, Rain Dance, Light Screen and
 * Safeguard** need per-combatant timed effects, a field, or a forced switch -
 * the tiers above this one. **Dragon Rage** is fixed damage. And **Withdraw,
 * Defense Curl, Growth, Sand Attack, Confusion and Sweet Scent** are all
 * expressible now but wait for the import, because their only canon slot is at
 * a level the shipped game actually fields, and AGENTS.md is explicit that a
 * learnset change to the early game is measured rather than assumed.
 */
export const EVOLUTIONS: readonly EvolutionRule[] = [
  { from: 'bulbasaur', to: 'ivysaur', trigger: { kind: 'level', level: 16 } },
  { from: 'ivysaur', to: 'venusaur', trigger: { kind: 'level', level: 32 } },
  { from: 'charmander', to: 'charmeleon', trigger: { kind: 'level', level: 16 } },
  { from: 'charmeleon', to: 'charizard', trigger: { kind: 'level', level: 36 } },
  { from: 'squirtle', to: 'wartortle', trigger: { kind: 'level', level: 16 } },
  { from: 'wartortle', to: 'blastoise', trigger: { kind: 'level', level: 36 } },
  { from: 'pidgey', to: 'pidgeotto', trigger: { kind: 'level', level: 18 } },
  { from: 'pidgeotto', to: 'pidgeot', trigger: { kind: 'level', level: 36 } },
  { from: 'pikachu', to: 'raichu', trigger: { kind: 'stone', itemId: 'thunder-stone' } },
  { from: 'jigglypuff', to: 'wigglytuff', trigger: { kind: 'stone', itemId: 'moon-stone' } },
];

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
