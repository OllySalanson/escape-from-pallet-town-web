import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  announcement,
  folderName,
  listPage,
  messageMarkdown,
  normaliseRow,
  type CollectedFiles,
  type FeedbackRow,
  type ListedNote,
} from './inbox';

/** How long a received message stays in the project before it is cleared out. */
export const KEEP_RECEIVED_DAYS = 90;
/** How long an upload no message names is kept: a message is sent within seconds of its files. */
export const KEEP_UNCLAIMED_HOURS = 24;
/** How long an anonymous visitor with nothing in the lab is kept after they were last seen. */
export const KEEP_IDLE_VISITOR_DAYS = 30;

/** Files in a message folder the collector names itself, and only these. */
const LEFT_OUT = 'left-out.txt';

export interface CollectOptions {
  /** The project's URL. */
  readonly url: string;
  /** The service-role key: the one credential that reads the inbox. */
  readonly key: string;
  /** The folder messages are collected into. */
  readonly out: string;
  /** Turns clips into text, or throws when this PC cannot yet. */
  readonly transcribe?: (clips: readonly string[]) => string;
  readonly fetch?: typeof fetch;
  readonly now?: Date;
  readonly say?: (line: string) => void;
}

export interface CollectResult {
  readonly collected: readonly FeedbackRow[];
  readonly cleared: readonly string[];
  readonly transcribed: readonly string[];
  /** Uploads no message named, deleted from the project. */
  readonly unclaimedRemoved: number;
  /** Anonymous visitors with nothing in the lab, long idle, deleted. */
  readonly visitorsRemoved: number;
  /** Folders whose page could not be written, by name: skipped, never fatal. */
  readonly unreadable: readonly string[];
  /** The one line to announce, or null when nothing new came in. */
  readonly news: string | null;
}

