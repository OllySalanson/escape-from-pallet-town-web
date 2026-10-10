import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  announcement,
  clipFileName,
  folderName,
  listPage,
  messageMarkdown,
  type CollectedFiles,
  type FeedbackRow,
  type ListedNote,
} from './inbox';

/** How long a received message stays in the project before it is cleared out. */
export const KEEP_RECEIVED_DAYS = 90;

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
  /** The one line to announce, or null when nothing new came in. */
  readonly news: string | null;
}

/**
 * One collection: every message not yet collected becomes a folder, is marked
 * received and has its voice deleted from the project; anything received over
 * `KEEP_RECEIVED_DAYS` ago leaves the project; clips with no text are listened
 * to; and every folder's `message.md` and the list page are written again
 * from what is on disk. See `collect.mts` for why each step is there.
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
  const download = async (path: string): Promise<Buffer> =>
    Buffer.from(await (await api(`/storage/v1/object/feedback/${path.split('/').map(encodeURIComponent).join('/')}`)).arrayBuffer());
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
  const fresh = (await (await api('/rest/v1/feedback?received_at=is.null&order=created_at.asc&select=*')).json()) as FeedbackRow[];
  for (const row of fresh) {
    const folder = join(out, folderName(row));
    mkdirSync(folder, { recursive: true });
    if (row.picture_path) {
      writeFileSync(join(folder, 'picture.png'), await download(row.picture_path));
    }
    for (const path of row.voice_paths) {
      writeFileSync(join(folder, clipFileName(path)), await download(path));
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
  const old = (await (await api(`/rest/v1/feedback?received_at=lt.${before}&select=id,tag,picture_path,voice_paths`)).json()) as Pick<
    FeedbackRow,
    'id' | 'tag' | 'picture_path' | 'voice_paths'
  >[];
  for (const row of old) {
    await removeFiles([...(row.picture_path ? [row.picture_path] : []), ...row.voice_paths]);
    await api(`/rest/v1/feedback?id=eq.${encodeURIComponent(row.id)}`, { method: 'DELETE' });
    say(`cleared ${row.tag} out of the project (received over ${KEEP_RECEIVED_DAYS} days ago)`);
  }

  // 3. Listen to every clip that has no text yet, if this PC can.
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

  // 4. Every folder's message.md and the list page, written again from what is on disk.
  const listed: ListedNote[] = folders.map((name) => {
    const folder = join(out, name);
    const row = { save: null, ...JSON.parse(readFileSync(join(folder, 'row.json'), 'utf8')) } as FeedbackRow;
    const files = readdirSync(folder);
    const collected: CollectedFiles = {
      picture: files.includes('picture.png') ? 'picture.png' : null,
      voice: files.filter((file) => /^voice-\d+\./.test(file)).sort(),
      save: files.includes('save.json') ? 'save.json' : null,
      transcript: files.includes('transcript.txt') ? readFileSync(join(folder, 'transcript.txt'), 'utf8') : null,
    };
    writeFileSync(join(folder, 'message.md'), messageMarkdown(row, collected));
    return { folder: name, row, files: collected };
  });
  writeFileSync(join(out, 'index.html'), listPage(listed));

  return { collected: fresh, cleared: old.map((row) => row.tag), transcribed, news: announcement(fresh) };
}
