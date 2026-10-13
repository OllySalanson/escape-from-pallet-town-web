import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STARTER_SPECIES } from '../stash/Stash';
import { WORLD_MAPS } from '../worldMap';
import {
  buildDetail,
  IDLE_AFTER_MS,
  isAutomatedBrowser,
  isTesterBrowser,
  markTesterBrowser,
  testerLinkAsks,
  testerMarkChosen,
  TESTER_LINK,
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

// The migration that last wrote what a batch may hold: the checks the game is held to.
const folder = new URL('../../../supabase/migrations/', import.meta.url);
const migration = readdirSync(folder)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(new URL(name, folder), 'utf8'))
  .filter((sql) => sql.includes("moment_kind = 'starter'"))
  .at(-1)!;

const PUBLISHED: CountingWorld = {
  production: true,
  testMode: false,
  hostname: 'ollysalanson.github.io',
  pathname: '/escape-from-pallet-town-web/',
  automated: false,
  doNotTrack: null,
  globalPrivacyControl: undefined,
};

function host(overrides: Partial<CounterHost> = {}) {
  let time = 1_000_000;
  const sent: { events: readonly SentMoment[]; keepalive: boolean; visitor: string; build: string; tester: boolean }[] = [];
  const send: SendBatch = (batch, keepalive) => {
    sent.push({ events: batch.events, keepalive, visitor: batch.visitor_id, build: batch.build, tester: batch.tester });
    return Promise.resolve();
  };
  const made: CounterHost = {
    now: () => time,
    visible: () => true,
    online: () => true,
    visitorId: () => '6f1c2b8e-1d2a-4c3b-9e4f-5a6b7c8d9e0f',
    tester: () => false,
    build: 'abc1234',
    send,
    ...overrides,
  };
  return { host: made, sent, advance: (ms: number) => (time += ms) };
}

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

