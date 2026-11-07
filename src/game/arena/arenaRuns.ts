import type { Pokemon } from '../pokemon';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import type { WeatherId } from '../pokemon/battle/weather';
import type { GameCornerRecord } from '../minigames/tickets';
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

/**
 * THE BATTLE ARENA's two runs - this week's cup (`cups.ts`) and today's rental
 * run (`rentals.ts`) - as the room and the battle screen see them: what a bout
 * of a run puts on the mat, and what it comes to once it is fought. Phaser-free.
 *
 * A run bout is a dojo bout like any other (`boutRules.ts`): the battle screen
 * is handed a `DojoRun` beside the opponent, fights it writing nothing, and
 * hands it back; the room settles it here, in one write with the tickets.
 */

/** Which run a bout is part of: the cup, or the rental run with the three on loan. */
export type DojoRun = { readonly mode: 'cup' } | { readonly mode: 'rental'; readonly team: readonly string[] };

export type DojoRunMode = DojoRun['mode'];

/** A run as it came back from the battle screen, believed only if it is one. */
export function readDojoRun(value: unknown): DojoRun | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { mode, team } = value as Record<string, unknown>;
  if (mode === 'cup') {
    return { mode };
  }
  if (mode === 'rental' && Array.isArray(team) && team.length === 3 && team.every((one) => typeof one === 'string')) {
    return { mode, team: [...team] };
  }
  return undefined;
}

/** Who the next bout of a run is against. */
export function runFoe(run: DojoRun, record: DojoRecord | undefined, now: Date): CupFoe | RentalFoe {
  if (run.mode === 'cup') {
    return cupFoe(cupOfTheWeek(now), cupWeek(record?.cup, now).run + 1, now);
  }
  const live = liveRentalRun(record?.rental, now);
  const bout = startsNewRun(run.team, live) ? 1 : live!.won + 1;
  return rentalFoe(bout, now);
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
    const cup = cupOfTheWeek(now);
    if (team.length === 0) {
      return null;
    }
    return { party: team.map((pokemon) => cupCopy(pokemon, cup)), trainer: cupTrainer(foe, cup, team.length), weather: cup.weather ?? null };
  }
  if (rentalTeamProblem(run.team, liveRentalRun(record?.rental, now), now)) {
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

/** A run bout's result, written down: the tally, the run, and the tickets, together. */
export function settleRunBout(
  record: DojoRecord | undefined,
  gameCorner: GameCornerRecord,
  run: DojoRun,
  opponent: string,
  won: boolean,
  now: Date,
): RunSettlement {
  const foe = runFoe(run, record, now);
  const tally = afterDojoBout(record, opponent, won);
  if (run.mode === 'cup') {
    const cup = cupOfTheWeek(now);
    const settled = settleCupBout(record?.cup, won, now);
    return {
      dojo: { ...tally, cup: settled.record },
      gameCorner: { ...gameCorner, tickets: gameCorner.tickets + settled.tickets },
      tickets: settled.tickets,
      line: cupSettlementLine(foe, won, settled, cup),
      carriesOn: won && !settled.cupWon,
    };
  }
  const settled = settleRentalBout(record?.rental, gameCorner, run.team, foe, won, now);
  const rest = Object.fromEntries(Object.entries(tally).filter(([key]) => key !== 'rental')) as unknown as DojoRecord;
  return {
    dojo: { ...rest, ...(Object.keys(settled.record).length > 0 ? { rental: settled.record } : {}) },
    gameCorner: settled.gameCorner,
    tickets: settled.tickets,
    line: rentalSettlementLine(foe, won, settled),
    carriesOn: settled.run !== undefined,
  };
}
