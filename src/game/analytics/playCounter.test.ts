import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STARTER_SPECIES } from '../stash/Stash';
import { WORLD_MAPS } from '../worldMap';
import {
  buildDetail,
  IDLE_AFTER_MS,
  mapDetail,
  PLAY_BATCH_LIMIT,
  PLAY_SECONDS_LIMIT,
  PlayCounter,
  playedMoments,
  raidEnding,
  shouldCount,
  storedVisitorId,
  toSent,
  type CounterHost,
  type CountingWorld,
  type SendBatch,
  type SentMoment,
} from './playCounter';

const folder = new URL('../../../supabase/migrations/', import.meta.url);
const migration = readFileSync(
  new URL(readdirSync(folder).find((name) => name.endsWith('_play_counts.sql'))!, folder),
  'utf8',
);

const PUBLISHED: CountingWorld = {
  production: true,
  testMode: false,
  hostname: 'ollysalanson.github.io',
  doNotTrack: null,
  globalPrivacyControl: undefined,
};

function host(overrides: Partial<CounterHost> = {}) {
  let time = 1_000_000;
  const sent: { events: readonly SentMoment[]; keepalive: boolean; visitor: string; build: string }[] = [];
  const send: SendBatch = (batch, keepalive) => {
    sent.push({ events: batch.events, keepalive, visitor: batch.visitor_id, build: batch.build });
    return Promise.resolve();
  };
  const made: CounterHost = {
    now: () => time,
    visible: () => true,
    online: () => true,
    visitorId: () => '6f1c2b8e-1d2a-4c3b-9e4f-5a6b7c8d9e0f',
    build: 'abc1234',
    send,
    ...overrides,
  };
  return { host: made, sent, advance: (ms: number) => (time += ms) };
}

describe('whether a page counts', () => {
  it('counts only the published game', () => {
    expect(shouldCount(PUBLISHED)).toBe(true);
    expect(shouldCount({ ...PUBLISHED, production: false })).toBe(false);
    expect(shouldCount({ ...PUBLISHED, testMode: true })).toBe(false);
    expect(shouldCount({ ...PUBLISHED, hostname: 'localhost' })).toBe(false);
    expect(shouldCount({ ...PUBLISHED, hostname: '127.0.0.1' })).toBe(false);
  });

  it('sends nothing for a browser that asks not to be tracked', () => {
    expect(shouldCount({ ...PUBLISHED, doNotTrack: '1' })).toBe(false);
    expect(shouldCount({ ...PUBLISHED, doNotTrack: 'yes' })).toBe(false);
    expect(shouldCount({ ...PUBLISHED, globalPrivacyControl: true })).toBe(false);
    expect(shouldCount({ ...PUBLISHED, doNotTrack: '0', globalPrivacyControl: false })).toBe(true);
  });
});

describe('what is sent', () => {
  it('names a shipped map and never a player map', () => {
    for (const id of Object.keys(WORLD_MAPS)) {
      expect(mapDetail(id)).toBe(id);
      expect(mapDetail(id)).toMatch(/^[a-z0-9-]{1,40}$/);
    }
    expect(mapDetail('player-the-den-of-steve')).toBe('player');
    expect(mapDetail('Something <odd>')).toBe('other');
  });

  it('cuts a build to what the database takes', () => {
    expect(buildDetail('abc1234')).toBe('abc1234');
    expect(buildDetail('dev')).toBe('dev');
    expect(buildDetail('a b<c>')).toBe('abc');
    expect(buildDetail('')).toBe('unknown');
    expect(buildDetail('x'.repeat(60))).toHaveLength(40);
  });

  it('reads a raid ending off its report', () => {
    expect(raidEnding({ outcome: 'ESCAPED' })).toBe('extracted');
    expect(raidEnding({ outcome: 'WIPED', cause: 'defeated' })).toBe('wiped');
    expect(raidEnding({ outcome: 'WIPED', cause: 'timer' })).toBe('clock');
  });

  it('splits played time into whole seconds an hour at a time', () => {
    expect(playedMoments(0.9)).toEqual([]);
    expect(playedMoments(61.5)).toEqual([{ kind: 'played', amount: 61 }]);
    expect(playedMoments(PLAY_SECONDS_LIMIT * 2 + 5).map((moment) => toSent(moment).amount)).toEqual([
      PLAY_SECONDS_LIMIT,
      PLAY_SECONDS_LIMIT,
      5,
    ]);
  });

  it('sends only the three fields the database reads', () => {
    expect(toSent({ kind: 'visit' })).toEqual({ kind: 'visit' });
    expect(toSent({ kind: 'starter', detail: 'squirtle' })).toEqual({ kind: 'starter', detail: 'squirtle' });
    expect(toSent({ kind: 'played', amount: 12 })).toEqual({ kind: 'played', amount: 12 });
  });
});

