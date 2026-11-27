import type { RaidProgress, RestoredGame } from '../save/SaveManager';
import { RAID_DURATION_MS } from '../run/raidClock';
import { awayOnRaid, type RaidInFlight } from '../run/raidInFlight';
import {
  freeHealApplies,
  formatRecoveryClock,
  isFreeHealDay,
  pokemonNeedingRecovery,
  quoteRecovery,
  raidClockAfterRecovery,
  recoveryHeldBackIds,
  type RecoveryTerms,
} from './recovery';
import { recoveryPriceShare, wardTreatmentsPerRaid } from './workshop';

/**
 * Nurse Joy at her counter: what she asks, with the heal's price in the question, in the room's
 * own dialogue box, and YES or NOT NOW.
 *
 * Healing everybody used to be twelve Downs through a dark blue screen to a
 * bar at the foot of it. It is the one thing most players come in here for, and
 * FireRed does it in a sentence. The price is what it has always been, a slice
 * of the next raid's clock (`recovery.ts`), said before anything is spent.
 */

/**
 * What this save's Center charges (`recovery.ts`): the Workshop's rungs, the
 * ward's beds still free, and today's free heal, if the save has not had it
 * (`now` absent asks nothing of the day, and charges as every other heal).
 */
export function recoveryTermsFor(
  workshopUpgrades: readonly string[],
  wardTreatmentsUsed: number,
  freeHealDay?: string,
  now?: Date,
): RecoveryTerms {
  return {
    priceShare: recoveryPriceShare(workshopUpgrades),
    wardTreatments: Math.max(0, wardTreatmentsPerRaid(workshopUpgrades) - wardTreatmentsUsed),
    ...(now !== undefined && isFreeHealDay(freeHealDay, now) ? { freeToday: true } : {}),
  };
}

type CounterGame = Pick<RestoredGame, 'stash' | 'pendingRecoveryMs' | 'wardTreatmentsUsed' | 'freeHealDay'> & {
  readonly raidProgress: Pick<RaidProgress, 'workshopUpgrades'>;
  /** A raid out in another window, whose Pokemon are not hers to heal (`SaveManager.healAtCenter`). */
  readonly raidInFlight?: RaidInFlight | null;
};

export interface CenterOffer {
  /**
   * What she asks, with YES and NOT NOW under it, straight after her greeting
   * (`hub/keeperGreetings.ts`): who she would heal and what it costs, in the
   * question that spends it. FireRed's nurse asks everybody, fit or not, and so
   * does she.
   */
  readonly question: string;
  /** Whether YES heals anybody. When it does not, YES is answered with `lines`. */
  readonly heals: boolean;
  /**
   * What she says to YES: why nobody can be treated now, or, after a heal, what
   * is still true of somebody she did not treat.
   */
  readonly lines: readonly string[];
  /**
   * Whether YES takes clock off the next raid, up to 1:00 of it. A free heal opens
   * on YES as FireRed's does; one with a price opens on NOT NOW, because the key
   * that read her greeting away is still under the player's finger.
   */
  readonly spendsForGood?: boolean;
}

/** What she asks when nobody she could treat is hurt: YES is answered with why. */
export const PLAIN_HEAL_QUESTION = 'Shall I heal your Pokémon?';

/** How she says the clock the next raid would start on. */
function clockAfter(pendingMs: number): string {
  return formatRecoveryClock(raidClockAfterRecovery(RAID_DURATION_MS, pendingMs));
}

/**
 * Whether she would turn every hurt Pokémon at base away today: the next raid
 * is already as short as she will make it (`recoveryHeldBackIds`), so it is
 * "Raid first, then come and see me". The rim's card asks it, because it said
 * "Nurse Joy can help" straight after she had said she could not (the
 * first-time-friend retest, 23 Nov 2026). `free` is the explorer run's, as for
 * `centerOffer`.
 */
export function joyTurnsHurtAway(game: CounterGame, free = false, now: Date = new Date()): boolean {
  if (free) {
    return false;
  }
  const away = awayOnRaid(game);
  const ids = pokemonNeedingRecovery(game.stash)
    .filter((stored) => !away.has(stored.id))
    .map((stored) => stored.id);
  if (ids.length === 0) {
    return false;
  }
  const terms = recoveryTermsFor(game.raidProgress.workshopUpgrades, game.wardTreatmentsUsed, game.freeHealDay, now);
  return recoveryHeldBackIds(game.stash, game.pendingRecoveryMs, ids, terms).length === ids.length;
}

/**
 * What the rim's card says Nurse Joy would do for a hurt team: her price, as
 * she would quote it, or that she heals again after this raid. "Nurse Joy can
 * help" with no price was where an impatient player chose to go out hurt and
 * lost a gym fight at 6/29 (the overnight retest, 23 Nov 2026).
 */
