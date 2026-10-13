import { describe, expect, it } from 'vitest';
import type { HarbourHeard, HarbourWire } from '../harbour/harbourLink';
import { HARBOUR_SEND_EVERY_MS } from '../harbour/harbourProtocol';
import { FRIEND_NEWS_MS, FriendRoom } from './friendRoom';
import { encodeRaidMove, isRaidPlace, mapPlace, raidMembersOf, readRaidMove, readRaidPresence, type RaidMove, type RaidPlace } from './raidProtocol';
import { isRoomCode, raidTopic, typedRoomCode } from './roomCode';
import { joinAnswer, ROOM_FULL, ROOM_NOT_FOUND, ROOM_UNREACHABLE, worded, type HeldRoom, type LootClaim, type RaidRoomService, type RoomAnswer } from './roomService';

const ME = '11111111-1111-4111-8111-111111111111';
const ASH = '22222222-2222-4222-8222-222222222222';

describe('a raid room code', () => {
  it('is typed as four capital consonants and nothing else', () => {
    expect(typedRoomCode('bh rk!')).toBe('BHRK');
    expect(typedRoomCode('aeiou')).toBe('');
    expect(typedRoomCode('bcdfg')).toBe('BCDF');
    expect(isRoomCode('BHRK')).toBe(true);
    expect(isRoomCode('BHR')).toBe(false);
    expect(isRoomCode('BARK')).toBe(false);
    expect(raidTopic('BHRK')).toBe('raid:BHRK');
  });
});

describe('what two players in a room tell each other', () => {
  const move: RaidMove = { from: ASH, place: mapPlace('route-1'), path: [{ x: 4, y: 5 }, { x: 4, y: 6 }], facing: 'down' };

  it('reads back exactly what the game sends', () => {
    expect(readRaidMove(encodeRaidMove(move))).toEqual(move);
  });

  it('takes a figure standing in a room laid east of a vast map', () => {
    expect(readRaidMove({ ...encodeRaidMove(move), s: [[300, 20]] })?.path).toEqual([{ x: 300, y: 20 }]);
  });

  it('drops anything else whole', () => {
    const wire = encodeRaidMove(move);
    for (const bad of [
      null,
      'move',
      { ...wire, u: 'ASH' },
      { ...wire, p: 'yard' },
      { ...wire, p: 'map:Route 1' },
      { ...wire, f: 'north' },
      { ...wire, s: [] },
      { ...wire, s: Array.from({ length: 9 }, () => [1, 1]) },
      { ...wire, s: [[1.5, 2]] },
      { ...wire, s: [[-1, 2]] },
      { ...wire, s: [[1, 99999]] },
    ]) {
      expect(readRaidMove(bad)).toBeNull();
    }
  });

  it('knows a player at the lab from a player on a map, and nothing else', () => {
    expect(isRaidPlace('lab')).toBe(true);
    expect(isRaidPlace('map:floodplain-relay')).toBe(true);
    expect(isRaidPlace('map:player-my-map')).toBe(true);
    expect(isRaidPlace('yard')).toBe(false);
    expect(readRaidPresence({ p: '<b>' })).toBeNull();
    expect(raidMembersOf({ [ASH]: [{ p: 'lab' }], nobody: [{ p: 'lab' }], [ME]: [{ p: 'nowhere' }] })).toEqual(
      new Map([[ASH, 'lab']]),
    );
  });
});

