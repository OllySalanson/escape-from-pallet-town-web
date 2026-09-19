import type { PokemonStats } from './PokemonBase';

/**
 * The base stats generation III gave, where a later generation raised them.
 *
 * **This table is the one thing in the import that came from neither source.**
 * Unity carries six base stats for six species and nothing else; PokeAPI serves
 * the *current* stat line and has no history for it at all - there is no
 * `past_stats` to read the way `past_types` and `past_abilities` are read. So
 * the snapshot in `tools/species/frlg-species.json` is generation IX's numbers,
 * and this is what puts the ones that moved back.
 *
 * Every row is a raise a later generation made, written as the value FireRed
 * had. Generation VI raised one stat on eighteen of Kanto's own (ten points
 * each, and Pikachu twice), and generation VIII gave Farfetch'd twenty-five
 * points of Attack when Sirfetch'd arrived. `speciesImport.test.ts` holds that
 * every row here is *lower* than the snapshot's, because a correction that
 * raises a stat is not a correction.
 *
 * **Three of these were already in the game and agree with it exactly.**
 * Pidgeot's 91 Speed, Raichu's 100 and Wigglytuff's 75 Sp. Atk were written
 * into `species.ts` by hand when the ten evolved forms were added, each with
 * the same note; Butterfree's 80 Sp. Atk and Pikachu's 30/40 are the two
 * AGENTS.md records as having *shipped* on the later value, and they stay that
 * way - see `SHIPPED_DEVIATIONS` in `shippedSpecies.ts`, which puts them back.
 * Five agreements is the only check this table has had.
 *
 * **What is not here.** A species nobody remembered is a species ten points
 * high, and nothing in either source can say which. This is the first thing to
 * check in the import.
 */
export const GENERATION_III_STATS: Readonly<Record<string, Partial<PokemonStats>>> = {
  // Generation VI, ten points each.
  butterfree: { spAttack: 80 },
  beedrill: { attack: 80 },
  pidgeot: { speed: 91 },
  arbok: { attack: 85 },
  pikachu: { defense: 30, spDefense: 40 },
  raichu: { speed: 100 },
  nidoqueen: { attack: 82 },
  nidoking: { attack: 92 },
  clefable: { spAttack: 85 },
  wigglytuff: { spAttack: 75 },
  vileplume: { spAttack: 100 },
  poliwrath: { attack: 85 },
  alakazam: { spDefense: 85 },
  victreebel: { spDefense: 60 },
  golem: { attack: 110 },
  dodrio: { speed: 100 },
  electrode: { speed: 140 },
  exeggutor: { spDefense: 65 },
  // Generation VIII, with Sirfetch'd.
  farfetchd: { attack: 65 },
};
