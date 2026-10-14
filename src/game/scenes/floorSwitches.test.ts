import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

const played: string[] = [];
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy(
    {},
    { get: (_target, key) => (key === 'play' ? (name: string) => played.push(name) : vi.fn()) },
  ),
}));

import { Bag } from '../items';
import type { Direction, GridPosition } from '../movement/gridMovement';
import { Pokemon } from '../pokemon/Pokemon';
import { BULBASAUR } from '../pokemon/species';
import { RunPhase } from '../run/RunManager';
import { getWorldMap } from '../worldMap';
import { FIELD_MOVES } from '../world/fieldMoves';
import type { PlacedArea } from '../world/mapAreas';
import { WorldScene } from './WorldScene';

/** The parts of the scene these tests drive, which are private to it. */
interface Driven {
  currentTile: GridPosition;
  tryPushBoulder(facing: Direction): boolean;
  isBlocked(tile: GridPosition): boolean;
  resetBouldersLeftIn(area: PlacedArea | null): void;
}

/**
 * Greystone Vale's Falls Cave in a live raid, with a Strength user in the
 * party: Victory Road's rule played by the real scene (`switches.ts`).
 */
function inTheFallsCave() {
  played.length = 0;
  const map = getWorldMap('greystone-vale');
  const cave = map.areas!.find((area) => area.id === 'falls-cave')!;
  const at = (x: number, y: number): GridPosition => ({ x: cave.rect.x + x, y: cave.rect.y + y });
  const strong = new Pokemon(BULBASAUR, 5);
  strong.learnMove(FIELD_MOVES.strength.move);
  const runSession = {
    exitsOpened: [] as string[],
    bouldersMoved: {} as Record<string, GridPosition>,
    switchesThrown: [] as string[],
    manager: { phase: RunPhase.InRun, snapshot: () => ({ elapsedMs: 30_000 }) },
  };
  const sprite = () => ({ setDepth: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(), destroy: vi.fn() });
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: map,
    collisionData: map.collision.map((row) => [...row]),
    bounds: { width: map.width, height: map.height },
    bag: new Bag(),
    party: { pokemon: [strong] },
    runSession,
    completedContracts: [],
    collectedLootIds: new Set<string>(),
    trainerEncounters: [],
    defeatedTrainerIds: new Set<string>(),
    hunterState: { spawned: false, defeated: false, position: null },
    idleFigures: [],
    caughtLegends: [],
    npcSprites: new Map(map.entities.map((entity) => [entity.id, sprite()])),
    player: { setFrame: vi.fn() },
    playerIdleFrame: () => 0,
    tweens: { add: vi.fn() },
    time: { delayedCall: (_ms: number, call: () => void) => call() },
    cameras: { main: { shake: vi.fn() } },
  });
  return { scene: scene as unknown as Driven, runSession, at, cave };
}

/** Stands the player behind a boulder and pushes it once. */
const push = (raid: ReturnType<typeof inTheFallsCave>, [x, y]: readonly [number, number], toward: Direction): boolean => {
  const behind = { up: [0, 1], down: [0, -1], left: [1, 0], right: [-1, 0] }[toward];
  raid.scene.currentTile = raid.at(x + behind[0], y + behind[1]);
  return raid.scene.tryPushBoulder(toward);
};

