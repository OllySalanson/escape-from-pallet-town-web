import { followerAssetPath, followerTextureKey, isFollowerSpecies, type FollowerSpeciesId } from '../base/partner';
import { evolutionFamily } from '../pokemon/evolution';
import type { Pokemon } from '../pokemon/Pokemon';

/**
 * Who walks at the player's heel on a raid: the rule, with nothing drawn.
 *
 * The harbour's partner is the starter and nobody else (`partner.ts`). A raid
 * is HeartGold's own rule instead - the Pokemon walking behind you is the one
 * that leads your party, the one sent out first - in its own colours, shiny
 * when it is. Every one of Kanto's 151 has HeartGold's walking art
 * (`FOLLOWER_ART`), so the lead is always the one drawn: a find that answers
 * "the one walking with you" - a Bug leading, a shiny leading, a Ghost - is
 * answering the Pokemon the player can see. Only the three starters' lines had
 * art once, and a shiny Butterfree leading walked as the Bulbasaur behind it
 * while THE OLD LIGHT's Starmie flared at it (playtest, 14 Nov 2026). The
 * partner is still the second answer, for a lead the art does not cover.
 *
 * Two things put a Pokemon out of the running:
 *
 * - **It has fainted.** A fainted lead is not who goes out first, so the
 *   next one standing is the lead; a fainted partner does not walk at all.
 * - **It is not in the party.** The partner is followed only if it came on
 *   this raid; at home in the vault it is no-one's to walk.
 *
 * Being in the secure container is not one of them. The container fills
 * itself with the party's best Pokemon (`hub/secureAutofill.ts`), so a lone
 * starter is nearly always in it - and it is still in the party and still
 * fights; the container only decides what survives a wipe.
 *
 * Asked every frame against the party as it now stands, so a faint, an
 * evolution, a catch or a reordered party changes who follows at once.
 */
export interface RaidFollower {
  readonly pokemon: Pokemon;
  readonly species: FollowerSpeciesId;
}

export function raidFollower(options: {
  /** The raid party, in the order the player has it. */
  readonly party: readonly Pokemon[];
  /** The save's partner - the starter it picked - if it came on this raid. */
  readonly partner?: Pokemon;
}): RaidFollower | null {
  const { party, partner } = options;
  const out = (pokemon: Pokemon): boolean => !pokemon.isFainted;
  const lead = party.find(out);
  const candidates = [lead, partner !== undefined && party.includes(partner) ? partner : undefined];
  for (const pokemon of candidates) {
    if (pokemon !== undefined && out(pokemon) && isFollowerSpecies(pokemon.base.id)) {
      return { pokemon, species: pokemon.base.id };
    }
  }
  return null;
}

/** Whether two answers are the same Pokemon drawn the same way - an evolution is not. */
export function sameFollower(a: RaidFollower | null, b: RaidFollower | null): boolean {
  return a?.pokemon === b?.pokemon && a?.species === b?.species;
}

/**
 * The shiny walking sheets a raid with this party could draw: every shiny one's
 * kind and whatever it evolves into, since it can evolve on the way. Ordinary
 * sheets are loaded with the game; a shiny's are fetched by the raid that walks
 * one, as a fight fetches a shiny's battle sprites (`shinyTexturesFor`), because
 * one encounter in five hundred is shiny.
 */
export function shinyFollowerSheets(
  party: readonly { readonly shiny: boolean; readonly base: { readonly id: string } }[],
): readonly { readonly key: string; readonly path: string }[] {
  const species = new Set(
    party
      .filter((member) => member.shiny)
      .flatMap((member) => evolutionFamily(member.base.id).map((kind) => kind.id))
      .filter(isFollowerSpecies),
  );
  return [...species].map((kind) => ({ key: followerTextureKey(kind, true), path: followerAssetPath(kind, true) }));
}
