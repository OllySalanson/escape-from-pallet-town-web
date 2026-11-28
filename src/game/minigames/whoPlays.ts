import type { StashedPokemon } from '../stash';
import { pickerEntries, pickerOrder, type PickerEntry } from '../ui/boxPicker';
import { headsOf } from './berryPicking';
import { COURSE_TEAM_SIZE, courseMovesOf } from './fieldCourse';
import { HOUSE_JUMPER, HOUSE_PICKER, type HouseLoan } from './houseLoans';
import { jumpTypeOf, MAX_JUMPERS } from './pokemonJump';
import type { FieldMoveId } from '../world/fieldMoves';

/**
 * Who plays a harbour minigame, worked out before anything is drawn - because
 * SPACE at a cabinet, a board or the dig spot starts the game at once (the
 * harbour audit, 27 Nov 2026, fault 3: a form stood between the press and the
 * game). Each game is handed its lineups, best first: the first is who plays
 * unless the player chooses another on the game's own list of who plays,
 * opened with P from its ready beat (`readyBeat.ts`).
 *
 * - **The partner leads.** The Pokémon the player chose on Oak's table plays
 *   if it can; a team (POKéMON JUMP, THE FIELD-MOVE COURSE) is the partner
 *   and whoever else helps most.
 * - **A Pokémon that cannot play is never offered.** There is no list of who
 *   cannot jump: they are simply not among the lineups.
 * - **The house lends when nobody can** (`houseLoans.ts`): a PIKACHU to jump
 *   and a DODUO to pick, last on the list, and first only when there is
 *   nobody of the player's own.
 *
 * Phaser-free, so every save's first lineup is held by `whoPlays.test.ts`.
 */

/** One who plays, as the ready beat's plate draws it. */
export interface Player {
  /** A stored Pokémon's id, or a loan's (`house:pikachu`). */
  readonly id: string;
  readonly species: string;
  readonly dexId: number;
  readonly shiny: boolean;
  /** Its name as the plate prints it. */
  readonly name: string;
  readonly level: number;
  /** Lent by the house, not the player's own. */
  readonly lent: boolean;
  /** Whether the game suits it especially: a star on the plate. */
  readonly suits: boolean;
}

/** Who plays one game: one Pokémon, or a team for the games that take one. */
export type Lineup = readonly Player[];

/** What the lineups are read from: the vault, and which Pokémon is the partner. */
export interface PlayerVault {
  listPokemon(): readonly StashedPokemon[];
  partnerId(): string | null;
}

/** One of the player's own, as the plate draws it. */
export function playerOf(entry: Pick<PickerEntry, 'id' | 'pokemon'>, suits = false): Player {
  return {
    id: entry.id,
    species: entry.pokemon.base.id,
    dexId: entry.pokemon.base.dexId,
    shiny: entry.pokemon.shiny,
    name: entry.pokemon.name.toUpperCase(),
    level: entry.pokemon.level,
    lent: false,
    suits,
  };
}

/** The house's own, as the plate draws it: `HOUSE PIKACHU`. */
export function loanPlayer(loan: HouseLoan): Player {
  return {
    id: loan.id,
    species: loan.species,
    dexId: loan.dexId,
    shiny: false,
    name: `HOUSE ${loan.name.toUpperCase()}`,
    level: loan.level,
    lent: true,
    suits: false,
  };
}

/** The same players, the partner moved to the front. */
function partnerFirst(players: readonly Player[], partnerId: string | null): Player[] {
  const partner = players.find((player) => player.id === partnerId);
  return partner ? [partner, ...players.filter((player) => player !== partner)] : [...players];
}

const sameIds = (a: Lineup, b: Lineup): boolean => a.length === b.length && a.every((player, index) => player.id === b[index]?.id);

/**
 * The lineups a game offers, best first: the team (when the game takes more
 * than one and there is a team to make), then each of the player's own alone,
 * the partner first, then the house's loan alone. None the same twice.
 */
export function lineupsFor(options: {
  /** Everyone of the player's own who can play, best fits first. */
  readonly able: readonly Player[];
  readonly partnerId: string | null;
  /** How many play at once. */
  readonly most: number;
  /** The team, when the game picks one its own way (the course keeper's); otherwise the first `most` of `able`, partner first. */
  readonly team?: Lineup;
  readonly loan?: Player;
}): Lineup[] {
  const own = partnerFirst(options.able, options.partnerId);
  const lineups: Lineup[] = [];
  const offer = (lineup: Lineup): void => {
    if (lineup.length > 0 && !lineups.some((other) => sameIds(other, lineup))) lineups.push(lineup);
  };
  if (options.most > 1) offer(options.team ?? own.slice(0, options.most));
  for (const player of own) offer([player]);
  if (options.loan) offer([options.loan]);
  return lineups;
}

