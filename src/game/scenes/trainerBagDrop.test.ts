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

vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy({}, { get: () => vi.fn() }),
}));

import { KeyPresses } from '../input/KeyPresses';
import { PressLatch } from '../input/pressLatch';
import { Bag } from '../items';
import type { GridPosition } from '../movement/gridMovement';
import { Pokemon, PokemonParty } from '../pokemon';
import { CHARMANDER } from '../pokemon/species';
import { RunPhase } from '../run/RunManager';
import { searchDurationMs, searchPieces, type CacheSearchState } from '../world/cacheSearch';
import { trainersOn } from '../world/mapTrainers';
import type { WorldPoi } from '../world/pois';
import { SpentPresses } from '../world/spentPresses';
import { bagIdFor, kitFor, travellingLightLine, type TrainerBag } from '../world/trainerBags';
import type { RunTrainerEncounter } from '../world/trainers';
import { getWorldMap } from '../worldMap';
import { WorldScene } from './WorldScene';

/** The parts of the scene these tests drive, which are private to it. */
interface Driven {
  search: { readonly poi: WorldPoi; takingAll: boolean } | null;
  runSession: { cachesSearched?: Record<string, CacheSearchState>; trainerBags?: Record<string, TrainerBag | null> };
  defeatedTrainerIds: Set<string>;
  bagLines: string[];
  dropBeatenTrainersBags(): void;
  poisHere(): readonly WorldPoi[];
  tryActivatePoiAt(tile: GridPosition, steppedOn?: boolean): readonly string[] | null;
  closeSearch(): void;
  bagGlints(poi: WorldPoi): boolean;
  trainerBagGlints(trainer: RunTrainerEncounter): boolean;
  advanceRunClock(deltaMs: number): void;
  handleSearchInput(): boolean;
}

const VALE = 'greystone-vale';

/**
 * A raid on the real vale, standing beside a real trainer of it, with the
 * seed a bag is rolled on. Keys are stubs the test presses by hand.
 */
function besideATrainer(trainer: RunTrainerEncounter, seed: number, roadside: readonly string[] = [], firstRaid = false) {
  const map = getWorldMap(VALE);
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
    currentMap: map,
    collisionData: map.collision,
    bounds: { width: map.width, height: map.height },
    currentTile: { x: trainer.position.x, y: trainer.position.y + 1 },
    targetTile: null,
    facing: 'up',
    currentInterior: null,
    hunterState: { spawned: false, defeated: false },
    activatedPoiIds: new Set<string>(),
    defeatedTrainerIds: new Set<string>(),
    trainerEncounters: [trainer],
    bagLines: [],
    bagsFalling: [],
    completedContracts: [],
    mapObjects: [],
    poiSprites: new Map(),
    poiLabels: new Map(),
    packReseated: false,
    bag: new Bag(),
    search: null,
    dialogBox: { visible: false, showMessages: vi.fn(), setY: vi.fn() },
    party: new PokemonParty([new Pokemon(CHARMANDER, 10)]),
    cameras: { main: { flash: vi.fn() } },
    runSession: {
      seed,
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
      plan: { hunter: { spawnDelayMs: 600_000 }, roadsideTrainers: roadside, ...(firstRaid ? { stagedChase: true } : {}) },
    },
    hunterPackHere: () => undefined,
    interrupt: vi.fn(),
    refreshExtractionMarkers: vi.fn(),
    refreshRunTimerHud: vi.fn(),
    createPoi: vi.fn(),
    removePoi: vi.fn(),
    renderSearch: vi.fn(),
  });
  const driven = scene as unknown as Driven;
  return { scene: driven, controls, bag: (scene as unknown as { bag: Bag }).bag };
}

/** A hiker of the vale: a rucksack is carried nine times in ten. */
const hiker = trainersOn(VALE).find((encounter) => encounter.design === 'hiker' && encounter.bossId === undefined)!;

