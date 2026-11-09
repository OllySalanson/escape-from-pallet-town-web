/**
 * How a line too long for one dialogue box is shared out between boxes.
 *
 * Cut a whole box of rows at a time, a line three rows long was read 2 + 1,
 * and its last box held one stray word - "spine.", "THINGS.", "boat shed." -
 * on the golden plinth, the bottle and MARLOW's chart (playtest 51, finding 4).
 * So a line is cut where a reader would pause: in as many boxes as the plain
 * cut takes, never more, at a sentence's end where one falls near enough the
 * middle, and otherwise with the words shared out evenly, so no box is left
 * holding the tail of a sentence on its own.
 *
 * Pure, and handed the box's own word-wrap, so what it decides is what the
 * box draws, and a test can ask it with a wrap of its own.
 */

/** A word that ends a sentence: a full stop, a question or an exclamation, a closing quote or bracket after it allowed. */
const SENTENCE_END = /[.!?…]["'’”)]*$/;
/** A word that ends a clause: a pause, though a weaker one. */
const CLAUSE_END = /[,;:-]["'’”)]*$/;

/** A box shorter than this that does not hold a sentence of its own is a stray tail, in characters. */
export const STRAY_BOX_CHARACTERS = 16;

/** What a cut costs, by where it falls: nothing at a sentence's end, a little at a clause's, most mid-clause. */
const CUT_COST = { sentence: 0, clause: 2, word: 4 } as const;
/** What a box left as a stray tail costs: more than any other way of cutting the line. */
const STRAY_COST = 50;

/**
 * The boxes a line is read in, each a run of whole words that wraps to no
 * more than `rows` rows. A line that fits one box is that box; one with its
 * own line breaks is cut a box of rows at a time, as written.
 */
export function shareLine(text: string, rows: number, wrap: (text: string) => readonly string[]): string[] {
  const wrapped = wrap(text);
  if (wrapped.length <= rows) {
    return [text];
  }
  const plain = (): string[] => {
    const boxes: string[] = [];
    for (let first = 0; first < wrapped.length; first += rows) {
      boxes.push(
        wrapped
          .slice(first, first + rows)
          .map((row) => row.trimEnd())
          .join('\n'),
      );
    }
    return boxes;
  };
  if (text.includes('\n') || !Number.isFinite(rows)) {
    return plain();
  }
  const words = text.split(' ').filter((word) => word.length > 0);
  const boxCount = Math.ceil(wrapped.length / rows);
  const count = words.length;

  // How many rows the words from `from` up to `to` take, as one box; Infinity past a box.
  const rowsOf = new Map<number, number>();
  const rowsFor = (from: number, to: number): number => {
    const key = from * (count + 1) + to;
    let known = rowsOf.get(key);
    if (known === undefined) {
      known = wrap(words.slice(from, to).join(' ')).length;
      rowsOf.set(key, known);
    }
    return known;
  };
  const endsSentence = (index: number): boolean => index === 0 || SENTENCE_END.test(words[index - 1]);
  const boxCost = (from: number, to: number, used: number): number => {
    const length = words.slice(from, to).join(' ').length;
    // A short box is fine only if it is a sentence of its own: "Go on." is a line, "boat shed." is a tail.
    const stray = length < STRAY_BOX_CHARACTERS && !(endsSentence(from) && endsSentence(to)) ? STRAY_COST : 0;
    // Boxes filled alike: a box of two rows and a box of one cost the one row's slack, squared.
    return (rows - used) ** 2 + stray;
  };
  const cutCost = (at: number): number => {
    if (at === count) return 0;
    const word = words[at - 1];
    return SENTENCE_END.test(word) ? CUT_COST.sentence : CLAUSE_END.test(word) ? CUT_COST.clause : CUT_COST.word;
  };

  // best[boxes][end]: the cheapest way to read the first `end` words in `boxes` boxes.
  const best: { cost: number; from: number }[][] = Array.from({ length: boxCount + 1 }, () =>
    Array.from({ length: count + 1 }, () => ({ cost: Number.POSITIVE_INFINITY, from: -1 })),
  );
  best[0][0] = { cost: 0, from: -1 };
  for (let boxes = 1; boxes <= boxCount; boxes += 1) {
    for (let from = 0; from < count; from += 1) {
      const before = best[boxes - 1][from].cost;
      if (!Number.isFinite(before)) continue;
      for (let to = from + 1; to <= count; to += 1) {
        const used = rowsFor(from, to);
        if (used > rows) break;
        const cost = before + boxCost(from, to, used) + cutCost(to);
        if (cost < best[boxes][to].cost) best[boxes][to] = { cost, from };
      }
    }
  }
  if (!Number.isFinite(best[boxCount][count].cost)) {
    return plain();
  }
  const boxes: string[] = [];
  let end = count;
  for (let box = boxCount; box > 0; box -= 1) {
    const from = best[box][end].from;
    boxes.unshift(words.slice(from, end).join(' '));
    end = from;
  }
  return boxes;
}
