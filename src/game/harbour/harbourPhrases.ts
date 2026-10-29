/**
 * Talking in THE HARBOUR (the captain, 29 Oct): a dozen quick phrases and no
 * typed chat, as a raid room talks (`raidRoom/roomTalk.ts`).
 *
 * The harbour is public, and the strangers in it may be children, so nobody
 * types a word: a phrase is an id into this fixed list, said in a speech bubble
 * over its speaker on every screen in the place. A message whose id is not on
 * the list is not a message, so there is nothing to filter and nothing to
 * moderate. Ids rather than numbers, because two browsers on two builds may
 * hold the list in different orders - an id a build does not know is dropped,
 * never shown as some other phrase.
 *
 * Talk is paced at both ends (`PhrasePace`): a browser says at most one phrase
 * every `SAY_EVERY_MS` and `SAY_BURST` in `SAY_BURST_MS`, and a browser that
 * hears faster than that from somebody drops the extra - so a bubble cannot be
 * spammed, even by a browser that ignores its own pacing.
 *
 * Phaser-free; `BaseScene` and `base/harbourFigures.ts` draw it.
 */

export const HARBOUR_PHRASES = [
  { id: 'hello', words: 'HELLO!' },
  { id: 'raid', words: 'WANT TO RAID?' },
  { id: 'lets-go', words: "LET'S GO!" },
  { id: 'later', words: 'MAYBE LATER!' },
  { id: 'outfit', words: 'NICE OUTFIT!' },
  { id: 'pokemon', words: 'CUTE POKéMON!' },
  { id: 'follow', words: 'FOLLOW ME!' },
  { id: 'luck', words: 'GOOD LUCK!' },
  { id: 'gg', words: 'GG!' },
  { id: 'thanks', words: 'THANKS!' },
  { id: 'laugh', words: 'HA HA!' },
  { id: 'bye', words: 'SEE YOU AROUND!' },
] as const;

export type HarbourPhraseId = (typeof HARBOUR_PHRASES)[number]['id'];

/** The least time between two phrases from one player, said or heard. */
export const SAY_EVERY_MS = 2_000;

/** At most this many phrases from one player in `SAY_BURST_MS`, said or heard. */
export const SAY_BURST = 4;
export const SAY_BURST_MS = 20_000;

/** How long a phrase stays in its bubble. */
export const PHRASE_SHOWN_MS = 4_000;

/** Whether something heard is one of the phrases - and so may be shown. */
export function isHarbourPhraseId(value: unknown): value is HarbourPhraseId {
  return typeof value === 'string' && HARBOUR_PHRASES.some((phrase) => phrase.id === value);
}

/** What a phrase says. */
export function phraseWords(id: HarbourPhraseId): string {
  return HARBOUR_PHRASES.find((phrase) => phrase.id === id)!.words;
}

/**
 * How fast each speaker may talk: one phrase every `SAY_EVERY_MS`, and no more
 * than `SAY_BURST` in any `SAY_BURST_MS`. Asked of a phrase about to be said
 * and of one heard, so both ends hold the same line.
 */
export class PhrasePace {
  private readonly said = new Map<string, number[]>();

  /** Takes one phrase from `from` at `now`, unless they are talking too fast. Returns whether it was taken. */
  public allow(from: string, now: number): boolean {
    const recent = (this.said.get(from) ?? []).filter((at) => now - at < SAY_BURST_MS);
    const last = recent.at(-1);
    if ((last !== undefined && now - last < SAY_EVERY_MS) || recent.length >= SAY_BURST) {
      this.said.set(from, recent);
      return false;
    }
    recent.push(now);
    this.said.set(from, recent);
    return true;
  }
}

/** What each speaker in one browser's harbour is saying, and since when. */
export class PhraseBoard {
  private readonly pace = new PhrasePace();
  private readonly phrases = new Map<string, { readonly phrase: HarbourPhraseId; readonly at: number }>();

  /** Somebody said a phrase: taken unless they are talking faster than the harbour allows. Returns whether it was. */
  public hear(from: string, phrase: HarbourPhraseId, now: number): boolean {
    if (!this.pace.allow(from, now)) {
      return false;
    }
    this.phrases.set(from, { phrase, at: now });
    return true;
  }

  /** The words somebody is saying now, if any. */
  public saying(from: string, now: number): string | null {
    const said = this.phrases.get(from);
    return said && now - said.at < PHRASE_SHOWN_MS ? phraseWords(said.phrase) : null;
  }

  /** The phrase somebody is saying now, if any. */
  public phraseOf(from: string, now: number): HarbourPhraseId | null {
    const said = this.phrases.get(from);
    return said && now - said.at < PHRASE_SHOWN_MS ? said.phrase : null;
  }

  /**
   * Somebody left: what they said goes with them. Their pace stays, so leaving
   * and coming straight back is no way round it.
   */
  public forget(from: string): void {
    this.phrases.delete(from);
  }
}
