// Photographs every pixel-ui screen that carries a window heading, and audits
// each `.px-heading` for a note that is cut.
//
//   node tools/playtest/headingShots.mjs <url> <out dir> [--small]
//
// `--small` is the 320x240 stage at 3x; without it the window is
// `PIXEL_WINDOW`. A heading is judged by geometry, not by eye alone: its note
// must sit wholly inside the strip or not be drawn at all, and its name must be
// whole. The audit prints every heading whose note is hidden, so what the strip
// does instead of cutting is on record.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep, PIXEL_WINDOW } from './browser.mjs';
import { SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots'] = args.filter((arg) => !arg.startsWith('--'));
const small = args.includes('--small');
const suffix = small ? '-small' : '-3x';
mkdirSync(out, { recursive: true });

const AUDIT = `(() => [...document.querySelectorAll('.px-heading')].map((h) => {
  const box = h.getBoundingClientRect();
  const parts = [...h.children].map((c) => { const r = c.getBoundingClientRect(); return { tag: c.tagName, text: c.textContent, whole: r.left >= box.left - 0.5 && r.right <= box.right + 0.5 && r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5, scrollCut: c.scrollWidth > c.clientWidth + 0.5 }; });
  return { heading: parts[0]?.text, note: parts[1]?.text, noteShown: parts[1] ? parts[1].whole : null, cut: parts.some((p) => p.scrollCut || (p.tag === 'H2' && !p.whole)) };
}))()`;

const browser = await launchBrowser({ window: small ? { width: 960, height: 720 } : PIXEL_WINDOW });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const press = async (code) => { await page.tap(code); await sleep(120); };
  const click = async (label) => {
    await page.waitFor(
      `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)})); if (!b) return false; b.click(); return true; })()`,
      { what: `a button labelled ${label}` },
    );
    await sleep(250);
  };
  const clickSel = async (selector) => {
    await page.waitFor(`(() => { const b = document.querySelector(${JSON.stringify(selector)}); if (!b) return false; b.click(); return true; })()`, { what: selector });
    await sleep(250);
  };
  let bad = 0;
  const shoot = async (name) => {
    await sleep(500);
    const audit = JSON.parse(await page.evaluate(`JSON.stringify(${AUDIT})`));
    for (const row of audit) {
      const state = row.cut ? 'CUT' : row.noteShown === false ? 'note hidden' : 'ok';
      if (row.cut) bad += 1;
      console.log(`  ${name}: ${JSON.stringify(row.heading)} | ${JSON.stringify(row.note ?? '')} -> ${state}`);
    }
    await page.screenshot(`${out}/${name}${suffix}.png`);
  };

  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('starter'));
  await click('Confirm Bulbasaur');
  await page.waitFor(sceneIs('hub'));
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  await page.evaluate(`(() => { const save = JSON.parse(localStorage.getItem('${SAVE_KEY}')); Object.assign(save.raidProgress, { firstContractExtracted: true, completedContracts: ['recover-lost-field-kit'], unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'] }); localStorage.setItem('${SAVE_KEY}', JSON.stringify(save)); })()`);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('hub'));
  await sleep(400);

  await shoot('lobby');
  await clickSel('button[data-view="trader"]');
  await shoot('ferryman');
  await press('Escape');
  await clickSel('button[data-view="stash"]');
  await shoot('stash');
  await press('Escape');
  await clickSel('button[data-view="outfitter"]');
  await shoot('outfitter');
  await press('Escape');
  await click('Start a raid');
  await shoot('loadout');
  await click('Bulbasaur');
  await click('Choose drop-in');
  await shoot('dropin');
  await click('Review & deploy');
  await shoot('final-check');
  console.log(bad ? `${bad} heading(s) CUT` : 'no heading cut');
  if (bad) process.exitCode = 1;
} finally {
  await browser.close();
}