/** The first raid seed whose roll gives this trainer a bag. */
function seedWithABag(trainer: RunTrainerEncounter): number {
  for (let seed = 1; ; seed += 1) {
    const { scene } = besideATrainer(trainer, seed);
    scene.defeatedTrainerIds.add(trainer.trainer.id);
    scene.dropBeatenTrainersBags();
    if (scene.runSession.trainerBags?.[bagIdFor(trainer.trainer.id)]) {
      return seed;
    }
  }
}

describe("a beaten trainer's bag in a raid", () => {
  it('drops nothing for a trainer not yet beaten', () => {
    const { scene } = besideATrainer(hiker, 1);
    scene.dropBeatenTrainersBags();
    expect(scene.runSession.trainerBags ?? {}).toEqual({});
    expect(scene.poisHere().some((poi) => poi.id === bagIdFor(hiker.trainer.id))).toBe(false);
  });

  it('lies on the tile the trainer stood on, named for them and their kind, once beaten', () => {
    const seed = seedWithABag(hiker);
    const { scene } = besideATrainer(hiker, seed);
    scene.defeatedTrainerIds.add(hiker.trainer.id);
    scene.dropBeatenTrainersBags();

    // Drawn once, by the map's own caches: a second drawing here left a
    // caption behind that never changed while the bag was searched.
    expect((scene as unknown as { createPoi: ReturnType<typeof vi.fn> }).createPoi).not.toHaveBeenCalled();
    const bag = scene.poisHere().find((poi) => poi.id === bagIdFor(hiker.trainer.id))!;
    expect(bag.position).toEqual(hiker.position);
    expect(bag.label).toBe(`${hiker.trainer.name}'S ${kitFor('hiker').noun}`);
    expect(bag.reward.length).toBeGreaterThan(0);
  });

  it('is rolled once: the world rebuilt after the next fight finds the same bag where it was', () => {
    const seed = seedWithABag(hiker);
    const { scene } = besideATrainer(hiker, seed);
    scene.defeatedTrainerIds.add(hiker.trainer.id);
    scene.dropBeatenTrainersBags();
    const first = scene.runSession.trainerBags![bagIdFor(hiker.trainer.id)];
    scene.dropBeatenTrainersBags();
    expect(scene.runSession.trainerBags![bagIdFor(hiker.trainer.id)]).toBe(first);
  });

  it('is searched as a cache is, and everything in it goes into the pack', () => {
    const seed = seedWithABag(hiker);
    const { scene, controls, bag } = besideATrainer(hiker, seed);
    scene.defeatedTrainerIds.add(hiker.trainer.id);
    scene.dropBeatenTrainersBags();
    const dropped = scene.runSession.trainerBags![bagIdFor(hiker.trainer.id)]!;

    expect(scene.tryActivatePoiAt(hiker.position)).toEqual([]);
    expect(scene.search?.poi.id).toBe(dropped.id);
    controls.interact[0].justDown = true;
    scene.handleSearchInput();
    controls.interact[0].justDown = false;
    for (let spent = 0; spent < searchDurationMs(searchPieces(dropped.reward)); spent += 16) {
      scene.advanceRunClock(16);
    }

    for (const { itemId, quantity } of dropped.reward) {
      expect(bag.count(itemId), itemId).toBe(quantity);
    }
    expect(scene.search).toBeNull();
    expect(scene.tryActivatePoiAt(hiker.position)).toBeNull();
  });

  it('says so when the trainer beaten had no bag on them, and lays nothing', () => {
    const swimmer = trainersOn(VALE).find((encounter) => kitFor(encounter.design).carried < 0.5 && encounter.bossId === undefined)!;
    for (let seed = 1; seed < 200; seed += 1) {
      const { scene } = besideATrainer(swimmer, seed);
      scene.defeatedTrainerIds.add(swimmer.trainer.id);
      scene.dropBeatenTrainersBags();
      if (scene.runSession.trainerBags?.[bagIdFor(swimmer.trainer.id)] === null) {
        expect(scene.bagLines).toEqual([travellingLightLine(swimmer.trainer.name)]);
        expect(scene.poisHere().some((poi) => poi.id === bagIdFor(swimmer.trainer.id))).toBe(false);
        // Rolled once: the next rebuild says nothing more.
        scene.bagLines.length = 0;
        scene.dropBeatenTrainersBags();
        expect(scene.bagLines).toEqual([]);
        return;
      }
    }
    throw new Error('no raid in 200 left the swimmer without a bag');
  });

  it("drops a roadside trainer's bag with its signature piece alone, and shows no glint over them", () => {
    for (let seed = 1; seed < 60; seed += 1) {
      const { scene } = besideATrainer(hiker, seed, [hiker.trainer.id]);
      expect(scene.trainerBagGlints(hiker)).toBe(false);
      scene.defeatedTrainerIds.add(hiker.trainer.id);
      scene.dropBeatenTrainersBags();
      const bag = scene.runSession.trainerBags![bagIdFor(hiker.trainer.id)];
      if (bag) {
        expect(bag.reward).toHaveLength(1);
        expect(kitFor('hiker').signature.map((row) => row.itemId)).toContain(bag.reward[0].itemId);
      }
    }
  });

  it('glints over a trainer whose bag holds a prize, before the fight, and on the bag only while the prize is in it', () => {
    let seed = 1;
    for (; seed < 2000; seed += 1) {
      if (besideATrainer(hiker, seed).scene.trainerBagGlints(hiker)) break;
    }
    const { scene, controls } = besideATrainer(hiker, seed);
    scene.defeatedTrainerIds.add(hiker.trainer.id);
    scene.dropBeatenTrainersBags();
    const dropped = scene.runSession.trainerBags![bagIdFor(hiker.trainer.id)]!;
    expect(['rare', 'treasure']).toContain(dropped.best);
    const poi = scene.poisHere().find((candidate) => candidate.id === dropped.id)!;
    expect(scene.bagGlints(poi)).toBe(true);

    scene.tryActivatePoiAt(hiker.position);
    controls.interact[0].justDown = true;
    scene.handleSearchInput();
    controls.interact[0].justDown = false;
    for (let spent = 0; spent < searchDurationMs(searchPieces(dropped.reward)); spent += 16) {
      scene.advanceRunClock(16);
    }
    expect(scene.bagGlints(poi)).toBe(false);
  });

  it('does not open a half-searched bag again on a passing step, only when faced and asked', () => {
    const seed = seedWithABag(hiker);
    const { scene } = besideATrainer(hiker, seed);
    scene.defeatedTrainerIds.add(hiker.trainer.id);
    scene.dropBeatenTrainersBags();
    expect(scene.tryActivatePoiAt(hiker.position, true)).toEqual([]);
    scene.closeSearch();
    expect(scene.tryActivatePoiAt(hiker.position, true)).toBeNull();
    expect(scene.search).toBeNull();
    expect(scene.tryActivatePoiAt(hiker.position)).toEqual([]);
    expect(scene.search).not.toBeNull();
  });

  it("always puts a find in the bags of a new save's first raid, roadside or not: the first bags sell bags", () => {
    let bags = 0;
    for (let seed = 1; seed < 80; seed += 1) {
      const { scene } = besideATrainer(hiker, seed, [hiker.trainer.id], true);
      scene.defeatedTrainerIds.add(hiker.trainer.id);
      scene.dropBeatenTrainersBags();
      const bag = scene.runSession.trainerBags![bagIdFor(hiker.trainer.id)];
      if (bag) {
        bags += 1;
        expect(bag.best, `seed ${seed}`).not.toBe('basic');
      }
    }
    expect(bags).toBeGreaterThan(40);
  });
});
