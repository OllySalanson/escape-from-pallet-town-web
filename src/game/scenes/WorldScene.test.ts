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

  it('keeps the active contract destination visible and direction-aware', () => {
    expect(sceneSource).toContain('TRAVEL TO ${WORLD_MAP_NAMES[contract.mapId].toUpperCase()}');
    // The cue is the marker's own short name, so a contract with three stops
    // names the one you are nearest rather than a hard-coded objective.
    expect(sceneSource).toContain('${next.cue}: ${directionTo(this.currentTile, next.position)}');
    expect(sceneSource).toContain('contractNavigationCue');
    // A contract that banks through one exit says so on the map too, because
    // the temptation is a gate the player walks past with the job in hand.
    expect(sceneSource).toContain('BANK VIA ${contract.requiredExitLabel}');
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

/**
 * A trainer's watch is only a price if finishing a step inside it is what
 * starts the fight, and if nothing else on that tile can be used to buy a free
 * pass through it. Both of these were found by walking the road: the second one
 * because a generated cache landed on a watched tile, the collection returned
 * early, and the checkpoint was walked past without a word.
 */
describe('finishing a step in a trainer watch', () => {
  const step = sceneSource.slice(
    sceneSource.indexOf('private advanceStep('),
    sceneSource.indexOf('private showIdlePose('),
  );

  it('challenges after the exit is resolved and before the grass is rolled', () => {
    expect(step).toContain('if (this.tryTrainerChallengeAt(this.currentTile)) {');
    expect(step.indexOf('if (this.tryExtract()) {')).toBeLessThan(
      step.indexOf('if (this.tryTrainerChallengeAt(this.currentTile)) {'),
    );
    expect(step.indexOf('if (this.tryTrainerChallengeAt(this.currentTile)) {')).toBeLessThan(
      step.indexOf('isTallGrassInMap(this.currentMap, this.currentTile)'),
    );
  });

  it('still challenges on the step that takes something off the watched tile', () => {
    expect(step).toContain('this.tryTrainerChallengeAt(this.currentTile, spoken)');
    // Everything a step can do on its own tile reports its line instead of
    // showing it, so the deed and the challenge arrive as one dialogue rather
    // than one erasing the other. A landmark is on that footing too, or a
    // watched lane could be worked for free by standing on whatever is in it.
    expect(sceneSource).toContain('private tryCollectLootAt(position: GridPosition): string | null');
    expect(sceneSource).toContain(
      'private tryMakeContractStopAt(position: GridPosition): string | null',
    );
    expect(sceneSource).toContain(
      'private tryActivatePoiAt(position: GridPosition): readonly string[] | null',
    );
  });

  it('reads the watch off the trainer facing and the terrain, not off entities', () => {
    const sight = sceneSource.slice(
      sceneSource.indexOf('private isSightBlocked('),
      sceneSource.indexOf('private isBlocked('),
    );
    expect(sight).toContain('this.collisionData[tile.y]?.[tile.x] !== false');
    expect(sight).not.toContain('this.currentMap.entities');
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
    const clock = sceneSource.slice(
      sceneSource.indexOf('private advanceRunClock('),
      sceneSource.indexOf('private refreshExtractionMarkers('),
    );
    // The window and the raid are billed the same milliseconds, so anything that
    // stops one stops the other and an escape can never be idled away for free.
    expect(clock).toContain('this.runSession.manager.tick(clockMs)');
    expect(clock).toContain('this.advanceHunterSearch(clockMs);');
    expect(sceneSource).toContain('tickHunterSearch(this.hunterState, deltaMs)');
  });

  it('stops the raid clock once the raid has committed to a battle', () => {
    // Being caught opens a modal the player did not ask for and cannot walk out
    // of. Charging them raid time for reading it is charging them for the fight
    // twice, and battles themselves are free.
    const clock = sceneSource.slice(
      sceneSource.indexOf('private advanceRunClock('),
      sceneSource.indexOf('private refreshExtractionMarkers('),
    );
    expect(clock).toContain('const clockMs = this.pendingTrainerBattle ? 0 : deltaMs;');
  });

  it('lets a player walk out of a dialogue they did not open', () => {
    // A box that only answers to SPACE and ENTER never says so, so the reflex -
    // press a direction - has to advance the ones the world raised on its own.
    const advance = sceneSource.slice(
      sceneSource.indexOf('private isDialogAdvancePressed('),
      sceneSource.indexOf('private handleDialogInput('),
    );
    expect(advance).toContain('this.isInteractionPressed()');
    expect(advance).toContain('this.unsolicitedDialog');
    for (const key of ['this.controls.up', 'this.controls.down', 'this.controls.left', 'this.controls.right']) {
      expect(advance).toContain(key);
    }
    expect(sceneSource).toContain('if (!this.isDialogAdvancePressed()) {');
    // Every interruption the hunter causes goes through it, and a sign does not.
    expect(sceneSource).toContain("this.interrupt(['A RIVAL HUNTER is on your trail!']);");
    expect(sceneSource).toContain('this.interrupt(this.pendingTrainerBattle.introLines);');
    expect(sceneSource).toContain('this.interrupt([...lead, ...watcher.introLines]);');
    expect(sceneSource).toContain("this.dialogBox.showMessages([...entity!.dialogLines]);");
    // And it is on the per-raid reset list, because it outlives the scene otherwise.
    const reset = sceneSource.slice(
      sceneSource.indexOf('private resetStateFromPreviousRaid('),
      sceneSource.indexOf('public create('),
    );
    expect(reset).toContain('this.unsolicitedDialog = false;');
  });

  it('keeps the remaining escape readable on the HUD instead of hiding it', () => {
    expect(
      hunterChipView({ searching: true, searchRemainingMs: 6_400, distance: 2, direction: 'N' }),
    ).toEqual({ label: 'HUNTER LOST YOU 7s', tone: 'lost-you' });
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

  it('settles every ending against the pack the raid actually came out with', () => {
    // The raid's supplies live in one Bag, balls included. A second ball counter
    // beside it was inventory the settlement could not see, which is why the
    // wipe report had to overwrite its ball line by hand after reading the bag
    // for everything else.
    expect(sceneSource).not.toContain('this.pokeBalls');
    expect(battleSceneSource).not.toContain('this.pokeBalls');
    expect(battleSceneSource).toContain("this.bag.remove('poke-ball', 1)");
    // Both lost endings divide that pack the same way: a secured supply comes
    // home only if it was still in it, and only what was still in it was lost.
    expect(sceneSource).toContain(
      'const wipe = buildWipeSettlement(this.runSession.secureSlot.items ?? [], carriedOut);',
    );
    expect(battleSceneSource).toContain(
      'const wipe = buildWipeSettlement(this.runSession.secureSlot.items ?? [], carriedOut);',
    );
    expect(sceneSource).toContain('items: wipe.destroyedItems },');
    expect(battleSceneSource).toContain('items: wipe.destroyedItems },');
    expect(sceneSource).toContain('{ ...this.runSession.stashSecureSlot, items: wipe.securedItems }');
    expect(battleSceneSource).toContain(
      '{ ...this.runSession.stashSecureSlot, items: wipe.securedItems }',
    );
    // And a survived raid banks the settlement's own gain rather than the
    // pickups it recorded: loot found and then drunk left the stash unchanged.
    expect(sceneSource).toContain('...settlement.supplies.filter(({ quantity }) => quantity > 0),');
    expect(sceneSource).not.toContain('...snapshot.foundItems,');
  });

  it('will not let the tap that closed the last battle line dismiss the result', () => {
    // Phaser captures SPACE and ENTER game-wide, so an overlay key listener
    // never sees them: the guard has to sit on the button the browser actually
    // activates, which also covers the mouse.
    expect(extractionSceneSource).toContain('const INPUT_LOCK_MS = 900;');
    expect(extractionSceneSource).toContain('control.disabled = true;');
    // A defeat opens on its sequence and hands the report the same full lock the
    // moment it is skipped, so the tap that ends the animation is never also the
    // tap that dismisses the ledger.
    expect(extractionSceneSource).toContain('this.showReport(INPUT_LOCK_MS);');
    expect(extractionSceneSource).toContain('this.showReport(skipped ? INPUT_LOCK_MS : SETTLED_LOCK_MS);');
    expect(extractionSceneSource).toContain('this.time.delayedCall(lockMs, () => {');
    expect(extractionSceneSource).toContain('if (this.leaving || this.locked) {');
    // Focus is only handed to the button once it can act on the keypress.
    const unlock = extractionSceneSource.slice(extractionSceneSource.indexOf('delayedCall(lockMs'));
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
