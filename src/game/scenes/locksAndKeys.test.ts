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

import { Bag, cellsFor, itemAmountFor, type ItemId } from '../items';
import type { GridPosition } from '../movement/gridMovement';
import { RunPhase } from '../run/RunManager';
import { getWorldMap, type BuiltInMapId } from '../worldMap';
import { EXTRACTION_POINTS, isDugExit, itemThatOpens, type ExtractionPoint } from '../world/extractionPoints';
import { WORLD_POIS, type WorldPoi } from '../world/pois';
import { WorldScene } from './WorldScene';

/** The parts of the scene these tests drive, which are private to it. */
interface Driven {
  tryOpenBarredExitAt(tile: GridPosition): readonly string[] | null;
  tryActivatePoiAt(tile: GridPosition): readonly string[] | null;
  isBlocked(tile: GridPosition): boolean;
  isExtractionOpen(point: ExtractionPoint): boolean;
  reachableExitPositions(): GridPosition[];
}

function exitNamed(label: string): ExtractionPoint {
  const point = EXTRACTION_POINTS.find((candidate) => candidate.label === label);
  if (!point) {
    throw new Error(`no exit ${label}`);
  }
  return point;
}

function crateNamed(label: string): WorldPoi {
  const poi = WORLD_POIS.find((candidate) => candidate.label === label);
  if (!poi) {
    throw new Error(`no landmark ${label}`);
  }
  return poi;
}

/**
 * The world scene on a real shipped map in a live raid, carrying `pack`. The
 * exits are the authored ones; nothing else about the raid is under test.
 */
function inARaid(mapId: BuiltInMapId, pack: readonly ItemId[] = [], bag = new Bag()) {
  played.length = 0;
  for (const itemId of pack) {
    bag.add(itemId, 1);
  }
  const map = getWorldMap(mapId);
  const refreshExtractionMarkers = vi.fn();
  const runSession = {
    exitsOpened: [] as string[],
    manager: {
      phase: RunPhase.InRun,
      snapshot: () => ({ elapsedMs: 30_000 }),
      registerFoundItem: vi.fn(),
    },
  };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: map,
    collisionData: map.collision.map((row) => [...row]),
    bag,
    runSession,
    activatedPoiIds: new Set<string>(),
    poiSprites: new Map(),
    poiLabels: new Map(),
    worldLabels: [],
    completedContracts: [],
    trainerEncounters: [],
    defeatedTrainerIds: new Set<string>(),
    hunterState: { spawned: false, defeated: false, position: null },
    idleFigures: [],
    caughtLegends: [],
    packReseated: false,
    cameras: { main: { shake: vi.fn(), flash: vi.fn() } },
    refreshExtractionMarkers,
  });
  return { scene: scene as unknown as Driven, bag, runSession, refreshExtractionMarkers };
}

describe('a locked gate', () => {
  const gate = exitNamed('WEIR GATE');

  it('is a wall, shut, until a raid carrying its own key opens it', () => {
    const raid = inARaid('pallet-town');
    expect(raid.scene.isBlocked(gate.position)).toBe(true);
    expect(raid.scene.isExtractionOpen(gate)).toBe(false);
    // Nobody may be sent to it: not the hunter's lane, not a pushed boulder.
    expect(raid.scene.reachableExitPositions()).not.toContainEqual(gate.position);
  });

  it("says what FireRed says at a locked door, what it needs, and where that is found, and opens nothing", () => {
    const raid = inARaid('pallet-town');
    expect(raid.scene.tryOpenBarredExitAt(gate.position)).toEqual([
      'WEIR GATE: the gate is locked…',
      'No! It needs the Weir Key!',
      // Rubble and the water both say where their tool comes from (Bill); a
      // key is never sold, so the gate says it is a find of this map's own.
      'The Weir Key is a rare find, somewhere on this map.',
    ]);
    expect(played).toEqual(['denied']);
    expect(raid.runSession.exitsOpened).toEqual([]);
    expect(raid.scene.isBlocked(gate.position)).toBe(true);
  });

  it('on every shipped map, says its key is a find of that map', () => {
    const keyGates = EXTRACTION_POINTS.filter((point) => itemThatOpens(point) && !isDugExit(point));
    expect(keyGates.length).toBeGreaterThan(0);
    for (const point of keyGates) {
      const raid = inARaid(point.mapId as BuiltInMapId);
      const lines = raid.scene.tryOpenBarredExitAt(point.position) ?? [];
      expect(lines[lines.length - 1], point.label).toMatch(/ is a rare find, somewhere on this map\.$/);
    }
  });

  it('will not turn for a Lockpick, a Pickaxe or another map\'s key', () => {
    const raid = inARaid('pallet-town', ['lockpick', 'pickaxe', 'paddock-key']);
    raid.scene.tryOpenBarredExitAt(gate.position);
    expect(raid.scene.isExtractionOpen(gate)).toBe(false);
    expect(raid.bag.count('lockpick')).toBe(1);
  });

  it('opens to its key for the rest of the raid, and the key is not used up', () => {
    const raid = inARaid('pallet-town', ['weir-key']);
    expect(raid.scene.tryOpenBarredExitAt(gate.position)).toEqual([
      'Bingo! The Weir Key opened the gate!',
      'WEIR GATE is open: a way out, for this raid.',
    ]);
    expect(raid.runSession.exitsOpened).toEqual(['WEIR GATE']);
    expect(raid.refreshExtractionMarkers).toHaveBeenCalled();
    expect(raid.scene.isExtractionOpen(gate)).toBe(true);
    expect(raid.scene.isBlocked(gate.position)).toBe(false);
    expect(raid.scene.reachableExitPositions()).toContainEqual(gate.position);
    expect(raid.bag.count('weir-key')).toBe(1);
    // An open gate is just ground: facing it again says nothing.
    expect(raid.scene.tryOpenBarredExitAt(gate.position)).toBeNull();
  });
});

