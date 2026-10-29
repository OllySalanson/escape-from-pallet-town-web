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

import { Bag, type ItemId } from '../items';
import { searchPieces } from '../world/cacheSearch';
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
  advanceSearch(clockMs: number): void;
  takeSearched(indices: readonly number[]): void;
  search: { said: string | null } | null;
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
    cachesSearched: undefined as Record<string, unknown> | undefined,
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

/** Searches the open cache to the end and takes every piece the pack will hold. */
function searchOut(raid: ReturnType<typeof inARaid>): void {
  raid.scene.advanceSearch(60_000);
  const pieces = raid.scene.search ? searchPieces((raid.scene.search as unknown as { poi: { reward: WorldPoi['reward'] } }).poi.reward) : [];
  raid.scene.takeSearched(pieces.map((_piece, index) => index));
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

  it('opens to a Lockpick, which snaps in the lock, and is then searched for the whole cache', () => {
    const raid = inARaid('pallet-town', ['lockpick', 'lockpick']);
    const lines = raid.scene.tryActivatePoiAt(crate.position);
    expect(lines).toEqual(['The Lockpick turned the lock, and snapped in it.']);
    expect(raid.bag.count('lockpick')).toBe(1);
    // Opening hands nothing over: what is in it comes to light as it is searched.
    for (const { itemId } of crate.reward) {
      expect(raid.bag.count(itemId)).toBe(0);
    }
    searchOut(raid);
    for (const { itemId, quantity } of crate.reward) {
      expect(raid.bag.count(itemId)).toBe(quantity);
    }
    // Opened once a raid, like every cache, and spent once it is emptied.
    expect(raid.scene.tryActivatePoiAt(crate.position)).toBeNull();
    expect(raid.bag.count('lockpick')).toBe(1);
  });

  it('opens to a pick even when the pack is full, and keeps what will not go in for later', () => {
    // A Satchel's twelve squares, eleven of them full of Potions.
    const raid = inARaid('pallet-town', [], new Bag({ potion: 11 }, { width: 4, height: 3 }));
    raid.bag.add('lockpick', 1);
    expect(raid.scene.tryActivatePoiAt(crate.position)).toEqual(['The Lockpick turned the lock, and snapped in it.']);
    expect(raid.bag.count('lockpick')).toBe(0);
    searchOut(raid);
    expect(raid.scene.search?.said).toMatch(/^NO ROOM FOR /);
    expect(played).toContain('denied');
    // Walked back to, it carries on: no second pick, the same search.
    raid.scene.search = null;
    expect(raid.scene.tryActivatePoiAt(crate.position)).toEqual([]);
    expect(raid.scene.search).not.toBeNull();
    expect(raid.runSession.cachesSearched?.[crate.id]).toBeDefined();
  });

  it('is an ordinary cache to every crate without a lock', () => {
    const open = crateNamed('TOWN PUMP');
    const raid = inARaid('pallet-town', ['lockpick']);
    raid.scene.tryActivatePoiAt(open.position);
    searchOut(raid);
    expect(raid.bag.count('lockpick')).toBe(1);
    expect(raid.bag.count('antidote')).toBe(1);
  });
});

describe('what a cache says when it opens', () => {
  // Opening a cache used to pay it out whole into a line of dialogue that
  // stopped the player. It is searched now, in a panel that stops nothing, so
  // opening one has nothing to say in a box.
  it('raises no dialogue: the search panel speaks for it', () => {
    const open = crateNamed('TOWN PUMP');
    const raid = inARaid('pallet-town');
    expect(raid.scene.tryActivatePoiAt(open.position)).toEqual([]);
    expect(raid.scene.search).not.toBeNull();
    expect(played).toContain('cacheOpen');
  });

  it('names what will not fit in capitals, and sends the player to the pack', () => {
    const open = crateNamed('TOWN PUMP');
    const raid = inARaid('pallet-town', [], new Bag({ potion: 18 }, { width: 6, height: 3 }));
    raid.scene.tryActivatePoiAt(open.position);
    searchOut(raid);
    expect(raid.scene.search?.said).toBe('NO ROOM FOR POTION: [B] PACK');
    expect(raid.bag.count('antidote')).toBe(0);
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
