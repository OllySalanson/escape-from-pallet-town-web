import { describe, expect, it } from 'vitest';
import { createCourier, type FeedbackSender } from './courier';
import { DAILY_FEEDBACK_LIMIT, type FeedbackNote } from './feedbackNote';
import { DAILY_COUNT_KEY, memoryOutbox, type FeedbackOutbox } from './outbox';

function storage(): Pick<Storage, 'getItem' | 'setItem'> & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return { items, getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) };
}

function draft(tag: string): Omit<FeedbackNote, 'notBefore'> {
  return {
    tag,
    createdAt: '2026-10-10T10:00:00.000Z',
    text: 'The bench blocks the path',
    context: {
      version: 'dev',
      builtAt: '',
      screen: 'Raid',
      scenes: ['world'],
      details: [],
      window: '1280x800 at 1x',
      browser: 'test',
      mode: 'normal',
      takenAt: '2026-10-10T10:00:00.000Z',
    },
    actions: [],
    picture: null,
    voice: [],
    voiceMs: 0,
    save: null,
  };
}

const noon = new Date(2026, 9, 10, 12, 0);

describe('the courier', () => {
  it('keeps a message in the pack when there is nowhere to send it yet', async () => {
    const outbox = memoryOutbox();
    const courier = createCourier({ outbox, storage: storage() });
    expect(await courier.dispatch(draft('FB-AAAA'), noon)).toBe('queued');
    expect((await outbox.waiting()).map((note) => note.tag)).toEqual(['FB-AAAA']);
  });

  it('puts the message in the pack before it tries to send it, and takes it out only once the server has it', async () => {
    const outbox = memoryOutbox();
    const seen: string[][] = [];
    const send: FeedbackSender = async (note) => {
      seen.push((await outbox.waiting()).map((kept) => kept.tag));
      return note.tag === 'FB-BBBB';
    };
    const courier = createCourier({ outbox, storage: storage(), send });
    expect(await courier.dispatch(draft('FB-AAAA'), noon)).toBe('queued');
    expect(await courier.dispatch(draft('FB-BBBB'), noon)).toBe('sent');
    expect(seen).toEqual([['FB-AAAA'], ['FB-AAAA', 'FB-BBBB']]);
    expect((await outbox.waiting()).map((note) => note.tag)).toEqual(['FB-AAAA']);
  });

  it('keeps a message whose send threw', async () => {
    const outbox = memoryOutbox();
    const courier = createCourier({ outbox, storage: storage(), send: () => Promise.reject(new Error('offline')) });
    expect(await courier.dispatch(draft('FB-AAAA'), noon)).toBe('queued');
    expect(await outbox.waiting()).toHaveLength(1);
  });

  it('holds a message over the daily limit for tomorrow instead of refusing it', async () => {
    const outbox: FeedbackOutbox = memoryOutbox();
    const kept = storage();
    const sent: string[] = [];
    const courier = createCourier({ outbox, storage: kept, send: (note) => Promise.resolve(Boolean(sent.push(note.tag))) });
    for (let index = 0; index < DAILY_FEEDBACK_LIMIT; index += 1) {
      expect(await courier.dispatch(draft(`FB-AAA${index + 2}`), noon)).toBe('sent');
    }
    expect(await courier.dispatch(draft('FB-HELD'), noon)).toBe('held');
    expect(sent).toHaveLength(DAILY_FEEDBACK_LIMIT);
    const [held] = await outbox.waiting();
    expect(held.tag).toBe('FB-HELD');
    expect(held.notBefore).toBe(new Date(2026, 9, 11).toISOString());
    expect(JSON.parse(kept.items.get(DAILY_COUNT_KEY)!)).toEqual({ day: '2026-10-10', count: DAILY_FEEDBACK_LIMIT });
  });
});
