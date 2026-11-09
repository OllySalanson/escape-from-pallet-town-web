// How smoothly THE PROMENADE DERBY's race draws, against the harbour standing
// still: frames a second, the median frame and the 95th-percentile frame, each
// over ten seconds of wall time at real speed - the way playtest 51 measured it
// (`docs/screens/pt51-fixes/README.md`). With `--profile=<file>` it also takes a
// CPU profile of the race's ten seconds and prints where the time went, by
// function, so a slow frame is answered by a measurement rather than a guess.
//
//   node tools/playtest/derbyFrames.mjs <url> [--level=4] [--racer=doduo] [--seconds=10] [--profile=<file.cpuprofile>] [--window=1200x768]
//
// It wants a normal build at real speed, never test mode: test mode hands the
// world 100ms frames and is not what a player sees. Serve one with
// `npx vite build --base=/ --outDir "$SCRATCH/dist"` and
// `npx vite preview --outDir "$SCRATCH/dist" --port "$FREE_PORT" --strictPort`
// (`--minify false` on the build for a profile with the game's own names in it).
import { writeFileSync } from 'node:fs';
import { launchBrowser, PIXEL_WINDOW } from './browser.mjs';
import { GAME, SAVE_KEY, sceneIs } from './deploy.mjs';

const args = process.argv.slice(2);
const [url = 'http://localhost:4173/'] = args.filter((arg) => !arg.startsWith('--'));
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const level = Number(option('level') ?? 4);
const racer = option('racer') ?? 'doduo';
const seconds = Number(option('seconds') ?? 10);
const profileTo = option('profile');
const [width, height] = option('window')?.split('x').map(Number) ?? [PIXEL_WINDOW.width, PIXEL_WINDOW.height];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fail = (why) => {
  throw new Error(`derbyFrames: ${why}`);
};

/** Every frame's length over `seconds` of wall time, read off requestAnimationFrame in the page. */
const measure = async (page) => {
  await page.evaluate(`(() => {
    const frames = []; let last = null; window.__derbyFrames = frames; window.__derbyMeasuring = true;
    const tick = (now) => { if (last !== null) frames.push(now - last); last = now; if (window.__derbyMeasuring) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  })()`);
  await sleep(seconds * 1000);
  const frames = await page.evaluate(`(() => { window.__derbyMeasuring = false; return window.__derbyFrames; })()`);
  const sorted = [...frames].sort((a, b) => a - b);
  const at = (share) => sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0;
  const total = frames.reduce((sum, ms) => sum + ms, 0);
  return { fps: (frames.length / total) * 1000, median: at(0.5), p95: at(0.95), frames: frames.length };
};

const line = (where, result) =>
  `${where.padEnd(28)} ${result.fps.toFixed(1).padStart(5)} fps   median ${result.median.toFixed(1).padStart(5)} ms   p95 ${result.p95.toFixed(1).padStart(5)} ms   (${result.frames} frames)`;

const browser = await launchBrowser({ window: { width, height } });
try {
  const page = await browser.openPage('about:blank');
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await page.evaluate(`localStorage.clear(); localStorage.setItem('escape-from-pallet-town.player.name', 'PIP')`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await sleep(500);
  await page.tap('Space');
  const base = `${GAME}.scene.getScene('base')`;
  const derby = `${GAME}.scene.getScene('derby')`;
  await page.waitFor(`${sceneIs('base')} && ${base}?.takeStarterForDriver?.("charmander") === true`, { timeoutMs: 60_000, what: 'the starter table' });
  await page.waitFor(`${sceneIs('base')} && ${base}.ready && !${base}.leaving`, { timeoutMs: 60_000, what: 'the harbour' });
  await sleep(1500);
  // A racer in the vault, a raid behind the save, and every level open.
  await page.evaluate(`(() => {
    const save = JSON.parse(localStorage.getItem('${SAVE_KEY}'));
    const first = save.stash.pokemon[0];
    save.stash.pokemon.push({ ...first, id: '${racer}-7', pokemon: { ...first.pokemon, speciesId: '${racer}', level: 32, nickname: null, moves: [], pendingMoves: [] } });
    save.raidProgress.raidRecord = { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } };
    save.raidProgress.derbyCleared = 4;
    localStorage.setItem('${SAVE_KEY}', JSON.stringify(save));
  })()`);
  await page.send('Page.navigate', { url });
  await page.waitFor(sceneIs('title'), { timeoutMs: 60_000 });
  await sleep(500);
  await page.tap('Space');
  await page.waitFor(`${sceneIs('base')} && ${base}.ready`, { timeoutMs: 60_000, what: 'the harbour, continued' });
  await sleep(2000);

  const yard = await measure(page);
  console.log(line('Yard, spawn, still', yard));

  await page.evaluate(`void ${base}.openMinigame('derby')`);
  await page.waitFor(sceneIs('derby'), { timeoutMs: 30_000, what: 'the derby screen' });
  await sleep(500);
  if (!(await page.evaluate(`${derby}.raceOn(${level})`))) fail(`level ${level} would not open`);
  if (!(await page.evaluate(`${derby}.playWith('${racer}-7')`))) fail(`${racer} would not race`);
  await page.waitFor(`${derby}.isPlaying`, { what: 'the race' });
  await sleep(800);
  // An experiment run over the race before it is measured, to test a cause by taking it away.
  const experiment = option('experiment');
  if (experiment) console.log(`experiment: ${await page.evaluate(experiment)}`);
  if (profileTo) {
    await page.send('Profiler.enable');
    await page.send('Profiler.setSamplingInterval', { interval: 200 });
    await page.send('Profiler.start');
  }
  const race = await measure(page);
  console.log(line(`DERBY race, level ${level}`, race));
  if (profileTo) {
    const { profile } = await page.send('Profiler.stop');
    writeFileSync(profileTo, JSON.stringify(profile));
    // Self time by function, the heaviest first.
    const byId = new Map(profile.nodes.map((node) => [node.id, node]));
    const self = new Map();
    const gaps = profile.timeDeltas;
    profile.samples.forEach((id, index) => {
      const node = byId.get(id);
      const frame = node.callFrame;
      const key = `${frame.functionName || '(anonymous)'} ${frame.url.split('/').pop()}:${frame.lineNumber + 1}`;
      self.set(key, (self.get(key) ?? 0) + (gaps[index] ?? 0) / 1000);
    });
    const total = [...self.values()].reduce((sum, ms) => sum + ms, 0);
    console.log(`\nSelf time over the race (${(total / 1000).toFixed(1)} s sampled):`);
    for (const [key, ms] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
      console.log(`${((ms / total) * 100).toFixed(1).padStart(5)}%  ${ms.toFixed(0).padStart(6)} ms  ${key}`);
    }
  }
} finally {
  await browser.close();
}
