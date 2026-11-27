import { getItemById } from '../items/items';
import type { FieldMoveId } from '../world/fieldMoves';
import { pickerEntries, pickerOrder, type PickerEntry, type PickerVault } from '../ui/boxPicker';
import { headsOf } from './berryPicking';
import { BERRY_PICKING_PRIZE_SCORE } from './generated/berryPicking';
import { POKEMON_JUMP_PRIZES } from './generated/pokemonJump';
import { courseMovesOf, COURSE_TEAM_SIZE } from './fieldCourse';
import { courseTime } from './gameCornerTalk';
import { HOUSE_JUMPER, HOUSE_PICKER, type HouseLoan } from './houseLoans';
import { jumpTypeOf, MAX_JUMPERS, type JumpType } from './pokemonJump';
import { traitsOf, type PokemonTraits } from './traits';
import {
  BERRY_TICKET_TIERS,
  COURSE_TICKET_TIERS,
  DIG_TICKET_TIERS,
  derbyTiers,
  FISHING_DERBY_TICKET_TIERS,
  JUMP_TICKET_TIERS,
  type GamePayout,
} from './tickets';

/**
 * Every harbour game's start screen is an attract screen, as an arcade
 * cabinet's is between coins: the game playing itself on its own canvas (the
 * house's hand, `demoPlay.ts`), the game's name, and PRESS SPACE. SPACE plays
 * at once, with whoever the demo shows; LEFT and RIGHT (or TAB) swap them for
 * the next Pokémon that can play, and the demo carries on with that one. There
 * is no list and no rule written anywhere before play: the demo is the rules,
 * and a Pokémon that cannot play is never offered. What a score pays is said
 * once, on the result, as its pay table (`payTable`).
 *
 * This module is the part of that which is decided rather than drawn: who
 * plays by default, who is offered after them and in what order, what each
 * key on the screen does, and what the result card says. Pure and
 * Phaser-free, so the tests hold every game to one press from its screen to
 * play, with a player, on any save (`attract.test.ts`).
 */

/** A Pokémon as an attract screen shows it and a game plays it: one of the player's own, or the house's. */
export interface AttractPlayer {
  /** The stash id, or the loan's own `house:` id. */
  readonly id: string;
  readonly species: string;
  readonly dexId: number;
  /** What it is called, in capitals, as the screen writes it. */
  readonly name: string;
  readonly level: number;
  readonly shiny: boolean;
  /** Lent by the house for the game (`houseLoans.ts`): played and paid as one's own, and never stored. */
  readonly lent: boolean;
  /** The moves it knows, by name, which some games read (DIG for THE DIG). */
  readonly moves: readonly string[];
}

/** The games a harbour board, spot or cabinet opens onto an attract screen. */
export type AttractGameId = 'pokemon-jump' | 'berry-picking' | 'field-course' | 'derby' | 'dig' | 'fishing-derby';

function ownPlayer(entry: PickerEntry): AttractPlayer {
  return {
    id: entry.id,
    species: entry.pokemon.base.id,
    dexId: entry.pokemon.base.dexId,
    name: entry.pokemon.name.toUpperCase(),
    level: entry.pokemon.level,
    shiny: entry.pokemon.shiny,
    lent: false,
    moves: entry.pokemon.moves.map((move) => move.base.name),
  };
}

function lentPlayer(loan: HouseLoan): AttractPlayer {
  return { id: loan.id, species: loan.species, dexId: loan.dexId, name: loan.name.toUpperCase(), level: loan.level, shiny: false, lent: true, moves: [] };
}

/** The traits a game reads off a player, or undefined for a kind outside the 151. */
export function playerTraits(player: AttractPlayer): PokemonTraits | undefined {
  return traitsOf(player.species, player.moves);
}

/** The vault the screens read: every Pokémon kept, and which one is the partner. */
export interface AttractVault extends PickerVault {
  partnerId(): string | null;
}

/**
 * Who a game offers, the one it plays by default first: the partner if it can
 * play; failing that the house's loan, for a game that has one; failing that
 * the best of the player's own. Then the rest of the player's own who can
 * play, best fits first (`ui/boxPicker.ts`), and the loan last. A Pokémon
 * that cannot play is not on the list at all.
 */
