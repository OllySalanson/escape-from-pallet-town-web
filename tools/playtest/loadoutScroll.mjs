// Whether the loadout's item list keeps its place when something is packed.
//
//   node tools/playtest/loadoutScroll.mjs http://localhost:5173/
//
// The captain's report (2026-10-29): "after I add something to my pack it just
// snaps back to the top of the list". A save with a long stash, the list
// scrolled down, one item packed by its plus and one taken out by its minus;
// the list's scroll and the focused row must be where they were.
import { PIXEL_WINDOW, launchBrowser, sleep } from './browser.mjs';
import { SAVE_KEY, sceneIs, takePokemon, walkIntoBase } from './deploy.mjs';

const [base] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const url = new URL(base);
url.searchParams.set('testmode', '1');
const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? '  ok  ' : '  NO  '}${what}`);
  if (!ok) failures.push(what);
};

const browser = await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url: url.href });
  const until = async (expression, what = expression) => {
    for (let guard = 0; guard < 300; guard += 1) {
      if (await page.evaluate(expression)) return;
      await sleep(100);
    }
    throw new Error(`never saw ${what}`);
  };
  const press = async (code) => {
    await page.keyDown(code);
    await sleep(50);
    await page.keyUp(code);
    await sleep(140);
  };
  await until(sceneIs('title'), 'the title screen');
  await press('Space');
  await until(sceneIs('starter'), 'the starter picker');
  await until(`(() => { const b = document.querySelector('button[data-starter="bulbasaur"]'); if (!b) return false; b.click(); return true; })()`);
  await until(`(() => { const b = [...document.querySelectorAll('button')].find((b) => /confirm bulbasaur/i.test(b.innerText)); if (!b) return false; b.click(); return true; })()`);
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the save');
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.stash.items = { ...save.stash.items, potion: 6, 'super-potion': 4, 'poke-ball': 6, 'great-ball': 3, 'oran-berry': 2, 'sitrus-berry': 2, 'pecha-berry': 2,
      antidote: 3, 'cheri-berry': 2, 'rawst-berry': 2, 'chesto-berry': 2, 'aspear-berry': 2, pickaxe: 1, lockpick: 1, 'tm40-aerial-ace': 1 };
    save.raidProgress.firstWordsHeard = ['lab', 'loadout', 'dropin', 'check', 'center'];
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url: url.href });
  await until(sceneIs('title'), 'the title again');
  await press('Space');
  await until(sceneIs('base'), 'the base');
  await walkIntoBase(page, 'raid-arena', { press, until });
  await until(takePokemon('Bulbasaur'), 'Bulbasaur in the party');
  await sleep(400);

  const pluses = `[...document.querySelectorAll('button[data-count-kind="item"][data-count-dir="1"]')]`;
  const state = `(() => { const b = ${pluses}.at(-1); let p = b?.parentElement; while (p && !(p.scrollHeight > p.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
    const a = document.activeElement; return JSON.stringify({ top: p ? Math.round(p.scrollTop) : null, max: p ? p.scrollHeight - p.clientHeight : null, focus: a?.dataset?.countId ? a.dataset.countId + ':' + a.dataset.countDir : a?.tagName, n: ${pluses}.length }); })()`;
  console.log('rows', await page.evaluate(state));
  // Scroll to the foot and put the cursor on the last row's plus, as a player would.
  await page.evaluate(`(() => { const b = ${pluses}.filter((b) => b.getAttribute('aria-disabled') !== 'true').at(-1); b.focus(); b.scrollIntoView({ block: 'center' }); })()`);
  await sleep(300);
  const before = JSON.parse(await page.evaluate(state));
  console.log('before', before);
  // The captain packs with the mouse: a real press and release on the plus.
  const box = JSON.parse(await page.evaluate(`JSON.stringify((() => { const r = document.activeElement.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })())`));
  const mouse = async (type, button = 'left') => page.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button, clickCount: 1 });
  await mouse('mouseMoved');
  await mouse('mousePressed');
  await mouse('mouseReleased');
  await sleep(500);
  const afterAdd = JSON.parse(await page.evaluate(state));
  console.log('after add', afterAdd);
  check(before.top > 0, 'the list was scrolled down before packing');
  check(afterAdd.top === before.top, 'packing kept the list where it was');
  check(afterAdd.focus === before.focus, 'packing kept the cursor on the row');
  // Every row, from the foot up, by the mouse.
  const ids = JSON.parse(await page.evaluate(`JSON.stringify(${pluses}.map((b) => b.dataset.countId))`));
  for (const id of ids.reverse()) {
    const sel = `button[data-count-kind="item"][data-count-id="${id}"][data-count-dir="1"]`;
    await page.evaluate(`document.querySelector('${sel}').scrollIntoView({ block: 'nearest' })`);
    await sleep(150);
    const at = JSON.parse(await page.evaluate(`JSON.stringify((() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })())`));
    const was = JSON.parse(await page.evaluate(state));
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await page.send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
    }
    await sleep(400);
    const now = JSON.parse(await page.evaluate(state));
    check(Math.abs(now.top - was.top) <= 16 && now.focus === `${id}:1`, `${id}: ${was.top}/${was.max} -> ${now.top}/${now.max}, focus ${now.focus}`);
  }
  const minusId = before.focus.split(':')[0];
  await page.evaluate(`document.querySelector('button[data-count-kind="item"][data-count-id="${minusId}"][data-count-dir="-1"]').focus()`);
  await sleep(200);
  const beforeTake = JSON.parse(await page.evaluate(state));
  await press('Enter');
  await sleep(500);
  const afterTake = JSON.parse(await page.evaluate(state));
  console.log('after take', afterTake);
  check(afterTake.top === beforeTake.top, 'taking out kept the list where it was');
  await page.screenshot(`${process.env.SHOT ?? '/dev/null'}`).catch(() => undefined);
} finally {
  await browser.close();
}
if (failures.length) {
  console.log(`\n${failures.length} failed`);
  process.exit(1);
}
