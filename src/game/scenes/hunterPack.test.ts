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
import { RunPhase } from '../run/RunManager';
import { getWorldMap } from '../worldMap';
import { HUNTER_SEARCH_MS, beginHunterDisengage, type HunterState } from '../world/hunter';
import { HunterPack, createHunterPack, isTouching, type PackHunter } from '../world/hunterPack';
import { hunterRival } from '../world/hunters';
import type { GridPosition } from '../movement/gridMovement';
import { Pokemon, PokemonParty } from '../pokemon';
import { CHARMANDER } from '../pokemon/species';
import { WorldScene } from './WorldScene';

function stub() {
  const self: Record<string, unknown> = {};
  for (const method of ['clear', 'fillStyle', 'fillRect', 'setDepth', 'setVisible', 'setPosition', 'setFrame', 'destroy']) {
    self[method] = vi.fn(() => self);
  }
  return self;
}

/**
 * The real scene's catch and fight settlement with a pack on the run session,
 * on the real Floodplain: a hunter of the pack standing beside the player in
 * open ground.
 */
function packBeside(mode: PackHunter['mode']) {
  const map = getWorldMap('floodplain-relay');
  const walkable = (tile: GridPosition): boolean => map.collision[tile.y]?.[tile.x] === false;
  const open = (tile: GridPosition): boolean =>
    [-1, 0, 1].every((dy) => [-1, 0, 1, 2].every((dx) => walkable({ x: tile.x + dx, y: tile.y + dy })));
  const player = map.collision.flatMap((row, y) => row.map((_b, x) => ({ x, y }))).find(open)!;
  const beside = { x: player.x + 1, y: player.y };
  const ground = {
    id: 'outdoors',
    name: 'THE OUTDOORS',
    rects: [{ x: 0, y: 0, width: map.width, height: map.height }],
    post: beside,
    route: [beside],
  };
  const hunters = createHunterPack([ground], ['misty']);
  Object.assign(hunters[0], { mode, position: beside, lastSeen: player, facing: 'left' });
  const pack = new HunterPack(hunters);
  const dialogBox = { visible: false, showMessages: vi.fn(), showMessage: vi.fn(), setY: vi.fn() };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    keyPresses: new KeyPresses(() => 0),
    currentMap: map,
    collisionData: map.collision,
    bounds: { width: map.width, height: map.height, links: map.links },
    currentTile: player,
    targetTile: null,
    facing: 'right',
    player: { stop: vi.fn(), setFrame: vi.fn(), setPosition: vi.fn(), setDepth: vi.fn() },
    hunterState: { spawned: false, defeated: false },
    npcSprites: new Map([[hunters[0].id, stub()]]),
    npcAppearances: new Map(),
    idleFigures: [],
    caughtLegends: [],
    mapObjects: [],
    trainerEncounters: [],
    defeatedTrainerIds: new Set<string>(),
    activatedPoiIds: new Set<string>(),
    completedContracts: [],
    packMarks: new Map(),
    bag: new Bag(),
    dialogBox,
    dialogRaised: false,
    scale: { width: 320, height: 240 },
    cameras: { main: { worldView: { left: 0, top: 0 }, fadeIn: vi.fn(), fadeOut: vi.fn() } },
    add: { graphics: vi.fn(() => stub()) },
    party: new PokemonParty([new Pokemon(CHARMANDER, 5)]),
    runSession: {
      manager: { phase: RunPhase.InRun, isEnraged: false, snapshot: () => ({ elapsedMs: 60_000 }) },
      plan: undefined,
      hunterPacks: new Map([[map.id, pack]]),
    },
  });
  return {
    scene: scene as unknown as {
      isBlocked(tile: GridPosition): boolean;
      tryStartHunterBattle(): boolean;
      tryWalkIntoHunter(facing: string): boolean;
      settlePackAfterFight(fromBattle: boolean): void;
      hunterState: HunterState;
      cutscene: unknown;
      pendingTrainerBattle: { trainer: { name: string }; isHunter: boolean; introLines: readonly string[] } | undefined;
    },
    pack,
    hunter: hunters[0],
    player,
  };
}

describe('the pack in the scene', () => {
  it('stands solid where its hunters stand', () => {
    const { scene, hunter } = packBeside('patrol');
    expect(scene.isBlocked(hunter.position)).toBe(true);
  });

  it('catches a player at rest beside a hunter that is after them, with that hunter\'s rival and lines', () => {
    const { scene, pack, hunter } = packBeside('chase');
    expect(scene.tryStartHunterBattle()).toBe(true);
    expect(scene.pendingTrainerBattle?.trainer.name).toBe(hunterRival('misty').name);
    expect(scene.pendingTrainerBattle?.introLines).toEqual(hunterRival('misty').caught);
    expect(scene.cutscene).toBeDefined();
    expect(pack.engagedId).toBe(hunter.id);
  });

  it('lets a hunter that has not seen the player stand beside them, until it does', () => {
    const { scene } = packBeside('patrol');
    expect(scene.tryStartHunterBattle()).toBe(false);
  });

  it('takes whoever walks into any of its hunters, whatever it is doing', () => {
    for (const mode of ['patrol', 'return', 'stunned'] as const) {
      const { scene, pack, hunter } = packBeside(mode);
      expect(scene.tryWalkIntoHunter('right')).toBe(true);
      expect(scene.pendingTrainerBattle?.isHunter).toBe(true);
      expect(pack.engagedId).toBe(hunter.id);
    }
  });

  it('puts a beaten hunter out of the raid', () => {
    const { scene, hunter } = packBeside('chase');
    scene.tryStartHunterBattle();
    scene.hunterState = { ...scene.hunterState, defeated: true };
    scene.settlePackAfterFight(true);
    expect(hunter.mode).toBe('beaten');
    expect(scene.isBlocked(hunter.position)).toBe(false);
    expect(scene.hunterState.spawned).toBe(false);
  });

  it('throws a fled-from hunter back, blind for the search window, off the player', () => {
    const { scene, hunter, player } = packBeside('chase');
    scene.tryStartHunterBattle();
    scene.hunterState = beginHunterDisengage(scene.hunterState);
    scene.settlePackAfterFight(true);
    expect(hunter.mode).toBe('stunned');
    expect(hunter.timerMs).toBe(HUNTER_SEARCH_MS);
    expect(isTouching(hunter.position, player)).toBe(false);
    // Blind: standing beside it again is not a catch, walking into it still is.
    expect(scene.tryStartHunterBattle()).toBe(false);
  });
});
