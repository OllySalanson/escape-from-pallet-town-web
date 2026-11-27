import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {}, Scenes: { Events: {} } } }));
vi.mock('../audio/AudioManager', () => ({ audioManager: { play: vi.fn(), isMuted: false, toggleMute: vi.fn() } }));

const { helpBody, settingsBody } = await import('./ControlsScene');
const { KEY_GUIDE } = await import('../input/keyGuide');
const { RAID_KEY_LETTERS, POKEDEX_KEY, MUTE_KEY, FEEDBACK_KEY } = await import('../input/keyBindings');

describe('HELP', () => {
  it('is one pane that is read on with the arrows where a window is too short for every card', () => {
    // 800x600: four cards cut through their rows, the last keys of each out of reach.
    const body = helpBody();
    expect(body).toMatch(/^<main class="px-body cs-help-layout"><div class="px-scroll cs-help" data-reads>/);
    expect(body.match(/class="px-window cs-group"/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('shows every key the game answers, a card for each place it works', () => {
    const body = helpBody();
    for (const group of KEY_GUIDE) {
      expect(body).toContain(group.title);
      for (const key of group.keys) {
        expect(body).toContain(key.does);
      }
    }
  });

  it('teaches the keys the game binds, read from the tables it binds them from', () => {
    const keys = KEY_GUIDE.flatMap((group) => group.keys.map((key) => key.keys));
    for (const letter of [...Object.values(RAID_KEY_LETTERS), POKEDEX_KEY, MUTE_KEY, FEEDBACK_KEY]) {
      expect(keys).toContain(letter);
    }
  });
});

describe('SETTINGS', () => {
  it('says what each setting is set to now', () => {
    expect(settingsBody({ soundOn: true, fullScreen: false, fullScreenOffered: true, mapTooltips: true })).toMatch(/Sound<\/span><span class="cs-switch is-on">ON/);
    expect(settingsBody({ soundOn: false, fullScreen: false, fullScreenOffered: true, mapTooltips: true })).toMatch(/cs-switch is-off">OFF/);
  });

  it('offers full screen only where the browser allows it', () => {
    expect(settingsBody({ soundOn: true, fullScreen: false, fullScreenOffered: false, mapTooltips: true })).not.toContain('data-full-screen');
  });

  it('says whether the map tooltips are on, and offers to turn them off', () => {
    expect(settingsBody({ soundOn: true, fullScreen: false, fullScreenOffered: true, mapTooltips: true })).toMatch(/Map tooltips<\/span><span class="cs-switch is-on">ON/);
    expect(settingsBody({ soundOn: true, fullScreen: false, fullScreenOffered: true, mapTooltips: false })).toMatch(/Map tooltips<\/span><span class="cs-switch is-off">OFF/);
  });
});
