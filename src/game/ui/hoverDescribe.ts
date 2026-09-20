/**
 * Pointing at a thing is a question, and the answer is free.
 *
 * The in-raid screens each had a detail panel bound to one number - the bag's
 * `selectedItemIndex`, the party's `selectedIndex` - so the only way to be told
 * what a thing was, was to choose it first. A player mid-raid who wants to know
 * what a RADIO VALVE is has to commit to it to find out, and the commit moves
 * the cursor off whatever they were actually going to use.
 *
 * So a screen has three answers to "what is it about", and the nearest one
 * wins: the thing the pointer is on, then the thing the keyboard cursor is on,
 * then the thing the player has actually chosen. Neither pointing nor arrowing
 * writes to the selection, so the two inputs cannot fight - each only says where
 * it is, and `describedKey` reads the most recent of them.
 *
 * Phaser-free and DOM-free: the rules are held in `hoverDescribe.test.ts`
 * rather than eyeballed in a browser.
 */

/** Where each of a screen's three answers currently points. */
export interface DescribeSources {
  /** What the pointer is resting on, or null when it is on nothing. */
  readonly pointer: string | null;
  /** What the keyboard cursor is resting on, or null. */
  readonly cursor: string | null;
  /** What the player has chosen, which pointing and arrowing never change. */
  readonly selected: string | null;
}

/** The thing a screen's detail panel is about right now. */
export function describedKey(sources: DescribeSources): string | null {
  return sources.pointer ?? sources.cursor ?? sources.selected;
}

/** Whether the panel is showing something other than what the player chose. */
export function isPreviewing(sources: DescribeSources): boolean {
  const described = describedKey(sources);
  return described !== null && described !== sources.selected;
}

/**
 * Written on a describable thing that only the *pointer* may answer about.
 *
 * The rule it exists for: **the cursor may only describe a thing whose panel
 * holds no controls of its own.** The raid party's card carries gear rows, so a
 * cursor that swapped the card as it passed each member left the cursor's own
 * next step somewhere else - which on a two-member party made the first
 * member's gear unreachable by the arrow keys altogether.
 *
 * The raid bag's recipient list is the other: the panel above it is saying
 * which item is being given, and the cursor starts on the first recipient, so a
 * cursor that described them would take the item's name off the screen the
 * instant the list opened. Pointing at one is a question the player asked;
 * arrowing through them is the middle of an action they have already begun.
 */
export const POINTER_ONLY = 'data-describes-on="pointer"';

/** Whether the cursor landing on this element may change what is described. */
export function cursorMayDescribe(describesOn: string | undefined): boolean {
  return describesOn !== 'pointer';
}

/** What the pointer found where it landed. */
export interface PointerLanding {
  /** The key of the describable thing under it, or null for the gap between two. */
  readonly on: string | null;
  /**
   * Whether it is still inside a run of describable things - a list, the pack
   * grid. Crossing the gap between two rows lands on the list itself for a
   * frame, and a rule that read that as "on nothing" flickered the panel back
   * to the selection and out again on every row the pointer passed over.
   */
  readonly withinGroup: boolean;
}

/** What the pointer is on after it moves: the gap inside a list keeps the answer. */
export function previewAfterPointer(
  previous: string | null,
  landing: PointerLanding,
): string | null {
  if (landing.on !== null) {
    return landing.on;
  }
  return landing.withinGroup ? previous : null;
}

/** One describable thing, in the four lines every detail panel is made of. */
export interface DescribedThing {
  /** What kind of thing it is: the pocket it is in, "Party member". */
  readonly eyebrow: string;
  readonly name: string;
  /** What it is - the catalogue's own words, or a Pokemon's condition. */
  readonly description: string;
  /** The one fact the screen it is on exists to ask: squares, HP, can it learn this. */
  readonly note: string;
}

/**
 * A describe key is a kind and the thing's own id, so the same key can be
 * written on two elements that mean the same thing - a pocket row and the block
 * it occupies in the pack grid both say `item:potion`, and pointing at either
 * answers the same question and lights the other.
 */
export function describeKey(kind: string, id: string | number): string {
  return `${kind}:${id}`;
}

/** The kind and id back out of a describe key; the id may itself hold colons. */
export function splitDescribeKey(key: string): { kind: string; id: string } {
  const cut = key.indexOf(':');
  return cut < 0 ? { kind: key, id: '' } : { kind: key.slice(0, cut), id: key.slice(cut + 1) };
}
