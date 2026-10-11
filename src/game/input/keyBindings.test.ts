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
import { yardKeyHintLine } from './keyBindings';

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
  BAG: 'bag',
  TEAM: 'party',
};

describe('the keys a HUD names', () => {
  it('are the keys the raid binds, every one of them, for a save that has pressed none', () => {
    const controls = controlsOf(new WorldScene());
    const line = objectiveChipLines('LOST KIT: SW', false, false, new Set())[1];
    const named = namedKeys(line);

    expect(named.map(([, word]) => word)).toEqual(['GUIDE', 'LOOK', 'BAG', 'TEAM']);
    for (const [key, word] of named) {
      const control = controls[RAID_WORD_CONTROLS[word]] as BoundKey;
      expect(control.keyCode, `${word} is named as [${key}]`).toBe(KEY_CODES[key]);
    }
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

describe('a key is named until it has been used once', () => {
  it('drops each key from the chip as it is learned, and the chip is one line once all are', () => {
    const learned = new Set<string>();
    expect(objectiveChipLines('KIT: S', false, false, learned)[1]).toBe('[O] GUIDE  [L] LOOK  [B] BAG  [P] TEAM');

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
