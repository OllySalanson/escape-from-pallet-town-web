// A screenshot lands in the folder it is named for, whether or not a driver
// made that folder first: tour.mjs and a dozen others never did, and died with
// ENOENT on the first frame of a run pointed at a fresh output folder.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { writeScreenshot } from './browser.mjs';

describe('writeScreenshot', () => {
  let root;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('makes the output folder a driver was handed', () => {
    root = mkdtempSync(join(tmpdir(), 'eptw-shot-'));
    const path = join(root, 'fresh', 'tour', 'tour-square.png');
    writeScreenshot(path, Buffer.from('frame').toString('base64'));
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe('frame');
  });
});

// A driver stopped by a signal used to leave its browser running under nobody:
// node runs no `exit` listener for a signal it was not listening for. The
// stand-in for the browser here is a `sleep` in a process group of its own,
// which is how `launchBrowser` starts Chromium.
describe('stopWithDriver', () => {
  const alive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const driver = `
    import { spawn } from 'node:child_process';
    import { stopWithDriver } from ${JSON.stringify(fileURLToPath(new URL('./browser.mjs', import.meta.url)))};
    const child = spawn('sleep', ['300'], { detached: true, stdio: 'ignore' });
    stopWithDriver(() => process.kill(-child.pid, 'SIGKILL'));
    console.log(child.pid);
    setInterval(() => {}, 1000);
  `;
  let started;
  afterEach(() => {
    for (const pid of started ?? []) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Already gone, as it should be.
      }
    }
  });

  it.each(['SIGTERM', 'SIGINT', 'SIGHUP'])('ends what the driver started when %s stops the driver', async (signal) => {
    const node = spawn(process.execPath, ['--input-type=module', '-e', driver], { stdio: ['ignore', 'pipe', 'inherit'] });
    const pid = await new Promise((resolve) => node.stdout.once('data', (chunk) => resolve(Number(String(chunk).trim()))));
    started = [node.pid, pid];
    expect(alive(pid)).toBe(true);

    const ended = new Promise((resolve) => node.once('exit', (code) => resolve(code)));
    node.kill(signal);
    // The code a shell reports for a process a signal ended.
    expect(await ended).toBe(128 + { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 }[signal]);
    await expect.poll(() => alive(pid), { timeout: 5_000 }).toBe(false);
  });
});
