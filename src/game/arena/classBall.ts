import type { DojoClassId } from './dojoRecord';

/**
 * The little ball a class is shown as (`classes.ts`): on a player's name plate
 * in the shared harbour, and in a row on the dojo's class board. One pixel
 * table and four colourings - the Poké Ball's red, the Great Ball's blue with
 * its red flashes, the Ultra Ball's black with its yellow band and the Master
 * Ball's purple with its pink - so it is drawn the same everywhere and tested
 * without Phaser. `.` is nothing, and every other letter a colour of the ball.
 */
export const CLASS_BALL_ROWS: readonly string[] = [
  '..ooo..',
  '.oTXTo.',
  'oTTTTTo',
  'ooobooo',
  'oWWWWWo',
  '.oWWWo.',
  '..ooo..',
];

export const CLASS_BALL_SIZE = CLASS_BALL_ROWS.length;

export interface ClassBallColours {
  /** The top half. */
  readonly top: string;
  /** The mark on the top half: the Great Ball's flashes, the Ultra Ball's band, the Master Ball's spots. */
  readonly mark: string;
}

export const CLASS_BALL_COLOURS: Readonly<Record<DojoClassId, ClassBallColours>> = {
  'poke-ball': { top: '#e03838', mark: '#f87070' },
  'great-ball': { top: '#3868d8', mark: '#e03838' },
  'ultra-ball': { top: '#303038', mark: '#f8d030' },
  'master-ball': { top: '#8048c0', mark: '#f080c0' },
};

const OUTLINE = '#202028';
const WHITE = '#f8f8f8';

/** Every inked pixel of the ball for a class, at 1x, with its colour. */
export function classBallPixels(classId: DojoClassId): readonly { readonly x: number; readonly y: number; readonly ink: string }[] {
  const colours = CLASS_BALL_COLOURS[classId];
  const ink: Readonly<Record<string, string>> = { o: OUTLINE, T: colours.top, X: colours.mark, W: WHITE, b: WHITE };
  return CLASS_BALL_ROWS.flatMap((row, y) =>
    [...row].flatMap((cell, x) => (ink[cell] ? [{ x, y, ink: ink[cell] }] : [])),
  );
}
