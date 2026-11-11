// Plays the rim card's keys on a save one raid in: a fit team's card and hint,
// then the whole team at 1 HP - the floor hint, NOT YET, Right to JUMP IN, Left
// back, and SPACE over the fence. See README.md beside it for how to run it.
//   node rimKeys.mjs <build url> <out dir> <CDP port>
import { mkdirSync } from 'node:fs';
import { attachBrowser, sleep } from '../../../tools/playtest/browser.mjs';
import { GAME, SAVE_KEY, sceneIs, walkIntoBase, openHallPanel, takePokemon } from '../../../tools/playtest/deploy.mjs';

const [url, out, port] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const faults = [];
const expect = (what, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) faults.push(what); };
const browser = attachBrowser(Number(port), { window: { width: 1200, height: 768 } });
const page = await browser.openPage('about:blank');
try {
  const press = async (code) => { await page.tap(code, 60); await sleep(250); };
  const until = (expression, what) => page.waitFor(expression, { what, timeoutMs: 60000 });
  const shot = (name) => page.screenshot(`${out}/${name}.png`);
  const base = (e) => page.evaluate(`(() => { const b = ${GAME}.scene.getScene('base'); return ${e}; })()`);
  const focused = (attr) => page.evaluate(`document.activeElement?.hasAttribute('${attr}') === true`);
  const address = url + '?testmode=pixels';
  await page.send('Page.navigate', { url: address });
  await until(sceneIs('title'), 'the title');
  await page.evaluate(`localStorage.removeItem('${SAVE_KEY}')`);
  await page.send('Page.navigate', { url: address });
  await until(sceneIs('title'), 'the title');
  await press('Space');
  await until(sceneIs('base'), 'the base');
  await until(`${GAME}.scene.getScene('base')?.takeStarterForDriver?.('charmander') === true`, 'the picker');
  await until(`localStorage.getItem('${SAVE_KEY}') !== null`, 'the save');
  // One raid behind it, so the rim shows its card rather than going straight over.
  await page.evaluate(`(() => { const s = JSON.parse(localStorage.getItem('${SAVE_KEY}')); s.raidProgress.raidRecord = { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } }; localStorage.setItem('${SAVE_KEY}', JSON.stringify(s)); })()`);
  await page.send('Page.navigate', { url: address });
  await until(sceneIs('title'), 'the title');
  await press('Space');
  await until(sceneIs('base'), 'the base');
  await sleep(1500);
  await walkIntoBase(page, 'raid-arena', { press, until });
  await until(takePokemon('charmander'), 'Charmander on the bench');
  await press('Escape');
  await sleep(500);

  // A fit team: the floor promises the jump, and the card opens on JUMP IN.
  await openHallPanel(page, 'rim', { press, until });
  await sleep(800);
  expect('a fit team opens on JUMP IN', await focused('data-start'));
  await shot('a-fit-card-jump-in');
  await press('Escape');
  await sleep(600);
  const fitHint = await base('b.hintShown');
  expect(`a fit team's floor hint promises the jump (${fitHint})`, fitHint.startsWith('[SPACE] JUMP IN AT'));

  // The whole team hurt, as the report's veteran came home.
  await page.evaluate(`(() => { const s = JSON.parse(localStorage.getItem('${SAVE_KEY}')); for (const p of s.stash.pokemon) p.pokemon.currentHp = 1; localStorage.setItem('${SAVE_KEY}', JSON.stringify(s)); })()`);
  await page.send('Page.navigate', { url: address });
  await until(sceneIs('title'), 'the title');
  await press('Space');
  await until(sceneIs('base'), 'the base');
  await sleep(1500);
  await walkIntoBase(page, 'raid-arena', { press, until });
  await until(takePokemon('charmander'), 'Charmander on the bench');
  await press('Escape');
  await sleep(500);
  await openHallPanel(page, 'rim', { press, until });
  await sleep(500);
  await press('Escape');
  await sleep(600);
  const hurtHint = await base('b.hintShown');
  expect(`a hurt team's floor hint promises no jump (${hurtHint})`, hurtHint.startsWith('[SPACE] LOOK DOWN'));
  await shot('b-hurt-floor-hint');
  await press('Space');
  await until(sceneIs('hub'), 'the hurt card');
  await sleep(800);
  expect('the hurt card opens on NOT YET', await focused('data-back'));
  await shot('c-hurt-card-not-yet');
  await press('ArrowRight');
  await sleep(300);
  expect('Right from NOT YET reaches JUMP IN', await focused('data-start'));
  await shot('d-hurt-card-right-jump-in');
  const ways = await page.evaluate(`${GAME}.scene.getScene('hub').waysFromHere().length`);
  console.log(`ways in from here: ${ways}`);
  if (ways === 1) {
    await press('ArrowLeft');
    expect('Left with one way in goes back to NOT YET', await focused('data-back'));
    await press('ArrowRight');
    expect('and Right to JUMP IN again', await focused('data-start'));
  }
  await press('Space');
  await until(sceneIs('world'), 'the raid');
  expect('SPACE on JUMP IN jumps', true);
  await sleep(2500);
  await shot('e-jumped');
} finally {
  await page.close();
}
console.log(faults.length ? `${faults.length} fault(s)` : 'all ok');
process.exit(faults.length ? 1 : 0);
