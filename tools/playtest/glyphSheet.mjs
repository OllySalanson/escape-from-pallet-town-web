// Every glyph the canvas draws, as the game draws it, one character a pixel.
//
//   node tools/playtest/glyphSheet.mjs <dev server url> <out.txt> [--against=<earlier out.txt>]
//
// `ui/pixelText.ts` turns Orange Kid into a bitmap font at run time, and a
// change to how it cuts a glyph (`inkMask`, the threshold, the nudges) changes
// letters nobody was looking at. So a change there is judged glyph by glyph:
// write a sheet before, make the change, write one after with `--against`, and
// read every glyph it lists. Each is drawn at the two sizes the game sets text
// in (`screenType.ts`: 12px and 14px), filled and with the three-pixel outline
// the battle banners wear (`#` ink, `o` outline, `.` paper). Against the face's
// true shapes, render the same letters large in any browser.
//
// It needs the dev server: it imports the game's own modules into the page.
import { readFileSync, writeFileSync } from 'node:fs';
import { launchBrowser } from './browser.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'glyphs.txt'] = args.filter((arg) => !arg.startsWith('--'));
const against = args.find((arg) => arg.startsWith('--against='))?.slice(10);
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?.,:;\'"-+/%()#&₽é*<>=';

const browser = await launchBrowser();
let sheet;
try {
  const page = await browser.openPage(`${url}?testmode=1`);
  await page.waitFor(`window.__escapeFromPalletTownGame__?.scene?.isActive('title')`, { timeoutMs: 60_000 });
  sheet = await page.evaluate(`(async () => {
    const { hardenContext } = await import('/src/game/ui/pixelText.ts');
    const { GAME_FONT } = await import('/src/game/ui/gameFont.ts');
    const glyphs = [];
    for (const size of [12, 14]) {
      for (const pass of ['fill', 'outline']) {
        for (const char of ${JSON.stringify([...CHARS])}) {
          const canvas = document.createElement('canvas');
          canvas.width = 30;
          canvas.height = size + 14;
          const context = canvas.getContext('2d');
          context.font = size + 'px ' + GAME_FONT;
          hardenContext(context);
          context.fillStyle = '#000000';
          context.strokeStyle = '#ff0000';
          context.lineWidth = 3;
          if (pass === 'outline') context.strokeText(char, 5, size + 5);
          context.fillText(char, 5, size + 5);
          const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const rows = [];
          for (let y = 0; y < canvas.height; y += 1) {
            let row = '';
            for (let x = 0; x < canvas.width; x += 1) {
              const at = (y * canvas.width + x) * 4;
              row += data[at + 3] === 0 ? '.' : data[at] > 128 ? 'o' : '#';
            }
            rows.push(row);
          }
          // Blank rows inside a glyph stay: a missing row is exactly the fault to see.
          const inked = rows.map((row) => /[#o]/.test(row));
          const body = rows.slice(inked.indexOf(true), inked.lastIndexOf(true) + 1).map((row) => row.replace(/\\.+$/, '') || '.');
          glyphs.push('=== ' + size + 'px ' + pass + ' ' + char + '\\n' + body.join('\\n'));
        }
      }
    }
    return glyphs.join('\\n') + '\\n';
  })()`);
} finally {
  await browser.close();
}
writeFileSync(out, sheet);

if (against) {
  const parse = (text) => {
    const glyphs = new Map();
    let key = null;
    for (const line of text.split('\n')) {
      if (line.startsWith('=== ')) {
        key = line.slice(4);
        glyphs.set(key, []);
      } else if (key && line) {
        glyphs.get(key).push(line);
      }
    }
    return glyphs;
  };
  const before = parse(readFileSync(against, 'utf8'));
  const after = parse(sheet);
  const changed = [...after.keys()].filter((key) => before.get(key)?.join('\n') !== after.get(key).join('\n'));
  console.log(`${changed.length} of ${after.size} glyphs changed`);
  for (const key of changed) {
    const was = before.get(key) ?? [];
    const now = after.get(key);
    console.log(`--- ${key}   (before | after)`);
    for (let row = 0; row < Math.max(was.length, now.length); row += 1) {
      console.log(`${(was[row] ?? '').padEnd(20)} | ${now[row] ?? ''}`);
    }
  }
}
