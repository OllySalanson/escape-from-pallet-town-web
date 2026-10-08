import { afterEach, describe, expect, it } from 'vitest';
import sampleLane from '../../maps/sample/sample-lane.json';
import {
  isPlaytestRun,
  setActiveSaveSlot,
  setTryItRules,
  TRY_IT_SAVE_KEY,
} from '../dev/playtestMode';
import { createPlaytestGame } from '../dev/playtestSave';
import { SaveManager } from '../save/SaveManager';
import { getWorldMap } from '../worldMap';
import type { MapFile } from '../world/mapFile';
import { checkMapFile } from '../world/mapFileChecks';
import { registerPlayerMap, unregisterPlayerMap } from '../world/playerMaps';
import { blankMap } from './draft';
import { makerScreen, walkedCheck, type MakerViewState } from './makerView';
import { reasonFor } from './submissions';
import { beginTry, currentTry, endTry, homeAfterRaid, TRY_IT_MAP_ID } from './tryIt';

const SAMPLE = sampleLane as MapFile;

function state(file: MapFile, walked: boolean): MakerViewState {
  return {
    file,
    tool: 'brush',
    brushId: 'grass',
    place: { kind: 'drop-in' },
    selected: undefined,
    zoom: 16,
    checks: [...checkMapFile(file), walkedCheck(walked)],
    canUndo: false,
    canRedo: true,
    drafts: [],
    draftKey: 'draft-a',
    panel: 'map',
    sending: { step: 'checking' },
    sent: { step: 'loading' },
    review: { step: 'checking' },
    reviewing: undefined,
  };
}

const tryButtons = (markup: string): string[] =>
  [...markup.matchAll(/<button[^>]*data-try="(walk|raid)"[^>]*>/g)].map((match) => match[0]);

describe('the map maker screen', () => {
  it('lets a map be tried only once it works, and says so on the button', () => {
    const unfinished = makerScreen(state(blankMap(), false));
    expect(tryButtons(unfinished)).toHaveLength(2);
    for (const button of tryButtons(unfinished)) {
      expect(button).toContain('aria-disabled="true"');
      expect(button).toContain('pass the checks above first');
    }
    const works = makerScreen(state(SAMPLE, false));
    for (const button of tryButtons(works)) {
      expect(button).not.toContain('aria-disabled');
    }
    expect(works).toContain('WORKS · TRY IT');
    // A finished map's checks fold to one line.
    expect(makerScreen(state(SAMPLE, true))).toContain('Every check passes.');
    expect(makerScreen(state(SAMPLE, true))).toContain('READY');
  });

  it('lists every check with the walk last, and says what to do about each that fails', () => {
    const markup = makerScreen(state(blankMap(), false));
    expect([...markup.matchAll(/data-check="([a-z-]+)"/g)].map((match) => match[1])).toEqual([
      'loads',
      'standing',
      'apart',
      'way-out',
      'reachable',
      'hunter-room',
      'watch',
      'words',
      'walked',
    ]);
    expect(markup).toContain("The map needs its maker's name.");
    expect(markup).toContain('0 of 9');
  });

  it('says a draft it cannot open is kept rather than letting it vanish', () => {
    const drafts = { ...state(SAMPLE, false), panel: 'drafts' as const };
    expect(makerScreen(drafts)).not.toContain('cannot be opened');
    expect(makerScreen({ ...drafts, unreadableDrafts: 1 })).toContain(
      'One draft here cannot be opened. It is kept, not deleted.',
    );
  });

  it('greys out undo when there is nothing to undo', () => {
    const markup = makerScreen(state(blankMap(), false));
    expect(markup).toMatch(/data-undo[^>]*aria-disabled="true"/);
    expect(markup).not.toMatch(/data-redo[^>]*aria-disabled/);
  });

  it('never lets a map name write markup into the screen', () => {
    const markup = makerScreen(state({ ...blankMap(), name: '<b>x</b>' }, false));
    expect(markup).not.toContain('<b>x</b>');
  });
});

