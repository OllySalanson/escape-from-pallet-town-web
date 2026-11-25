import { formatMoney, isCurrency, itemAmountFor } from '../items';
import type { ExtractionReport, ReportItem, ReportPokemon } from './extractionReport';

/**
 * What a raid that got out opens on: one moment, before the ledger.
 *
 * The overnight critic: "The results screen is a ledger" - eight headings,
 * BANKED twice, half the main panel empty, after a first raid that had done one
 * thing (problem 10, 25 Nov 2026). What a player wants first is what they did,
 * in their own nouns: the Pokemon they carried home, the job they finished, the
 * badge, or the money. So a raid that got out opens on a card - the deed as a
 * headline, one picture, a line of what else came home and Oak's next thing -
 * and the full report is one key away (`ExtractionScene`). A lost raid keeps
 * its own sequence (`defeatSequence.ts`), which is already a moment.
 *
 * Pure, like `extractionReport.ts`, so the words are held by tests.
 */
export type MomentPicture =
  | { readonly kind: 'pokemon'; readonly dexId: number; readonly shiny: boolean }
  | { readonly kind: 'item'; readonly itemId: string };

export interface ResultMoment {
  readonly headline: string;
  readonly picture: MomentPicture | null;
  /** What else came home, in a sentence; empty when the headline is all of it. */
  readonly line: string;
}

const upper = (text: string): string => text.toUpperCase();

function namesOf(pokemon: readonly ReportPokemon[]): string {
  const names = pokemon.map((each) => upper(each.name));
  return names.length <= 2 ? names.join(' AND ') : `${names.length} POKÉMON`;
}

/** The money in a group, and the rest of it. */
function split(items: readonly ReportItem[]): { readonly money: number; readonly things: readonly ReportItem[] } {
  return {
    money: items.filter((item) => isCurrency(item.itemId)).reduce((sum, item) => sum + item.quantity, 0),
    things: items.filter((item) => !isCurrency(item.itemId)),
  };
}

function amounts(money: number, things: readonly ReportItem[]): readonly string[] {
  return [...(money > 0 ? [formatMoney(money)] : []), ...things.map((item) => itemAmountFor(item.itemId, item.quantity))];
}

function listed(parts: readonly string[]): string {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The card a raid that got out opens on, or null for one that did not. */
export function resultMoment(report: ExtractionReport): ResultMoment | null {
  if (report.outcome !== 'ESCAPED' || report.settledElsewhere) {
    return null;
  }
  const found = report.ledgerFound;
  const paid = report.ledgerPaid;
  const caught = found.pokemon;
  const { money, things } = split([...found.items, ...paid.items]);
  const levelled = report.progress.filter((entry) => entry.toLevel > entry.fromLevel);
  const grew = levelled.length > 0 ? `${upper(levelled[0].name)} grew to Lv ${levelled[0].toLevel}.` : '';
  const alsoHome = (parts: readonly string[]): string =>
    [parts.length > 0 ? `${listed(parts)} came home too.` : '', grew].filter((part) => part !== '').join(' ');

  const badge = report.badgesWon?.[0];
  if (badge) {
    return { headline: upper(badge.replace(/!.*/, '!')), picture: null, line: badge.replace(/^[^!]*!\s*/, '') };
  }
  if (caught.length > 0) {
    const [first] = caught;
    return {
      headline: caught.length === 1 ? `${upper(first.name)} CAUGHT AND CARRIED HOME` : `${namesOf(caught)} CARRIED HOME`,
      picture: { kind: 'pokemon', dexId: first.dexId, shiny: first.shiny === true },
      line: alsoHome([...amounts(money, things), ...paid.pokemon.map((pokemon) => pokemon.name)]),
    };
  }
  if (report.contract?.complete) {
    const reward = paid.items[0] ?? things[0];
    return {
      headline: 'JOB DONE AND BANKED',
      picture: reward ? { kind: 'item', itemId: reward.itemId } : null,
      line: alsoHome(amounts(money, things)),
    };
  }
  if (money > 0 || things.length > 0) {
    const best = things[0];
    return {
      headline: `HOME WITH ${upper(listed(amounts(money, things.slice(0, 2))))}${things.length > 2 ? ' AND MORE' : ''}`,
      picture: best ? { kind: 'item', itemId: best.itemId } : { kind: 'item', itemId: 'money' },
      line: grew,
    };
  }
  return { headline: 'HOME SAFE, HANDS EMPTY', picture: null, line: grew || 'Nothing found this time. Your kit is back at base.' };
}
