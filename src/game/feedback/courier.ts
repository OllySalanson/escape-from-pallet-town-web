import {
  DAILY_FEEDBACK_LIMIT,
  countOneMore,
  sendsToday,
  startOfNextDay,
  type FeedbackNote,
} from './feedbackNote';
import type { FeedbackOutcome } from './feedbackWords';
import { readDailyCount, writeDailyCount, type FeedbackOutbox } from './outbox';

/**
 * Takes a message from the panel and gets it as far as it can go.
 *
 * The order is the promise the panel makes: a message is put in the pack
 * *first*, so whatever happens next - no internet, the server not switched on,
 * the tab closed mid-send - it is still there to go later. Only a message the
 * server has acknowledged is taken out again. Over the day's limit it is kept
 * with a "not before tomorrow" on it rather than refused.
 */
export interface FeedbackCourier {
  dispatch(note: Omit<FeedbackNote, 'notBefore'>, now: Date): Promise<FeedbackOutcome>;
}

/**
 * Sends one message to the server. Resolves true only when the server holds
 * it; anything else - offline, refused, not configured - is false, and the
 * message stays in the pack.
 */
export type FeedbackSender = (note: FeedbackNote) => Promise<boolean>;

export interface CourierParts {
  readonly outbox: FeedbackOutbox;
  readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined;
  /** Absent until the game has somewhere to send to: every message waits. */
  readonly send?: FeedbackSender;
}

export function createCourier(parts: CourierParts): FeedbackCourier {
  return {
    dispatch: async (draft, now) => {
      const counted = readDailyCount(parts.storage);
      const overLimit = sendsToday(counted, now) >= DAILY_FEEDBACK_LIMIT;
      const note: FeedbackNote = { ...draft, notBefore: overLimit ? startOfNextDay(now).toISOString() : null };
      await parts.outbox.keep(note);
      if (overLimit) {
        return 'held';
      }
      writeDailyCount(parts.storage, countOneMore(counted, now));
      if (!parts.send) {
        return 'queued';
      }
      const delivered = await parts.send(note).catch(() => false);
      if (!delivered) {
        return 'queued';
      }
      await parts.outbox.forget(note.tag);
      return 'sent';
    },
  };
}
