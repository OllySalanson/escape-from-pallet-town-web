import type { Pokemon } from '../pokemon';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import type { WeatherId } from '../pokemon/battle/weather';
import { isoWeekKey, ticketDayKey, type GameCornerRecord } from '../minigames/tickets';
import { cupCopy, cupFoe, cupOfTheWeek, cupSettlementLine, cupTrainer, cupWeek, settleCupBout, type CupFoe } from './cups';
import { afterDojoBout, type DojoRecord } from './dojoRecord';
import {
  liveRentalRun,
  rentalFoe,
  rentalPokemon,
  rentalSettlementLine,
  rentalTeamProblem,
  rentalTrainer,
  settleRentalBout,
  startsNewRun,
  type RentalFoe,
} from './rentals';
import { RUN_BOUTS } from './runRecords';

/**
 * THE BATTLE ARENA's two runs - this week's cup (`cups.ts`) and today's rental
 * run (`rentals.ts`) - as the room and the battle screen see them: what a bout
 * of a run puts on the mat, and what it comes to once it is fought. Phaser-free.
 *
 * A run bout is a dojo bout like any other (`boutRules.ts`): the battle screen
 * is handed a `DojoRun` beside the opponent, fights it writing nothing, and
 * hands it back; the room settles it here, in one write with the tickets.
 */

/**
 * When a bout of a run started and which bout of the run it is, stamped as it
 * starts (`stampRun`) and carried with it to its settlement. The page the
 * player chose from is what said "bout 1 of 7" or "bout 5 of 7", so that is
 * the bout fought and settled: START AGAIN with the same three used to fight
 * bout five, because the bout was worked out again from the stored run (the
 * arenas hunt, finding 2). And a bout belongs to the day or week it started
 * in: one settled after midnight used to be scored as bout one of the next
 * day's run, against a regular never met (finding 4). Both are optional only
 * because a bout under way written before they were stamped still settles.
 */
export interface RunStamp {
  /** Which bout of the run, 1 to 7. */
  readonly bout?: number;
  /** When the bout started, in milliseconds. */
  readonly at?: number;
}

/** Which run a bout is part of: the cup, or the rental run with the three on loan. */
export type DojoRun =
  | ({ readonly mode: 'cup' } & RunStamp)
  | ({ readonly mode: 'rental'; readonly team: readonly string[] } & RunStamp);

export type DojoRunMode = DojoRun['mode'];

/** A stamp out of something read back, keeping only what makes sense. */
function readStamp(record: Record<string, unknown>): RunStamp {
  const { bout, at } = record;
  return {
    ...(Number.isInteger(bout) && (bout as number) >= 1 && (bout as number) <= RUN_BOUTS ? { bout: bout as number } : {}),
    ...(typeof at === 'number' && Number.isFinite(at) && at > 0 ? { at } : {}),
  };
}

/** A run as it came back from the battle screen, believed only if it is one. */
export function readDojoRun(value: unknown): DojoRun | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const { mode, team } = record;
  if (mode === 'cup') {
    return { mode, ...readStamp(record) };
  }
  if (mode === 'rental' && Array.isArray(team) && team.length === 3 && team.every((one) => typeof one === 'string')) {
    return { mode, team: [...team], ...readStamp(record) };
  }
  return undefined;
}

/** The day a rental run is for, or the week a cup run is: a run left when it ends is over. */
export function runPeriod(mode: DojoRunMode, now: Date): string {
  return mode === 'cup' ? isoWeekKey(now) : ticketDayKey(now);
}

/** When a bout started: its stamp, or now for one written before bouts were stamped. */
function startOf(run: DojoRun, now: Date): Date {
  return run.at !== undefined ? new Date(run.at) : now;
}

/** Which bout of its run a bout is: its stamp, or the next one the stored run is on. */
export function runBoutNumber(run: DojoRun, record: DojoRecord | undefined, now: Date): number {
  if (run.bout !== undefined) {
    return run.bout;
  }
  const start = startOf(run, now);
  if (run.mode === 'cup') {
    return cupWeek(record?.cup, start).run + 1;
  }
  const live = liveRentalRun(record?.rental, start);
  return startsNewRun(run.team, live) ? 1 : live!.won + 1;
}

/** A run about to be fought, stamped with its bout and its start (`RunStamp`). */
export function stampRun(run: DojoRun, record: DojoRecord | undefined, now: Date): DojoRun {
  return { ...run, bout: runBoutNumber(run, record, now), at: now.getTime() };
}

