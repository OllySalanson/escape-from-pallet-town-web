import type { PaintedPicture } from '../world/minimap';
import { CUP_RUN_BOUTS, cupOfTheWeek, cupWeek, type CupId } from './cups';
import type { CupRecord } from './runRecords';

/**
 * THE BATTLE ARENA's cup board (`cups.ts`), painted from the save onto the
 * stretch of the dojo's back wall east of the master's floor, the class
 * board's twin across the room: a hanging board in this week's cup's colour
 * with a gold cup on it - lit once the cup is won this week - and under it the
 * seven bouts of a run, a gold square for each won in the run going and a pale
 * one for the week's best. Read at a glance from the door; faced, it says the
 * same in words (`cupBoardLines`). Phaser-free.
 */

const INK = {
  outline: '#20160e',
  wood: '#7a4a26',
  woodLight: '#a8703c',
  gold: '#f8d030',
  goldShade: '#b08818',
  pale: '#d8c890',
  pip: '#4a5266',
  grey: '#8890a0',
} as const;

/** Each cup's cloth: what the rule looks like. */
const CLOTH: Readonly<Record<CupId, readonly [string, string]>> = {
  rain: ['#2c4870', '#22385a'],
  sun: ['#a85020', '#86401a'],
  water: ['#206878', '#185460'],
  touch: ['#5a3a78', '#482e60'],
  ground: ['#6a4a28', '#56391e'],
  little: ['#8a4a6a', '#703c56'],
  mono: ['#3a4250', '#2e3440'],
};

/** The cup itself, 9 by 8, as rows of `#` for gold and `+` for its shade. */
const CUP = ['#########', '+#######+', ' +#####+ ', '  #####  ', '   ###   ', '    #    ', '   ###   ', '  #####  '];

const PIP = 4;
const PIP_GAP = 2;

export function cupBoardPoster(record: CupRecord | undefined, area: { readonly width: number; readonly height: number }, now: Date): PaintedPicture {
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
  const cup = cupOfTheWeek(now);
  const week = cupWeek(record, now);
  const [cloth, shade] = CLOTH[cup.id];
  fill(1, 2, width - 2, height - 3, INK.outline);
  fill(2, 3, width - 4, height - 5, cloth);
  fill(2, height - 4, width - 4, 1, shade);
  fill(0, 1, width, 3, INK.outline);
  fill(1, 2, width - 2, 1, INK.woodLight);
  fill(0, height - 4, width, 3, INK.outline);
  fill(1, height - 3, width - 2, 1, INK.wood);
  // The cup: gold once this week's is won, else grey.
  const won = week.best >= CUP_RUN_BOUTS;
  const cupLeft = Math.floor((width - CUP[0].length) / 2);
  CUP.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell !== ' ') {
        fill(cupLeft + x, 6 + y, 1, 1, won ? (cell === '#' ? INK.gold : INK.goldShade) : cell === '#' ? INK.grey : INK.pip);
      }
    });
  });
  // The run: seven squares, gold for the run going, pale for the week's best.
  const across = CUP_RUN_BOUTS * PIP + (CUP_RUN_BOUTS - 1) * PIP_GAP;
  const left = Math.floor((width - across) / 2);
  for (let index = 0; index < CUP_RUN_BOUTS; index += 1) {
    const x = left + index * (PIP + PIP_GAP);
    const ink = index < week.run ? INK.gold : index < week.best ? INK.pale : INK.pip;
    fill(x - 1, 18, PIP + 2, PIP + 2, INK.outline);
    fill(x, 19, PIP, PIP, ink);
  }
  return { width, height, data };
}
