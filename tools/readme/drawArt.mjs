// Draws the front page's own art out of the game's own parts: the hero banner
// (docs/readme/hero.svg), the cast strip (docs/readme/cast.png) and the
// repository's link preview (docs/readme/social-preview.png).
//
//   npx vite-node tools/tileset/renderMap.mts -- viridian-city <scratch>/viridian-city.png 1
//   node tools/readme/drawArt.mjs <scratch>/viridian-city.png <url of a test-mode build>
//
// Nothing here is new art. The banner's town is Viridian City drawn by the
// game's own layer builder (`renderMap.mts`), the figures are the FireRed
// sheets the overworld walks (`public/assets/characters/`), and every word is
// set by the running game itself - a Phaser text on its title scene, cut to
// whole pixels by `src/game/ui/pixelText.ts` - so a letter on the front page
// is a letter of the game, not a font smoothed by whoever views the README.
//
// Everything is drawn at one game pixel and shown at two: GitHub's README
// column is 838 pixels wide on a desktop, so an 800-wide picture is shown at
// its own size and every game pixel is a crisp 2x2 square. See
// docs/readme/README.md for the whole set and how to make it again.
import { readFileSync, writeFileSync } from 'node:fs';
import { launchBrowser } from '../playtest/browser.mjs';

const [mapPng, gameUrl] = process.argv.slice(2);
if (!gameUrl) throw new Error('usage: drawArt.mjs <viridian-city.png from renderMap.mts at zoom 1> <url of a test-mode build>');
const root = new URL('../../', import.meta.url);
const dataUrl = (path, type = 'image/png') => `data:${type};base64,${readFileSync(path).toString('base64')}`;
const asset = (path) => dataUrl(new URL(`public/assets/${path}`, root));

const inputs = {
  map: dataUrl(mapPng),
  sheets: Object.fromEntries(
    ['protagonist-red', 'blue', 'prof-oak', 'nurse-joy', 'brock', 'bill', 'misty', 'lt-surge', 'koga', 'sabrina'].map((id) => [id, asset(`characters/${id}.png`)]),
  ),
};

