// How colourful a screenshot of a screen is, and how much of it is plain white.
//
//   node tools/playtest/colourScore.mjs <picture.png | folder>... [--box=x0,y0,x1,y1]
//
// The world scores 27 to 35 and has no white ground; a menu that reads as part
// of the game scores 16 or more, and the screens that were a sheet of white
// paper scored 13 or less (the menu aesthetic study of 26 Nov 2026,
// `docs/screens/wood-floor/`). The score is the mean saturation of every pixel
// (0 is grey or white, 100 pure colour) inside the box, which by default is the
// game's stage in a 1280x800 picture without the title strip, the help strip or
// the controls bar. It reads a picture a driver already took, so it needs no
// browser.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { decodePng } from './apng.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [x0, y0, x1, y1] = (option('box') ?? '44,44,1236,632').split(',').map(Number);
const pictures = args
  .filter((arg) => !arg.startsWith('--'))
  .flatMap((path) => (statSync(path).isDirectory() ? readdirSync(path).filter((name) => name.endsWith('.png')).sort().map((name) => join(path, name)) : [path]));
if (pictures.length === 0) {
  throw new Error('colourScore: name a picture or a folder of them');
}

/** What one picture is made of, inside the box. */
function scoreOf({ width, pixels }) {
  let count = 0;
  let saturation = 0;
  let white = 0;
  let light = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const at = (y * width + x) * 4;
      const r = pixels[at];
      const g = pixels[at + 1];
      const b = pixels[at + 2];
      const most = Math.max(r, g, b);
      count += 1;
      saturation += most === 0 ? 0 : (most - Math.min(r, g, b)) / most;
      white += r === 255 && g === 255 && b === 255 ? 1 : 0;
      light += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
  }
  const share = (value) => Math.round((100 * value) / count);
  return { colour: share(saturation), white: share(white), brightness: share(light) };
}

console.log(`${'picture'.padEnd(36)} colour  white  brightness`);
for (const path of pictures) {
  const { colour, white, brightness } = scoreOf(decodePng(readFileSync(path)));
  console.log(`${basename(path, '.png').padEnd(36)} ${String(colour).padStart(6)} ${String(white).padStart(5)}% ${String(brightness).padStart(10)}`);
}
