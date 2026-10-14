import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

const room = vi.hoisted(() => ({
  saying: null as string | null,
}));

vi.mock('../raidRoom/friendRoom', () => ({
  friendRoom: () => ({
    room: { code: 'BCDF', mapId: 'floodplain-relay' },
    moved: () => undefined,
    tick: () => undefined,
    talk: { saying: () => room.saying },
    figuresOn: () => [
      { id: 'amy', place: 'floodplain-relay', tile: { x: 10, y: 10 }, toward: null, progress: 0, facing: 'down', name: 'AMY' },
    ],
  }),
}));

import { WorldScene } from './WorldScene';

/**
 * Two friends in a raid room dropping in by the same door land on one tile, and
 * the friend's name plate over the head they share read as this player's own
 * (the raid half of playtest 48 finding 6, which the harbour already fixed).
 */
function friendsOnOneTile() {
  const calls: { figures: { name: string; speaking?: boolean }[]; self: unknown }[] = [];
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  const player = { x: 160, y: 156 };
  Object.assign(scene as object, {
    friendFigures: {
      update: (figures: { name: string; speaking?: boolean }[], self: unknown) => calls.push({ figures, self }),
    },
    currentMap: { id: 'floodplain-relay' },
    currentTile: { x: 10, y: 10 },
    facing: 'down',
    time: { now: 1000 },
    player,
    settleRoomLoot: () => undefined,
    talkInTheRoom: () => undefined,
    drawPings: () => undefined,
    openRoomDoors: () => undefined,
    surveyWithFriends: () => undefined,
  });
  const updateFriend = (scene as unknown as { updateFriend(delta: number): void }).updateFriend.bind(scene);
  return { updateFriend, calls, player };
}

describe('a friend on this player\'s tile in a raid room', () => {
  it('draws the friends knowing where this player stands, so a shared head is not named', () => {
    room.saying = null;
    const { updateFriend, calls, player } = friendsOnOneTile();
    updateFriend(16);
    expect(calls[0].self).toBe(player);
    expect(calls[0].figures[0]).toMatchObject({ name: 'AMY' });
    expect(calls[0].figures[0].speaking).toBeUndefined();
  });

  it('marks a plate carrying a quick phrase as speaking, so it stays up', () => {
    room.saying = 'OVER HERE!';
    const { updateFriend, calls } = friendsOnOneTile();
    updateFriend(16);
    expect(calls[0].figures[0]).toMatchObject({ name: 'AMY: OVER HERE!', speaking: true });
  });
});
