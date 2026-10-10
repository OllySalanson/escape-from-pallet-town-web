// The map maker's four ways of losing a maker's work, played the way a maker
// meets them: real pointer clicks on the map, real typing, Tab, Enter, a reload.
//
//   node tools/playtest/makerDataLoss.mjs http://localhost:5173/
//
// Each case prints PASS or FAIL with what it saw; the process exits non-zero on
// any FAIL. It writes the maker's draft store directly only to set up the one
// case nothing in the editor can produce any more (a building hanging off the
// edge, which an older draft or a hand-edited file can still hold).
import { launchBrowser, sleep } from './browser.mjs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const STORE = 'escape-from-pallet-town.maker.v1';
const page_url = `${url}${url.includes('?') ? '&' : '?'}testmode=1`;

const results = [];
const report = (name, passed, detail) => {
  results.push(passed);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

function blank(width, height) {
  return {
    format: 1,
    id: 'probe',
    name: 'Probe',
    maker: '',
    width,
    height,
    ground: Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) =>
        x < 2 || y < 2 || x >= width - 2 || y >= height - 2 ? 'T' : '.',
      ).join(''),
    ),
    buildings: [],
    dropIns: [],
    exits: [],
    itemSpots: [],
    wildlife: 'meadow',
  };
}

const browser = await launchBrowser({ window: { width: 1280, height: 800 } });
try {
  const page = await browser.openPage('about:blank');
  const { send, evaluate } = page;

  /** Loads the game with this maker store (or none) and opens the map maker. */
  async function openMaker(store) {
    await send('Page.navigate', { url: page_url });
    await page.waitFor(`Boolean(window.__escapeFromPalletTownGame__?.scene?.getScene('title')?.sys?.isActive())`, { timeoutMs: 30_000 });
    await evaluate(`(() => {
      ${store === undefined ? '' : store === null ? `localStorage.removeItem('${STORE}');` : `localStorage.setItem('${STORE}', ${JSON.stringify(JSON.stringify(store))});`}
      window.__errors = [];
      window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
      window.addEventListener('unhandledrejection', (event) => window.__errors.push(String(event.reason)));
      window.__escapeFromPalletTownGame__.scene.getScene('title').scene.start('mapmaker');
    })()`);
    await page.waitFor(`Boolean(document.querySelector('.map-maker canvas[data-map]'))`, { timeoutMs: 5_000 }).catch(() => undefined);
    await sleep(300);
  }
  const errors = () => evaluate('window.__errors ?? []');
  const stored = () => evaluate(`JSON.parse(localStorage.getItem('${STORE}') ?? 'null')`);
  const storedCurrent = async () => {
    const store = await stored();
    return store?.drafts?.find((draft) => draft.key === store.current) ?? store?.drafts?.[0];
  };
  const centreOf = (selector) =>
    evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); element?.scrollIntoView({ block: 'nearest' }); const box = element?.getBoundingClientRect(); return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null; })()`);
  const mouse = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };
  const click = async (selector) => {
    const at = await centreOf(selector);
    if (!at) {
      throw new Error(`nothing on screen matches ${selector}`);
    }
    await mouse(at.x, at.y);
    await sleep(60);
  };
  /** The middle of one map tile, on screen. */
  const tile = (x, y) =>
    evaluate(`(() => { const canvas = document.querySelector('canvas[data-map]'); const box = canvas.getBoundingClientRect(); const file = window.__escapeFromPalletTownGame__.scene.getScene('mapmaker').history.value; return { x: box.left + (${x} + 0.5) * box.width / file.width, y: box.top + (${y} + 0.5) * box.height / file.height }; })()`);
  const clickTile = async (x, y) => {
    const at = await tile(x, y);
    await mouse(at.x, at.y);
    await sleep(40);
  };
  const type = (text) => send('Input.insertText', { text });
  const key = async (name, code, keyCode, text) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode, ...(text ? { text } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode });
    await sleep(80);
  };
  const tab = () => key('Tab', 'Tab', 9);
  const enter = () => key('Enter', 'Enter', 13, '\r');
  const selectAll = async () => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2, commands: ['selectAll'] });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
  };
  const live = () => evaluate(`window.__escapeFromPalletTownGame__.scene.getScene('mapmaker').history.value`);
  const reload = async () => {
    await send('Page.reload', {});
    await page.waitFor(`Boolean(window.__escapeFromPalletTownGame__?.scene?.getScene('title')?.sys?.isActive())`, { timeoutMs: 30_000 });
  };

  // --- Row 10: a building hanging off the edge -------------------------------
  {
    const file = { ...blank(30, 20), buildings: [{ x: 28, y: 10, kind: 'gym' }] };
    await openMaker({ drafts: [{ key: 'draft-offedge', file, updatedAt: 1 }], current: 'draft-offedge' });
    const opened = await evaluate(`Boolean(document.querySelector('.map-maker [data-tool]'))`);
    const thrown = await errors();
    report('a draft with a building off the edge does not brick the maker', opened && thrown.length === 0, thrown.join('; '));
    const kept = (await stored())?.drafts?.some((draft) => draft.key === 'draft-offedge');
    report('...and that draft is still in storage', Boolean(kept));
  }

  // --- Row 12: shrinking strands things and the next load deletes the draft --
  {
    await openMaker(null);
    await click('[data-place="person"]');
    await clickTile(30, 20);
    const placed = (await live()).people?.length ?? 0;
    await click('[data-map-width]');
    await selectAll();
    await type('20');
    await tab();
    await sleep(100);
    await click('[data-map-height]');
    await selectAll();
    await type('16');
    await enter();
    await sleep(700);
    const shrunk = await live();
    report(
      'shrinking to 20x16 leaves nobody off the map',
      placed === 1 && shrunk.width === 20 && shrunk.height === 16 && (shrunk.people ?? []).every((p) => p.x < 20 && p.y < 16),
      `placed ${placed}, now ${shrunk.width}x${shrunk.height}, people ${JSON.stringify(shrunk.people)}`,
    );
    await reload();
    await evaluate(`void window.__escapeFromPalletTownGame__.scene.getScene('title').scene.start('mapmaker')`);
    await sleep(400);
    const after = await live();
    report('...and the shrunk draft opens again after a reload', after.width === 20 && after.height === 16, `${after.width}x${after.height}`);

    const before = (await live()).width;
    await click('[data-map-width]');
    await selectAll();
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await click('[data-tool="brush"]');
    await sleep(200);
    const emptied = await live();
    const shown = await evaluate(`document.querySelector('[data-map-width]').value`);
    report('emptying Width and clicking away changes nothing', emptied.width === before && shown === String(before), `width ${before} became ${emptied.width}, field '${shown}'`);
  }

  // --- Row 20: autosave is a debounce with no flush on pagehide ---------------
  {
    await openMaker(null);
    await click('[data-brush="water"]');
    for (let index = 0; index < 20; index += 1) {
      await clickTile(3 + (index % 10), 3 + Math.floor(index / 10));
      // A stroke every third of a second, as a maker clicking along a row does:
      // never a 0.4 s pause between two of them.
      await sleep(150);
    }
    const drawn = (await live()).ground;
    await reload();
    const saved = (await storedCurrent())?.file?.ground;
    report('twenty quick strokes survive a reload straight after', JSON.stringify(saved) === JSON.stringify(drawn));

    await evaluate(`void window.__escapeFromPalletTownGame__.scene.getScene('title').scene.start('mapmaker')`);
    await sleep(400);
    await click('[data-map-name]');
    await selectAll();
    await type('Typed Not Blurred');
    await sleep(600);
    await reload();
    const name = (await storedCurrent())?.file?.name;
    report('a name typed and never left survives a reload', name === 'Typed Not Blurred', `stored '${name}'`);
  }

  // --- Row 19: text fields commit to the wrong place --------------------------
  {
    await openMaker(null);
    await click('[data-map-name]');
    await selectAll();
    await type('Alpha');
    await tab();
    await type('Bob');
    await tab();
    await sleep(200);
    let file = await live();
    report('Name, Tab, Drawn by: each lands in its own field', file.name === 'Alpha' && file.maker === 'Bob', `name '${file.name}', maker '${file.maker}'`);

    await click('[data-map-width]');
    await selectAll();
    await type('30');
    await tab();
    await selectAll();
    await type('24');
    await tab();
    await sleep(200);
    file = await live();
    report('Width, Tab, Height: one resize each', file.width === 30 && file.height === 24, `${file.width}x${file.height}`);

    await click('[data-place="person"]');
    await clickTile(5, 5);
    await clickTile(10, 5);
    await click('[data-tool="select"]');
    await clickTile(5, 5);
    await sleep(100);
    await click('[data-field="name"]');
    await selectAll();
    await type('Ada');
    await clickTile(10, 5);
    await sleep(300);
    file = await live();
    const thrown = await errors();
    report(
      'typing a name then clicking another thing names the first',
      file.people?.[0]?.name === 'Ada' && file.people?.[1]?.name === 'Person 2' && thrown.length === 0,
      `${JSON.stringify(file.people?.map((p) => p.name))} ${thrown.join('; ')}`,
    );

    await click('[data-field="name"]');
    await selectAll();
    await type('Bea');
    await enter();
    await sleep(200);
    await key('r', 'KeyR', 82, 'r');
    await sleep(200);
    file = await live();
    const tool = await evaluate(`window.__escapeFromPalletTownGame__.scene.getScene('mapmaker').tool`);
    report('Enter commits, and the next shortcut is a shortcut', file.people?.[1]?.name === 'Bea' && tool === 'rect', `name '${file.people?.[1]?.name}', tool ${tool}`);
  }
} finally {
  await browser.close();
}

const failed = results.filter((passed) => !passed).length;
console.log(`${results.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
