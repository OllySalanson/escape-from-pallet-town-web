import { ITEM_DEFINITIONS, type BagContents } from '../items';
import type { Pokemon } from '../pokemon';
import type { RunSnapshot } from './RunManager';
import { hunterFleePenaltyMs } from './fleePenalty';
import { formatRaidClock } from './raidClock';

/**
 * The one description of how a raid ended, shared by every way it can end.
 *
 * Extraction is the payoff of the whole loop and a wipe is its mirror, so both
 * are described here rather than in three separate dialogue scripts. Everything
 * is derived from the run snapshot and the banked or lost totals the caller
 * already applied to the stash, so the screen cannot claim a reward the save did
 * not receive. Keeping it free of Phaser keeps the wording testable.
 */

/** Any item quantity the report is handed, whatever produced it. */
interface Stack {
  readonly itemId: string;
  readonly quantity: number;
}

export type ExtractionOutcome = 'ESCAPED' | 'WIPED';

/** Why a lost raid ended, which changes the headline but not the accounting. */
export type WipeCause = 'defeated' | 'timer';

/** How much a successful raid was actually worth, used to grade the headline. */
export type HaulTier = 'empty' | 'thin' | 'solid' | 'loaded';

export interface ReportItem {
  readonly itemId: string;
  readonly label: string;
  readonly quantity: number;
}

export interface ReportPokemon {
  readonly name: string;
  readonly dexId: number;
  readonly level: number;
  readonly currentHp: number;
  readonly maxHp: number;
}

export interface ReportGroup {
  readonly pokemon: readonly ReportPokemon[];
  readonly items: readonly ReportItem[];
}

export interface ReportContract {
  readonly description: string;
  readonly complete: boolean;
  readonly reward: string;
}

export interface ExtractionReport {
  readonly outcome: ExtractionOutcome;
  readonly cause?: WipeCause;
  /** Small caps line above the headline: how the raid ended, and where. */
  readonly eyebrow: string;
  readonly headline: string;
  /** One sentence naming what actually happened to this player's stuff. */
  readonly summary: string;
  readonly haulTier: HaulTier;
  readonly clockLabel: string;
  readonly elapsedMs: number;
  readonly durationMs: number;
  /** Everything the stash gained (ESCAPED) or lost for good (WIPED). */
  readonly ledger: ReportGroup;
  readonly ledgerHeading: string;
  readonly ledgerEmptyText: string;
  readonly contract?: ReportContract;
  readonly secured: ReportGroup;
  readonly risked: ReportGroup;
  /** What the secure-slot decision was worth, in this raid, in one sentence. */
  readonly gambleVerdict: string;
  /** Undefined when the losing scene could not see the bag, never an empty lie. */
  readonly spent?: readonly ReportItem[];
  /** What the raid put the player through: escapes, fights, the clock. */
  readonly pressure: readonly string[];
  readonly saved: boolean;
}

export interface ExtractionReportInput {
  readonly outcome: ExtractionOutcome;
  readonly cause?: WipeCause;
  readonly snapshot: RunSnapshot;
  readonly durationMs: number;
  /** The exit that was used, when the raid was survived. */
  readonly exitLabel?: string;
  /**
   * Exactly what the caller wrote to the stash. Passing it rather than deriving
   * it keeps the screen from ever reporting a reward that was not banked.
   */
  readonly banked?: { readonly pokemon: readonly Pokemon[]; readonly items: readonly Stack[] };
  readonly lost?: { readonly pokemon: readonly Pokemon[]; readonly items: readonly Stack[] };
  readonly contract?: ReportContract;
  /** The bag as it stood at the end, which is how supplies spent is measured. */
  readonly carriedOut?: BagContents;
  readonly saved: boolean;
}

