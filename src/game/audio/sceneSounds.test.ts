import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const scene = (name: string): string =>
  readFileSync(join(__dirname, '..', 'scenes', `${name}.ts`), 'utf8');

/**
 * One event, one sound. Both of these were heard twice before they were found,
 * and neither can be seen in a diff that adds a third.
 */
describe('sounds that used to play twice', () => {
  it('announces a wild encounter in the world and not again in the battle it opens', () => {
    expect(scene('WorldScene')).toContain("audioManager.play('encounter')");
    expect(scene('BattleScene')).not.toContain("play('encounter')");
  });

  it('does not re-announce the clock or the hunter each time a battle hands the raid back', () => {
    const world = scene('WorldScene');
    const create = world.slice(world.indexOf('public create('), world.indexOf('private showFirstDeploymentBriefing'));
    // After the reset that would forget them, and after the hunter state the
    // proximity half reads has been restored.
    expect(create.indexOf('this.resumeThreatsAlreadyAnnounced()')).toBeGreaterThan(
      create.indexOf('this.resetStateFromPreviousRaid()'),
    );
    expect(create.indexOf('this.resumeThreatsAlreadyAnnounced()')).toBeGreaterThan(
      create.indexOf('this.hunterState = data.hunterState'),
    );
  });

  it('hands the hunter and the beaten trainers through a wild battle, as a trainer battle does', () => {
    // Found by ear, so to speak: the play log showed the hunter's arrival
    // sounding again after every wild fight. The wild payload dropped both
    // fields, so the world came back with a fresh hunter and no memory of who
    // had been beaten.
    //
    // Both payloads are now packed by the one `raidCarriage()`, and the round
    // trip itself is driven in `consecutiveRaids.test.ts`; what is held here is
    // that no call site has gone back to writing a payload of its own.
    const world = scene('WorldScene');
    const carriage = world.slice(world.indexOf('private raidCarriage()'), world.indexOf('private clearMap()'));
    expect(carriage).toContain('hunterState: this.hunterState');
    expect(carriage).toContain('defeatedTrainerIds: [...this.defeatedTrainerIds]');
    expect(world).toContain('this.transitionToBattle({ wild, teachingBattle })');
    expect(world.match(/hunterState: this\.hunterState/g)).toHaveLength(1);
  });
});
