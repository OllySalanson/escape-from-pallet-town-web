import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { objectiveChipLines } from './raidHud';

const overlaySource = await readFile(new URL('./ObjectivesScene.ts', import.meta.url), 'utf8');
const worldSource = await readFile(new URL('./WorldScene.ts', import.meta.url), 'utf8');
const menuOverlaySource = await readFile(new URL('../ui/MenuOverlay.ts', import.meta.url), 'utf8');


describe('raid objective overlay controls', () => {
  it('opens through O, and the chip names no key', () => {
    expect(worldSource).toContain('KeyCodes[RAID_KEY_LETTERS.objectives]');
    expect(worldSource).toContain("this.scene.launch('objectives'");
    // The overworld is FireRed's screen: O is named on the controls bar, never on the map.
    expect(objectiveChipLines('LOST KIT: SW', true)).toEqual(['LOST KIT: SW']);
  });

  it('pauses the world and suppresses its update input while the field guide is open', () => {
    expect(worldSource).toMatch(/justPressed\(this\.controls\.objectives\)[\s\S]*?this\.answerRadioKey\(\)[\s\S]*?return;/);
    expect(worldSource).toMatch(/private openObjectives\(\)[\s\S]*?this\.scene\.pause\(\)[\s\S]*?pausedWorld: true/);
  });

  it('closes with O, Escape, or the visible close control', () => {
    // The shared rule is what says Escape and the opening key both close an
    // overlay; `overlayKeyboard.test.ts` proves the key reaches it at all.
    expect(overlaySource).toContain("isOverlayDismissKey(event, 'o')");
    expect(overlaySource).toContain('data-close');
    expect(overlaySource).toContain("querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.close()");
  });

  it('resumes only a world scene this overlay paused and cleans up on scene shutdown', () => {
    expect(overlaySource).toContain("this.pausedWorld && this.scene.isPaused('world')");
    expect(overlaySource).toContain("this.scene.resume('world')");
    expect(menuOverlaySource).toContain('Phaser.Scenes.Events.SHUTDOWN');
  });
});
