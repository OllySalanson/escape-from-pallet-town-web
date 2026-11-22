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

/**
 * A harbour with one person in it who says two lines, driven through a fake
 * page: just enough of `describe()`, `eventLog()` and the keys for `talk` to
 * play against.
 */
function fakeHarbour() {
  const lines = ['Hello there.', 'Come back soon.'];
  const state = { line: -1, conversations: 0, events: [], space: false };
  const describe = () => ({
    scenes: ['base'],
    busy: null,
    menu: null,
    lastEvent: state.events.length,
    scene: {
      base: {
        facing: 'up',
        walking: false,
        choice: null,
        dialogue: state.line >= 0 ? { text: lines[state.line], complete: true } : null,
      },
    },
  });
  const pressSpace = () => {
    if (state.line < 0) {
      state.conversations += 1;
      state.line = 0;
    } else {
      state.line = state.line + 1 < lines.length ? state.line + 1 : -1;
    }
    if (state.line >= 0) state.events.push({ n: state.events.length + 1, kind: 'talked', text: lines[state.line] });
  };
  const page = {
    evaluate: async (expression) => {
      if (expression.endsWith('.describe()')) return describe();
      const since = expression.match(/\.eventLog\((\d+)\)$/);
      if (since) return state.events.filter((event) => event.n > Number(since[1]));
      if (expression.includes('.stepFrames(')) {
        if (state.space) pressSpace();
        state.space = false;
        return undefined;
      }
      throw new Error(`unexpected expression ${expression}`);
    },
    keyDown: async (code) => {
      if (code === 'Space') state.space = true;
    },
    keyUp: async () => {},
  };
  return { page, state };
}

describe('the AI player talking to somebody', () => {
  it('starts the conversation once, though talking changes no scene', async () => {
    // The veteran run (20 Nov 2026) reported Oak's briefing, the chart table
    // and the Gull Strand signs as each said twice: `talk` retried whenever the
    // scene list had not changed, which is always true of a conversation.
    const { page, state } = fakeHarbour();

    const result = await createHands(page).talk();

    expect(result.ok).toBe(true);
    expect(state.conversations).toBe(1);
  });
});
