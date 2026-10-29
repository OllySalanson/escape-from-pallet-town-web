import { describe, expect, it, vi } from 'vitest';

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

const played: string[] = [];
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy(
    {},
    { get: (_target, key) => (key === 'play' ? (name: string) => played.push(name) : vi.fn()) },
  ),
}));

import { KeyPresses } from '../input/KeyPresses';
import { PressLatch } from '../input/pressLatch';
import { Bag } from '../items';
import type { GridPosition } from '../movement/gridMovement';
import { Pokemon, PokemonParty } from '../pokemon';
import { CHARMANDER } from '../pokemon/species';
import { RunPhase } from '../run/RunManager';
import type { CacheSearchState } from '../world/cacheSearch';
import { searchDurationMs, searchPieces } from '../world/cacheSearch';
import {
  DEFAULT_HUNTER_TUNING,
  findHunterPursuitPath,
  findHunterSpawnTile,
  HUNTER_IDLE_STEP_MS,
  type HunterState,
} from '../world/hunter';
import type { WorldPoi } from '../world/pois';
import { SpentPresses } from '../world/spentPresses';
import { getWorldMap } from '../worldMap';
import { WorldScene } from './WorldScene';

/** The parts of the scene these tests drive, which are private to it. */
interface Driven {
  hunterState: HunterState;
  search: { readonly poi: WorldPoi; takingAll: boolean; said: string | null } | null;
  runSession: { cachesSearched?: Record<string, CacheSearchState> };
  tryActivatePoiAt(tile: GridPosition): readonly string[] | null;
  advanceRunClock(deltaMs: number): void;
  handleSearchInput(): boolean;
}

/**
 * A raid on the real Floodplain with a cache on the player's own tile - the
 * Flooded Supply Vault, carried there - and the hunter where its real arrival
 * search puts it, a few steps off. Keys are stubs the test presses by hand.
 */
function searchingWithTheHunterNear() {
  played.length = 0;
  const map = getWorldMap('floodplain-relay');
  const isBlocked = (tile: GridPosition): boolean => map.collision[tile.y]?.[tile.x] !== false;
  const bounds = { width: map.width, height: map.height };
  const player = map.collision
    .flatMap((row, y) => row.map((_blocked, x) => ({ x, y })))
    .find((tile) => !isBlocked(tile) && findHunterSpawnTile(tile, bounds, isBlocked) !== null)!;
  const hunter = findHunterSpawnTile(player, bounds, isBlocked, (tiles) => tiles[0])!;
  const vault = map.pois.find((poi) => poi.id === 'floodplain-supply-vault')!;
  const cache: WorldPoi = { ...vault, position: player };

  const key = (): StubKey => ({ justDown: false, isDown: false });
  const controls = {
    up: key(), down: key(), left: key(), right: key(),
    w: key(), a: key(), s: key(), d: key(),
    interact: [key()],
    phrases: [key(), key(), key(), key(), key(), key()],
  };
  const clock = { elapsedMs: 90_000 };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    controls,
    keyPresses: new KeyPresses(() => 0),
    spentPresses: new SpentPresses(),
    directionPresses: new PressLatch(),
    game: { loop: { frame: 0 } },
    talkOpenMs: 0,
    currentMap: { ...map, pois: [cache] },
    collisionData: map.collision,
    bounds,
    currentTile: player,
    targetTile: null,
    facing: 'down',
    currentInterior: null,
    hunterNear: false,
    hunterFacing: 'down',
    hunterStillMs: 0,
    hunterState: { spawned: true, defeated: false, mapId: map.id, position: hunter },
    activatedPoiIds: new Set<string>(),
    defeatedTrainerIds: new Set<string>(),
    completedContracts: [],
    poiSprites: new Map(),
    poiLabels: new Map(),
    packReseated: false,
    bag: new Bag(),
    search: null,
    dialogBox: { visible: false, showMessages: vi.fn(), setY: vi.fn() },
    party: new PokemonParty([new Pokemon(CHARMANDER, 10)]),
    cameras: { main: { flash: vi.fn() } },
    runSession: {
      stepsTaken: 40,
      manager: {
        phase: RunPhase.InRun,
        isEnraged: false,
        isEnrageGraceExpired: false,
        snapshot: () => ({ elapsedMs: clock.elapsedMs }),
        tick: (deltaMs: number) => {
          clock.elapsedMs += deltaMs;
          return { elapsedMs: clock.elapsedMs, isEnraged: false };
        },
        registerFoundItem: vi.fn(),
      },
      plan: { hunter: { ...DEFAULT_HUNTER_TUNING, spawnDelayMs: 60_000 } },
    },
    placeFigure: vi.fn(),
    createHunterSprite: vi.fn(),
    playCutscene: vi.fn(),
    hunterBlocker: () => isBlocked,
    findHunterSpawnTile: () => hunter,
    interrupt: vi.fn(),
    refreshExtractionMarkers: vi.fn(),
    refreshRunTimerHud: vi.fn(),
  });
  const driven = scene as unknown as Driven;
  const press = (stub: StubKey) => {
    stub.justDown = true;
    const answered = driven.handleSearchInput();
    stub.justDown = false;
    return answered;
  };
  const stepsToHunter = (): number =>
    findHunterPursuitPath(driven.hunterState.position!, player, bounds, isBlocked).length + 1;
  return { scene: driven, controls, press, clock, cache, stepsToHunter, bag: (scene as unknown as { bag: Bag }).bag };
}

