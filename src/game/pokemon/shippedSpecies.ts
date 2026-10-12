/**
 * A level-up move, by the identifier both snapshots use for it.
 *
 * Species are authored against the *identifier* rather than the `MoveBase`
 * object, because `moveCatalogue.ts` is where the generated catalogue and the
 * moves this game wrote by hand are merged, and a learnset that named the
 * object directly would pick one of the two before the merge happened.
 */
export interface AuthoredLearnsetEntry {
  readonly level: number;
  readonly move: string;
}

/**
 * A learnset, and never a stat. The captain's ruling (2026-09-23) is that every
 * base stat is FireRed's, so a deviation has nowhere to put one: the type is
 * what keeps a guessed number out, not a reviewer.
 */
export interface SpeciesDeviation {
  /** The whole learnset, replacing canon's. */
  readonly learnset?: readonly AuthoredLearnsetEntry[];
}

/**
 * Every place the shipped game and generation III canon disagree, in one list -
 * and the list is empty.
 *
 * The import brought in all 151 from the snapshots, and the seventeen species
 * that were already here kept the learnsets they shipped with until the
 * captain ruled on 2026-10-11 that they match FireRed exactly: Bulbasaur's
 * level-1 Super Sonic and level-7 Vine Whip, Squirtle's level-7 Water Gun,
 * Pidgey with nothing but Tackle until 13, Pikachu with no Electric attack and
 * Butterfree with no Confusion are all canon's now. The early fights they
 * changed were re-measured in the PR that emptied this list.
 *
 * It stays, empty, because it is still the one place a disagreement may be
 * written: `speciesImport.test.ts` holds that this list is *exactly* the set of
 * differences between what the game fields and what the snapshot says, so a new
 * one cannot be silent. A row here is a learnset and never a stat - the type has
 * nowhere to put one (the captain's ruling of 2026-09-23).
 */
export const SHIPPED_DEVIATIONS: Readonly<Record<string, SpeciesDeviation>> = {};

/**
 * What the seventeen were taught before they took FireRed's own learnsets,
 * by move, so a save made then keeps every move its Pokemon already know. A save is wire format: a
 * Bulbasaur that learned Super Sonic, or a Pikachu that knows Tackle, learned
 * them in a game that taught them, and deleting a known move on load is the
 * quiet loss playtest 21 found with machines (`save/machineMovePersistence`).
 * Nothing is *taught* from this table - a new Pokemon, and every level-up,
 * follows canon - it only lets `knowableMoves` resolve a stored name, the way
 * `RETIRED_ITEM_IDS` lets a save's old item ids load.
 */
export const RETIRED_LEARNSETS: Readonly<Record<string, readonly string[]>> = {
  bulbasaur: ['tackle', 'supersonic', 'growl', 'vine-whip', 'synthesis', 'solar-beam'],
  ivysaur: ['tackle', 'growl', 'vine-whip', 'poison-powder', 'sleep-powder', 'razor-leaf', 'synthesis', 'solar-beam'],
  venusaur: ['tackle', 'growl', 'vine-whip', 'poison-powder', 'sleep-powder', 'razor-leaf', 'synthesis', 'solar-beam'],
  charmander: ['scratch', 'growl', 'ember', 'metal-claw', 'smokescreen'],
  charmeleon: ['scratch', 'growl', 'ember', 'metal-claw', 'smokescreen', 'scary-face', 'flamethrower', 'slash'],
  charizard: ['scratch', 'growl', 'ember', 'heat-wave', 'metal-claw', 'smokescreen', 'scary-face', 'flamethrower', 'wing-attack', 'slash'],
  squirtle: ['tackle', 'tail-whip', 'growl', 'water-gun', 'bite', 'rain-dance'],
  wartortle: ['tackle', 'tail-whip', 'bubble', 'water-gun', 'bite', 'rain-dance', 'hydro-pump'],
  blastoise: ['tackle', 'tail-whip', 'bubble', 'water-gun', 'bite', 'rain-dance', 'hydro-pump'],
  butterfree: ['tackle', 'poison-powder', 'psybeam'],
  pidgey: ['tackle', 'quick-attack', 'agility'],
  pidgeotto: ['tackle', 'gust', 'quick-attack', 'wing-attack', 'feather-dance', 'agility'],
  pidgeot: ['tackle', 'gust', 'quick-attack', 'wing-attack', 'feather-dance', 'agility'],
  pikachu: ['tackle', 'growl', 'thunder-wave', 'double-team', 'agility'],
  raichu: ['tail-whip', 'quick-attack', 'thunder-shock', 'thunderbolt'],
  jigglypuff: ['tackle', 'growl', 'sing', 'double-slap', 'body-slam', 'double-edge'],
  wigglytuff: ['sing', 'double-slap'],
};
