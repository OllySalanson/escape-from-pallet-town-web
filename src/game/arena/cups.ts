import { Move, Pokemon, type MoveBase, type PokemonBase } from '../pokemon';
import { MoveCategory, MoveFlag } from '../pokemon/MoveBase';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import { WeatherId } from '../pokemon/battle/weather';
import { EVOLUTIONS } from '../pokemon/evolution';
import { SPECIES_BY_ID } from '../pokemon/species';
import { DOJO_LEVEL, DOJO_TEAM_SIZE, dojoRefusal, flatLevelCopy } from './boutRules';
import { stagedTeam } from './classes';
import { DOJO_REGULARS } from './dojoCounter';
import { RUN_BOUTS, type CupRecord } from './runRecords';
import { isoWeekKey } from '../minigames/tickets';

export type { CupRecord } from './runRecords';

/**
 * THE BATTLE ARENA's rule of the week, the cup (the harbour arenas plan,
 * section 2.6, H3). Phaser-free, and the whole rule.
 *
 * - **One cup a week, the same for everybody**, picked from the ISO week
 *   number, so no server is asked and every player meets the same rule.
 * - **A cup is a rule the bout is fought under**: the weather over the field
 *   (RAIN, SUN), who may come (WATER, LITTLE), what they may use (TOUCH: no
 *   move that makes contact, read off FireRed's own move flags), or what the
 *   side as a whole must be (GROUND brings a Ground type, MONO shares one
 *   type). Everybody is still a flat-level copy (`boutRules.ts`), at the cup's
 *   level, and the Battle Tower's clauses still hold.
 * - **A run is seven bouts in a row** (the Battle Factory's seven) against the
 *   dojo's regulars, each bringing a team that keeps the rule, first stages for
 *   the first three bouts, then the middle of their lines, then the end of
 *   them for the seventh. A loss ends the run; a new run starts at bout one.
 * - **It pays once a week** by the best run: 50 tickets for three in a row,
 *   100 in all for five and 200 for all seven, which also puts the cup on the
 *   cup board for good. It is apart from the day's ceiling, as a step up a
 *   class is (`classes.ts`), because it can only be earned once a week.
 */

export type CupId = 'rain' | 'sun' | 'water' | 'touch' | 'ground' | 'little' | 'mono';

/** Bouts in a cup run. */
export const CUP_RUN_BOUTS = RUN_BOUTS;

/** What the week's best run pays, in all: three, five and seven in a row. */
export const CUP_TIERS: readonly { readonly wins: number; readonly tickets: number }[] = [
  { wins: 3, tickets: 50 },
  { wins: 5, tickets: 100 },
  { wins: 7, tickets: 200 },
];

export interface Cup {
  readonly id: CupId;
  readonly name: string;
  /** The rule in one short line, as the counter and the board say it. */
  readonly rule: string;
  /** What it teaches, for the board. */
  readonly teaches: string;
  readonly level: number;
  /** The weather over the field for the whole bout. */
  readonly weather?: WeatherId;
  /** Who may come at all, by kind: the reason they may not, or null. */
  readonly refuses?: (species: PokemonBase) => string | null;
  /** Which moves may be used: the rest are left off the copy. */
  readonly keeps?: (move: MoveBase) => boolean;
  /** What is wrong with a whole side, or null: asked before FIGHT. */
  readonly sideProblem?: (side: readonly PokemonBase[]) => string | null;
  /** The seven teams the regulars bring, first stages, in the order they are met. */
  readonly teams: readonly (readonly [string, string, string])[];
  /** Whether the regulars' teams stay first stages for every bout (LITTLE). */
  readonly firstStagesOnly?: boolean;
}

const typesOf = (species: PokemonBase): readonly string[] =>
  species.secondaryType ? [species.primaryType, species.secondaryType] : [species.primaryType];

/** Whether a kind is the first of its line: nothing evolves into it. */
export function isFirstStage(id: string): boolean {
  return !EVOLUTIONS.some((rule) => rule.to === id);
}

const noContact = (move: MoveBase): boolean => !move.flags.includes(MoveFlag.Contact);

