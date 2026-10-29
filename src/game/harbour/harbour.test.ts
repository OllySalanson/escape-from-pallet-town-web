import { afterEach, describe, expect, it, vi } from 'vitest';
import { AWAY_TICK_MS, HarbourSession, placeFor, type HarbourIdentity } from './harbour';
import { AWAY_GRACE_MS, LEAVE_AFTER_MS, type HarbourWire } from './harbourLink';
import type { HarbourPlace } from './harbourProtocol';
import { harbourMode, membersOf } from './harbourWire';

const ME = '11111111-1111-4111-8111-111111111111';

class QuietWire implements HarbourWire {
  public joins: [string | null, HarbourPlace | null][] = [];
  public stood: (HarbourPlace | null)[] = [];
  public left = 0;
  public join(as: string | null, place: HarbourPlace | null): Promise<boolean> {
    this.joins.push([as, place]);
    return Promise.resolve(true);
  }
  public standIn(place: HarbourPlace | null): void {
    this.stood.push(place);
  }
  public send(): void {}
  public nudge(): void {}
  public names(): Promise<ReadonlyMap<string, string>> {
    return Promise.resolve(new Map());
  }
  public leave(): Promise<void> {
    this.left += 1;
    return Promise.resolve();
  }
}

const settle = async () => {
  for (let turn = 0; turn < 4; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('where the shared harbour has the player', () => {
  it('shares the yard and the keepers rooms, and keeps each house its owner', () => {
    expect(placeFor('yard', ME)).toBe('yard');
    expect(placeFor('pokemon-centre', null)).toBe('pokemon-centre');
    expect(placeFor('home', ME)).toBe(`house:${ME}`);
    expect(placeFor('home-upstairs', ME)).toBe(`house:${ME}:up`);
    // Nobody can be in the house of a player nobody can see.
    expect(placeFor('home', null)).toBeNull();
    // A visitor stands in the owner's house, which is where the owner sees them.
    const AMY = '22222222-2222-4222-8222-222222222222';
    expect(placeFor({ visiting: AMY, upstairs: false }, ME)).toBe(`house:${AMY}`);
    expect(placeFor({ visiting: AMY, upstairs: true }, null)).toBe(`house:${AMY}:up`);
  });

  it('watches until a name is given, then is seen as the player the name was written for', async () => {
    const asked: string[] = [];
    const identity: HarbourIdentity = {
      seenAs: (name) => {
        asked.push(name);
        return Promise.resolve(ME);
      },
    };
    const wire = new QuietWire();
    const session = new HarbourSession(wire, identity);
    session.stand('yard', { x: 16, y: 13 }, 'up', null);
    await settle();
    expect(wire.joins).toEqual([[null, null]]);
    session.stand('home', { x: 7, y: 8 }, 'up', 'OLLY');
    await settle();
    expect(asked).toEqual(['OLLY']);
    expect(session.seenAs).toBe(ME);
    expect(wire.joins.at(-1)).toEqual([ME, `house:${ME}`]);
    // The same name again is not written again.
    session.stand('yard', { x: 26, y: 11 }, 'down', 'OLLY');
    await settle();
    expect(asked).toEqual(['OLLY']);
  });

  it('joins the channel again under a new name, so everybody else asks for it', async () => {
    const wire = new QuietWire();
    const session = new HarbourSession(wire, { seenAs: () => Promise.resolve(ME) });
    session.stand('yard', { x: 16, y: 13 }, 'up', 'OLLY');
    await settle();
    const left = wire.left;
    const joins = wire.joins.length;
    // Out of the console's "Change name", back in the house.
    session.stand('home-upstairs', { x: 8, y: 5 }, 'left', 'OLLIE');
    await settle();
    expect(wire.left).toBe(left + 1);
    expect(wire.joins.slice(joins)).toEqual([[ME, `house:${ME}:up`]]);
    // The same name again joins nothing.
    session.stand('home-upstairs', { x: 8, y: 5 }, 'left', 'OLLIE');
    await settle();
    expect(wire.left).toBe(left + 1);
  });

  it('stays watching when the database will not take the name', async () => {
    const wire = new QuietWire();
    const session = new HarbourSession(wire, { seenAs: () => Promise.resolve(null) });
    session.stand('yard', { x: 16, y: 13 }, 'up', 'OLLY');
    await settle();
    expect(session.seenAs).toBeNull();
    expect(wire.joins).toEqual([[null, null]]);
  });
});

describe('a player whose scene has gone', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is taken off everybody else\'s screens, then off the channel, with no scene left to tick the link', async () => {
    vi.useFakeTimers();
    const wire = new QuietWire();
    const session = new HarbourSession(wire, { seenAs: () => Promise.resolve(ME) });
    session.stand('yard', { x: 16, y: 13 }, 'up', 'OLLY');
    await vi.advanceTimersByTimeAsync(0);
    session.tick(5_000, 16);
    expect(wire.stood).not.toContain(null);
    // Joined to watch, then again as the player once the name was written.
    const left = wire.left;
    // Into the Raid Arena's loadout: the base scene has gone, and nothing ticks the link but the session.
    session.away();
    await vi.advanceTimersByTimeAsync(AWAY_GRACE_MS - AWAY_TICK_MS);
    expect(wire.stood).not.toContain(null);
    await vi.advanceTimersByTimeAsync(AWAY_TICK_MS);
    expect(wire.stood.at(-1)).toBeNull();
    expect(wire.left).toBe(left);
    await vi.advanceTimersByTimeAsync(LEAVE_AFTER_MS);
    expect(wire.left).toBe(left + 1);
    // Nothing more is ticked once it has left.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops keeping the clock once a scene stands the player somewhere again', async () => {
    vi.useFakeTimers();
    const wire = new QuietWire();
    const session = new HarbourSession(wire, { seenAs: () => Promise.resolve(ME) });
    session.stand('yard', { x: 16, y: 13 }, 'up', 'OLLY');
    await vi.advanceTimersByTimeAsync(0);
    session.tick(5_000, 16);
    const left = wire.left;
    // Through a door: the old scene goes, the new one stands the player in the room.
    session.away();
    session.stand('oaks-lab', { x: 6, y: 11 }, 'up', 'OLLY');
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(AWAY_GRACE_MS + LEAVE_AFTER_MS);
    expect(wire.stood).not.toContain(null);
    expect(wire.left).toBe(left);
  });
});

describe('which wire a page uses', () => {
  it('is the live project for players, and never the live project for an automated check', () => {
    expect(harbourMode('off', '')).toBe('live');
    expect(harbourMode('logic', '?testmode=1')).toBe('off');
    expect(harbourMode('pixels', '?testmode=pixels&harbour=local')).toBe('local');
    expect(harbourMode('logic', '?testmode=1&harbour=live')).toBe('off');
  });

  it("reads who is present off Realtime's presence state, keeping only players and places", () => {
    const members = membersOf({
      [ME]: [{ p: 'yard', presence_ref: 'a' }],
      'not-a-player': [{ p: 'yard' }],
      '22222222-2222-4222-8222-222222222222': [{ p: 'the moon' }],
    });
    expect([...members]).toEqual([[ME, 'yard']]);
  });
});
