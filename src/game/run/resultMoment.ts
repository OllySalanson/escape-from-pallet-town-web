import { honourById, type HonourId } from '../look/gymHonours';
import { formatMoney, isCurrency, itemAmountFor } from '../items';
import { STARTING_PACK_ID } from '../items/packs';
import type { ExtractionReport, ReportItem, ReportPokemon, ReportTeamMate } from './extractionReport';

/**
 * What a raid that got out opens on: one moment, before the ledger.
 *
 * The overnight critic: "The results screen is a ledger" (problem 10, 25 Nov
 * 2026). Then the captain, of the moment that replaced it: "way too much words
 * ... I always just skip past it" (25 Nov), and "It's so white after you come
 * out of the game ... I have no idea what the image means, and then the
 * sentence 'in your things, B at base'" (26 Nov). So a raid that got out
 * opens on a stage that says its deed in a few big words and shows the rest.
 * Then, of the dark stage that first did it: "I do like that animation. Maybe
 * we could improve on it though. We still need to improve on the overall
 * screen" (26 Nov). So the stage is a scene: the place the raid got out of is
 * still there behind it, gone dim; the team that walked out stands on it, each
 * one's bar filling with what it earned; the finds fly out of the raid pack
 * into the chest at home one by one, the money counts up, and the next job
 * comes in as a card (`ExtractionScene`). The full report is one key away. A lost raid keeps its own sequence
 * (`defeatSequence.ts`), which is already a moment.
 *
 * Pure, like `extractionReport.ts`, so the words are held by tests.
 */
export type MomentPicture =
  | { readonly kind: 'pokemon'; readonly dexId: number; readonly shiny: boolean }
  | { readonly kind: 'item'; readonly itemId: string }
  /** The player themselves, turning round in the gym honour they have just won (`look/gymHonours.ts`). */
  | { readonly kind: 'honour'; readonly honour: HonourId };

export interface ResultMoment {
  /** The deed, in a few big words. */
  readonly headline: string;
  readonly picture: MomentPicture | null;
  /** Anything the pictures cannot show, short; empty when there is nothing. */
  readonly line: string;
  /** The money banked, counted up on the stage; 0 when none was. */
  readonly money: number;
  /** The things seen going from the pack into the chest, or null when none are. */
  readonly stow: HaulStow | null;
  /** The team that walked out, standing on the stage with what each earned; empty where the report names none. */
  readonly team: readonly ReportTeamMate[];
  /**
   * The pack the finds come out of, by item id. Every raid is carried in one
   * (`items/packs.ts`: nobody is ever stranded without); a report written down
   * before it named its pack is drawn with the pack a save starts with.
   */
  readonly packItemId: string;
}

/** The things a raid put in YOUR THINGS, as the stage drops them into HOME. */
export interface HaulStow {
  /** The kinds that drop in, at most `STOW_SHOWN`. */
  readonly things: readonly ReportItem[];
  /** How many kinds more went in than drop in, said as one "+N" in the last cell. */
  readonly more: number;
}

/** As many cells as HOME's row has on the narrowest window. */
export const STOW_SHOWN = 6;

/**
 * The things a raid that got out put in storage - found and paid - because
 * that is what YOUR THINGS now holds. Money is counted, not dropped, and
 * Pokémon are not things. Nothing for a raid that could not be saved, which
 * is not in yet.
 */
function stowOf(report: ExtractionReport): HaulStow | null {
  if (!report.saved) {
    return null;
  }
  const items = report.ledger.items.filter((item) => !isCurrency(item.itemId));
  if (items.length === 0) {
    return null;
  }
  // Six kinds, or five and a "+N" for the rest, so the row is never wider than six.
  const shown = items.length <= STOW_SHOWN ? items : items.slice(0, STOW_SHOWN - 1);
  return { things: shown, more: items.length - shown.length };
}

/** The money a raid that got out banked, which the stage counts up. */
function moneyOf(report: ExtractionReport): number {
  return report.saved ? report.ledger.items.filter((item) => isCurrency(item.itemId)).reduce((sum, item) => sum + item.quantity, 0) : 0;
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

/** The moment a raid that got out opens on, or null for one that did not. */
export function resultMoment(report: ExtractionReport): ResultMoment | null {
  if (report.outcome !== 'ESCAPED' || report.settledElsewhere) {
    return null;
  }
  const found = report.ledgerFound;
  const paid = report.ledgerPaid;
  const caught = found.pokemon;
  const { money, things } = split([...found.items, ...paid.items]);
  const stow = stowOf(report);
  const banked = moneyOf(report);
  const levelled = report.progress.filter((entry) => entry.toLevel > entry.fromLevel);
  // With the team on the stage a new level is called over the Pokémon that
  // reached it; it is said in words only on a report that names no team.
  const grew = report.team === undefined && levelled.length > 0 ? `${upper(levelled[0].name)} grew to Lv ${levelled[0].toLevel}!` : '';
  const said = (...parts: readonly string[]): string => parts.filter((part) => part !== '').join(' ');
  // Shown on the stage, the haul is never said again in words; it is said only
  // when the raid could not be saved, and so has nothing to show going in.
  const unshown = report.saved ? [] : amounts(money, things);
  const alsoHome = (parts: readonly string[]): string => (parts.length > 0 ? `${listed(parts)} came home too.` : '');
  const base = { money: banked, stow, team: report.team ?? [], packItemId: report.pack?.itemId ?? STARTING_PACK_ID };

  const badge = report.badgesWon?.[0];
  if (badge) {
    // A gym's badge is worn: the stage is the player turning round in it, and says so.
    const won = report.honoursWon?.[0];
    const honour = won ? honourById(won) : undefined;
    return {
      ...base,
      headline: upper(badge.replace(/!.*/, '!')),
      picture: honour ? { kind: 'honour', honour: honour.id } : null,
      line: said(badge.replace(/^[^!]*!\s*/, ''), honour ? `You wear the ${honour.name} now.` : ''),
    };
  }
  if (caught.length > 0) {
    const [first] = caught;
    return {
      ...base,
      headline: `${namesOf(caught)} CAUGHT!`,
      picture: { kind: 'pokemon', dexId: first.dexId, shiny: first.shiny === true },
      line: said(alsoHome([...unshown, ...paid.pokemon.map((pokemon) => upper(pokemon.name))]), grew),
    };
  }
  if (report.contract?.complete) {
    const reward = paid.items[0] ?? things[0];
    return {
      ...base,
      headline: 'JOB DONE!',
      // The reward drops into HOME with the rest, so it is the picture only when nothing drops.
      picture: !stow && reward ? { kind: 'item', itemId: reward.itemId } : null,
      line: said(alsoHome(unshown), grew),
    };
  }
  if (money > 0 || things.length > 0) {
    return {
      ...base,
      headline: 'YOU GOT OUT!',
      picture: stow || banked > 0 ? null : things[0] ? { kind: 'item', itemId: things[0].itemId } : { kind: 'item', itemId: 'money' },
      line: said(report.saved ? '' : `Home with ${listed(unshown)}.`, grew),
    };
  }
  return {
    ...base,
    headline: 'HOME SAFE',
    picture: null,
    line: grew || 'Nothing found this time.',
  };
}