export function rosterOf(vault: AttractVault, fit: (entry: PickerEntry) => number, loan?: HouseLoan): readonly AttractPlayer[] {
  const own = pickerOrder(pickerEntries(vault), fit)
    .filter((entry) => fit(entry) > 0)
    .map(ownPlayer);
  const lent = loan ? [lentPlayer(loan)] : [];
  const partner = own.find((player) => player.id === vault.partnerId());
  const first = partner ?? lent[0] ?? own[0];
  if (!first) return [];
  return [first, ...own.filter((player) => player !== first), ...lent.filter((player) => player !== first)];
}

const JUMP_FIT: Readonly<Record<JumpType, number>> = { fast: 3, normal: 2, slow: 1 };

/** POKéMON JUMP's: whoever is on FireRed's list, the fast jumpers first; the house lends a PIKACHU. */
export function jumpRoster(vault: AttractVault): readonly AttractPlayer[] {
  return rosterOf(
    vault,
    (entry) => {
      const type = jumpTypeOf(entry.pokemon.base.id);
      return type ? JUMP_FIT[type] : 0;
    },
    HOUSE_JUMPER,
  );
}

/** BERRY PICKING's: a DODRIO, or a DODUO at a push; the house lends a DODUO. */
export function berryRoster(vault: AttractVault): readonly AttractPlayer[] {
  return rosterOf(vault, (entry) => headsOf(entry.pokemon.base.id) ?? 0, HOUSE_PICKER);
}

/** THE FIELD-MOVE COURSE's: anybody goes round, the most field moves first. */
export function courseRoster(vault: AttractVault): readonly AttractPlayer[] {
  return rosterOf(vault, (entry) => 1 + courseMovesOf(entry.pokemon.base.id).length);
}

/** An outdoor game's: anybody the game can read, by the game's own fit. */
export function outdoorRoster(vault: AttractVault, fit: (traits: PokemonTraits) => number): readonly AttractPlayer[] {
  return rosterOf(vault, (entry) => {
    const traits = traitsOf(
      entry.pokemon.base.id,
      entry.pokemon.moves.map((move) => move.base.name),
    );
    // Every Pokémon the game can read plays; the fit only orders them.
    return traits ? 1 + Math.max(0, fit(traits)) : 0;
  });
}

// --- who plays with the one chosen --------------------------------------------------

/** Who is on the screen: the one chosen (`lead`, an index into the roster) and, for a team game, how many go. */
export interface Lineup {
  readonly lead: number;
  readonly size: number;
}

/**
 * POKéMON JUMP's team round its lead: the lead, then whoever jumps as it does
 * (a team of one kind lands together and leaves together, and that is where
 * the EXCELLENTs are), then the fastest of the rest, up to `size`.
 */
export function jumpTeam(roster: readonly AttractPlayer[], lineup: Lineup): readonly AttractPlayer[] {
  const lead = roster[lineup.lead];
  if (!lead) return [];
  const type = jumpTypeOf(lead.species);
  const rest = roster
    .filter((player) => player !== lead)
    .map((player, order) => ({ player, order, same: jumpTypeOf(player.species) === type ? 1 : 0, fit: JUMP_FIT[jumpTypeOf(player.species) ?? 'slow'] }))
    .sort((a, b) => b.same - a.same || b.fit - a.fit || a.order - b.order)
    .map(({ player }) => player);
  return [lead, ...rest].slice(0, Math.max(1, Math.min(MAX_JUMPERS, lineup.size)));
}

/** How many jump with a lead by default: all who jump as it does, up to three. */
export function jumpTeamSize(roster: readonly AttractPlayer[], lead: number): number {
  const type = roster[lead] ? jumpTypeOf(roster[lead].species) : undefined;
  return Math.max(1, Math.min(MAX_JUMPERS, roster.filter((player) => jumpTypeOf(player.species) === type).length));
}

/**
 * THE FIELD-MOVE COURSE's team round its lead, as the keeper picks it: the
 * lead, then whoever adds the most field moves the team has not got, until
 * three go round or nobody adds anything.
 */