describe('TRY IT', () => {
  afterEach(() => {
    endTry();
    setActiveSaveSlot('normal');
    setTryItRules(false);
    unregisterPlayerMap(`player-${TRY_IT_MAP_ID}`);
  });

  it('plays the draft as a map under an id of its own, whatever the draft is called', () => {
    const attempt = beginTry('draft-a', SAMPLE, 'walk');
    registerPlayerMap(attempt.map);
    expect(attempt.map.id).toBe('player-try-it');
    expect(getWorldMap(attempt.map.id).width).toBe(SAMPLE.width);
  });

  it('keeps a try in a save of its own, and walks it under the explorer rules only when asked', () => {
    beginTry('draft-a', SAMPLE, 'walk');
    setActiveSaveSlot('try-it');
    expect(currentTry()?.draftKey).toBe('draft-a');
    setTryItRules(true);
    expect(isPlaytestRun()).toBe(true);
    setTryItRules(false);
    expect(isPlaytestRun()).toBe(false);

    // Whatever the try writes goes under its own key, never the game's or the explorer run's.
    const held = new Map<string, string>();
    const storage = {
      getItem: (key: string) => held.get(key) ?? null,
      setItem: (key: string, value: string) => void held.set(key, value),
      removeItem: (key: string) => void held.delete(key),
    };
    new SaveManager(storage).save(createPlaytestGame());
    expect([...held.keys()]).toEqual([TRY_IT_SAVE_KEY]);
  });

  it('sends a raid that ends back to the map maker during a try, and to the base otherwise', () => {
    expect(homeAfterRaid()).toEqual({ key: 'base', data: { arrival: 'raid' } });
    beginTry('draft-a', SAMPLE, 'raid');
    // A try only counts while its save is the one in play.
    expect(homeAfterRaid().key).toBe('base');
    setActiveSaveSlot('try-it');
    expect(homeAfterRaid()).toEqual({ key: 'mapmaker', data: { tried: true } });
  });
});

describe('sending a map in', () => {
  const ready = (sending: MakerViewState['sending']): string =>
    makerScreen({ ...state(SAMPLE, true), panel: 'send', sending });

  it('can only be sent once every check passes, the walk included', () => {
    expect(makerScreen(state(SAMPLE, false))).toMatch(/data-send[^-][^>]*aria-disabled="true"/);
    expect(makerScreen(state(SAMPLE, true))).not.toMatch(/data-send[^-][^>]*aria-disabled/);
  });

  it('says who it goes to and what travels with it, and asks for the bot check only when one is needed', () => {
    const markup = ready({ step: 'ready', needsCheck: true });
    expect(markup).toContain('Every map sent in is played before it can join the game.');
    expect(markup).toContain('Nothing else about you is sent.');
    expect(markup).toContain('data-captcha');
    expect(ready({ step: 'ready', needsCheck: false })).not.toContain('data-captcha');
  });

  it('never sends a map still waiting twice, and sends a map sent back as its next try', () => {
    const waiting = ready({
      step: 'ready',
      needsCheck: false,
      previous: { receipt: 'ABCDEFGHJK', status: 'waiting' },
    });
    expect(waiting).toContain('waiting to be played');
    expect(waiting).not.toContain('data-send-confirm');
    const back = ready({
      step: 'ready',
      needsCheck: false,
      previous: { receipt: 'ABCDEFGHJK', status: 'sent_back' },
    });
    expect(back).toContain('Send again');
  });

  it('hands over the receipt, and says what went wrong in words', () => {
    expect(ready({ step: 'sent', receipt: 'ABCDEFGHJK' })).toContain(
      'Your receipt is <strong>ABCDEFGHJK</strong>',
    );
    expect(reasonFor({ message: 'Anonymous sign-ins are disabled' })).toMatch(
      /not switched on yet/,
    );
    expect(reasonFor({ message: 'You can send three maps a day. Try again tomorrow.' })).toBe(
      'You can send three maps a day. Try again tomorrow.',
    );
    expect(reasonFor({ message: 'TypeError: Failed to fetch' })).toMatch(/Check your connection/);
  });

  it("lists what became of each map sent, with the reviewer's note", () => {
    const markup = makerScreen({
      ...state(SAMPLE, true),
      panel: 'sent',
      sent: {
        step: 'loaded',
        maps: [
          {
            receiptCode: 'ABCDEFGHJK',
            mapName: 'Sample Lane',
            status: 'sent_back',
            note: 'Move the exit off the road.',
            revision: 2,
            sentAt: '',
            updatedAt: '',
          },
        ],
      },
    });
    expect(markup).toContain('Sent back with notes · try 2 · ABCDEFGHJK');
    expect(markup).toContain('Move the exit off the road.');
  });
});
