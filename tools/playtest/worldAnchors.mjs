// Where the world's own overlays sit, to the pixel.
//
//   node tools/playtest/worldAnchors.mjs <url> [--window=1920x950]
//
// The DOM screens are laid out against the browser window and the canvas is
// not (`src/game/display/menuStage.ts`), so the one thing that split must never
// move is anything anchored to a tile or a sprite. This prints the canvas box,
// the stage, the dialogue box and every world caption on screen, so the numbers
// can be diffed across a change rather than eyeballed.
import { launchBrowser, sleep } from './browser.mjs';
import { deploy, deployOptions, GAME, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:5173/'] = args.filter((arg) => !arg.startsWith('--'));
const size = /^(\d+)x(\d+)$/.exec(args.find((arg) => arg.startsWith('--window='))?.slice(9) ?? '1920x950');
const window = { width: Number(size[1]), height: Number(size[2]) };

const browser = await launchBrowser({ window });
try {
  const page = await browser.openPage(`${url}?testmode=1`);
  const press = async (code) => { await page.tap(code); await sleep(120); };
  const click = async (label) => {
    await page.waitFor(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)})); if (!b) return false; b.click(); return true; })()`, { what: label });
    await sleep(200);
  };
  const until = (expression, what) => page.waitFor(expression, { what });
  await deploy(page, `${url}?testmode=1`, { press, click, until, ...deployOptions(args) });
  await until(sceneIs('world'));
  await sleep(1500);
  // A caption only speaks within five steps of what it names, so the look key
  // is what puts every one in view on screen - which is the set to compare.
  // The raid opens on its briefing, which is dialogue and eats a direction key.
  for (let read = 0; read < 6; read += 1) {
    if (!(await page.evaluate(`${GAME}.scene.getScene('world').dialogBox.visible`))) break;
    await press('Space');
    await sleep(250);
  }
  for (let step = 0; step < 4; step += 1) {
    await page.tap('ArrowDown', 80);
    await sleep(200);
  }
  await page.keyDown('KeyL');
  await sleep(800);
  const report = await page.evaluate(`(() => {
    const world = ${GAME}.scene.getScene('world');
    const canvas = document.querySelector('#app > canvas').getBoundingClientRect();
    const dialog = world.dialogBox;
    // A world caption is not a game object - it owns a frame and a Text - so what
    // is compared is every piece of writing the scene has put on the map, with
    // where it sits and what is drawn over what.
    const labels = world.children.list
      .filter((child) => typeof child.text === 'string' && child.text.length > 0 && child.visible)
      .map((label) => ({ x: Math.round(label.x * 100) / 100, y: Math.round(label.y * 100) / 100, depth: label.depth, text: label.text }))
      .sort((a, b) => a.text.localeCompare(b.text) || a.x - b.x);
    return JSON.stringify({
      canvas: { left: canvas.left, top: canvas.top, width: canvas.width, height: canvas.height },
      stage: { width: world.scale.width, height: world.scale.height, zoom: world.scale.zoom },
      camera: { x: world.cameras.main.scrollX, y: world.cameras.main.scrollY },
      player: { x: world.player.x, y: world.player.y },
      dialog: { x: dialog.x, y: dialog.y, visible: dialog.visible, depth: dialog.depth },
      labels,
    }, null, 1);
  })()`);
  console.log(report);
  await page.keyUp('KeyL');
} finally {
  await browser.close();
}
