// Plays the new game's starter picker with a real pointer path and real keys:
// `starterHover.mjs <url> <dir> [--port=N]`. Every drawn frame is sampled while
// the pointer crosses the cards, so a card that is the wrong shape for one
// frame fails here even though no screenshot would catch it.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { attachBrowser, launchBrowser, PIXEL_WINDOW, sleep } from './browser.mjs';

const [url, out] = process.argv.slice(2);
const port = process.argv.find((arg) => arg.startsWith('--port='))?.slice('--port='.length);
const GAME = 'window.__escapeFromPalletTownGame__';
const WINDOWS = [
  { name: 'normal', ...PIXEL_WINDOW },
  { name: 'small', width: 640, height: 480 },
];
const failures = [];
const expectThat = (holds, what) => {
  console.log(`${holds ? 'ok  ' : 'FAIL'} ${what}`);
  if (!holds) failures.push(what);
};

const SAMPLE = `(() => {
  const state = (window.__cards = { frames: [], running: true });
  // Read after the frame, because a screen is measured in a frame callback of
  // its own and whatever ran first would see it before that: this is what was painted.
  const sample = () => {
    const cards = [...document.querySelectorAll('[data-starter]')];
    state.frames.push({
      shapes: cards.map((card) => { const box = card.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; }),
      chosen: document.querySelector('[data-starter][aria-pressed=true]')?.dataset.starter,
      cursor: document.activeElement?.dataset?.starter ?? null,
    });
  };
  const tick = () => {
    if (!state.running) return;
    setTimeout(sample, 0);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})()`;

const cardCentre = (page, id) =>
  page.evaluate(`(() => { const box = document.querySelector('[data-starter=${id}]').getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; })()`);
const state = (page) =>
  page.evaluate(`({ chosen: document.querySelector('[data-starter][aria-pressed=true]')?.dataset.starter, cursor: document.activeElement?.dataset?.starter ?? null, bar: document.querySelector('[data-confirm]')?.textContent })`);

let pointer = { x: 4, y: 4 };
const moveTo = async (page, to, { steps = 12, gapMs = 8 } = {}) => {
  const from = pointer;
  for (let step = 1; step <= steps; step += 1) {
    pointer = { x: from.x + ((to.x - from.x) * step) / steps, y: from.y + ((to.y - from.y) * step) / steps };
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...pointer });
    if (gapMs) await sleep(gapMs);
  }
};
const press = async (page) => {
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...pointer, button: 'left', clickCount: 1 });
  await sleep(30);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...pointer, button: 'left', clickCount: 1 });
  await sleep(120);
};

