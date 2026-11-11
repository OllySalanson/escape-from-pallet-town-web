import { describe, expect, it } from 'vitest';
import { gateKey, gatesForMap } from '../../../../src/game/world/gates';
import { pineHollow } from './pineHollow';
import { bareDistrict, valeSolid, walkDistrict } from './walkedTwoAbreast.testkit';

/**
 * The captain, 11 Nov 2026, of the filled vale: "when you're walking around,
 * there's just often things in your way, and it's quite fiddly to get through
 * places". Millbrook, THE HARBOUR and TANGLEWOOD were fixed first; PINE HOLLOW
 * is the fourth area, held to Tanglewood's rule (`tanglewood.test.ts`): a walker
 * two tiles wide - which is what a lane on the conifer lattice is - gets from
 * the trail in over the col to every way out, door, landmark, berry tree,
 * person, trainer and find, to within the one last step a porch is, with every
 * figure on every tile of its beat; no way out or door is further than the same
 * lanes walked bare; and nothing stands on the trail or the worn ground. Against
 * the wood before it was made walkable this names nearly everything in it,
 * because the chesto tree stood on the trail where it climbs from the col: and
 * after that, a stump across the mouth of the charcoal nook, the tappers' cut
 * wood and the Amber Hunter across the hollow's floor, a stump across the deer
 * path, the bee wood's nest at the foot of its lane, and a Pikachu in the way
 * into its glade.
 */
describe('PINE HOLLOW, walked two abreast', () => {
  const { file } = pineHollow();
  // Pine Hollow is the plan's cell [2, 0].
  const ORIGIN = { x: 192, y: 64 };
  // The trail in over the col from Greystone Peaks, its first tile inside the wood.
  const COL_IN = { x: 0, y: 22 };
  const opened = gatesForMap('greystone-vale').map(gateKey);
  const walked = walkDistrict(file, valeSolid(ORIGIN, opened), [COL_IN]);

  it('comes in over the col with room to walk two abreast', () => {
    expect(walked.twoAbreast(COL_IN.x, COL_IN.y)).toBe(0);
  });

  it('reaches every way out, door, landmark, berry tree, person, trainer and find two abreast', () => {
    const snagged = walked
      .places()
      .filter((place) => place.steps < 0)
      .map((place) => `${place.name} (${place.x},${place.y})`);
    expect(snagged).toEqual([]);
  });

  it('never makes a pair walk further to a way out or a door than the same lanes with nothing in them', () => {
    const bare = bareDistrict(file);
    expect(walked.longerTwoAbreast(walkDistrict(bare.file, bare.solid, [COL_IN]))).toEqual([]);
  });

  it('keeps the trail and the worn ground clear: nothing stands on them', () => {
    // Earth that is not a way: the floor the tappers have worn bare round the weeping pine.
    const weepingPine = (x: number, y: number) => x >= 35 && x <= 38 && y >= 31 && y <= 34;
    expect(walked.blockedOn(',d', weepingPine)).toEqual([]);
  });
});
