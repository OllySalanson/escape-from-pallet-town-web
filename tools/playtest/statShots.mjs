// Photographs a species' stats where a player reads them: the Pokemon Center's
// detail pane, with the cursor on that Pokemon.
//
//   node tools/playtest/statShots.mjs <url> <out dir> [--level=50] [pikachu dugtrio ...]
//
// A base stat moves the real stat by about one point per ten base points per
// ten levels, so a correction is invisible on a level-5 Pokemon; `--level`
// seeds them high enough to see it. Used for the base-stat audit
// (`docs/pokemon/stat-audit.md`): run it against a build either side of a
// stat change and the two pictures are the before and after.
import { mkdirSync } from 'node:fs';
import { launchBrowser, sleep, PIXEL_WINDOW } from './browser.mjs';
import { SAVE_KEY, sceneIs, walkIntoBase } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'shots', ...rest] = args.filter((arg) => !arg.startsWith('--'));
const level = Number(args.find((arg) => arg.startsWith('--level='))?.slice(8) ?? 50);
const species = rest.length > 0 ? rest : ['pikachu', 'dugtrio', 'butterfree', 'jigglypuff'];
mkdirSync(out, { recursive: true });

const browser = await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  const press = async (code) => { await page.tap(code); await sleep(200); };
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('starter'));
  await page.waitFor(
    `(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Confirm Bulbasaur')); if (!b) return false; b.click(); return true; })()`,
  );
  await page.waitFor(sceneIs('base'));
  await page.waitFor(`localStorage.getItem('${SAVE_KEY}') !== null`);
  // The seeded Pokemon go first, so the cursor reaches each with one Down.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const seed = save.stash.pokemon[0];
    const extra = ${JSON.stringify(species)}.map((speciesId, i) => ({ id: 'stat-' + i, pokemon: { ...seed.pokemon, speciesId, moves: ['Tackle'], level: ${level}, xp: ${level ** 3}, currentHp: 999 } }));
    save.stash.pokemon = [...extra, seed];
    save.stash.boxes = [{ name: 'Box 1', pokemonIds: [...extra.map((p) => p.id), seed.id] }];
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.send('Page.navigate', { url: `${url}?testmode=pixels` });
  await page.waitFor(sceneIs('title'));
  await press('Space');
  await page.waitFor(sceneIs('base'));
  await sleep(500);
  await walkIntoBase(page, 'pokemon-centre');
  await sleep(600);
  for (const [index, id] of species.entries()) {
    // Point at the row by its place in the list rather than by pressing into
    // whatever the screen starts its cursor on.
    await page.evaluate(`(() => {
      const rows = [...document.querySelectorAll('.stash-roster .px-list > button')];
      rows[${index}]?.focus();
      rows[${index}]?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    })()`);
    await sleep(500);
    await page.screenshot(`${out}/${id}.png`);
    console.log(`${id}: ${out}/${id}.png`);
  }
} finally {
  await browser.close();
}
