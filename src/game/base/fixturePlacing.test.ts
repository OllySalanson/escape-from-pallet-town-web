import { describe, expect, it } from 'vitest';
import { getBaseMapWithEveryPlace } from './baseMap';
import { BASE_FIXTURES, fixtureAt } from './fixtures';
import { placedAt, placedLine, placingCaption, placingHint, standToSee, startPlacing, stepPlacing } from './fixturePlacing';

describe('placing one of Brock\'s builds', () => {
  it('starts a new build in its first place, and a move where it stands', () => {
    expect(startPlacing({ upgradeId: 'radio-mast', mode: 'build' }, { 'radio-mast': 2 })?.index).toBe(0);
    expect(startPlacing({ upgradeId: 'radio-mast', mode: 'move' }, { 'radio-mast': 2 })?.index).toBe(2);
    expect(startPlacing({ upgradeId: 'nothing', mode: 'build' })).toBeNull();
  });

  it('steps round every place both ways, wrapping at the ends', () => {
    const start = startPlacing({ upgradeId: 'radio-mast', mode: 'build' })!;
    const count = start.fixture.places.length;
    expect(stepPlacing(start, -1).index).toBe(count - 1);
    let walked = start;
    for (let step = 0; step < count; step += 1) walked = stepPlacing(walked, 1);
    expect(walked.index).toBe(0);
  });

  it('shows the build where it would stand, and says where in the hint and the line after', () => {
    const mast = stepPlacing(startPlacing({ upgradeId: 'radio-mast', mode: 'move' })!, 1);
    expect(placedAt(mast)).toEqual(fixtureAt(mast.fixture, 1));
    expect(placingCaption(mast)).toBe(`THE MAST\n${mast.fixture.places[1].name}  2 OF ${mast.fixture.places.length}`);
    expect(placingHint(mast)).toBe('[ARROWS] PLACE   [ENTER] PUT IT   [ESC] BACK');
    expect(placingHint({ ...mast, mode: 'build' })).toBe('[ARROWS] PLACE   [ENTER] BUILD IT   [ESC] BACK');
    expect(placedLine(mast)).toBe(`THE MAST stands ${mast.fixture.places[1].name} now.`);
  });

  it('has somewhere to stand in front of every build in every place', () => {
    const map = getBaseMapWithEveryPlace();
    const open = ({ x, y }: { x: number; y: number }) => map.collision[y]?.[x] === false;
    const nowhere = BASE_FIXTURES.flatMap((fixture) =>
      fixture.places.flatMap((place, index) => (standToSee(fixtureAt(fixture, index), open) ? [] : [`${fixture.upgradeId} ${place.name}`])),
    );
    expect(nowhere).toEqual([]);
  });
});