export const CUPS: readonly Cup[] = [
  {
    id: 'rain',
    name: 'RAIN CUP',
    rule: 'Rain all fight.',
    teaches: 'Water hits harder and Fire is damped, as on the Coast.',
    level: DOJO_LEVEL,
    weather: WeatherId.Rain,
    teams: [
      ['psyduck', 'oddish', 'magnemite'],
      ['poliwag', 'bellsprout', 'voltorb'],
      ['horsea', 'exeggcute', 'pikachu'],
      ['tentacool', 'paras', 'goldeen'],
      ['squirtle', 'krabby', 'magnemite'],
      ['shellder', 'oddish', 'pikachu'],
      ['poliwag', 'staryu', 'voltorb'],
    ],
  },
  {
    id: 'sun',
    name: 'SUN CUP',
    rule: 'Harsh sunlight all fight.',
    teaches: 'Fire hits harder and Water is damped: the second answer to Misty.',
    level: DOJO_LEVEL,
    weather: WeatherId.HarshSunlight,
    teams: [
      ['vulpix', 'oddish', 'growlithe'],
      ['ponyta', 'bellsprout', 'sandshrew'],
      ['charmander', 'paras', 'exeggcute'],
      ['growlithe', 'bulbasaur', 'diglett'],
      ['vulpix', 'geodude', 'oddish'],
      ['ponyta', 'exeggcute', 'cubone'],
      ['charmander', 'bellsprout', 'growlithe'],
    ],
  },
  {
    id: 'water',
    name: 'WATER CUP',
    rule: 'Water types only.',
    teaches: 'Mirror matches: what beats water when everybody is water.',
    level: DOJO_LEVEL,
    refuses: (species) => (typesOf(species).includes('Water') ? null : `Only Water types this week: ${species.name.toUpperCase()} stays home.`),
    teams: [
      ['squirtle', 'psyduck', 'horsea'],
      ['poliwag', 'tentacool', 'krabby'],
      ['shellder', 'staryu', 'goldeen'],
      ['seel', 'slowpoke', 'horsea'],
      ['psyduck', 'krabby', 'tentacool'],
      ['poliwag', 'seel', 'staryu'],
      ['squirtle', 'slowpoke', 'shellder'],
    ],
  },
  {
    id: 'touch',
    name: 'TOUCH CUP',
    rule: 'No moves that make contact.',
    teaches: 'Poison Point and Effect Spore punish touching, as in the Marsh.',
    level: DOJO_LEVEL,
    keeps: noContact,
    teams: [
      ['magnemite', 'vulpix', 'psyduck'],
      ['gastly', 'voltorb', 'horsea'],
      ['pikachu', 'oddish', 'shellder'],
      ['growlithe', 'staryu', 'drowzee'],
      ['venonat', 'ekans', 'bellsprout'],
      ['ponyta', 'poliwag', 'magnemite'],
      ['koffing', 'vulpix', 'tentacool'],
    ],
  },
  {
    id: 'ground',
    name: 'GROUND CUP',
    rule: 'Every side brings a Ground type.',
    teaches: 'Ground is the answer to the Power Station.',
    level: DOJO_LEVEL,
    sideProblem: (side) => (side.some((one) => typesOf(one).includes('Ground')) ? null : 'Bring a Ground type: every side needs one this week.'),
    teams: [
      ['sandshrew', 'pidgey', 'oddish'],
      ['diglett', 'spearow', 'bellsprout'],
      ['cubone', 'pikachu', 'horsea'],
      ['geodude', 'psyduck', 'rattata'],
      ['rhyhorn', 'meowth', 'venonat'],
      ['sandshrew', 'magnemite', 'poliwag'],
      ['diglett', 'growlithe', 'krabby'],
    ],
  },
  {
    id: 'little',
    name: 'LITTLE CUP',
    rule: 'First stages only, at Lv 15.',
    teaches: 'Your catches, not your veterans.',
    level: 15,
    firstStagesOnly: true,
    refuses: (species) =>
      isFirstStage(species.id) ? null : `First stages only this week: ${species.name.toUpperCase()} has evolved.`,
    teams: [
      ['rattata', 'pidgey', 'oddish'],
      ['spearow', 'ekans', 'bellsprout'],
      ['sandshrew', 'pikachu', 'horsea'],
      ['psyduck', 'growlithe', 'diglett'],
      ['mankey', 'poliwag', 'vulpix'],
      ['meowth', 'geodude', 'machop'],
      ['nidoran-m', 'ponyta', 'shellder'],
    ],
  },
  {
    id: 'mono',
    name: 'MONO CUP',
    rule: 'All of a side share one type.',
    teaches: 'Building a team inside one type.',
    level: DOJO_LEVEL,
    sideProblem: (side) => {
      if (side.length < 2) {
        return null;
      }
      const shared = typesOf(side[0]).filter((type) => side.every((one) => typesOf(one).includes(type)));
      return shared.length > 0 ? null : 'Your side must share one type this week.';
    },
    teams: [
      ['bulbasaur', 'oddish', 'bellsprout'],
      ['charmander', 'vulpix', 'growlithe'],
      ['squirtle', 'psyduck', 'poliwag'],
      ['pidgey', 'spearow', 'doduo'],
      ['paras', 'venonat', 'scyther'],
      ['geodude', 'sandshrew', 'diglett'],
      ['ekans', 'nidoran-m', 'zubat'],
    ],
  },
];

