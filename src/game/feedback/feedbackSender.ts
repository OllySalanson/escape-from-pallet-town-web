import { currentPlayer, signInAsPlayer } from '../maker/playerSignIn';
import { supabase } from '../maker/supabaseClient';
import { botCheckNeeded } from '../maker/turnstile';
import type { Delivery, FeedbackSender } from './courier';

/**
 * Sends one message to the lab: the game's own Supabase project, the one the
 * map maker sends maps to (`maker/submitConfig.ts`).
 *
 * The browser signs in as an anonymous visitor - no account, just a private id
 * - and what the database lets that id do is the whole of the security
 * (`supabase/migrations/*_player_feedback.sql`): upload files into its own
 * folder of a private bucket and call `submit_feedback`, and nothing else; it
 * can never read a message back, its own included. Every file is asked for
 * by name first (`reserve_feedback_uploads`): the bucket takes a file only
 * under a name the database handed out, counted under a lock, so a burst of
 * uploads at once cannot get past the day's limit (red team F7).
 *
 * A failure that clears up by itself - offline, the day's limit, a bot check
 * this browser has not passed - is `later`, and the message stays in the pack
 * for the next try; one that never will is `refused` with the reason
 * (`uploadDelivery`, `callDelivery`), and the pack carries on past it. A
 * retry is safe: a file already uploaded is not uploaded twice, and the
 * database answers a message it already holds by its tag rather than storing
 * it again.
 *
 * The client is the map maker's, loaded on first use, so a player who never
 * sends anything never downloads it.
 */
export const sendToTheLab: FeedbackSender = async (note) => {
  const db = await supabase();
  const uid = await signedInAs();
  if (!uid) {
    return 'later';
  }
  const folder = `${uid}/${note.tag}`;
  const files: { path: string; body: Blob; type: string }[] = [];
  if (note.picture) {
    files.push({ path: `${folder}/picture.png`, body: note.picture, type: 'image/png' });
  }
  const voicePaths = note.voice.map((clip, index) => {
    const type = baseType(clip.type);
    const path = `${folder}/voice-${index + 1}.${extensionFor(type)}`;
    files.push({ path, body: clip, type });
    return path;
  });
  if (files.length > 0) {
    const { error } = await db.rpc('reserve_feedback_uploads', { tag: note.tag, names: files.map((file) => file.path) });
    if (error) {
      return callDelivery(error);
    }
  }
  for (const file of files) {
    const { error } = await db.storage.from('feedback').upload(file.path, file.body, { contentType: file.type, upsert: false });
    if (error && !alreadyThere(error)) {
      return uploadDelivery(error);
    }
  }
  const { error } = await db.rpc('submit_feedback', {
    tag: note.tag,
    message: note.text,
    context: note.context,
    actions: note.actions,
    save: note.save,
    picture_path: note.picture ? `${folder}/picture.png` : null,
    voice_paths: voicePaths,
    voice_ms: Math.round(note.voiceMs),
    written_at: note.createdAt,
  });
  return error ? callDelivery(error) : 'sent';
};

/**
 * What a refused upload means. Too big or the wrong type is the file, and the
 * file will not change; anything else - the day's 60 uploads, the network -
 * is worth trying again.
 */
export function uploadDelivery(error: { message?: string; statusCode?: string | number }): Delivery {
  const status = String(error.statusCode ?? '');
  return status === '413' || status === '415' ? { refused: error.message ?? `upload refused (${status})` } : 'later';
}

/**
 * What a refused `submit_feedback` means, by its SQLSTATE: a message the
 * database finds the wrong shape (22023, 22P02, 23514), too long (22001) or
 * from a player it will not hear from (42501) will be refused every time; the
 * day's limits (54000), not being signed in (28000) and anything unknown
 * clear up by themselves.
 */
export function callDelivery(error: { message?: string; code?: string }): Delivery {
  return ['22023', '22P02', '23514', '22001', '42501'].includes(error.code ?? '')
    ? { refused: error.message ?? `refused (${error.code})` }
    : 'later';
}

/**
 * This browser's anonymous id, if it can be had without asking the player
 * anything. A build that draws the bot check never signs in from here: the
 * pack is sent in the background, where nobody is looking at a check, so a
 * message waits until its sender has signed in - which the panel's SEND does
 * (`maker/playerSignIn.ts`), as the map maker's SEND and a console score do.
 */
export async function signedInAs(): Promise<string | null> {
  const uid = await currentPlayer();
  if (uid || botCheckNeeded()) {
    return uid;
  }
  const signedIn = await signInAsPlayer();
  return signedIn.ok ? signedIn.uid : null;
}

/** `audio/webm;codecs=opus` is stored as `audio/webm`: the bucket allows types, not codecs. */
export function baseType(type: string): string {
  return (type.split(';')[0] ?? '').trim() || 'audio/webm';
}

export function extensionFor(type: string): string {
  switch (baseType(type)) {
    case 'audio/ogg':
      return 'ogg';
    case 'audio/mp4':
      return 'm4a';
    default:
      return 'webm';
  }
}

/** A file uploaded on an earlier try that never heard back. */
function alreadyThere(error: { message?: string; statusCode?: string | number }): boolean {
  return /already exists|duplicate/i.test(error.message ?? '') || String(error.statusCode ?? '') === '409';
}
