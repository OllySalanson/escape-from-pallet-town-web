import { knowableMoves, Move, Pokemon } from '../pokemon';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import { SPECIES_BY_ID } from '../pokemon/species';
import { payGame, ticketDayKey, type GameCornerRecord } from '../minigames/tickets';
import { DOJO_LEVEL } from './boutRules';
import { stagedTeam } from './classes';
import { DOJO_REGULARS } from './dojoCounter';
import { RUN_BOUTS, type RentalRecord, type RentalRun } from './runRecords';

export type { RentalRecord, RentalRun } from './runRecords';

/**
 * THE BATTLE ARENA's daily rental run (the harbour arenas plan, section 2.7,
 * H3): the Battle Factory's idea in FireRed's dress. Phaser-free, and the
 * whole rule.
 *
 * - **Six Pokémon on loan a day, the same six for everybody**: the date picks
 *   them from a list that was designed rather than rolled. Each one comes with
 *   a moveset its kind could know at the dojo's level, and every day's six hold
 *   at least one **setter and payoff pair** - a Pokémon that sets something up
 *   and one that cashes it in - so a player learns a combo for free and then
 *   goes and catches it for a raid.
 * - **Pick three and fight seven bouts in a row** against the dojo's regulars,
 *   who bring rentals too for the first four bouts and their own teams, grown
 *   up, for the last three.
 * - **After each win, one swap**: one of yours for one of the team just beaten,
 *   the Battle Factory's own rule.
 * - **The run ends at the first loss.** One scored run a day pays five
 *   tickets a win (`minigames/tickets.ts`, under the day's ceiling); runs after
 *   it are practice. A run is for its day: a run left at midnight is over.
 * - **Nothing is the player's.** A rental is built fresh for each bout; it is
 *   never in the vault and the fight writes nothing (`boutRules.ts`).
 */

/** A Pokémon on loan: its kind and the four moves it comes with, all knowable at the dojo's level. */
export interface Rental {
  readonly species: string;
  readonly moves: readonly [string, string, string, string];
  /** One short line for the counter: what it is for. */
  readonly role: string;
}

/** The list the day's six are drawn from. */
export const RENTALS: readonly Rental[] = [
  { species: 'gastly', moves: ['Hypnosis', 'Dream Eater', 'Confuse Ray', 'Lick'], role: 'Puts them to sleep, then eats their dreams.' },
  { species: 'sandshrew', moves: ['Dig', 'Slash', 'Swift', 'Sand Attack'], role: 'Digs under what is thrown at it.' },
  { species: 'tauros', moves: ['Horn Attack', 'Pursuit', 'Scary Face', 'Swagger'], role: 'Intimidate: their hard hitters hit softer.' },
  { species: 'cubone', moves: ['Bone Club', 'Bonemerang', 'Headbutt', 'Leer'], role: 'Hits hard with a bone.' },
  { species: 'pikachu', moves: ['Thunder Wave', 'Thunderbolt', 'Quick Attack', 'Slam'], role: 'Thunder Wave: whatever is slow goes last.' },
  { species: 'psyduck', moves: ['Confusion', 'Screech', 'Scratch', 'Tail Whip'], role: 'Cloud Nine: no weather while it is out.' },
  { species: 'ekans', moves: ['Glare', 'Bite', 'Poison Sting', 'Screech'], role: 'Glare paralyses, Intimidate softens.' },
  { species: 'raticate', moves: ['Hyper Fang', 'Quick Attack', 'Pursuit', 'Scary Face'], role: 'A hard bite for a slowed foe.' },
  { species: 'venomoth', moves: ['Stun Spore', 'Confusion', 'Silver Wind', 'Poison Powder'], role: 'Spores that stop a foe in its tracks.' },
  { species: 'growlithe', moves: ['Take Down', 'Bite', 'Ember', 'Leer'], role: 'Intimidate, and a big Take Down.' },
  { species: 'ponyta', moves: ['Stomp', 'Ember', 'Quick Attack', 'Tail Whip'], role: 'Quick and hot.' },
  { species: 'pidgeotto', moves: ['Wing Attack', 'Quick Attack', 'Gust', 'Sand Attack'], role: 'Flies over a Ground type.' },
  { species: 'kadabra', moves: ['Psybeam', 'Confusion', 'Recover', 'Kinesis'], role: 'Hits from range and heals itself.' },
  { species: 'magneton', moves: ['Spark', 'Thunder Wave', 'Thunder Shock', 'Super Sonic'], role: 'Paralyses and shrugs off Normal hits.' },
  { species: 'golbat', moves: ['Wing Attack', 'Bite', 'Confuse Ray', 'Leech Life'], role: 'Confuses, then bites.' },
  { species: 'poliwhirl', moves: ['Hypnosis', 'Water Gun', 'Double Slap', 'Rain Dance'], role: 'Sleep, or rain for its Water Gun.' },
];

/** A setter and the payoff it sets up, and why, in one line. */
export interface RentalPair {
  readonly setter: string;
  readonly payoff: string;
  readonly why: string;
}

