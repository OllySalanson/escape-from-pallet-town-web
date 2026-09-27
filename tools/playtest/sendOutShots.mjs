// Fights a three-Pokemon trainer reading every line the moment it is up, and
// photographs the third Pokemon once its send-out has had time to settle.
//
//   node tools/playtest/sendOutShots.mjs <dev server url> <out.png> [--press=60]
//
// A slot keeps one sprite for the whole fight and each Pokemon sent into it is
// drawn on that sprite, so a quick reader puts the next one on it while the
// last one's faint is still playing. Before `BattleScene.standOnSpot()` the
// fade went on fading the newcomer and each knockout sank the next one further:
// the third Pokemon was fought invisible. `--press` is the milliseconds between
// presses; 300 reads calmly enough that the fault never showed.
//
// It needs the dev server, because it builds the battle out of the game's own
// modules (`import('/src/...')`) rather than walking to a trainer.
import { launchBrowser, sleep, PIXEL_WINDOW } from './browser.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/', out = 'send-out.png'] = args.filter((arg) => !arg.startsWith('--'));
const pressMs = Number(args.find((arg) => arg.startsWith('--press='))?.slice(8) ?? 60);
const GAME = 'window.__escapeFromPalletTownGame__';

const browser = await launchBrowser({ window: PIXEL_WINDOW });
try {
  const page = await browser.openPage(`${url}?testmode=pixels`);
  await page.waitFor(`${GAME}?.scene?.isActive('title')`, { timeoutMs: 60_000 });
  await page.evaluate(`(async () => {
    const { Pokemon, PokemonParty } = await import('/src/game/pokemon/index.ts');
    const { getSpeciesById } = await import('/src/game/pokemon/species.ts');
    const make = (id, level) => new Pokemon(getSpeciesById(id), level);
    const lead = make('charmander', 40);
    // The hardest-hitting move first, so the first command KOs in one.
    lead.moves.sort((a, b) => (b.base.power || 0) - (a.base.power || 0));
    const trainer = {
      id: 'send-out-shots',
      name: 'BUG CATCHER',
      party: [make('caterpie', 3), make('weedle', 3), make('pikachu', 3)],
      defeatText: 'Out of bugs!',
      unitCount: 1,
    };
    ${GAME}.scene.getScene('title').scene.start('battle', { party: new PokemonParty([lead]), trainer, returnScene: 'title' });
  })()`);
  await page.waitFor(`${GAME}.scene.isActive('battle')`);
  const thirdIsOut = `(() => {
    const battle = ${GAME}.scene.getScene('battle');
    return battle.state.enemyPartyIndex === 2 && battle.displayed.get('enemy0') === battle.state.enemy.pokemon;
  })()`;
  for (let press = 0; press < 200 && !(await page.evaluate(thirdIsOut)); press += 1) {
    await page.tap('Enter');
    await sleep(pressMs);
  }
  // Long past anything the second Pokemon's knockout started.
  await sleep(1500);
  const sprite = await page.evaluate(`(() => {
    const battle = ${GAME}.scene.getScene('battle');
    const sprite = battle.sprites.get('enemy0');
    return { pokemon: battle.state.enemy.pokemon.base.name, alpha: sprite.alpha, x: sprite.x, y: sprite.y };
  })()`);
  console.log(JSON.stringify(sprite));
  await page.screenshot(out);
} finally {
  await browser.close();
}
