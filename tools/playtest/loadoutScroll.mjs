// Whether the loadout's item list keeps its place when something is packed.
//
//   node tools/playtest/loadoutScroll.mjs http://localhost:5173/
//
// The captain's report (2026-10-29): "after I add something to my pack it just
// snaps back to the top of the list". A save with a long stash, the list
// scrolled down, one item packed by its plus and one taken out by its minus;
// the list's scroll and the focused row must be where they were. Then a
// right-click on a packed piece and DEL on one, each taking one out with no
// browser menu and the list left where it was.
import { PIXEL_WINDOW, launchBrowser, sleep } from './browser.mjs';
import { SAVE_KEY, sceneIs, takePokemon, walkIntoBase, openHallPanel } from './deploy.mjs';

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
  await until(sceneIs('base'), 'the starter picker');
  await until(`window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`);
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the save');
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    save.stash.items = { ...save.stash.items, potion: 6, 'super-potion': 4, 'poke-ball': 6, 'great-ball': 3, 'oran-berry': 2, 'sitrus-berry': 2, 'pecha-berry': 2,
      antidote: 3, 'cheri-berry': 2, 'rawst-berry': 2, 'chesto-berry': 2, 'aspear-berry': 2, pickaxe: 1, lockpick: 1, 'tm40-aerial-ace': 1 };
    save.raidProgress.firstWordsHeard = ['lab', 'loadout', 'check', 'center'];
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url: url.href });
  await until(sceneIs('title'), 'the title again');
  await press('Space');
  await until(sceneIs('base'), 'the base');
  await walkIntoBase(page, 'raid-arena', { press, until });
  await until(takePokemon('Bulbasaur'), 'Bulbasaur in the party');
  await openHallPanel(page, 'rack', { press, until });
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
  // A right-click on a packed piece takes one out, with no browser menu, and
  // the list stays where it was; DEL on the focused piece does the same.
  const pieceSel = `[data-grid="pack"] [data-grid-piece^="item:0:poke-ball"]`;
  const packedBalls = () => page.evaluate(`Number(document.querySelector('[data-count-kind="item"][data-count-id="poke-ball"]')?.closest('.px-count')?.dataset.countValue ?? -1)`);
  for (let i = 0; i < 3; i += 1) {
    await page.evaluate(`document.querySelector('button[data-count-kind="item"][data-count-id="poke-ball"][data-count-dir="1"]').click()`);
    await sleep(200);
  }
  const balls = await packedBalls();
  const listTop = JSON.parse(await page.evaluate(state)).top;
  const piece = JSON.parse(await page.evaluate(`JSON.stringify((() => { const r = document.querySelector('${pieceSel}').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })())`));
  await page.evaluate(`window.__menus = 0; document.addEventListener('contextmenu', (e) => { if (!e.defaultPrevented) window.__menus += 1; });`);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
    await page.send('Input.dispatchMouseEvent', { type, x: piece.x, y: piece.y, button: 'right', buttons: type === 'mousePressed' ? 2 : 0, clickCount: 1 });
  }
  await sleep(500);
  check((await packedBalls()) === balls - 1, `a right-click took one Poké Ball out (${balls} -> ${await packedBalls()})`);
  check((await page.evaluate('window.__menus')) === 0, 'no browser menu over the pack');
  const afterRight = JSON.parse(await page.evaluate(state));
  check(afterRight.top === listTop, `the list kept its place (${listTop} -> ${afterRight.top}/${afterRight.max}, focus ${afterRight.focus})`);
  check((await page.evaluate(`document.body.innerText.includes('RIGHT-CLICK or DEL')`)) || (await page.evaluate(`[...document.querySelectorAll('[data-help]')].some((b) => b.dataset.help.includes('RIGHT-CLICK or DEL'))`)), 'the help line says so');
  await page.evaluate(`document.querySelector('${pieceSel}')?.focus()`);
  const beforeDel = await packedBalls();
  await press('Delete');
  await sleep(400);
  check((await packedBalls()) === beforeDel - 1, `DEL took one out (${beforeDel} -> ${await packedBalls()})`);
  // Resting the pointer on a stash row, then on a pack square, says what the
  // item does after well under a second; moving off takes it away.
  const tipText = () => page.evaluate(`document.querySelector('.px-tip')?.innerText ?? ''`);
  for (const [what, sel] of [['a stash row', '[data-describes="item:great-ball"].px-row strong'], ['a pack square', '[data-grid="pack"] [data-describes="item:potion"]']]) {
    const at = JSON.parse(await page.evaluate(`JSON.stringify((() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: r.top, bottom: r.bottom }; })())`));
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
    await sleep(300);
    check((await tipText()) === '', `${what}: nothing yet after 0.3s`);
    await sleep(700);
    const text = await tipText();
    check(/\w/.test(text), `${what}: says what it does ("${text.replace(/\n/g, ' / ')}")`);
    const tip = JSON.parse(await page.evaluate(`JSON.stringify((() => { const r = document.querySelector('.px-tip').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; })())`));
    check(tip.top >= at.bottom || tip.bottom <= at.top, `${what}: the box does not cover it`);
    check(tip.left >= 0 && tip.right <= (await page.evaluate('innerWidth')), `${what}: the box is on screen`);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
    await sleep(100);
    check((await tipText()) === '', `${what}: gone once the pointer moves off`);
  }
  // The keyboard's twin: the cursor resting on a row shows the same box.
  await page.evaluate(`document.querySelector('button[data-count-kind="item"][data-count-id="great-ball"][data-count-dir="1"]').focus()`);
  await press('ArrowUp');
  await sleep(1000);
  check(/\w/.test(await tipText()), `the cursor resting on a row says what it does too ("${(await tipText()).replace(/\n/g, ' / ')}")`);
  if (process.env.TIPSHOT) {
    const at = JSON.parse(await page.evaluate(`JSON.stringify((() => { const r = document.querySelector('[data-grid="pack"] [data-describes="item:potion"]').getBoundingClientRect(); return { x: r.x + 8, y: r.y + 8 }; })())`));
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x, y: at.y });
    await sleep(1000);
    await page.screenshot(process.env.TIPSHOT);
  }
  await page.screenshot(`${process.env.SHOT ?? '/dev/null'}`).catch(() => undefined);
} finally {
  await browser.close();
}
if (failures.length) {
  console.log(`\n${failures.length} failed`);
  process.exit(1);
}