export function courseTeam(roster: readonly AttractPlayer[], lineup: Lineup): readonly AttractPlayer[] {
  const lead = roster[lineup.lead];
  if (!lead) return [];
  const team = [lead];
  const covered = new Set<FieldMoveId>(courseMovesOf(lead.species));
  while (team.length < COURSE_TEAM_SIZE) {
    let pick: { player: AttractPlayer; adds: number } | null = null;
    for (const player of roster) {
      if (team.includes(player)) continue;
      const adds = courseMovesOf(player.species).filter((move) => !covered.has(move)).length;
      if (adds > 0 && (!pick || adds > pick.adds)) pick = { player, adds };
    }
    if (!pick) break;
    team.push(pick.player);
    for (const move of courseMovesOf(pick.player.species)) covered.add(move);
  }
  return team;
}

/** Who plays for a game, its lineup and its roster given: a team for a team game, the one chosen for the rest. */
export function playersFor(game: AttractGameId, roster: readonly AttractPlayer[], lineup: Lineup): readonly AttractPlayer[] {
  if (game === 'pokemon-jump') return jumpTeam(roster, lineup);
  if (game === 'field-course') return courseTeam(roster, lineup);
  const one = roster[lineup.lead];
  return one ? [one] : [];
}

/** The lineup a screen opens on: the roster's first, and the size the game would pick for it. */
export function openingLineup(game: AttractGameId, roster: readonly AttractPlayer[]): Lineup {
  return { lead: 0, size: game === 'pokemon-jump' ? jumpTeamSize(roster, 0) : 1 };
}

// --- the keys -----------------------------------------------------------------------

/** What a key does on an attract screen. */
export type AttractCommand = 'play' | 'next' | 'previous' | 'more' | 'fewer' | 'leave';

/**
 * SPACE (or ENTER) plays; RIGHT and TAB bring on the next Pokémon, LEFT and
 * SHIFT+TAB the one before; UP and DOWN put one more or one fewer in a team;
 * ESC or BACKSPACE goes back to the harbour. W, A, S and D are the arrows, in
 * either case, as on every screen.
 */
export function attractCommand(event: { readonly key: string; readonly shiftKey?: boolean; readonly ctrlKey?: boolean; readonly metaKey?: boolean; readonly altKey?: boolean }): AttractCommand | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key === ' ' || key === 'Enter') return 'play';
  if (key === 'Tab') return event.shiftKey ? 'previous' : 'next';
  if (key === 'ArrowRight' || key === 'd') return 'next';
  if (key === 'ArrowLeft' || key === 'a') return 'previous';
  if (key === 'ArrowUp' || key === 'w') return 'more';
  if (key === 'ArrowDown' || key === 's') return 'fewer';
  if (key === 'Escape' || key === 'Backspace') return 'leave';
  return null;
}

/** What came of a key on an attract screen. */
export type AttractOutcome =
  | { readonly kind: 'play'; readonly players: readonly AttractPlayer[] }
  | { readonly kind: 'lineup'; readonly lineup: Lineup }
  | { readonly kind: 'leave' }
  | { readonly kind: 'nothing' };

/**
 * A key pressed on a game's attract screen. PLAY is the game with whoever is
 * on the screen; a swap is the next one who can play, round and round; a team
 * size goes between one and as many as the team can hold.
 */
export function pressOnAttract(game: AttractGameId, roster: readonly AttractPlayer[], lineup: Lineup, command: AttractCommand | null): AttractOutcome {
  switch (command) {
    case 'play': {
      const players = playersFor(game, roster, lineup);
      return players.length > 0 ? { kind: 'play', players } : { kind: 'nothing' };
    }
    case 'next':
    case 'previous': {
      if (roster.length < 2) return { kind: 'nothing' };
      const lead = (lineup.lead + (command === 'next' ? 1 : -1) + roster.length) % roster.length;
      return { kind: 'lineup', lineup: { lead, size: game === 'pokemon-jump' ? jumpTeamSize(roster, lead) : 1 } };
    }
    case 'more':
    case 'fewer': {
      if (game !== 'pokemon-jump') return { kind: 'nothing' };
      const most = Math.min(MAX_JUMPERS, roster.length);
      const size = Math.max(1, Math.min(most, lineup.size + (command === 'more' ? 1 : -1)));
      return size === lineup.size ? { kind: 'nothing' } : { kind: 'lineup', lineup: { ...lineup, size } };
    }
    case 'leave':
      return { kind: 'leave' };
    default:
      return { kind: 'nothing' };
  }
}

