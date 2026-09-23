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
 * Every place the shipped game and generation III canon disagree, in one list.
 *
 * The import brought in all 151 from the snapshots, so the seventeen species
 * that were already here stopped being hand-written data and became canon plus
 * these rows. Each is a decision this game made, and each one is here to be
 * argued with rather than found later in a diff. `speciesImport.test.ts` holds
 * that this list is *exactly* the set of differences between what the game
 * fields and what the snapshot says, so a new disagreement cannot be silent.
 *
 * **The learnsets.** All seventeen keep the ones they shipped with, because
 * every one of them is early-game content that has been measured - the starter
 * kits are pinned tile by tile in `starterIdentity.test.ts`, the wild tables
 * are held to floors in `districtEncounters.test.ts` and the hunter's own three
 * are measured over the real engine in `hunterThreat.test.ts`. AGENTS.md is
 * explicit that a learnset change to the early game is measured rather than
 * assumed, so adopting canon for these is its own change with its own
 * measurements; what canon teaches each of them is in
 * `generated/speciesCatalogue.ts` beside this, so the two can be read against
 * each other rather than reconstructed. Three of them are worth naming:
 *
 * - **Bulbasaur learns Vine Whip at 7**, not canon's 10, and canon's level-7
 *   slot is Leech Seed, which this engine cannot express. Every starter having
 *   a move of its own type at 7 is the thing that makes the choice loud, and it
 *   is the rule `starterIdentity.test.ts` exists to hold.
 * - **Bulbasaur's Super Sonic at level 1** came across from Unity and is the
 *   only non-damaging line any starter had until Squirtle was given Tail Whip;
 *   canon has neither.
 * - **Squirtle's Water Gun at 7** is canon's 13. Canon's 7 is Bubble, which is
 *   a Water move and would satisfy the rule, but the line's whole ladder was
 *   authored around Water Gun before the import.
 *
 * **No stats.** Three used to be here - Butterfree's Sp. Atk of 90 and
 * Pikachu's Defence and Sp. Def of 40/50, all generation VI's values, and
 * Jigglypuff's Sp. Def of 20, canon's 25 mistyped somewhere in Unity. They were
 * kept so as not to reprice the starting maps and the hunter ladder; the
 * captain ruled on 2026-09-23 that every stat is canon's, and the repricing was
 * measured when they went (see the PR that removed them).
 */
export const SHIPPED_DEVIATIONS: Readonly<Record<string, SpeciesDeviation>> = {
  bulbasaur: {
    learnset: [{ level: 1, move: 'tackle' }, { level: 1, move: 'supersonic' }, { level: 4, move: 'growl' }, { level: 7, move: 'vine-whip' }, { level: 39, move: 'synthesis' }, { level: 46, move: 'solar-beam' }],
  },
  ivysaur: {
    learnset: [{ level: 1, move: 'tackle' }, { level: 1, move: 'growl' }, { level: 10, move: 'vine-whip' }, { level: 15, move: 'poison-powder' }, { level: 15, move: 'sleep-powder' }, { level: 22, move: 'razor-leaf' }, { level: 47, move: 'synthesis' }, { level: 56, move: 'solar-beam' }],
  },
  venusaur: {
    learnset: [{ level: 1, move: 'tackle' }, { level: 1, move: 'growl' }, { level: 1, move: 'vine-whip' }, { level: 15, move: 'poison-powder' }, { level: 15, move: 'sleep-powder' }, { level: 22, move: 'razor-leaf' }, { level: 53, move: 'synthesis' }, { level: 65, move: 'solar-beam' }],
  },
  charmander: {
    learnset: [{ level: 1, move: 'scratch' }, { level: 4, move: 'growl' }, { level: 7, move: 'ember' }, { level: 13, move: 'metal-claw' }, { level: 19, move: 'smokescreen' }],
  },
  charmeleon: {
    learnset: [{ level: 1, move: 'scratch' }, { level: 1, move: 'growl' }, { level: 1, move: 'ember' }, { level: 13, move: 'metal-claw' }, { level: 20, move: 'smokescreen' }, { level: 27, move: 'scary-face' }, { level: 34, move: 'flamethrower' }, { level: 41, move: 'slash' }],
  },
  charizard: {
    learnset: [{ level: 1, move: 'scratch' }, { level: 1, move: 'growl' }, { level: 1, move: 'ember' }, { level: 1, move: 'heat-wave' }, { level: 13, move: 'metal-claw' }, { level: 20, move: 'smokescreen' }, { level: 27, move: 'scary-face' }, { level: 34, move: 'flamethrower' }, { level: 36, move: 'wing-attack' }, { level: 44, move: 'slash' }],
  },
  squirtle: {
    learnset: [{ level: 1, move: 'tackle' }, { level: 1, move: 'tail-whip' }, { level: 4, move: 'growl' }, { level: 7, move: 'water-gun' }, { level: 18, move: 'bite' }, { level: 33, move: 'rain-dance' }],
  },
  wartortle: {
    learnset: [{ level: 1, move: 'tackle' }, { level: 1, move: 'tail-whip' }, { level: 1, move: 'bubble' }, { level: 13, move: 'water-gun' }, { level: 19, move: 'bite' }, { level: 37, move: 'rain-dance' }, { level: 53, move: 'hydro-pump' }],
  },
  blastoise: {
    learnset: [{ level: 1, move: 'tackle' }, { level: 1, move: 'tail-whip' }, { level: 1, move: 'bubble' }, { level: 13, move: 'water-gun' }, { level: 19, move: 'bite' }, { level: 42, move: 'rain-dance' }, { level: 68, move: 'hydro-pump' }],
  },
  butterfree: {
    learnset: [{ level: 1, move: 'tackle' }, { level: 10, move: 'poison-powder' }, { level: 34, move: 'psybeam' }],
  },
  pidgey: {
    learnset: [{ level: 1, move: 'tackle' }, { level: 13, move: 'quick-attack' }, { level: 39, move: 'agility' }],
  },
  pidgeotto: {
    learnset: [{ level: 1, move: 'tackle' }, { level: 1, move: 'gust' }, { level: 13, move: 'quick-attack' }, { level: 27, move: 'wing-attack' }, { level: 34, move: 'feather-dance' }, { level: 43, move: 'agility' }],
  },
  pidgeot: {
    learnset: [{ level: 1, move: 'tackle' }, { level: 1, move: 'gust' }, { level: 13, move: 'quick-attack' }, { level: 27, move: 'wing-attack' }, { level: 34, move: 'feather-dance' }, { level: 48, move: 'agility' }],
  },
  pikachu: {
    learnset: [{ level: 1, move: 'tackle' }, { level: 1, move: 'growl' }, { level: 10, move: 'thunder-wave' }, { level: 15, move: 'double-team' }, { level: 33, move: 'agility' }],
  },
  raichu: {
    learnset: [{ level: 1, move: 'tail-whip' }, { level: 1, move: 'quick-attack' }, { level: 1, move: 'thunder-shock' }, { level: 1, move: 'thunderbolt' }],
  },
  jigglypuff: {
    learnset: [{ level: 1, move: 'tackle' }, { level: 1, move: 'growl' }, { level: 10, move: 'sing' }, { level: 24, move: 'double-slap' }, { level: 34, move: 'body-slam' }, { level: 49, move: 'double-edge' }],
  },
  wigglytuff: {
    learnset: [{ level: 1, move: 'sing' }, { level: 1, move: 'double-slap' }],
  },
};