/** Whether a rental bout starts a run of its own rather than carrying on the one stored. */
function freshRental(run: DojoRun & { readonly mode: 'rental' }, record: DojoRecord | undefined, start: Date): boolean {
  const live = liveRentalRun(record?.rental, start);
  return run.bout !== undefined ? run.bout === 1 || !live : startsNewRun(run.team, live);
}

/** Who a bout of a run is against. */
export function runFoe(run: DojoRun, record: DojoRecord | undefined, now: Date): CupFoe | RentalFoe {
  const start = startOf(run, now);
  const bout = runBoutNumber(run, record, now);
  return run.mode === 'cup' ? cupFoe(cupOfTheWeek(start), bout, start) : rentalFoe(bout, start);
}

/** A run bout, as the battle screen takes it. */
export interface RunBout {
  readonly party: Pokemon[];
  readonly trainer: TrainerBattle;
  readonly weather: WeatherId | null;
}

/**
 * The mat for the next bout of a run: the player's side (copies of their own
 * for a cup, fresh rentals for the rental run) and the regular's, or null if
 * the side may not fight it.
 */
export function runBout(run: DojoRun, team: readonly Pokemon[], record: DojoRecord | undefined, now: Date): RunBout | null {
  const foe = runFoe(run, record, now);
  if (run.mode === 'cup') {
    const cup = cupOfTheWeek(startOf(run, now));
    if (team.length === 0) {
      return null;
    }
    return { party: team.map((pokemon) => cupCopy(pokemon, cup)), trainer: cupTrainer(foe, cup, team.length), weather: cup.weather ?? null };
  }
  const start = startOf(run, now);
  if (rentalTeamProblem(run.team, freshRental(run, record, start) ? undefined : liveRentalRun(record?.rental, start), start)) {
    return null;
  }
  return { party: run.team.map((id) => rentalPokemon(id)), trainer: rentalTrainer(foe, run.team.length), weather: null };
}

/** What a run bout comes to: the dojo's record and the tickets after it, what is said, and whether the run goes on. */
export interface RunSettlement {
  readonly dojo: DojoRecord;
  readonly gameCorner: GameCornerRecord;
  readonly tickets: number;
  readonly line: string;
  /** Whether there is another bout of this run to fight: the counter opens on it. */
  readonly carriesOn: boolean;
}

/**
 * A run bout's result, written down: the tally, the run, and the tickets,
 * together. It is settled as the bout it started as, on the day or week it
 * started in; if that ended while it was being fought, the run ends with it.
 */
export function settleRunBout(
  record: DojoRecord | undefined,
  gameCorner: GameCornerRecord,
  run: DojoRun,
  opponent: string,
  won: boolean,
  now: Date,
): RunSettlement {
  const start = startOf(run, now);
  const over = runPeriod(run.mode, start) !== runPeriod(run.mode, now);
  const foe = runFoe(run, record, now);
  const tally = afterDojoBout(record, opponent, won);
  if (run.mode === 'cup') {
    const cup = cupOfTheWeek(start);
    const settled = settleCupBout(record?.cup, won, start);
    const goesOn = won && !settled.cupWon;
    return {
      dojo: { ...tally, cup: settled.record },
      gameCorner: { ...gameCorner, tickets: gameCorner.tickets + settled.tickets },
      tickets: settled.tickets,
      line: over && goesOn ? runOverLine(foe.name, settled.record.run, 'week', settled.tickets) : cupSettlementLine(foe, won, settled, cup),
      carriesOn: goesOn && !over,
    };
  }
  const settled = settleRentalBout(record?.rental, gameCorner, run.team, foe, won, start, freshRental(run, record, start));
  const rest = Object.fromEntries(Object.entries(tally).filter(([key]) => key !== 'rental')) as unknown as DojoRecord;
  return {
    dojo: { ...rest, ...(Object.keys(settled.record).length > 0 ? { rental: settled.record } : {}) },
    gameCorner: settled.gameCorner,
    tickets: settled.tickets,
    line: over && settled.run ? runOverLine(foe.name, settled.run.won, 'day', settled.tickets) : rentalSettlementLine(foe, won, settled),
    carriesOn: settled.run !== undefined && !over,
  };
}

/** A win in a run whose day or week ended while it was being fought: it counts, and the run is over. */
function runOverLine(foe: string, won: number, period: 'day' | 'week', tickets: number): string {
  const paid = tickets > 0 ? ` ${tickets} tickets.` : '';
  return `You beat ${foe}! ${won} of ${RUN_BOUTS}, but the ${period} ended during the bout, so the run ends there.${paid}`;
}
