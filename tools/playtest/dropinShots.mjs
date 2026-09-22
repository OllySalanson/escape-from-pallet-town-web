// Photographs the drop-in step, before and after the dark has pulled back.
//
//   node tools/playtest/dropinShots.mjs <url> <out dir> [--small] [--survey=path.json]
//
// Two saves: a fresh one, which has walked nothing and holds one landing, and
// one that has raided the Floodplain, beaten two keepers and walked a third of
// it. `--survey` takes the `surveyed` record a real raid left behind
// (`raid.mjs --progress=path.json` writes one), so the ground that is lit in
// the second shot is ground a raid actually walked.
//
// `--small` is the 320x240 stage at 3x, which is the composition every screen
// is authored against; without it the window is `PIXEL_WINDOW`, the largest
// logical screen. Both are photographed, because the screen has to hold at the
// smallest one and look right at the biggest.
import { mkdirSync, readFileSync } from 'node:fs';
import { launchBrowser, sleep, PIXEL_WINDOW } from './browser.mjs';
import { SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const small = args.includes('--small');
const suffix = small ? '-small' : '-3x';
const survey = option('survey')
  ? JSON.parse(readFileSync(option('survey'), 'utf8')).surveyed ?? JSON.parse(readFileSync(option('survey'), 'utf8'))
  : {};
mkdirSync(out, { recursive: true });

const browser = await launchBrowser({ window: small ? { width: 960, height: 720 } : PIXEL_WINDOW });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const press = async (code) => { await page.tap(code); await sleep(120); };
  const click = async (label) => {
    await page.waitFor(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)})); if (!b) return false; b.click(); return true; })()`,
      { what: `a button labelled ${label}` },
    );
    await sleep(200);
  };
  const shoot = async (name) => {
    await sleep(500);
    // No screen in this game may put a scrollbar down the side of the browser:
    // a pane scrolls inside its own window, the screen never does.
    const overflow = await page.evaluate(
      `JSON.stringify([document.documentElement.scrollHeight - document.documentElement.clientHeight, document.documentElement.scrollWidth - document.documentElement.clientWidth])`,
    );
    if (JSON.parse(overflow).some((over) => over > 0)) {
      throw new Error(`${name}: the page scrolls by ${overflow}`);
    }
    await page.screenshot(`${out}/${name}${suffix}.png`);
    console.log(`${name}${suffix}`);
  };

  const reload = async (progress) => {
    await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
    await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); Object.assign(save.raidProgress, ${JSON.stringify(progress)}); localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
    await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
    await page.waitFor(sceneIs('title'));
    await press('Space');
    await page.waitFor(sceneIs('base'));
  };

  const toDropIn = async () => {
    await click('Start a raid');
    await click('Bulbasaur');
    await click('Choose drop-in');
  };

  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('starter'));
  await click('Confirm Bulbasaur');
  await page.waitFor(sceneIs('base'));

  await toDropIn();
  await shoot('dropin-fresh');
  await press('Escape');
  await shoot('loadout');

  await reload({
    firstContractExtracted: true,
    completedContracts: ['recover-lost-field-kit'],
    unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
    defeatedBosses: ['floodplain-toll-keeper', 'overlook-warden'],
    raidRecord: {
      'floodplain-relay': { deployed: 7, extracted: 4, wiped: 3 },
      'route-1': { deployed: 2, extracted: 2, wiped: 0 },
    },
    surveyed: survey,
  });
  await toDropIn();
  await shoot('dropin-explored');
  // And the same screen with what the place holds scrolled into view: the
  // doors, who has them, and what lives in the places that have been walked.
  await page.evaluate(`(() => { const p = document.querySelector('.dropin-brief'); p.scrollTop = p.scrollHeight; })()`);
  await shoot('dropin-holds');
  await click('Review & deploy');
  await shoot('confirm');
} finally {
  await browser.close();
}