export function cupById(id: string): Cup | undefined {
  return CUPS.find((cup) => cup.id === id);
}

/** The ISO week a date is in, as `YYYY-Www`: one key for the cup and the prize window's weekly discs. */
export { isoWeekKey };

/** A week as a whole number, so the cups turn over in order. */
function weekNumber(now: Date): number {
  const [year, week] = isoWeekKey(now).split('-W').map(Number);
  return year * 53 + week;
}

/** This week's cup: the same for everybody in the same week. */
export function cupOfTheWeek(now: Date): Cup {
  return CUPS[weekNumber(now) % CUPS.length];
}

// --- who may come ------------------------------------------------------------

/** A move that does something: a damaging one. A copy with none of these has nothing to throw. */
const hits = (move: MoveBase): boolean => move.category !== MoveCategory.Status && move.power > 0;

/** A player's Pokémon as it fights this cup: a copy at the cup's level, keeping only the moves the cup allows. */
export function cupCopy(pokemon: Pokemon, cup: Cup): Pokemon {
  return flatLevelCopy(pokemon, cup.level, cup.keeps);
}

/** Why a Pokémon may not join a side under this cup, or null: the cup's rule, then the dojo's clauses. */
export function cupRefusal(pokemon: Pokemon, side: readonly Pokemon[], cup: Cup): string | null {
  const own = cup.refuses?.(pokemon.base);
  if (own) {
    return own;
  }
  if (cup.keeps && !cupCopy(pokemon, cup).moves.some((move) => hits(move.base))) {
    return `${pokemon.name} would have no attack left that does not touch.`;
  }
  return dojoRefusal(pokemon, side);
}

/** What is wrong with a side as a whole, or null: one to three, and the cup's own rule. */
export function cupSideProblem(side: readonly Pokemon[], cup: Cup): string | null {
  if (side.length === 0) {
    return 'Bring at least one first.';
  }
  return cup.sideProblem?.(side.map((pokemon) => pokemon.base)) ?? null;
}

// --- who you meet --------------------------------------------------------------

/** The stage the regulars bring for a bout of the run (1-based): first stages, then the middle, then the end. */
export function cupStage(cup: Cup, bout: number): 1 | 2 | 3 {
  if (cup.firstStagesOnly) {
    return 1;
  }
  return bout <= 3 ? 1 : bout <= 6 ? 2 : 3;
}

/** Somebody met in a cup run: a regular, with the team the cup gives them for this bout. */
export interface CupFoe {
  readonly id: string;
  readonly name: string;
  readonly team: readonly string[];
  readonly greeting: string;
  readonly beaten: string;
}

/** The regular met at bout `bout` (1-based) of this week's run, and the team they bring. */
export function cupFoe(cup: Cup, bout: number, now: Date): CupFoe {
  const index = Math.max(0, Math.min(CUP_RUN_BOUTS, bout) - 1);
  const regular = DOJO_REGULARS[(weekNumber(now) * 7 + index) % DOJO_REGULARS.length];
  const base = cup.teams[index % cup.teams.length];
  const team = stagedTeam(base, cupStage(cup, index + 1), cup.level).filter((id) => !cup.refuses?.(SPECIES_BY_ID[id]));
  return { id: regular.bot.id, name: regular.bot.name, team, greeting: regular.greeting, beaten: regular.beaten };
}

/** A cup foe's team at the cup's level, as many as the player brings, keeping only the moves the cup allows. */
export function cupFoeParty(foe: CupFoe, cup: Cup, size: number = DOJO_TEAM_SIZE): Pokemon[] {
  return foe.team.slice(0, Math.max(1, Math.min(DOJO_TEAM_SIZE, size))).map((id) => {
    const base = SPECIES_BY_ID[id];
    if (!base) {
      throw new Error(`the cup knows no ${id}`);
    }
    const pokemon = new Pokemon(base, cup.level);
    if (cup.keeps) {
      pokemon.moves = pokemon.moves.filter((move) => cup.keeps!(move.base)).map((move) => new Move(move.base));
    }
    return pokemon;
  });
}

