import type { PaintedPicture } from '../world/minimap';
import { CLASS_BALL_SIZE, classBallPixels } from './classBall';
import { STREAK_TO_CHALLENGE } from './classes';
import { classOf, DOJO_CLASS_IDS, type DojoRecord } from './dojoRecord';

/**
 * THE BATTLE ARENA's class board (`classes.ts`), painted from the save onto the
 * stretch of the dojo's back wall that the room keeps for it, as Oak's cork
 * board is: a hanging board with the four class balls along it - the classes
 * reached in their colours, those above still grey, the player's own framed in
 * gold - and under them the run to the class's Black Belt, a gold square a win.
 * Read at a glance from the door; faced, it says the same in words
 * (`classBoardLines`). Phaser-free.
 */

const INK = {
  outline: '#20160e',
  wood: '#7a4a26',
  woodLight: '#a8703c',
  cloth: '#2c3448',
  clothShade: '#232a3a',
  gold: '#f8d030',
  goldShade: '#b08818',
  pip: '#4a5266',
  grey: '#8890a0',
  greyLight: '#c8ccd4',
} as const;

const PIP = 5;
const PIP_GAP = 4;

/** Where each class ball is painted on a board this wide, left to right, lowest class first. */
export function ballSeats(width: number): readonly { readonly x: number; readonly y: number }[] {
  const count = DOJO_CLASS_IDS.length;
  const step = Math.floor((width - 4) / count);
  const start = Math.floor((width - (step * (count - 1) + CLASS_BALL_SIZE)) / 2);
  return DOJO_CLASS_IDS.map((_id, index) => ({ x: start + index * step, y: 7 }));
}

export function classBoardPoster(record: DojoRecord | undefined, area: { readonly width: number; readonly height: number }): PaintedPicture {
  const width = area.width * 16;
  const height = area.height * 16;
  const data = new Uint8ClampedArray(width * height * 4);
  const fill = (x: number, y: number, w: number, h: number, ink: string): void => {
    const rgb = [1, 3, 5].map((at) => Number.parseInt(ink.slice(at, at + 2), 16));
    for (let py = Math.max(0, y); py < Math.min(height, y + h); py += 1) {
      for (let px = Math.max(0, x); px < Math.min(width, x + w); px += 1) {
        data.set([rgb[0], rgb[1], rgb[2], 255], (py * width + px) * 4);
      }
    }
  };
  // The hanging board: a wooden rail top and bottom, cloth between.
  fill(1, 2, width - 2, height - 3, INK.outline);
  fill(2, 3, width - 4, height - 5, INK.cloth);
  fill(2, height - 4, width - 4, 1, INK.clothShade);
  fill(0, 1, width, 3, INK.outline);
  fill(1, 2, width - 2, 1, INK.woodLight);
  fill(0, height - 4, width, 3, INK.outline);
  fill(1, height - 3, width - 2, 1, INK.wood);
  const reached = DOJO_CLASS_IDS.indexOf(classOf(record));
  ballSeats(width).forEach((seat, index) => {
    if (index === reached) {
      fill(seat.x - 2, seat.y - 2, CLASS_BALL_SIZE + 4, CLASS_BALL_SIZE + 4, INK.gold);
      fill(seat.x - 1, seat.y - 1, CLASS_BALL_SIZE + 2, CLASS_BALL_SIZE + 2, INK.cloth);
    }
    for (const pixel of classBallPixels(DOJO_CLASS_IDS[index])) {
      // A class not reached yet is a grey ball: there, but not yours.
      const grey = pixel.ink === '#202028' ? INK.outline : pixel.ink === '#f8f8f8' ? INK.greyLight : INK.grey;
      fill(seat.x + pixel.x, seat.y + pixel.y, 1, 1, index <= reached ? pixel.ink : grey);
    }
  });
  // The run: a gold square for each win in a row, all three gold at the top of the ladder.
  const run = classOf(record) === 'master-ball' && record?.topped ? STREAK_TO_CHALLENGE : Math.min(STREAK_TO_CHALLENGE, record?.streak?.length ?? 0);
  const across = STREAK_TO_CHALLENGE * PIP + (STREAK_TO_CHALLENGE - 1) * PIP_GAP;
  const left = Math.floor((width - across) / 2);
  for (let index = 0; index < STREAK_TO_CHALLENGE; index += 1) {
    const x = left + index * (PIP + PIP_GAP);
    fill(x, 19, PIP, PIP, index < run ? INK.goldShade : INK.outline);
    fill(x, 19, PIP - 1, PIP - 1, index < run ? INK.gold : INK.pip);
  }
  return { width, height, data };
}