/** The combos a day's six always hold one of. */
export const RENTAL_PAIRS: readonly RentalPair[] = [
  { setter: 'gastly', payoff: 'sandshrew', why: 'GASTLY puts a foe to sleep; SANDSHREW digs in while it naps.' },
  { setter: 'tauros', payoff: 'cubone', why: 'TAUROS’s Intimidate softens their hitters; CUBONE hits back hard.' },
  { setter: 'pikachu', payoff: 'raticate', why: 'PIKACHU paralyses; RATICATE bites first and hardest.' },
  { setter: 'ekans', payoff: 'growlithe', why: 'EKANS’s Glare stops them; GROWLITHE Takes Down the still target.' },
  { setter: 'venomoth', payoff: 'kadabra', why: 'VENOMOTH’s Stun Spore slows them; KADABRA picks them off.' },
  { setter: 'poliwhirl', payoff: 'psyduck', why: 'POLIWHIRL calls the rain; PSYDUCK’s Cloud Nine shuts out a foe’s.' },
  { setter: 'magneton', payoff: 'golbat', why: 'MAGNETON paralyses; GOLBAT confuses and bites.' },
];

export function rentalOf(species: string): Rental | undefined {
  return RENTALS.find((one) => one.species === species);
}

/** A day as a whole number, the same everywhere on the same calendar date. */
function dayNumber(now: Date): number {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
}

/** A small seeded shuffle, so a day always lays the same table. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = (seed * 2654435761) >>> 0 || 1;
  for (let index = out.length - 1; index > 0; index -= 1) {
    state = (state * 1103515245 + 12345) >>> 0;
    const pick = state % (index + 1);
    [out[index], out[pick]] = [out[pick], out[index]];
  }
  return out;
}

/** Today's six on the rental table, the pair first: the same six for everybody on the same day. */
export function rentalsToday(now: Date): readonly Rental[] {
  const day = dayNumber(now);
  const pair = RENTAL_PAIRS[day % RENTAL_PAIRS.length];
  const rest = shuffled(
    RENTALS.filter((one) => one.species !== pair.setter && one.species !== pair.payoff),
    day,
  ).slice(0, 4);
  return [rentalOf(pair.setter)!, rentalOf(pair.payoff)!, ...rest];
}

/** Today's pair, as the receptionist says it. */
export function pairToday(now: Date): RentalPair {
  return RENTAL_PAIRS[dayNumber(now) % RENTAL_PAIRS.length];
}

/**
 * A Pokémon of `species` as it fights a rental bout: at the dojo's level, with
 * its designed moves if it is a rental and its own kit at that level if it is
 * a regular's that was swapped in.
 */
export function rentalPokemon(species: string, level: number = DOJO_LEVEL): Pokemon {
  const base = SPECIES_BY_ID[species];
  if (!base) {
    throw new Error(`the rental table knows no ${species}`);
  }
  const pokemon = new Pokemon(base, level);
  const rental = rentalOf(species);
  if (rental) {
    const known = knowableMoves(base);
    pokemon.moves = rental.moves.flatMap((name) => {
      const move = known.get(name);
      return move ? [new Move(move)] : [];
    });
  }
  return pokemon;
}

// --- who you meet ---------------------------------------------------------------

/** Somebody met in a rental run: a regular and the team they bring to this bout. */
export interface RentalFoe {
  readonly id: string;
  readonly name: string;
  readonly team: readonly string[];
  readonly greeting: string;
  readonly beaten: string;
}

/**
 * The regular met at bout `bout` (1-based) of today's rental run: rentals for
 * the first four bouts, and then their own
 * team at the middle of its lines for bouts five and six and at the end of
 * them for the seventh.
 */
export function rentalFoe(bout: number, now: Date): RentalFoe {
  const index = Math.max(0, Math.min(RUN_BOUTS, bout) - 1);
  const day = dayNumber(now);
  const regular = DOJO_REGULARS[(day * 3 + index * 5) % DOJO_REGULARS.length];
  const team =
    index < 4
      ? shuffled(
          RENTALS.map((one) => one.species),
          day * 31 + index,
        ).slice(0, 3)
      : stagedTeam(regular.team, index < 6 ? 2 : 3);
  return { id: regular.bot.id, name: regular.bot.name, team, greeting: regular.greeting, beaten: regular.beaten };
}

export function rentalTrainer(foe: RentalFoe, size: number): TrainerBattle {
  return {
    id: `rental-${foe.id.replace(/^bot:/, '')}`,
    name: foe.name,
    party: foe.team.slice(0, Math.max(1, Math.min(3, size))).map((id) => rentalPokemon(id)),
    defeatText: foe.beaten,
    ai: 'gym',
  };
}

// --- the run ----------------------------------------------------------------------

/** The run going today, or nothing: a run from another day is over. */
export function liveRentalRun(record: RentalRecord | undefined, now: Date): RentalRun | undefined {
  return record?.run?.day === ticketDayKey(now) ? record.run : undefined;
}

/** Whether the next run started today will be the scored one. */
export function nextRunScored(record: RentalRecord | undefined, now: Date): boolean {
  return record?.scoredDay !== ticketDayKey(now);
}

