import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedbackNote } from './feedbackNote';

/**
 * What the sender asks of the lab, in order, against a stand-in client: every
 * file's name is asked for before any file is uploaded, because the bucket
 * takes a file only under a name the database handed out (red team F7).
 */
const calls: string[] = [];
let reserveError: { code: string; message: string } | null = null;

vi.mock('../maker/supabaseClient', () => ({
  supabase: () =>
    Promise.resolve({
      auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }) },
      rpc: (name: string, args: Record<string, unknown>) => {
        calls.push(`rpc ${name} ${JSON.stringify(args.names ?? args.tag)}`);
        return Promise.resolve({ error: name === 'reserve_feedback_uploads' ? reserveError : null });
      },
      storage: {
        from: () => ({
          upload: (path: string) => {
            calls.push(`upload ${path}`);
            return Promise.resolve({ error: null });
          },
        }),
      },
    }),
}));

const { sendToTheLab } = await import('./feedbackSender');

const note = (more: Partial<FeedbackNote> = {}): FeedbackNote =>
  ({
    tag: 'FB-AAAA',
    createdAt: '2026-10-12T00:00:00.000Z',
    text: 'words',
    context: {},
    actions: [],
    picture: new Blob(['png']),
    voice: [new Blob(['clip'], { type: 'audio/webm;codecs=opus' })],
    voiceMs: 1000,
    save: null,
    ...more,
  }) as unknown as FeedbackNote;

beforeEach(() => {
  calls.length = 0;
  reserveError = null;
});

describe('sending a message to the lab', () => {
  it('asks for every file by name before it uploads any of them', async () => {
    expect(await sendToTheLab(note())).toBe('sent');
    expect(calls).toEqual([
      'rpc reserve_feedback_uploads ["u1/FB-AAAA/picture.png","u1/FB-AAAA/voice-1.webm"]',
      'upload u1/FB-AAAA/picture.png',
      'upload u1/FB-AAAA/voice-1.webm',
      'rpc submit_feedback "FB-AAAA"',
    ]);
  });

  it('keeps a message for later, uploading nothing, when the day\'s files are spent', async () => {
    reserveError = { code: '54000', message: 'Sixty files a day.' };
    expect(await sendToTheLab(note())).toBe('later');
    expect(calls.filter((call) => call.startsWith('upload'))).toEqual([]);
  });

  it('asks for nothing when there are no files', async () => {
    expect(await sendToTheLab(note({ picture: null, voice: [] }))).toBe('sent');
    expect(calls).toEqual(['rpc submit_feedback "FB-AAAA"']);
  });
});
