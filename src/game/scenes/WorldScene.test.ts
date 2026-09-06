import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const sceneSource = await readFile(new URL('./WorldScene.ts', import.meta.url), 'utf8');

describe('in-run objective HUD layout', () => {
  it('wraps long text and grows the backing to fit all wrapped lines', () => {
    expect(sceneSource).toMatch(/wordWrap: \{ width: 148, useAdvancedWrap: true \}/);
    expect(sceneSource).toContain('.setSize(164, objectivesHeight)');
    expect(sceneSource).toContain('.setY(24 + objectivesHeight / 2)');
  });
});
