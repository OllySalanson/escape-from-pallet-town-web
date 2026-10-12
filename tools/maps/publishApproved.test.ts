import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareMaps, type Approved } from './prepareMaps';
import { markRequests, withLineage } from './projectRequests.mjs';

const SAMPLE = JSON.parse(readFileSync('src/maps/sample/sample-lane.json', 'utf8')) as Record<string, unknown>;
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const approved = (n: number, more: Partial<Approved> = {}): Approved => ({
  id: uuid(n),
  receipt_code: `MAP-${n}`,
  map: SAMPLE,
  map_file_id: null,
  lineage: null,
  ...more,
});

function folders(): { playerMaps: string; sampleMaps: string; out: string } {
  const root = mkdtempSync(join(tmpdir(), 'publish-'));
  return { playerMaps: mkdtempSync(join(root, 'player-')), sampleMaps: 'src/maps/sample', out: join(root, 'out') };
}

describe('publishing approved maps', () => {
  it('fails the run, and says why, when it has no key to read them with', () => {
    const env = { ...process.env };
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    const run = spawnSync('node', ['tools/maps/projectRequests.mjs', 'fetch', 'unused'], { env, encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('No SUPABASE_SERVICE_ROLE_KEY');
  });

  it('sends back a map the game cannot even read, and publishes the maps behind it (red team F1)', () => {
    const throwing = new Proxy(
      {},
      {
        get() {
          throw new TypeError('a map that throws');
        },
      },
    );
    const where = folders();
    const outcome = prepareMaps(
      [approved(1, { map: { ...SAMPLE, buildings: [{ kind: 'toString', x: 0, y: 0 }] } }), approved(2, { map: throwing }), approved(3)],
      [],
      where,
    );
    expect(outcome.sentBack.map((entry) => entry.submission)).toEqual([uuid(1), uuid(2)]);
    expect(outcome.sentBack[1].note).toContain('could not read this map');
    expect(outcome.published.map((entry) => entry.submission)).toEqual([uuid(3)]);
    expect(JSON.parse(readFileSync(join(where.out, 'outcome.json'), 'utf8'))).toEqual(outcome);
  });

  it('never gives a new map an id any map has been recorded under (red team F12)', () => {
    const where = folders();
    const outcome = prepareMaps([approved(1)], ['sample-lane-2'], where);
    // `sample-lane` is the sample's, `sample-lane-2` a removed map's.
    expect(outcome.published).toEqual([{ submission: uuid(1), receipt: 'MAP-1', id: 'sample-lane-3' }]);
    expect(readFileSync(join(where.out, 'maps', 'sample-lane-3.json'), 'utf8')).toBe(
      readFileSync(join(where.playerMaps, 'sample-lane-3.json'), 'utf8'),
    );
  });

  it('replaces a published map only with its own maker\'s update, and only while it is in the game', () => {
    const where = folders();
    writeFileSync(join(where.playerMaps, 'lane.json'), JSON.stringify({ ...SAMPLE, id: 'lane' }));
    const outcome = prepareMaps(
      [
        approved(1, { map_file_id: 'lane', lineage: false }),
        approved(2, { map_file_id: 'gone', lineage: true }),
        approved(3, { map_file_id: 'lane', lineage: true }),
      ],
      ['lane', 'gone'],
      where,
    );
    expect(outcome.sentBack.map((entry) => entry.submission)).toEqual([uuid(1), uuid(2)]);
    expect(outcome.published).toEqual([{ submission: uuid(3), receipt: 'MAP-3', id: 'lane' }]);
  });
});

describe('what the jobs that hold the key do', () => {
  const fetched = [
    { id: uuid(1), map_file_id: null },
    { id: uuid(2), map_file_id: 'lane' },
  ];

  it('marks an update as its maker\'s only when the newest published row under its file is theirs', () => {
    const rows = withLineage(
      [
        { id: uuid(1), receipt_code: 'A', maker_uid: 'm1', map: {}, map_file_id: 'lane' },
        { id: uuid(2), receipt_code: 'B', maker_uid: 'm1', map: {}, map_file_id: 'path' },
        { id: uuid(3), receipt_code: 'C', maker_uid: 'm2', map: {}, map_file_id: null },
      ],
      [
        { maker_uid: 'm1', map_file_id: 'lane', status: 'published', updated_at: '2026-10-01' },
        { maker_uid: 'm2', map_file_id: 'path', status: 'published', updated_at: '2026-10-01' },
        { maker_uid: 'm1', map_file_id: 'path', status: 'published', updated_at: '2026-09-01' },
      ],
    ) as { lineage: boolean | null; maker_uid?: string }[];
    expect(rows.map((row) => row.lineage)).toEqual([true, false, null]);
    // No player's id leaves the job that read it.
    expect(rows.every((row) => !('maker_uid' in row))).toBe(true);
  });

  it('acts only on submissions it fetched, with ids of the right shape', () => {
    const requests = markRequests(
      fetched,
      {
        sentBack: [
          { submission: uuid(1), note: 'x'.repeat(3000) },
          { submission: uuid(9), note: 'not fetched' },
          { submission: `${uuid(1)}&status=eq.published`, note: 'a filter smuggled in' },
        ],
        published: [],
      },
      true,
    ) as { submission: string; body: { owner_note: string } }[];
    expect(requests.map((request) => request.submission)).toEqual([uuid(1)]);
    expect(requests[0].body.owner_note).toHaveLength(2000);
  });

  it('marks a map published only once it has merged, and only under the file it may take', () => {
    const outcome = {
      sentBack: [],
      published: [
        { submission: uuid(1), id: 'new-lane' },
        { submission: uuid(2), id: 'someone-elses' },
        { submission: uuid(2), id: '../escape' },
        { submission: uuid(2), id: 'lane' },
      ],
    };
    expect(markRequests(fetched, outcome, false)).toEqual([]);
    expect(markRequests(fetched, outcome, true)).toEqual([
      { submission: uuid(1), body: { status: 'published', map_file_id: 'new-lane' } },
      { submission: uuid(2), body: { status: 'published', map_file_id: 'lane' } },
    ]);
  });
});
