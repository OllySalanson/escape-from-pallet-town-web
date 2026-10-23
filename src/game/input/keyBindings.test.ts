import { describe, expect, it, vi } from 'vitest';

/**
 * The keys the HUDs name are the keys the scenes bind.
 *
 * A hint that names the wrong key is worse than no hint: it is the one sentence
 * a newcomer believes. So this asks the scenes themselves - their real
 * `bindControls`, against Phaser's own key-code table - which key each named
 * action is bound to, and reads every letter the yard and the raid chip print
 * back against it.
 */

vi.mock('phaser', async () => {
  const { default: KeyCodes } = await vi.importActual<{ default: Record<string, number> }>(
    'phaser/src/input/keyboard/keys/KeyCodes.js',
  );
  return {
    default: {
      Scene: class {},
      Math: { Vector2: class { public x = 0; public y = 0; } },
      Input: { Keyboard: { KeyCodes, JustDown: () => false } },
      Scenes: { Events: { SHUTDOWN: 'shutdown' } },
      Scale: { Events: { RESIZE: 'resize' } },
      Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
      GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
    },
  };
});

import { SaveManager, type StorageLike } from '../save/SaveManager';
import { BaseScene } from '../scenes/BaseScene';
import { objectiveChipLines } from '../scenes/raidHud';
import { WorldScene } from '../scenes/WorldScene';
import { Bag } from '../items';
import { PokemonParty } from '../pokemon';
import { createStartingStash } from '../stash';
import { lootRefusalLine } from '../world/loot';
import {
  HOME_KEY_LETTERS,
  decorateKeyHintLine,
  houseKeyHintLine,
  phraseListLines,
  roomKeyHintLine,
  yardKeyHintLine,
} from './keyBindings';
import { ROOM_PHRASES } from '../raidRoom/roomTalk';

/** Phaser's own table, not the mock's: the codes a real keyboard sends. */
const { default: KEY_CODES } = await vi.importActual<{ default: Record<string, number> }>(
  'phaser/src/input/keyboard/keys/KeyCodes.js',
);

interface BoundKey {
  readonly keyCode: number;
  on(): BoundKey;
}

const keyFor = (keyCode: number): BoundKey => ({ keyCode, on: () => keyFor(keyCode) });

/** A keyboard that hands back a key carrying the code it was bound with. */
const recordingKeyboard = () => ({
  addCapture: vi.fn(),
  on: vi.fn(),
  addKey: (code: number) => keyFor(code),
  addKeys: (names: string) =>
    Object.fromEntries(names.split(',').map((name) => [name, keyFor(KEY_CODES[name])])),
  createCursorKeys: () => ({
    up: keyFor(KEY_CODES.UP),
    down: keyFor(KEY_CODES.DOWN),
    left: keyFor(KEY_CODES.LEFT),
    right: keyFor(KEY_CODES.RIGHT),
  }),
});

function controlsOf(scene: object): Record<string, BoundKey | readonly BoundKey[]> {
  Object.assign(scene, { input: { keyboard: recordingKeyboard() }, game: { loop: { frame: 0 } } });
  (scene as unknown as { bindControls(): void }).bindControls();
  return (scene as unknown as { controls: Record<string, BoundKey | readonly BoundKey[]> }).controls;
}

/** Every `[KEY] WORD` a hint line names. */
function namedKeys(line: string): readonly (readonly [string, string])[] {
  return [...line.matchAll(/\[([A-Z]+)\] ([A-Z]+)/g)].map((match) => [match[1], match[2]] as const);
}

/** What each word on a hint promises the key does: the control it must be bound to. */
const RAID_WORD_CONTROLS: Readonly<Record<string, string>> = {
  GUIDE: 'objectives',
  LOOK: 'look',
  PACK: 'bag',
  TEAM: 'party',
};

describe('the keys a HUD names', () => {
  it('are the keys the raid binds, every one of them, for a save that has pressed none', () => {
    const controls = controlsOf(new WorldScene());
    const line = objectiveChipLines('LOST KIT: SW', false, false, new Set())[1];
    const named = namedKeys(line);

    expect(named.map(([, word]) => word)).toEqual(['GUIDE', 'LOOK', 'PACK', 'TEAM']);
    for (const [key, word] of named) {
      const control = controls[RAID_WORD_CONTROLS[word]] as BoundKey;
      expect(control.keyCode, `${word} is named as [${key}]`).toBe(KEY_CODES[key]);
    }
  });

  it('are the keys a raid room binds, and the number keys say the phrases', () => {
    const controls = controlsOf(new WorldScene());
    const named = namedKeys(roomKeyHintLine(new Set()));
    expect(named.map(([, word]) => word)).toEqual(['SAY', 'PING']);
    for (const [key, word] of named) {
      const control = controls[word === 'SAY' ? 'talk' : 'ping'] as BoundKey;
      expect(control.keyCode, `${word} is named as [${key}]`).toBe(KEY_CODES[key]);
    }
    expect((controls.phrases as readonly BoundKey[]).map((key) => key.keyCode)).toEqual(
      ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'].map((digit) => KEY_CODES[digit]),
    );
    expect(roomKeyHintLine(new Set(['talk', 'ping']))).toBe('');
  });

  it('names each phrase by its number key in brackets, so a 1 never runs into the O after it', () => {
    const controls = controlsOf(new WorldScene());
    const lines = phraseListLines(ROOM_PHRASES);
    expect(lines[0]).toBe('[1] OVER HERE!');
    const keys = (controls.phrases as readonly BoundKey[]).map((key) => key.keyCode);
    lines.forEach((line, index) => {
      const [, key, phrase] = /^\[(\d)\] (.+)$/.exec(line) ?? [];
      expect(phrase, line).toBe(ROOM_PHRASES[index]);
      expect(keys[index], `${line} is said by [${key}]`).toBe(KEY_CODES[['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'][Number(key) - 1]]);
    });
  });

  it('names B by the word a full pack tells the player to open', () => {
    // A find refused for room sends the player to the screen B opens; the hint
    // that teaches B has to call it the same thing, or "drop something from
    // the PACK" points at a key the HUD calls something else.
    const line = objectiveChipLines('LOST KIT: SW', false, false, new Set())[1];
    const word = namedKeys(line).find(([key]) => key === 'B')?.[1];
    const refusal = lootRefusalLine('potion', 1, 0);

    expect(word).toBe('PACK');
    expect(refusal).toContain(`from the ${word}`);
  });

  it('are the keys the yard binds', () => {
    const controls = controlsOf(new BaseScene());
    const named = namedKeys(yardKeyHintLine(new Set()));

    expect(named).toEqual([
      ['ARROWS', 'WALK'],
      ['L', 'LOOK'],
    ]);
    expect((controls.look as BoundKey).keyCode).toBe(KEY_CODES.L);
    for (const direction of ['up', 'down', 'left', 'right'] as const) {
      expect((controls[direction] as BoundKey).keyCode).toBe(KEY_CODES[direction.toUpperCase()]);
    }
  });
});