// Runs in the page: returns PNG data URLs, one per layer.
const DRAW = async ({ map, sheets }) => {
  const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  /**
   * One line set by the game itself: a Phaser text on the title scene, which
   * `installPixelText` cuts to whole pixels exactly as every word in the game
   * is cut. Cropped to its ink, so a line is placed by its letters.
   */
  const scene = window.__escapeFromPalletTownGame__.scene.getScene('title');
  const family = scene.children.list.find((o) => o.type === 'Text').style.fontFamily;
  const words = (text, ink, size = 12) => {
    const t = scene.add.text(0, 0, text, { fontFamily: family, fontSize: `${size}px`, color: ink });
    t.updateText();
    const w = t.canvas.width, h = t.canvas.height;
    const [c, g] = canvas(w, h);
    g.drawImage(t.canvas, 0, 0);
    t.destroy();
    const data = g.getImageData(0, 0, w, h);
    let top = h, bottom = 0, left = w, right = 0;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const on = data.data[i + 3] >= 128;
      data.data[i + 3] = on ? 255 : 0;
      if (on) { top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
    }
    g.putImageData(data, 0, 0);
    const [o, og] = canvas(right - left + 1, bottom - top + 1);
    og.drawImage(c, -left, -top);
    return o;
  };
  /** Scaled up by whole pixels. */
  const big = (src, n) => { const [c, g] = canvas(src.width * n, src.height * n); g.drawImage(src, 0, 0, c.width, c.height); return c; };
  const centre = (g, img, cx, y) => g.drawImage(img, Math.round(cx - img.width / 2), y);
  /** The game's panel: a one-pixel border with clear corners (`ui/pixelWindow.ts`). */
  const panel = (g, x, y, w, h, fill, border) => {
    g.fillStyle = fill; g.fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle = border;
    g.fillRect(x + 1, y, w - 2, 1); g.fillRect(x + 1, y + h - 1, w - 2, 1);
    g.fillRect(x, y + 1, 1, h - 2); g.fillRect(x + w - 1, y + 1, 1, h - 2);
  };
  const png = (c) => c.toDataURL('image/png');
  const out = {};

  // The town: a band through the middle of Viridian City, its streets and the
  // Pokemon Center, which the banner drifts across.
  const town = await load(map);
  const MAP_X = 16, MAP_Y = 26; // renderMap's frame and title bar
  const BAND = { y: 330, h: 224 };
  {
    const [c, g] = canvas(72 * 16, BAND.h);
    g.drawImage(town, MAP_X, MAP_Y + BAND.y, c.width, BAND.h, 0, 0, c.width, BAND.h);
    out.town = png(c);
  }

  // The title plate, as the title screen draws it.
  {
    const W = 232, H = 96;
    const [c, g] = canvas(W, H);
    panel(g, 0, 0, W, H, 'rgba(15,31,51,0.94)', '#171717');
    g.fillStyle = '#8ed4c2';
    g.fillRect(3, 3, W - 6, 1); g.fillRect(3, H - 4, W - 6, 1); g.fillRect(3, 3, 1, H - 6); g.fillRect(W - 4, 3, 1, H - 6);
    centre(g, words('ESCAPE FROM', '#8ed4c2'), W / 2, 14);
    centre(g, words('PALLET TOWN', '#f8f5d7', 37), W / 2, 30);
    centre(g, words('GRAB THE LOOT. BEAT THE CLOCK. LEG IT.', '#9bb4c6'), W / 2, 72);
    out.plate = png(c);
    out.plateSize = [W, H];
  }

  // The prompt under the plate, a cream window like the title's menu rows.
  {
    const label = words('PLAY IT IN YOUR BROWSER', '#202020');
    const W = label.width + 24, H = 15;
    const [c, g] = canvas(W, H);
    panel(g, 0, 0, W, H, '#ebeac5', '#171717');
    // The game's cursor, a drawn triangle (Orange Kid has no arrows).
    g.fillStyle = '#202020';
    for (let i = 0; i < 4; i += 1) g.fillRect(7 + i, 4 + i, 1, 7 - 2 * i);
    g.drawImage(label, 15, Math.round((H - label.height) / 2));
    out.prompt = png(c);
    out.promptSize = [W, H];
  }

  // The raid clock gone red, as the HUD draws it in the last minute.
  {
    const label = words('RAID 0:09', '#ffe8d8', 14);
    const W = label.width + 10, H = label.height + 8;
    const [c, g] = canvas(W, H);
    panel(g, 0, 0, W, H, '#b0201c', '#171717');
    g.drawImage(label, 5, 4);
    out.clock = png(c);
    out.clockSize = [W, H];
  }

  // A hunter's mark: the "!" a trainer shows when they have seen you.
  {
    const [c, g] = canvas(11, 13);
    panel(g, 0, 0, 11, 11, '#ffffff', '#171717');
    g.fillStyle = '#171717'; g.fillRect(4, 11, 3, 1); g.fillRect(5, 12, 1, 1);
    g.fillStyle = '#b0201c'; g.fillRect(5, 2, 1, 5); g.fillRect(5, 8, 1, 1);
    out.mark = png(c);
  }

  out.sheets = Object.fromEntries(Object.entries(sheets).map(([k, v]) => [k, v]));

  // The cast: the four keepers of the base and the five rivals who hunt you,
  // each drawn off the sheet the game draws them from, at two pixels to one.
  {
    const W = 400;
    const figure = async (g, id, cx, y) => {
      const sheet = await load(sheets[id]);
      const [f, fg] = canvas(16, 32);
      fg.drawImage(sheet, 0, 0, 16, 32, 0, 0, 16, 32);
      g.drawImage(big(f, 2), cx - 16, y);
    };
    const row = async (people, { height, fill, ink, soft, bar, barInk, title, footer }) => {
      const [c, g] = canvas(W, height);
      panel(g, 0, 0, W, height, fill, '#171717');
      g.fillStyle = bar; g.fillRect(1, 1, W - 2, 15);
      centre(g, words(title, barInk), W / 2, 5);
      const step = W / people.length;
      for (const [index, [id, name, role]] of people.entries()) {
        const cx = Math.round(step * index + step / 2);
        g.fillStyle = soft; g.fillRect(cx - 9, 66, 18, 2);
        await figure(g, id, cx, 12);
        centre(g, words(name, ink), cx, 74);
        if (role) centre(g, words(role, soft), cx, 88);
      }
      if (footer) centre(g, words(footer, soft), W / 2, height - 15);
      return c;
    };
    const home = await row(
      [['prof-oak', 'PROF. OAK', 'SENDS YOU OUT'], ['nurse-joy', 'NURSE JOY', 'PATCHES YOU UP'], ['brock', 'BROCK', 'BUILDS THINGS'], ['bill', 'BILL', 'DOES DEALS']],
      { height: 102, fill: '#ebeac5', ink: '#202020', soft: '#6b6a55', bar: '#202020', barInk: '#ebeac5', title: 'AT HOME IN THE HARBOUR' },
    );
    const rivals = await row(
      [['blue', 'BLUE'], ['misty', 'MISTY'], ['lt-surge', 'LT. SURGE'], ['koga', 'KOGA'], ['sabrina', 'SABRINA']],
      { height: 110, fill: '#0f1f33', ink: '#f8f5d7', soft: '#9bb4c6', bar: '#8ed4c2', barInk: '#0f1f33', title: 'OUT IN THE FIELD, ON YOUR TRAIL', footer: 'ONE OF THEM HUNTS YOU EVERY RAID' },
    );
    const [c, g] = canvas(W, home.height + 6 + rivals.height);
    g.drawImage(home, 0, 0);
    g.drawImage(rivals, 0, home.height + 6);
    out.cast = png(big(c, 2));
  }

  // The link preview GitHub shows when the repository is shared: 1280x640,
  // which is 320x160 game pixels at four to one, because it is mostly seen
  // as a thumbnail and the title has to survive being shrunk. The banner's
  // town, plate, prompt, clock and chase, still.
  {
    const W = 320, H = 160;
    const [c, g] = canvas(W, H);
    g.fillStyle = '#0a1428'; g.fillRect(0, 0, W, H);
    g.drawImage(town, MAP_X + 300, MAP_Y + BAND.y + 40, W, H, 0, 0, W, H);
    const dusk = g.createLinearGradient(0, 0, 0, H);
    dusk.addColorStop(0, 'rgba(10,20,40,0.72)');
    dusk.addColorStop(0.55, 'rgba(10,20,40,0.38)');
    dusk.addColorStop(1, 'rgba(10,20,40,0.55)');
    g.fillStyle = dusk; g.fillRect(0, 0, W, H);
    const [plate, prompt, clock, mark] = await Promise.all([out.plate, out.prompt, out.clock, out.mark].map(load));
    const px = Math.round((W - plate.width) / 2), py = 22;
    g.fillStyle = '#f8f5d7';
    for (const [x, y] of [[px - 8, py + 10], [px + plate.width + 3, py + 62], [px + 34, py - 9], [18, 132]]) {
      g.fillRect(x + 2, y, 1, 5); g.fillRect(x, y + 2, 5, 1);
    }
    g.drawImage(plate, px, py);
    g.drawImage(prompt, Math.round((W - prompt.width) / 2) - 24, py + plate.height + 8);
    g.drawImage(clock, W - clock.width - 8, 6);
    // Mid-stride on the right-facing row (`playerFrames.ts`), Blue a step behind.
    const stride = async (id, x, y, column) => {
      const sheet = await load(sheets[id]);
      g.drawImage(sheet, column * 16, 32, 16, 32, x, y, 16, 32);
    };
    const feet = H - 34;
    await stride('blue', 236, feet, 3);
    g.drawImage(mark, 239, feet + 2);
    await stride('protagonist-red', 268, feet, 1);
    out.social = png(big(c, 4));
  }
  return out;
};

