// Plays the bot check end to end, everywhere a player meets it: the FEEDBACK
// tab's SEND, a console score, and the map maker's SEND.
//
//   node tools/playtest/botCheck.mjs <url> <out-dir> [--real]
//
// The game's Supabase project is never reached: every request to it is
// answered here, in the browser, by a stand-in that records what was asked
// (`Fetch.requestPaused`), so nothing lands in production. Turnstile is a
// stand-in too, told per step whether to pass, fail or ask, so every ending
// is reached on purpose; --real leaves Cloudflare's own check in place for
// the first send and reports whatever it did (a headless browser is the kind
// of visitor it is there to doubt). It checks that:
//
// - every sign-in carries the check's token, and nothing signs in just to look
//   (a console board is read with no sign-up);
// - a check that fails keeps the message in the pack and says so, TRY AGAIN
//   passes it and sends it;
// - a check that never loads says that instead;
// - a check Turnstile has to ask about comes up over the screen, and goes;
// - a console score that could not go is kept and sent the next time;
// - the map maker says why a map did not go, and sends it once the check passes.
//
// Photographs go to <out-dir>. Exit code 1 is a broken promise.
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser, sleep } from './browser.mjs';
import { GAME, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'bot-check-shots'] = args.filter((arg) => !arg.startsWith('--'));
const real = args.includes('--real');
mkdirSync(out, { recursive: true });

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};

/** Every call the stand-in project answered, in order: `METHOD path` plus whether a token rode with a sign-up. */
const asked = [];
const fakeToken = (sub) =>
  ['{"alg":"HS256","typ":"JWT"}', JSON.stringify({ sub, role: 'authenticated', is_anonymous: true, exp: 4102444800 })]
    .map((part) => Buffer.from(part).toString('base64url'))
    .join('.') + '.c2ln';

/** What the stand-in project says to one request. */
function answer(method, path, body) {
  if (path.startsWith('/auth/v1/signup')) {
    const token = JSON.parse(body || '{}').gotrue_meta_security?.captcha_token;
    asked.push(`sign up ${token ? `with token ${token}` : 'WITHOUT A TOKEN'}`);
    if (!token) {
      return [400, { code: 400, error_code: 'captcha_failed', msg: 'captcha protection: request disallowed (no captcha response)' }];
    }
    const id = `0000000${asked.length}-0000-4000-8000-000000000000`.slice(-36);
    return [200, { access_token: fakeToken(id), token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user: { id, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {} } }];
  }
  const rpc = /\/rest\/v1\/rpc\/(\w+)/.exec(path)?.[1];
  asked.push(rpc ? `rpc ${rpc}` : `${method} ${path.split('?')[0]}`);
  switch (rpc) {
    case 'console_leaderboard':
      return [200, []];
    case 'submit_feedback':
      return [200, JSON.parse(body).tag];
    case 'submit_map':
      return [200, 'ABCDEFGHJK'];
    case 'my_submissions':
      return [200, []];
    case undefined:
      return path.startsWith('/storage/') ? [200, { Key: path, Id: 'x' }] : [404, { message: 'not in the stand-in' }];
    default:
      return [200, null];
  }
}

/** A Turnstile that does what `window.__check` says: 'pass', 'fail' or 'ask' (wait for `window.__answer()`). */
const STUB_TURNSTILE = `
  window.__check = 'pass';
  window.turnstile = {
    render(element, options) {
      const mode = window.__check;
      setTimeout(() => {
        if (mode === 'pass') options.callback('stub-token');
        else if (mode === 'fail') options['error-callback']('300030');
        else { options['before-interactive-callback'](); window.__answer = () => options.callback('asked-token'); }
      }, 150);
      return 'stub-widget';
    },
    remove() {},
  };`;

