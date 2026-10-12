import { describe, expect, it } from 'vitest';
import { restoreBase } from '../base/baseGames.testkit';
import { buildRoom, roomNamed } from '../base/rooms';
import { CHARMANDER } from '../pokemon';
import { createStartingStash } from '../stash';
import { HOUSE_SNAPSHOT_MAX_BYTES, houseSnapshot, readHouseSnapshot } from './houseSnapshot';

const WHEN = new Date('2026-03-14T12:00:00Z');

/** An owner with a lived-in house: furniture found, two badges, places come home from, a moved table. */
function owner() {
  const stash = createStartingStash(CHARMANDER);
  stash.addItem('pika-cushion', 1);
  stash.addItem('money', 400);
  return restoreBase(stash, {
    defeatedBosses: ['floodplain-toll-keeper', 'overlook-warden'],
    raidRecord: { 'route-1': { deployed: 3, extracted: 2, wiped: 1 } },
    pokedexOwned: [4, 16, 25],
    homeLayout: [
      { id: 'pot-plant', room: 'bolthole', x: 2, y: 6, facing: 0 },
      { id: 'pika-cushion', room: 'bolthole', x: 3, y: 6, facing: 0 },
    ],
  });
}

describe('a house as a visitor sees it', () => {
  it('carries the house and nothing else of the save: no team, no pack, no money', () => {
    const snapshot = houseSnapshot(owner())!;
    expect(snapshot).not.toBeNull();
    expect(snapshot.party).toEqual([]);
    const stash = snapshot.stash as { pokemon: unknown[]; items: Record<string, number> };
    expect(stash.pokemon).toEqual([]);
    expect(Object.keys(stash.items)).toEqual(['pika-cushion']);
    const progress = snapshot.raidProgress as Record<string, unknown>;
    expect(progress.completedContracts).toEqual([]);
    expect(progress.workshopUpgrades).toEqual([]);
    expect(snapshot.mapId).toBe('floodplain-relay');
  });

  it("is the owner's own house when read back: the same furniture standing, the same badges and pennants", () => {
    const home = owner();
    const visited = readHouseSnapshot(houseSnapshot(home));
    expect(visited).not.toBeNull();
    for (const id of ['bolthole', 'bolthole-upstairs']) {
      const room = roomNamed(id)!;
      const theirs = buildRoom(room, home, WHEN);
      const seen = buildRoom(room, visited!, WHEN);
      expect(seen.things.map((thing) => thing.name)).toEqual(theirs.things.map((thing) => thing.name));
      expect(seen.posters).toEqual(theirs.posters);
      expect(seen.collision).toEqual(theirs.collision);
    }
  });

  it('reads nothing that is not a house as one', () => {
    for (const junk of [null, 'house', 42, [], { version: 99 }, { version: 7, party: 'x' }]) {
      expect(readHouseSnapshot(junk)).toBeNull();
    }
  });

  it('fits inside what the database takes, with every doll and a full house', () => {
    const stash = createStartingStash(CHARMANDER);
    const home = restoreBase(stash, {
      pokedexOwned: Array.from({ length: 151 }, (_, index) => index + 1),
      defeatedBosses: ['floodplain-toll-keeper', 'overlook-warden', 'pallet-mill-keeper'],
      homeLayout: Array.from({ length: 60 }, (_, index) => ({
        id: `doll-${index + 1}`,
        room: index % 2 ? 'bolthole' : 'bolthole-upstairs',
        x: index % 10,
        y: Math.floor(index / 10),
        facing: 0,
      })),
    });
    const snapshot = houseSnapshot(home);
    expect(snapshot).not.toBeNull();
    expect(new TextEncoder().encode(JSON.stringify(snapshot)).length).toBeLessThanOrEqual(HOUSE_SNAPSHOT_MAX_BYTES);
  });
});
