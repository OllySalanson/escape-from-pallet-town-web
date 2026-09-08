import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  HUNTER_ALERT_DISTANCE,
  RAID_CLOCK_CAUTION_MS,
  RAID_CLOCK_URGENT_MS,
  hunterChipView,
  objectiveChipLines,
  raidClockAlertTier,
  raidClockView,
} from './raidHud';
import { ENRAGE_GRACE_MS } from '../run/RunManager';
import { RAID_DURATION_MS } from '../run/raidClock';

const sceneSource = await readFile(new URL('./WorldScene.ts', import.meta.url), 'utf8');
const battleSceneSource = await readFile(new URL('./BattleScene.ts', import.meta.url), 'utf8');
const extractionSceneSource = await readFile(new URL('./ExtractionScene.ts', import.meta.url), 'utf8');

describe('in-run objective HUD layout', () => {
  it('feeds the chip from the raid, and only lets it grow while the objective is new', () => {
    // The panel this replaced was a fixed 164x37 slab over the top-left of the
    // map. The chip is one line unless what it says has just changed.
    expect(objectiveChipLines('LOST KIT: SW', false)).toEqual(['LOST KIT: SW']);
    expect(objectiveChipLines('LOST KIT: SW', true)).toHaveLength(2);
    expect(sceneSource).toContain('this.objectiveDetailMs = OBJECTIVE_DETAIL_MS;');
    expect(sceneSource).toContain('objectiveChipLines(navigationCue, this.objectiveDetailMs > 0)');
  });

  it('keeps the active first-contract destination visible and direction-aware', () => {
    expect(sceneSource).toContain('TRAVEL TO ${WORLD_MAP_NAMES[contract.mapId].toUpperCase()}');
    expect(sceneSource).toContain('LOST KIT: ${directionTo(this.currentTile, contract.position)}');
    expect(sceneSource).toContain('firstContractNavigationCue');
  });

  it('names route transitions from map data and hides areas the first contract does not need', () => {
    expect(sceneSource).toContain('createRouteTransitionLabels');
    expect(sceneSource).toContain('WORLD_MAP_NAMES[warp.destinationMapId].toUpperCase()');
    expect(sceneSource).toContain('poi.label');
    // No area name is hard-coded, so a label can never contradict the map data.
    expect(sceneSource).not.toContain("'VIRIDIAN FOREST'");
    expect(sceneSource).not.toContain("'PALLET TOWN'");
  });
});

describe('finishing a step on an extraction tile', () => {
  const step = sceneSource.slice(
    sceneSource.indexOf('if (this.tryStartHunterBattle()) {'),
    sceneSource.indexOf('private showIdlePose('),
  );

  it('resolves the exit before rolling an encounter, and rolls nothing after it', () => {
    // Authored exits stand in tall grass. Rolling first used to resolve the raid
    // and start a wild battle in the same tick, tearing down the scene the
    // result screen was scheduled on: the raid banked and the player came back
    // to a dead world. Extraction is a destination, so it wins the tick.
    expect(step).toContain('if (this.tryExtract()) {');
    expect(step.indexOf('if (this.tryExtract()) {')).toBeLessThan(
      step.indexOf('isTallGrassInMap(this.currentMap, this.currentTile)'),
    );
    expect(step.indexOf('this.transitionToBattle({')).toBeLessThan(step.length);
    expect(step.slice(step.indexOf('this.transitionToBattle({'))).not.toContain('tryExtract');
  });

  it('reports whether it took the step, so a locked exit also stops the tick', () => {
    const extract = sceneSource.slice(
      sceneSource.indexOf('private tryExtract('),
      sceneSource.indexOf('private showRunResult('),
    );

    expect(extract).toContain('private tryExtract(): boolean {');
    // The two ways out without an exit under the player, then the locked exit.
    expect(extract.match(/return false;/g)).toHaveLength(2);
    expect(extract.match(/return true;/g)).toHaveLength(2);
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
    expect(
      hunterChipView({ searching: true, searchRemainingMs: 6_400, distance: 2, direction: 'N' }),
    ).toEqual({ label: 'OFF TRAIL 7s', tone: 'off-trail' });
    expect(sceneSource).toContain('searching: isHunterSearching(this.hunterState)');
  });

  it('shows a hunter that is actually near, and which way it is', () => {
    // The old HUD said nothing about the hunter unless the player had escaped
    // one, so an arrival announced once in a dialogue box then went silent.
    expect(hunterChipView({ searching: false, distance: 4, direction: 'NW' })).toEqual({
      label: 'HUNTER NW 4',
      tone: 'closing',
    });
    expect(hunterChipView({ searching: false, distance: null, direction: 'HERE' })).toBeNull();
    expect(
      hunterChipView({ searching: false, distance: HUNTER_ALERT_DISTANCE + 1, direction: 'S' }),
    ).toBeNull();
  });
});