/** Runs the raid clock on for `ms`, a frame at a time, as `update` does. */
function frames(scene: Driven, ms: number): void {
  for (let spent = 0; spent < ms; spent += 16) {
    scene.advanceRunClock(16);
  }
}

describe('searching a cache in a raid', () => {
  it('opens a search rather than paying out, and hands nothing over until it is found and taken', () => {
    const { scene, bag, cache } = searchingWithTheHunterNear();
    expect(scene.tryActivatePoiAt(cache.position)).toEqual([]);
    expect(scene.search?.poi.id).toBe(cache.id);
    for (const { itemId } of cache.reward) {
      expect(bag.count(itemId)).toBe(0);
    }
  });

  it('is the player\'s own time: the raid clock runs through it and the hunter keeps coming', () => {
    const { scene, clock, cache, stepsToHunter } = searchingWithTheHunterNear();
    const before = stepsToHunter();
    scene.tryActivatePoiAt(cache.position);

    frames(scene, HUNTER_IDLE_STEP_MS + 100);

    expect(clock.elapsedMs).toBeGreaterThanOrEqual(90_000 + HUNTER_IDLE_STEP_MS);
    expect(stepsToHunter()).toBeLessThan(before);
    // And the search got on with it in the same time.
    expect(scene.runSession.cachesSearched?.[cache.id]?.searchedMs).toBeGreaterThan(0);
  });

  it('takes a piece by its number once it has come to light, and not before', () => {
    const { scene, press, controls, bag, cache } = searchingWithTheHunterNear();
    const pieces = searchPieces(cache.reward);
    scene.tryActivatePoiAt(cache.position);

    expect(press(controls.phrases[0])).toBe(true);
    expect(bag.count(pieces[0].itemId)).toBe(0);

    frames(scene, searchDurationMs(pieces));
    press(controls.phrases[0]);
    expect(bag.count(pieces[0].itemId)).toBe(1);
    expect(scene.runSession.cachesSearched?.[cache.id]?.taken).toEqual([0]);
    expect(played).toContain('lootPickup');
  });

  it('takes everything with the interact key, including what has not come to light yet, and is then spent', () => {
    const { scene, press, controls, bag, cache } = searchingWithTheHunterNear();
    const pieces = searchPieces(cache.reward);
    scene.tryActivatePoiAt(cache.position);
    press(controls.interact[0]);
    expect(scene.search?.takingAll).toBe(true);

    frames(scene, searchDurationMs(pieces));

    for (const { itemId, quantity } of cache.reward) {
      expect(bag.count(itemId)).toBe(quantity);
    }
    expect(scene.search).toBeNull();
    expect(scene.tryActivatePoiAt(cache.position)).toBeNull();
  });

  it('closes when the player walks away, keeps what was taken, and carries on when they come back', () => {
    const { scene, press, controls, bag, cache } = searchingWithTheHunterNear();
    const pieces = searchPieces(cache.reward);
    scene.tryActivatePoiAt(cache.position);
    frames(scene, searchDurationMs(pieces));
    press(controls.phrases[0]);

    controls.left.isDown = true;
    expect(press(controls.left)).toBe(false);
    controls.left.isDown = false;
    expect(scene.search).toBeNull();
    expect(bag.count(pieces[0].itemId)).toBe(1);

    expect(scene.tryActivatePoiAt(cache.position)).toEqual([]);
    expect(scene.search?.poi.id).toBe(cache.id);
    // Already searched: the rest is there to take at once.
    press(controls.interact[0]);
    for (const { itemId, quantity } of cache.reward) {
      expect(bag.count(itemId)).toBe(quantity);
    }
  });
});
