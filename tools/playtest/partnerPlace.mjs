// The partner's own place (the captain's call of 11 Nov 2026, option B), played
// where the hunt of that day found the fault: a Charmander that has just become
// a Charmeleon, a level-6 Rattata beside it, no locker built. The hunt saw the
// container take the Rattata, the rim say "Charmeleon (your partner): lost for
// good", and a raid lost to the clock delete the partner. On stepped frames
// against a test-mode build (`tools/playtest/README.md`).
//
//   node tools/playtest/partnerPlace.mjs <url> <out-dir> [--port=N]
//
// Prints one PASS or FAIL per check, as the fix means it to come out, and leaves
// a picture of the locker, the rim, the raid's pack and the result. Exit code 1
// is a FAIL.
import { mkdirSync } from 'node:fs';
import { PIXEL_WINDOW, attachBrowser, launchBrowser } from './browser.mjs';
import { GAME, SAVE_KEY, jumpIn, openHallPanel, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'partner-place-shots'] = args.filter((arg) => !arg.startsWith('--'));
mkdirSync(out, { recursive: true });
const FRAME_MS = 1000 / 60;
const browser = option('port') ? attachBrowser(Number(option('port')), { window: PIXEL_WINDOW }) : await launchBrowser({ window: PIXEL_WINDOW });
let failed = false;
const check = (name, ok, detail = '') => {
  failed ||= !ok;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
};

try {
  const page = await browser.openPage('about:blank');
  const step = (n = 6) => page.evaluate(`${GAME}.stepFrames(${n}, ${FRAME_MS})`);
  const until = async (expression, what = expression) => {
    for (let guard = 0; guard < 1500; guard += 1) {
      if (await page.evaluate(expression)) return;
      await step(6);
    }
    throw new Error(`never saw ${what}`);
  };
  const wait = (ms) => step(Math.max(1, Math.round(ms / FRAME_MS)));
  const press = async (code) => {
    await page.tap(code, 0);
    await step(4);
    await wait(120);
  };
  const shot = (name) => page.screenshot(`${out}/${name}.png`);
  const base = `${GAME}.scene.getScene('base')`;
  const world = `${GAME}.scene.getScene('world')`;
  const text = (selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)})?.innerText.replace(/\\s+/g, ' ') ?? ''`);
  const saved = () => page.evaluate(`JSON.parse(localStorage.getItem('${SAVE_KEY}'))`);

  // A new game with a Charmander, which is then made a level-16 Charmeleon with
  // a level-6 Rattata beside it, and back in through CONTINUE.
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 120000 });
  await page.evaluate(`localStorage.clear()`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 120000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space');
  await until(sceneIs('base'), 'the base');
  await until(`${base}.takeStarterForDriver?.('charmander') === true`, 'the table');
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the save');
  await until(`${base}.ready && !${base}.room`, 'the yard');
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const partner = save.stash.pokemon.find((stored) => stored.id === save.stash.partnerId);
    // Level 16 on the medium-slow curve is 2,535 experience: the step Charmander evolves on.
    Object.assign(partner.pokemon, { speciesId: 'charmeleon', level: 16, xp: 2535, currentHp: 40 });
    save.stash.pokemon.push({ id: 'rattata-1', pokemon: { speciesId: 'rattata', level: 6, currentHp: 17, xp: 216, moves: ['Tackle', 'Tail Whip'], primaryStatus: null } });
    save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 2, extracted: 2, wiped: 0 } };
    save.raidProgress.benchRaids = 9;
    save.raidProgress.arenaIntroSeen = true;
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { what: 'the title', timeoutMs: 120000 });
  await page.evaluate(`${GAME}.pauseLoop()`);
  await press('Space');
  await until(`${sceneIs('base')} && ${base}.ready`, 'the base again');
  const partnerId = (await saved()).stash.partnerId;

  await walkIntoBase(page, 'raid-arena', { press, until, wait });
  // Both on the bench, as the hunt had them.
  await until(`${base}.kit?.flow !== undefined`, 'the hall kit');
  await page.evaluate(`(() => { const flow = ${base}.kit.flow; for (const id of [${JSON.stringify(partnerId)}, 'rattata-1']) if (!flow.includesPokemon(id)) flow.togglePokemon(id); })()`);

  await openHallPanel(page, 'locker', { press, until, wait });
  await wait(300);
  await shot('locker');
  const partnerRow = await text('[data-partner-place]');
  const securedRows = await page.evaluate(`[...document.querySelectorAll('[data-secure-pokemon].is-secured')].map((row) => row.innerText.replace(/\\s+/g, ' '))`);
  check('the locker shows the partner in its own place', /CHARMELEON/i.test(partnerRow) && /PARTNER/.test(partnerRow), partnerRow);
  check('the container holds the Rattata, not the partner', securedRows.length === 1 && /RATTATA/i.test(securedRows[0]), JSON.stringify(securedRows));
  await page.evaluate(`document.querySelector('[data-partner-place]')?.click()`);
  await wait(200);
  const answer = await text('.px-status-line');
  await shot('locker-partner-pressed');
  check('pressing the partner says it is safe, and asks nothing impossible', /a wipe never takes your partner/.test(answer) && !/grow the container|Take something out/.test(answer), answer);

  await openHallPanel(page, 'rim', { press, until, wait });
  await wait(300);
  await shot('rim');
  const card = await text('.rim-stakes');
  check('the rim never calls the partner lost', !/lost for good/.test(card) && /Safe\s*Charmeleon \(your partner\)/i.test(card), card);

  await jumpIn(page, { press, until, wait });
  for (let guard = 0; guard < 30 && (await page.evaluate(`${world}.dialogBox.visible`)); guard += 1) await press('Space');
  await press('KeyB');
  await until(sceneIs('bag'), 'the pack');
  await wait(300);
  await shot('raid-pack');
  const place = await text('.partner-place-window');
  check('the raid pack shows the partner in its own place', /CHARMELEON/i.test(place) && /never takes it/.test(place), place);
  await press('Escape');
  await until(`!${sceneIs('bag')}`, 'the pack closed');

  // The clock runs out with the party still inside.
  await page.evaluate(`(() => { const w = ${world}; w.dialogBox.setVisible(false); w.advanceRunClock(60 * 60 * 1000); w.advanceRunClock(60 * 60 * 1000); })()`);
  await until(sceneIs('extraction'), 'the result');
  await wait(600);
  await shot('result');
  const result = await page.evaluate(`document.body.innerText.replace(/\\s+/g, ' ')`);
  check('the result says the partner came home', /Charmeleon, your partner, came home with you/.test(result) && /PARTNER CHARMELEON/i.test(result), result.slice(0, 500));

  const after = await saved();
  const ids = after.stash.pokemon.map((stored) => stored.id);
  check('the save still holds the partner, marked, and the secured Rattata', ids.includes(partnerId) && after.stash.partnerId === partnerId && ids.includes('rattata-1'), JSON.stringify({ ids, partnerId: after.stash.partnerId }));
} finally {
  await browser.close();
}
process.exitCode = failed ? 1 : 0;
