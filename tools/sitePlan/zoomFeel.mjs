// Plays the site plan's zoom and drag in a real headless Chromium, with real
// wheel, mouse and touch input, and checks how they feel in numbers:
//
//   npm run site-plan -- --out=out/site-plan
//   EPTW_CHROME_LIBS="$(tools/playtest/ensure-libs.sh "$SCRATCH/chrome-libs")" \
//     node tools/sitePlan/zoomFeel.mjs out/site-plan/index.html
//
// It prints what it measured and exits non-zero if any check fails. Every
// frame's view is recorded inside the page, so a measurement is of what was
// drawn, not of where the view was when the driver happened to look.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, sleep } from '../playtest/browser.mjs';

const file = process.argv[2] ?? 'out/site-plan/index.html';
const url = pathToFileURL(resolve(file)).href;
const WIDTH = 1280;
const HEIGHT = 800;

const results = [];
function check(name, ok, measured) {
  results.push({ name, ok, ...measured });
}

const browser = await launchBrowser({ window: { width: WIDTH, height: HEIGHT } });
try {
  const page = await browser.openPage(url + '#150,166,3.2', {
    init: `window.__errors = []; addEventListener('error', (e) => __errors.push(String(e.message)));`,
  });
  await page.waitFor('window.__sitePlan && true');
  await sleep(1500);
  const send = page.send;
  const mouse = (type, x, y, buttons = 0) =>
    send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: type === 'mouseMoved' && !buttons ? 'none' : 'left',
      buttons,
      clickCount: 1,
    });
  const wheel = (x, y, deltaY, modifiers = 0) =>
    send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY, modifiers });
  const view = () => page.evaluate('(({ x, y, s }) => ({ x, y, s }))(window.__sitePlan.view)');
  const setView = (x, y, s) =>
    page.evaluate(
      `(() => { const v = window.__sitePlan.view; v.x = ${x}; v.y = ${y}; v.s = ${s}; window.__sitePlan.dirty(); })()`,
    );
  await page.evaluate(`(() => {
    window.__frames = [];
    (function record() {
      const v = window.__sitePlan.view;
      window.__frames.push([v.x, v.y, v.s, (window.__sitePlan.pictureStats || { blank: 0 }).blank]);
      requestAnimationFrame(record);
    })();
  })()`);
  const startRecording = () => page.evaluate('window.__frames.length = 0');
  const frames = () => page.evaluate('window.__frames');
  /** The plan point under a screen point, for a view. */
  const under = ([x, y, s], mx, my) => [(mx - WIDTH / 2) / s + x, (my - HEIGHT / 2) / s + y];
  /** How far, in screen pixels, the plan point that began under the pointer wandered from it. */
  const drift = (log, mx, my) => {
    const [ax, ay] = under(log[0], mx, my);
    return Math.max(
      ...log.map((f) => {
        const [x, y] = under(f, mx, my);
        return Math.hypot(x - ax, y - ay) * f[2];
      }),
    );
  };
  const steps = (log) => log.slice(1).map((f, i) => f[2] / log[i][2]);
  const biggestStep = (log) => Math.max(1, ...steps(log).map((r) => Math.max(r, 1 / r)));
  const reversals = (log) => {
    const moving = steps(log).filter((r) => Math.abs(r - 1) > 1e-6);
    return moving.filter((r, i) => i && (r - 1) * (moving[i - 1] - 1) < 0).length;
  };

  // A mouse wheel: five notches, a little apart, zoom in about the pointer in small eased steps.
  const mx = 900;
  const my = 300;
  await mouse('mouseMoved', mx, my);
  await startRecording();
  for (let i = 0; i < 5; i += 1) {
    await wheel(mx, my, -100);
    await sleep(60);
  }
  await sleep(1200);
  let log = await frames();
  check('mouse wheel keeps the point under the pointer', drift(log, mx, my) < 1, {
    driftPx: drift(log, mx, my),
  });
  check('mouse wheel zooms in small steps, never a jump', biggestStep(log) < 1.2, {
    biggestFrameStep: biggestStep(log),
  });
  check('mouse wheel zooms in', log.at(-1)[2] > log[0][2] * 2, {
    from: log[0][2],
    to: log.at(-1)[2],
  });

  // A trackpad: a stream of small scrolls with a bigger one among them, all one way.
  await startRecording();
  for (let i = 0; i < 30; i += 1) {
    await wheel(mx, my, i % 7 === 3 ? 45 : 12);
    await sleep(16);
  }
  await sleep(900);
  log = await frames();
  check('trackpad keeps the point under the pointer', drift(log, mx, my) < 1, {
    driftPx: drift(log, mx, my),
  });
  check('trackpad zooms one way, never back and forth', reversals(log) === 0, {
    reversals: reversals(log),
  });

  // A trackpad pinch: a wheel with the control key, continuous.
  await startRecording();
  for (let i = 0; i < 20; i += 1) {
    await wheel(mx, my, -4, 2);
    await sleep(16);
  }
  await sleep(600);
  log = await frames();
  check('pinch keeps the point under the pointer', drift(log, mx, my) < 1, {
    driftPx: drift(log, mx, my),
  });

  // A mouse wheel and a trackpad at once: whatever a notch had still to go is kept.
  await startRecording();
  await wheel(mx, my, -100);
  for (let i = 0; i < 6; i += 1) {
    await wheel(mx, my, -10);
    await sleep(16);
  }
  await sleep(900);
  log = await frames();
  check('wheel and trackpad together zoom one way', reversals(log) === 0, {
    reversals: reversals(log),
  });

  // A drag, and letting go of it: the view stays exactly where the drag left it.
  const drag = async (distance, holdMs = 0) => {
    await mouse('mousePressed', 600, 400, 1);
    for (let i = 1; i <= 10; i += 1) {
      await mouse('mouseMoved', 600 + (distance * i) / 10, 400, 1);
      await sleep(16);
    }
    if (holdMs) await sleep(holdMs);
    const atRelease = await view();
    await mouse('mouseReleased', 600 + distance, 400);
    await sleep(1500);
    return { atRelease, after: await view() };
  };
  const same = (a, b) =>
    Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9 && Math.abs(a.s - b.s) < 1e-9;
  let moved = await drag(200);
  check('letting go of a drag keeps the zoom and place', same(moved.atRelease, moved.after), moved);
  // A drag that comes back to where it began is still a drag.
  await mouse('mousePressed', 600, 400, 1);
  for (const x of [640, 680, 640, 601]) {
    await mouse('mouseMoved', x, 400, 1);
    await sleep(16);
  }
  const before = await view();
  await mouse('mouseReleased', 601, 400);
  await sleep(1500);
  check('a drag back to its start is not a click', same(before, await view()), {
    before,
    after: await view(),
  });

  // A press that barely moves, inside a place already zoomed into: no flight out of it.
  await setView(103, 156, 40);
  await sleep(300);
  moved = await drag(3);
  check(
    'a click inside a place you are zoomed into never zooms out',
    moved.after.s >= moved.atRelease.s,
    moved,
  );
  moved = await drag(0, 800);
  check('a long press is not a click', same(moved.atRelease, moved.after), moved);

  // A click on a place seen from afar flies in to it, smoothly.
  await page.evaluate('window.__sitePlan.fit(false); window.__sitePlan.dirty()');
  await sleep(500);
  const from = await view();
  const place = await page.evaluate(`(() => {
    const p = window.__sitePlan.features.find((f) => f.kind === 'district' && f.depth === 0);
    return { x: p.cx, y: p.cy };
  })()`);
  const at = [(place.x - from.x) * from.s + WIDTH / 2, (place.y - from.y) * from.s + HEIGHT / 2];
  await startRecording();
  await mouse('mousePressed', at[0], at[1], 1);
  await mouse('mouseReleased', at[0], at[1]);
  await sleep(2200);
  log = await frames();
  const flightFrames = steps(log).filter((r) => Math.abs(r - 1) > 1e-6).length;
  check('a click flies in, over many frames', log.at(-1)[2] > from.s * 1.5 && flightFrames >= 8, {
    from: from.s,
    to: log.at(-1)[2],
    flightFrames,
  });

  // A fast zoom from the whole world down to single tiles never shows blank ground.
  await page.evaluate('window.__sitePlan.fit(false); window.__sitePlan.dirty()');
  await sleep(800);
  await startRecording();
  for (let i = 0; i < 24; i += 1) {
    await wheel(640, 400, -120);
    await sleep(30);
  }
  await sleep(1500);
  for (let i = 0; i < 24; i += 1) {
    await wheel(640, 400, 120);
    await sleep(30);
  }
  await sleep(1500);
  log = await frames();
  const blank = Math.max(...log.map((f) => f[3]));
  check('zooming in and out never shows a blank piece', blank === 0, {
    mostBlankPieces: blank,
    deepest: Math.max(...log.map((f) => f[2])),
  });

  // Two fingers pinching on a touch screen: the point between them stays between them.
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await setView(150, 166, 3.2);
  await sleep(300);
  const fingers = (spread) => [
    { x: 700 - spread, y: 420, id: 1 },
    { x: 700 + spread, y: 420, id: 2 },
  ];
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(40) });
  await startRecording();
  for (let spread = 45; spread <= 160; spread += 5) {
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(spread) });
    await sleep(16);
  }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(1200);
  log = await frames();
  // Judged where the fingers stop: a frame can be drawn between one finger's move and the
  // other's, when the point between them really has moved.
  const settled = drift([log[0], log.at(-1)], 700, 420);
  check(
    'a touch pinch keeps the point between the fingers',
    settled < 1 && log.at(-1)[2] > 3.2 * 3,
    {
      driftPx: settled,
      to: log.at(-1)[2],
      biggestFrameStep: biggestStep(log),
    },
  );

  const errors = await page.evaluate('window.__errors');
  check('the page threw nothing', errors.length === 0, { errors });
} finally {
  await browser.close();
}

for (const result of results) console.log(JSON.stringify(result));
const failed = results.filter((result) => !result.ok);
console.log(
  failed.length
    ? `${failed.length} of ${results.length} checks failed`
    : `all ${results.length} checks passed`,
);
process.exitCode = failed.length ? 1 : 0;