const browser = await launchBrowser({ window: { width: 1280, height: 800 } });
try {
  const page = await browser.openPage('about:blank', { project: true, ...(real ? {} : { init: STUB_TURNSTILE }) });
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*supabase.co*', requestStage: 'Request' }] });
  page.on('Fetch.requestPaused', ({ requestId, request }) => {
    const path = new URL(request.url).pathname + new URL(request.url).search;
    if (request.method === 'OPTIONS') {
      void page.send('Fetch.fulfillRequest', { requestId, responseCode: 204, responseHeaders: cors() });
      return;
    }
    const [status, json] = answer(request.method, path, request.postData ?? '');
    void page.send('Fetch.fulfillRequest', {
      requestId,
      responseCode: status,
      responseHeaders: [...cors(), { name: 'content-type', value: 'application/json' }],
      body: Buffer.from(JSON.stringify(json)).toString('base64'),
    });
  });
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await page.waitFor(sceneIs('title'), { timeoutMs: 30_000 });
  await sleep(500);
  const shot = (name) => page.screenshot(join(out, `${name}.png`));
  const clickButton = (selector) =>
    page.waitFor(`(() => { const b = document.querySelector(${JSON.stringify(selector)}); if (!b) return false; b.click(); return true; })()`, { what: selector });
  // The client keeps its session in memory as well as in storage, so it is asked to forget it.
  const signOut = () => page.evaluate(`import('/src/game/maker/supabaseClient.ts').then((m) => m.supabase()).then((db) => db.auth.signOut({ scope: 'local' })).then(() => true)`);
  const signUps = () => asked.filter((call) => call.startsWith('sign up'));

  // 1. FEEDBACK: the check fails, the message is kept and the panel says why.
  await page.evaluate(`window.__check = ${JSON.stringify(real ? 'real' : 'fail')}; true`);
  await page.tap('KeyF', 60);
  await page.waitFor(`!!document.querySelector('#feedback-text')`, { what: 'the feedback panel' });
  await page.evaluate(`(() => { const box = document.querySelector('#feedback-text'); box.value = 'bot check test from the playtest driver'; box.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await clickButton('[data-send]');
  await page.waitFor(`!!document.querySelector('.feedback-outcome')`, { what: 'the outcome', timeoutMs: real ? 130_000 : 15_000 });
  const firstHeadline = await page.evaluate(`document.querySelector('.feedback-outcome .px-heading')?.textContent ?? document.querySelector('.feedback-outcome')?.textContent`);
  await shot('1-feedback-check-failed');
  if (real) {
    console.log(`info Cloudflare's own check, headless: "${String(firstHeadline).trim()}"; the game's log says ${JSON.stringify(await page.evaluate(`import('/src/game/feedback/actionLog.ts').then((m) => m.actionLog.recent().map((line) => line.what).filter((line) => /bot check/i.test(line)))`))}; sign-ups asked: ${JSON.stringify(signUps())}`);
  } else {
    check(/Bot check jammed/.test(firstHeadline), `a check that fails says so (${String(firstHeadline).trim()})`);
    check(signUps().length === 0, 'nothing signs up without a passed check');
    check(await page.evaluate(`!!document.querySelector('[data-retry-check]')`), 'TRY AGAIN is offered');
    check(await page.evaluate(`document.activeElement?.hasAttribute('data-retry-check') === true`), 'the cursor is on TRY AGAIN');
  }

  // 2. TRY AGAIN, Turnstile asking this time: the check comes up over the panel, is answered, the message goes.
  if (!real) {
    await page.evaluate(`window.__check = 'ask'; true`);
    await clickButton('[data-retry-check]');
    await page.waitFor(`!!document.querySelector('.bot-check.is-asking')`, { what: 'the check asking' });
    const box = await page.evaluate(`(() => { const r = document.querySelector('.bot-check-card').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, text: document.querySelector('.bot-check p').textContent, z: getComputedStyle(document.querySelector('.bot-check')).zIndex }; })()`);
    await shot('2-feedback-check-asking');
    check(box.top >= 0 && box.bottom <= 800 && box.left >= 0 && box.right <= 1280 && /not a bot/.test(box.text), `the check asks in view, and says what it is (${JSON.stringify(box)})`);
    await page.evaluate(`window.__answer(); true`);
    await page.waitFor(`/Message extracted/.test(document.querySelector('.feedback-outcome')?.textContent ?? '')`, { what: 'the message sent' });
    await shot('3-feedback-sent-after-retry');
    check(await page.evaluate(`!document.querySelector('.bot-check')`), 'the check is gone once answered');
    check(signUps().join() === 'sign up with token asked-token', `the one sign-up carried the check's token (${signUps().join()})`);
    check(asked.includes('rpc submit_feedback'), 'the kept message went once the check passed');
    await clickButton('[data-close]');
    await page.waitFor(`!${GAME}.scene.isActive('feedback')`, { what: 'the panel closed' });
  }

  // 3. A check that never loads says that, and not "no signal": a page of its
  // own with no stand-in Turnstile and Cloudflare's script blocked, as a
  // blocker or a filtering network would.
  if (!real) {
    await signOut();
    const blocked = await browser.openPage('about:blank');
    try {
      await blocked.send('Network.enable');
      await blocked.send('Network.setBlockedURLs', { urls: ['*supabase.co*', '*challenges.cloudflare.com*'] });
      await blocked.send('Page.navigate', { url: `${url}?testmode=pixels` });
      await blocked.waitFor(sceneIs('title'), { timeoutMs: 30_000 });
      await sleep(500);
      await blocked.tap('KeyF', 60);
      await blocked.waitFor(`!!document.querySelector('#feedback-text')`, { what: 'the feedback panel' });
      await blocked.evaluate(`(() => { const box = document.querySelector('#feedback-text'); box.value = 'second bot check test'; box.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      await blocked.waitFor(`(() => { const b = document.querySelector('[data-send]'); if (!b) return false; b.click(); return true; })()`, { what: 'SEND' });
      await blocked.waitFor(`!!document.querySelector('.feedback-outcome')`, { what: 'the outcome' });
      const missing = await blocked.evaluate(`document.querySelector('.feedback-outcome')?.textContent ?? ''`);
      await blocked.screenshot(join(out, '4-feedback-check-missing.png'));
      check(/won't load/.test(missing) && /safe in your pack/.test(missing), 'a check that never loads says so, and that the message is kept');
      const kept = await blocked.evaluate(`new Promise((resolve) => { const open = indexedDB.open('escape-from-pallet-town.feedback'); open.onsuccess = () => { const all = open.result.transaction('outbox').objectStore('outbox').getAll(); all.onsuccess = () => resolve(all.result.map((n) => n.text)); }; })`);
      check(kept.includes('second bot check test'), `the message is in the pack (${JSON.stringify(kept)})`);
    } finally {
      await blocked.close();
    }
  }

  // 4. The console: looking signs nobody up; a score the check stopped is kept and goes next time.
  if (!real) {
    await signOut();
    asked.length = 0;
    await page.evaluate(`localStorage.setItem('escape-from-pallet-town.console.waiting', JSON.stringify([{ game: 'pallet-blocks', name: 'ASH', score: { score: 1200, lines: 10, level: 2, durationMs: 120000 }, at: 1 }])); localStorage.setItem('escape-from-pallet-town.player.name', 'ASH'); window.__check = 'fail'; true`);
    await page.evaluate(`${GAME}.scene.start('console', { pausedBase: false }); true`);
    await page.waitFor(`/still waiting/.test(document.querySelector('.console-menu .px-status-line')?.textContent ?? '')`, { what: 'the waiting line', timeoutMs: 20_000 });
    await shot('5-console-score-waiting');
    check(asked.includes('rpc console_leaderboard') && signUps().length === 0, `the board is read with no sign-up (${asked.join(', ')})`);
    await page.evaluate(`${GAME}.scene.stop('console'); window.__check = 'pass'; true`);
    await sleep(200);
    await page.evaluate(`${GAME}.scene.start('console', { pausedBase: false }); true`);
    await page.waitFor(`/on the Pallet Town board now/.test(document.querySelector('.console-menu .px-status-line')?.textContent ?? '')`, { what: 'the score sent', timeoutMs: 20_000 });
    await shot('6-console-score-sent');
    check(asked.includes('rpc submit_console_score') && signUps().join() === 'sign up with token stub-token', `the kept score went up behind the check (${asked.join(', ')})`);
    check(await page.evaluate(`localStorage.getItem('escape-from-pallet-town.console.waiting') === '[]'`), 'and is no longer waiting');
    await page.evaluate(`${GAME}.scene.stop('console'); true`);
  }

  // 5. The map maker's SEND, through the module the send panel calls.
  if (!real) {
    await signOut();
    asked.length = 0;
    const sample = readFileSync(new URL('../../src/maps/sample/sample-lane.json', import.meta.url), 'utf8');
    await page.evaluate(`window.__check = 'fail'; true`);
    const refused = await page.evaluate(`import('/src/game/maker/submissions.ts').then((m) => m.sendMap(${sample}))`);
    check(!refused.ok && /bot check did not pass/.test(refused.reason) && /safe in your drafts/.test(refused.reason), `a map the check stopped says why (${refused.reason})`);
    check(!asked.includes('rpc submit_map'), 'and was not sent');
    await page.evaluate(`window.__check = 'pass'; true`);
    const sent = await page.evaluate(`import('/src/game/maker/submissions.ts').then((m) => m.sendMap(${sample}))`);
    check(sent.ok && sent.value === 'ABCDEFGHJK', `a map goes once the check passes (${JSON.stringify(sent)})`);
    check(signUps().join() === 'sign up with token stub-token', `behind one sign-up with the token (${signUps().join()})`);
  }
} finally {
  await browser.close();
}

function cors() {
  return [
    { name: 'access-control-allow-origin', value: '*' },
    { name: 'access-control-allow-headers', value: '*' },
    { name: 'access-control-allow-methods', value: 'GET, POST, PATCH, DELETE, OPTIONS' },
  ];
}

console.log(failures.length ? `\n${failures.length} promise(s) broken` : '\nevery promise kept');
process.exit(failures.length ? 1 : 0);
