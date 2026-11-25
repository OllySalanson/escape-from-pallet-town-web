import type { StashedPokemon } from '../stash';
import { hasHeard } from './firstWords';
import { isFirstRaid } from './firstRaid';

/**
 * A catch carried home waits at base, off the BENCH, and nothing said so. The
 * overnight critic's raid-2 card read "Pidgey stays home: pick who comes at THE
 * BENCH", and a newcomer with one Pokemon on the bench is one faint from losing
 * the raid (problems 6 and 26, 25 Nov 2026). So at the rail, once per save, the
 * first time a lone Pokemon is about to go over with a fit one at base, the
 * hall asks, with the reason first, because without it a newcomer says no (the
 * critic's second pass); the rim's card then says what the raid puts at risk.
 *
 * Asked at the rail rather than in the tunnel after raid one, because the
 * decision belongs to the next jump. Phaser-free; `BaseScene.lookDown` asks it.
 */
export interface BenchOffer {
  readonly id: string;
  readonly name: string;
}

export function benchOffer(
  progress: {
    readonly firstWordsHeard?: readonly string[];
    readonly raidRecord?: Readonly<Record<string, { readonly deployed: number }>>;
    readonly completedContracts?: readonly string[];
    readonly standingContractsBanked?: number;
  },
  party: readonly StashedPokemon[],
  atBase: readonly StashedPokemon[],
): BenchOffer | undefined {
  if (isFirstRaid(progress) || hasHeard(progress.firstWordsHeard, 'benchCatch') || party.length !== 1) {
    return undefined;
  }
  const benched = new Set(party.map(({ id }) => id));
  const waiting = atBase
    .filter(({ id, pokemon }) => !benched.has(id) && !pokemon.isFainted)
    .sort((one, other) => other.pokemon.level - one.pokemon.level)[0];
  return waiting ? { id: waiting.id, name: waiting.pokemon.name } : undefined;
}

/**
 * The question. The price is not in it, though the critic's second pass asked
 * for one: the locker fills itself with Pokemon first (`secureAutofill.ts`), so
 * a catch taken along is as often safe as at risk, and the rim's card that
 * opens straight after says which, under AT RISK and SAFE.
 */
export function benchOfferQuestion(offer: BenchOffer): string {
  return `Take ${offer.name.toUpperCase()} along too?`;
}
