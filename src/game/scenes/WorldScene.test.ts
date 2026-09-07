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

describe('battle return recovery', () => {
  it('clears the battle-transition lock before rebuilding the returned world', () => {
    expect(sceneSource).toContain('this.isWarping = false;');
    expect(sceneSource).toContain('this.targetTile = null;');
    expect(sceneSource).toContain('this.stepProgress = 0;');
  });
});

describe('hunter disengagement wiring', () => {
  it('places the escaped hunter after the map is rebuilt but before its sprite exists', () => {
    const create = sceneSource.slice(sceneSource.indexOf('public create('));
    const rebuild = create.slice(0, create.indexOf('this.createPlayer()'));

    expect(rebuild).toContain('this.createMap();');
    expect(rebuild).toContain('this.applyPendingHunterBreakaway();');
    expect(rebuild.indexOf('this.createMap();')).toBeLessThan(
      rebuild.indexOf('this.applyPendingHunterBreakaway();'),
    );
    expect(rebuild.indexOf('this.applyPendingHunterBreakaway();')).toBeLessThan(
      rebuild.indexOf('this.createEntities();'),
    );
  });

  it('holds both pursuit and re-contact while the hunter has lost the trail', () => {
    const pursuit = sceneSource.slice(sceneSource.indexOf('private advanceHunterPursuit('));
    const contact = sceneSource.slice(sceneSource.indexOf('private tryStartHunterBattle('));

    expect(pursuit.slice(0, pursuit.indexOf('const aggression'))).toContain(
      'isHunterSearching(this.hunterState)',
    );
    expect(contact.slice(0, contact.indexOf('this.pendingTrainerBattle'))).toContain(
      'isHunterSearching(this.hunterState)',
    );
  });

  it('spends the search window on the raid clock, so standing still burns it too', () => {
    expect(sceneSource).toContain('this.advanceHunterSearch(deltaMs);');
    expect(sceneSource).toContain('tickHunterSearch(this.hunterState, deltaMs)');
  });

  it('keeps the remaining escape readable on the HUD instead of hiding it', () => {
    expect(sceneSource).toContain('HUNTER OFF TRAIL ${Math.ceil(');
    expect(sceneSource).toContain('hud.hunterBacking.setVisible(searching)');
  });
});