export function joyRailLine(game: CounterGame, free = false, now: Date = new Date()): string {
  if (joyTurnsHurtAway(game, free, now)) {
    return 'Nurse Joy heals again after this raid.';
  }
  const away = awayOnRaid(game);
  const ids = pokemonNeedingRecovery(game.stash)
    .filter((stored) => !away.has(stored.id))
    .map((stored) => stored.id);
  if (ids.length === 0 || free) {
    return 'Nurse Joy can help.';
  }
  const terms = recoveryTermsFor(game.raidProgress.workshopUpgrades, game.wardTreatmentsUsed, game.freeHealDay, now);
  if (freeHealApplies(game.stash, ids, terms)) {
    return "Nurse Joy's first heal today is free.";
  }
  const quoteMs = quoteRecovery(game.stash, game.pendingRecoveryMs, ids, terms);
  return quoteMs === 0
    ? 'Nurse Joy can heal them without costing your next raid a second.'
    : `Nurse Joy can heal them for ${formatRecoveryClock(quoteMs)} of your next raid.`;
}

/**
 * What she asks whoever walks up, and what she says to YES. `free` is the
 * explorer run, whose clock nothing can shorten (`dev/playtestMode.ts`).
 *
 * Her price used to be a rule said before the question - "Healing is free.
 * Only a faint costs time off your next raid", the ward's bed, the day's free
 * heal - two to four boxes in front of it (the harbour audit, 27 Nov 2026).
 * The price is in the question now, and it is the whole of the rule: a scratch
 * says it costs nothing, a faint says what it takes, and the ward and today's
 * free heal are already in the number (`recovery.ts`).
 */
export function centerOffer(game: CounterGame, free = false, now: Date = new Date()): CenterOffer {
  const away = awayOnRaid(game);
  const everyoneHurt = pokemonNeedingRecovery(game.stash);
  const hurt = everyoneHurt.filter((stored) => !away.has(stored.id));
  const out = everyoneHurt.filter((stored) => away.has(stored.id)).map((stored) => stored.pokemon.name);
  // Out on a raid in another window, a Pokemon is that raid's: its ending
  // writes its own condition back, so a heal here would be undone or doubled.
  const outLine =
    out.length === 0
      ? []
      : [`${inWords(out)} ${out.length === 1 ? 'is' : 'are'} out on a raid in your other window, so I can’t treat ${out.length === 1 ? 'it' : 'them'} until ${out.length === 1 ? 'it’s' : 'they’re'} home.`];
  const pending = game.pendingRecoveryMs;
  if (hurt.length === 0) {
    return {
      question: PLAIN_HEAL_QUESTION,
      heals: false,
      lines: [
        ...(out.length === 0 ? ['Your Pokémon are all fit to raid.'] : outLine),
        ...(pending > 0 && !free
          ? [`Your next raid runs ${clockAfter(pending)}: ${formatRecoveryClock(pending)} went on recovery.`]
          : []),
      ],
    };
  }
  const terms = recoveryTermsFor(game.raidProgress.workshopUpgrades, game.wardTreatmentsUsed, game.freeHealDay, now);
  const ids = hurt.map((stored) => stored.id);
  // A debt already at the cap holds back whatever would cost clock
  // (`recovery.ts`): the next raid is as short as she will make it.
  const heldBack = free ? [] : recoveryHeldBackIds(game.stash, pending, ids, terms);
  const capped = `Your next raid is already down to ${clockAfter(pending)}, as short as I will make it.`;
  if (heldBack.length === hurt.length) {
    return { question: PLAIN_HEAL_QUESTION, heals: false, lines: [...outLine, capped, 'Raid first, then come and see me.'] };
  }
  const quoteMs = free ? 0 : quoteRecovery(game.stash, pending, ids, terms);
  const treated = hurt.filter((stored) => !heldBack.includes(stored.id));
  const them =
    treated.length === 1
      ? treated[0].pokemon.name
      : treated.length === hurt.length
        ? treated.length === 2 ? 'both of them' : `all ${treated.length} of them`
        : `${treated.length} of them`;
  // The heal's price, not a charge already made: 'It takes 0:45 off your next
  // raid' said before the question read as lost whatever the answer (AI
  // playtest, 22 Nov 2026). In the question, it is what YES costs.
  const price = quoteMs === 0 ? "It won't cost your next raid a second." : `It takes ${formatRecoveryClock(quoteMs)} off your next raid.`;
  return {
    question: `Shall I heal ${them}? ${price}`,
    heals: true,
    lines: [...(heldBack.length > 0 ? [`${capped} The rest must wait for a raid.`] : []), ...outLine],
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

function inWords(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