describe("what the database's answers mean", () => {
  it('reads a join as a room, held as host or guest', () => {
    expect(joinAnswer({ outcome: 'joined', map_id: 'route-1', host_uid: ASH, host_name: 'ASH' }, 'BHRK', ME, 7)).toEqual({
      ok: true,
      room: { code: 'BHRK', mapId: 'route-1', role: 'guest', me: ME, hostName: 'ASH', seed: 7 },
    });
    expect(joinAnswer({ outcome: 'joined', map_id: 'route-1', host_uid: ME, host_name: 'ME' }, 'BHRK', ME, 7)).toMatchObject({
      ok: true,
      room: { role: 'host', hostName: null },
    });
  });

  it('says a wrong code, a full room and anything strange in words', () => {
    expect(joinAnswer(undefined, 'BHRK', ME, 7)).toEqual({ ok: false, reason: ROOM_NOT_FOUND });
    expect(joinAnswer({ outcome: 'no-room', map_id: null, host_uid: null, host_name: null }, 'BHRK', ME, 7)).toEqual({ ok: false, reason: ROOM_NOT_FOUND });
    expect(joinAnswer({ outcome: 'full', map_id: null, host_uid: null, host_name: null }, 'BHRK', ME, 7)).toEqual({ ok: false, reason: ROOM_FULL });
    expect(joinAnswer({ outcome: 'joined', map_id: 'route-1', host_uid: 'x', host_name: 'ASH' }, 'BHRK', ME, 7)).toEqual({ ok: false, reason: ROOM_UNREACHABLE });
  });

  it("says the project's own refusals as they are worded, and nothing else it says", () => {
    expect(worded('One room at a time.')).toBe('One room at a time.');
    expect(worded('Thirty codes a day. Try again tomorrow.')).toBe('Thirty codes a day. Try again tomorrow.');
    expect(worded('permission denied for function open_raid_room')).toBe(ROOM_UNREACHABLE);
    expect(worded(undefined)).toBe(ROOM_UNREACHABLE);
  });
});

/** A wire that keeps what it is asked to do, and lets a test speak for the friend. */
class FakeWire implements HarbourWire<RaidPlace> {
  public stood: (RaidPlace | null)[] = [];
  public sent: RaidMove[] = [];
  public left = 0;
  private heard: HarbourHeard<RaidPlace> | null = null;
  public join(_as: string | null, place: RaidPlace | null, heard: HarbourHeard<RaidPlace>): Promise<boolean> {
    this.stood.push(place);
    this.heard = heard;
    return Promise.resolve(true);
  }
  public standIn(place: RaidPlace | null): void {
    this.stood.push(place);
  }
  public send(move: RaidMove): void {
    this.sent.push(move);
  }
  public nudge(): void {}
  public names(ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
    return Promise.resolve(new Map(ids.filter((id) => id === ASH).map((id) => [id, 'ASH'] as const)));
  }
  public leave(): Promise<void> {
    this.left += 1;
    return Promise.resolve();
  }
  public present(members: [string, RaidPlace][]): void {
    this.heard?.present(new Map(members));
  }
  public move(move: RaidMove): void {
    this.heard?.move(move);
  }
}

