import { currentItemId, getItemById, itemNameFor, type ItemId } from '../items';
import { TRADER_BARTERS, type TraderBarter, type TraderStack } from './trader';

/**
 * Bill's book: every deal struck at his barter table, and so everything you
 * ever handed him - which is what his cabinet of oddities stands on its shelves
 * (`../base/cabinet.ts`).
 *
 * He is the collector who trades oddity for oddity, so the things he takes do
 * not vanish into a sink: they turn up on a shelf in his cottage, and over
 * weeks the shelves fill with the player's own history. That is the captain's
 * rule for the base - progress you can see beats progress on a ledger - kept
 * for the one keeper whose deals left nothing behind.
 *
 * Unlike almost everything else a save holds, this cannot be derived. Which
 * once-only deals were struck is already a list (`traderBarters`), but a stone
 * can be bartered for any number of times and nothing records how often, or
 * when, or what it cost *then* - and history has to keep the price that was
 * paid, not today's price, or rebalancing a barter would rewrite every shelf.
 * So each entry is the deal as struck: what went across, what came back, and
 * the day. It is still a record of what happened rather than a state, which is
 * the rule every other list in `raidProgress` follows: nothing here is an
 * effect, and nothing reads it but the cabinet.
 */
export interface CabinetEntry {
  /** The barter struck, by id - which is what a deal made before the book was kept is matched on. */
  readonly barter: string;
  /** What the player handed over, already multiplied out for a deal struck several times at once. */
  readonly gave: readonly TraderStack[];
  /** What Bill handed back. */
  readonly got: TraderStack;
  /**
   * The day it was struck, as `YYYY-MM-DD` in the player's own time. Absent
   * only on a deal struck before he kept a book, which the cabinet still shows
   * - see `cabinetOddities`.
   */
  readonly day?: string;
}

/** One deal, as it goes in the book. */
export function cabinetEntryFor(barter: TraderBarter, times: number, when: Date): CabinetEntry {
  return {
    barter: barter.id,
    gave: barter.takes.map(({ itemId, quantity }) => ({ itemId, quantity: quantity * times })),
    got: { itemId: barter.gives.itemId, quantity: barter.gives.quantity * times },
    day: dayOf(when),
  };
}

/** A date as the book writes it: the player's own calendar day. */
export function dayOf(when: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
}

/**
 * One thing on Bill's shelves: a single unit of something the player handed
 * over, and the deal it went across in.
 */
export interface Oddity {
  readonly itemId: ItemId;
  readonly got: TraderStack;
  readonly day?: string;
}

/**
 * Everything the cabinet holds, oldest first: one oddity per unit handed over,
 * in the order the deals were struck and, inside a deal, in the order its price
 * is written.
 *
 * A once-only deal struck before the book was kept is still in `traderBarters`,
 * so its price is known even though its day is not, and those come first,
 * undated - a player who bartered for a Quick Claw last week walks in to find
 * the crates they paid with already on the shelf, rather than an empty cabinet
 * that forgot them.
 */
export function cabinetOddities(progress: {
  readonly traderBarters?: readonly string[];
  readonly traderCabinet?: readonly CabinetEntry[];
}): readonly Oddity[] {
  const book = progress.traderCabinet ?? [];
  const struck = progress.traderBarters ?? [];
  const remembered = TRADER_BARTERS.filter(
    (barter) =>
      barter.once &&
      struck.includes(barter.id) &&
      !book.some((entry) => entry.barter === barter.id),
  ).map(
    (barter): CabinetEntry => ({ barter: barter.id, gave: barter.takes, got: barter.gives }),
  );
  return [...remembered, ...book].flatMap((entry) =>
    entry.gave.flatMap(({ itemId, quantity }) =>
      Array.from({ length: quantity }, (): Oddity => ({
        itemId,
        got: entry.got,
        ...(entry.day === undefined ? {} : { day: entry.day }),
      })),
    ),
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A day the way a label in a case gives it: "24 Sep", and the year only when
 * it is not this one. Undefined for a deal made before the book was kept.
 */
export function cabinetDayLabel(day: string | undefined, today: Date): string | undefined {
  const parts = day === undefined ? null : /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!parts) {
    return undefined;
  }
  const [year, month, date] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const label = `${date} ${MONTHS[month - 1]}`;
  return year === today.getFullYear() ? label : `${label} ${year}`;
}

/**
 * What the label on an oddity says: what it is, and what it went for and when.
 * "For the Focus Band" rather than "a": it was that one, the one he handed
 * back, and "the" is right in front of every name on the boat, where "a" is
 * wrong in front of Leftovers and an HM.
 */
export function oddityLabel(oddity: Oddity, today: Date): { readonly name: string; readonly note: string } {
  const name = (getItemById(oddity.itemId)?.displayName ?? oddity.itemId).toUpperCase();
  const what =
    oddity.got.quantity === 1
      ? `the ${itemNameFor(oddity.got.itemId, 1)}`
      : `${oddity.got.quantity} ${itemNameFor(oddity.got.itemId, oddity.got.quantity)}`;
  const when = cabinetDayLabel(oddity.day, today) ?? 'a while back';
  return { name, note: `For ${what}, ${when}` };
}

/**
 * The book read back out of a save. An entry that does not name a real item on
 * both sides of the counter is dropped whole - a shelf may show less than was
 * traded, never something that was not - and a day that is not a date is
 * forgotten rather than guessed at. Absent on every save written before the
 * book was kept, which reads as an empty book: the once-only deals it made are
 * still shown, from `traderBarters`.
 */
export function clampCabinet(value: unknown): readonly CabinetEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry): CabinetEntry[] => {
    if (typeof entry !== 'object' || entry === null) {
      return [];
    }
    const { barter, gave, got, day } = entry as Record<string, unknown>;
    const stacks = Array.isArray(gave) ? gave.map(clampStack) : [];
    const back = clampStack(got);
    if (
      typeof barter !== 'string' ||
      stacks.length === 0 ||
      stacks.some((stack) => stack === undefined) ||
      back === undefined
    ) {
      return [];
    }
    return [
      {
        barter,
        gave: stacks as TraderStack[],
        got: back,
        ...(typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? { day } : {}),
      },
    ];
  });
}

function clampStack(value: unknown): TraderStack | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { itemId, quantity } = value as Record<string, unknown>;
  if (typeof itemId !== 'string' || typeof quantity !== 'number') {
    return undefined;
  }
  const current = currentItemId(itemId);
  return getItemById(current) !== undefined && Number.isSafeInteger(quantity) && quantity > 0
    ? { itemId: current as ItemId, quantity }
    : undefined;
}
