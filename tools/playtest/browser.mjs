// A headless Chromium for one verification session, and the page inside it.
// No dependencies: Node's own WebSocket speaks CDP. See README.md beside this.
//
//   const browser = await launchBrowser();            // OS-chosen CDP port
//   const page = await browser.openPage(url);
//   await page.tap('Space');  await page.evaluate('1 + 1');
//   await page.freeze();  /* think for as long as you like */  await page.thaw();
//   await browser.close();                            // always, in a finally
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

/** 1x stage zoom: the largest logical screen with nothing spent on scaling it up. */
export const LOGIC_WINDOW = { width: 400, height: 256 };
/** 3x, for the screenshots that are judged by eye. Nine times the pixels per frame. */
export const PIXEL_WINDOW = { width: 1200, height: 768 };

const KEYS = {
  ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
  Space: 32, Enter: 13, Escape: 27,
};

function keyDescription(code) {
  const single = /^Key([A-Z])$/.exec(code);
  if (single) {
    return { code, key: single[1].toLowerCase(), windowsVirtualKeyCode: single[1].charCodeAt(0) };
  }
  if (!(code in KEYS)) {
    throw new Error(`unknown key ${code}`);
  }
  const key = code === 'Space' ? ' ' : code;
  return { code, key, windowsVirtualKeyCode: KEYS[code], ...(code === 'Space' ? { text: ' ' } : {}) };
}

function findChromium() {
  if (process.env.EPTW_CHROME) {
    return process.env.EPTW_CHROME;
  }
  const cache = join(homedir(), '.cache', 'ms-playwright');
  const build = existsSync(cache)
    ? readdirSync(cache).filter((name) => /^chromium-\d+$/.test(name)).sort().at(-1)
    : undefined;
  if (!build) {
    throw new Error('No Chromium under ~/.cache/ms-playwright; set EPTW_CHROME to a chrome binary.');
  }
  return join(cache, build, 'chrome-linux64', 'chrome');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Launches a browser on a CDP port the OS picked. A fixed port is how one
 * worker's driver came to attach to another worker's tab: port 0 cannot collide.
 * `EPTW_CHROME_LIBS` is the scratch directory `ensure-libs.sh` filled.
 */
export async function launchBrowser({ window = LOGIC_WINDOW, libs = process.env.EPTW_CHROME_LIBS } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'eptw-chrome-'));
  const child = spawn(
    findChromium(),
    [
      '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
      `--window-size=${window.width},${window.height}`, '--hide-scrollbars', '--mute-audio',
      '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--disable-background-networking', '--disable-gpu',
      // A tab opened over CDP is a background tab, and Chromium runs a background
      // tab's timers once a second - which is the game's loop, in test mode.
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows', 'about:blank',
    ],
    {
      detached: true,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, ...(libs ? { LD_LIBRARY_PATH: [libs, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') } : {}) },
    },
  );

  const port = await new Promise((resolve, reject) => {
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      const match = /DevTools listening on ws:\/\/[^:]+:(\d+)\//.exec(stderr);
      if (match) {
        resolve(Number(match[1]));
      }
    });
    child.once('exit', (code) => reject(new Error(`Chromium exited (${code}) before listening:\n${stderr}`)));
  });
  child.stderr.resume();

  let closed = false;
  const close = async () => {
    if (closed) {
      return;
    }
    closed = true;
    try {
      // The whole process group: renderers and the GPU process are its children.
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
    await sleep(300);
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // Already gone.
    }
    rmSync(profile, { recursive: true, force: true });
  };
  // A driver that throws must not leave a browser behind it.
  process.once('exit', () => {
    if (!closed) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        // Already gone.
      }
    }
  });

  return {
    port,
    pid: child.pid,
    close,
    /** CPU seconds the whole browser has used so far, from /proc. */
    cpuSeconds: () => processGroupCpuSeconds(child.pid),
    openPage: (url, options) => openPage(port, url, window, options),
  };
}

function processGroupCpuSeconds(groupId) {
  let ticks = 0;
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) {
      continue;
    }
    try {
      const stat = readFileSync(`/proc/${entry}/stat`, 'utf8');
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      if (Number(fields[2]) === groupId) {
        ticks += Number(fields[11]) + Number(fields[12]);
      }
    } catch {
      // The process ended between the listing and the read.
    }
  }
  return ticks / 100;
}

async function openPage(port, url, window, { save } = {}) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    } else {
      listeners.get(message.method)?.(message.params);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      nextId += 1;
      pending.set(nextId, { resolve, reject });
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });

  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result.value;
  };

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { ...window, deviceScaleFactor: 1, mobile: false });
  if (save !== undefined) {
    // Seeded before any script of the page runs, so the title screen finds it.
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `localStorage.setItem('escape-from-pallet-town.save.v1', ${JSON.stringify(JSON.stringify(save))});`,
    });
  }
  const loaded = new Promise((resolve) => listeners.set('Page.loadEventFired', resolve));
  await send('Page.navigate', { url });
  await loaded;

  const keyDown = (code) => send('Input.dispatchKeyEvent', { type: 'keyDown', ...keyDescription(code) });
  const keyUp = (code) => send('Input.dispatchKeyEvent', { type: 'keyUp', ...keyDescription(code) });

  return {
    send,
    evaluate,
    keyDown,
    keyUp,
    /** A press held for `holdMs` of wall time. Zero is a down and an up back to back. */
    async tap(code, holdMs = 0) {
      await keyDown(code);
      if (holdMs > 0) {
        await sleep(holdMs);
      }
      await keyUp(code);
    },
    async waitFor(expression, { timeoutMs = 15_000, pollMs = 50, what = expression } = {}) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const value = await evaluate(expression);
        if (value) {
          return value;
        }
        if (Date.now() > deadline) {
          throw new Error(`timed out waiting for ${what}`);
        }
        await sleep(pollMs);
      }
    },
    /**
     * Freezes the page where it stands: no timers, no frames, no CPU, all of its
     * state. This is what to do with a game while reading a result or editing -
     * thawing is instant, where a relaunch costs seconds and the raid. It needs a
     * built game behind it; see the guard below.
     */
    async freeze() {
      // Vite's dev client reloads a page whose socket went quiet, so a frozen dev
      // page thaws as a fresh load with the raid gone. Measured, not supposed.
      if (await evaluate(`Boolean(document.querySelector('script[src*="/@vite/client"]'))`)) {
        throw new Error(
          'freeze() loses the page on a Vite dev server: pauseLoop() there, or serve a build (README.md).',
        );
      }
      await send('Page.setWebLifecycleState', { state: 'frozen' });
    },
    thaw: () => send('Page.setWebLifecycleState', { state: 'active' }),
    async screenshot(path) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path, Buffer.from(data, 'base64'));
    },
    close: async () => {
      socket.close();
      await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => undefined);
    },
  };
}

export { sleep };
