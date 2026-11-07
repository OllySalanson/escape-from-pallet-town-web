import { castDurationMs, planCast, type CastPlan } from '../world/fishing';
import { hasAbility, type PokemonTraits } from './traits';

/**
 * THE FISHING DERBY (the harbour arenas plan, section 3.7), off the head of
 * THE PLEASURE PIER: two minutes of the raid's own FireRed fishing
 * (`world/fishing.ts` - the cast, its dots and its coin) with a tally. Each
 * catch scores its level, and ten more for a kind not yet had this derby. The
 * harbour has no fights, so a bite is reeled in and let go, as the harbour's
 * own fishing does (`base/harbourFishing.ts`) - and where it is cast decides
 * what bites: the Good Rod's sea table out where it is deep, the Old Rod's
 * Magikarp along the shallows.
 *
 * What the player's lead Pokémon is decides how often anything bites, by
 * FireRed's own rule for the grass - FireRed checks no ability when it
 * fishes (`src/field_player_avatar.c`), so this borrows the one it does
 * check, and says so: **Illuminate** doubles how often wild Pokémon find you
 * and **Stench** halves it (pret `src/wild_encounter.c`). The cast's coin is
 * a half; Illuminate makes it every cast, Stench a quarter.
 *
 * Pure and Phaser-free: BaseScene plays the casts, and asks this what each
 * one is and what it scores.
 */

/** How long a derby lasts. */
export const FISHING_DERBY_MS = 120_000;
/** A kind not yet had this derby is worth this many more. */
export const NEW_KIND_BONUS = 10;

/** FireRed's coin, and what the lead does to it. */
export function biteChance(lead: PokemonTraits | null): number {
  if (lead && hasAbility(lead, 'illuminate')) return 1;
  if (lead && hasAbility(lead, 'stench')) return 0.25;
  return 0.5;
}

/** One cast in the derby: FireRed's dots, and the coin weighted by the lead. */
export function planDerbyCast(lead: PokemonTraits | null, rng: () => number = Math.random): CastPlan {
  const plan = planCast(rng);
  // `planCast` spends one roll on the dots and one on its own coin; the derby's
  // coin is its own roll after them, so the dots are FireRed's exactly.
  return { dots: plan.dots, bites: rng() < biteChance(lead) };
}

/** What a catch scores. */
export function catchScore(level: number, newKind: boolean): number {
  return level + (newKind ? NEW_KIND_BONUS : 0);
}

export interface FishingDerbyState {
  /** Ms of the derby gone. */
  readonly elapsed: number;
  readonly score: number;
  readonly catches: number;
  readonly casts: number;
  /** The kinds had this derby, by species id. */
  readonly kinds: readonly string[];
  readonly lead: PokemonTraits | null;
  readonly leadName: string;
}

export function startFishingDerby(lead: PokemonTraits | null, leadName: string): FishingDerbyState {
  return { elapsed: 0, score: 0, catches: 0, casts: 0, kinds: [], lead, leadName };
}

/** Whether the derby's two minutes are up: a cast already in the water is still answered. */
export function derbyTimeUp(state: FishingDerbyState): boolean {
  return state.elapsed >= FISHING_DERBY_MS;
}

/** A catch landed: the tally and what it scored. */
export function landCatch(state: FishingDerbyState, speciesId: string, level: number): { readonly state: FishingDerbyState; readonly scored: number; readonly newKind: boolean } {
  const newKind = !state.kinds.includes(speciesId);
  const scored = catchScore(level, newKind);
  return {
    newKind,
    scored,
    state: {
      ...state,
      score: state.score + scored,
      catches: state.catches + 1,
      kinds: newKind ? [...state.kinds, speciesId] : state.kinds,
    },
  };
}

/** The seconds left, as the tally board shows them. */
export function secondsLeft(state: FishingDerbyState): number {
  return Math.max(0, Math.ceil((FISHING_DERBY_MS - state.elapsed) / 1000));
}

/** What a lead is like for the derby, in a few words. */
export function leadNotes(lead: PokemonTraits): readonly string[] {
  if (hasAbility(lead, 'illuminate')) return ['Illuminate: twice the bites'];
  if (hasAbility(lead, 'stench')) return ['Stench: half the bites'];
  return ['Plain bites'];
}

/**
 * A whole derby fished by a model angler, for the measuring tool and the
 * tests: a cast, the time it takes, and `overheadMs` to read a catch and cast
 * again, until the two minutes are up.
 */
export function modelFishingDerby(
  lead: PokemonTraits | null,
  bite: (rng: () => number) => { readonly speciesId: string; readonly level: number },
  rng: () => number,
  overheadMs = 700,
): FishingDerbyState {
  let state = startFishingDerby(lead, '');
  while (!derbyTimeUp(state)) {
    const plan = planDerbyCast(lead, rng);
    state = { ...state, casts: state.casts + 1, elapsed: state.elapsed + castDurationMs(plan) + overheadMs };
    if (plan.bites) {
      const caught = bite(rng);
      state = landCatch(state, caught.speciesId, caught.level).state;
    }
  }
  return state;
}
