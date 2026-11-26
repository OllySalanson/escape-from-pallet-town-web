import { hunterIntelLine } from '../scenes/raidHud';
import { iconMarkup } from './icons';

/**
 * What each of Brock's builds does in a raid, as a little picture of the raid
 * with it built rather than a sentence about it (the captain, 25 Nov 2026: the
 * build screen's "information box could be a bit better styled"; the round-3
 * look: explain with pictures, not text).
 *
 * Each picture is made of what the raid itself shows: the radio mast's is the
 * hunter chip the HUD prints with the mast up (`hunterIntelLine`), a locker's
 * is THE LOCKER's own squares with the new ones in gold, a healing machine's is
 * the raid clock a revive costs.
 */

/** A row of squares, `columns` wide and `rows` deep, the last `added` columns new. */
function squares(columns: number, rows: number, added: number): string {
  const cells: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push(`<i${column >= columns - added ? ' class="is-new"' : ''}></i>`);
    }
  }
  return `<span class="ws-squares" style="--columns:${columns}">${cells.join('')}</span>`;
}

/** Before and after, with the drawn arrow between. */
function becomes(before: string, after: string): string {
  return `<span class="ws-becomes">${before}<span class="ws-arrow" aria-hidden="true"></span>${after}</span>`;
}

/** The clock a thing costs, as the raid's own clock icon and the time. */
function clock(time: string, tone: '' | 'is-good' = ''): string {
  return `<span class="ws-clock ${tone}">${iconMarkup('raid-clock', 'Raid clock')}<b>${time}</b></span>`;
}

/** The picture of what a build does in a raid, or nothing for one the raid never shows. */
export function workshopEffectPicture(upgradeId: string): string {
  switch (upgradeId) {
    case 'radio-mast':
      // The chip the HUD prints with the mast up, in its own words.
      return `<span class="ws-chip">${iconMarkup('radio-mast', 'Radio mast')}<span>HUNTER LV6 x2</span><span class="ws-arrow" aria-hidden="true"></span><b>${hunterIntelLine({ level: 6, teamSize: 2, next: { level: 9, teamSize: 3, inMs: 80_000 } })}</b></span>`;
    case 'beacon':
      return `<span class="ws-chip">${clock('LATE')}<span class="ws-arrow" aria-hidden="true"></span>${iconMarkup('extraction-open', 'A way out')}<b>WHERE YOU LANDED</b></span>`;
    case 'secure-locker-1':
      return becomes(squares(2, 2, 0), squares(3, 2, 1));
    case 'secure-locker-2':
      return becomes(
        `<span class="ws-places"><i class="is-mon"></i></span>`,
        `<span class="ws-places"><i class="is-mon"></i><i class="is-mon is-new"></i></span>`,
      );
    case 'recovery-bay-1':
      // The raid clock a revive costs, before and after: under half.
      return `<span class="ws-chip">${iconMarkup('raid-clock', 'Raid clock')}${becomes(`<span class="ws-bar"><i style="--fill:100%"></i></span>`, `<span class="ws-bar is-good"><i style="--fill:45%"></i></span>`)}</span>`;
    case 'recovery-bay-2':
      return becomes(clock('REVIVE'), clock('0:05', 'is-good'));
    case 'quarantine-ward':
      return `<span class="ws-chip">${iconMarkup('medicine-bag', 'A revive')}<b>+1 REVIVE A RAID</b>${clock('0:00', 'is-good')}</span>`;
    default:
      return '';
  }
}