export function buildExtractionReport(input: ExtractionReportInput): ExtractionReport {
  const { snapshot, outcome } = input;
  const escaped = outcome === 'ESCAPED';
  const banked = input.banked ?? { pokemon: [], items: [] };
  const lost = input.lost ?? { pokemon: [], items: [] };
  const ledgerSource = escaped ? banked : lost;
  const ledger: ReportGroup = {
    pokemon: ledgerSource.pokemon.map(toReportPokemon),
    items: toReportItems(ledgerSource.items),
  };

  const securedItems = snapshot.secureSlot.items ?? [];
  const secured: ReportGroup = {
    pokemon: snapshot.secureSlot.pokemon ? [toReportPokemon(snapshot.secureSlot.pokemon)] : [],
    items: toReportItems(securedItems),
  };
  const risked: ReportGroup = {
    pokemon: (snapshot.loadout?.party ?? [])
      .filter((member) => member !== snapshot.secureSlot.pokemon)
      .map(toReportPokemon),
    items: toReportItems(subtractStacks(snapshot.loadout?.items ?? [], securedItems)),
  };

  const contract = input.contract?.complete ? input.contract : undefined;
  const haulTier = gradeHaul(ledger, contract !== undefined, escaped);

  return {
    outcome,
    ...(input.cause ? { cause: input.cause } : {}),
    eyebrow: escaped
      ? `Extracted${input.exitLabel ? ` · ${input.exitLabel}` : ''}`
      : 'Raid lost',
    headline: escaped ? escapeHeadline(haulTier) : wipeHeadline(input.cause, secured),
    summary: escaped
      ? escapeSummary(ledger, risked, contract !== undefined)
      : wipeSummary(input.cause, ledger, secured),
    haulTier,
    clockLabel: `${formatRaidClock(snapshot.elapsedMs)} of ${formatRaidClock(input.durationMs)}`,
    elapsedMs: snapshot.elapsedMs,
    durationMs: input.durationMs,
    ledger,
    ledgerHeading: escaped ? 'Banked' : 'Gone for good',
    ledgerEmptyText: escaped
      ? 'Nothing new. You leave with exactly what you took in.'
      : 'Nothing outside the secure slot was at stake.',
    ...(contract ? { contract } : {}),
    secured,
    risked,
    gambleVerdict: gambleVerdict(escaped, secured, risked),
    ...(input.carriedOut === undefined
      ? {}
      : { spent: suppliesSpent(snapshot, input.carriedOut) }),
    pressure: pressureLines(snapshot, escaped),
    saved: input.saved,
  };
}

function escapeHeadline(tier: HaulTier): string {
  switch (tier) {
    case 'loaded':
      return 'You walked out loaded.';
    case 'solid':
      return 'You got out with the goods.';
    case 'thin':
      return 'You scraped out.';
    case 'empty':
      return 'You got out clean, and empty.';
  }
}

function wipeHeadline(cause: WipeCause | undefined, secured: ReportGroup): string {
  if (cause === 'timer') {
    return 'The clock ran out with you still inside.';
  }
  return isEmptyGroup(secured) ? 'You went down with everything on you.' : 'You went down.';
}

function escapeSummary(
  ledger: ReportGroup,
  risked: ReportGroup,
  contractComplete: boolean,
): string {
  const haul = describeGroup(ledger);
  const riskedCount = countGroup(risked);
  const riskLine =
    riskedCount === 0
      ? 'Nothing you took in was ever exposed.'
      : `${riskedCount === 1 ? 'One entry' : `${riskedCount} entries`} rode out unprotected and came home.`;
  if (haul === null) {
    return `No new haul. ${riskLine}`;
  }
  return `${contractComplete ? 'Contract banked, plus ' : 'Banked '}${haul}. ${riskLine}`;
}

function wipeSummary(
  cause: WipeCause | undefined,
  ledger: ReportGroup,
  secured: ReportGroup,
): string {
  const gone = describeGroup(ledger);
  const opening =
    cause === 'timer'
      ? 'The extraction window closed on you.'
      : 'The raid ended where you fell.';
  if (gone === null) {
    return `${opening} Nothing was taken from your stash.`;
  }
  const kept = describeGroup(secured);
  return `${opening} You lost ${gone}.${kept === null ? ' Nothing was protected.' : ` The secure slot held ${kept}.`}`;
}

function gambleVerdict(escaped: boolean, secured: ReportGroup, risked: ReportGroup): string {
  const riskedDescription = describeGroup(risked);
  const securedDescription = describeGroup(secured);
  if (escaped) {
    if (riskedDescription === null) {
      return securedDescription === null
        ? 'You deployed with nothing to lose, so the secure slot had nothing to do.'
        : `Everything you took in was protected, so the raid was never a gamble.`;
    }
    return `A wipe would have cost you ${riskedDescription}. It did not happen this time.`;
  }
  if (securedDescription === null) {
    return riskedDescription === null
      ? 'There was nothing in the secure slot, and nothing outside it either.'
      : `The secure slot was empty, so ${riskedDescription} went with the raid.`;
  }
  return riskedDescription === null
    ? `The secure slot brought ${securedDescription} home. Nothing else was exposed.`
    : `The secure slot brought ${securedDescription} home. ${capitalise(riskedDescription)} did not make it.`;
}

