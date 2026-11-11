import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import { KeyPresses } from '../input/KeyPresses';
import { Bag } from '../items';
import { DIRECTION_DELTAS, STEP_DIRECTIONS, type Direction, type GridPosition } from '../movement/gridMovement';
import { isInsideRect } from '../world/interiors';
import { Pokemon, PokemonParty } from '../pokemon';
import { CHARMANDER } from '../pokemon/species';
import { RunPhase } from '../run/RunManager';
import { requireInsertion } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { DEFAULT_HUNTER_TUNING } from '../world/hunter';
import { inGround, type HunterPack, type PackHunter } from '../world/hunterPack';
import { hunterRival, type HunterRivalId } from '../world/hunters';
import { KOGA_BOSS_ID, MISTY_BOSS_ID, valeGyms } from '../world/valeQuarters';
import { WorldScene } from './WorldScene';

/**
 * The owner's answer to the hunt report (11 Nov 2026, option B): beat KOGA at
 * his gym, step outside, and KOGA is no longer hunting that raid - his
 * district's hunter is another rival. The report met him on the Safari Road
 * straight after "Here is the SOUL BADGE", with Grimer and Rattata.
 *
 * Driven through the real scene on the real vale: the pack is built as a raid
 * builds it, the gym win is the leader's boss id among the raid's beaten
 * trainers - which is what the battle hands back and `create()` restores - and
 * the world is rebuilt from it by the same `ensureHunterPack` call `create()`
 * makes. Then a hunter of the patch the leader kept catches the player.
 */

const VALE = getWorldMap('greystone-vale');
const LANDING = requireInsertion('greystone-vale');

function stub() {
  const self: Record<string, unknown> = {};
  for (const method of ['clear', 'fillStyle', 'fillRect', 'setDepth', 'setVisible', 'setPosition', 'setFrame', 'destroy']) {
    self[method] = vi.fn(() => self);
  }
  return self;
}

type Scene = {
  ensureHunterPack(): void;
  tryStartHunterBattle(): boolean;
  hunterRival(): { id: HunterRivalId; name: string };
  currentTile: GridPosition;
  defeatedTrainerIds: Set<string>;
  runSession: { hunterPacks?: Map<string, HunterPack> };
  pendingTrainerBattle: { trainer: { name: string; party: readonly { base: { id: string } }[] }; introLines: readonly string[] } | undefined;
};

/** A raid alone on the vale, hunted first by `raidRival`, landed at the front door. */
function raidOnTheVale(raidRival: HunterRivalId): { scene: Scene; pack: () => HunterPack } {
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    keyPresses: new KeyPresses(() => 0),
    currentMap: VALE,
    collisionData: VALE.collision,
    bounds: { width: VALE.width, height: VALE.height, links: VALE.links },
    currentTile: { ...LANDING.position },
    targetTile: null,
    facing: 'right',
    player: { stop: vi.fn(), setFrame: vi.fn(), setPosition: vi.fn(), setDepth: vi.fn() },
    hunterState: { spawned: false, defeated: false },
    currentInterior: null,
    npcSprites: new Map(),
    npcAppearances: new Map(),
    idleFigures: [],
    caughtLegends: [],
    mapObjects: [],
    trainerEncounters: [],
    defeatedTrainerIds: new Set<string>(),
    activatedPoiIds: new Set<string>(),
    completedContracts: [],
    packMarks: new Map(),
    packSearchMarks: new Map(),
    packLost: null,
    packShouter: null,
    hunterArrived: null,
    time: { now: 10_000 },
    bag: new Bag(),
    dialogBox: { visible: false, showMessages: vi.fn(), showMessage: vi.fn(), setY: vi.fn() },
    dialogRaised: false,
    scale: { width: 320, height: 240 },
    cameras: { main: { worldView: { left: 0, top: 0 }, fadeIn: vi.fn(), fadeOut: vi.fn() } },
    add: { graphics: vi.fn(() => stub()) },
    party: new PokemonParty([new Pokemon(CHARMANDER, 30)]),
    runSession: {
      manager: { phase: RunPhase.InRun, isEnraged: false, snapshot: () => ({ elapsedMs: 120_000 }) },
      plan: {
        insertion: LANDING,
        hunter: { ...DEFAULT_HUNTER_TUNING, rivalId: raidRival },
        secrets: [],
      },
    },
  });
  const typed = scene as unknown as Scene;
  typed.ensureHunterPack();
  // Every hunter has a figure already, as it would once the map was drawn.
  const sprites = (scene as unknown as { npcSprites: Map<string, unknown> }).npcSprites;
  typed.runSession.hunterPacks!.get(VALE.id)!.hunters.forEach((hunter) => sprites.set(hunter.id, stub()));
  return { scene: typed, pack: () => typed.runSession.hunterPacks!.get(VALE.id)! };
}

