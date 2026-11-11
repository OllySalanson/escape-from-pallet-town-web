import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HarbourHeard, HarbourWire } from '../harbour/harbourLink';
import { HARBOUR_SEND_EVERY_MS } from '../harbour/harbourProtocol';
import {
  FRIEND_NEWS_MS,
  FriendRoom,
  ROOM_ANSWER_MS,
  ROOM_CLOSED_LINE,
  ROOM_GIVE_UP_MS,
  ROOM_OFFLINE_LINE,
  ROOM_RETRY_MS,
} from './friendRoom';
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

  it('carries what a friend wears, believing only the boutique\'s own pieces', () => {
    const dressed: RaidMove = { ...move, look: { head: 'hiker-hat', top: 'plain-tee', legs: 'plain-trousers', body: 'hiker-gear' } };
    expect(readRaidMove(encodeRaidMove(dressed))).toEqual(dressed);
    expect('w' in encodeRaidMove(move)).toBe(false);
    // A look that is not one is the classic figure, and the steps are still believed.
    expect(readRaidMove({ ...encodeRaidMove(move), w: ['hiker-gear', 'plain-tee', 'hiker-hat'] })).toEqual(move);
    expect(readRaidMove({ ...encodeRaidMove(move), w: 'hiker-hat' })).toEqual(move);
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
  public signals: Record<string, unknown>[] = [];
  public signal(payload: Record<string, unknown>): void {
    this.signals.push(payload);
  }
  public signalFromFriend(payload: unknown): void {
    this.heard?.signal?.(payload);
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
  /** The room has closed under this player: run out its hour, or left from another tab. */
  public closed = false;
  /** The connection is gone: every claim fails at once (`down`), or is never answered (`hang`). */
  public offline: 'down' | 'hang' | null = null;
  public asked: string[] = [];
  public takeLoot(_code: string, lootId: string): Promise<LootClaim> {
    this.asked.push(lootId);
    if (this.offline === 'hang') {
      return new Promise(() => undefined);
    }
    if (this.offline === 'down') {
      return Promise.resolve({ outcome: 'unreachable' });
    }
    if (this.closed) {
      return Promise.resolve({ outcome: 'closed' });
    }
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

  it('keeps what the player steps on once the room has closed under them, and says so once', async () => {
    // The bug hunt of 9 Nov: a room's hour ran out mid-raid, every claim was
    // refused, and not one piece on the map could be picked up, silently.
    const { room, service } = await inRoom();
    room.tick(1_000, 16);
    service.taken.set('potion', ASH);
    room.loot.heard('potion', ASH);
    service.closed = true;
    room.claimLoot('poke-ball');
    await settle();
    expect(room.standing).toBe('closed');
    expect(room.loot.holder('poke-ball')).toBe(ME);
    expect(room.news()?.line).toBe(ROOM_CLOSED_LINE);
    // After that it asks nobody: there is nobody left in the room to be first.
    room.claimLoot('great-ball');
    expect(room.loot.holder('great-ball')).toBe(ME);
    expect(service.asked).toEqual(['poke-ball']);
    // A piece already heard taken stays taken.
    room.claimLoot('potion');
    expect(room.loot.holder('potion')).toBe(ASH);
    // And a room left at the lab is a fresh start for the next.
    room.leave();
    expect(room.standing).toBe('answering');
  });

  describe('a room that stops answering', () => {
    // The bug hunt of 10 Nov: with the connection gone a step onto the room's
    // ground claimed it, the claim failed, and nothing was said; stepping on it
    // again only asked again, and a request that hung kept the piece for good.
    afterEach(() => {
      vi.useRealTimers();
    });

    it('says so, asks again, and gives the piece the moment the room answers, wherever the player is', async () => {
      const { room, service } = await inRoom();
      room.tick(1_000, 16);
      service.offline = 'down';
      room.claimLoot('poke-ball');
      await settle();
      expect(room.standing).toBe('not-answering');
      expect(room.loot.holder('poke-ball')).toBeUndefined();
      // Asked again on the room's own pace, not on every frame.
      room.tick(1_000 + ROOM_RETRY_MS - 1, 16);
      await settle();
      expect(service.asked).toEqual(['poke-ball']);
      room.tick(1_000 + ROOM_RETRY_MS, 16);
      await settle();
      expect(service.asked).toEqual(['poke-ball', 'poke-ball']);
      expect(room.standing).toBe('not-answering');
      // The connection comes back: the next asking wins it, with no step.
      service.offline = null;
      room.tick(1_000 + 2 * ROOM_RETRY_MS, 16);
      await settle();
      expect(room.loot.holder('poke-ball')).toBe(ME);
      expect(room.standing).toBe('answering');
      // Nothing waits, so nothing is asked again.
      room.tick(1_000 + 4 * ROOM_RETRY_MS, 16);
      await settle();
      expect(service.asked).toHaveLength(3);
    });

    it('gives up on a room silent for long enough: what the player finds is theirs, said once', async () => {
      const { room, service } = await inRoom();
      room.tick(1_000, 16);
      service.taken.set('potion', ASH);
      room.loot.heard('potion', ASH);
      service.offline = 'down';
      room.claimLoot('poke-ball');
      await settle();
      room.tick(1_000 + ROOM_GIVE_UP_MS - 1, 16);
      await settle();
      expect(room.standing).toBe('not-answering');
      room.tick(1_000 + ROOM_GIVE_UP_MS, 16);
      await settle();
      expect(room.standing).toBe('offline');
      expect(room.loot.holder('poke-ball')).toBe(ME);
      expect(room.news()?.line).toBe(ROOM_OFFLINE_LINE);
      // From then on nobody is asked, and a piece heard taken stays taken.
      const asked = service.asked.length;
      room.claimLoot('great-ball');
      expect(room.loot.holder('great-ball')).toBe(ME);
      room.claimLoot('potion');
      expect(room.loot.holder('potion')).toBe(ASH);
      expect(service.asked).toHaveLength(asked);
      room.leave();
      expect(room.standing).toBe('answering');
    });

    it('counts a request that never comes back as no answer', async () => {
      const { room, service } = await inRoom();
      // After joining: the room is joined on real time.
      vi.useFakeTimers();
      room.tick(1_000, 16);
      service.offline = 'hang';
      room.claimLoot('poke-ball');
      expect(room.loot.isClaiming('poke-ball')).toBe(true);
      await vi.advanceTimersByTimeAsync(ROOM_ANSWER_MS);
      expect(room.loot.isClaiming('poke-ball')).toBe(false);
      expect(room.standing).toBe('not-answering');
    });

    it('starts the clock on giving up again whenever the room answers anything', async () => {
      const { room, service } = await inRoom();
      const answered = service.takeLoot.bind(service);
      // One piece the room never answers for; everything else it does.
      service.takeLoot = (code, lootId) => (lootId === 'poke-ball' ? Promise.resolve({ outcome: 'unreachable' }) : answered(code, lootId));
      room.tick(1_000, 16);
      room.claimLoot('poke-ball');
      await settle();
      room.tick(1_000 + ROOM_GIVE_UP_MS - 1_000, 16);
      room.claimLoot('great-ball');
      await settle();
      expect(room.loot.holder('great-ball')).toBe(ME);
      // Still waiting on the one piece, and not given up on: it answered a second ago.
      room.tick(1_000 + ROOM_GIVE_UP_MS, 16);
      await settle();
      expect(room.standing).toBe('not-answering');
      expect(room.loot.holder('poke-ball')).toBeUndefined();
    });
  });

  it('claims, says and hears a vale piece by a key the database takes, and keeps the game’s id', async () => {
    // The bug hunt of 9 Nov: `greystone-vale/spot-31` was refused by the
    // database and thrown away off the channel, so nothing in a friend raid
    // on the vale could be picked up, or seen to go.
    const { room, wire, service } = await inRoom();
    room.inRaid('route-1', { x: 1, y: 1 }, 'down');
    wire.present([[ME, mapPlace('route-1')], [ASH, mapPlace('route-1')]]);
    await settle();
    room.claimLoot('greystone-vale/spot-31');
    await settle();
    expect(service.asked).toEqual(['greystone-vale:sspot-31']);
    expect(room.loot.holder('greystone-vale/spot-31')).toBe(ME);
    expect(wire.signals).toContainEqual({ k: 't', u: ME, l: 'greystone-vale:sspot-31' });
    wire.signalFromFriend({ k: 't', u: ASH, l: 'greystone-vale:sprize-2' });
    expect(room.loot.holder('greystone-vale/prize-2')).toBe(ASH);
    // And what was taken before this player dropped in, by the same key.
    service.taken.set('greystone-vale:sspot-9', ASH);
    room.askWhatWasTaken();
    await settle();
    expect(room.loot.holder('greystone-vale/spot-9')).toBe(ASH);
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