class FakeService implements RaidRoomService {
  public left: string[] = [];
  public open(mapId: string): Promise<RoomAnswer> {
    return Promise.resolve({ ok: true, room: { code: 'BHRK', mapId, role: 'host', me: ME, hostName: null, seed: 7 } satisfies HeldRoom });
  }
  public join(code: string): Promise<RoomAnswer> {
    return Promise.resolve(code === 'BHRK' ? { ok: true, room: { code, mapId: 'route-1', role: 'guest', me: ME, hostName: 'ASH', seed: 7 } } : { ok: false, reason: ROOM_NOT_FOUND });
  }
  public leave(code: string): Promise<void> {
    this.left.push(code);
    return Promise.resolve();
  }
  public taken = new Map<string, string>();
  public takeLoot(_code: string, lootId: string): Promise<LootClaim> {
    const holder = this.taken.get(lootId);
    if (holder !== undefined) {
      return Promise.resolve(holder === ME ? { outcome: 'yours' } : { outcome: 'taken', by: holder });
    }
    this.taken.set(lootId, ME);
    return Promise.resolve({ outcome: 'yours' });
  }
  public lootTaken(): Promise<ReadonlyMap<string, string>> {
    return Promise.resolve(this.taken);
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function inRoom(): Promise<{ room: FriendRoom; wire: FakeWire; service: FakeService }> {
  const wire = new FakeWire();
  const service = new FakeService();
  const room = new FriendRoom(service, () => wire);
  await room.open('route-1', 'ME');
  await settle();
  return { room, wire, service };
}

describe('raiding with a friend', () => {
  it('holds the room it made, at the lab, until the raid on its map', async () => {
    const { room, wire } = await inRoom();
    expect(room.room?.code).toBe('BHRK');
    expect(wire.stood).toEqual(['lab']);
    room.inRaid('viridian-forest', { x: 1, y: 1 }, 'down');
    expect(wire.stood).toEqual(['lab']);
    room.inRaid('route-1', { x: 1, y: 1 }, 'down');
    expect(wire.stood).toEqual(['lab', 'map:route-1']);
  });

  it('holds nothing for a code no room has', async () => {
    const room = new FriendRoom(new FakeService(), () => new FakeWire());
    expect(await room.join('ZZZZ', 'ME')).toEqual({ ok: false, reason: ROOM_NOT_FOUND });
    expect(room.room).toBeNull();
  });

  it('sees the friend arrive, walk and leave, and says so', async () => {
    const { room, wire } = await inRoom();
    room.inRaid('route-1', { x: 1, y: 1 }, 'down');
    wire.present([[ME, mapPlace('route-1')], [ASH, 'lab']]);
    await settle();
    room.tick(1_000, 16);
    expect(room.friends()).toEqual([{ id: ASH, name: 'ASH', place: 'lab' }]);
    expect(room.news()).toEqual({ name: 'ASH', came: true, at: 1_000 });

    wire.present([[ME, mapPlace('route-1')], [ASH, mapPlace('route-1')]]);
    wire.move({ from: ASH, place: mapPlace('route-1'), path: [{ x: 9, y: 9 }], facing: 'left' });
    room.tick(1_000 + FRIEND_NEWS_MS, 16);
    expect(room.news()).toBeNull();
    expect(room.figuresOn('route-1').map((figure) => [figure.name, figure.tile])).toEqual([['ASH', { x: 9, y: 9 }]]);
    expect(room.figuresOn('viridian-forest')).toEqual([]);

    // Gone from the channel: an exit, a loss and a closed tab are all this.
    wire.present([[ME, mapPlace('route-1')]]);
    room.tick(2_000 + FRIEND_NEWS_MS, 16);
    expect(room.friends()).toEqual([]);
    expect(room.news()).toMatchObject({ name: 'ASH', came: false });
    expect(room.figuresOn('route-1')).toEqual([]);
  });

  it('tells the friend where it walks, only while there is a friend to tell', async () => {
    const { room, wire } = await inRoom();
    room.inRaid('route-1', { x: 1, y: 1 }, 'down');
    room.moved({ x: 1, y: 2 }, 'down');
    room.tick(1_000, 16);
    expect(wire.sent).toEqual([]);
    wire.present([[ME, mapPlace('route-1')], [ASH, mapPlace('route-1')]]);
    await settle();
    room.tick(2_000, 16);
    room.moved({ x: 1, y: 3 }, 'down');
    room.moved({ x: 1, y: 3 }, 'down');
    room.tick(2_000 + HARBOUR_SEND_EVERY_MS, 16);
    expect(wire.sent.at(-1)?.path).toEqual([{ x: 1, y: 3 }]);
    expect(wire.sent.at(-1)?.place).toBe('map:route-1');
  });

  it('leaves the channel and the room at once when its raid ends', async () => {
    const { room, wire, service } = await inRoom();
    room.leave();
    expect(room.room).toBeNull();
    expect(wire.left).toBe(1);
    expect(service.left).toEqual(['BHRK']);
    room.leave();
    expect(service.left).toEqual(['BHRK']);
  });
});
