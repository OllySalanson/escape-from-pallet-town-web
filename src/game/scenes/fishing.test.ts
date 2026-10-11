import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

// The cast sounds at the start and on a bite; what is under test is the cast.
const played: string[] = [];
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy(
    {},
    { get: (_target, key) => (key === 'play' ? (name: string) => played.push(name) : vi.fn()) },
  ),
}));

import { Bag } from '../items';
import type { GridPosition } from '../movement/gridMovement';
import { Pokemon, PokemonParty } from '../pokemon';
import { CHARMANDER } from '../pokemon/species';
import { RunPhase } from '../run/RunManager';
import { getWorldMap, type WorldMapId } from '../worldMap';
import { districtAt } from '../world/districts';
import {
  NOT_EVEN_A_NIBBLE,
  ON_THE_HOOK,
  fishingTable,
  fishingWaterAt,
  isFishingWater,
} from '../world/fishing';
import type { WildEncounter } from '../world/wildEncounters';
import { WorldScene } from './WorldScene';

/** The parts of the scene these tests drive, which are private to it. */
interface Driven {
  fishing: object | undefined;
  pendingWildBattle: WildEncounter | undefined;
  tryFishAt(tile: GridPosition): void;
  advanceFishing(deltaMs: number): void;
  advanceRunClock(deltaMs: number): void;
  interrupt(lines: readonly string[]): void;
}

const STEPS: readonly GridPosition[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/** A bank on the real map: a tile to stand on and the water in front of it. */
function bankOn(
  mapId: WorldMapId,
  inDistrict?: string,
): { stand: GridPosition; water: GridPosition } {
  const map = getWorldMap(mapId);
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (map.collision[y][x] || (inDistrict && districtAt(mapId, { x, y })?.name !== inDistrict)) {
        continue;
      }
      const water = STEPS.map((step) => ({ x: x + step.x, y: y + step.y })).find((tile) =>
        isFishingWater(map, tile),
      );
      if (water) {
        return { stand: { x, y }, water };
      }
    }
  }
  throw new Error(`no bank on ${mapId}`);
}

/** A float that answers every call a cast makes of it. */
function fakeGraphics() {
  const graphics: Record<string, unknown> = { x: 0, y: 0 };
  for (const method of ['fillStyle', 'fillRect', 'setDepth', 'clear']) {
    graphics[method] = () => graphics;
  }
  graphics.setPosition = (x: number, y: number) => Object.assign(graphics, { x, y });
  graphics.setY = (y: number) => Object.assign(graphics, { y });
  graphics.destroy = vi.fn();
  return graphics;
}

/**
 * The world scene standing on a real bank, with whatever the pack holds and a
 * raid stream that hands out `draws` in order - the dots, the bite, and then
 * the encounter roll's three - and a seeded-looking 0.5 after that.
 */
function standingAtTheWater({
  mapId = 'viridian-city',
  district,
  pack = [],
  draws = [],
}: {
  mapId?: WorldMapId;
  district?: string;
  pack?: readonly string[];
  draws?: readonly number[];
} = {}) {
  played.length = 0;
  const map = getWorldMap(mapId);
  const { stand, water } = bankOn(mapId, district);
  const bag = new Bag();
  for (const itemId of pack) {
    bag.add(itemId, 1);
  }
  const queue = [...draws];
  const clock = { elapsedMs: 30_000 };
  const said: string[] = [];
  const progress: string[] = [];
  const dialogBox = {
    visible: false,
    showMessages: (lines: readonly string[]) => {
      said.push(...lines);
      dialogBox.visible = true;
    },
    showProgress: (text: string) => {
      progress.push(text);
      dialogBox.visible = true;
    },
    setVisible: (visible: boolean) => {
      dialogBox.visible = visible;
    },
    setY: vi.fn(),
  };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: map,
    currentTile: stand,
    facing: 'down',
    bag,
    party: new PokemonParty([new Pokemon(CHARMANDER, 10)]),
    dialogBox,
    mapObjects: [],
    add: { graphics: fakeGraphics },
    cameras: { main: { shake: vi.fn(), worldView: { left: 0, top: 0 } } },
    scale: { height: 240 },
    showIdlePose: vi.fn(),
    runSession: {
      rng: { next: () => queue.shift() ?? 0.5 },
      manager: {
        phase: RunPhase.InRun,
        isEnrageGraceExpired: false,
        snapshot: () => ({ elapsedMs: clock.elapsedMs }),
        tick: (deltaMs: number) => {
          clock.elapsedMs += deltaMs;
          return { elapsedMs: clock.elapsedMs, isEnraged: false };
        },
      },
    },
    // The hunter, the exits and the HUD are not what these tests are about.
    advanceHunterSearch: vi.fn(),
    advanceHunterWhileStill: vi.fn(),
    placeHunterIfDue: vi.fn(),
    refreshExtractionMarkers: vi.fn(),
    refreshRunTimerHud: vi.fn(),
  });
  return { scene: scene as unknown as Driven, water, stand, said, progress, clock, dialogBox };
}

