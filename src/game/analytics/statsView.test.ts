import { describe, expect, it } from 'vitest';
import { rememberSignInDestination, takeSignInDestination, isStatsRequest } from '../maker/review';
import { readPlayStats, type PlayStats } from './playStats';
import { barHeights, CHART_HEIGHT, dayWords, playedWords, statsScreen } from './statsView';

function days(players: readonly number[]) {
  return players.map((count, index) => ({
    day: `2026-10-${String(index + 1).padStart(2, '0')}`,
    players: count,
    newPlayers: Math.min(1, count),
    sessions: count * 2,
    seconds: count * 600,
    newNames: Math.floor(count / 2),
  }));
}

const STATS: PlayStats = {
  today: '2026-10-12',
  playersToday: 3,
  playersWeek: 9,
  playersAllTime: 41,
  returningWeek: 4,
  returningAllTime: 12,
  namedToday: 2,
  namedWeek: 5,
  namedAllTime: 10,
  days: days([0, 1, 4, 2, 0, 0, 8]),
  month: {
    'raid-start': 20,
    'raid-end:extracted': 11,
    'raid-end:wiped': 5,
    'raid-end:clock': 2,
    'raid-end:abandoned': 1,
    'starter:charmander': 6,
    'blocks:pallet-blocks': 7,
    'map-sent': 2,
    harbour: 30,
    'build:abc1234': 25,
    'build:def5678': 4,
  },
  allTime: { 'raid-start': 120, 'played-seconds': 7_800 },
};

describe('reading the counts', () => {
  it('reads the database answer', () => {
    const read = readPlayStats({ ...STATS, days: STATS.days });
    expect(read).toEqual(STATS);
  });

  it('refuses what is not an answer, and never trusts a number', () => {
    expect(readPlayStats(null)).toBeUndefined();
    expect(readPlayStats({ today: 'yesterday', days: [] })).toBeUndefined();
    expect(readPlayStats({ today: '2026-10-12', days: [{ day: '<b>' }] })).toBeUndefined();
    const odd = readPlayStats({ today: '2026-10-12', days: [], playersToday: -4, month: { a: 'x', b: 2.7 } });
    expect(odd?.playersToday).toBe(0);
    expect(odd?.month).toEqual({ a: 0, b: 2 });
  });
});

describe('the STATS screen', () => {
  it('leads with players today, this week and ever', () => {
    const screen = statsScreen({ step: 'loaded', stats: STATS });
    expect(screen).toContain('Play stats');
    expect(screen).toContain('3 players today');
    for (const words of ['Today', 'This week', 'All time', 'Came back', '4 this week · 12 ever']) {
      expect(screen).toContain(words);
    }
  });

  it('puts named players beside the visitors they came from', () => {
    const screen = statsScreen({ step: 'loaded', stats: STATS });
    expect(screen).toContain('Named players');
    expect(screen).toContain('10 · 5 this week · 2 today');
    expect(screen).toContain('10 of 41 (24%)');
    expect(screen).toContain('New names each day');
    expect(screen).toMatch(/stats-bar is-today" style="--bar:40" title="7 Oct: 4 new names"/);
    expect(statsScreen({ step: 'loaded', stats: { ...STATS, playersAllTime: 0 } })).toContain('no visitors yet');
  });

  it('says how raids ended in plain words', () => {
    const screen = statsScreen({ step: 'loaded', stats: STATS });
    for (const [name, value] of [
      ['Raids started', '20'],
      ['Got out', '11'],
      ['Wiped out', '5'],
      ['Clock ran out', '2'],
      ['Left mid-raid', '1'],
      ['Pallet Blocks games', '7'],
      ['Maps sent in', '2'],
    ] as const) {
      expect(screen).toMatch(new RegExp(`${name}</span></span><strong class="stats-value">${value}<`));
    }
    expect(screen).toContain('Bulbasaur 0 · Charmander 6 · Squirtle 0');
    expect(screen).toContain('abc1234 (25) · def5678 (4)');
    expect(screen).toContain('120 raids · 2 hours 10 minutes played');
  });

  it('draws a bar for every day, busiest full height, today in gold', () => {
    const screen = statsScreen({ step: 'loaded', stats: STATS });
    expect(screen.match(/class="stats-bar[" ]/g)).toHaveLength(STATS.days.length * 2);
    expect(screen).toContain(`style="--bar:${CHART_HEIGHT}"`);
    expect(screen).toMatch(/stats-bar is-today" style="--bar:40" title="7 Oct: 8 players"/);
  });

  it('asks a stranger to sign in, and tells a signed-in stranger no', () => {
    expect(statsScreen({ step: 'signed-out' })).toContain('data-sign-in');
    expect(statsScreen({ step: 'signed-out', reason: 'GitHub sign-in is not switched on yet.' })).toContain('not switched on');
    expect(statsScreen({ step: 'not-owner' })).toContain('cannot see the play stats');
    expect(statsScreen({ step: 'failed', reason: 'Try <again>' })).toContain('Try &lt;again&gt;');
  });

  it('types no arrows, as no pixel-ui screen may', () => {
    expect(statsScreen({ step: 'loaded', stats: STATS })).not.toMatch(/[←→↑↓▶✓]/);
  });
});

describe('the words', () => {
  it('puts time the way a person would', () => {
    expect(playedWords(0)).toBe('none yet');
    expect(playedWords(30)).toBe('under a minute');
    expect(playedWords(60)).toBe('1 minute');
    expect(playedWords(3600)).toBe('1 hour');
    expect(playedWords(3600 * 26 + 120)).toBe('26 hours 2 minutes');
  });

  it('names a day', () => {
    expect(dayWords('2026-10-12')).toBe('12 Oct');
    expect(dayWords('2027-01-01')).toBe('1 Jan');
  });

  it('gives any day with a player at least a pixel', () => {
    expect(barHeights(days([0, 1, 1000]))).toEqual([0, 1, CHART_HEIGHT]);
    expect(barHeights(days([0, 0]))).toEqual([0, 0]);
    expect(barHeights(days([0, 2, 4]), 'newNames')).toEqual([0, CHART_HEIGHT / 2, CHART_HEIGHT]);
  });
});

describe('signing in to read them', () => {
  const tab = () => {
    const stored = new Map<string, string>();
    return {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
      removeItem: (key: string) => void stored.delete(key),
    };
  };

  it('comes back to the stats once, then to the review list', () => {
    const storage = tab();
    rememberSignInDestination('stats', storage);
    expect(takeSignInDestination(storage)).toBe('stats');
    expect(takeSignInDestination(storage)).toBe('review');
  });

  it('is opened by address', () => {
    expect(isStatsRequest('?stats')).toBe(true);
    expect(isStatsRequest('?stats=1')).toBe(true);
    expect(isStatsRequest('?review=1')).toBe(false);
  });
});
