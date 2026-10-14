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
import { CHECK_FIRST_NOTE, draftEdited, makerScreen, walkedCheck, type MakerViewState } from './makerView';
import { reasonFor, signInReason, type SentMap } from './submissions';
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
    overview: true,
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
  it('names every kind of thing SELECT and REMOVE work on, as the Places list names it', () => {
    const markup = makerScreen(state(SAMPLE, false));
    const places = [
      ...markup.matchAll(
        /data-place="[^"]+"[^>]*>(?:<[^>]*>)*?<span class="px-row-main">([^<]+)</g,
      ),
    ]
      .filter((match) => !match[0].includes('data-building'))
      .map((match) => match[1].toLowerCase());
    expect(places).toEqual(
      expect.arrayContaining([
        'sign',
        'person',
        'pokémon',
        'trainer',
        'landmark',
        'district',
        'cut tree',
        'rock smash rock',
        'surf water',
      ]),
    );
    for (const tool of ['select', 'erase']) {
      const help =
        new RegExp(`data-tool="${tool}"[^>]*data-help="([^"]+)"`).exec(markup)?.[1] ?? '';
      for (const kind of [...places, 'building']) {
        expect(help, `${tool} help names ${kind}`).toContain(kind);
      }
    }
  });

  it('never names two rows of the paint pane alike, and says a planted sign cannot be read (playtest 39 B5)', () => {
    const markup = makerScreen(state(SAMPLE, false));
    const rows = [
      ...markup.matchAll(/data-place="[^"]+"[^>]*>(?:<[^>]*>)*?<span class="px-row-main">([^<]+)</g),
    ].map((match) => match[1].toLowerCase());
    const repeated = rows.filter((label, index) => rows.indexOf(label) !== index);
    expect(repeated).toEqual([]);
    const planted = /data-building="sign"[^>]*data-help="([^"]+)"/.exec(markup)?.[1] ?? '';
    expect(planted).toContain('only a picture');
    expect(planted).toContain('Sign under Places');
  });

  it('names only buttons that exist, and never asks for the walk before the walk (playtest 39 A3)', () => {
    const unfinished = makerScreen(state(blankMap(), false));
    const said = [...unfinished.matchAll(/data-help="([^"]*)"|<small[^>]*>([^<]*)<\/small>|<span>([^<]*)<\/span>|<strong[^>]*>([^<]*)<\/strong>/g)]
      .map((match) => match.slice(1).find(Boolean) ?? '')
      .join('\n');
    // There is no TRY IT button: the two that try a map are WALK IT and RAID IT.
    expect(said).not.toMatch(/TRY IT/i);
    expect(walkedCheck(false).label).not.toMatch(/TRY IT/i);
    expect(walkedCheck(false).problems.join(' ')).toMatch(/WALK IT or RAID IT/);
    // A greyed try button may not send the maker to "the checks above", which
    // include the walk it is the only way to pass.
    for (const button of tryButtons(unfinished)) {
      expect(button).not.toContain('pass the checks above first');
      expect(button).toMatch(/other checks/);
    }
    expect(walkedCheck(false).problems.join(' ')).toMatch(/every other check/);
  });

  it('lets a map be tried only once it works, and says so on the button', () => {
    const unfinished = makerScreen(state(blankMap(), false));
    expect(tryButtons(unfinished)).toHaveLength(2);
    for (const button of tryButtons(unfinished)) {
      expect(button).toContain('aria-disabled="true"');
      expect(button).toContain('Fix the other checks first');
    }
    const works = makerScreen(state(SAMPLE, false));
    for (const button of tryButtons(works)) {
      expect(button).not.toContain('aria-disabled');
    }
    expect(works).toContain('WORKS · WALK IT');
    // A finished map's checks fold to one line.
    expect(makerScreen(state(SAMPLE, true))).toContain('Every check passes.');
    expect(makerScreen(state(SAMPLE, true))).toContain('READY');
  });

  it('asks the level a try is played at, starting on the one that suits the map', () => {
    const markup = makerScreen({
      ...state(SAMPLE, false),
      tryLevel: 6,
      tryLevels: [5, 6, 10, 100],
      suitedTryLevel: 6,
    });
    const choice = /<select[^>]*data-try-level[^>]*>(.*?)<\/select>/.exec(markup)?.[1] ?? '';
    expect([...choice.matchAll(/<option value="(\d+)"/g)].map((match) => Number(match[1]))).toEqual([5, 6, 10, 100]);
    expect(choice).toContain('<option value="6" selected>Lv 6 · suits it</option>');
    // It stands before the two ways to try, which it is the level of.
    expect(markup.indexOf('data-try-level')).toBeLessThan(markup.indexOf('data-try="walk"'));
    const chosen = makerScreen({ ...state(SAMPLE, false), tryLevel: 100, tryLevels: [5, 6, 100], suitedTryLevel: 6 });
    expect(chosen).toContain('<option value="100" selected>Lv 100</option>');
  });

  it('scrolls its side column as a pane, so a panel below the checks says MORE', () => {
    // Playtest 45: the chosen thing's panel sat under the checks with only its
    // heading showing, and nothing said there was more of the column.
    const markup = makerScreen(state(blankMap(), false));
    expect(markup).toMatch(/<div class="maker-side px-scroll">/);
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
    expect(markup).toContain('Type your name in Drawn by, under The map.');
    expect(markup).toContain('0 of 9');
  });

  it('says a draft it cannot open is kept rather than letting it vanish', () => {
    const drafts = { ...state(SAMPLE, false), panel: 'drafts' as const };
    expect(makerScreen(drafts)).not.toContain('cannot be opened');
    expect(makerScreen({ ...drafts, unreadableDrafts: 1 })).toContain(
      'One draft here cannot be opened. It is kept, not deleted.',
    );
  });

  it('tells two drafts of the same name and size apart by when each was last changed', () => {
    // Playtest 46: a downloaded map opened again is a second draft with the
    // same name and size, and the list had nothing else to say about either.
    const now = new Date(2026, 9, 14, 21, 30).getTime();
    const drafts = [
      { key: 'draft-a', file: SAMPLE, updatedAt: new Date(2026, 9, 12, 9, 15).getTime() },
      { key: 'draft-b', file: SAMPLE, updatedAt: now - 5 * 60_000 },
    ];
    const markup = makerScreen({ ...state(SAMPLE, false), panel: 'drafts', drafts, now });
    const notes = [...markup.matchAll(/data-open-draft="[^"]+"[^>]*>.*?<small class="px-note">([^<]*)<\/small>/g)].map(
      (match) => match[1],
    );
    const size = `${SAMPLE.width}x${SAMPLE.height}`;
    expect(notes).toEqual([`${size} · edited 12 Oct`, `${size} · edited 5 min ago`]);
  });

  it('says a draft was last changed today, yesterday or long ago in the words a person would', () => {
    const now = new Date(2026, 9, 14, 21, 30).getTime();
    expect(draftEdited(now - 20_000, now)).toBe('edited just now');
    expect(draftEdited(new Date(2026, 9, 14, 8, 5).getTime(), now)).toBe('edited today 08:05');
    expect(draftEdited(new Date(2026, 9, 13, 23, 59).getTime(), now)).toBe('edited yesterday 23:59');
    expect(draftEdited(new Date(2025, 11, 31, 12, 0).getTime(), now)).toBe('edited 31 Dec 2025');
    // A draft stored before its time was kept says nothing rather than 1970.
    expect(draftEdited(0, now)).toBeUndefined();
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

  it('says who it goes to and what travels with it, and warns of the bot check only before a first send', () => {
    const markup = ready({ step: 'ready', checksFirst: true });
    expect(markup).toContain('Every map sent in is played before it can join the game.');
    expect(markup).toContain('Nothing else about you is sent.');
    expect(markup).toContain(CHECK_FIRST_NOTE);
    expect(ready({ step: 'ready', checksFirst: false })).not.toContain(CHECK_FIRST_NOTE);
  });

  it('never sends a map still waiting twice, and sends a map sent back as its next try', () => {
    const waiting = ready({
      step: 'ready',
      checksFirst: false,
      previous: { receipt: 'ABCDEFGHJK', status: 'waiting' },
    });
    expect(waiting).toContain('waiting to be played');
    expect(waiting).not.toContain('data-send-confirm');
    const back = ready({
      step: 'ready',
      checksFirst: false,
      previous: { receipt: 'ABCDEFGHJK', status: 'sent_back' },
    });
    expect(back).toContain('Send again');
  });

  it('sends a fix to a map in the game as its update, and holds one approved until it is in', () => {
    const update = ready({
      step: 'ready',
      checksFirst: false,
      previous: { receipt: 'ABCDEFGHJK', status: 'published' },
    });
    expect(update).toContain('This map is in the game');
    expect(update).toContain('every drop-in players have reached stays theirs');
    expect(update).toContain('Send the update');
    const approved = ready({
      step: 'ready',
      checksFirst: false,
      previous: { receipt: 'ABCDEFGHJK', status: 'approved' },
    });
    expect(approved).toContain('goes into the game soon');
    expect(approved).not.toContain('data-send-confirm');
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
    expect(reasonFor({ message: 'captcha protection: request disallowed' })).toMatch(/bot check did not pass/);
  });

  it('offers TRY AGAIN only where trying again can work (playtest 39 A8)', () => {
    const failed = (message: string): string =>
      ready({ step: 'failed', reason: reasonFor({ message }) });
    for (const message of [
      'You can send three maps a day. Try again tomorrow.',
      'The inbox is full for today. Try again tomorrow.',
      'This maker cannot send maps.',
      'Only a map sent back to you can be sent again.',
      'Anonymous sign-ins are disabled',
    ]) {
      const markup = failed(message);
      expect(markup, message).not.toContain('data-send>');
      expect(markup, message).toContain('Back to map');
      expect(markup, message).toContain('safe in your drafts');
    }
    for (const message of ['TypeError: Failed to fetch', 'captcha protection: request disallowed']) {
      expect(failed(message), message).toContain('data-send>Try again');
    }
    expect(failed('You can send three maps a day. Try again tomorrow.')).toContain(
      '<p class="px-note px-wrap">Your map is safe in your drafts.</p>',
    );
    expect(failed('TypeError: Failed to fetch').match(/safe in your drafts/g)).toHaveLength(1);
  });

  it('says plainly why a bot check stopped a map, and that the map is safe to send again', () => {
    for (const trouble of ['unavailable', 'failed', 'refused', 'busy', 'offline'] as const) {
      expect(signInReason(trouble)).toMatch(/safe in your drafts\.$/);
    }
    expect(signInReason('unavailable')).toMatch(/bot check would not load/);
    expect(signInReason('failed')).toMatch(/bot check did not pass.*Try again/);
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

  it('says how to send a map sent back again, and only under one sent back (playtest 39 A9)', () => {
    const row = (status: SentMap['status']) =>
      makerScreen({
        ...state(SAMPLE, true),
        panel: 'sent',
        sent: {
          step: 'loaded',
          maps: [
            { receiptCode: 'ABCDEFGHJK', mapName: 'Reed Ford', status, note: null, revision: 1, sentAt: '', updatedAt: '' },
          ],
        },
      });
    expect(row('sent_back')).toContain('Open this map in Drafts, fix it, walk it again, then press SEND IN.');
    for (const status of ['waiting', 'approved', 'rejected', 'published'] as const) {
      expect(row(status), status).not.toContain('then press SEND IN');
    }
    expect(row('rejected')).toContain('Turned down for good');
    expect(ready({ step: 'sent', receipt: 'ABCDEFGHJK' })).toContain(
      'To see what becomes of it, open Drafts, then Sent in.',
    );
  });
});

describe('the checks, as a list a maker works through', () => {
  /** The sample with seven berry trees stood in its trees and a person in its pond. */
  const faulty: MapFile = {
    ...SAMPLE,
    berryTrees: [
      [0, 2],
      [0, 4],
      [0, 6],
      [0, 8],
      [0, 10],
      [0, 12],
      [0, 14],
    ].map(([x, y]) => ({ x, y, berry: 'oran' as const })),
    people: [{ ...SAMPLE.people![0], x: 5, y: 9 }],
  };
  const markup = makerScreen(state(faulty, false));
  const checks = state(faulty, false).checks;
  const standing = checks.findIndex((check) => check.id === 'standing');

  it('makes every fault that names a tile a button that goes there', () => {
    const buttons = [...markup.matchAll(/<button[^>]*data-goto="(\d+):(\d+)"[^>]*>/g)];
    const named = checks.flatMap((check, checkIndex) =>
      check.faults.flatMap((fault, faultIndex) =>
        fault.places.length > 0 ? [`${checkIndex}:${faultIndex}`] : [],
      ),
    );
    for (const key of named) {
      expect(buttons.some((button) => `${button[1]}:${button[2]}` === key), key).toBe(true);
    }
  });

  it('reads a run of one kind as one line with a count, and a chip for each tile', () => {
    const group = /<div class="maker-fault-group">(.*?)<\/div>/.exec(markup)?.[1] ?? '';
    expect(group).toContain('7 berry trees stand in the trees');
    expect(group).toContain(`data-goto-group="${standing}:berry trees"`);
    const chips = [...group.matchAll(/<button class="px-window px-chip maker-fault-tile"[^>]*>([^<]*)<\/button>/g)];
    expect(chips.map((chip) => chip[1])).toEqual(['0,2', '0,4', '0,6', '0,8', '0,10', '0,12', '0,14']);
    // Each chip says the whole fault when pointed at.
    expect(group).toContain('data-help="Oran Berry tree at 0,8 stands in the trees."');
  });

  it('says a fault of its own kind in full, as its own button', () => {
    expect(markup).toMatch(
      /<button class="px-row maker-fault" data-goto="\d+:\d+" data-help="Takes you to 5,9\.">.*Old Tam at 5,9 stands in deep water\./,
    );
  });

  it('only says a fault about the whole map, with nothing to press', () => {
    const walked = checks.length - 1;
    expect(markup).not.toContain(`data-goto="${walked}:0"`);
    expect(markup).toContain(
      '<small class="maker-fault-text px-wrap">Once every other check passes, press WALK IT or RAID IT and leave by an exit.</small>',
    );
  });

  it('names an inside as well as a tile', () => {
    const view = makerScreen({
      ...state(faulty, false),
      checks: [
        {
          id: 'standing',
          label: 'Everything stands on ground you can walk on',
          passed: false,
          problems: ['x'],
          faults: [
            { text: 'x', group: 'item spots', places: [{ x: 1, y: 2, area: 'hall' }] },
            { text: 'y', group: 'item spots', places: [{ x: 3, y: 4, area: 'hall' }] },
          ],
        },
      ],
      file: {
        ...faulty,
        areas: [
          { id: 'hall', name: 'Hall', kind: 'inside', style: 'house', width: 8, height: 8, ground: [], buildings: [] },
        ],
      },
    });
    expect(view).toContain('>1,2 in Hall</button>');
    // They do not say the same of themselves, so their heading is a count.
    expect(view).toContain('>2 item spots</span></button>');
  });
});