const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
try {
  mkdirSync(out, { recursive: true });
  for (const window of WINDOWS) {
    pointer = { x: 4, y: 4 };
    const page = await browser.openPage(url);
    await page.send('Emulation.setDeviceMetricsOverride', { width: window.width, height: window.height, deviceScaleFactor: 1, mobile: false });
    await page.evaluate(`localStorage.clear()`);
    await page.waitFor(`${GAME}?.scene.isActive('title')`, { timeoutMs: 60_000 });
    await sleep(500);
    await page.tap('Space');
    await sleep(1500);
    // Outside test mode YOUR NAME? is asked first, of a project a driver has blocked.
    await page.evaluate(`void (document.querySelector('[data-starter]') || ${GAME}.scene.getScene('title').scene.start('starter'))`);
    await page.waitFor(`document.querySelectorAll('[data-starter]').length === 3`, { timeoutMs: 60_000 });
    await sleep(400);
    await page.screenshot(join(out, `${window.name}-before.png`));
    const rest = await page.evaluate(`[...document.querySelectorAll('[data-starter]')].map((card) => { const box = card.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; })`);
    console.log(`${window.name} (${window.width}x${window.height}): cards at rest ${JSON.stringify(rest)}`);

    await page.evaluate(SAMPLE);
    // Pointing is a question: the card is ruled, its help is read, nothing is chosen.
    for (const id of ['charmander', 'squirtle', 'bulbasaur', 'squirtle', 'charmander']) {
      await moveTo(page, await cardCentre(page, id));
      await sleep(120);
      const at = await state(page);
      const hovered = await page.evaluate(`document.querySelector('[data-starter=${id}]').matches(':hover')`);
      expectThat(hovered && at.chosen === 'bulbasaur' && at.cursor === 'bulbasaur', `${window.name}: pointing at ${id} previews it and chooses nothing (${JSON.stringify(at)})`);
      await page.screenshot(join(out, `${window.name}-hover-${id}.png`));
    }
    // A fast sweep to and fro: several cards inside one frame, as a flick of the mouse is.
    const ends = [await cardCentre(page, 'bulbasaur'), await cardCentre(page, 'squirtle')];
    for (let pass = 0; pass < 6; pass += 1) await moveTo(page, ends[pass % 2], { steps: 4, gapMs: 0 });
    await sleep(200);
    const settled = await state(page);
    expectThat(settled.chosen === 'bulbasaur' && settled.cursor === 'bulbasaur', `${window.name}: a flick across the cards chooses nothing (${JSON.stringify(settled)})`);

    // The pointer's click, on a card it is on and on one it has only just reached.
    for (const id of ['charmander', 'bulbasaur', 'squirtle']) {
      await moveTo(page, await cardCentre(page, id), { steps: 3, gapMs: 0 });
      await press(page);
      const at = await state(page);
      expectThat(at.chosen === id && at.cursor === id && at.bar === `Confirm ${id[0].toUpperCase()}${id.slice(1)}`, `${window.name}: clicking ${id} chooses it (${JSON.stringify(at)})`);
      await page.screenshot(join(out, `${window.name}-chosen-${id}.png`));
    }
    const frames = await page.evaluate(`(() => { window.__cards.running = false; return window.__cards.frames; })()`);
    const offShape = frames.filter((frame) => JSON.stringify(frame.shapes) !== JSON.stringify(rest));
    console.log(`${window.name}: ${frames.length} frames sampled, ${offShape.length} off shape${offShape[0] ? `, e.g. ${JSON.stringify(offShape[0].shapes)}` : ''}`);
    expectThat(frames.length > 0 && offShape.length === 0, `${window.name}: no card changes shape on any frame`);

    // The keyboard, with the pointer left resting on a card: its resting there
    // must not take the choice back.
    await page.tap('ArrowLeft');
    await sleep(150);
    let at = await state(page);
    expectThat(at.chosen === 'charmander', `${window.name}: left from Squirtle reaches Charmander under a resting pointer (${JSON.stringify(at)})`);
    await sleep(300);
    at = await state(page);
    expectThat(at.chosen === 'charmander' && at.cursor === 'charmander', `${window.name}: and stays there (${JSON.stringify(at)})`);
    await page.tap('ArrowLeft');
    await sleep(150);
    at = await state(page);
    expectThat(at.chosen === 'bulbasaur', `${window.name}: left again reaches Bulbasaur (${JSON.stringify(at)})`);
    await page.screenshot(join(out, `${window.name}-keyboard.png`));

    // Charmander, down to CONFIRM and back up: the cursor goes back to the card
    // chosen, not the one nearest the button. Then a click on the backdrop
    // leaves the cursor where it was.
    await page.tap('ArrowRight');
    await sleep(100);
    await page.tap('ArrowDown');
    await sleep(100);
    await page.tap('ArrowUp');
    await sleep(150);
    at = await state(page);
    expectThat(at.chosen === 'charmander' && at.cursor === 'charmander', `${window.name}: up from CONFIRM returns to the card chosen (${JSON.stringify(at)})`);
    const brief = await page.evaluate(`(() => { const box = document.querySelector('.starter-brief').getBoundingClientRect(); return { x: box.x + 4, y: box.y + 2 }; })()`);
    await moveTo(page, brief);
    await press(page);
    at = await state(page);
    expectThat(at.chosen === 'charmander' && at.cursor === 'charmander', `${window.name}: a click off the cards keeps the cursor (${JSON.stringify(at)})`);
    await page.tap('ArrowLeft');
    await sleep(150);

    // And the whole way through: Bulbasaur chosen, then straight to CONFIRM
    // across Charmander's card, which must not change what is confirmed.
    await page.tap('ArrowRight');
    await sleep(100);
    await page.tap('ArrowLeft');
    await sleep(100);
    await moveTo(page, await cardCentre(page, 'bulbasaur'));
    await press(page);
    const confirm = await page.evaluate(`(() => { const box = document.querySelector('[data-confirm]').getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; })()`);
    await moveTo(page, confirm, { steps: 40, gapMs: 4 });
    at = await state(page);
    expectThat(at.chosen === 'bulbasaur' && at.bar === 'Confirm Bulbasaur', `${window.name}: the walk to CONFIRM leaves the choice alone (${JSON.stringify(at)})`);
    await press(page);
    await page.waitFor(`${GAME}.scene.isActive('base')`, { timeoutMs: 30_000, what: 'the harbour after CONFIRM' });
    const starter = await page.evaluate(`JSON.parse(localStorage.getItem('escape-from-pallet-town.save.v1')).starterSpeciesId`);
    expectThat(starter === 'bulbasaur', `${window.name}: CONFIRM saves the card the mouse chose (${starter})`);

    // The swap in the Pokemon Center is the same three cards on another screen:
    // there the pointer moves the cursor, and only a click chooses.
    await page.evaluate(`(() => { const hub = ${GAME}.scene.getScene('base'); hub.scene.start('hub', { view: 'reselect', savedGame: new (hub.saveManager.constructor)().load() }); })()`);
    await page.waitFor(`document.querySelectorAll('[data-starter]').length === 3`, { timeoutMs: 30_000, what: 'the swap screen' });
    await sleep(400);
    const swapRest = await page.evaluate(`[...document.querySelectorAll('[data-starter]')].map((card) => { const box = card.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; })`);
    await page.evaluate(SAMPLE);
    for (const id of ['charmander', 'squirtle', 'bulbasaur', 'squirtle']) {
      await moveTo(page, await cardCentre(page, id));
      await sleep(120);
      const held = await state(page);
      expectThat(held.cursor === id && held.chosen === 'bulbasaur', `${window.name}, swap: pointing at ${id} moves the cursor and chooses nothing (${JSON.stringify(held)})`);
    }
    await page.screenshot(join(out, `${window.name}-swap-hover.png`));
    await press(page);
    at = await state(page);
    expectThat(at.chosen === 'squirtle', `${window.name}, swap: clicking Squirtle chooses it (${JSON.stringify(at)})`);
    await page.tap('ArrowLeft');
    await sleep(200);
    await press(page);
    const swapFrames = await page.evaluate(`(() => { window.__cards.running = false; return window.__cards.frames; })()`);
    const swapOff = swapFrames.filter((frame) => JSON.stringify(frame.shapes) !== JSON.stringify(swapRest));
    console.log(`${window.name}, swap: ${swapFrames.length} frames sampled, ${swapOff.length} off shape${swapOff[0] ? `, e.g. ${JSON.stringify(swapOff[0].shapes)}` : ''}`);
    expectThat(swapFrames.length > 0 && swapOff.length === 0, `${window.name}, swap: no card changes shape on any frame`);
    await page.close();
  }
} finally {
  await browser.close();
}
if (failures.length > 0) {
  console.error(`${failures.length} failed`);
  process.exit(1);
}
console.log('every card kept its shape and every choice landed');
