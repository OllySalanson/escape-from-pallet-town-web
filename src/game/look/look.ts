/**
 * What the player is wearing: a head (a hat or hair), a top and a pair of
 * trousers, or a head over a whole outfit. It is a list of catalogue ids
 * (`wearables.ts`) and nothing else, so a save, a harbour message and the
 * wardrobe all carry the same small thing, and everything drawn from it is
 * derived (`composeLook.ts`).
 *
 * The **classic** look is the figure the game has always drawn the player as
 * (`character.png`), and it is the look every save starts in and every save
 * written before the boutique reads as. It is not made of pieces - it is its
 * own drawing - so it is spelt as no pieces at all, and the first thing worn
 * from the boutique trades it for a whole FireRed figure.
 */
import { slotOf, STARTER_WEARABLES, wearableById, type Wearable } from './wearables';

export interface DressedLook {
  readonly head: string;
  readonly top: string;
  readonly legs: string;
  /** A whole outfit, worn over (and instead of) the top and the trousers. */
  readonly body: string | null;
}

export type PlayerLook = DressedLook | null;

/** The look the game has always drawn the player in. */
export const CLASSIC_LOOK: PlayerLook = null;

/** What the boutique dresses somebody in classic before they choose: the starter pieces. */
export const STARTER_LOOK: DressedLook = {
  head: 'short-crop',
  top: 'plain-tee',
  legs: 'plain-trousers',
  body: null,
};

export type LookSlot = keyof DressedLook;

export const LOOK_SLOTS: readonly LookSlot[] = ['head', 'top', 'legs', 'body'];

/** The slot a catalogue piece fills. */
export function lookSlotOf(wearable: Wearable): LookSlot {
  return slotOf(wearable);
}

/**
 * Reads a look from anything - a save, a harbour message - believing only ids
 * the catalogue knows, each in the slot it is worn in. Anything that is not a
 * whole look reads as classic, so a stranger's message can never draw half a
 * figure.
 */
export function readLook(value: unknown): PlayerLook {
  if (!value || typeof value !== 'object') {
    return CLASSIC_LOOK;
  }
  const record = value as Record<string, unknown>;
  const pick = (slot: LookSlot): string | null => {
    const id = record[slot];
    if (typeof id !== 'string') return null;
    const wearable = wearableById(id);
    return wearable && lookSlotOf(wearable) === slot ? wearable.id : null;
  };
  const head = pick('head');
  const top = pick('top');
  const legs = pick('legs');
  if (!head || !top || !legs) {
    return CLASSIC_LOOK;
  }
  return { head, top, legs, body: pick('body') };
}

/** The look with one piece put on, in the slot it is worn in. */
export function wearing(look: PlayerLook, wearableId: string): PlayerLook {
  const wearable = wearableById(wearableId);
  if (!wearable) {
    return look;
  }
  const slot = lookSlotOf(wearable);
  return { ...(look ?? STARTER_LOOK), [slot]: wearable.id };
}

/** The look with its outfit taken off, back to the top and trousers under it. */
export function withoutOutfit(look: PlayerLook): PlayerLook {
  return look ? { ...look, body: null } : look;
}

/** The catalogue ids a look is wearing, in the order they are drawn. */
export function wornIds(look: PlayerLook): readonly string[] {
  if (!look) {
    return [];
  }
  return look.body ? [look.body, look.head] : [look.legs, look.top, look.head];
}

/** Every catalogue id a look holds, drawn or under an outfit. */
export function lookIds(look: PlayerLook): readonly string[] {
  return look ? [look.head, look.top, look.legs, ...(look.body ? [look.body] : [])] : [];
}

/** One string that names a look, for a texture key or a comparison. */
export function lookKey(look: PlayerLook): string {
  return look ? `${look.head}+${look.top}+${look.legs}+${look.body ?? '-'}` : 'classic';
}

export function sameLook(a: PlayerLook, b: PlayerLook): boolean {
  return lookKey(a) === lookKey(b);
}

/**
 * Whether a save may wear a look: every piece in it owned. The classic look and
 * the starter pieces are everybody's.
 */
export function canWear(look: PlayerLook, owned: ReadonlySet<string>): boolean {
  return lookIds(look).every((id) => owned.has(id) || STARTER_WEARABLES.includes(id));
}