/** What a file's first bytes say it is, or null when it is nothing the game sends. */
export function sniff(bytes: Uint8Array): 'png' | 'webm' | 'ogg' | 'm4a' | null {
  const starts = (...expected: number[]): boolean => expected.every((byte, index) => bytes[index] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
  if (starts(0x1a, 0x45, 0xdf, 0xa3)) return 'webm';
  if (starts(0x4f, 0x67, 0x67, 0x53)) return 'ogg';
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return 'm4a';
  return null;
}

/**
 * One collection: every message not yet collected becomes a folder, is marked
 * received and has its voice deleted from the project; anything received over
 * `KEEP_RECEIVED_DAYS` ago leaves the project; uploads no message names and
 * long-idle anonymous visitors with nothing in the lab are cleared; clips with
 * no text are listened to; and every folder's `message.md` and the list page
 * are written again from what is on disk. See `collect.mts` for why.
 *
 * Nothing a player sent names anything on this PC: the folder is the time and
 * the database-checked tag, the picture is `picture.png` and a clip is
 * `voice-<n>.<type its bytes say>`, and a file whose bytes are not a PNG or
 * the audio the game records is left out and listed as such - never written,
 * never handed to the speech model's decoder.
 */
export async function collectFeedback(options: CollectOptions): Promise<CollectResult> {
  const send = options.fetch ?? fetch;
  const now = options.now ?? new Date();
  const say = options.say ?? (() => undefined);
  const { out } = options;
  const auth = { apikey: options.key, authorization: `Bearer ${options.key}` };

  const api = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const response = await send(`${options.url}${path}`, { ...init, headers: { ...auth, ...(init.headers ?? {}) } });
    if (!response.ok) {
      throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`);
    }
    return response;
  };
  const objectPath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');
  const download = async (path: string): Promise<Uint8Array> =>
    new Uint8Array(await (await api(`/storage/v1/object/feedback/${objectPath(path)}`)).arrayBuffer());
  const removeFiles = async (paths: readonly string[]): Promise<void> => {
    if (paths.length > 0) {
      await api('/storage/v1/object/feedback', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prefixes: paths }),
      });
    }
  };

  mkdirSync(out, { recursive: true });

  // 1. Everything not yet collected, oldest first.
  const fresh = ((await (await api('/rest/v1/feedback?received_at=is.null&order=created_at.asc&select=*')).json()) as unknown[]).map(
    normaliseRow,
  );
  for (const row of fresh) {
    const folder = join(out, folderName(row));
    mkdirSync(folder, { recursive: true });
    const leftOut: string[] = [];
    if (row.picture_path) {
      const bytes = await download(row.picture_path);
      if (sniff(bytes) === 'png') {
        writeFileSync(join(folder, 'picture.png'), bytes);
      } else {
        leftOut.push('the picture');
      }
    }
    for (const [index, path] of row.voice_paths.entries()) {
      const bytes = await download(path);
      const kind = sniff(bytes);
      if (kind && kind !== 'png') {
        writeFileSync(join(folder, `voice-${index + 1}.${kind}`), bytes);
      } else {
        leftOut.push(`clip ${index + 1}`);
      }
    }
    if (leftOut.length > 0) {
      writeFileSync(join(folder, LEFT_OUT), `${leftOut.join('\n')}\n`);
    }
    if (row.save) {
      writeFileSync(join(folder, 'save.json'), row.save);
    }
    const { save: _save, ...rest } = row;
    writeFileSync(join(folder, 'row.json'), `${JSON.stringify(rest, null, 2)}\n`);
    // Only once the folder is whole is the message marked received - a run
    // that died half way through picks it up again next time.
    await api(`/rest/v1/feedback?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify({ received_at: now.toISOString() }),
    });
    // The plan's promise: a voice does not stay online once it is safe here.
    await removeFiles(row.voice_paths);
    say(`collected ${row.tag} into ${folder}`);
  }

  // 2. Anything received more than ninety days ago leaves the project.
  const before = new Date(now.getTime() - KEEP_RECEIVED_DAYS * 86_400_000).toISOString();
  const old = ((await (await api(`/rest/v1/feedback?received_at=lt.${before}&select=id,tag,picture_path,voice_paths`)).json()) as unknown[]).map(
    normaliseRow,
  );
  for (const row of old) {
    await removeFiles([...(row.picture_path ? [row.picture_path] : []), ...row.voice_paths]);
    await api(`/rest/v1/feedback?id=eq.${encodeURIComponent(row.id)}`, { method: 'DELETE' });
    say(`cleared ${row.tag} out of the project (received over ${KEEP_RECEIVED_DAYS} days ago)`);
  }

  // 3. What nothing will ever claim: uploads no message names, and anonymous
  //    visitors long gone who have nothing in the lab. A visitor with any
  //    message or map is kept, because removing them would take those with
  //    them while the tables still cascade (the review's L2).
  const rows = ((await (await api('/rest/v1/feedback?select=sender_uid,picture_path,voice_paths')).json()) as unknown[]).map(normaliseRow);
  const named = new Set(rows.flatMap((row) => [...(row.picture_path ? [row.picture_path] : []), ...row.voice_paths]));
  const list = async (prefix: string): Promise<{ name: string; id: string | null; created_at: string | null }[]> =>
    (await (
      await api('/storage/v1/object/list/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
      })
    ).json()) as { name: string; id: string | null; created_at: string | null }[];
  const unclaimedBefore = now.getTime() - KEEP_UNCLAIMED_HOURS * 3_600_000;
  const unclaimed: string[] = [];
  for (const visitor of (await list('')).filter((entry) => entry.id === null)) {
    for (const message of (await list(`${visitor.name}/`)).filter((entry) => entry.id === null)) {
      for (const file of await list(`${visitor.name}/${message.name}/`)) {
        const path = `${visitor.name}/${message.name}/${file.name}`;
        if (file.id !== null && !named.has(path) && file.created_at && Date.parse(file.created_at) < unclaimedBefore) {
          unclaimed.push(path);
        }
      }
    }
  }
  await removeFiles(unclaimed);
  if (unclaimed.length > 0) say(`removed ${unclaimed.length} upload(s) no message named`);

  const makers = ((await (await api('/rest/v1/map_submissions?select=maker_uid')).json()) as { maker_uid: unknown }[]).map((row) =>
    String(row.maker_uid),
  );
  const holding = new Set([...rows.map((row) => row.sender_uid), ...makers]);
  const idleBefore = now.getTime() - KEEP_IDLE_VISITOR_DAYS * 86_400_000;
  const users = ((await (await api('/auth/v1/admin/users?page=1&per_page=1000')).json()) as {
    users?: { id: string; is_anonymous?: boolean; created_at?: string; last_sign_in_at?: string | null }[];
  }).users ?? [];
  let visitorsRemoved = 0;
  for (const user of users) {
    const lastSeen = Date.parse(user.last_sign_in_at ?? user.created_at ?? '');
    if (user.is_anonymous === true && !holding.has(user.id) && Number.isFinite(lastSeen) && lastSeen < idleBefore) {
      await api(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      visitorsRemoved += 1;
    }
  }
  if (visitorsRemoved > 0) say(`removed ${visitorsRemoved} idle anonymous visitor(s) with nothing in the lab`);

  // 4. Listen to every clip that has no text yet, if this PC can.
  const folders = readdirSync(out, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(out, entry.name, 'row.json')))
    .map((entry) => entry.name);
  const transcribed: string[] = [];
  if (options.transcribe) {
    for (const name of folders) {
      const folder = join(out, name);
      const clips = readdirSync(folder).filter((file) => /^voice-\d+\.(webm|ogg|m4a)$/.test(file)).sort();
      if (clips.length === 0 || existsSync(join(folder, 'transcript.txt'))) {
        continue;
      }
      try {
        writeFileSync(join(folder, 'transcript.txt'), `${options.transcribe(clips.map((clip) => join(folder, clip))).trim()}\n`);
        transcribed.push(name);
        say(`turned ${name}'s voice into text`);
      } catch (error) {
        say(`could not turn ${name}'s voice into text yet: ${(error as Error).message.split('\n')[0]}`);
        break;
      }
    }
  }

  // 5. Every folder's message.md and the list page, written again from what is
  //    on disk. One folder that cannot be read is named and skipped: it must
  //    never stop every later message being listed.
  const listed: ListedNote[] = [];
  const unreadable: string[] = [];
  for (const name of folders) {
    const folder = join(out, name);
    try {
      const row = normaliseRow({ save: null, ...JSON.parse(readFileSync(join(folder, 'row.json'), 'utf8')) });
      const files = readdirSync(folder);
      const collected: CollectedFiles = {
        picture: files.includes('picture.png') ? 'picture.png' : null,
        voice: files.filter((file) => /^voice-\d+\.(webm|ogg|m4a)$/.test(file)).sort(),
        save: files.includes('save.json') ? 'save.json' : null,
        transcript: files.includes('transcript.txt') ? readFileSync(join(folder, 'transcript.txt'), 'utf8') : null,
        refused: files.includes(LEFT_OUT) ? readFileSync(join(folder, LEFT_OUT), 'utf8').split('\n').filter(Boolean) : [],
      };
      writeFileSync(join(folder, 'message.md'), messageMarkdown(row, collected));
      listed.push({ folder: name, row, files: collected });
    } catch (error) {
      unreadable.push(name);
      say(`could not read ${name}: ${(error as Error).message.split('\n')[0]}`);
    }
  }
  writeFileSync(join(out, 'index.html'), listPage(listed));

  return {
    collected: fresh,
    cleared: old.map((row) => row.tag),
    transcribed,
    unclaimedRemoved: unclaimed.length,
    visitorsRemoved,
    unreadable,
    news: announcement(fresh),
  };
}