/** What each word the house's hints use promises the key does. */
const HOUSE_WORD_CONTROLS: Readonly<Record<string, string>> = {
  DECORATE: 'decorate',
  DONE: 'decorate',
  TURN: 'turn',
  PUT: 'putAway',
};

describe('the keys the house names', () => {
  it('are the keys the house binds, decorating and everything done while decorating', () => {
    const controls = controlsOf(new BaseScene());
    const lines = [
      houseKeyHintLine(new Set()),
      decorateKeyHintLine('holding', true),
      decorateKeyHintLine('on-a-piece', true),
      decorateKeyHintLine('on-the-floor', true),
    ];
    const named = lines.flatMap(namedKeys).filter(([key, word]) => key !== 'SPACE' && word !== 'BOX');
    expect(named.length).toBeGreaterThan(0);
    for (const [key, word] of named) {
      const control = controls[HOUSE_WORD_CONTROLS[word]] as BoundKey;
      expect(control.keyCode, `${word} is named as [${key}]`).toBe(KEY_CODES[key]);
    }
    // The box is walked with the two keys its hint names, side by side.
    const box = /\[([A-Z])\]\[([A-Z])\] BOX/.exec(decorateKeyHintLine('holding', true))!;
    expect((controls.boxBack as BoundKey).keyCode).toBe(KEY_CODES[box[1]]);
    expect((controls.boxNext as BoundKey).keyCode).toBe(KEY_CODES[box[2]]);
  });

  it('stops offering to decorate once it has been done, and never names a knock key', () => {
    expect(houseKeyHintLine(new Set())).toBe('[H] DECORATE');
    expect(houseKeyHintLine(new Set(['decorate']))).toBe('');
    // Knocking is THE BOLTHOLE's garden sign, read like any other sign.
    expect(Object.keys(HOME_KEY_LETTERS)).not.toContain('knock');
  });
});

describe('a key is named until it has been used once', () => {
  it('drops each key from the chip as it is learned, and the chip is one line once all are', () => {
    const learned = new Set<string>();
    expect(objectiveChipLines('KIT: S', false, false, learned)[1]).toBe('[O] GUIDE  [L] LOOK  [B] PACK  [P] TEAM');

    learned.add('bag');
    expect(objectiveChipLines('KIT: S', false, false, learned)[1]).toBe('[O] GUIDE  [L] LOOK  [P] TEAM');

    learned.add('party').add('look').add('objectives');
    expect(objectiveChipLines('KIT: S', false, false, learned)).toEqual(['KIT: S']);
    // A new objective still names the two keys the raid is read with.
    expect(objectiveChipLines('KIT: S', true, false, learned)).toEqual(['KIT: S', '[O] GUIDE  [L] LOOK']);
  });

  it('empties the yard line as the yard is learned', () => {
    expect(yardKeyHintLine(new Set(['walk']))).toBe('[L] LOOK');
    expect(yardKeyHintLine(new Set(['walk', 'look']))).toBe('');
  });

  it('is remembered by the save, once each', () => {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
      removeItem: (key) => void values.delete(key),
    };
    const saves = new SaveManager(storage);
    saves.save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 0, y: 0 },
      bag: new Bag(),
      stash: createStartingStash(),
    });
    expect(saves.load()?.raidProgress.keysLearned ?? []).toEqual([]);

    expect(saves.learnKeys(['bag'])).toEqual(['bag']);
    expect(saves.learnKeys(['bag', 'look'])).toEqual(['look']);
    expect(new SaveManager(storage).load()?.raidProgress.keysLearned).toEqual(['bag', 'look']);
    // A key the game does not have is not kept.
    saves.save({ ...saves.load()!, raidProgress: { ...saves.load()!.raidProgress, keysLearned: ['bag', 'jump'] } });
    expect(new SaveManager(storage).load()?.raidProgress.keysLearned).toEqual(['bag']);
  });
});
