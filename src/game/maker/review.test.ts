import { describe, expect, it } from 'vitest';
import sampleLane from '../../maps/sample/sample-lane.json';
import type { MapFile } from '../world/mapFile';
import { checkMapFile } from '../world/mapFileChecks';
import { makerScreen, walkedCheck, type MakerViewState } from './makerView';
import { decide, isReviewReturn, queued as queuedRow, queueOrder, reviewReturnUrl, type QueuedMap } from './review';
import { summariseMapFile, summaryLine, summaryLines } from '../world/mapFileSummary';
import { escapeHtml } from './makerView';

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
  replaces: undefined,
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

  it('tells the reviewer a fix to a map in the game is an update, in its row and when it is open', () => {
    const update = queued({ id: 'u', replaces: 'mill-brook', revision: 2 });
    const markup = screen({ step: 'loaded', maps: [update, queued({})] }, update);
    expect(markup).toContain('Maker · Waiting to be played · try 2 · UPDATE');
    expect(markup).toContain(
      'An update to a map already in the game (mill-brook). Approving it replaces that map under the same id; drop-ins players have reached stay theirs.',
    );
    expect(screen({ step: 'loaded', maps: [queued({})] }, queued({}))).not.toContain('UPDATE');
  });

  it('reads a fix as an update only until it is published itself', () => {
    const row = {
      id: 'u',
      receipt_code: 'ABCDEFGHJK',
      maker_uid: 'm',
      maker_name: 'Maker',
      map_name: 'Sample Lane',
      map: SAMPLE,
      format: 1,
      owner_note: null,
      revision: 2,
      revision_of: 'p',
      map_file_id: 'sample-lane',
      created_at: '2026-10-03T00:00:00Z',
      updated_at: '2026-10-03T00:00:00Z',
    } as const;
    expect(queuedRow({ ...row, status: 'waiting' }).replaces).toBe('sample-lane');
    expect(queuedRow({ ...row, status: 'published' }).replaces).toBeUndefined();
    expect(queuedRow({ ...row, status: 'waiting', map_file_id: null }).replaces).toBeUndefined();
  });

  it('lists a row the game cannot read as unreadable, never blanking the rows beside it (red team F1)', () => {
    const row = {
      id: 'u',
      receipt_code: 'ABCDEFGHJK',
      maker_uid: 'm',
      maker_name: 'Maker',
      map_name: 'Sample Lane',
      format: 1,
      owner_note: null,
      revision: 1,
      revision_of: null,
      map_file_id: null,
      created_at: '2026-10-03T00:00:00Z',
      updated_at: '2026-10-03T00:00:00Z',
      status: 'waiting',
    } as const;
    const throwing = new Proxy(
      {},
      {
        get: () => {
          throw new TypeError('a map that throws');
        },
      },
    );
    const prototypeName = { ...SAMPLE, buildings: [{ kind: 'toString', x: 0, y: 0 }] };
    expect(queuedRow({ ...row, map: throwing }).file).toBeUndefined();
    expect(queuedRow({ ...row, map: prototypeName }).file).toBeUndefined();
    expect(queuedRow({ ...row, map: SAMPLE }).file).toBeDefined();
  });

  it('sums every map up in its row, and the map open in full, as advice beside the decision', () => {
    const summary = summariseMapFile(SAMPLE)!;
    const list = screen({ step: 'loaded', maps: [queued({})] });
    expect(list).toContain(escapeHtml(summaryLine(summary)));
    expect(list).not.toContain('At a glance');

    const open = screen({ step: 'loaded', maps: [queued({})] }, queued({}));
    expect(open).toContain('At a glance');
    for (const line of summaryLines(summary)) {
      expect(open).toContain(escapeHtml(line));
    }
    // Advice never stands between a map that works and its approval.
    expect(open).toContain('class="px-window px-button is-primary" data-decide="approved"');
  });

  it('leaves the summary off a row whose map no longer reads', () => {
    const list = screen({ step: 'loaded', maps: [queued({ file: undefined })] });
    expect(list).toContain('Sample Lane');
    expect(list).not.toContain(escapeHtml(summaryLine(summariseMapFile(SAMPLE)!)));
  });
});
