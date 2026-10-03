import type { SupabaseClient } from '@supabase/supabase-js';
import type { MapFile } from '../world/mapFile';
import { SUBMISSIONS_PUBLISHABLE_KEY, SUBMISSIONS_URL } from './submitConfig';

/**
 * Sending a map in, and asking what became of it.
 *
 * A maker has no account. The first time they send a map the game signs this
 * browser in as an anonymous Supabase user - behind the bot check, when the
 * project asks for one - and keeps that session, so every map sent from here
 * is theirs and only theirs to ask after. What the database lets that user do
 * is the whole of the security: call `submit_map` and `my_submissions`, and
 * nothing else (`supabase/migrations/`).
 *
 * The client is loaded on first use, so the game everyone else plays never
 * downloads it.
 */

export type SubmissionStatus = 'waiting' | 'sent_back' | 'approved' | 'rejected' | 'published';

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

interface SentRow {
  readonly receipt_code: string;
  readonly map_name: string;
  readonly status: SubmissionStatus;
  readonly owner_note: string | null;
  readonly revision: number;
  readonly created_at: string;
  readonly updated_at: string;
}

/** The two calls a maker's browser can make, as the database declares them (`supabase/migrations/`). */
interface MakerDatabase {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      submit_map: {
        Args: { map: unknown; maker_name: string; resubmits: string | null };
        Returns: string;
      };
      my_submissions: { Args: Record<PropertyKey, never>; Returns: SentRow[] };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

let client: Promise<SupabaseClient<MakerDatabase>> | undefined;

function supabase(): Promise<SupabaseClient<MakerDatabase>> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient<MakerDatabase>(SUBMISSIONS_URL, SUBMISSIONS_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'escape-from-pallet-town.maker.session',
      },
    }),
  );
  return client;
}

/** The reasons the database gives, said as they are; anything else said plainly. */
const DATABASE_REASONS = [
  'Sign in before sending a map.',
  'This maker cannot send maps.',
  'You can send three maps a day. Try again tomorrow.',
  'The inbox is full for today. Try again tomorrow.',
  'That is not a map file, or it is too big.',
  'The map is not in a format this game reads.',
  'The map needs a name of at most 24 letters.',
  'The maker needs a name of at most 24 letters.',
  'The map has no ground.',
  "The map's ground is not the size it says.",
  'Only a map sent back to you can be sent again.',
];

/** What a failure says to a maker. */
export function reasonFor(error: { readonly message?: string } | null | undefined): string {
  const message = error?.message ?? '';
  const known = DATABASE_REASONS.find((reason) => message.includes(reason));
  if (known) {
    return known;
  }
  if (/anonymous sign-?ins are disabled/i.test(message)) {
    return 'Sending maps is not switched on yet. Your map is safe in your drafts.';
  }
  if (/captcha/i.test(message)) {
    return 'The bot check did not pass. Try again.';
  }
  return 'The map could not be sent. Check your connection and try again; your map is safe in your drafts.';
}

/** Whether this browser already has a maker's session, so no bot check is needed. */
export async function isSignedIn(): Promise<boolean> {
  const { data } = await (await supabase()).auth.getSession();
  return data.session !== null;
}

/** Signs this browser in as an anonymous maker, once. */
async function signIn(captchaToken: string | undefined): Promise<Outcome<true>> {
  const db = await supabase();
  const { data } = await db.auth.getSession();
  if (data.session) {
    return { ok: true, value: true };
  }
  const { error } = await db.auth.signInAnonymously(
    captchaToken ? { options: { captchaToken } } : undefined,
  );
  return error ? { ok: false, reason: reasonFor(error) } : { ok: true, value: true };
}

/**
 * Sends a map in. Resolves with its receipt code. `resubmits` is the receipt
 * of a map that was sent back, when this is the next version of it.
 */
export async function sendMap(
  file: MapFile,
  options: { readonly captchaToken?: string; readonly resubmits?: string } = {},
): Promise<Outcome<string>> {
  try {
    const signedIn = await signIn(options.captchaToken);
    if (!signedIn.ok) {
      return signedIn;
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
