// Plays the FEEDBACK tab end to end, the way a player meets it.
//
//   node tools/playtest/feedbackShots.mjs <url> <out-dir> [--width=1280 --height=800]
//
// On the title: the tab is there and F opens the panel. In a raid: F opens it,
// the raid clock stops while it is up, typing W, A, S, D and F into the box
// writes letters and walks nobody, Escape with words in the box asks before
// scrapping them, SEND keeps the message in the browser's pack and answers with
// a tag, and closing gives the raid back exactly where it was. Then TALK, on
// Chromium's fake microphone: one press records until the next, TALK MORE adds
// a second clip, SEND while the tape runs stops it and sends both, and a
// refused microphone says so and leaves typing. It photographs each step into
// <out-dir>. Exit code 1 is a broken promise.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, deploy, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'feedback-shots'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name, fallback) => Number(args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const window = { width: option('width', 1280), height: option('height', 800) };
mkdirSync(out, { recursive: true });

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

/** A key that types: CDP only inserts text into a field when the event carries it. */
async function type(page, text) {
  for (const character of text) {
    const upper = character.toUpperCase();
    const code = /[a-z]/i.test(character) ? `Key${upper}` : character === ' ' ? 'Space' : 'Period';
    const description = { code, key: character, text: character, windowsVirtualKeyCode: upper.charCodeAt(0) };
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...description });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...description });
    await sleep(30);
  }
}

