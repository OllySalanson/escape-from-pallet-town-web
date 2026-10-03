import { readMapFile, type MapFile } from '../world/mapFile';
import type { Outcome } from './submissions';
import { SUBMISSIONS_PUBLISHABLE_KEY, SUBMISSIONS_URL } from './submitConfig';
import { supabase, type SubmissionRow, type SubmissionStatus } from './supabaseClient';

/**
 * Reviewing the maps players send in: the owner's side of the inbox.
 *
 * The reviewer signs in with GitHub. Who may review is the database's call,
 * not the game's: an `admins` row, which the database grants the owner's own
 * GitHub account when it first signs in (`supabase/migrations/`), and without
 * which row-level security shows the queue as empty and refuses every
 * decision. The game only asks; nothing here could make anyone a reviewer.
 */

export interface QueuedMap {
  readonly id: string;
  readonly receiptCode: string;
  readonly makerUid: string;
  readonly makerName: string;
  readonly mapName: string;
  readonly status: SubmissionStatus;
  readonly note: string | null;
  readonly revision: number;
  readonly sentAt: string;
  /** The map as sent, if it still reads as one. */
  readonly file: MapFile | undefined;
}

export type ReviewDecision = 'approved' | 'sent_back' | 'rejected';

/** Where GitHub sends the reviewer back to: this page, marked to open the review list. */
export function reviewReturnUrl(href: string = window.location.href): string {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('review', '1');
  return url.toString();
}

/** Whether this page was opened by GitHub sending a reviewer back. */
export function isReviewReturn(search: string = window.location.search): boolean {
  return new URLSearchParams(search).has('review');
}

/**
 * Finishes a GitHub sign-in the page came back from: the client trades the code
 * in the address for a session as it starts, and the address is put back as it
 * was, so a reload does not try to spend the code twice.
 */
export async function finishReviewSignIn(): Promise<void> {
  const db = await supabase();
  await db.auth.getSession();
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('review');
  window.history.replaceState(null, '', url.toString());
}

/**
 * Whether the project lets anyone sign in with GitHub at all. Asked before the
 * browser is sent away, because a provider that is switched off answers the
 * redirect with an error page and no way back into the game.
 */
async function gitHubSignInIsOn(): Promise<boolean> {
  try {
    const response = await fetch(`${SUBMISSIONS_URL}/auth/v1/settings`, {
      headers: { apikey: SUBMISSIONS_PUBLISHABLE_KEY },
    });
    const settings = (await response.json()) as { external?: { github?: boolean } };
    return settings.external?.github === true;
  } catch {
    return false;
  }
}

/** Sends the browser to GitHub to sign in, coming back to the review list. */
export async function signInToReview(): Promise<Outcome<true>> {
  if (!(await gitHubSignInIsOn())) {
    return { ok: false, reason: 'GitHub sign-in is not switched on yet.' };
  }
  const db = await supabase();
  const { error } = await db.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: reviewReturnUrl() },
  });
  return error
    ? { ok: false, reason: 'GitHub sign-in is not switched on yet.' }
    : { ok: true, value: true };
}

export async function signOutOfReview(): Promise<void> {
  await (await supabase()).auth.signOut();
}

/**
 * Whether whoever is signed in here may review: nobody (or only a maker's
 * anonymous session), somebody the database does not count as a reviewer, or
 * a reviewer. The database answers the last part.
 */
export async function reviewAccess(): Promise<'signed-out' | 'not-reviewer' | 'reviewer'> {
  try {
    const db = await supabase();
    const { data } = await db.auth.getSession();
    if (!data.session || data.session.user.is_anonymous) {
      return 'signed-out';
    }
    const { data: admin } = await db.rpc('is_admin');
    return admin === true ? 'reviewer' : 'not-reviewer';
  } catch {
    return 'signed-out';
  }
}

function queued(row: SubmissionRow): QueuedMap {
  const reading = readMapFile(row.map, { draft: true });
  return {
    id: row.id,
    receiptCode: row.receipt_code,
    makerUid: row.maker_uid,
    makerName: row.maker_name,
    mapName: row.map_name,
    status: row.status,
    note: row.owner_note,
    revision: row.revision,
    sentAt: row.created_at,
    file: reading.ok ? reading.file : undefined,
  };
}

/** The order the queue is read in: what is waiting first, oldest first, then everything decided, newest first. */
export function queueOrder(a: QueuedMap, b: QueuedMap): number {
  const waiting = (map: QueuedMap): number => (map.status === 'waiting' ? 0 : 1);
  return (
    waiting(a) - waiting(b) ||
    (a.status === 'waiting' ? a.sentAt.localeCompare(b.sentAt) : b.sentAt.localeCompare(a.sentAt))
  );
}

/** Every map sent in, newest decisions last; empty for anyone but a reviewer. */
export async function reviewQueue(): Promise<Outcome<readonly QueuedMap[]>> {
  try {
    const { data, error } = await (
      await supabase()
    )
      .from('map_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      return { ok: false, reason: 'The maps sent in could not be fetched. Try again.' };
    }
    return { ok: true, value: data.map(queued).sort(queueOrder) };
  } catch {
    return { ok: false, reason: 'The maps sent in could not be fetched. Try again.' };
  }
}

/**
 * Decides a map. A note is required to send one back or turn one down, because
 * its maker reads it; approving takes the map as it now stands, so a reviewer
 * who fixed something approves the fixed version.
 */
export async function decide(
  id: string,
  decision: ReviewDecision,
  note: string,
  file?: MapFile,
): Promise<Outcome<true>> {
  const trimmed = note.trim();
  if (decision !== 'approved' && trimmed.length === 0) {
    return { ok: false, reason: 'Say why, so its maker knows what to change.' };
  }
  try {
    const { error } = await (
      await supabase()
    )
      .from('map_submissions')
      .update({
        status: decision,
        owner_note: trimmed.length > 0 ? trimmed.slice(0, 2000) : null,
        ...(file ? { map: file, map_name: file.name } : {}),
      })
      .eq('id', id);
    return error
      ? { ok: false, reason: 'The decision could not be saved. Try again.' }
      : { ok: true, value: true };
  } catch {
    return { ok: false, reason: 'The decision could not be saved. Try again.' };
  }
}

/** Stops a maker sending any more maps. */
export async function blockMaker(makerUid: string, reason: string): Promise<Outcome<true>> {
  try {
    const { error } = await (
      await supabase()
    )
      .from('blocked_makers')
      .insert({ maker_uid: makerUid, reason: reason.trim() || null });
    return error
      ? { ok: false, reason: 'The maker could not be blocked. Try again.' }
      : { ok: true, value: true };
  } catch {
    return { ok: false, reason: 'The maker could not be blocked. Try again.' };
  }
}
