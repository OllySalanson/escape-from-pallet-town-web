// A screenshot lands in the folder it is named for, whether or not a driver
// made that folder first: tour.mjs and a dozen others never did, and died with
// ENOENT on the first frame of a run pointed at a fresh output folder.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
