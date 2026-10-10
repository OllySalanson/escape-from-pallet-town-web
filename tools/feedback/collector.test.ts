import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectFeedback, sniff } from './collector';
import type { FeedbackRow } from './inbox';

/** The first bytes of the files the game sends, and of one it never does. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 4, 5, 6]);
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

interface StoredFile {
  readonly body: Buffer;
  readonly created_at: string;
}

interface Visitor {
  readonly id: string;
  readonly is_anonymous: boolean;
  readonly created_at: string;
  readonly last_sign_in_at: string | null;
}

/**
 * The lab as the service key sees it: rows, files, visitors and maps, and only
 * the calls the collector makes, answered the way PostgREST, the storage API
 * and the auth admin API answer them.
 */
function standInLab(rows: FeedbackRow[], files: Record<string, StoredFile>, visitors: Visitor[] = [], makers: string[] = []) {
  const calls: string[] = [];
  const lab = {
    rows,
    files,
    visitors,
    calls,
    fetch: (async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = new URL(String(input));
      const method = init.method ?? 'GET';
      calls.push(`${method} ${url.pathname}${url.search}`);
      if ((init.headers as Record<string, string>).authorization !== 'Bearer service') {
        return new Response('no', { status: 401 });
      }
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      if (url.pathname === '/rest/v1/feedback' && method === 'GET') {
        const filter = url.searchParams.get('received_at');
        const found = lab.rows.filter((row) =>
          filter === null
            ? true
            : filter === 'is.null'
              ? row.received_at === null
              : row.received_at !== null && row.received_at < filter.replace('lt.', ''),
        );
        return Response.json(found);
      }
      if (url.pathname === '/rest/v1/feedback' && method === 'PATCH') {
        const id = url.searchParams.get('id')!.replace('eq.', '');
        lab.rows = lab.rows.map((row) => (row.id === id ? { ...row, received_at: body.received_at } : row));
        return new Response(null, { status: 204 });
      }
      if (url.pathname === '/rest/v1/feedback' && method === 'DELETE') {
        const id = url.searchParams.get('id')!.replace('eq.', '');
        lab.rows = lab.rows.filter((row) => row.id !== id);
        return new Response(null, { status: 204 });
      }
      if (url.pathname === '/rest/v1/map_submissions' && method === 'GET') {
        return Response.json(makers.map((maker_uid) => ({ maker_uid })));
      }
      if (url.pathname === '/storage/v1/object/list/feedback' && method === 'POST') {
        const prefix = String(body.prefix);
        const below = Object.keys(lab.files).filter((path) => path.startsWith(prefix));
        const entries = new Map<string, { name: string; id: string | null; created_at: string | null }>();
        for (const path of below) {
          const [name, ...rest] = path.slice(prefix.length).split('/');
          entries.set(name, rest.length ? { name, id: null, created_at: null } : { name, id: `id-${path}`, created_at: lab.files[path].created_at });
        }
        return Response.json([...entries.values()]);
      }
      if (url.pathname === '/storage/v1/object/feedback' && method === 'DELETE') {
        for (const path of body.prefixes as string[]) {
          delete lab.files[path];
        }
        return Response.json([]);
      }
      if (url.pathname === '/auth/v1/admin/users' && method === 'GET') {
        return Response.json({ users: lab.visitors });
      }
      if (url.pathname.startsWith('/auth/v1/admin/users/') && method === 'DELETE') {
        const id = decodeURIComponent(url.pathname.split('/').pop()!);
        lab.visitors = lab.visitors.filter((visitor) => visitor.id !== id);
        return Response.json({});
      }
      const object = decodeURIComponent(url.pathname.replace('/storage/v1/object/feedback/', ''));
      if (method === 'GET' && object in lab.files) {
        return new Response(lab.files[object].body);
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch,
  };
  return lab;
}

function message(overrides: Partial<FeedbackRow>): FeedbackRow {
  return {
    id: 'id-1',
    tag: 'FB-AAAA',
    sender_uid: 'u1',
    message: 'The bench blocks the path',
    context: { screen: 'Raid', version: 'abc1234', details: [{ label: 'Map', value: 'Route 1' }] },
    actions: [{ at: 1.5, what: 'Opened Raid' }],
    save: '{"version":7}',
    picture_path: 'u1/FB-AAAA/picture.png',
    voice_paths: ['u1/FB-AAAA/voice-1.webm'],
    voice_ms: 4200,
    written_at: '2026-10-10T09:00:00.000Z',
    created_at: '2026-10-10T09:00:05.000Z',
    received_at: null,
    ...overrides,
  };
}

const at = (iso: string): StoredFile['created_at'] => iso;
const file = (body: Buffer, created = '2026-10-10T09:00:00.000Z'): StoredFile => ({ body, created_at: at(created) });
const now = new Date('2026-10-10T10:00:00.000Z');
const folderOf = (out: string) => join(out, '2026-10-10 0900 FB-AAAA');

let out = '';
afterEach(() => {
  if (out) rmSync(out, { recursive: true, force: true });
});

describe('collecting feedback onto the PC', () => {
  it('makes a folder of each new message, marks it received and takes its voice out of the project', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const lab = standInLab([message({})], { 'u1/FB-AAAA/picture.png': file(PNG), 'u1/FB-AAAA/voice-1.webm': file(WEBM) });
    const result = await collectFeedback({ url: 'https://lab.test', key: 'service', out, fetch: lab.fetch, now });

    const folder = folderOf(out);
    expect(readFileSync(join(folder, 'picture.png'))).toEqual(PNG);
    expect(readFileSync(join(folder, 'voice-1.webm'))).toEqual(WEBM);
    expect(readFileSync(join(folder, 'save.json'), 'utf8')).toBe('{"version":7}');
    expect(JSON.parse(readFileSync(join(folder, 'row.json'), 'utf8'))).not.toHaveProperty('save');
    expect(readFileSync(join(folder, 'message.md'), 'utf8')).toContain('The bench blocks the path');
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toContain('FB-AAAA');

    expect(lab.rows[0].received_at).toBe(now.toISOString());
    expect(Object.keys(lab.files)).toEqual(['u1/FB-AAAA/picture.png']);
    expect(result.news).toBe('Pallet Town: 1 new player note - FB-AAAA (Raid, words + voice 0:04)');
  });

  it("names every file itself, and leaves out a file that is not what it says it is", async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const lab = standInLab(
      [message({ picture_path: 'u1/FB-AAAA/picture.png', voice_paths: ['u1/FB-AAAA/evil.exe', 'u1/FB-AAAA/voice-2.webm'] })],
      { 'u1/FB-AAAA/picture.png': file(HTML), 'u1/FB-AAAA/evil.exe': file(HTML), 'u1/FB-AAAA/voice-2.webm': file(WEBM) },
    );
    let heard: readonly string[] = [];
    await collectFeedback({ url: 'https://lab.test', key: 'service', out, fetch: lab.fetch, now, transcribe: (clips) => ((heard = clips), 'words') });
    const folder = folderOf(out);
    expect(readdirSync(folder).sort()).toEqual(['left-out.txt', 'message.md', 'row.json', 'save.json', 'transcript.txt', 'voice-2.webm']);
    expect(heard.map((clip) => clip.split('/').pop())).toEqual(['voice-2.webm']);
    expect(readFileSync(join(folder, 'message.md'), 'utf8')).toContain('Left out, not what they said they were: the picture, clip 1');
  });

  it('says nothing and changes nothing when nothing new has come in', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const lab = standInLab([message({ received_at: '2026-10-09T00:00:00.000Z' })], { 'u1/FB-AAAA/picture.png': file(PNG) });
    const result = await collectFeedback({ url: 'https://lab.test', key: 'service', out, fetch: lab.fetch, now });
    expect(result.news).toBeNull();
    expect(lab.calls.filter((call) => !call.startsWith('GET') && !call.startsWith('POST /storage/v1/object/list/'))).toEqual([]);
  });

  it('clears a message out of the project ninety days after it was received', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const lab = standInLab(
      [message({ received_at: '2026-07-01T00:00:00.000Z', voice_paths: [] }), message({ id: 'id-2', tag: 'FB-BBBB', picture_path: 'u1/FB-BBBB/picture.png', received_at: '2026-09-01T00:00:00.000Z' })],
      { 'u1/FB-AAAA/picture.png': file(PNG), 'u1/FB-BBBB/picture.png': file(PNG) },
    );
    const result = await collectFeedback({ url: 'https://lab.test', key: 'service', out, fetch: lab.fetch, now });
    expect(result.cleared).toEqual(['FB-AAAA']);
    expect(lab.rows.map((row) => row.tag)).toEqual(['FB-BBBB']);
    expect(Object.keys(lab.files)).toEqual(['u1/FB-BBBB/picture.png']);
  });

  it('removes uploads no message names once they are a day old, and only those', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const lab = standInLab([message({ received_at: '2026-10-10T09:30:00.000Z', voice_paths: [] })], {
      'u1/FB-AAAA/picture.png': file(PNG, '2026-10-01T00:00:00.000Z'),
      'u2/FB-ZZZZ/picture.png': file(PNG, '2026-10-01T00:00:00.000Z'),
      'u2/FB-YYYY/picture.png': file(PNG, '2026-10-10T09:59:00.000Z'),
    });
    const result = await collectFeedback({ url: 'https://lab.test', key: 'service', out, fetch: lab.fetch, now });
    expect(result.unclaimedRemoved).toBe(1);
    expect(Object.keys(lab.files).sort()).toEqual(['u1/FB-AAAA/picture.png', 'u2/FB-YYYY/picture.png']);
  });

  it('removes long-idle anonymous visitors with nothing in the lab, and keeps everyone else', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const long = '2026-08-01T00:00:00.000Z';
    const lab = standInLab(
      [message({ sender_uid: 'sent-a-message', received_at: '2026-10-10T09:30:00.000Z', picture_path: null, voice_paths: [] })],
      {},
      [
        { id: 'idle', is_anonymous: true, created_at: long, last_sign_in_at: long },
        { id: 'sent-a-message', is_anonymous: true, created_at: long, last_sign_in_at: long },
        { id: 'sent-a-map', is_anonymous: true, created_at: long, last_sign_in_at: long },
        { id: 'seen-today', is_anonymous: true, created_at: long, last_sign_in_at: '2026-10-10T08:00:00.000Z' },
        { id: 'the-owner', is_anonymous: false, created_at: long, last_sign_in_at: long },
      ],
      ['sent-a-map'],
    );
    const result = await collectFeedback({ url: 'https://lab.test', key: 'service', out, fetch: lab.fetch, now });
    expect(result.visitorsRemoved).toBe(1);
    expect(lab.visitors.map((visitor) => visitor.id)).toEqual(['sent-a-message', 'sent-a-map', 'seen-today', 'the-owner']);
  });

  it('listens to a clip once, and tries again next time if it could not', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const lab = standInLab([message({})], { 'u1/FB-AAAA/picture.png': file(PNG), 'u1/FB-AAAA/voice-1.webm': file(WEBM) });
    const options = { url: 'https://lab.test', key: 'service', out, fetch: lab.fetch, now };
    await collectFeedback({ ...options, transcribe: () => { throw new Error('faster-whisper is not installed'); } });
    const folder = folderOf(out);
    expect(existsSync(join(folder, 'transcript.txt'))).toBe(false);
    let heard = 0;
    const result = await collectFeedback({ ...options, transcribe: (clips) => { heard += clips.length; return 'The bench is in the way.'; } });
    expect(result.transcribed).toEqual(['2026-10-10 0900 FB-AAAA']);
    expect(readFileSync(join(folder, 'message.md'), 'utf8')).toContain('The bench is in the way.');
    await collectFeedback({ ...options, transcribe: () => { heard += 100; return ''; } });
    expect(heard).toBe(1);
  });

  it('turns a message in a shape the game never sends into one it can read, and lists it', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const odd = { ...message({ picture_path: null, voice_paths: [] }), actions: [{ at: 'x', what: 7 }], context: { version: 1, details: 'no' } };
    const lab = standInLab([odd as unknown as FeedbackRow], {});
    await collectFeedback({ url: 'https://lab.test', key: 'service', out, fetch: lab.fetch, now });
    expect(readFileSync(join(folderOf(out), 'message.md'), 'utf8')).toContain('0.0s 7');
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toContain('FB-AAAA');
  });

  it('skips a folder it cannot read, names it, and still lists every other message', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    mkdirSync(join(out, '2026-10-09 0800 FB-BROK'));
    writeFileSync(join(out, '2026-10-09 0800 FB-BROK', 'row.json'), '{ not json');
    const lab = standInLab([message({})], { 'u1/FB-AAAA/picture.png': file(PNG), 'u1/FB-AAAA/voice-1.webm': file(WEBM) });
    const result = await collectFeedback({ url: 'https://lab.test', key: 'service', out, fetch: lab.fetch, now });
    expect(result.unreadable).toEqual(['2026-10-09 0800 FB-BROK']);
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toContain('FB-AAAA');
  });

  it('leaves a message unreceived when its folder could not be finished, so the next run picks it up', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const lab = standInLab([message({})], { 'u1/FB-AAAA/picture.png': file(PNG) });
    await expect(collectFeedback({ url: 'https://lab.test', key: 'service', out, fetch: lab.fetch })).rejects.toThrow('404');
    expect(lab.rows[0].received_at).toBeNull();
  });

  it('refuses to run on a key that is not the service key', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const lab = standInLab([message({})], {});
    await expect(collectFeedback({ url: 'https://lab.test', key: 'publishable', out, fetch: lab.fetch })).rejects.toThrow('401');
  });
});

describe("reading a file's first bytes", () => {
  it('knows the picture and the three kinds of clip the game records, and nothing else', () => {
    expect(sniff(PNG)).toBe('png');
    expect(sniff(WEBM)).toBe('webm');
    expect(sniff(Buffer.from('OggS\0\0'))).toBe('ogg');
    expect(sniff(Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d]))).toBe('m4a');
    expect(sniff(HTML)).toBeNull();
    expect(sniff(Buffer.alloc(0))).toBeNull();
  });
});
