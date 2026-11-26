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
  teamCondition,
  wardBedIdsFor,
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

/**
 * Her plain word on what healing costs, said with a price (AI playtest 5, 22 Nov
 * 2026). Never with today's free heal: its own line already says it is free, and
 * the rule said beside it, and again after, was the same thing three times in
 * one visit (the first-time-friend retest, 22 Nov 2026). So it is only ever said
 * once today's free heal is used, and right after "Healing would take 0:35":
 * opening on "Healing is free." and closing on "the first each day is free" read
 * as her taking the price back (night raid critic, 26 Nov 2026).
 */
// In her words, not the rule's: "at most 1:00 of a raid" was the designer's
// cap read aloud, and "today's free one is used" never said free what (the
// harbour critic tour, 26 Nov 2026). The cap still holds (`recovery.ts`).
export const HEAL_RULE_LINE = "Only a faint costs. Your free heal today's been used; you get another tomorrow.";

type CounterGame = Pick<RestoredGame, 'stash' | 'pendingRecoveryMs' | 'wardTreatmentsUsed' | 'freeHealDay'> & {
  readonly raidProgress: Pick<RaidProgress, 'workshopUpgrades'>;
  /** A raid out in another window, whose Pokemon are not hers to heal (`SaveManager.healAtCenter`). */
  readonly raidInFlight?: RaidInFlight | null;
};

export interface CenterOffer {
  /** What she says first. */
  readonly lines: readonly string[];
  /** What she asks, with YES and NOT NOW under it. Absent when there is nobody to heal. */
  readonly question?: string;
  /**
   * Whether YES takes clock off the next raid, up to 1:00 of it. A free heal opens
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
 * What she says to whoever walks up. `free` is the explorer run, whose clock
 * nothing can shorten (`dev/playtestMode.ts`).
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
  const raidFirst = 'Raid first, then come and see me.';
  if (heldBack.length === hurt.length) {
    return { lines: [...outLine, `${teamCondition(game.stash, away) ?? 'Somebody needs me'}. ${capped}`, raidFirst] };
  }
  const quoteMs = free ? 0 : quoteRecovery(game.stash, pending, ids, terms);
  // Spent only on a faint: mending a scratch is free on any day.
  const freeToday = freeHealApplies(game.stash, ids, terms);
  const treated = hurt.filter((stored) => !heldBack.includes(stored.id));
  const them =
    treated.length === 1
      ? treated[0].pokemon.name
      : treated.length === hurt.length
        ? treated.length === 2 ? 'both of them' : `all ${treated.length} of them`
        : `${treated.length} of them`;
  const price =
    freeToday && !free
      ? "Your first heal today is free: it won't cost your next raid a second."
      : quoteMs === 0
      ? "Healing won't cost your next raid a second."
      : // The heal's price, not a charge already made: 'It takes 0:45 off your
        // next raid' before the question read as lost whatever the answer
        // (AI playtest, 22 Nov 2026).
        `Healing would take ${formatRecoveryClock(quoteMs)} off your next raid.`;
  return {
    lines: [
      ...outLine,
      `${teamCondition(game.stash, away) ?? 'Somebody needs me'}. ${price}`,
      ...(heldBack.length > 0 ? [`${capped} The rest must wait for a raid.`] : []),
      ...(free || freeToday ? [] : wardLines(game, pending, ids, terms)),
      ...(free || freeToday || quoteMs === 0 ? [] : [HEAL_RULE_LINE]),
    ],
    question: `Shall I heal ${them}?`,
    // With nobody able to raid, the only useful answer is yes: a question opening
    // on NOT NOW sent a newcomer pressing SPACE round her counter for ever.
    spendsForGood: quoteMs > 0 && !nobodyCanRaid(game),
  };
}

/**
 * What she says about THE WARD, once it is built: who its bed takes, and what a
 * bed never waives, or that the bed is used until the next raid. It was counted
 * in her price and never said, so a player who had built it could not tell
 * whether it had been used, and read a fainted team's charge as the ward doing
 * nothing (AI playtest, 20 Nov 2026).
 */
function wardLines(game: CounterGame, pending: number, ids: readonly string[], terms: RecoveryTerms): readonly string[] {
  if (wardTreatmentsPerRaid(game.raidProgress.workshopUpgrades) === 0) {
    return [];
  }
  if (terms.wardTreatments === 0) {
    return [`THE WARD’s ${wardTreatmentsPerRaid(game.raidProgress.workshopUpgrades) === 1 ? 'bed is' : 'beds are'} used until your next raid.`];
  }
  const bedded = wardBedIdsFor(game.stash, pending, ids, terms).flatMap((id) => {
    const stored = game.stash.listPokemon().find((each) => each.id === id);
    return stored ? [stored.pokemon] : [];
  });
  if (bedded.length === 0) {
    return [];
  }
  return [
    `THE WARD takes ${inWords(bedded.map((pokemon) => pokemon.name))}, so bringing ${bedded.length === 1 ? 'it' : 'them'} round is free.`,
  ];
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

function inWords(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
