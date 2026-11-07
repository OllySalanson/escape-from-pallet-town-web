import { describe, expect, it } from 'vitest';
import { mapNeedsOverview, overviewLeavesRoom } from './overview';

describe("the overview in the map window's corner", () => {
  // Measured in the maker at 800x600: the overview's frame was 170x125 screen
  // pixels in a map window 165 across, so it covered all of it and spilled out
  // over the paint tools. At 1024x700 the window is 392x340 and it fits.
  it('stands aside when it would cover more than half the map window', () => {
    expect(overviewLeavesRoom({ width: 170, height: 125 }, { width: 165, height: 220 })).toBe(false);
    expect(overviewLeavesRoom({ width: 170, height: 125 }, { width: 400, height: 200 })).toBe(false);
  });

  it('is shown in a window with room for it', () => {
    expect(overviewLeavesRoom({ width: 170, height: 125 }, { width: 392, height: 340 })).toBe(true);
    expect(overviewLeavesRoom({ width: 170, height: 125 }, { width: 340, height: 250 })).toBe(true);
  });
});

describe('when the overview is wanted (playtest 50)', () => {
  it('stays away from a map only a few pixels too big for its window', () => {
    expect(mapNeedsOverview({ width: 640, height: 486 }, { width: 640, height: 480 })).toBe(false);
    expect(mapNeedsOverview({ width: 600, height: 400 }, { width: 640, height: 480 })).toBe(false);
  });

  it('comes up for a map well past its window either way', () => {
    expect(mapNeedsOverview({ width: 1280, height: 480 }, { width: 640, height: 480 })).toBe(true);
    expect(mapNeedsOverview({ width: 640, height: 700 }, { width: 640, height: 480 })).toBe(true);
  });
});
