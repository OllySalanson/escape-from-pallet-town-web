// The map maker open in two tabs, and a double-click on a draft's Delete: the
// two ways the map maker bug hunt of 10 Nov 2026 lost a maker's work, played
// the way a maker meets them - two pages of the game on one browser's storage,
// names typed into the Name field, real mouse clicks and a real double-click.
//
//   node tools/playtest/makerTwoTabs.mjs http://localhost:5173/ [shots-folder]
//   node tools/playtest/makerTwoTabs.mjs 'http://localhost:5173/?testmode=off'
//
// Each case prints PASS or FAIL with what it saw; the process exits non-zero on
// any FAIL. With a shots folder it photographs the second tab's drafts list and
// the Delete after a double-click.
import { launchBrowser, sleep, writeScreenshot } from './browser.mjs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const shots = process.argv[3];
const STORE = 'escape-from-pallet-town.maker.v1';
// In test mode unless the URL says otherwise: `?testmode=off` plays it at real speed.
const pageUrl = url.includes('testmode=') ? url : `${url}${url.includes('?') ? '&' : '?'}testmode=1`;

const results = [];
const report = (name, passed, detail) => {
  results.push(passed);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

const browser = await launchBrowser({ window: { width: 1280, height: 800 } });
try {
  /** One tab of the game, opened on the map maker, with what it can be asked to do. */
  async function openTab() {
    const page = await browser.openPage('about:blank');
    const { send, evaluate } = page;
    await send('Page.navigate', { url: pageUrl });
    await page.waitFor(`Boolean(window.__escapeFromPalletTownGame__?.scene?.getScene('title')?.sys?.isActive())`, { timeoutMs: 60_000 });
    await evaluate(`(() => {
      window.__errors = [];
      window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
      window.addEventListener('unhandledrejection', (event) => window.__errors.push(String(event.reason)));
      window.__escapeFromPalletTownGame__.scene.getScene('title').scene.start('mapmaker');
    })()`);
    await page.waitFor(`Boolean(document.querySelector('.map-maker [data-map-name]'))`, { timeoutMs: 60_000 });
    await sleep(300);
    const centreOf = (selector) =>
      evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); element?.scrollIntoView({ block: 'nearest' }); const box = element?.getBoundingClientRect(); return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null; })()`);
    const press = async (x, y, clickCount) => {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount });
    };
    const at = async (selector) => {
      const where = await centreOf(selector);
      if (!where) {
        throw new Error(`nothing on screen matches ${selector}`);
      }
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: where.x, y: where.y });
      return where;
    };
    const tab = {
      page,
      evaluate,
      /** Brings this tab to the front, as a maker clicking on it does. */
      front: async () => {
        await send('Page.bringToFront', {});
        await sleep(200);
      },
      click: async (selector) => {
        const where = await at(selector);
        await press(where.x, where.y, 1);
        await sleep(120);
      },
      /** A double-click: two presses a few milliseconds apart, the second counted as the second. */
      doubleClick: async (selector) => {
        const where = await at(selector);
        await press(where.x, where.y, 1);
        await sleep(60);
        await press(where.x, where.y, 2);
        await sleep(200);
      },
      /** Types a new name over the map's own, and moves on to the map, which commits it. */
      rename: async (name) => {
        await tab.click('[data-map-name]');
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2, commands: ['selectAll'] });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
        await send('Input.insertText', { text: name });
        await tab.click('[data-tool="brush"]');
        // Past the autosave's throttle.
        await sleep(900);
      },
      name: () => evaluate(`window.__escapeFromPalletTownGame__.scene.getScene('mapmaker').history.value.name`),
      listed: () => evaluate(`[...document.querySelectorAll('[data-open-draft] .px-name')].map((element) => element.textContent)`),
      errors: () => evaluate('window.__errors ?? []'),
      shot: async (file) => {
        if (!shots) return;
        const { data } = await send('Page.captureScreenshot', { format: 'png' });
        writeScreenshot(`${shots}/${file}`, data);
      },
    };
    return tab;
  }

  const a = await openTab();
  await a.evaluate(`localStorage.removeItem('${STORE}')`);
  await a.evaluate(`void window.__escapeFromPalletTownGame__.scene.getScene('mapmaker').scene.restart()`);
  await sleep(600);
  const storedNames = async () =>
    ((await a.evaluate(`JSON.parse(localStorage.getItem('${STORE}') ?? '{"drafts":[]}')`)).drafts ?? [])
      .map((draft) => draft.file.name)
      .sort();

  // --- Two tabs: each saves only its own draft ------------------------------
  await a.rename('Quarry Of A');
  const b = await openTab();
  await b.front();
  await b.click('[data-new]');
  await b.rename('Harbour Of B');
  report('B starts its own map beside A\'s', JSON.stringify(await storedNames()) === JSON.stringify(['Harbour Of B', 'Quarry Of A']), JSON.stringify(await storedNames()));

  await a.front();
  await a.rename('Quarry Of A v2');
  report('A editing its map keeps B\'s', JSON.stringify(await storedNames()) === JSON.stringify(['Harbour Of B', 'Quarry Of A v2']), JSON.stringify(await storedNames()));

  await b.front();
  await b.rename('Harbour Of B v2');
  report('B editing its map keeps A\'s latest', JSON.stringify(await storedNames()) === JSON.stringify(['Harbour Of B v2', 'Quarry Of A v2']), JSON.stringify(await storedNames()));

  await b.click('[data-panel="drafts"]');
  await sleep(300);
  const listed = await b.listed();
  report('B\'s drafts list shows A\'s latest name', listed.includes('Quarry Of A v2') && !listed.includes('Quarry Of A'), JSON.stringify(listed));
  await b.shot('after-b-drafts.png');

  await a.front();
  await a.click('[data-panel="drafts"]');
  await sleep(300);
  await b.front();
  await b.click('[data-panel="map"]');
  await b.click('[data-new]');
  await b.rename('Third From B');
  await a.front();
  const followed = await a.listed();
  report('A\'s open drafts list follows B\'s new map without a reload', followed.includes('Third From B'), JSON.stringify(followed));
  report('A is still on its own map', (await a.name()) === 'Quarry Of A v2', await a.name());

  // --- A double-click on Delete ---------------------------------------------
  // Its own drafts, so the case asks only about Delete: the map open, and one
  // more beside it with a Delete button.
  await a.evaluate(`(() => {
    const scene = window.__escapeFromPalletTownGame__.scene.getScene('mapmaker');
    const file = scene.history.value;
    localStorage.setItem('${STORE}', JSON.stringify({
      current: 'draft-open',
      drafts: [
        { key: 'draft-open', file: { ...file, name: 'Open Map' }, updatedAt: Date.now() },
        { key: 'draft-work', file: { ...file, name: 'Week Of Work' }, updatedAt: Date.now() },
      ],
    }));
    void scene.scene.restart();
  })()`);
  await sleep(800);
  await a.click('[data-panel="drafts"]');
  await sleep(300);
  const victim = `[data-delete-draft="draft-work"]`;
  const before = await storedNames();
  await a.doubleClick(victim);
  const afterDouble = await storedNames();
  const armed = await a.evaluate(`document.querySelector('${victim}')?.textContent`);
  report('a double-click on Delete deletes nothing', JSON.stringify(afterDouble) === JSON.stringify(before), `${JSON.stringify(before)} -> ${JSON.stringify(afterDouble)}`);
  report('...and leaves it asking', armed === 'Sure?', `button says '${armed}'`);
  await a.shot('after-double-click.png');
  await sleep(700);
  if (await a.evaluate(`Boolean(document.querySelector('${victim}'))`)) {
    await a.click(victim);
  }
  const afterPress = await storedNames();
  report('a press of its own, after, deletes it', afterPress.length === before.length - 1, `${JSON.stringify(before)} -> ${JSON.stringify(afterPress)}`);

  const thrown = [...(await a.errors()), ...(await b.errors())];
  report('no page errors in either tab', thrown.length === 0, thrown.join('; '));
} finally {
  await browser.close();
}

process.exit(results.every(Boolean) ? 0 : 1);
