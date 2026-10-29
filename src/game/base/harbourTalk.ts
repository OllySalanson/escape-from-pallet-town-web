import { PhraseBoard, type HarbourPhraseId } from '../harbour/harbourPhrases';

/**
 * This browser's own side of the harbour's quick phrases (`harbour/harbourPhrases.ts`):
 * what this player is saying, and what the harbour's regulars say back.
 *
 * The regulars (`harbourBots.ts`) are never on the wire, so what one says is
 * said on this screen only - as everything about them is. Now and then the one
 * nearest a player who says something answers with a phrase of their own, a
 * breath later, which is what makes a quiet harbour feel lived in. They answer
 * only from the list, as everybody does, and are paced as everybody is.
 *
 * Kept for the page's life, because the base scene is started again for every
 * door walked through and a phrase said on a doorstep should still be up on
 * the other side of it - and pacing that reset at every door would be no pace.
 * Phaser-free, and handed its clock and its dice, so it is tested frame by frame.
 */

/** Who this player is on the board: not a player id, so it can never be anybody heard. */
export const OWN_SPEAKER = 'self';

/** How likely a regular is to answer a phrase said near them. */
export const REGULAR_ANSWER_CHANCE = 0.5;

/** How near, in steps, a regular has to be to answer. */
export const REGULAR_ANSWERS_WITHIN = 5;

/** How long a regular takes to answer: somewhere between these. */
export const REGULAR_ANSWER_AFTER_MS = [700, 1_500] as const;

/**
 * What a regular may say back to each phrase: one of these, or nothing. A
 * goodbye is waved off, an invitation taken up or put off, a compliment
 * thanked for - the answers a stranger on a quay would give.
 */
export const REGULAR_ANSWERS: Readonly<Record<HarbourPhraseId, readonly HarbourPhraseId[]>> = {
  hello: ['hello'],
  raid: ['lets-go', 'later'],
  'lets-go': ['luck'],
  later: ['bye'],
  outfit: ['thanks'],
  pokemon: ['thanks'],
  follow: ['lets-go', 'later'],
  luck: ['thanks'],
  gg: ['gg'],
  thanks: [],
  laugh: ['laugh'],
  bye: ['bye'],
};

/** A regular standing near enough to hear, and how many steps away. */
export interface Listener {
  readonly id: string;
  readonly steps: number;
}

export class HarbourTalk {
  private readonly board = new PhraseBoard();
  private pending: { readonly from: string; readonly phrase: HarbourPhraseId; readonly at: number }[] = [];

  /** This player says a phrase: up in their bubble unless they are talking too fast. Returns whether it was said. */
  public say(phrase: HarbourPhraseId, now: number): boolean {
    return this.board.hear(OWN_SPEAKER, phrase, now);
  }

  /**
   * This player said `phrase` with these regulars near: maybe the nearest
   * answers. `roll` is a number in [0, 1), asked twice - whether, and which
   * answer and how soon - so a test chooses what happens.
   */
  public answer(phrase: HarbourPhraseId, now: number, listeners: readonly Listener[], roll: () => number): void {
    const answers = REGULAR_ANSWERS[phrase];
    const nearest = [...listeners]
      .filter((listener) => listener.steps <= REGULAR_ANSWERS_WITHIN)
      .sort((a, b) => a.steps - b.steps)[0];
    if (!nearest || answers.length === 0 || this.pending.some((answer) => answer.from === nearest.id)) {
      return;
    }
    if (roll() >= REGULAR_ANSWER_CHANCE) {
      return;
    }
    const pick = roll();
    const [soonest, latest] = REGULAR_ANSWER_AFTER_MS;
    this.pending.push({
      from: nearest.id,
      phrase: answers[Math.floor(pick * answers.length)],
      at: now + soonest + Math.floor(pick * (latest - soonest)),
    });
  }

  /** One frame: any answer due is said. */
  public tick(now: number): void {
    const due = this.pending.filter((answer) => answer.at <= now);
    if (due.length === 0) {
      return;
    }
    this.pending = this.pending.filter((answer) => answer.at > now);
    for (const answer of due) {
      this.board.hear(answer.from, answer.phrase, now);
    }
  }

  /** The words somebody on this screen - this player, or a regular - is saying now, if any. */
  public saying(id: string, now: number): string | null {
    return this.board.saying(id, now);
  }
}

let talk: HarbourTalk | null = null;

/** The page's one `HarbourTalk`. */
export function harbourTalk(): HarbourTalk {
  talk ??= new HarbourTalk();
  return talk;
}