describe('the Falls Cave floor switches', () => {
  // The barrier's two tiles, in the cave's own tiles (`fallsCave.ts`).
  const barrier: readonly (readonly [number, number])[] = [[35, 5], [35, 6]];

  it('keeps the barrier shut until both switches have a boulder on them, then lifts it for the raid', () => {
    const raid = inTheFallsCave();
    const shut = () => barrier.every(([x, y]) => raid.scene.isBlocked(raid.at(x, y)));
    expect(shut()).toBe(true);

    // The west hall's boulder, down onto the west hall's switch.
    for (const y of [4, 5, 6, 7, 8]) expect(push(raid, [11, y], 'down')).toBe(true);
    expect(raid.runSession.switchesThrown).toHaveLength(1);
    expect(shut()).toBe(true);
    expect(played).not.toContain('barrierLifts');

    // Through the neck, and the east hall's boulder onto the east hall's switch.
    expect(push(raid, [16, 6], 'right')).toBe(true);
    expect(push(raid, [17, 6], 'right')).toBe(true);
    for (const y of [4, 5, 6, 7]) expect(push(raid, [25, y], 'down')).toBe(true);
    expect(push(raid, [25, 8], 'right')).toBe(true);
    expect(raid.runSession.switchesThrown).toHaveLength(2);
    expect(shut()).toBe(false);
    expect(played).toContain('barrierLifts');
  });

  it('keeps a boulder that has fallen onto its switch where it fell', () => {
    const raid = inTheFallsCave();
    for (const y of [4, 5, 6, 7, 8]) push(raid, [11, y], 'down');
    expect(push(raid, [11, 9], 'left')).toBe(false);
    expect(push(raid, [11, 9], 'right')).toBe(false);
  });

  it('puts every boulder not on a switch back when the player leaves the cave', () => {
    const raid = inTheFallsCave();
    for (const y of [4, 5, 6, 7, 8]) push(raid, [11, y], 'down');
    push(raid, [16, 6], 'right');
    expect(Object.keys(raid.runSession.bouldersMoved)).toHaveLength(2);
    raid.scene.resetBouldersLeftIn(raid.cave);
    // The one on its switch stays; the one pushed through the neck goes home.
    const left = Object.values(raid.runSession.bouldersMoved);
    expect(left).toEqual([raid.at(11, 9)]);
    expect(raid.runSession.switchesThrown).toHaveLength(1);
  });

  it('needs Strength to move a boulder at all', () => {
    const raid = inTheFallsCave();
    (raid.scene as unknown as { party: { pokemon: Pokemon[] } }).party = {
      pokemon: [new Pokemon(BULBASAUR, 20)],
    };
    expect(push(raid, [11, 4], 'down')).toBe(false);
    expect(raid.runSession.bouldersMoved).toEqual({});
  });
});

describe('a boulder that has fallen onto its switch, faced', () => {
  /** Faces the tile and presses the interact key, with nothing else on the way. */
  const interactAt = (raid: ReturnType<typeof inTheFallsCave>, [x, y]: readonly [number, number]): string[] => {
    const said: string[] = [];
    Object.assign(raid.scene as object, {
      facing: 'down',
      tryBoard: () => false,
      tryCollectLootAt: () => null,
      tryActivatePoiAt: () => null,
      tryFieldMoveAt: () => null,
      tryOpenBarredExitAt: () => null,
      trainersForCurrentMap: () => [],
      npcAppearances: new Map(),
      dialogBox: {
        showMessage: (line: string) => said.push(line),
        showMessages: (lines: string[]) => said.push(...lines),
      },
    });
    raid.scene.currentTile = raid.at(x, y - 1);
    (raid.scene as unknown as { tryInteract(): void }).tryInteract();
    return said;
  };

  it('still offers a loose boulder to the Strength user', () => {
    const raid = inTheFallsCave();
    expect(interactAt(raid, [11, 4]).join(' ')).toMatch(/Walk into the boulder to move it/);
  });

  it('says it has settled, never that walking into it will move it', () => {
    const raid = inTheFallsCave();
    for (const y of [4, 5, 6, 7, 8]) push(raid, [11, y], 'down');
    // Walking into it does nothing, so nothing may promise that it would.
    expect(push(raid, [11, 9], 'down')).toBe(false);
    const said = interactAt(raid, [11, 9]).join(' ');
    expect(said).not.toMatch(/Walk into the boulder/);
    expect(said).toMatch(/switch/i);
    expect(said).toMatch(/won't move/i);
  });
});