export function cupTrainer(foe: CupFoe, cup: Cup, size: number): TrainerBattle {
  return {
    id: `cup-${foe.id.replace(/^bot:/, '')}`,
    name: foe.name,
    party: cupFoeParty(foe, cup, size),
    defeatText: foe.beaten,
    ai: 'gym',
  };
}

// --- the run, and what it pays -------------------------------------------------------

/** The cup record for this week: the stored one if it is this week's, else a fresh week keeping the cups won. */
export function cupWeek(record: CupRecord | undefined, now: Date): CupRecord {
  const week = isoWeekKey(now);
  if (record?.week === week) {
    return record;
  }
  return { week, run: 0, best: 0, paid: 0, ...(record?.won?.length ? { won: record.won } : {}) };
}

/** What a week's best run is worth, in all. */
export function cupTickets(best: number): number {
  return CUP_TIERS.reduce((owed, tier) => (best >= tier.wins ? tier.tickets : owed), 0);
}

export interface CupSettlement {
  readonly record: CupRecord;
  /** Tickets this bout paid: the next tier reached, less what the week had already paid. */
  readonly tickets: number;
  /** Whether this bout won the cup: the seventh in a row. */
  readonly cupWon: boolean;
  /** The run this bout ended, if it was lost. */
  readonly runLost: number;
}

/** A cup bout's result, written down: the run, the week's best and pay, and the cup if it was the seventh. */
export function settleCupBout(record: CupRecord | undefined, won: boolean, now: Date): CupSettlement {
  const week = cupWeek(record, now);
  if (!won) {
    return { record: { ...week, run: 0 }, tickets: 0, cupWon: false, runLost: week.run };
  }
  const run = Math.min(CUP_RUN_BOUTS, week.run + 1);
  const best = Math.max(week.best, run);
  const tickets = Math.max(0, cupTickets(best) - week.paid);
  const cupWon = run >= CUP_RUN_BOUTS;
  const key = `${cupOfTheWeek(now).id}@${week.week}`;
  const wonList = cupWon && !(week.won ?? []).includes(key) ? [...(week.won ?? []), key] : week.won;
  return {
    record: { ...week, run: cupWon ? 0 : run, best, paid: week.paid + tickets, ...(wonList?.length ? { won: wonList.slice(-64) } : {}) },
    tickets,
    cupWon,
    runLost: 0,
  };
}

/** How many cups a record has won, all seven in a row. */
export function cupsWon(record: CupRecord | undefined): readonly string[] {
  return record?.won ?? [];
}

// --- words ---------------------------------------------------------------------

/** What the cup board says when faced: this week's cup, its rule, the run, and what it pays. */
export function cupBoardLines(record: CupRecord | undefined, now: Date): readonly string[] {
  const cup = cupOfTheWeek(now);
  const week = cupWeek(record, now);
  const won = cupsWon(week).length;
  return [
    `This week: the ${cup.name}. ${cup.rule} Everybody at Lv ${cup.level}. ${cup.teaches}`,
    `Seven bouts in a row. Best this week ${week.best} of ${CUP_RUN_BOUTS}. Three pays 50 tickets, five 100, all seven 200.`,
    ...(won > 0 ? [`Cups won: ${won}. Ask at the counter for a cup bout.`] : ['Ask at the counter for a cup bout.']),
  ];
}

/** What the receptionist says as the player comes back from a cup bout. */
export function cupSettlementLine(foe: CupFoe, won: boolean, settled: CupSettlement | null, cup: Cup): string {
  if (!settled) {
    return won ? `You beat ${foe.name}!` : `${foe.name} took that one.`;
  }
  const paid = settled.tickets > 0 ? ` ${settled.tickets} tickets.` : '';
  if (!won) {
    return settled.runLost > 0
      ? `${foe.name} took that one. Your ${cup.name} run of ${settled.runLost} is over.`
      : `${foe.name} took that one. A ${cup.name} run starts again at bout one.`;
  }
  if (settled.cupWon) {
    return `You beat ${foe.name}! Seven in a row: the ${cup.name} is yours.${paid}`;
  }
  return `You beat ${foe.name}! ${settled.record.run} of ${CUP_RUN_BOUTS} in the ${cup.name}.${paid}`;
}
