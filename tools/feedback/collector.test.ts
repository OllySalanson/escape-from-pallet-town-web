import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectFeedback } from './collector';
import type { FeedbackRow } from './inbox';

/**
 * The lab as the service key sees it: rows, files, and the four calls the
 * collector makes (read, mark received, delete files, delete rows). Only what
 * PostgREST and the storage API actually answer, filtered as the URLs ask.
 */
function standInLab(rows: FeedbackRow[], files: Record<string, string>) {
  const calls: string[] = [];
  const lab = {
    rows,
    files,
    calls,
    fetch: (async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = new URL(String(input));
      const method = init.method ?? 'GET';
      calls.push(`${method} ${url.pathname}${url.search}`);
      if ((init.headers as Record<string, string>).authorization !== 'Bearer service') {
        return new Response('no', { status: 401 });
      }
      if (url.pathname === '/rest/v1/feedback' && method === 'GET') {
        const unreceived = url.searchParams.get('received_at') === 'is.null';
        const before = url.searchParams.get('received_at')?.replace('lt.', '');
        const found = lab.rows.filter((row) =>
          unreceived ? row.received_at === null : row.received_at !== null && before !== undefined && row.received_at < before,
        );
        return Response.json(found);
      }
      if (url.pathname === '/rest/v1/feedback' && method === 'PATCH') {
        const id = url.searchParams.get('id')!.replace('eq.', '');
        const update = JSON.parse(String(init.body)) as { received_at: string };
        lab.rows = lab.rows.map((row) => (row.id === id ? { ...row, received_at: update.received_at } : row));
        return new Response(null, { status: 204 });
      }
      if (url.pathname === '/rest/v1/feedback' && method === 'DELETE') {
        const id = url.searchParams.get('id')!.replace('eq.', '');
        lab.rows = lab.rows.filter((row) => row.id !== id);
        return new Response(null, { status: 204 });
      }
      if (url.pathname === '/storage/v1/object/feedback' && method === 'DELETE') {
        for (const path of (JSON.parse(String(init.body)) as { prefixes: string[] }).prefixes) {
          delete lab.files[path];
        }
        return Response.json([]);
      }
      const object = decodeURIComponent(url.pathname.replace('/storage/v1/object/feedback/', ''));
      if (method === 'GET' && object in lab.files) {
        return new Response(lab.files[object]);
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

let out = '';
afterEach(() => {
  if (out) rmSync(out, { recursive: true, force: true });
});

describe('collecting feedback onto the PC', () => {
  it('makes a folder of each new message, marks it received and takes its voice out of the project', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const lab = standInLab([message({})], { 'u1/FB-AAAA/picture.png': 'PNG', 'u1/FB-AAAA/voice-1.webm': 'OPUS' });
    const now = new Date('2026-10-10T10:00:00.000Z');
    const result = await collectFeedback({ url: 'https://lab.test', key: 'service', out, fetch: lab.fetch, now });

    const folder = join(out, '2026-10-10 0900 FB-AAAA');
    expect(readFileSync(join(folder, 'picture.png'), 'utf8')).toBe('PNG');
    expect(readFileSync(join(folder, 'voice-1.webm'), 'utf8')).toBe('OPUS');
    expect(readFileSync(join(folder, 'save.json'), 'utf8')).toBe('{"version":7}');
    expect(JSON.parse(readFileSync(join(folder, 'row.json'), 'utf8'))).not.toHaveProperty('save');
    expect(readFileSync(join(folder, 'message.md'), 'utf8')).toContain('The bench blocks the path');
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toContain('FB-AAAA');

    expect(lab.rows[0].received_at).toBe(now.toISOString());
    expect(Object.keys(lab.files)).toEqual(['u1/FB-AAAA/picture.png']);
    expect(result.news).toBe('Pallet Town: 1 new player note - FB-AAAA (Raid, words + voice 0:04)');
  });

  it('says nothing and touches nothing when nothing new has come in', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const lab = standInLab([message({ received_at: '2026-10-09T00:00:00.000Z' })], { 'u1/FB-AAAA/picture.png': 'PNG' });
    const result = await collectFeedback({ url: 'https://lab.test', key: 'service', out, fetch: lab.fetch, now: new Date('2026-10-10T10:00:00Z') });
    expect(result.news).toBeNull();
    expect(lab.calls.filter((call) => !call.startsWith('GET'))).toEqual([]);
  });

  it('clears a message out of the project ninety days after it was received', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const lab = standInLab(
      [message({ received_at: '2026-07-01T00:00:00.000Z', voice_paths: [] }), message({ id: 'id-2', tag: 'FB-BBBB', received_at: '2026-09-01T00:00:00.000Z' })],
      { 'u1/FB-AAAA/picture.png': 'PNG', 'u1/FB-BBBB/picture.png': 'PNG' },
    );
    const result = await collectFeedback({ url: 'https://lab.test', key: 'service', out, fetch: lab.fetch, now: new Date('2026-10-10T10:00:00Z') });
    expect(result.cleared).toEqual(['FB-AAAA']);
    expect(lab.rows.map((row) => row.tag)).toEqual(['FB-BBBB']);
    expect(Object.keys(lab.files)).toEqual(['u1/FB-BBBB/picture.png']);
  });

  it('listens to a clip once, and tries again next time if it could not', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const lab = standInLab([message({})], { 'u1/FB-AAAA/picture.png': 'PNG', 'u1/FB-AAAA/voice-1.webm': 'OPUS' });
    const options = { url: 'https://lab.test', key: 'service', out, fetch: lab.fetch, now: new Date('2026-10-10T10:00:00Z') };
    await collectFeedback({ ...options, transcribe: () => { throw new Error('faster-whisper is not installed'); } });
    const folder = join(out, '2026-10-10 0900 FB-AAAA');
    expect(existsSync(join(folder, 'transcript.txt'))).toBe(false);
    let heard = 0;
    const result = await collectFeedback({ ...options, transcribe: (clips) => { heard += clips.length; return 'The bench is in the way.'; } });
    expect(result.transcribed).toEqual(['2026-10-10 0900 FB-AAAA']);
    expect(readFileSync(join(folder, 'message.md'), 'utf8')).toContain('The bench is in the way.');
    await collectFeedback({ ...options, transcribe: () => { heard += 100; return ''; } });
    expect(heard).toBe(1);
  });

  it('leaves a message unreceived when its folder could not be finished, so the next run picks it up', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const lab = standInLab([message({})], { 'u1/FB-AAAA/picture.png': 'PNG' });
    await expect(collectFeedback({ url: 'https://lab.test', key: 'service', out, fetch: lab.fetch })).rejects.toThrow('404');
    expect(lab.rows[0].received_at).toBeNull();
  });

  it('refuses to run on a key that is not the service key', async () => {
    out = mkdtempSync(join(tmpdir(), 'feedback-'));
    const lab = standInLab([message({})], {});
    await expect(collectFeedback({ url: 'https://lab.test', key: 'publishable', out, fetch: lab.fetch })).rejects.toThrow('401');
  });
});