describe('raid resolution hand-off', () => {
  it('sends every way a raid can end to the one result screen', () => {
    // Three call sites resolved a raid in three different dialogue scripts. They
    // now build the same report and hand it to the same scene.
    expect(sceneSource).toContain("outcome: 'ESCAPED',");
    expect(sceneSource).toContain("outcome: 'WIPED',");
    expect(sceneSource).toContain("cause: 'timer',");
    expect(battleSceneSource).toContain("cause: 'defeated',");
    expect(sceneSource).toContain("this.scene.start('extraction', { report });");
    expect(battleSceneSource).toContain("this.scene.start('extraction', { report });");
    // Both scenes guard the hand-off: a dialogue completing behind a resolved
    // raid used to start the hub first and skip the screen entirely.
    expect(sceneSource).toContain('if (this.pendingResultScreen) {');
    expect(battleSceneSource).toContain('if (this.pendingResultScreen) {');
    // No resolution may narrate itself through the dialogue box any more.
    expect(sceneSource).not.toContain("'EXTRACTED!'");
    expect(sceneSource).not.toContain("'TIME EXPIRED - YOU WERE WIPED.'");
    expect(battleSceneSource).not.toContain("'YOU WERE WIPED.'");
  });

  it('will not let the tap that closed the last battle line dismiss the result', () => {
    // Phaser captures SPACE and ENTER game-wide, so an overlay key listener
    // never sees them: the guard has to sit on the button the browser actually
    // activates, which also covers the mouse.
    expect(extractionSceneSource).toContain('const INPUT_LOCK_MS = 900;');
    expect(extractionSceneSource).toContain('control.disabled = true;');
    expect(extractionSceneSource).toContain('this.time.delayedCall(INPUT_LOCK_MS, () => {');
    expect(extractionSceneSource).toContain('if (this.leaving || this.locked) {');
    // Focus is only handed to the button once it can act on the keypress.
    const unlock = extractionSceneSource.slice(extractionSceneSource.indexOf('delayedCall(INPUT_LOCK_MS'));
    expect(unlock.indexOf('control.disabled = false;')).toBeLessThan(
      unlock.indexOf("this.overlay.focus('[data-continue]')"),
    );
  });

  it('keeps a way out of the result screen when the hub scene is unavailable', () => {
    expect(sceneSource).toContain("this.scene.start(this.scene.manager.keys.hub ? 'hub' : 'title');");
    expect(battleSceneSource).toContain("this.scene.start(this.scene.manager.keys.hub ? 'hub' : 'title');");
    expect(extractionSceneSource).toContain("this.scene.manager.keys.hub ? 'hub' : 'title'");
  });
});

describe('the raid clock chip', () => {
  it('stays quiet for most of the raid and escalates as it runs out', () => {
    expect(raidClockView(RAID_DURATION_MS, false, ENRAGE_GRACE_MS)).toEqual({
      label: 'RAID 5:00',
      tone: 'calm',
      pulses: false,
    });
    expect(raidClockView(RAID_CLOCK_CAUTION_MS, false, ENRAGE_GRACE_MS).tone).toBe('caution');
    expect(raidClockView(RAID_CLOCK_URGENT_MS, false, ENRAGE_GRACE_MS).tone).toBe('urgent');
  });

  it('only pulses once it is an alarm, so it can be ignored the rest of the time', () => {
    expect(raidClockView(RAID_CLOCK_CAUTION_MS, false, ENRAGE_GRACE_MS).pulses).toBe(false);
    expect(raidClockView(RAID_CLOCK_URGENT_MS, false, ENRAGE_GRACE_MS).pulses).toBe(true);
    expect(raidClockView(0, true, ENRAGE_GRACE_MS).pulses).toBe(true);
  });

  it('fires the flash and the warning sting on exactly the threshold it always did', () => {
    expect(raidClockAlertTier(RAID_CLOCK_URGENT_MS + 1)).toBe('normal');
    expect(raidClockAlertTier(RAID_CLOCK_URGENT_MS)).toBe('urgent');
    // Caution is a colour, not an interruption.
    expect(raidClockAlertTier(RAID_CLOCK_CAUTION_MS)).toBe('normal');
  });

  it('counts the grace period down once the raid clock is spent', () => {
    // Enrage used to replace the clock with a fixed sentence, so the fifteen
    // seconds that still decide the raid were the one number not on screen.
    expect(raidClockView(0, true, 12_000).label).toBe('ENRAGED 0:12');
    expect(raidClockView(0, true, 0)).toEqual({
      label: 'ENRAGED 0:00',
      tone: 'enraged',
      pulses: true,
    });
  });
});
