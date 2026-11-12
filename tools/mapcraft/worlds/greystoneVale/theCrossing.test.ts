import { describe, expect, it } from 'vitest';
import { gateKey, gatesForMap } from '../../../../src/game/world/gates';
import { theCrossing } from './theCrossing';
import { bareDistrict, valeSolid, walkDistrict } from './walkedTwoAbreast.testkit';

/**
 * The captain, 11 Nov 2026, of the filled vale: "when you're walking around,
 * there's just often things in your way, and it's quite fiddly to get through
 * places". Millbrook, THE HARBOUR, TANGLEWOOD and PINE HOLLOW were fixed first;
 * THE CROSSING is the fifth area, held to the same rule (`tanglewood.test.ts`):
 * a walker two tiles wide - which is what a road is - gets from the road in
 * from Millbrook to every way out, door, sign, landmark, berry tree, person,
 * trainer and find, to within the one last step a porch is, with every figure
 * on every tile of its beat; no way out or door is further than the same ground
 * walked bare; and nothing stands on a road. Against the valley before it was
 * made walkable this names half of it, because Bridge End's fountain, the Toll
 * Keeper, Pip's Aunt, the Lad, two Pidgey and a Meowth stood across the street
 * at the east end of the bridge, so a pair could not get over the river at all:
 * and after that, a big stump, a log and a sign across the road south to Gull
 * Strand, the stone yard's find behind its rocks, the masons' shed on the road
 * down from the peaks, the drovers' rest opening onto a tree, the bee garden's
 * one-tile aisles and the burners' logs on the bend.
 */
describe('THE CROSSING, walked two abreast', () => {
  const { file } = theCrossing();
  // The Crossing is the plan's cell [1, 1].
  const ORIGIN = { x: 128, y: 128 };
  // The road in from Millbrook, its first tile inside the valley.
  const ROAD_IN = { x: 0, y: 31 };
  // The landing at the foot of the valley.
  const STEPPING_STONES = { x: 40, y: 56 };
  const opened = gatesForMap('greystone-vale').map(gateKey);
  const walked = walkDistrict(file, valeSolid(ORIGIN, opened), [ROAD_IN]);

  it('comes in off Millbrook’s road, and lands at the Stepping Stones, with room to walk two abreast', () => {
    expect(walked.twoAbreast(ROAD_IN.x, ROAD_IN.y)).toBe(0);
    expect(walked.twoAbreast(STEPPING_STONES.x, STEPPING_STONES.y)).toBeGreaterThan(0);
  });

  it('reaches every way out, door, sign, landmark, berry tree, person, trainer and find two abreast', () => {
    const snagged = walked
      .places()
      .filter((place) => place.steps < 0)
      .map((place) => `${place.name} (${place.x},${place.y})`);
    expect(snagged).toEqual([]);
  });

  it('never makes a pair walk further to a way out or a door than the same ground with nothing in it', () => {
    const bare = bareDistrict(file);
    expect(walked.longerTwoAbreast(walkDistrict(bare.file, bare.solid, [ROAD_IN]))).toEqual([]);
  });

  it('keeps the roads clear: nothing stands on them', () => {
    expect(walked.blockedOn(',d')).toEqual([]);
  });

  it('keeps Bridge End’s crossing clear: off the bridge and straight over the square to the Tanglewood road', () => {
    // The bridge is rows 30-32; the square runs on to x 50, where the road east begins.
    const inTheWay: string[] = [];
    for (let y = 30; y <= 32; y += 1) {
      for (let x = 23; x <= 50; x += 1) if (!walked.free(x, y)) inTheWay.push(`${x},${y}`);
    }
    expect(inTheWay).toEqual([]);
  });
});
