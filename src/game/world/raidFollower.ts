import { isPartnerSpecies, type PartnerSpeciesId } from '../base/partner';
import type { Pokemon } from '../pokemon/Pokemon';

/**
 * Who walks at the player's heel on a raid: the rule, with nothing drawn.
 *
 * The harbour's partner is the starter and nobody else (`partner.ts`). A raid
 * is HeartGold's own rule instead - the Pokemon walking behind you is the one
 * that leads your party, the one sent out first - with the starter as the
 * second answer, because the only walking art there is (`FOLLOWER_ART`) is
 * the three starters' lines: a lead with nobody to draw it hands the walk to
 * the partner rather than leave the player alone.
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
  readonly species: PartnerSpeciesId;
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
    if (pokemon !== undefined && out(pokemon) && isPartnerSpecies(pokemon.base.id)) {
      return { pokemon, species: pokemon.base.id };
    }
  }
  return null;
}

/** Whether two answers are the same Pokemon drawn the same way - an evolution is not. */
export function sameFollower(a: RaidFollower | null, b: RaidFollower | null): boolean {
  return a?.pokemon === b?.pokemon && a?.species === b?.species;
}
