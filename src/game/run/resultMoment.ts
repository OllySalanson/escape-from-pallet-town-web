import { RAID_KEY_LETTERS } from '../input/keyBindings';
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
 * Under it, what the raid brought home is seen to go into YOUR THINGS: each
 * thing hops into a sack, one after another, with a chime (`stow`). The
 * captain, 25 Nov 2026: the haul used to be stood on the quay as pictures,
 * signed "For the vault", which looked like loot that could not be picked up
 * and named a place nobody could find. The things were put away the moment the
 * raid ended, so this is where they are shown going, and the key that shows
 * them again is named under the sack.
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
  /** What is seen going into YOUR THINGS, or null when nothing is. */
  readonly stow: HaulStow | null;
}

/** The things a raid put in YOUR THINGS, as the result card drops them into the sack. */
export interface HaulStow {
  /** The kinds that hop in, money first, at most `STOW_SHOWN`. */
  readonly things: readonly ReportItem[];
  /** How many kinds more went in than hop in, said as one "+N" that hops in last. */
  readonly more: number;
}

/** As many as hop in a row the narrowest window has room for. */
export const STOW_SHOWN = 6;

/**
 * What is written under the sack once the last thing is in: the screen's name
 * and where its key works. Never `[B]`, which on this screen reads as a key the
 * card answers to, beside `FULL REPORT [L]` (the critic, 25 Nov 2026).
 */
export const STOW_LABEL = `IN YOUR THINGS · ${RAID_KEY_LETTERS.bag} AT BASE`;

/**
 * Everything a raid that got out put in storage - found and paid - because
 * that is what YOUR THINGS now holds; Pokémon are not things and go to the
 * team. Nothing for a raid that could not be saved, which is not in yet.
 */
function stowOf(report: ExtractionReport): HaulStow | null {
  if (!report.saved) {
    return null;
  }
  const items = [...report.ledger.items].sort((a, b) => Number(isCurrency(b.itemId)) - Number(isCurrency(a.itemId)));
  if (items.length === 0) {
    return null;
  }
  // Six kinds, or five and a "+N" for the rest, so the row is never wider than six.
  const shown = items.length <= STOW_SHOWN ? items : items.slice(0, STOW_SHOWN - 1);
  return { things: shown, more: items.length - shown.length };
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
  const stow = stowOf(report);
  const levelled = report.progress.filter((entry) => entry.toLevel > entry.fromLevel);
  const grew = levelled.length > 0 ? `${upper(levelled[0].name)} grew to Lv ${levelled[0].toLevel}.` : '';
  const alsoHome = (parts: readonly string[]): string =>
    [parts.length > 0 ? `${listed(parts)} came home too.` : '', grew].filter((part) => part !== '').join(' ');
  // What hops into the sack is not said again in words under the headline.
  const unseen = (parts: readonly string[]): readonly string[] => (stow ? [] : parts);

  const badge = report.badgesWon?.[0];
  if (badge) {
    return { headline: upper(badge.replace(/!.*/, '!')), picture: null, line: badge.replace(/^[^!]*!\s*/, ''), stow };
  }
  if (caught.length > 0) {
    const [first] = caught;
    return {
      headline: caught.length === 1 ? `${upper(first.name)} CAUGHT AND CARRIED HOME` : `${namesOf(caught)} CARRIED HOME`,
      picture: { kind: 'pokemon', dexId: first.dexId, shiny: first.shiny === true },
      line: alsoHome([...unseen(amounts(money, things)), ...paid.pokemon.map((pokemon) => pokemon.name)]),
      stow,
    };
  }
  if (report.contract?.complete) {
    const reward = paid.items[0] ?? things[0];
    return {
      headline: 'JOB DONE AND BANKED',
      picture: reward ? { kind: 'item', itemId: reward.itemId } : null,
      line: alsoHome(unseen(amounts(money, things))),
      stow,
    };
  }
  if (money > 0 || things.length > 0) {
    const best = things[0];
    return {
      headline: `HOME WITH ${upper(listed(amounts(money, things.slice(0, 2))))}${things.length > 2 ? ' AND MORE' : ''}`,
      // The things hopping into the sack are the picture, when they are seen to.
      picture: stow ? null : best ? { kind: 'item', itemId: best.itemId } : { kind: 'item', itemId: 'money' },
      line: grew,
      stow,
    };
  }
  return {
    headline: 'HOME SAFE, HANDS EMPTY',
    picture: null,
    line: grew || 'Nothing found this time. Your kit is back at base.',
    stow,
  };
}
