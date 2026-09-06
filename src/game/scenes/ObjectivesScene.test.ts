import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const overlaySource = await readFile(new URL('./ObjectivesScene.ts', import.meta.url), 'utf8');
const worldSource = await readFile(new URL('./WorldScene.ts', import.meta.url), 'utf8');
const menuOverlaySource = await readFile(new URL('../ui/MenuOverlay.ts', import.meta.url), 'utf8');

describe('raid objective overlay controls', () => {
  it('opens through O and publishes the same shortcut in the raid HUD', () => {
    expect(worldSource).toContain('KeyCodes.O');
    expect(worldSource).toContain('O: FIELD GUIDE');
    expect(worldSource).toContain("this.scene.launch('objectives'");
  });

  it('pauses the world and suppresses its update input while the field guide is open', () => {
    expect(worldSource).toMatch(/JustDown\(this\.controls\.objectives\)[\s\S]*?this\.openObjectives\(\)[\s\S]*?return;/);
    expect(worldSource).toMatch(/private openObjectives\(\)[\s\S]*?this\.scene\.pause\(\)[\s\S]*?pausedWorld: true/);
  });

  it('closes with O, Escape, or the visible close control', () => {
    expect(overlaySource).toMatch(/event\.key === 'o'[\s\S]*?event\.key === 'Escape'/);
    expect(overlaySource).toContain('data-close');
    expect(overlaySource).toContain("querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.close()");
  });

  it('resumes only a world scene this overlay paused and cleans up on scene shutdown', () => {
    expect(overlaySource).toContain("this.pausedWorld && this.scene.isPaused('world')");
    expect(overlaySource).toContain("this.scene.resume('world')");
    expect(menuOverlaySource).toContain('Phaser.Scenes.Events.SHUTDOWN');
  });
});
