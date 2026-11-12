import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

const OLLY = '11111111-1111-4111-8111-111111111111';
const AMY = '22222222-2222-4222-8222-222222222222';

const room = vi.hoisted((): { me: string; hunters: unknown; said: unknown[] } => ({ me: '', hunters: null, said: [] }));

vi.mock('../raidRoom/friendRoom', () => ({
  friendRoom: () => ({
    room: { code: 'BCDF', mapId: 'floodplain-relay', me: room.me },
    othersOn: () => [{ id: room.me === OLLY ? AMY : OLLY }],
    figuresOn: () => [],
    hunters: room.hunters,
    sayHunter: (signal: unknown) => room.said.push(signal),
  }),
}));

import { HunterBoard, type SharedHunter } from '../raidRoom/groupHunter';
import type { HunterState } from '../world/hunter';
import { getWorldMap } from '../worldMap';
import { WorldScene } from './WorldScene';

const hunting: SharedHunter = { spawned: true, defeated: false, position: { x: 94, y: 154 }, facing: 'down', searchMs: 18_000, rivalId: 'blue', returned: false };

/** One friend's world in a room of two, its hunter as its own raid left it. */
function worldOf(me: string, hunterState: HunterState, board: HunterBoard) {
  room.me = me;
  room.hunters = board;
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: getWorldMap('floodplain-relay'),
    currentTile: { x: 94, y: 160 },
    runSession: {},
    hunterState,
    hunterFacing: 'down',
    hunterHeardAt: 0,
    huntRoleWas: 'solo',
    drawSharedHunter: () => undefined,
    hunterArrives: () => undefined,
    stepForFriends: () => undefined,
    sayHunterIfChanged: () => undefined,
  });
  const frame = () => (scene as unknown as { updateGroupHunter(): void }).updateGroupHunter();
  const hunter = () => (scene as unknown as { hunterState: HunterState }).hunterState;
  return { frame, hunter, scene };
}

/**
 * The multiplayer bug hunt of 12 Nov 2026: OLLY and AMY were caught by the
 * room's hunter at once, each in a fight of their own. OLLY beat it; AMY fled
 * hers, and her word - her own raid's hunter, which never saw the win - stood
 * it back up six tiles from OLLY and set it on him again.
 */
describe('the room’s hunter, beaten by one friend and fled by the other', () => {
  it('stays beaten in the winner’s world when the flee is heard after the win', () => {
    const board = new HunterBoard();
    board.said({ ...hunting, defeated: true, position: null }, OLLY);
    const olly = worldOf(OLLY, { spawned: true, defeated: true }, board);
    board.hear({ kind: 'after', from: AMY, hunter: hunting });
    olly.frame();
    expect(olly.hunter().defeated).toBe(true);
  });

  it('is beaten in the fleer’s world too, though her own fight left it hunting', () => {
    const board = new HunterBoard();
    // OLLY's win, heard while AMY was still in her own fight.
    board.hear({ kind: 'after', from: OLLY, hunter: { ...hunting, defeated: true, position: null } });
    // AMY comes back from fleeing and says what her fight left.
    board.said(hunting, AMY);
    const amy = worldOf(AMY, { spawned: true, defeated: false, mapId: 'floodplain-relay', position: { x: 94, y: 154 } }, board);
    amy.frame();
    expect(amy.hunter().defeated).toBe(true);
    amy.frame();
    expect(amy.hunter().defeated).toBe(true);
  });

  it('still comes back once for the enrage, after a defeat before it', () => {
    const board = new HunterBoard();
    board.hear({ kind: 'after', from: AMY, hunter: { ...hunting, defeated: true, position: null } });
    // OLLY keeps the hunter; his clock ran out and re-armed the hunter AMY beat.
    const olly = worldOf(OLLY, { spawned: true, defeated: false, mapId: 'floodplain-relay', position: { x: 90, y: 150 }, enrageAnswered: true, returned: true }, board);
    olly.frame();
    expect(olly.hunter().defeated).toBe(false);
    // And a follower hears the returned hunter hunting.
    board.hear({ kind: 'hunter', from: OLLY, hunter: { ...hunting, returned: true } });
    const amy = worldOf(AMY, { spawned: true, defeated: true }, board);
    amy.frame();
    expect(amy.hunter().defeated).toBe(false);
  });
});

/**
 * The multiplayer bug hunt of 12 Nov 2026: the keeper opened FEEDBACK and the
 * room's hunter stood frozen beside the friend still walking. Every pause of
 * the world says the player is away, and every resume that they are back.
 */
describe('a world paused under a menu, in a room', () => {
  it('says it is away, and takes the keeping up afresh when it runs again', () => {
    room.said.length = 0;
    const olly = worldOf(OLLY, { spawned: true, defeated: false }, new HunterBoard());
    const scene = olly.scene as unknown as Record<string, unknown>;
    scene.huntRoleWas = 'keeper';
    const sayAway = (away: boolean) => (scene.sayAway as (away: boolean) => void).call(scene, away);
    sayAway(true);
    expect(room.said).toEqual([{ kind: 'away', from: OLLY, away: true }]);
    expect(scene.huntRoleWas).toBe('solo');
    sayAway(false);
    expect(room.said.at(-1)).toEqual({ kind: 'away', from: OLLY, away: false });
  });
});