/**
 * Whether `team` may fight the next bout of the run going (or start one): three
 * of today's six to start; the run's own three again, or with one swapped for
 * one of the team just beaten.
 */
export function rentalTeamProblem(team: readonly string[], run: RentalRun | undefined, now: Date): string | null {
  if (team.length !== 3 || new Set(team).size !== 3) {
    return 'Choose three, one of each kind.';
  }
  // Three of today's six is always a run: a fresh one, if it is not the one going.
  const six = rentalsToday(now).map((one) => one.species);
  if (team.every((id) => six.includes(id))) {
    return null;
  }
  if (!run) {
    return 'Only today’s six are on loan.';
  }
  const changed = team.filter((id) => !run.team.includes(id));
  if (changed.length === 0) {
    return null;
  }
  return changed.length === 1 && (run.swapFrom ?? []).includes(changed[0]) ? null : 'One swap a win, from the team you just beat.';
}

/** Whether `team` would start a fresh run rather than carry on the one going. */
export function startsNewRun(team: readonly string[], run: RentalRun | undefined): boolean {
  if (!run) {
    return true;
  }
  return team.filter((id) => !run.team.includes(id)).some((id) => !(run.swapFrom ?? []).includes(id)) || team.length !== 3;
}

export interface RentalSettlement {
  readonly record: RentalRecord;
  readonly gameCorner: GameCornerRecord;
  readonly tickets: number;
  /** The run after this bout, or nothing if it is over. */
  readonly run: RentalRun | undefined;
  /** How far the run got, if this bout ended it. */
  readonly ended: number | null;
  /** Whether this bout was the seventh win. */
  readonly complete: boolean;
  readonly scored: boolean;
}

/**
 * A rental bout's result, written down. The first bout of a run starts it (and
 * takes the day's scored run if it is still there); a win moves it on and lets
 * the beaten team be swapped from; a loss or the seventh win ends it.
 */
export function settleRentalBout(
  record: RentalRecord | undefined,
  gameCorner: GameCornerRecord,
  team: readonly string[],
  foe: RentalFoe,
  won: boolean,
  now: Date,
  /** Whether this bout starts a run of its own, as the counter said it did; by default, whether its team does. */
  startsRun?: boolean,
): RentalSettlement {
  const today = ticketDayKey(now);
  const live = liveRentalRun(record, now);
  const fresh = startsRun === true || !live || (startsRun === undefined && startsNewRun(team, live));
  const scored = fresh ? nextRunScored(record, now) : live.scored;
  const before = fresh ? 0 : live.won;
  const base: RentalRecord = {
    ...(fresh && scored ? { scoredDay: today } : record?.scoredDay ? { scoredDay: record.scoredDay } : {}),
    ...(record?.best ? { best: record.best } : {}),
  };
  if (!won) {
    return { record: base, gameCorner, tickets: 0, run: undefined, ended: before, complete: false, scored };
  }
  const reached = Math.min(RUN_BOUTS, before + 1);
  // A bout settled for a day the ticket record has already left (one that ran
  // past midnight in a tab the other one has played on since) pays nothing,
  // rather than writing that day back over the new one.
  const payable = !(gameCorner.day && gameCorner.day.day > today);
  const pay = scored && payable ? payGame(gameCorner, 'rental-run', reached, now) : null;
  const best = scored ? Math.max(record?.best ?? 0, reached) : record?.best;
  const complete = reached >= RUN_BOUTS;
  const run: RentalRun | undefined = complete
    ? undefined
    : { day: today, team: [...team], won: reached, scored, swapFrom: [...foe.team] };
  return {
    record: { ...base, ...(best ? { best } : {}), ...(run ? { run } : {}) },
    gameCorner: pay?.record ?? gameCorner,
    tickets: pay?.tickets ?? 0,
    run,
    ended: complete ? reached : null,
    complete,
    scored,
  };
}

// --- words -------------------------------------------------------------------------

const named = (id: string): string => SPECIES_BY_ID[id]?.name.toUpperCase() ?? id;

/** A team as a row says it. */
export function teamWords(team: readonly string[]): string {
  return team.map(named).join(', ');
}

/** What the receptionist says as the player comes back from a rental bout. */
export function rentalSettlementLine(foe: RentalFoe, won: boolean, settled: RentalSettlement | null): string {
  if (!settled) {
    return won ? `You beat ${foe.name}!` : `${foe.name} took that one.`;
  }
  const paid = settled.tickets > 0 ? ` ${settled.tickets} tickets.` : '';
  const practice = settled.scored ? '' : ' (practice)';
  if (!won) {
    return `${foe.name} took that one. Your rental run ended at ${settled.ended ?? 0} of ${RUN_BOUTS}${practice}.`;
  }
  if (settled.complete) {
    return `You beat ${foe.name}! Seven in a row on loan${practice}.${paid}`;
  }
  return `You beat ${foe.name}! ${settled.run?.won ?? 0} of ${RUN_BOUTS}${practice}. You may swap one for one of theirs.${paid}`;
}
