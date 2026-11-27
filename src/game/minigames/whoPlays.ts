import type { StashedPokemon } from '../stash';
import { pickerEntries, pickerOrder, type PickerEntry } from '../ui/boxPicker';
import { headsOf } from './berryPicking';
import { COURSE_TEAM_SIZE, courseMovesOf } from './fieldCourse';
import { HOUSE_JUMPER, HOUSE_PICKER, type HouseLoan } from './houseLoans';
import { jumpTypeOf, MAX_JUMPERS } from './pokemonJump';

/**
 * Who plays a harbour game, decided before the player is asked anything: the
 * game starts at once, and the start line offers the next one along on LEFT
 * and RIGHT (`scenes/readySetGo.ts`). The first in line is the partner when it
 * can play, else the house's own loan where the game has one, else the best
 * fit; after it come the player's others who can play, best fits first, and
 * the loan last. A Pokémon that cannot play is never in line at all, so there
 * is no list of who cannot.
 *
 * Pure and Phaser-free: the scenes and the tests ask the same thing.
 */

/** One who could play, the player's own or the house's. */
export interface Contender {
  /** The stash id, or the loan's `house:` id. */
  readonly id: string;
  readonly species: string;
  readonly dexId: number;
  readonly shiny: boolean;
  /** As the game shows it: `CHARMANDER`, or the nickname in capitals. */
  readonly name: string;
  readonly level: number;
  /** Lent by the house, and never stored (`houseLoans.ts`). */
  readonly loan: boolean;
}

/** What a line-up needs of the vault. */
export interface LineupVault {
  listPokemon(): readonly StashedPokemon[];
  partnerId(): string | null;
}

/** One of the player's own, as a contender. */
export function contenderOf(entry: Pick<StashedPokemon, 'id' | 'pokemon'>): Contender {
  return {
    id: entry.id,
    species: entry.pokemon.base.id,
    dexId: entry.pokemon.base.dexId,
    shiny: entry.pokemon.shiny,
    name: entry.pokemon.name.toUpperCase(),
    level: entry.pokemon.level,
    loan: false,
  };
}

/** The house's loan, as a contender. */
export function loanContender(loan: HouseLoan): Contender {
  return { id: loan.id, species: loan.species, dexId: loan.dexId, shiny: false, name: loan.name.toUpperCase(), level: loan.level, loan: true };
}

/**
 * The line: the partner first if it is in `able`, else the loan; then the rest
 * of `able` in the order given; then the loan, if it was not first.
 */
export function lineup(able: readonly Contender[], partnerId: string | null, loan?: Contender): Contender[] {
  const partner = partnerId === null ? undefined : able.find((contender) => contender.id === partnerId);
  const rest = able.filter((contender) => contender !== partner);
  if (partner) return [partner, ...rest, ...(loan ? [loan] : [])];
  return loan ? [loan, ...rest] : [...rest];
}

/** The place `step` along a line of `length`, round from the end to the start. */
export function stepAlong(length: number, index: number, step: number): number {
  if (length <= 0) return 0;
  return (((index + step) % length) + length) % length;
}

/** The vault's own who fit, best first, as contenders: `fit` above zero can play. */
function ableBy(vault: LineupVault, fit: (entry: PickerEntry) => number): Contender[] {
  return pickerOrder(pickerEntries(vault), fit)
    .filter((entry) => fit(entry) > 0)
    .map(contenderOf);
}

// --- POKéMON JUMP ---------------------------------------------------------------

const JUMP_PACE = { fast: 0, normal: 1, slow: 2 } as const;

/** Who can lead POKéMON JUMP: whoever FireRed lets jump, and the house's PIKACHU. */
export function jumpLineup(vault: LineupVault): Contender[] {
  return lineup(
    ableBy(vault, (entry) => (jumpTypeOf(entry.pokemon.base.id) ? 1 : 0)),
    vault.partnerId(),
    loanContender(HOUSE_JUMPER),
  );
}

/**
 * Who jumps with a lead: the lead, then up to two more who can - the same kind
 * of jumper first, because a team of one kind lands and leaves together, then
 * the quickest, the player's own before the house's.
 */
export function jumpTeam(lead: Contender, line: readonly Contender[]): Contender[] {
  const kind = jumpTypeOf(lead.species);
  const pace = (contender: Contender): number => {
    const type = jumpTypeOf(contender.species);
    return type ? JUMP_PACE[type] : 9;
  };
  const mates = line
    .filter((contender) => contender.id !== lead.id && jumpTypeOf(contender.species) !== undefined)
    .map((contender, order) => ({ contender, order }))
    .sort(
      (a, b) =>
        Number(jumpTypeOf(a.contender.species) !== kind) - Number(jumpTypeOf(b.contender.species) !== kind) ||
        pace(a.contender) - pace(b.contender) ||
        Number(a.contender.loan) - Number(b.contender.loan) ||
        a.order - b.order,
    )
    .map(({ contender }) => contender);
  return [lead, ...mates].slice(0, MAX_JUMPERS);
}

// --- BERRY PICKING --------------------------------------------------------------

/** Who can pick: a DODRIO or a DODUO of the player's own, the most heads first, and the house's DODUO. */
export function berryLineup(vault: LineupVault): Contender[] {
  return lineup(
    ableBy(vault, (entry) => headsOf(entry.pokemon.base.id) ?? 0),
    vault.partnerId(),
    loanContender(HOUSE_PICKER),
  );
}

// --- THE FIELD-MOVE COURSE ----------------------------------------------------------

/** Who can lead a run round the course: anybody, the most field moves first - with none it is the long way round. */
export function courseLineup(vault: LineupVault): Contender[] {
  return lineup(
    ableBy(vault, (entry) => 1 + courseMovesOf(entry.pokemon.base.id).length),
    vault.partnerId(),
  );
}

/** Who goes round with a lead: the lead, then whoever adds the most field moves, until three or nothing more is added. */
export function courseTeam(lead: Contender, line: readonly Contender[]): Contender[] {
  const team = [lead];
  const covered = new Set(courseMovesOf(lead.species));
  while (team.length < COURSE_TEAM_SIZE) {
    let pick: { contender: Contender; adds: number } | null = null;
    for (const contender of line) {
      if (team.some((member) => member.id === contender.id)) continue;
      const adds = courseMovesOf(contender.species).filter((move) => !covered.has(move)).length;
      if (adds > 0 && (!pick || adds > pick.adds)) pick = { contender, adds };
    }
    if (!pick) break;
    team.push(pick.contender);
    for (const move of courseMovesOf(pick.contender.species)) covered.add(move);
  }
  return team;
}
