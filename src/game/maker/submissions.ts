import { MAP_FILE_LIMITS, type MapFile } from '../world/mapFile';
import { currentPlayer, signInAsPlayer, troubleOf, type SignInTrouble } from './playerSignIn';
import { supabase, type SubmissionStatus } from './supabaseClient';

export type { SubmissionStatus } from './supabaseClient';

/**
 * Sending a map in, and asking what became of it.
 *
 * A maker has no account. The first time they send a map the game signs this
 * browser in as an anonymous Supabase user, behind the bot check
 * (`playerSignIn.ts`), and keeps that session, so every map sent from here
 * is theirs and only theirs to ask after. What the database lets that user do
 * is the whole of the security: call `submit_map` and `my_submissions`, and
 * nothing else (`supabase/migrations/`).
 *
 * The client is loaded on first use, so the game everyone else plays never
 * downloads it.
 */

/**
 * The biggest map the inbox takes, in tiles each way: everything the maker
 * draws (`MAP_FILE_LIMITS`), which `submit_map` holds too
 * (`supabase/migrations/`, kept in step by `submissionLimits.test.ts`). It was
 * 128 until the inbox caught up with the maker's 256.
 */
export const SENDABLE_MAP_SIZE = Math.min(MAP_FILE_LIMITS.maxWidth, MAP_FILE_LIMITS.maxHeight);

/** Why a map cannot be sent in as it is, if it cannot. */
export function sendRefusal(file: MapFile): string | undefined {
  return file.width > SENDABLE_MAP_SIZE || file.height > SENDABLE_MAP_SIZE
    ? `Maps bigger than ${SENDABLE_MAP_SIZE}x${SENDABLE_MAP_SIZE} cannot be sent in yet. This one is ${file.width}x${file.height}.`
    : undefined;
}

export interface SentMap {
  readonly receiptCode: string;
  readonly mapName: string;
  readonly status: SubmissionStatus;
  /** What the reviewer wrote: why it was sent back or turned down. */
  readonly note: string | null;
  readonly revision: number;
  readonly sentAt: string;
  readonly updatedAt: string;
}

export type Outcome<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

/** The reasons the database gives, said as they are; anything else said plainly. */
const DATABASE_REASONS = [
  'Sign in before sending a map.',
  'This maker cannot send maps.',
  'You can send three maps a day. Try again tomorrow.',
  'The inbox is full for today. Try again tomorrow.',
  'That is not a map file, or it is too big.',
  'The map is not in a format this game reads.',
  'The map needs a name of at most 24 letters.',
  'Names in a map may not use < > & or ".',
  'The maker needs a name of at most 24 letters.',
  'The map has no ground.',
  "The map's ground is not the size it says.",
  'Only a map sent back to you can be sent again.',
  'Only a map sent back to you, or one of yours in the game, can be sent again.',
];

/** What a failure says to a maker. */
export function reasonFor(error: { readonly message?: string } | null | undefined): string {
  const message = error?.message ?? '';
  const known = DATABASE_REASONS.find((reason) => message.includes(reason));
  if (known) {
    return known;
  }
  return signInReason(troubleOf(error));
}

/** Whether this browser already has a maker's session, so sending draws no bot check. */
export async function isSignedIn(): Promise<boolean> {
  return (await currentPlayer()) !== null;
}

/**
 * What a maker is told when this browser could not sign in to send, said in
 * the maker's own plain voice and always ending on the promise that matters:
 * the map is still in the drafts, and TRY AGAIN is right there.
 */
export function signInReason(trouble: SignInTrouble): string {
  switch (trouble) {
    case 'unavailable':
      return 'The bot check would not load, so the map was not sent. Check your connection or any blocker, then press Try again; your map is safe in your drafts.';
    case 'failed':
      return 'The bot check did not pass, so the map was not sent. Press Try again; your map is safe in your drafts.';
    case 'refused':
      return 'Sending maps is not switched on yet. Your map is safe in your drafts.';
    case 'busy':
      return 'Too many players have signed in from this connection lately. Try again in an hour; your map is safe in your drafts.';
    case 'offline':
      return 'The map could not be sent. Check your connection and try again; your map is safe in your drafts.';
  }
}

/**
 * Sends a map in. Resolves with its receipt code. `resubmits` is the receipt
 * of a map that was sent back, or of one of the maker's maps that is in the
 * game, when this is the next version of it: a next version of a map in the
 * game replaces it there once it is approved.
 */
export async function sendMap(
  file: MapFile,
  options: { readonly resubmits?: string } = {},
): Promise<Outcome<string>> {
  try {
    const signedIn = await signInAsPlayer();
    if (!signedIn.ok) {
      return { ok: false, reason: signInReason(signedIn.trouble) };
    }
    const db = await supabase();
    const { data, error } = await db.rpc('submit_map', {
      map: file,
      maker_name: file.maker,
      resubmits: options.resubmits ?? null,
    });
    if (error || typeof data !== 'string') {
      return { ok: false, reason: reasonFor(error) };
    }
    return { ok: true, value: data };
  } catch (error) {
    return { ok: false, reason: reasonFor(error as { message?: string }) };
  }
}

/** Every map this browser has sent, newest first. None before the first is sent. */
export async function sentMaps(): Promise<Outcome<readonly SentMap[]>> {
  try {
    if (!(await isSignedIn())) {
      return { ok: true, value: [] };
    }
    const { data, error } = await (await supabase()).rpc('my_submissions');
    if (error || !Array.isArray(data)) {
      return { ok: false, reason: 'What became of your maps could not be fetched. Try again.' };
    }
    return {
      ok: true,
      value: data.map((row) => ({
        receiptCode: row.receipt_code,
        mapName: row.map_name,
        status: row.status,
        note: row.owner_note,
        revision: row.revision,
        sentAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    };
  } catch {
    return { ok: false, reason: 'What became of your maps could not be fetched. Try again.' };
  }
}

/** A status as a maker reads it. */
export const STATUS_WORDS: Readonly<Record<SubmissionStatus, string>> = {
  waiting: 'Waiting to be played',
  sent_back: 'Sent back with notes',
  approved: 'Approved',
  rejected: 'Turned down',
  published: 'In the game',
};