// --- each game's -----------------------------------------------------------------

const JUMP_ORDER = { fast: 0, normal: 1, slow: 2 } as const;

/**
 * POKéMON JUMP: the player's jumpers - FireRed's list - as a team of up to
 * three led by the partner, the quickest kinds next (a team of one kind lands
 * together); each alone; and the house PIKACHU.
 */
export function jumpLineups(vault: PlayerVault): Lineup[] {
  const able = pickerEntries(vault)
    .filter((entry) => jumpTypeOf(entry.pokemon.base.id) !== undefined)
    .map((entry) => ({ entry, type: jumpTypeOf(entry.pokemon.base.id)! }))
    .sort((a, b) => JUMP_ORDER[a.type] - JUMP_ORDER[b.type] || a.entry.kept - b.entry.kept)
    .map(({ entry }) => playerOf(entry));
  return lineupsFor({ able, partnerId: vault.partnerId(), most: MAX_JUMPERS, loan: loanPlayer(HOUSE_JUMPER) });
}

/** BERRY PICKING: a DODRIO or a DODUO of the player's own, the most heads first, and the house DODUO. */
export function berryLineups(vault: PlayerVault): Lineup[] {
  const able = pickerOrder(
    pickerEntries(vault).filter((entry) => headsOf(entry.pokemon.base.id) !== undefined),
    (entry) => headsOf(entry.pokemon.base.id) ?? 0,
  ).map((entry) => playerOf(entry, headsOf(entry.pokemon.base.id) === 3));
  return lineupsFor({ able, partnerId: vault.partnerId(), most: 1, loan: loanPlayer(HOUSE_PICKER) });
}

/**
 * THE FIELD-MOVE COURSE: anybody can go round - a team with no field moves
 * goes the long way everywhere - so the team is the keeper's pick: the
 * partner, then whoever adds the most field moves the team lacks, until three
 * go or nobody adds any.
 */
export function courseLineups(vault: PlayerVault): Lineup[] {
  const entries = pickerOrder(pickerEntries(vault), (entry) => courseMovesOf(entry.pokemon.base.id).length);
  const able = entries.map((entry) => playerOf(entry, courseMovesOf(entry.pokemon.base.id).length > 0));
  const own = partnerFirst(able, vault.partnerId());
  const team: Player[] = [];
  const covered = new Set<FieldMoveId>();
  const join = (player: Player): void => {
    team.push(player);
    for (const move of courseMovesOf(player.species)) covered.add(move);
  };
  if (own[0]) join(own[0]);
  while (team.length < COURSE_TEAM_SIZE) {
    let pick: { player: Player; adds: number } | null = null;
    for (const player of own) {
      if (team.includes(player)) continue;
      const adds = courseMovesOf(player.species).filter((move) => !covered.has(move)).length;
      if (adds > 0 && (!pick || adds > pick.adds)) pick = { player, adds };
    }
    if (!pick) break;
    join(pick.player);
  }
  return lineupsFor({ able: own, partnerId: vault.partnerId(), most: COURSE_TEAM_SIZE, team });
}

/**
 * The promenade's outdoor games (THE DERBY, THE DIG, THE FISHING DERBY): one
 * Pokémon, any kind there is a game for, best fits first after the partner.
 * `fit` is the game's own (`OutdoorGameScene.fitOf`), undefined for a kind
 * it has nothing on.
 */
export function outdoorLineups(vault: PlayerVault, fit: (entry: PickerEntry) => number | undefined): Lineup[] {
  const fits = new Map<string, number | undefined>(pickerEntries(vault).map((entry) => [entry.id, fit(entry)]));
  const able = pickerOrder(
    pickerEntries(vault).filter((entry) => fits.get(entry.id) !== undefined),
    (entry) => fits.get(entry.id) ?? 0,
  ).map((entry) => playerOf(entry, (fits.get(entry.id) ?? 0) >= 2));
  return lineupsFor({ able, partnerId: vault.partnerId(), most: 1 });
}
