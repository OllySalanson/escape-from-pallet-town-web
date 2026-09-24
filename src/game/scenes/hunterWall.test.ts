import { beforeEach, describe, expect, it, vi } from 'vitest';

interface StubKey {
  justDown: boolean;
  isDown: boolean;
}

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: (key: StubKey) => key?.justDown === true } },
  },
}));

import { KeyPresses } from '../input/KeyPresses';
import { Bag } from '../items';
import { RunPhase } from '../run/RunManager';
import { getWorldMap } from '../worldMap';
import { HUNTER_SEARCH_MS } from '../world/hunter';
import type { GridPosition } from '../movement/gridMovement';
import { Pokemon, PokemonParty } from '../pokemon';
import { CHARMANDER } from '../pokemon/species';
import { HUNTER_RIVALS } from '../world/hunters';
import { WorldScene } from './WorldScene';

/** A drawn thing that remembers what was done to it, as `cutsceneBeats.test.ts` has one. */
function stubGraphics() {
  const calls = { destroyed: 0 };
  const self = {
    calls,
    clear: vi.fn(() => self),
    fillStyle: vi.fn(() => self),
    fillRect: vi.fn(() => self),
    setDepth: vi.fn(() => self),
    setVisible: vi.fn(() => self),
    setPosition: vi.fn(() => self),
    destroy: vi.fn(() => {
      calls.destroyed += 1;
    }),
  };
  return self as typeof self & Record<string, unknown>;
}

/**
 * The captain's raid of 2026-09-19, as a position: he fled, and the hunter
 * settled into its search in the one gap he could have walked out through.
 *
 * The pocket is found on the real map rather than typed - the first tile with a
 * single way off it - so a redraw moves the test rather than quietly retiring
 * it, and the hunter is stood in that one way. Its search window is running,
 * which is the state that made this a wall: for `HUNTER_SEARCH_MS` the hunter
 * will not engage, and for all of it its tile is collision.
 */
function sealedInAPocket(
  { searching }: { searching: boolean } = { searching: true },
) {
  const map = getWorldMap('floodplain-relay');
  const walkable = (tile: GridPosition): boolean => map.collision[tile.y]?.[tile.x] === false;
  const beside = (tile: GridPosition): GridPosition[] =>
    [
      { x: tile.x, y: tile.y - 1 },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x + 1, y: tile.y },
    ].filter(walkable);

  const player = map.collision
    .flatMap((row, y) => row.map((_blocked, x) => ({ x, y })))
    .filter(walkable)
    .find((tile) => beside(tile).length === 1)!;
  const hunter = beside(player)[0];
  /** The way the player has to push to walk into the hunter. */
  const into =
    hunter.y < player.y ? 'up' : hunter.y > player.y ? 'down' : hunter.x < player.x ? 'left' : 'right';

  const dialogBox = {
    visible: false,
    shown: [] as string[],
    showMessages: vi.fn((lines: string[]) => {
      dialogBox.shown.push(...lines);
      dialogBox.visible = true;
    }),
    showMessage: vi.fn(),
    setY: vi.fn(),
  };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    keyPresses: new KeyPresses(() => 0),
    currentMap: map,
    collisionData: map.collision,
    bounds: { width: map.width, height: map.height },
    currentTile: player,
    targetTile: null,
    facing: into === 'up' ? 'down' : 'up',
    player: { stop: vi.fn(), setFrame: vi.fn(), setPosition: vi.fn(), setDepth: vi.fn() },
    hunterState: {
      spawned: true,
      defeated: false,
      mapId: map.id,
      position: hunter,
      ...(searching ? { searchRemainingMs: HUNTER_SEARCH_MS } : {}),
    },
    npcSprites: new Map([['rival-hunter', stubGraphics()]]),
    npcAppearances: new Map(),
    idleFigures: [],
    mapObjects: [],
    trainerEncounters: [],
    defeatedTrainerIds: new Set<string>(),
    bag: new Bag(),
    dialogBox,
    dialogRaised: false,
    scale: { width: 320, height: 240 },
    cameras: { main: { worldView: { left: 0, top: 0 }, fadeIn: vi.fn(), fadeOut: vi.fn() } },
    add: { graphics: vi.fn(() => stubGraphics()) },
    party: new PokemonParty([new Pokemon(CHARMANDER, 5)]),
    runSession: {
      manager: {
        phase: RunPhase.InRun,
        isEnraged: false,
        snapshot: () => ({ elapsedMs: 60_000 }),
      },
      plan: undefined,
    },
  });

  return {
    scene: scene as unknown as {
      isBlocked(tile: GridPosition): boolean;
      tryStartHunterBattle(): boolean;
      tryWalkIntoHunter(facing: string): boolean;
      advanceCutscene(deltaMs: number): boolean;
      facing: string;
      cutscene: { waitingForPlayer: boolean } | undefined;
      hunterState: { searchRemainingMs?: number };
      pendingTrainerBattle: { trainer: { name: string }; isHunter: boolean } | undefined;
    },
    dialogBox,
    player,
    hunter,
    into,
  };
}

describe('a hunter standing in the only way out', () => {
  let harness: ReturnType<typeof sealedInAPocket>;

  beforeEach(() => {
    harness = sealedInAPocket();
  });

  it('is the wall the captain hit: a solid tile that will not engage', () => {
    // Both halves of the fault, in the state a flee leaves behind. Either one
    // alone is fine - a trainer is solid and a searching hunter that is not in
    // the way costs nothing - and together they are a sealed door.
    expect(harness.scene.isBlocked(harness.hunter)).toBe(true);
    expect(harness.scene.tryStartHunterBattle()).toBe(false);
  });

  it('takes whoever walks into it, which is what makes that door openable', () => {
    expect(harness.scene.tryWalkIntoHunter(harness.into)).toBe(true);

    expect(harness.scene.pendingTrainerBattle?.trainer.name).toBe(HUNTER_RIVALS[0].name);
    expect(harness.scene.pendingTrainerBattle?.isHunter).toBe(true);
    // The same beat a pursuit contact plays, because it is the same event from
    // the other side: the player is turned to face whoever has them.
    expect(harness.scene.facing).toBe(harness.into);
    expect(harness.scene.cutscene).toBeDefined();
  });

  it('is no longer searching for someone it is holding', () => {
    harness.scene.tryWalkIntoHunter(harness.into);

    expect(harness.scene.hunterState.searchRemainingMs).toBe(0);
  });

  it('speaks its line, so being caught is never a silent teleport into a fight', () => {
    harness.scene.tryWalkIntoHunter(harness.into);
    // Long enough for the whole beat: the mark, the breath, then the words.
    harness.scene.advanceCutscene(10_000);

    expect(harness.dialogBox.shown).toEqual([...HUNTER_RIVALS[0].caught]);
  });

  it('is still solid, because the player may not walk through a person', () => {
    // The fix is a way through the door, not the removal of the door: pushing
    // any other way is the ordinary bump it has always been.
    const away = harness.into === 'up' ? 'down' : 'up';

    expect(harness.scene.tryWalkIntoHunter(away)).toBe(false);
    expect(harness.scene.pendingTrainerBattle).toBeUndefined();
    expect(harness.scene.isBlocked(harness.hunter)).toBe(true);
  });

  it('catches a pursuing hunter walked into just as it catches a searching one', () => {
    const pursuing = sealedInAPocket({ searching: false });

    expect(pursuing.scene.tryWalkIntoHunter(pursuing.into)).toBe(true);
    expect(pursuing.scene.pendingTrainerBattle?.isHunter).toBe(true);
  });
});
