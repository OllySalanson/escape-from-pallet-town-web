import type { FeedbackContext } from './feedbackContext';
import type { LoggedAction } from './actionLog';

/**
 * One message from a player, exactly as it will travel.
 *
 * It is built the moment SEND is pressed and is never edited afterwards: the
 * outbox stores it whole, and the sender (a later stage) uploads it whole, so
 * what the player was shown under SEE IT ALL is what arrives.
 */
export interface FeedbackNote {
  /** `FB-XXXX`: what the player is told and can quote. Also the outbox key. */
  readonly tag: string;
  /** When SEND was pressed, ISO 8601. */
  readonly createdAt: string;
  readonly text: string;
  readonly context: FeedbackContext;
  readonly actions: readonly LoggedAction[];
  /** The game screen at the instant the tab was pressed, as a PNG, or null if removed. */
  readonly picture: Blob | null;
  /**
   * What the player said, one clip per TALK, in the browser's own recording
   * format. Empty when they only typed. Turned into text on the owner's PC.
   */
  readonly voice: readonly Blob[];
  /** How long the clips run between them, in milliseconds. */
  readonly voiceMs: number;
  /** The raw stored save, when the player left the tick on. */
  readonly save: string | null;
  /**
   * Not to be sent before this instant (ISO 8601). Set only on a message over
   * the daily limit, so it goes out the next day rather than being refused.
   */
  readonly notBefore: string | null;
  /**
   * Why the server refused this message for good, when it did: it is kept in
   * the pack, never lost, but never tried again or allowed to hold up the rest.
   */
  readonly refused?: string;
}

/** The most a message may say. The box will not take more. */
export const MAX_FEEDBACK_TEXT = 2000;

/**
 * How many messages one browser sends in a day before the rest wait for the
 * next one. The server enforces its own limit too; this one is the honest
 * answer the panel can give before it tries.
 */
export const DAILY_FEEDBACK_LIMIT = 5;

/** No 0/O or 1/I: a tag is read off a screen and typed back by a person. */
const TAG_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function feedbackTag(random: () => number = Math.random): string {
  let tag = 'FB-';
  for (let index = 0; index < 4; index += 1) {
    tag += TAG_ALPHABET[Math.floor(random() * TAG_ALPHABET.length) % TAG_ALPHABET.length];
  }
  return tag;
}

/** The local calendar day of an instant, as `YYYY-MM-DD`. */
export function localDay(at: Date): string {
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${at.getFullYear()}-${month}-${day}`;
}

/** The first instant of the local day after `at`. */
export function startOfNextDay(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1);
}

/** How many sends today's count already holds, from what was recorded. */
export function sendsToday(record: DailyCount | null, now: Date): number {
  return record && record.day === localDay(now) ? record.count : 0;
}

export interface DailyCount {
  readonly day: string;
  readonly count: number;
}

/** The count after one more send at `now`. */
export function countOneMore(record: DailyCount | null, now: Date): DailyCount {
  return { day: localDay(now), count: sendsToday(record, now) + 1 };
}

/** Whether a message has anything in it worth sending: words, or a recording. */
export function hasSomethingToSay(text: string, clips = 0): boolean {
  return text.trim().length > 0 || clips > 0;
}