/**
 * Supplies burned during the raid: what was carried in, plus what was picked up,
 * minus what was still in the bag at the end.
 */
function suppliesSpent(snapshot: RunSnapshot, carriedOut: BagContents): ReportItem[] {
  const held = new Map<string, number>();
  for (const { itemId, quantity } of [...(snapshot.loadout?.items ?? []), ...snapshot.foundItems]) {
    held.set(itemId, (held.get(itemId) ?? 0) + quantity);
  }
  return toReportItems(
    [...held].map(([itemId, quantity]) => ({
      itemId,
      quantity: quantity - (carriedOut[itemId] ?? 0),
    })),
  );
}

function pressureLines(snapshot: RunSnapshot, escaped: boolean): string[] {
  const lines: string[] = [];
  if (snapshot.hunterFlees > 0) {
    const clockCost = Array.from({ length: snapshot.hunterFlees }, (_unused, index) =>
      hunterFleePenaltyMs(index),
    ).reduce((total, penalty) => total + penalty, 0);
    lines.push(
      `${snapshot.hunterFlees === 1 ? 'One escape' : `${snapshot.hunterFlees} escapes`} from the hunter, for ${formatRaidClock(clockCost)} off the clock`,
    );
  }
  if (snapshot.defeatedTrainers > 0) {
    lines.push(
      `${snapshot.defeatedTrainers} ${snapshot.defeatedTrainers === 1 ? 'trainer' : 'trainers'} put down`,
    );
  }
  if (snapshot.visitedMapIds.length > 1) {
    lines.push(`${snapshot.visitedMapIds.length} areas crossed`);
  }
  if (snapshot.isEnraged && escaped) {
    lines.push('Extracted after the raid enraged');
  }
  return lines;
}

function gradeHaul(ledger: ReportGroup, contractComplete: boolean, escaped: boolean): HaulTier {
  if (!escaped) {
    return 'empty';
  }
  const score =
    ledger.pokemon.length * 3 +
    ledger.items.reduce((total, item) => total + item.quantity, 0) +
    (contractComplete ? 4 : 0);
  if (score === 0) {
    return 'empty';
  }
  if (score <= 2) {
    return 'thin';
  }
  return score <= 6 ? 'solid' : 'loaded';
}

/** "Bulbasaur and 3 Potions", or null when the group holds nothing. */
function describeGroup(group: ReportGroup): string | null {
  const parts = [
    ...group.pokemon.map((member) => member.name),
    ...group.items.map((item) => `${item.quantity} ${item.label}${item.quantity === 1 ? '' : 's'}`),
  ];
  if (parts.length === 0) {
    return null;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function countGroup(group: ReportGroup): number {
  return group.pokemon.length + group.items.length;
}

function isEmptyGroup(group: ReportGroup): boolean {
  return countGroup(group) === 0;
}

function toReportPokemon(pokemon: Pokemon): ReportPokemon {
  return {
    name: pokemon.base.name,
    dexId: pokemon.base.dexId,
    level: pokemon.level,
    currentHp: pokemon.currentHp,
    maxHp: pokemon.maxHp,
  };
}

function toReportItems(items: readonly Stack[]): ReportItem[] {
  const quantities = new Map<string, number>();
  for (const { itemId, quantity } of items) {
    quantities.set(itemId, (quantities.get(itemId) ?? 0) + quantity);
  }
  return [...quantities]
    .filter(([, quantity]) => quantity > 0)
    .map(([itemId, quantity]) => ({ itemId, label: itemLabel(itemId), quantity }));
}

function subtractStacks(items: readonly Stack[], removed: readonly Stack[]): Stack[] {
  const remaining = new Map<string, number>();
  for (const { itemId, quantity } of items) {
    remaining.set(itemId, (remaining.get(itemId) ?? 0) + quantity);
  }
  for (const { itemId, quantity } of removed) {
    remaining.set(itemId, (remaining.get(itemId) ?? 0) - quantity);
  }
  return [...remaining]
    .filter(([, quantity]) => quantity > 0)
    .map(([itemId, quantity]) => ({ itemId, quantity }));
}

function itemLabel(itemId: string): string {
  return (
    ITEM_DEFINITIONS.find((item) => item.id === itemId)?.displayName ??
    itemId.replaceAll('-', ' ')
  );
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
