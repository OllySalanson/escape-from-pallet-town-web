import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const sceneSource = await readFile(new URL('./WorldScene.ts', import.meta.url), 'utf8');

describe('in-run objective HUD layout', () => {
  it('wraps long text and grows the backing to fit all wrapped lines', () => {
    expect(sceneSource).toMatch(/wordWrap: \{ width: 148, useAdvancedWrap: true \}/);
    expect(sceneSource).toContain('.setSize(164, objectivesHeight)');
    expect(sceneSource).toContain('.setY(24 + objectivesHeight / 2)');
  });

  it('keeps the active first-contract destination visible and direction-aware', () => {
    expect(sceneSource).toContain('SOUTH: ROUTE 1');
    expect(sceneSource).toContain('LOST KIT: ${directionTo(this.currentTile, contract.position)}');
    expect(sceneSource).toContain('firstContractNavigationCue');
  });

  it('labels the first route transition and Oak’s Field Station without exposing the forest gate', () => {
    expect(sceneSource).toContain('createRouteTransitionLabels');
    expect(sceneSource).toContain("destinationName = warp.destinationMapId === 'route-1' ? 'ROUTE 1' : 'PALLET TOWN'");
    expect(sceneSource).toContain('poi.label');
    expect(sceneSource).not.toContain("'VIRIDIAN FOREST'");
  });
});
