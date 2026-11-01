// Plays a new game's choice of partner on Oak's table, with real keys and a real
// pointer: `starterBalls.mjs <url> <dir> [--port=N] [--window=normal|small]`. Nothing is written until a
// YES, however the player looks, walks off or says NOT NOW. Then the swap in the
// Pokémon Center, which is still three cards on a screen: every drawn frame is
// sampled while the pointer crosses them, so a card that is the wrong shape for
// one frame fails here even though no screenshot would catch it.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { attachBrowser, launchBrowser, PIXEL_WINDOW, sleep } from './browser.mjs';

const [url, out] = process.argv.slice(2);
const port = process.argv.find((arg) => arg.startsWith('--port='))?.slice('--port='.length);
const GAME = 'window.__escapeFromPalletTownGame__';
const SAVE = `localStorage.getItem('escape-from-pallet-town.save.v1')`;
const only = process.argv.find((arg) => arg.startsWith('--window='))?.slice('--window='.length);
const WINDOWS = [
  { name: 'normal', ...PIXEL_WINDOW },
  { name: 'small', width: 640, height: 480 },
].filter((window) => !only || window.name === only);
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
const cardState = (page) =>
  page.evaluate(`({ chosen: document.querySelector('[data-starter][aria-pressed=true]')?.dataset.starter, cursor: document.activeElement?.dataset?.starter ?? null })`);

/** What the room is doing, as the player can see it. */
const lab = (page) =>
  page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return {
    room: b.room?.id ?? null,
    choosing: b.choosing,
    tile: b.currentTile,
    facing: b.facing,
    preview: b.starterPreview?.shown?.id ?? null,
    asked: b.askedBall,
    answer: b.boxQuestion?.prompt.selected ?? null,
    reading: b.dialogBox.visible,
    partner: b.partner?.name ?? null,
    balls: b.place.room?.sprites.length ?? null,
    pointer: b.game.canvas.style.cursor,
    saved: ${SAVE} !== null,
  }; })()`);

let pointer = { x: 4, y: 4 };
const moveTo = async (page, to, { steps = 12, gapMs = 8 } = {}) => {
  const from = pointer;
  for (let step = 1; step <= steps; step += 1) {
    pointer = { x: from.x + ((to.x - from.x) * step) / steps, y: from.y + ((to.y - from.y) * step) / steps };
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...pointer });
    if (gapMs) await sleep(gapMs);
  }
};
const click = async (page) => {
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...pointer, button: 'left', clickCount: 1 });
  await sleep(30);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...pointer, button: 'left', clickCount: 1 });
  await sleep(120);
};
/** The middle of a tile of the room, in page pixels. */
const tileOnPage = (page, x, y) =>
  page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); const box = b.game.canvas.getBoundingClientRect(); const zoom = box.width / b.scale.width; const cam = b.cameras.main; return { x: box.left + (${x} * 16 + 8 - cam.worldView.left) * zoom, y: box.top + (${y} * 16 + 8 - cam.worldView.top) * zoom }; })()`);
