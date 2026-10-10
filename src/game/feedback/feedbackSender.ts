import { supabase } from '../maker/supabaseClient';
import { botCheckNeeded } from '../maker/turnstile';
import type { FeedbackSender } from './courier';

/**
 * Sends one message to the lab: the game's own Supabase project, the one the
 * map maker sends maps to (`maker/submitConfig.ts`).
 *
 * The browser signs in as an anonymous visitor - no account, just a private id
 * - and what the database lets that id do is the whole of the security
 * (`supabase/migrations/*_player_feedback.sql`): upload files into its own
 * folder of a private bucket and call `submit_feedback`, and nothing else; it
 * can never read a message back, its own included.
 *
 * Every failure is a quiet `false` - offline, anonymous sign-in not switched on
 * in the project yet, the day's limit, a bot check this browser has not passed
 * - and the message simply stays in the pack for the next try. A retry is safe:
 * a file already uploaded is not uploaded twice, and the database answers a
 * message it already holds by its tag rather than storing it again.
 *
 * The client is the map maker's, loaded on first use, so a player who never
 * sends anything never downloads it.
 */
export const sendToTheLab: FeedbackSender = async (note) => {
  const db = await supabase();
  const uid = await signedInAs();
  if (!uid) {
    return false;
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
  for (const file of files) {
    const { error } = await db.storage.from('feedback').upload(file.path, file.body, { contentType: file.type, upsert: false });
    if (error && !alreadyThere(error)) {
      return false;
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
  return !error;
};

/**
 * This browser's anonymous id, signing in for the first time if it has to. A
 * project that asks for a bot check before signing in cannot be answered from
 * here: a browser with no session yet waits until it has one, which the panel
 * gets it by drawing the check (`needsBotCheck`, `signInWithCheck`) - or the
 * map maker's SEND does.
 */
async function signedInAs(): Promise<string | null> {
  const db = await supabase();
  const { data } = await db.auth.getSession();
  if (data.session) {
    return data.session.user.id;
  }
  if (botCheckNeeded()) {
    return null;
  }
  const { data: signedIn, error } = await db.auth.signInAnonymously();
  return error ? null : (signedIn.user?.id ?? null);
}

/**
 * Whether the panel has to draw the bot check before anything can be sent:
 * the project asks for one and this browser has never signed in. Answered
 * without loading anything when the project asks for none.
 */
export async function needsBotCheck(): Promise<boolean> {
  if (!botCheckNeeded()) {
    return false;
  }
  const { data } = await (await supabase()).auth.getSession();
  return data.session === null;
}

/** Signs this browser in with a passed check's token. A token is good for one sign-in. */
export async function signInWithCheck(captchaToken: string): Promise<boolean> {
  const { error } = await (await supabase()).auth.signInAnonymously({ options: { captchaToken } });
  return !error;
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
