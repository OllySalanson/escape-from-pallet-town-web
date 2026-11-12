import { describe, expect, it } from 'vitest';
import { gateKey, gatesForMap } from '../../../../src/game/world/gates';
import { highMoor } from './highMoor';
import { bareDistrict, valeSolid, walkDistrict } from './walkedTwoAbreast.testkit';

/**
 * The captain, 11 Nov 2026, of the filled vale: "when you're walking around,
 * there's just often things in your way, and it's quite fiddly to get through
 * places". Millbrook, THE HARBOUR, TANGLEWOOD, PINE HOLLOW and THE CROSSING were
 * fixed first; HIGH MOOR, the drove road north out of Mill Square, is the sixth,
 * held to the same rule (`tanglewood.test.ts`): a walker two tiles wide gets from
 * the road up from Millbrook to every way out, door, sign, landmark, berry tree,
 * person, trainer and find, to within the one last step a porch is, with every
 * figure on every tile of its beat; no way out or door is further than the same
 * ground walked bare; and nothing stands on a road. The road winds up the moor,
 * so the lawn inside each bend is a straight way up, and what stands there is
 * in the way of it: the halfway rest's log and stump, the Walker and the tarn's
 * Psyduck stood on the straight line between the bend and the tarn, and the
 * drovers' herd girl and Drover Hale at the corner below their fold.
 *
 * THE LOST FOLD is behind a boulder only Strength moves, in a cut one tile high:
 * narrow on purpose, as Millbrook's Cut garden is. It is walked on its own, from
 * the cut's far end, and held to Tanglewood's rule inside.
 *
 * Against the moor before it was made walkable this names the toll house's door
 * (a barrel and the clerk shut its step), the Little Stones' sign (the stones
 * and the Clefairy filled the ring), the drovers' camp hut (a log across its
 * door), the spring's bath hut (its attendant on the step), the fold and the
 * Moor Foot's pen (gates one tile wide), a find shut in by a waystone, the Lost
 * Fold's sign, berry tree, shieling, hut and Old Hob behind a sign, a tree and a
 * log, three signs and a landmark standing on the roads, and every way out
 * further than it need be.
 */
describe('HIGH MOOR, walked two abreast', () => {
  const { file } = highMoor();
  // High Moor is the plan's cell [0, 0].
  const ORIGIN = { x: 64, y: 64 };
  // The drove road up from Millbrook, its first tile on the moor.
  const ROAD_IN = { x: 30, y: 63 };
  // The landing on Moor Top.
  const MOOR_TOP = { x: 22, y: 37 };
  // The Lost Fold, and the far end of the cut its boulder stands in.
  const lostFold = (x: number, y: number) => x >= 42 && x <= 53 && y >= 8 && y <= 15;
  const CUT_END = { x: 42, y: 12 };
  const opened = gatesForMap('greystone-vale').map(gateKey);
  const solid = valeSolid(ORIGIN, opened);
  const walked = walkDistrict(file, solid, [ROAD_IN]);
  const fold = walkDistrict(file, solid, [CUT_END]);

  it('comes up the drove road, and lands on Moor Top, with room to walk two abreast', () => {
    expect(walked.twoAbreast(ROAD_IN.x, ROAD_IN.y)).toBe(0);
    expect(walked.twoAbreast(MOOR_TOP.x, MOOR_TOP.y)).toBeGreaterThan(0);
  });

  it('reaches every way out, door, sign, landmark, berry tree, person, trainer and find two abreast', () => {
    const snagged = walked
      .places()
      .filter((place) => !lostFold(place.x, place.y))
      .filter((place) => place.steps < 0)
      .map((place) => `${place.name} (${place.x},${place.y})`);
    expect(snagged).toEqual([]);
  });

  it('never makes a pair walk further to a way out or a door than the same ground with nothing on it', () => {
    const bare = bareDistrict(file);
    expect(walked.longerTwoAbreast(walkDistrict(bare.file, bare.solid, [ROAD_IN]))).toEqual([]);
  });

  it('keeps the roads clear: nothing stands on them', () => {
    expect(walked.blockedOn(',d')).toEqual([]);
  });

  it('lets a pair through the Lost Fold, once the boulder is moved, to everything in it', () => {
    const inFold = fold.places().filter((place) => lostFold(place.x, place.y));
    expect(inFold.length).toBeGreaterThan(5);
    expect(
      inFold.filter((place) => place.steps < 0).map((place) => `${place.name} (${place.x},${place.y})`),
    ).toEqual([]);
    const bare = bareDistrict(file);
    // The cut is one tile high, so nothing outside the fold is in reach of a pair from its end.
    expect(fold.longerTwoAbreast(walkDistrict(bare.file, bare.solid, [CUT_END]))).toEqual([]);
  });
});