/** Puts `hunter` on the player's heels, in open ground, and stands the player beside it. */
function onYourTail(scene: Scene, hunter: PackHunter): void {
  const walkable = (tile: GridPosition): boolean => VALE.collision[tile.y]?.[tile.x] === false;
  const beside = { x: hunter.position.x + 1, y: hunter.position.y };
  expect(walkable(beside), 'a tile beside the hunter to stand on').toBe(true);
  Object.assign(hunter, { mode: 'chase', next: null, lastSeen: beside, facing: 'right' });
  scene.currentTile = beside;
}

const rivalsOf = (pack: HunterPack): HunterRivalId[] => pack.hunters.map((hunter) => hunter.rivalId);

describe('a gym leader beaten in the raid', () => {
  it('hunts nowhere after the gym, and whoever keeps their districts catches you with their own team and words', () => {
    const { scene, pack } = raidOnTheVale('koga');
    const before = rivalsOf(pack());
    expect(before.filter((rival) => rival === 'koga').length).toBeGreaterThan(0);
    const kogas = pack().hunters.filter((hunter) => hunter.rivalId === 'koga');

    // The gym fight is won, and the world is built again from what it hands back.
    scene.defeatedTrainerIds.add(KOGA_BOSS_ID);
    scene.ensureHunterPack();

    expect(rivalsOf(pack())).not.toContain('koga');
    rivalsOf(pack()).forEach((rival, index) => {
      if (before[index] !== 'koga') {
        expect(rival, pack().hunters[index].ground.name).toBe(before[index]);
      }
    });
    // The same hunters, standing where they stood, only under other faces.
    expect(pack().hunters.filter((hunter) => kogas.includes(hunter))).toHaveLength(kogas.length);

    // Out of the gym, and one of Koga's old patches catches up with the player.
    const keeper = kogas[0];
    onYourTail(scene, keeper);
    expect(scene.tryStartHunterBattle()).toBe(true);
    const standIn = hunterRival(keeper.rivalId);
    expect(standIn.id).not.toBe('koga');
    expect(scene.pendingTrainerBattle?.trainer.name).toBe(standIn.name);
    expect(scene.pendingTrainerBattle?.introLines).toEqual(standIn.caught);
    expect(scene.pendingTrainerBattle?.trainer.party[0].base.id).toBe(standIn.signature);
    expect(scene.hunterRival().id).toBe(standIn.id);
  });

  it('is not named by the chip as the raid\'s hunter once beaten, even with nobody after you', () => {
    const { scene, pack } = raidOnTheVale('koga');
    expect(scene.hunterRival().id).toBe('koga');
    scene.defeatedTrainerIds.add(KOGA_BOSS_ID);
    scene.ensureHunterPack();
    const home = pack().hunters.find((hunter) => hunter.ground.name === 'MILLBROOK')!;
    expect(scene.hunterRival().id).toBe(home.rivalId);
    expect(scene.hunterRival().id).not.toBe('koga');
  });

  it('stands down every gym leader who hunts, not only Koga', () => {
    for (const gym of valeGyms()) {
      const rival = gym.rival as HunterRivalId;
      const { scene, pack } = raidOnTheVale(rival);
      expect(rivalsOf(pack())).toContain(rival);
      scene.defeatedTrainerIds.add(gym.bossId);
      scene.ensureHunterPack();
      expect(rivalsOf(pack()), gym.leader).not.toContain(rival);
    }
    const { scene, pack } = raidOnTheVale('blue');
    scene.defeatedTrainerIds.add(MISTY_BOSS_ID);
    scene.defeatedTrainerIds.add(KOGA_BOSS_ID);
    scene.ensureHunterPack();
    expect(rivalsOf(pack())).not.toContain('misty');
    expect(rivalsOf(pack())).not.toContain('koga');
  });

  it('keeps hunting a raid in which they were not beaten, as before', () => {
    const { scene, pack } = raidOnTheVale('koga');
    const before = rivalsOf(pack());
    // Another trainer beaten, and the world built again, changes nobody.
    scene.defeatedTrainerIds.add('vale-coast-fisherman-hal');
    scene.ensureHunterPack();
    expect(rivalsOf(pack())).toEqual(before);
    const keeper = pack().hunters.find((hunter) => hunter.rivalId === 'koga')!;
    onYourTail(scene, keeper);
    expect(scene.tryStartHunterBattle()).toBe(true);
    expect(scene.pendingTrainerBattle?.trainer.name).toBe(hunterRival('koga').name);
    expect(scene.pendingTrainerBattle?.introLines).toEqual(hunterRival('koga').caught);
  });
});

