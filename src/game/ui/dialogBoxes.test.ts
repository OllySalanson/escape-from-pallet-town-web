import { describe, expect, it } from 'vitest';
import { LIBRARIAN_LINES } from '../base/rooms';
import { getItemById } from '../items/items';
import { SECRETS_BOOK_LOCKED_LINES } from '../library/secretsBookLock';
import {
  BOTTLE_FOUND_LINES,
  CHART_PIECES,
  CHART_ROOM_ARRIVAL_LINES,
  chestOpenedLines,
  marlowLibraryLines,
  marlowRoomLines,
  NO_TREASURE_HUNT,
  pinnedLines,
  WHOLE_CHART_LINES,
  type HuntStage,
} from '../treasure/treasureMap';
import { RUMOURS } from '../world/rumours';
import { SECRETS } from '../world/secrets';
import { shareLine, STRAY_BOX_CHARACTERS } from './dialogBoxes';

/**
 * The harbour's dialogue box, as words: two rows of about 38 characters
 * (`hub/errands.test.ts` has the same measure), wrapped a whole word at a time
 * as Phaser wraps them.
 */
const ROWS = 2;
const ROW_LETTERS = 38;

function wrap(text: string): string[] {
  const rows: string[] = [];
  for (const word of text.split(' ')) {
    const last = rows[rows.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= ROW_LETTERS) {
      rows[rows.length - 1] = `${last} ${word}`;
    } else {
      rows.push(word);
    }
  }
  return rows.length > 0 ? rows : [''];
}

const SENTENCE_END = /[.!?…]["'’”)]*$/;

/** The boxes of a line that are a stray tail: short, and the end of a sentence another box began. */
function strayBoxes(line: string): string[] {
  const boxes = shareLine(line, ROWS, wrap);
  return boxes.filter((box, index) => {
    const startsSentence = index === 0 || SENTENCE_END.test(boxes[index - 1]);
    return box.length < STRAY_BOX_CHARACTERS && !(startsSentence && SENTENCE_END.test(box));
  });
}

describe('a line shared out between dialogue boxes', () => {
  it('stays one box when it fits one', () => {
    expect(shareLine('Somebody ought to.', ROWS, wrap)).toEqual(['Somebody ought to.']);
  });

  it('takes no more boxes than cutting a whole box of rows at a time did, and keeps every word in order', () => {
    const line = 'MARLOW: Cliffs, a cove under them, a little boat shed... and the line ends at a mark. Somebody drew it in a hurry, and somebody else tore it.';
    const boxes = shareLine(line, ROWS, wrap);
    expect(boxes).toHaveLength(Math.ceil(wrap(line).length / ROWS));
    expect(boxes.join(' ')).toBe(line);
    for (const box of boxes) expect(wrap(box).length).toBeLessThanOrEqual(ROWS);
  });

  it('cuts at a sentence end rather than leaving the last word of the line in a box of its own', () => {
    // The golden plinth (playtest 51, finding 4): cut a box of rows at a time, its second box was "spine.".
    const [line] = SECRETS_BOOK_LOCKED_LINES;
    expect(wrap(line).length).toBe(3);
    expect(shareLine(line, ROWS, wrap)).toEqual(['A golden book, chained shut to its plinth.', 'VALE SECRETS, it says on the spine.']);
  });

  it('shares the words of one long sentence evenly when it has nowhere better to pause', () => {
    const line = 'The bottle rolled up the sand past the huts and the deckchairs and the ice cream cart and stopped by the rocks';
    const boxes = shareLine(line, ROWS, wrap);
    expect(boxes.join(' ')).toBe(line);
    expect(Math.min(...boxes.map((box) => box.length))).toBeGreaterThanOrEqual(STRAY_BOX_CHARACTERS);
  });

  it('keeps a line with its own breaks as it was written', () => {
    const line = 'ONE\nTWO\nTHREE';
    expect(shareLine(line, ROWS, (text) => text.split('\n'))).toEqual(['ONE\nTWO', 'THREE']);
  });
});

describe('the treasure hunt, the library and the secrets', () => {
  const name = (itemId: string): string => getItemById(itemId)?.displayName ?? itemId;
  const stages: readonly HuntStage[] = ['no-chart', 'first-chart', 'pinning', 'whole', 'chest', 'done'];
  const pinnedOne = { ...NO_TREASURE_HUNT, roomOpen: true, pinned: [CHART_PIECES[0].id] };
  const lines: readonly string[] = [
    ...BOTTLE_FOUND_LINES,
    ...CHART_ROOM_ARRIVAL_LINES,
    ...WHOLE_CHART_LINES,
    ...stages.flatMap((stage) => [...marlowLibraryLines(stage), ...marlowRoomLines(stage, pinnedOne)]),
    ...CHART_PIECES.flatMap((piece, index) =>
      pinnedLines(piece, { ...pinnedOne, pinned: CHART_PIECES.slice(0, index + 1).map((each) => each.id) }, name(piece.itemId), 'CHARMANDER'),
    ),
    ...chestOpenedLines(name, 'CHARMANDER'),
    ...LIBRARIAN_LINES,
    ...SECRETS_BOOK_LOCKED_LINES,
    ...SECRETS.map((secret) => secret.foundLine),
    ...RUMOURS.map((rumour) => rumour.line),
  ];

  it('are many, so this asks something', () => {
    expect(lines.length).toBeGreaterThan(40);
  });

  it.each(lines)('never leaves a box holding one stray word: %s', (line) => {
    expect(strayBoxes(line)).toEqual([]);
  });
});