describe('whether a page counts', () => {
  it('counts only the published game', () => {
    expect(shouldCount(PUBLISHED)).toBe(true);
    expect(shouldCount({ ...PUBLISHED, production: false })).toBe(false);
    expect(shouldCount({ ...PUBLISHED, testMode: true })).toBe(false);
    expect(shouldCount({ ...PUBLISHED, hostname: 'localhost' })).toBe(false);
    expect(shouldCount({ ...PUBLISHED, hostname: '127.0.0.1' })).toBe(false);
  });

  it('counts only the published address, never a copy somewhere else', () => {
    expect(shouldCount({ ...PUBLISHED, pathname: '/escape-from-pallet-town-web/index.html' })).toBe(true);
    expect(shouldCount({ ...PUBLISHED, hostname: 'example.com' })).toBe(false);
    expect(shouldCount({ ...PUBLISHED, hostname: 'ollysalanson.github.io.evil.example' })).toBe(false);
    expect(shouldCount({ ...PUBLISHED, pathname: '/some-other-copy/' })).toBe(false);
    expect(TESTER_LINK).toBe('https://ollysalanson.github.io/escape-from-pallet-town-web/?tester');
  });

  it('never counts a browser a program is driving', () => {
    expect(shouldCount({ ...PUBLISHED, automated: true })).toBe(false);
    expect(isAutomatedBrowser({ webdriver: true, userAgent: CHROME })).toBe(true);
    // Two of the first night's six said what they were.
    expect(
      isAutomatedBrowser({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/150.0.0.0 Safari/537.36',
      }),
    ).toBe(true);
    expect(isAutomatedBrowser({ userAgent: 'noua' })).toBe(true);
    expect(isAutomatedBrowser({ userAgent: '' })).toBe(true);
    for (const agent of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome-Lighthouse',
      'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15 facebookexternalhit/1.1 Slackbot-LinkExpanding 1.0',
    ]) {
      expect(isAutomatedBrowser({ userAgent: agent }), agent).toBe(true);
    }
  });

  it('counts the browsers people play in', () => {
    for (const agent of [
      CHROME,
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
      'Mozilla/5.0 (Linux; Android 13; CUBOT KINGKONG 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    ]) {
      expect(isAutomatedBrowser({ webdriver: false, userAgent: agent }), agent).toBe(false);
    }
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
  it('sends nothing, not even the visit, until somebody presses a key or clicks', () => {
    const { host: page, sent, advance } = host();
    const counter = new PlayCounter(page);
    counter.count({ kind: 'visit' });
    advance(15_000);
    counter.flush(false);
    advance(60_000);
    counter.flush(true);
    expect(sent).toEqual([]);
    expect(counter.heardFrom()).toBe(false);
    for (let index = 0; index < 200; index += 1) {
      counter.count({ kind: 'harbour' });
    }
    expect(sent).toEqual([]);
    expect(counter.pending().length).toBeLessThanOrEqual(PLAY_BATCH_LIMIT);
    counter.touched();
    advance(20_000);
    counter.flush(false);
    expect(sent[0].events[0]).toEqual({ kind: 'visit' });
    expect(sent.flatMap((batch) => batch.events).at(-1)).toEqual({ kind: 'played', amount: 20 });
  });

  it('says with every batch whether this browser is a tester', () => {
    let tester = false;
    const { host: page, sent } = host({ tester: () => tester });
    const counter = new PlayCounter(page);
    counter.touched();
    counter.count({ kind: 'visit' });
    counter.flush(false);
    tester = true;
    counter.count({ kind: 'harbour' });
    counter.flush(false);
    expect(sent.map((batch) => batch.tester)).toEqual([false, true]);
  });

  it('batches moments with the time played and the build', () => {
    const { host: page, sent, advance } = host();
    const counter = new PlayCounter(page);
    counter.touched();
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
    counter.touched();
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
    counter.touched();
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
    counter.touched();
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
    counter.touched();
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
    throwing.touched();
    throwing.count({ kind: 'visit' });
    expect(() => throwing.flush(false)).not.toThrow();
  });

  it('never sends a batch the database would refuse for size', () => {
    const { host: page, sent } = host();
    const counter = new PlayCounter(page);
    counter.touched();
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

describe("a tester's browser", () => {
  const memory = () => {
    const stored = new Map<string, string>();
    return { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => void stored.set(key, value) };
  };

  it('is marked by the link, and unmarked by it', () => {
    expect(testerLinkAsks('?tester')).toBe(true);
    expect(testerLinkAsks('?tester=1')).toBe(true);
    expect(testerLinkAsks('?stats&tester')).toBe(true);
    for (const off of ['?tester=off', '?tester=no', '?tester=0', '?tester=FALSE']) {
      expect(testerLinkAsks(off)).toBe(false);
    }
    expect(testerLinkAsks('')).toBeUndefined();
    expect(testerLinkAsks('?stats')).toBeUndefined();
  });

  it('keeps its mark in its own storage, and is a player until marked', () => {
    const storage = memory();
    expect(isTesterBrowser(storage)).toBe(false);
    expect(testerMarkChosen(storage)).toBe(false);
    expect(markTesterBrowser(storage, true)).toBe(true);
    expect(isTesterBrowser(storage)).toBe(true);
    expect(markTesterBrowser(storage, false)).toBe(true);
    expect(isTesterBrowser(storage)).toBe(false);
    expect(testerMarkChosen(storage)).toBe(true);
    expect(markTesterBrowser(undefined, true)).toBe(false);
    const shut = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(markTesterBrowser(shut, true)).toBe(false);
    expect(isTesterBrowser(shut)).toBe(false);
  });
});

describe('the database agrees with the game', () => {
  it('counts a tester apart, and keeps a machine a machine', () => {
    expect(migration).toContain("cohort in ('player', 'tester', 'automated')");
    expect(migration).toContain("cohort = case when v.cohort = 'automated' then v.cohort else excluded.cohort end");
  });

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
