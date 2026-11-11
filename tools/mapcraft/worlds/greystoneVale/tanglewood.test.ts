import { describe, expect, it } from 'vitest';
import { gateKey, gatesForMap } from '../../../../src/game/world/gates';
import { tanglewood } from './tanglewood';
import { bareDistrict, valeSolid, walkDistrict } from './walkedTwoAbreast.testkit';

/**
 * The captain, 11 Nov 2026, of the filled vale: "when you're walking around,
 * there's just often things in your way, and it's quite fiddly to get through
 * places". Millbrook was fixed first and THE HARBOUR second; TANGLEWOOD is the
 * third area, and held to the same rule (`millbrook.test.ts`): a walker two
 * tiles wide - which is what a lane is - gets from where the road comes in from
 * The Crossing to every way out, door, sign, landmark, berry tree, person,
 * trainer and find, to within the one last step a porch is. Every figure counts
 * as standing on every tile of its beat. Against the wood before it was made
 * walkable this names nearly everything in it: a log across the bend in the
 * road, the TANGLEWOOD sign in the mouth of the lane north, an Oddish on the
 * lane to the mushroom ring and the ring across it, Bug Catcher Tam in the
 * mouth of the lane to the ride, a statue on the path to the caves, the WOOD
 * MOUTH sign in the only way to the mouth, the broken cart's sign in the way
 * down to the Old Oak, and doors in Mislaid, the ride and the lodge opening onto
 * a strip one tile deep.
 */
describe('TANGLEWOOD, walked two abreast', () => {
  const { file } = tanglewood();
  // Tanglewood is the plan's cell [2, 1].
  const ORIGIN = { x: 192, y: 128 };
  // The road in from The Crossing, its first tile inside the wood.
  const ROAD_IN = { x: 0, y: 32 };
  // Every gate open, Koga's included: this is about what stands in the way, not who holds a door.
  const opened = gatesForMap('greystone-vale').map(gateKey);
  const walked = walkDistrict(file, valeSolid(ORIGIN, opened), [ROAD_IN]);

  it('comes in off The Crossing’s road with room to walk two abreast', () => {
    expect(walked.twoAbreast(ROAD_IN.x, ROAD_IN.y)).toBe(0);
  });

  it('reaches every way out, door, sign, landmark, berry tree, person, trainer and find two abreast', () => {
    const snagged = walked
      .places()
      .filter((place) => place.steps < 0)
      .map((place) => `${place.name} (${place.x},${place.y})`);
    expect(snagged).toEqual([]);
  });

  it('never makes a pair walk further to a way out or a door than the same lanes with nothing in them', () => {
    // A pair walks a winding wood further than one walker does, a step for every
    // time a lane doubles back, so the measure is the same wood walked bare.
    const bare = bareDistrict(file);
    expect(walked.longerTwoAbreast(walkDistrict(bare.file, bare.solid, [ROAD_IN]))).toEqual([]);
  });

  it('keeps the road and the worn paths clear: nothing stands on them', () => {
    // Earth that is not a way: Mislaid's garden beds, the saw pit, and the
    // ground the shrine's pilgrims have worn bare round it.
    const garden = (x: number, y: number) => x >= 41 && x <= 45 && y >= 14 && y <= 17;
    const sawPit = (x: number, y: number) => x >= 8 && x <= 10 && y >= 40 && y <= 41;
    const shrine = (x: number, y: number) => x >= 38 && x <= 45 && y >= 22 && y <= 25;
    expect(walked.blockedOn(',d', (x, y) => garden(x, y) || sawPit(x, y) || shrine(x, y))).toEqual(
      [],
    );
  });
});
