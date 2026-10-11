import { evolutionFamily } from './evolution';
import { pokemonSpritePath, pokemonTextureKey } from './pokemonSprites';
import type { SeededRng } from '../run/rng';

/**
 * A shiny is a wild Pokemon in its other colours: rare enough to be an event,
 * not so rare that a player never meets one (the captain, 2026-10-11).
 *
 * FireRed's odds are 1 in 8,192 - `SHINY_ODDS` is 8, out of the 65,536 values
 * of `IsMonShiny`'s personality-and-trainer-id xor (pret/pokefirered,
 * `src/pokemon.c`) - which over raids of a handful of encounters each is a
 * thing nobody playing this game would ever see. One in 500 is a shiny every
 * few dozen raids: a story somebody tells, never a thing anybody farms.
 */
export const SHINY_ODDS = 500;

/**
 * Whether a wild encounter is shiny. Rolled once, when the encounter is met,
 * and kept on the Pokemon for good (`Pokemon.shiny`), so a caught shiny is
 * shiny in every list and every fight after.
 *
 * The roll is its own stream (`ActiveRunSession.shinyRng`), never the raid's
 * world stream: a draw taken from that would move every loot, trainer and
 * encounter roll after it, and a seed would stop playing the same raid.
 */
export function rollShiny(rng: Pick<SeededRng, 'next'> = { next: Math.random }): boolean {
  return rng.next() < 1 / SHINY_ODDS;
}

/**
 * Every shiny texture a fight with these Pokemon on the field could need: both
 * sides of each shiny one's whole evolution line, because a Pokemon can evolve
 * in the middle of a fight and must come out of it in the same colours it went
 * in with. Ordinary textures are loaded at boot; a shiny's are fetched by the
 * fight that meets it.
 */
export function shinyTexturesFor(
  pokemon: readonly { readonly shiny: boolean; readonly base: { readonly id: string } }[],
): readonly { readonly key: string; readonly path: string }[] {
  const dexIds = new Set(
    pokemon
      .filter((member) => member.shiny)
      .flatMap((member) => evolutionFamily(member.base.id).map((species) => species.dexId)),
  );
  return [...dexIds].flatMap((dexId) =>
    (['front', 'back'] as const).map((side) => ({
      key: pokemonTextureKey(side, dexId, true),
      path: pokemonSpritePath(side, dexId, true),
    })),
  );
}
