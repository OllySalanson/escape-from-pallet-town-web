// Harbour screens menuShots does not reach: YOUR TEAM, YOUR THINGS, the Pokedex
// and one of its pages, the Game Corner prize window. Usage: node extraShots.mjs <url> <out>
import { mkdirSync } from 'node:fs';
const T = new URL('../../../tools/playtest', import.meta.url).pathname;
const { launchBrowser, sleep } = await import(`${T}/browser.mjs`);
const { SAVE_KEY, sceneIs } = await import(`${T}/deploy.mjs`);

const [url, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await launchBrowser({ window: { width: 1280, height: 800 } });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const press = async (code) => { await page.tap(code); await sleep(200); };
  const shot = async (name) => { await sleep(500); await page.screenshot(`${out}/${name}.png`); console.log('shot', name); };
  await page.waitFor(sceneIs('title'), { what: 'title', timeoutMs: 60000 });
  await press('Space');
  await page.waitFor(sceneIs('base'), { what: 'base', timeoutMs: 60000 });
  await page.waitFor(`window.__escapeFromPalletTownGame__.scene.getScene('base')?.takeStarterForDriver?.("bulbasaur") === true`, { what: 'partner', timeoutMs: 60000 });
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`, { timeoutMs: 60000 });
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    Object.assign(save.raidProgress, { firstContractExtracted: true, completedContracts: ['recover-lost-field-kit'], firstWordsHeard: ['lab', 'loadout', 'check', 'center'],
      errands: ['oaks-parcel', 'medicine-bag', 'brocks-crate', 'old-amber'].map((id) => ({ id, status: 'started', found: 0, lossesHeard: 0 })) });
    save.stash.items = { potion: 9, 'super-potion': 3, 'poke-ball': 8, 'great-ball': 4, antidote: 5, money: 260 };
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
    localStorage.setItem('escape-from-pallet-town.player.name', 'SAM');
  })()`);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await page.waitFor(sceneIs('title'), { what: 'title again', timeoutMs: 60000 });
  await press('Space');
  await page.waitFor(sceneIs('base'), { what: 'base again', timeoutMs: 60000 });
  await sleep(1500);
  const open = async (key, scene, name) => {
    await press(key);
    await page.waitFor(sceneIs(scene), { what: scene, timeoutMs: 30000 });
    await shot(name);
  };
  const closeWith = async (how, scene) => {
    const clicked = how === 'click' && (await page.evaluate(`(() => { const x = document.querySelector('#screens .px-close'); x?.click(); return Boolean(x); })()`));
    if (!clicked) { how = 'escape'; await press('Escape'); if (scene === 'pokedex') await press('Escape'); }
    await page.waitFor(`!(${sceneIs(scene)})`, { what: `${scene} closed by ${how}`, timeoutMs: 30000 });
    console.log(`${scene} closed by ${how}`);
    await sleep(500);
  };
  const { walkIntoBase } = await import(`${T}/deploy.mjs`);
  const leave = async () => {
    for (let back = 0; back < 4 && !(await page.evaluate(sceneIs('base'))); back += 1) { await press('Escape'); await sleep(300); }
  };
  if (process.argv.includes('--friend')) {
    await walkIntoBase(page, 'pokemon-centre');
    await page.evaluate(`(() => { const hub = window.__escapeFromPalletTownGame__.scene.getScene('hub'); hub.setView('friend'); hub.render(); })()`);
    await shot('friend-room');
  } else {
    await walkIntoBase(page, 'game-corner');
    await shot('pokemon-jump');
  }
} finally {
  await browser.close();
}
