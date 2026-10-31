// The favours list (`src/game/hub/favourList.ts`), played the way a player
// meets it: the yard names [O] FAVOURS until it has been used, O opens every
// favour on one quiet screen over a harbour that stands still, the arrows read
// it, and O or ESC puts it away. Photographs it for a new save and for one with
// favours in every state, and fails loudly when a beat is not what it promises.
//
//   node tools/playtest/favourList.mjs <url> <out dir> [--window=1200x768] [--port=N]
//
// `--port` drives a browser already running on that CDP port (`attachBrowser`).
import { mkdirSync } from 'node:fs';
import { attachBrowser, launchBrowser, sleep } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [width, height] = (option('window') ?? '1200x768').split('x').map(Number);
mkdirSync(out, { recursive: true });

const page_url = `${url}?testmode=pixels`;
/** How long a cold page or one step may take on a loaded machine, whose watchdog can pause a browser ten seconds at a time. */
const SLOW_MS = 60_000;
const base = `${GAME}.scene.getScene('base')`;
const port = option('port');
const browser = port ? attachBrowser(Number(port), { window: { width, height } }) : await launchBrowser({ window: { width, height } });
const page = await browser.openPage(page_url);
try {
  const press = async (code, wait = 300) => {
    await page.tap(code);
    await sleep(wait);
  };
  const listUp = () => page.evaluate(`Boolean(document.querySelector('.favour-menu'))`);
  const listText = () => page.evaluate(`(document.querySelector('.favour-menu')?.innerText ?? '').replace(/\\s+/g, ' ').trim()`);
  const hint = () => page.evaluate(`${base}.hintShown ?? ''`);
  const expect = (ok, what) => {
    if (!ok) throw new Error(what);
    console.log(`ok: ${what}`);
  };
  const reopen = async () => {
    await page.send('Page.navigate', { url: page_url });
    await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
    await press('Space');
    await page.waitFor(sceneIs('base'), { timeoutMs: SLOW_MS });
    await sleep(1500);
  };

  // A new game.
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await page.evaluate(`localStorage.removeItem('${SAVE_KEY}')`);
  await page.send('Page.navigate', { url: page_url });
  await page.waitFor(sceneIs('title'), { timeoutMs: SLOW_MS });
  await press('Space');
  await page.waitFor(sceneIs('base'));
  await page.waitFor(
    `window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`,
  );
  await page.waitFor(sceneIs('base'), { timeoutMs: SLOW_MS });
  await sleep(1500);
  expect((await hint()).includes('[O] FAVOURS'), `the yard names the key: "${await hint()}"`);

  // O: every favour a new save can be asked, by who asks it and where they are.
  await press('KeyO', 800);
  expect(await listUp(), 'O opens the favours list');
  const fresh = await listText();
  // Names are drawn in capitals, so the page's text is too.
  expect(/SOMEBODY WANTS A WORD/i.test(fresh) && /WARDEN FENWICK/i.test(fresh) && fresh.includes('THE COVE'), `it says who wants a word and where: ${fresh.slice(0, 200)}`);
  expect(!/GOLD TEETH/i.test(fresh), 'it never names a favour nobody has asked yet');
  await page.screenshot(`${out}/1-new-save.png`);
  await press('ArrowDown');
  await press('ArrowDown');
  await page.screenshot(`${out}/2-new-save-down.png`);
  await press('KeyO', 600);
  expect(!(await listUp()), 'O puts it away');
  expect(!(await hint()).includes('[O] FAVOURS'), 'and the yard stops naming the key once it has been used');

  // A save with a favour in every state.
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.raidProgress.errands = [
      { id: 'oaks-parcel', status: 'started', found: 0, lossesHeard: 0 },
      { id: 'medicine-bag', status: 'started', found: 1, lossesHeard: 1 },
      { id: 'brocks-crate', status: 'completed', found: 1, lossesHeard: 1 },
      { id: 'ships-log', status: 'started', found: 0, lossesHeard: 0 },
    ];
    save.stash.items['medicine-bag'] = 1;
    save.stash.items['tm39-rock-tomb'] = 1;
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await reopen();
  await press('KeyO', 800);
  const full = await listText();
  const headings = await page.evaluate(`[...document.querySelectorAll('.favour-menu .px-subheading')].map((h) => h.innerText.trim().toUpperCase())`);
  expect(
    JSON.stringify(headings) === JSON.stringify(['TO HAND OVER', 'IN HAND', 'SOMEBODY WANTS A WORD', 'DONE']),
    `the groups come in order: ${headings.join(', ')}`,
  );
  expect(full.includes('In MILLBROOK, Greystone Vale. 2 squares of your pack.'), 'a favour in hand says where it lies and its squares');
  expect(full.includes('Home. Speak to Nurse Joy'), 'a thing home says who to take it to');
  await page.screenshot(`${out}/3-every-state.png`);
  // Down from the bag to the first favour in hand: the list stands in columns.
  await press('ArrowDown');
  const pane = await page.evaluate(`[...document.querySelectorAll('.favour-menu [data-shown-by]')].find((p) => !p.hidden)?.innerText.replace(/\\s+/g, ' ').trim() ?? ''`);
  expect(pane.includes('Lost with the pack if you wipe.'), `the pane under the list says the whole of the row the cursor is on: ${pane}`);
  await page.screenshot(`${out}/4-in-hand-detail.png`);
  await press('Escape', 600);
  expect(!(await listUp()) && (await page.evaluate(sceneIs('base'))), 'ESC puts it away, back in the yard');
} finally {
  await page.close();
  await browser.close();
}
