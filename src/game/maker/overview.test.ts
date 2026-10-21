import { describe, expect, it } from 'vitest';
import { overviewLeavesRoom } from './overview';

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
