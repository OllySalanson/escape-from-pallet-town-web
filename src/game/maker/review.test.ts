import { describe, expect, it } from 'vitest';
import sampleLane from '../../maps/sample/sample-lane.json';
import type { MapFile } from '../world/mapFile';
import { checkMapFile } from '../world/mapFileChecks';
import { makerScreen, walkedCheck, type MakerViewState } from './makerView';
import { decide, isReviewReturn, queueOrder, reviewReturnUrl, type QueuedMap } from './review';

const SAMPLE = sampleLane as MapFile;

const queued = (changes: Partial<QueuedMap>): QueuedMap => ({
  id: 'a',
  receiptCode: 'ABCDEFGHJK',
  makerUid: 'u',
  makerName: 'Maker',
  mapName: 'Sample Lane',
  status: 'waiting',
  note: null,
  revision: 1,
  sentAt: '2026-10-03T00:00:00Z',
  file: SAMPLE,
  ...changes,
});

function screen(review: MakerViewState['review'], reviewing?: QueuedMap): string {
  return makerScreen({
    file: SAMPLE,
    tool: 'brush',
    brushId: 'grass',
    place: { kind: 'drop-in' },
    selected: undefined,
    zoom: 16,
    overview: true,
    checks: [...checkMapFile(SAMPLE), walkedCheck(false)],
    canUndo: false,
    canRedo: false,
    drafts: [],
    draftKey: 'review-ABCDEFGHJK',
    panel: 'review',
    sending: { step: 'checking' },
    sent: { step: 'loading' },
    review,
    reviewing,
  });
}

describe('the review list', () => {
  it('comes back from GitHub to this page, marked to open the list, and knows it when it does', () => {
    expect(reviewReturnUrl('http://localhost:5174/escape/?testmode=1#x')).toBe(
      'http://localhost:5174/escape/?review=1',
    );
    expect(isReviewReturn('?review=1&code=abc')).toBe(true);
    expect(isReviewReturn('?testmode=1')).toBe(false);
  });

  it('reads what is waiting first, oldest first, then what was decided, newest first', () => {
    const maps = [
      queued({ id: 'decided-old', status: 'approved', sentAt: '2026-10-01T00:00:00Z' }),
      queued({ id: 'waiting-new', sentAt: '2026-10-03T00:00:00Z' }),
      queued({ id: 'decided-new', status: 'rejected', sentAt: '2026-10-02T00:00:00Z' }),
      queued({ id: 'waiting-old', sentAt: '2026-10-01T00:00:00Z' }),
    ];
    expect([...maps].sort(queueOrder).map((map) => map.id)).toEqual([
      'waiting-old',
      'waiting-new',
      'decided-new',
      'decided-old',
    ]);
  });

  it('will not send a map back or turn it down without saying why', async () => {
    expect(await decide('a', 'sent_back', '  ')).toEqual({
      ok: false,
      reason: 'Say why, so its maker knows what to change.',
    });
    expect(await decide('a', 'rejected', '')).toMatchObject({ ok: false });
  });

  it('asks a stranger to sign in, and tells a signed-in stranger they do not review', () => {
    expect(screen({ step: 'signed-out' })).toContain('data-review-sign-in');
    expect(
      screen({ step: 'signed-out', reason: 'GitHub sign-in is not switched on yet.' }),
    ).toContain('GitHub sign-in is not switched on yet.');
    expect(screen({ step: 'not-reviewer' })).toContain('This account does not review maps.');
  });

  it('lists what was sent and, for the map open, the decision: who sent it, which try, and a note', () => {
    const markup = screen(
      { step: 'loaded', maps: [queued({}), queued({ id: 'b', status: 'sent_back', revision: 2 })] },
      queued({ revision: 2 }),
    );
    expect(markup).toContain('1 waiting');
    expect(markup).toContain('by <strong>Maker</strong>, try 2');
    expect(markup).toContain('data-review-note');
    for (const decision of ['approved', 'sent_back', 'rejected']) {
      expect(markup).toContain(`data-decide="${decision}"`);
    }
    expect(markup).toContain('Block this maker');
  });
});