// --- the result ---------------------------------------------------------------------

/** A row of a pay table: what it asks, what it pays, and whether this game reached it. */
export interface PayRow {
  readonly asks: string;
  readonly pays: string;
  readonly reached: boolean;
}

/** What the result card shows: the result, what it won, and the game's pay table, once. */
export interface ResultCard {
  /** The result as the game counts it: `SCORE 1,240`, `0:16.42`, `2ND`. */
  readonly headline: string;
  /** What it won, a line each: `+20 TICKETS`, `ORAN BERRY`. */
  readonly won: readonly string[];
  readonly newBest: boolean;
  readonly table: readonly PayRow[];
}

const number = (value: number): string => value.toLocaleString('en-GB');

/**
 * What a payout and the things it sent home come to, a line each - or, for a
 * game that won nothing, why: a result short of every row of the pay table
 * under it, or a day whose tickets that row has paid already.
 */
export function wonLines(payout: Pick<GamePayout, 'tickets' | 'firstTier'>, items: readonly string[]): readonly string[] {
  const lines = payout.tickets > 0 ? [`+${payout.tickets} TICKETS`] : [];
  for (const itemId of new Set(items)) {
    const count = items.filter((other) => other === itemId).length;
    const name = (getItemById(itemId)?.displayName ?? itemId).toUpperCase();
    lines.push(count > 1 ? `${count} ${name}` : name);
  }
  if (lines.length > 0) return lines;
  return [payout.firstTier === null ? 'NOTHING MORE TODAY' : 'NO TICKETS'];
}

const PLACE_ROWS: Readonly<Record<number, string>> = { 4: '3RD', 5: '2ND', 6: '1ST' };

/**
 * A game's pay table for its result card: each tier's ask and its tickets,
 * and the line past which a berry comes too where the game pays one, with
 * every row the result reached marked.
 */
export function payTable(game: AttractGameId, result: number, level = 1): readonly PayRow[] {
  switch (game) {
    case 'pokemon-jump':
      return [
        ...JUMP_TICKET_TIERS.map((tier) => ({ asks: number(tier.score), pays: `${tier.tickets} TICKETS`, reached: result >= tier.score })),
        { asks: number(POKEMON_JUMP_PRIZES[0].score), pays: 'A BERRY', reached: result >= POKEMON_JUMP_PRIZES[0].score },
      ];
    case 'berry-picking':
      return [
        ...BERRY_TICKET_TIERS.map((tier) => ({ asks: number(tier.score), pays: `${tier.tickets} TICKETS`, reached: result >= tier.score })),
        { asks: number(BERRY_PICKING_PRIZE_SCORE), pays: 'A BERRY', reached: result >= BERRY_PICKING_PRIZE_SCORE },
      ];
    case 'field-course':
      return COURSE_TICKET_TIERS.map((tier) => ({ asks: courseTime(tier.ms), pays: `${tier.tickets} TICKETS`, reached: result > 0 && result <= tier.ms }));
    case 'derby':
      return derbyTiers(level).map((tier) => ({ asks: PLACE_ROWS[tier.score] ?? String(tier.score), pays: `${tier.tickets} TICKETS`, reached: result >= tier.score }));
    case 'dig':
      return DIG_TICKET_TIERS.map((tier) => ({ asks: `${tier.score} PTS`, pays: `${tier.tickets} TICKETS`, reached: result >= tier.score }));
    case 'fishing-derby':
      return FISHING_DERBY_TICKET_TIERS.map((tier) => ({ asks: `${tier.score} PTS`, pays: `${tier.tickets} TICKETS`, reached: result >= tier.score }));
  }
}