/** The answer in the box, in page pixels: the texts of a ChoicePrompt are its last two children. */
const answerOnPage = (page, index) =>
  page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); const box = b.game.canvas.getBoundingClientRect(); const zoom = box.width / b.scale.width; const prompt = b.boxQuestion.prompt; const text = prompt.list[prompt.list.length - 2 + ${index}]; return { x: box.left + (prompt.x + text.x + text.width / 2) * zoom, y: box.top + (prompt.y + text.y + text.height / 2) * zoom }; })()`);

const tap = async (page, key, settle = 260) => {
  await page.tap(key);
  await sleep(settle);
  // A loaded machine can be a step behind the clock: the question is where it ends up.
  await page.waitFor(`(() => { const b = ${GAME}.scene.getScene('base'); return !b.sys.isActive() || !b.targetTile; })()`, { timeoutMs: 15_000, what: 'the step to end' });
};
/** Walks to a tile by the room's own pointer walk, and waits for the step to end. */
const walkTo = async (page, x, y) => {
  await page.evaluate(`${GAME}.scene.getScene('base').walkThen([{ x: ${x}, y: ${y} }], null, () => undefined)`);
  await page.waitFor(`(() => { const b = ${GAME}.scene.getScene('base'); return b.walkPlan === null && !b.targetTile; })()`, { timeoutMs: 20_000, what: 'the walk' });
  await sleep(120);
};
const readThrough = async (page) => {
  for (let guard = 0; guard < 16 && (await lab(page)).reading; guard += 1) {
    await tap(page, 'Space', 160);
  }
};

const newGame = async (browser, url, window) => {
  const page = await browser.openPage(url);
  await page.send('Emulation.setDeviceMetricsOverride', { width: window.width, height: window.height, deviceScaleFactor: 1, mobile: false });
  await page.evaluate(`localStorage.clear()`);
  await page.send('Page.reload', {});
  await page.waitFor(`${GAME}?.scene.isActive('title')`, { timeoutMs: 60_000 });
  await sleep(500);
  await page.tap('Space');
  await sleep(1200);
  // Outside test mode YOUR NAME? is asked first, of a project a driver has blocked.
  await page.evaluate(`void (${GAME}.scene.isActive('title') && ${GAME}.scene.getScene('title').scene.start('starter'))`);
  await page.waitFor(`${GAME}.scene.getScene('base')?.choosing === true && ${GAME}.scene.getScene('base').ready`, { timeoutMs: 60_000, what: "Oak's table" });
  await sleep(500);
  return page;
};

const browser = port ? attachBrowser(Number(port), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
try {
  mkdirSync(out, { recursive: true });
  for (const window of WINDOWS) {
    pointer = { x: 4, y: 4 };
    // --- The keys ---------------------------------------------------------
    let page = await newGame(browser, url, window);
    let at = await lab(page);
    expectThat(at.room === 'oaks-lab' && !at.saved && at.reading, `${window.name}: a new game opens in Oak's lab with him talking and nothing written (${JSON.stringify(at)})`);
    await page.screenshot(join(out, `${window.name}-01-oak-speaks.png`));
    await readThrough(page);
    await page.screenshot(join(out, `${window.name}-02-the-table.png`));

    // Looking at a ball is a question, and the answer is free.
    await tap(page, 'ArrowUp');
    at = await lab(page);
    expectThat(at.preview === 'charmander' && !at.saved, `${window.name}: walking up to a ball shows what is in it (${JSON.stringify(at)})`);
    await page.screenshot(join(out, `${window.name}-03-faces-charmander.png`));
    await tap(page, 'ArrowLeft');
    at = await lab(page);
    expectThat(at.preview === null, `${window.name}: side on to the table is looking at nothing (${JSON.stringify(at)})`);
    await tap(page, 'ArrowUp');
    at = await lab(page);
    expectThat(at.preview === 'bulbasaur', `${window.name}: turning to the next ball shows that one (${JSON.stringify(at)})`);

    // The press that asks is never the press that answers.
    await tap(page, 'Space');
    at = await lab(page);
    expectThat(at.asked === 'bulbasaur' && at.answer === 0 && !at.saved, `${window.name}: the question opens on YES, as FireRed's does (${JSON.stringify(at)})`);
    await page.screenshot(join(out, `${window.name}-04-the-question.png`));
    await tap(page, 'ArrowRight');
    at = await lab(page);
    expectThat(at.answer === 1, `${window.name}: right goes to NOT NOW (${JSON.stringify(at)})`);
    await tap(page, 'Space');
    at = await lab(page);
    expectThat(at.asked === null && !at.saved && at.choosing, `${window.name}: NOT NOW takes nothing (${JSON.stringify(at)})`);
    await tap(page, 'Space');
    await tap(page, 'Escape');
    at = await lab(page);
    expectThat(at.asked === null && !at.saved, `${window.name}: ESC is NOT NOW (${JSON.stringify(at)})`);

    // F, and back: the FEEDBACK panel stops the room and hands it back whole.
    await tap(page, 'KeyF', 900);
    const feedback = await page.evaluate(`${GAME}.scene.isActive('feedback')`);
    if (feedback) {
      await page.screenshot(join(out, `${window.name}-05-feedback-over-the-table.png`));
      await tap(page, 'Escape', 600);
    }
    await tap(page, 'ArrowRight', 500);
    at = await lab(page);
    expectThat(feedback && at.tile.x === 9, `${window.name}: FEEDBACK opens over the table and walking carries on after it (${JSON.stringify(at)})`);

    // Nobody leaves without a partner, and nothing else opens without a game.
    await walkTo(page, 6, 11);
    await tap(page, 'ArrowDown');
    at = await lab(page);
    expectThat(at.room === 'oaks-lab' && at.reading, `${window.name}: down off the mat, Oak calls them back (${JSON.stringify(at)})`);
    await page.screenshot(join(out, `${window.name}-06-dont-go-away.png`));
    await readThrough(page);
    await tap(page, 'KeyO', 300);
    await tap(page, 'KeyT', 300);
    const opened = await page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return Boolean(b.favoursScreen || b.phrasePicker); })()`);
    expectThat(!opened, `${window.name}: the favours and the phrases wait for a game`);
    await page.close();

    // --- The pointer ------------------------------------------------------
    pointer = { x: 4, y: 4 };
    page = await newGame(browser, url, window);
    await readThrough(page);
    for (const [name, x] of [['bulbasaur', 8], ['charmander', 9], ['squirtle', 10], ['charmander', 9]]) {
      await moveTo(page, await tileOnPage(page, x, 5));
      await sleep(180);
      at = await lab(page);
      expectThat(at.preview === name && !at.asked && !at.saved && at.pointer === 'pointer', `${window.name}: pointing at ${name} previews it and chooses nothing (${JSON.stringify(at)})`);
    }
    await page.screenshot(join(out, `${window.name}-07-pointing.png`));
    // A flick to and fro, several balls inside one frame.
    const ends = [await tileOnPage(page, 8, 5), await tileOnPage(page, 10, 5)];
    for (let pass = 0; pass < 6; pass += 1) await moveTo(page, ends[pass % 2], { steps: 4, gapMs: 0 });
    await sleep(180);
    at = await lab(page);
    expectThat(!at.asked && !at.saved, `${window.name}: a flick across the balls chooses nothing (${JSON.stringify(at)})`);
    // Off the table, the picture goes and a click does nothing.
    await moveTo(page, await tileOnPage(page, 3, 6));
    await sleep(180);
    const before = await lab(page);
    await click(page);
    await sleep(300);
    at = await lab(page);
    expectThat(before.preview === null && at.tile.x === before.tile.x && at.tile.y === before.tile.y, `${window.name}: a click on the floor does nothing (${JSON.stringify(at)})`);

    // A double-click on a ball walks up and asks, and never answers.
    await moveTo(page, await tileOnPage(page, 10, 5));
    await click(page);
    await click(page);
    await page.waitFor(`${GAME}.scene.getScene('base').askedBall === 'squirtle'`, { timeoutMs: 20_000, what: 'the walk up to Squirtle' });
    await click(page);
    at = await lab(page);
    expectThat(at.asked === 'squirtle' && at.answer === 0 && !at.saved, `${window.name}: a click on a ball walks up and asks (${JSON.stringify(at)})`);
    await page.screenshot(join(out, `${window.name}-08-asked-by-mouse.png`));
    // On the way to YES the pointer crosses nothing that counts.
    await sleep(600);
    await moveTo(page, await answerOnPage(page, 0), { steps: 30, gapMs: 4 });
    at = await lab(page);
    expectThat(at.asked === 'squirtle' && !at.saved, `${window.name}: the walk to YES leaves the question standing (${JSON.stringify(at)})`);
    await click(page);
    await page.waitFor(`${SAVE} !== null && ${GAME}.scene.getScene('base').partner !== null && ${GAME}.scene.getScene('base').ready`, { timeoutMs: 30_000, what: 'the partner handed over' });
    await sleep(400);
    const saved = await page.evaluate(`JSON.parse(${SAVE}).starterSpeciesId`);
    at = await lab(page);
    expectThat(saved === 'squirtle' && at.room === 'oaks-lab' && at.reading && at.balls === 2, `${window.name}: YES saves the ball the mouse chose, in the same room, with two left (${saved}, ${JSON.stringify(at)})`);
    await page.screenshot(join(out, `${window.name}-09-received.png`));
    const firstWords = await page.evaluate(`JSON.parse(${SAVE}).raidProgress.firstWordsHeard`);
    expectThat(firstWords?.includes('lab'), `${window.name}: Oak has said what a raid is (${JSON.stringify(firstWords)})`);
    await readThrough(page);
    await page.screenshot(join(out, `${window.name}-10-with-a-partner.png`));
    await page.close();

    // --- The keys all the way, and out of the door --------------------------
    page = await newGame(browser, url, window);
    await readThrough(page);
    await tap(page, 'ArrowUp');
    await tap(page, 'Space');
    await tap(page, 'ArrowLeft');
    at = await lab(page);
    expectThat(at.answer === 0, `${window.name}: left reaches YES (${JSON.stringify(at)})`);
    await tap(page, 'Space', 800);
    await readThrough(page);
    const keyed = await page.evaluate(`JSON.parse(${SAVE}).starterSpeciesId`);
    expectThat(keyed === 'charmander', `${window.name}: YES by the keys takes the ball faced (${keyed})`);
    // Oak's last word sends them out of the door, with nothing left to do in the lab.
    await page.waitFor(`${GAME}.scene.getScene('base').ready && !${GAME}.scene.getScene('base').room`, { timeoutMs: 30_000, what: 'the harbour' });
    at = await lab(page);
    expectThat(at.room === null, `${window.name}: once Oak has said his piece they are out in the yard (${JSON.stringify(at)})`);
    await page.screenshot(join(out, `${window.name}-12-the-harbour.png`));

    // The swap in the Pokémon Center is the same three cards on another screen:
    // there the pointer moves the cursor, and only a click chooses.
    await page.evaluate(`(() => { const hub = ${GAME}.scene.getScene('base'); hub.scene.start('hub', { view: 'reselect', savedGame: new (hub.saveManager.constructor)().load() }); })()`);
    await page.waitFor(`document.querySelectorAll('[data-starter]').length === 3`, { timeoutMs: 30_000, what: 'the swap screen' });
    await sleep(400);
    const swapRest = await page.evaluate(`[...document.querySelectorAll('[data-starter]')].map((card) => { const box = card.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; })`);
    await page.evaluate(SAMPLE);
    for (const id of ['bulbasaur', 'squirtle', 'bulbasaur', 'squirtle']) {
      await moveTo(page, await cardCentre(page, id));
      await sleep(120);
      const held = await cardState(page);
      expectThat(held.cursor === id, `${window.name}, swap: pointing at ${id} moves the cursor and chooses nothing (${JSON.stringify(held)})`);
    }
    await page.screenshot(join(out, `${window.name}-13-swap-hover.png`));
    await click(page);
    const swapChosen = await cardState(page);
    expectThat(swapChosen.chosen === 'squirtle', `${window.name}, swap: clicking Squirtle chooses it (${JSON.stringify(swapChosen)})`);
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
console.log('nothing was written before a YES, and every choice landed');