// A fake microphone that is always allowed: Chromium plays a beep into it.
const browser = await launchBrowser({ window, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const press = async (code) => { await page.tap(code, 60); await sleep(150); };
  const until = (expression, what) => page.waitFor(expression, { what });
  const click = async (label) => {
    await until(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)})); if (!b) return false; b.click(); return true; })()`,
      `a button labelled ${label}`,
    );
    await sleep(250);
  };
  const panelUp = `${GAME}.scene.isActive('feedback') && !!document.querySelector('.feedback-panel')`;

  await page.waitFor(sceneIs('title'));
  await sleep(600);
  const tab = await page.evaluate(`(() => { const t = document.querySelector('.feedback-tab'); if (!t) return null; const r = t.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, hidden: t.hidden }; })()`);
  // A phone held upright has no room beside the game, so there it stands under it.
  const upright = window.width <= 600 && window.height > window.width;
  check(
    tab && !tab.hidden && (upright ? Math.round(tab.bottom) === window.height : Math.round(tab.right) === window.width),
    `the tab stands on the ${upright ? 'bottom' : 'right'} edge of the window (${JSON.stringify(tab)})`,
  );
  await page.screenshot(join(out, '1-title-tab.png'));

  await press('KeyF');
  await until(panelUp, 'F to open the panel on the title');
  check(await page.evaluate(`${GAME}.scene.isPaused('title')`), 'the title is paused under the panel');
  await press('Escape');
  await until(`!(${panelUp})`, 'Escape on an empty panel to close it');
  check(await page.evaluate(`${GAME}.scene.isActive('title')`), 'the title runs again after the panel closes');

  await deploy(page, url.includes('?') ? url : `${url}?testmode=pixels`, { press, click, until });
  // Whatever the raid opens on is read before anything else.
  for (let guard = 0; guard < 8 && (await page.evaluate(`${GAME}.scene.getScene('world').dialogBox?.visible`)); guard += 1) {
    await press('Space');
    await sleep(250);
  }
  await sleep(500);
  const clock = () => page.evaluate(`${GAME}.scene.getScene('world').runSession?.manager.snapshot().remainingMs`);
  const tile = () => page.evaluate(`JSON.stringify(${GAME}.scene.getScene('world').currentTile)`);

  await press('KeyF');
  await until(panelUp, 'F to open the panel in a raid');
  await until(`!!document.querySelector('.feedback-thumb')`, 'the picture of the moment').catch(() => check(false, 'a picture was attached'));
  const before = { clock: await clock(), tile: await tile() };
  check(await page.evaluate(`${GAME}.scene.isPaused('world')`), 'the raid is paused under the panel');
  check(await page.evaluate(`document.activeElement?.id === 'feedback-text'`), 'the cursor starts in the box');
  await type(page, 'wasd f stuck by the bench');
  await sleep(1500);
  const typed = await page.evaluate(`document.querySelector('#feedback-text').value`);
  check(typed === 'wasd f stuck by the bench', `the box took every letter (${JSON.stringify(typed)})`);
  check((await tile()) === before.tile, 'typing W, A, S, D walked nobody');
  check((await clock()) === before.clock, `the raid clock did not move while the panel was up (${before.clock})`);
  check(await page.evaluate(`document.querySelector('[data-count]').textContent === '25 / 2,000'`), 'the count follows the box');
  await page.screenshot(join(out, '2-raid-panel.png'));

  await click('Game version');
  await page.screenshot(join(out, '3-see-it-all.png'));
  check(await page.evaluate(`!document.querySelector('[data-all]').hidden && document.querySelector('[data-all]').textContent.includes('Walked into')`), 'SEE IT ALL lists where they are and the last moves');
  await click('Game version');

  await press('Escape');
  await until(`!!document.querySelector('[data-keep]')`, 'Escape with words in the box to ask first');
  check(await page.evaluate(`document.activeElement?.hasAttribute('data-keep')`), 'the cursor rests on KEEP WRITING');
  await page.screenshot(join(out, '4-scrap-question.png'));
  await press('Escape');
  await until(`!!document.querySelector('[data-send]') && document.activeElement?.id === 'feedback-text'`, 'Escape again to go back to writing');
  check(await page.evaluate(`document.querySelector('#feedback-text').value`) === typed, 'the words survived the question');

  await click('Send');
  await until(`!!document.querySelector('.feedback-tag')`, 'SEND to answer with a tag');
  const tag = await page.evaluate(`document.querySelector('.feedback-tag').textContent`);
  check(/^FB-[A-Z2-9]{4}$/.test(tag), `the answer carries a tag (${tag})`);
  await page.screenshot(join(out, '5-sent.png'));
  const kept = await page.evaluate(`new Promise((resolve) => { const open = indexedDB.open('escape-from-pallet-town.feedback'); open.onsuccess = () => { const all = open.result.transaction('outbox').objectStore('outbox').getAll(); all.onsuccess = () => resolve(JSON.stringify(all.result.map((n) => ({ tag: n.tag, text: n.text, screen: n.context.screen, details: n.context.details, actions: n.actions.length, picture: n.picture ? n.picture.size : 0, save: n.save ? n.save.length : 0 })))); }; })`);
  console.log(`kept in the pack: ${kept}`);
  const notes = JSON.parse(kept);
  check(notes.length === 1 && notes[0].tag === tag && notes[0].text === typed && notes[0].screen === 'Raid' && notes[0].picture > 0 && notes[0].save > 0, 'the message is in the pack with its picture, its save and where it was sent from');

  await press('Enter');
  await until(`!(${panelUp})`, 'BACK TO THE GAME to close the panel');
  check(!(await page.evaluate(`${GAME}.scene.isPaused('world')`)), 'the raid runs again');
  check(await page.evaluate(`!document.querySelector('.feedback-tab').hidden`), 'the tab is back');
  await sleep(1200);
  check((await clock()) < before.clock, 'the raid clock runs again');

  // Over a screen that has already paused the raid, closing gives back that
  // screen and leaves the raid paused under it.
  await press('KeyB');
  await until(sceneIs('bag'), 'B to open the raid pack');
  await press('KeyF');
  await until(panelUp, 'F to open the panel over the pack');
  check(await page.evaluate(`document.querySelector('[data-all]') && [...document.querySelectorAll('.feedback-line')].some((b) => b.textContent.includes('Raid pack'))`), 'the panel says it was opened over the raid pack');
  await page.screenshot(join(out, '6-over-the-pack.png'));
  await press('Escape');
  await until(`!(${panelUp})`, 'Escape to close it again');
  check(await page.evaluate(`${GAME}.scene.isActive('bag') && ${GAME}.scene.isPaused('world')`), 'the pack is back and the raid is still paused under it');
  await press('Escape');
  await until(`!${GAME}.scene.isActive('bag')`, 'Escape to close the pack');

  // TALK: press once, and it records until the next press.
  await press('KeyF');
  await until(panelUp, 'F to open the panel for a voice message');
  await page.screenshot(join(out, '7-talk.png'));
  // By the keyboard, which is a real press: TAB from the box lands on TALK.
  await press('Tab');
  check(await page.evaluate(`document.activeElement?.hasAttribute('data-talk')`), 'TAB from the box lands on TALK');
  await press('Enter');
  await until(`!!document.querySelector('.feedback-voice.is-recording')`, 'TALK to start the tape');
  // Chromium's fake microphone beeps once a second, so the meter is sampled
  // across a second or two rather than once: it should rise on a beep.
  let loudest = 2;
  for (let sample = 0; sample < 26; sample += 1) {
    await sleep(100);
    const levels = await page.evaluate(`[...document.querySelectorAll('[data-meter] i')].map((bar) => Number(bar.style.getPropertyValue('--level')) || 2)`);
    loudest = Math.max(loudest, ...levels);
  }
  const time = await page.evaluate(`document.querySelector('[data-voice-time]').textContent`);
  check(/^0:0[2-4]$/.test(time), `the tape counts while it records (${time})`);
  check(loudest > 2, `the meter moves with the voice (tallest bar ${loudest})`);
  await page.screenshot(join(out, '8-on-air.png'));
  await click('Stop');
  await until(`!!document.querySelector('[data-play]')`, 'STOP to keep the clip and offer PLAY');
  check(await page.evaluate(`!document.querySelector('.feedback-voice.is-recording') && document.querySelector('[data-talk]').textContent === 'Talk more'`), 'after a stop the button offers TALK MORE');
  await page.screenshot(join(out, '9-recorded.png'));
  await click('Talk more');
  await until(`!!document.querySelector('.feedback-voice.is-recording')`, 'TALK MORE to record a second clip');
  await sleep(1200);
  // SEND while the tape runs stops it and sends what was said.
  await click('Send');
  await until(`!!document.querySelector('.feedback-tag')`, 'SEND over a running tape to send it');
  const voiced = JSON.parse(await page.evaluate(`new Promise((resolve) => { const open = indexedDB.open('escape-from-pallet-town.feedback'); open.onsuccess = () => { const all = open.result.transaction('outbox').objectStore('outbox').getAll(); all.onsuccess = () => resolve(JSON.stringify(all.result.map((n) => ({ text: n.text, clips: (n.voice ?? []).map((c) => ({ size: c.size, type: c.type })), voiceMs: n.voiceMs })))); }; })`));
  const spoken = voiced.find((note) => note.text === '');
  console.log(`voice message: ${JSON.stringify(spoken)}`);
  check(spoken && spoken.clips.length === 2 && spoken.clips.every((clip) => clip.size > 1000 && clip.type.startsWith('audio/')) && spoken.voiceMs >= 3500, 'a voice-only message is kept with both clips');
  await press('Enter');
  await until(`!(${panelUp})`, 'BACK TO THE GAME after the voice message');

  // A refused microphone leaves typing, and says so in the raid's voice.
  await page.evaluate(`navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))`);
  await press('KeyF');
  await until(panelUp, 'F to open the panel once more');
  await click('Talk');
  await until(`document.querySelector('.px-status-line')?.textContent.startsWith('No mic, no problem')`, 'a refused microphone to be answered');
  check(await page.evaluate(`!document.querySelector('.feedback-voice.is-recording')`), 'a refused microphone records nothing');
  await page.screenshot(join(out, '10-mic-refused.png'));
  await press('Escape');
} finally {
  await browser.close();
}
if (failures.length) {
  console.log(`\n${failures.length} failed`);
  process.exit(1);
}