const browser = await launchBrowser({ window: { width: 400, height: 300 } });
try {
  const url = new URL(gameUrl);
  url.searchParams.set('testmode', 'pixels');
  const page = await browser.openPage(url.href);
  await page.waitFor(`window.__escapeFromPalletTownGame__?.scene.getScenes(true).some((s) => s.scene.key === 'title')`);
  await page.evaluate('window.__escapeFromPalletTownGame__.pauseLoop()');
  const art = await page.evaluate(`(${DRAW.toString()})(${JSON.stringify(inputs)})`, { awaitPromise: true });
  const bytes = (data) => Buffer.from(data.split(',')[1], 'base64');
  writeFileSync(new URL('docs/readme/cast.png', root), bytes(art.cast));
  writeFileSync(new URL('docs/readme/social-preview.png', root), bytes(art.social));

  // The banner, in game pixels, shown at 800 wide.
  const W = 400, H = 224;
  const [pw, ph] = art.plateSize, [qw, qh] = art.promptSize, [cw, ch] = art.clockSize;
  const px = (W - pw) / 2, py = 26;
  const pixelated = 'image-rendering="optimizeSpeed" style="image-rendering:pixelated"';
  // A walk is the sheet's right-facing row, columns 1, 0, 3, 0 (`playerFrames.ts`).
  // The chase starts mid-street, so a picture of the banner's first frame has them in it.
  const runner = (id, delay) => `
    <g class="run" style="animation-delay:${delay}s">
      <svg x="0" y="${H - 50}" width="16" height="32" viewBox="0 0 16 32" overflow="hidden">
        <image class="stride" href="${art.sheets[id]}" width="64" height="128" y="-32" ${pixelated}/>
      </svg>
    </g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="800" height="448" shape-rendering="crispEdges">
  <title>Escape from Pallet Town</title>
  <desc>Escape from Pallet Town: an extraction raid through a Kanto town at dusk. A trainer in a red cap runs along the street with Blue, the rival, on their heels.</desc>
  <style>
    .drift { animation: drift 48s steps(376) infinite alternate; }
    @keyframes drift { from { transform: translateX(0); } to { transform: translateX(-752px); } }
    .run { animation: run 7s steps(140) infinite; }
    @keyframes run { 0% { transform: translateX(-40px); } 100% { transform: translateX(440px); } }
    .stride { animation: stride 0.6s infinite; }
    @keyframes stride {
      0% { transform: translateX(-16px); animation-timing-function: steps(1, end); }
      25% { transform: translateX(0); animation-timing-function: steps(1, end); }
      50% { transform: translateX(-48px); animation-timing-function: steps(1, end); }
      75% { transform: translateX(0); animation-timing-function: steps(1, end); }
      100% { transform: translateX(-16px); }
    }
    .blink { animation: blink 1.2s steps(1, end) infinite; }
    @keyframes blink { 0%, 60% { opacity: 1; } 61%, 100% { opacity: 0; } }
    .alarm { animation: alarm 1s steps(1, end) infinite; }
    @keyframes alarm { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0.55; } }
    .mark { animation: mark 0.5s steps(1, end) infinite alternate; }
    @keyframes mark { 0% { transform: translateY(0); } 100% { transform: translateY(-1px); } }
    .twinkle { animation: twinkle 2.4s steps(1, end) infinite; opacity: 0; }
    @keyframes twinkle { 0%, 12% { opacity: 1; } 13%, 100% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .drift, .run, .stride, .blink, .alarm, .mark, .twinkle { animation: none; } .twinkle { opacity: 0; } .run { transform: translateX(240px); } }
  </style>
  <defs>
    <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a1428" stop-opacity="0.72"/>
      <stop offset="0.55" stop-color="#0a1428" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#0a1428" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a1428"/>
  <g class="drift"><image href="${art.town}" width="1152" height="224" ${pixelated}/></g>
  <rect width="${W}" height="${H}" fill="url(#dusk)"/>
  ${[[px - 6, py + 8, 0], [px + pw + 2, py + 60, 0.8], [px + 30, py - 8, 1.6], [px + pw - 40, py + ph + 4, 0.4]].map(([x, y, d]) => `
  <g class="twinkle" style="animation-delay:${d}s" fill="#f8f5d7"><rect x="${x + 2}" y="${y}" width="1" height="5"/><rect x="${x}" y="${y + 2}" width="5" height="1"/></g>`).join('')}
  <image href="${art.plate}" x="${px}" y="${py}" width="${pw}" height="${ph}" ${pixelated}/>
  <g class="blink"><image href="${art.prompt}" x="${(W - qw) / 2}" y="${py + ph + 10}" width="${qw}" height="${qh}" ${pixelated}/></g>
  <g class="alarm"><image href="${art.clock}" x="${W - cw - 6}" y="6" width="${cw}" height="${ch}" ${pixelated}/></g>
  ${runner('protagonist-red', -2.5)}
  <g class="run" style="animation-delay:-2.5s"><g transform="translate(-34 0)">
    <svg x="0" y="${H - 50}" width="16" height="32" viewBox="0 0 16 32" overflow="hidden">
      <image class="stride" href="${art.sheets.blue}" width="64" height="128" y="-32" ${pixelated}/>
    </svg>
    <g class="mark"><image href="${art.mark}" x="3" y="${H - 58}" width="11" height="13" ${pixelated}/></g>
  </g></g>
</svg>
`;
  writeFileSync(new URL('docs/readme/hero.svg', root), svg);
  console.log('hero.svg', Buffer.byteLength(svg), 'bytes; cast.png', bytes(art.cast).length, 'bytes; social-preview.png', bytes(art.social).length, 'bytes');
} finally {
  await browser.close();
}
