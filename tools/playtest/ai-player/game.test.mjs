// The AI playtester's hands keep game time moving as a person's would.
import { describe, expect, it } from 'vitest';
import { RELEASE_ARMING_MS } from '../../../src/game/ui/spatialFocus';
import { HUMAN_BEAT_FRAMES, createHands } from './game.mjs';

/** Test mode's frame (`stepFrames`' default). */
const TEST_MODE_FRAME_MS = 100;

describe('createHands', () => {
  it("gives the game a person's beat before an action, longer than any double-tap guard", async () => {
    const evaluated = [];
    const hands = createHands({ evaluate: async (expression) => evaluated.push(expression) });

    await hands.beat();

    expect(evaluated).toEqual([`window.__escapeFromPalletTownGame__.stepFrames(${HUMAN_BEAT_FRAMES})`]);
    // A press after the beat is never read as the second half of the press
    // before it: the overnight playtest's "first press on USE POTION ON does
    // nothing" was the AI pressing 300ms of game time after choosing the Potion.
    expect(HUMAN_BEAT_FRAMES * TEST_MODE_FRAME_MS).toBeGreaterThan(RELEASE_ARMING_MS);
  });
});
