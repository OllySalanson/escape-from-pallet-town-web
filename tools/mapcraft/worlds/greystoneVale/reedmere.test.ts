import { describe, expect, it } from 'vitest';
import { gateKey, gatesForMap } from '../../../../src/game/world/gates';
import type { MapFileSpot } from '../../../../src/game/world/mapFile';
import { reedmere } from './reedmere';
import { bareDistrict, valeSolid, walkDistrict } from './walkedTwoAbreast.testkit';

/**
 * The captain, 11 Nov 2026, of the filled vale: "when you're walking around,
 * there's just often things in your way, and it's quite fiddly to get through
 * places". Millbrook, THE HARBOUR, TANGLEWOOD, PINE HOLLOW, THE CROSSING and
 * HIGH MOOR came first; REEDMERE, the marsh south of Mill Square with Mere End
 * on its bay, is the seventh, held to Tanglewood's rule (`tanglewood.test.ts`):
 * a walker two tiles wide - which is what a boardwalk is - gets from every way
 * in to every way out, door, sign, landmark, berry tree, person, trainer and
 * find, to within the one last step a porch is, with every figure on every tile
 * of its beat; no way out or door is further than the same marsh walked bare;
 * and nothing stands on a road.
 *
 * It is walked from all four ways in, not one, because the marsh is a ring: the
 * trail up from Smugglers' Cove reaches Mere End from the south as the lane from
 * Millbrook does from the north, and what stood on the trail - the Coast notice
 * and the Coast Guard, in a way two wide - made every door in Mere End fifty
 * steps further for anybody coming up it.
 *
 * DUCK ISLAND is reached by the punt alone, so it is walked on its own, from the
 * punt's deck.
 */
describe('REEDMERE, walked two abreast', () => {
  const { file } = reedmere();
  // Reedmere is the plan's cell [0, 2].
  const ORIGIN = { x: 64, y: 192 };
  // The ways in: the lane down from Millbrook, the bank from Gull Strand, the
  // Mere Path from the west - a trail one tile wide where it leaves the map, so
  // its first tile two wide - and the trail up from Smugglers' Cove.
  const WAYS_IN: readonly MapFileSpot[] = [
    { x: 40, y: 0 },
    { x: 63, y: 18 },
    { x: 1, y: 26 },
    { x: 20, y: 63 },
  ];
  const duckIsland = (x: number, y: number) => x >= 20 && x <= 28 && y >= 26 && y <= 34;
  const PUNT_DECK = { x: 27, y: 30 };
  // What stands on boards or strips on purpose, and only this: the turbary's peat
  // strips are cut ground, not a way, which the Diglett and the Turf Boy work and
  // the eel notice stands at the end of; the eel market is a market on its own
  // deck south of the boardwalk; the Mere Fisher sits at the end of his boards and
  // the staithe's jetty ends in The Mere; and the Drowned Duck's sign has a plank
  // to itself in the bay.
  const turbary = (x: number, y: number) => x >= 34 && x <= 41 && y >= 50 && y <= 54;
  const eelMarket = (x: number, y: number) => x >= 33 && x <= 41 && y >= 46 && y <= 49;
  const onPurpose = (x: number, y: number) =>
    turbary(x, y) ||
    eelMarket(x, y) ||
    (x === 30 && y === 26) ||
    (x === 41 && y === 31) ||
    (x === 37 && y === 43);
  const opened = gatesForMap('greystone-vale').map(gateKey);
  const solid = valeSolid(ORIGIN, opened);
  const walked = walkDistrict(file, solid, WAYS_IN);
  const island = walkDistrict(file, solid, [PUNT_DECK]);

  it('comes in two abreast by every way in', () => {
    expect(WAYS_IN.map((spot) => walked.twoAbreast(spot.x, spot.y))).toEqual([0, 0, 0, 0]);
  });

  it('reaches every way out, door, sign, landmark, berry tree, person, trainer and find two abreast', () => {
    const snagged = walked
      .places()
      .filter((place) => !duckIsland(place.x, place.y))
      .filter((place) => place.steps < 0)
      .map((place) => `${place.name} (${place.x},${place.y})`);
    expect(snagged).toEqual([]);
  });

  it('never makes a pair walk further to a way out or a door than the same marsh with nothing in it', () => {
    const bare = bareDistrict(file);
    expect(walked.longerTwoAbreast(walkDistrict(bare.file, bare.solid, WAYS_IN))).toEqual([]);
  });

  it('keeps the boardwalks and the lanes clear: nothing stands on them', () => {
    expect(walked.blockedOn(',d_', onPurpose)).toEqual([]);
  });

  it('lets a pair off the punt onto Duck Island, to everything on it', () => {
    const onIsland = island.places().filter((place) => duckIsland(place.x, place.y));
    expect(onIsland.length).toBeGreaterThanOrEqual(3);
    expect(
      onIsland.filter((place) => place.steps < 0).map((place) => `${place.name} (${place.x},${place.y})`),
    ).toEqual([]);
  });
});