describe('rubble on a shipped map', () => {
  const rubble = exitNamed('ROCKFALL');

  it('is the map maker\'s Pickaxe exit: a wall until a Pickaxe digs it out', () => {
    const without = inARaid('pallet-town', ['weir-key', 'lockpick']);
    expect(without.scene.tryOpenBarredExitAt(rubble.position)?.join(' ')).toContain('A Pickaxe in the pack would dig it out');
    expect(without.scene.isBlocked(rubble.position)).toBe(true);

    const dug = inARaid('pallet-town', ['pickaxe']);
    expect(dug.scene.tryOpenBarredExitAt(rubble.position)?.[0]).toBe(
      'You swung the Pickaxe into the rubble and dug it out.',
    );
    expect(dug.scene.isExtractionOpen(rubble)).toBe(true);
    expect(dug.bag.count('pickaxe')).toBe(1);
  });
});

describe('a locked crate', () => {
  const crate = crateNamed('KILN STRONGBOX');

  it('pays nothing and spends nothing without a Lockpick, and says so in FireRed\'s words', () => {
    const raid = inARaid('pallet-town');
    const lines = raid.scene.tryActivatePoiAt(crate.position);
    expect(lines?.[0]).toBe('KILN STRONGBOX: the crate is locked…');
    expect(lines?.[1]).toContain('A Lockpick in the pack would open it');
    expect(played).toEqual(['denied']);
    expect(raid.bag.count('super-potion')).toBe(0);
    // Still there to come back to.
    expect(raid.scene.tryActivatePoiAt(crate.position)?.[0]).toBe('KILN STRONGBOX: the crate is locked…');
  });

  it('opens to a Lockpick, which snaps in the lock, and pays the whole cache', () => {
    const raid = inARaid('pallet-town', ['lockpick', 'lockpick']);
    const lines = raid.scene.tryActivatePoiAt(crate.position);
    expect(lines?.[0]).toBe('The Lockpick turned the lock, and snapped in it.');
    expect(raid.bag.count('lockpick')).toBe(1);
    for (const { itemId, quantity } of crate.reward) {
      expect(raid.bag.count(itemId)).toBe(quantity);
    }
    // Opened once a raid, like every cache.
    expect(raid.scene.tryActivatePoiAt(crate.position)).toBeNull();
    expect(raid.bag.count('lockpick')).toBe(1);
  });

  it('keeps the pick when the pack has no room for the cache', () => {
    // A Satchel's twelve squares, eleven of them full of Potions: the pick
    // fits, the cache does not.
    const raid = inARaid('pallet-town', [], new Bag({ potion: 11 }, { width: 4, height: 3 }));
    raid.bag.add('lockpick', 1);
    const lines = raid.scene.tryActivatePoiAt(crate.position);
    expect(lines?.[0]).toContain('No room for');
    expect(raid.bag.count('lockpick')).toBe(1);
    expect(raid.bag.count('super-potion')).toBe(0);
  });

  it('counts the square of the pick that snaps in the lock as room for the cache', () => {
    // A Satchel with exactly the cache's squares free once the pick is gone,
    // and one short while it is still in the pack. The pick snaps opening the
    // crate, so its square is the cache's: refused, the player would be told
    // to put something down for good to make room the pick was about to make.
    const squares = crate.reward.reduce((total, { itemId, quantity }) => total + cellsFor(itemId, quantity), 0);
    const raid = inARaid('pallet-town', [], new Bag({ potion: 12 - squares }, { width: 4, height: 3 }));
    raid.bag.add('lockpick', 1);
    expect(raid.bag.fitsAll(crate.reward)).toBe(false);
    const lines = raid.scene.tryActivatePoiAt(crate.position);
    expect(lines?.[0]).toBe('The Lockpick turned the lock, and snapped in it.');
    expect(raid.bag.count('lockpick')).toBe(0);
    expect(raid.bag.count('potion')).toBe(12 - squares);
    for (const { itemId, quantity } of crate.reward) {
      expect(raid.bag.count(itemId)).toBe(quantity);
    }
  });

  it('is an ordinary cache to every crate without a lock', () => {
    const open = crateNamed('TOWN PUMP');
    const raid = inARaid('pallet-town', ['lockpick']);
    raid.scene.tryActivatePoiAt(open.position);
    expect(raid.bag.count('lockpick')).toBe(1);
    expect(raid.bag.count('antidote')).toBe(1);
  });
});