/**
 * The second characters hunt of 11 Nov 2026, finding 2: the hunter KOGA chased
 * the player through Fuchsia Gym's door and fought them in his own gym, with
 * the gym leader KOGA standing at the head of the room waiting for his own
 * challenge. A leader's hunter half stops at their own gym's door; anybody
 * else still follows you in.
 */
describe('a gym leader hunting', () => {
  const room = VALE.areas!.find((area) => area.name === 'Fuchsia Gym')!;
  const inRoom = (tile: GridPosition): boolean => isInsideRect(room.rect, tile);
  const at = (index: number): GridPosition => ({ x: index % VALE.width, y: Math.floor(index / VALE.width) });

  /** Fuchsia Gym's front door: the tile outside it, the tile it lands you on inside, and the way it is walked in. */
  function gymDoor(): { outside: GridPosition; inside: GridPosition; facing: Direction } {
    for (const [key, to] of VALE.links!) {
      const from = at(Math.floor(key / 4));
      if (!inRoom(from) && inRoom(at(to))) {
        return { outside: from, inside: at(to), facing: STEP_DIRECTIONS[key % 4] };
      }
    }
    throw new Error('Fuchsia Gym has no door in');
  }

  /** `rival` on the player's heels at the gym's door, the player a few steps inside: where it gets to in thirty seconds. */
  function chasedIntoTheGym(rival: HunterRivalId): { caught: boolean; enteredTheRoom: boolean } {
    const { scene, pack } = raidOnTheVale('koga');
    const door = gymDoor();
    // The keeper of the patch the gym's door is in, as the report met him.
    const hunter = pack().hunters.find((each) => inGround(each.ground, door.outside))!;
    hunter.rivalId = rival;
    // Three steps on into the room, straight ahead of whoever walks in after you.
    const way = DIRECTION_DELTAS[door.facing];
    const player = { x: door.inside.x + way.x * 3, y: door.inside.y + way.y * 3 };
    expect(inRoom(player) && VALE.collision[player.y][player.x] === false, 'floor straight ahead of the door').toBe(true);
    Object.assign(hunter, { mode: 'chase', next: null, position: { ...door.outside }, lastSeen: { ...player }, facing: door.facing, sees: true, seenAtMs: 0 });
    scene.currentTile = player;
    const world = (): Parameters<HunterPack['advance']>[0] => (scene as unknown as { packWorld(): Parameters<HunterPack['advance']>[0] }).packWorld();
    let caught = false;
    let enteredTheRoom = false;
    for (let ms = 0; ms < 30_000 && !caught; ms += 100) {
      caught = pack().advance(world(), 100).some((event) => event.kind === 'caught' && event.hunter === hunter);
      enteredTheRoom ||= inRoom(hunter.position);
    }
    return { caught, enteredTheRoom };
  }

  it('follows you into somebody else\'s gym and catches you there', () => {
    expect(chasedIntoTheGym('blue')).toEqual({ caught: true, enteredTheRoom: true });
  });

  it('stops at the door of their own gym, where they are waiting as the leader', () => {
    expect(valeGyms().find((gym) => gym.building === room.name)?.rival).toBe('koga');
    expect(chasedIntoTheGym('koga')).toEqual({ caught: false, enteredTheRoom: false });
  });
});
