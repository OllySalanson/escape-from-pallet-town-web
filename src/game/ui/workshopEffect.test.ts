import { describe, expect, it } from 'vitest';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { workshopEffectPicture } from './workshopEffect';

describe("what each of Brock's builds does in a raid, as a picture", () => {
  it('has a picture for every build on the ladder', () => {
    expect(WORKSHOP_UPGRADES.filter((upgrade) => workshopEffectPicture(upgrade.id) === '').map((upgrade) => upgrade.id)).toEqual([]);
  });

  it("draws the radio mast as the hunter chip the HUD prints with it up, in the HUD's own words", () => {
    expect(workshopEffectPicture('radio-mast')).toContain('LV9 x3 IN 1:20');
  });

  it('draws a locker as the squares it adds, the new ones marked', () => {
    const picture = workshopEffectPicture('secure-locker-1');
    expect(picture.match(/<i class="is-new"><\/i>/g)).toHaveLength(2);
  });
});
