import type { RaidProgress, RestoredGame } from '../save/SaveManager';
import { RAID_DURATION_MS } from '../run/raidClock';
import {
  formatRecoveryClock,
  pokemonNeedingRecovery,
  quoteRecovery,
  raidClockAfterRecovery,
  teamCondition,
  type RecoveryTerms,
} from './recovery';
import { recoveryPriceShare, wardTreatmentsPerRaid } from './workshop';

/**
 * Nurse Joy at her counter: what she says the heal would cost, in the room's
 * own dialogue box, and YES or NOT NOW.
 *
 * Healing everybody used to be twelve Downs through a dark blue screen to a
 * bar at the foot of it. It is the one thing most players come in here for, and
 * FireRed does it in a sentence. The price is what it has always been, a slice
 * of the next raid's clock (`recovery.ts`), said before anything is spent.
 */

/** What this save's Center charges (`recovery.ts`): the Workshop's rungs, and the ward's beds still free. */
export function recoveryTermsFor(workshopUpgrades: readonly string[], wardTreatmentsUsed: number): RecoveryTerms {
  return {
    priceShare: recoveryPriceShare(workshopUpgrades),
    wardTreatments: Math.max(0, wardTreatmentsPerRaid(workshopUpgrades) - wardTreatmentsUsed),
  };
}

type CounterGame = Pick<RestoredGame, 'stash' | 'pendingRecoveryMs' | 'wardTreatmentsUsed'> & {
  readonly raidProgress: Pick<RaidProgress, 'workshopUpgrades'>;
};

export interface CenterOffer {
  /** What she says first. */
  readonly lines: readonly string[];
  /** What she asks, with YES and NOT NOW under it. Absent when there is nobody to heal. */
  readonly question?: string;
  /**
   * Whether YES takes clock off the next raid, up to half of it. A free heal opens
   * on YES as FireRed's does; one with a price opens on NOT NOW, because the key
   * mashed through her lines is still under the player's finger.
   */
  readonly spendsForGood?: boolean;
}

/** How she says the clock the next raid would start on. */
function clockAfter(pendingMs: number): string {
  return formatRecoveryClock(raidClockAfterRecovery(RAID_DURATION_MS, pendingMs));
}

/**
 * What she says to whoever walks up. `free` is the explorer run, whose clock
 * nothing can shorten (`dev/playtestMode.ts`).
 */
export function centerOffer(game: CounterGame, free = false): CenterOffer {
  const hurt = pokemonNeedingRecovery(game.stash);
  const pending = game.pendingRecoveryMs;
  if (hurt.length === 0) {
    return {
      lines: [
        'Your Pokémon are all fit to raid.',
        ...(pending > 0 && !free
          ? [`Your next raid runs ${clockAfter(pending)}: ${formatRecoveryClock(pending)} went on recovery.`]
          : []),
      ],
    };
  }
  const quoteMs = free
    ? 0
    : quoteRecovery(
        game.stash,
        pending,
        hurt.map((stored) => stored.id),
        recoveryTermsFor(game.raidProgress.workshopUpgrades, game.wardTreatmentsUsed),
      );
  const them = hurt.length === 1 ? hurt[0].pokemon.name : hurt.length === 2 ? 'both of them' : `all ${hurt.length} of them`;
  const price =
    quoteMs === 0
      ? 'It will not cost your next raid a second.'
      : `It takes ${formatRecoveryClock(quoteMs)} off your next raid.`;
  return {
    lines: [`${teamCondition(game.stash) ?? 'Somebody needs me'}. ${price}`],
    question: `Shall I heal ${them}?`,
    // With nobody able to raid, the only useful answer is yes: a question opening
    // on NOT NOW sent a newcomer pressing SPACE round her counter for ever.
    spendsForGood: quoteMs > 0 && !nobodyCanRaid(game),
  };
}

/** Whether everyone at base has fainted, so that she comes first of anything said in her room. */
export function nobodyCanRaid(game: Pick<RestoredGame, 'stash'>): boolean {
  const team = game.stash.listPokemon();
  return team.length > 0 && team.every((stored) => stored.pokemon.isFainted);
}

/** What she says with the team back on its feet. */
export function healedLine(chargedMs: number, pendingMs: number, free = false): string {
  const clock =
    chargedMs > 0 && !free ? ` Your next raid runs ${clockAfter(pendingMs)}.` : '';
  return `Your Pokémon are fit to raid.${clock} We hope to see you again!`;
}

/** What she says to NOT NOW. */
export const NOT_HEALED_LINE = 'Of course. I’ll be right here.';

/** What she adds for a player a lost raid has left with one Pokémon: the swap is on the PC (`Stash.canSwapStarter`). */
export const SWAP_AT_THE_PC_LINE = 'If you would rather start again with another partner, BILL’S PC can swap your last one.';
