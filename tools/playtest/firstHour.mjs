// Plays the four first-hour lines a stranger meets before their first raid is
// over, and prints what the game actually said:
//
//   node tools/playtest/firstHour.mjs <dev server url> [out-dir]
//
// - where the starter screen's cursor starts (it must be a card, never CONFIRM);
// - a trainer fight in the rain against a Swift Swim Magikarp that Splashes,
//   led by a Cloud Nine Psyduck, then the trainer's second Pokemon: every
//   ability line should be said once a battle, Splash should say "But nothing
//   happened!", and the second Pokemon should arrive as "MAYA sent out ...!".
//
// It needs the dev server, because it builds the battle out of the game's own
// modules (`import('/src/...')`) rather than walking to a trainer.
import { launchBrowser, sleep, PIXEL_WINDOW } from './browser.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', outDir] = args;
const GAME = 'window.__escapeFromPalletTownGame__';

const browser = await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  await page.waitFor(`${GAME}?.scene?.isActive('title')`, { timeoutMs: 60_000 });

  // 1. A fresh browser: the key that wakes the title goes straight to the picker.
  await page.tap('Space');
  await page.waitFor(`${GAME}.scene.isActive('starter')`);
  await sleep(500);
  const focused = await page.evaluate(`document.activeElement?.textContent?.trim()`);
  console.log(`starter cursor starts on: ${JSON.stringify(focused)}`);
  if (outDir) await page.screenshot(`${outDir}/starter-cursor.png`);

  // 2. The battles: Cloud Nine holding the rain off, then Swift Swim racing it.
  for (const leadId of ['psyduck', 'squirtle']) {
    // Each fight is started from the title, so the battle scene is built fresh.
    await page.evaluate(`void ${GAME}.scene.getScenes(true)[0].scene.start('title')`);
    await page.waitFor(`${GAME}.scene.isActive('title')`);
    await page.evaluate(`(async () => {
      const { Pokemon, PokemonParty } = await import('/src/game/pokemon/index.ts');
      const { getSpeciesById } = await import('/src/game/pokemon/species.ts');
      const make = (id, level) => new Pokemon(getSpeciesById(id), level);
      const trainer = {
        id: 'first-hour',
        name: 'MAYA',
        party: [make('magikarp', 9), make('pikachu', 5)],
        defeatText: 'Fine.',
        unitCount: 1,
      };
      const game = ${GAME};
      game.scene.getScene('title').scene.start('battle', { party: new PokemonParty([make('${leadId}', 12)]), trainer, weather: 'rain', returnScene: 'title' });
    })()`);
    await page.waitFor(`${GAME}.scene.isActive('battle') && Boolean(${GAME}.scene.getScene('battle').dialog)`);
    await page.evaluate(`(() => {
      const dialog = ${GAME}.scene.getScene('battle').dialog;
      window.__said = [];
      const one = dialog.showMessage.bind(dialog);
      dialog.showMessage = (text) => { window.__said.push(text); return one(text); };
    })()`);
    const done = `(() => window.__said.some((t) => /PIKACHU/.test(t)) || !${GAME}.scene.isActive('battle'))()`;
    for (let press = 0; press < 400 && !(await page.evaluate(done)); press += 1) {
      await page.tap('Enter');
      await sleep(40);
    }
    if (outDir) await page.screenshot(`${outDir}/sent-out-${leadId}.png`);
    console.log(`\n--- led by ${leadId.toUpperCase()} in the rain ---`);
    console.log((await page.evaluate(`window.__said`)).join('\n'));
  }
} finally {
  await browser.close();
}
