import { describe, expect, it } from 'vitest';
import { HarbourSession, placeFor, type HarbourIdentity } from './harbour';
import type { HarbourWire } from './harbourLink';
import type { HarbourPlace } from './harbourProtocol';
import { harbourMode, membersOf } from './harbourWire';

const ME = '11111111-1111-4111-8111-111111111111';

class QuietWire implements HarbourWire {
  public joins: [string | null, HarbourPlace | null][] = [];
  public join(as: string | null, place: HarbourPlace | null): Promise<boolean> {
    this.joins.push([as, place]);
    return Promise.resolve(true);
  }
  public standIn(): void {}
  public send(): void {}
  public names(): Promise<ReadonlyMap<string, string>> {
    return Promise.resolve(new Map());
  }
  public leave(): Promise<void> {
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

  it('stays watching when the database will not take the name', async () => {
    const wire = new QuietWire();
    const session = new HarbourSession(wire, { seenAs: () => Promise.resolve(null) });
    session.stand('yard', { x: 16, y: 13 }, 'up', 'OLLY');
    await settle();
    expect(session.seenAs).toBeNull();
    expect(wire.joins).toEqual([[null, null]]);
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
