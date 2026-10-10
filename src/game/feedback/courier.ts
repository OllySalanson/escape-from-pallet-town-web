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
  /**
   * Tries again with everything still in the pack that is due, oldest first,
   * and stops at the first that cannot go now - offline is offline for all of
   * them. A message the server refused for good is set aside with its reason
   * and passed over, so it never stands in front of the rest. Resolves how
   * many went. One flush at a time: a second call while one runs shares it.
   */
  flush(now: Date): Promise<number>;
}

/**
 * What became of one try at sending: the server holds it; it could not go
 * now (offline, the day's limits, not signed in) and will go later; or the
 * server refused it in a way that will never change, so trying again would
 * only stop every message behind it (the security review's L1).
 */
export type Delivery = 'sent' | 'later' | { readonly refused: string };

/** Sends one message to the server. A throw is the same as `later`. */
export type FeedbackSender = (note: FeedbackNote) => Promise<Delivery>;

export interface CourierParts {
  readonly outbox: FeedbackOutbox;
  readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined;
  /** Absent until the game has somewhere to send to: every message waits. */
  readonly send?: FeedbackSender;
}

export function createCourier(parts: CourierParts): FeedbackCourier {
  let flushing: Promise<number> | null = null;
  const flushNow = async (now: Date): Promise<number> => {
    if (!parts.send) {
      return 0;
    }
    let sent = 0;
    for (const note of await parts.outbox.waiting()) {
      if (note.refused || (note.notBefore && Date.parse(note.notBefore) > now.getTime())) {
        continue;
      }
      const delivery = await tryToSend(note);
      if (delivery === 'later') {
        break;
      }
      if (delivery === 'sent') {
        sent += 1;
      }
    }
    return sent;
  };
  /** One try, and what it means for the pack: gone, kept, or set aside. */
  const tryToSend = async (note: FeedbackNote): Promise<'sent' | 'later' | 'refused'> => {
    const delivery = await parts.send!(note).catch((): Delivery => 'later');
    if (delivery === 'sent') {
      await parts.outbox.forget(note.tag);
      return 'sent';
    }
    if (delivery === 'later') {
      return 'later';
    }
    await parts.outbox.keep({ ...note, refused: delivery.refused });
    return 'refused';
  };
  return {
    flush: (now) => {
      flushing ??= flushNow(now).finally(() => {
        flushing = null;
      });
      return flushing;
    },
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
      const delivery = await tryToSend(note);
      return delivery === 'later' ? 'queued' : delivery;
    },
  };
}