describe('the counter', () => {
  it('batches moments with the time played and the build', () => {
    const { host: page, sent, advance } = host();
    const counter = new PlayCounter(page);
    counter.count({ kind: 'visit' });
    counter.count({ kind: 'starter', detail: 'charmander' });
    advance(90_000);
    counter.flush(false);
    expect(sent).toHaveLength(1);
    expect(sent[0].build).toBe('abc1234');
    expect(sent[0].events).toEqual([
      { kind: 'visit' },
      { kind: 'starter', detail: 'charmander' },
      { kind: 'played', amount: 90 },
    ]);
    counter.flush(false);
    expect(sent).toHaveLength(1);
  });

  it('keeps part of a second for the next batch', () => {
    const { host: page, sent, advance } = host();
    const counter = new PlayCounter(page);
    advance(1500);
    counter.flush(false);
    advance(600);
    counter.flush(false);
    expect(sent.flatMap((batch) => batch.events)).toEqual([
      { kind: 'played', amount: 1 },
      { kind: 'played', amount: 1 },
    ]);
  });

  it('stops counting time five minutes after the last key or click', () => {
    const { host: page, sent, advance } = host();
    const counter = new PlayCounter(page);
    advance(IDLE_AFTER_MS + 60 * 60 * 1000);
    counter.flush(false);
    expect(sent[0].events).toEqual([{ kind: 'played', amount: IDLE_AFTER_MS / 1000 }]);
    counter.touched();
    advance(10_000);
    counter.flush(false);
    expect(sent[1].events).toEqual([{ kind: 'played', amount: 10 }]);
  });

  it('counts no time while the page is hidden', () => {
    let visible = false;
    const { host: page, sent, advance } = host({ visible: () => visible });
    const counter = new PlayCounter(page);
    advance(30_000);
    counter.settleTime();
    visible = true;
    advance(20_000);
    counter.flush(true);
    expect(sent[0]).toMatchObject({ keepalive: true, events: [{ kind: 'played', amount: 20 }] });
  });

  it('drops what it has when offline, and never throws for a failed send', async () => {
    let online = false;
    const failing: SendBatch = () => Promise.reject(new Error('no network'));
    const { host: page, sent } = host({ online: () => online });
    const counter = new PlayCounter({ ...page, send: failing });
    counter.count({ kind: 'visit' });
    counter.flush(false);
    online = true;
    expect(counter.pending()).toEqual([]);
    counter.count({ kind: 'harbour' });
    expect(() => counter.flush(false)).not.toThrow();
    await Promise.resolve();
    expect(sent).toEqual([]);
    const throwing = new PlayCounter({
      ...page,
      send: () => {
        throw new Error('sync');
      },
    });
    throwing.count({ kind: 'visit' });
    expect(() => throwing.flush(false)).not.toThrow();
  });

  it('never sends a batch the database would refuse for size', () => {
    const { host: page, sent } = host();
    const counter = new PlayCounter(page);
    for (let index = 0; index < 130; index += 1) {
      counter.count({ kind: 'harbour' });
    }
    counter.flush(false);
    expect(sent.length).toBeGreaterThan(2);
    for (const batch of sent) {
      expect(batch.events.length).toBeGreaterThan(0);
      expect(batch.events.length).toBeLessThanOrEqual(PLAY_BATCH_LIMIT);
      expect(JSON.stringify(batch.events).length).toBeLessThan(8000);
    }
    expect(sent.reduce((total, batch) => total + batch.events.length, 0)).toBe(130);
  });
});

describe("a browser's id", () => {
  const memory = () => {
    const stored = new Map<string, string>();
    return { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => void stored.set(key, value) };
  };
  const ids = ['0f0e0d0c-0b0a-4908-8706-050403020100', '11111111-2222-4333-8444-555555555555'];

  it('is made once and kept', () => {
    const storage = memory();
    let made = 0;
    const make = () => ids[made++];
    expect(storedVisitorId(storage, make)).toBe(ids[0]);
    expect(storedVisitorId(storage, make)).toBe(ids[0]);
    expect(made).toBe(1);
  });

  it('is made fresh when storage is shut or holds something else', () => {
    const shut = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
    };
    expect(storedVisitorId(shut, () => ids[1])).toBe(ids[1]);
    const odd = memory();
    odd.setItem('escape-from-pallet-town.play-counter.visitor', 'not an id');
    expect(storedVisitorId(odd, () => ids[1])).toBe(ids[1]);
  });
});

describe('the database agrees with the game', () => {
  it('holds a batch to the same size and an amount to the same hour', () => {
    expect(migration).toContain(`jsonb_array_length(events) not between 1 and ${PLAY_BATCH_LIMIT}`);
    expect(migration).toContain(`moment_amount between 1 and ${PLAY_SECONDS_LIMIT}`);
  });

  it('takes every starter the game offers, and nothing else', () => {
    const listed = /moment_kind = 'starter' and moment_detail in \(([^)]*)\)/.exec(migration)![1];
    const names = [...listed.matchAll(/'([a-z]+)'/g)].map((match) => match[1]).sort();
    expect(names).toEqual(STARTER_SPECIES.map((species) => species.id).sort());
  });

  it('takes every raid ending the game sends', () => {
    const listed = /moment_kind = 'raid-end' and moment_detail in \(([^)]*)\)/.exec(migration)![1];
    expect([...listed.matchAll(/'([a-z]+)'/g)].map((match) => match[1]).sort()).toEqual(
      ['abandoned', 'clock', 'extracted', 'wiped'],
    );
  });

  it('stores nothing raw and nothing a player typed', () => {
    expect(migration).not.toMatch(/create table [^(]*events/);
    expect(migration).toContain("where k.key not in ('kind', 'detail', 'amount')");
  });
});