/** Plays a cast out in frames of `frameMs`, as `update` hands them over. */
function playOut(world: ReturnType<typeof standingAtTheWater>, frameMs = 100): number {
  let spent = 0;
  while (world.scene.fishing && spent < 10_000) {
    world.scene.advanceRunClock(frameMs);
    world.scene.advanceFishing(frameMs);
    spent += frameMs;
  }
  return spent;
}

describe('fishing in a raid', () => {
  it('tells a player with no rod what would reach the water, and casts nothing', () => {
    const world = standingAtTheWater();
    world.scene.tryFishAt(world.water);
    expect(world.scene.fishing).toBeUndefined();
    expect(world.said.join(' ')).toContain('A fishing rod in the pack would reach it');
    expect(played).toEqual([]);
  });

  it('leaves anything that is not open water alone', () => {
    const world = standingAtTheWater({ pack: ['good-rod'] });
    world.scene.tryFishAt(world.stand);
    expect(world.scene.fishing).toBeUndefined();
    expect(world.said).toEqual([]);
  });

  it('casts, puts the dots up one at a time, and answers a coin that lands tails with nothing', () => {
    // Four dots (the first draw), and no bite (the second).
    const world = standingAtTheWater({ pack: ['old-rod'], draws: [0, 0.9] });
    world.scene.tryFishAt(world.water);
    expect(world.scene.fishing).toBeDefined();
    expect(played).toEqual(['rodCast']);

    playOut(world);
    expect(world.progress.filter((text) => text !== '')).toEqual(['·', '· ·', '· · ·', '· · · ·']);
    expect(world.said).toEqual([NOT_EVEN_A_NIBBLE]);
    expect(world.scene.pendingWildBattle).toBeUndefined();
  });

  it('charges the raid clock for the whole cast, as it does a step or a line', () => {
    // Ten dots: the longest cast FireRed plays.
    const world = standingAtTheWater({ pack: ['good-rod'], draws: [0.99, 0.9] });
    const before = world.clock.elapsedMs;
    world.scene.tryFishAt(world.water);
    const spent = playOut(world);
    expect(world.clock.elapsedMs - before).toBe(spent);
    // A second's cast and eleven twenty-frame beats: the ten dots and the one
    // in which FireRed finds the row full.
    expect(spent).toBeGreaterThanOrEqual(1000 + 11 * (1000 / 3));
    expect(spent).toBeLessThan(1000 + 11 * (1000 / 3) + 100);
  });

  it('hooks what the water holds on a bite, and the fight waits for the line to be read', () => {
    // Four dots, a bite, then the encounter roll: the rate (always), the
    // first slot (Poliwag, three in five), and the top of its level range.
    const world = standingAtTheWater({ pack: ['good-rod'], draws: [0, 0.1, 0, 0, 0.99] });
    world.scene.tryFishAt(world.water);
    playOut(world);
    expect(fishingWaterAt('viridian-city', world.stand)).toBe('fresh');
    expect(world.scene.pendingWildBattle).toEqual({ speciesId: 'poliwag', level: 15 });
    expect(world.said).toEqual([ON_THE_HOOK]);
    expect(played).toEqual(['rodCast', 'fishBite']);

    // Reading the line that starts a fight is the fight's first beat, and free.
    const before = world.clock.elapsedMs;
    world.scene.advanceRunClock(500);
    expect(world.clock.elapsedMs).toBe(before);
  });

  it('fishes the sea off a tidal place: a Horsea or a Krabby where the river would give a Poliwag', () => {
    const world = standingAtTheWater({
      mapId: 'pallet-town',
      district: 'THE SALTINGS',
      pack: ['good-rod'],
      draws: [0, 0.1, 0, 0.9, 0],
    });
    world.scene.tryFishAt(world.water);
    playOut(world);
    expect(world.scene.pendingWildBattle).toEqual({ speciesId: 'krabby', level: 5 });
    const sea = fishingTable('sea', 'good-rod').entries.map((entry) => entry.speciesId);
    expect(sea).toContain(world.scene.pendingWildBattle!.speciesId);
  });

  it('only ever hooks a Magikarp on the Old Rod', () => {
    const world = standingAtTheWater({ pack: ['old-rod'], draws: [0, 0.1, 0, 0.99, 0.99] });
    world.scene.tryFishAt(world.water);
    playOut(world);
    expect(world.scene.pendingWildBattle).toEqual({ speciesId: 'magikarp', level: 5 });
  });

  it('gives the box up to anything the world raises unasked, and the cast goes with it', () => {
    const world = standingAtTheWater({ pack: ['good-rod'], draws: [0.99, 0.1] });
    world.scene.tryFishAt(world.water);
    world.scene.advanceFishing(1500);
    world.scene.interrupt(['FOUND YOU.']);
    expect(world.scene.fishing).toBeUndefined();
    expect(world.said).toEqual(['FOUND YOU.']);
    expect(world.scene.pendingWildBattle).toBeUndefined();
  });
});
