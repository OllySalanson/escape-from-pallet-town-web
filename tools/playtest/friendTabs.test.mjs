// `readOnRaid` reads past the raid's lines so a driver can walk. friendHunter.mjs
// calls it on every step towards the hunter, and once the hunter caught the
// player it went on pressing Space into the fight: FIGHT, then a move, and the
// hunter was beaten before the driver ever reached FLEE, so the one check of
// what the room's hunter does after an escape always failed.
//
// The tab here is a stand-in that answers the driver's `raid` question the way
// the real page does: a line of dialogue in the world, then the fight.
import { describe, expect, it } from 'vitest';
import { readOnRaid } from './friendTabs.mjs';

function caughtTab() {
  // The catch's one line in the world, and then the battle scene.
  const state = { live: true, dialog: true, battle: false };
  const pressed = [];
  const tab = { evaluate: async () => ({ ...state }) };
  const press = async (_tab, key) => {
    pressed.push(key);
    if (state.battle) return;
    // The line is read; the fight begins and the world sleeps under it.
    Object.assign(state, { live: false, dialog: false, battle: true });
  };
  return { tab, press, pressed };
}

describe('readOnRaid', () => {
  it('reads the line that starts a fight and presses nothing in the fight', async () => {
    const { tab, press, pressed } = caughtTab();
    await readOnRaid(tab, press);
    expect(pressed).toEqual(['Space']);
  });

  it('reads every line the world puts up until the player can walk', async () => {
    const state = { live: true, dialog: true, battle: false };
    let lines = 3;
    const pressed = [];
    await readOnRaid({ evaluate: async () => ({ ...state }) }, async (_tab, key) => {
      pressed.push(key);
      lines -= 1;
      state.dialog = lines > 0;
    });
    expect(pressed).toEqual(['Space', 'Space', 'Space']);
  });
});