describe('what a cache says it did', () => {
  // Playtest 6, B9: "TOWN PUMP: 1× Antidote secured. Detour reward is LOST ON
  // WIPE" - "secured" is the secure container's word, and a cache pays into
  // the pack, which a wipe takes. The line says where it went and what that
  // risks, and never calls it secured.
  it('says the payout went into the pack, at risk, in plain amounts', () => {
    const open = crateNamed('TOWN PUMP');
    const raid = inARaid('pallet-town');
    const lines = raid.scene.tryActivatePoiAt(open.position) ?? [];
    expect(lines.join(' ')).not.toMatch(/secured/i);
    expect(lines).toEqual(['TOWN PUMP: 2 Potions and 1 Antidote went into the PACK. Lost if you wipe - extract to bank them.']);
  });

  it('names every piece of a cache that pays more than one thing', () => {
    const crate = crateNamed('KILN STRONGBOX');
    const raid = inARaid('pallet-town', ['lockpick']);
    const lines = raid.scene.tryActivatePoiAt(crate.position) ?? [];
    expect(lines.join(' ')).not.toMatch(/secured/i);
    expect(lines[1]).toMatch(/^KILN STRONGBOX: .+ went into the PACK\. Lost if you wipe - extract to bank them\.$/);
    for (const { itemId, quantity } of crate.reward) {
      expect(lines[1]).toContain(itemAmountFor(itemId, quantity));
    }
  });

  // A full pack at a cache said "No room for 2× POTION and 1× ANTIDOTE", while
  // the same pack at a ground find says "No room for 3 POTIONS" and the cache
  // itself, once taken, says "2 Potions and 1 Antidote". One pack, one way of
  // counting what will not go in it.
  it('names what will not fit in the same amounts as everything else', () => {
    const open = crateNamed('TOWN PUMP');
    const raid = inARaid('pallet-town', [], new Bag({ potion: 18 }, { width: 6, height: 3 }));
    const lines = raid.scene.tryActivatePoiAt(open.position) ?? [];
    expect(lines[0]).toBe(
      'No room for 2 POTIONS and 1 ANTIDOTE - the cache needs 3 squares. Drop something from the PACK and work it again.',
    );
    expect(lines.join(' ')).not.toContain('×');
  });
});

describe('the flash a cache opens with', () => {
  // Playtest 6: every pickup and every cache flashed the whole screen to solid
  // colour for a frame, because Phaser's flash starts fully opaque. It is a
  // glint now: whatever the camera's flash starts from is held to the peak.
  it('starts no stronger than a glint, so the map stays readable under it', async () => {
    const { FLASH_PEAK_ALPHA } = await import('../ui/screenFlash');
    const raid = inARaid('pallet-town');
    const startedAt: number[] = [];
    const flashEffect = { alpha: 1 };
    (raid.scene as unknown as { cameras: unknown }).cameras = {
      main: { shake: vi.fn(), flashEffect, flash: () => startedAt.push(flashEffect.alpha) },
    };
    raid.scene.tryActivatePoiAt(crateNamed('TOWN PUMP').position);
    expect(startedAt).toHaveLength(1);
    expect(startedAt[0]).toBeLessThanOrEqual(FLASH_PEAK_ALPHA);
  });
});
