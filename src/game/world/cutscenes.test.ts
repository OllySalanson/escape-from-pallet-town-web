import { describe, expect, it } from 'vitest';
import {
  APPROACH_ALERT_MS,
  APPROACH_SETTLE_MS,
  APPROACH_STEP_MS,
  CATCH_ALERT_MS,
  hunterCatchCutscene,
  trainerApproachCutscene,
} from './cutscenes';
import { planTrainerApproach } from './trainerApproach';
import { createRunTrainerEncounters } from './trainers';
import {
  checkCutscene,
  CutscenePlayer,
  cutsceneTimedMs,
  PLAYER_ACTOR,
  CUTSCENE_TIMED_CAP_MS,
} from '../cutscene/cutscene';

const approachTo = (player: { x: number; y: number }) =>
  trainerApproachCutscene(
    'watcher',
    { x: 0, y: 4 },
    'up',
    player,
    ['I SAW THAT.'],
    planTrainerApproach({ x: 0, y: 4 }, 'up', player, 4),
  );

describe('the trainer approach, as an authored cutscene', () => {
  it('turns the player, marks the trainer, walks them up and only then speaks', () => {
    const scene = approachTo({ x: 0, y: 0 });
    expect(scene.actions.map((action) => action.kind)).toEqual([
      'turn',
      'sound',
      'emote',
      'move',
      'wait',
      'say',
    ]);
    // The player is turned to look at whoever caught them, never moved.
    expect(scene.actions[0]).toMatchObject({ actor: PLAYER_ACTOR, facing: 'down' });
  });

  it('holds the mark, then walks, then settles, then is done', () => {
    const player = new CutscenePlayer(approachTo({ x: 0, y: 0 }));
    const at = (elapsed: number) => player.advance(elapsed).actors.get('watcher')!;

    expect(at(0)).toMatchObject({ x: 0, y: 4, emote: { kind: 'spotted', elapsedMs: 0 } });
    expect(at(APPROACH_ALERT_MS - 1).emote).not.toBeNull();
    // Half a tile into the first leg of the walk, and the mark is down.
    const halfway = at(1 + APPROACH_STEP_MS / 2);
    expect(halfway).toMatchObject({ x: 0, y: 3.5, facing: 'up', emote: null });

    const arrived = player.advance(3 * APPROACH_STEP_MS);
    expect(arrived.actors.get('watcher')).toMatchObject({ x: 0, y: 1 });
    // The breath before the line: still running itself, nobody is being billed.
    expect(arrived.waitingForPlayer).toBe(false);
    expect(arrived.speech).toBeNull();

    const spoken = player.advance(APPROACH_SETTLE_MS);
    expect(spoken.speech?.lines).toEqual(['I SAW THAT.']);
    expect(spoken.waitingForPlayer).toBe(true);
  });

  it('covers the same ground however the frames fall', () => {
    const inOneGo = new CutscenePlayer(approachTo({ x: 0, y: 0 }));
    const inTenths = new CutscenePlayer(approachTo({ x: 0, y: 0 }));
    inOneGo.advance(700);
    // Ten 70ms frames and one 700ms one are the same walk - the stepClock rule,
    // which is what lets a 100ms test-mode frame play a cutscene honestly.
    for (let frame = 0; frame < 10; frame += 1) {
      inTenths.advance(70);
    }
    expect(inTenths.advance(0).actors).toEqual(inOneGo.advance(0).actors);
  });

  it('still marks, turns and speaks for a trainer with nowhere to walk', () => {
    const beside = trainerApproachCutscene(
      'watcher',
      { x: 5, y: 4 },
      'left',
      { x: 4, y: 4 },
      ['I SAW THAT.'],
      planTrainerApproach({ x: 5, y: 4 }, 'left', { x: 4, y: 4 }, 4),
    );
    expect(beside.actions.map((action) => action.kind)).toEqual([
      'turn',
      'sound',
      'emote',
      'wait',
      'say',
    ]);
    expect(checkCutscene(beside)).toEqual([]);
  });

  it("does not raise a mark that would sit on the player's own face", () => {
    // Caught on the nearest watched tile, the trainer is the tile directly
    // below the player and the mark would be drawn over their head.
    const adjacent = trainerApproachCutscene(
      'watcher',
      { x: 4, y: 5 },
      'up',
      { x: 4, y: 4 },
      ['I SAW THAT.'],
      planTrainerApproach({ x: 4, y: 5 }, 'up', { x: 4, y: 4 }, 4),
    );
    expect(adjacent.actions.map((action) => action.kind)).toEqual([
      'turn',
      'sound',
      'wait',
      'wait',
      'say',
    ]);
    // The beat is the same length either way: only the ink is dropped.
    expect(cutsceneTimedMs(adjacent)).toBe(APPROACH_ALERT_MS + APPROACH_SETTLE_MS);
    // From any other side it is raised, because it covers nobody.
    const fromTheSide = trainerApproachCutscene(
      'watcher',
      { x: 5, y: 4 },
      'left',
      { x: 4, y: 4 },
      ['I SAW THAT.'],
      planTrainerApproach({ x: 5, y: 4 }, 'left', { x: 4, y: 4 }, 4),
    );
    expect(fromTheSide.actions.map((action) => action.kind)).toContain('emote');
  });

  it('is an event and not an interruption for every authored watch', () => {
    for (const encounter of createRunTrainerEncounters()) {
      const reach = encounter.sightRange ?? 0;
      if (reach === 0) {
        continue;
      }
      // The worst case is a player caught at the far end of the watch.
      const player = { x: encounter.position.x, y: encounter.position.y - reach };
      const scene = trainerApproachCutscene(
        encounter.trainer.id,
        encounter.position,
        'up',
        player,
        encounter.introLines,
        planTrainerApproach(encounter.position, 'up', player, reach),
      );
      expect(checkCutscene(scene)).toEqual([]);
      expect(cutsceneTimedMs(scene)).toBeLessThan(1200);
      expect(cutsceneTimedMs(scene)).toBeLessThanOrEqual(CUTSCENE_TIMED_CAP_MS);
    }
  });
});

describe('the hunter catch', () => {
  const caught = () =>
    hunterCatchCutscene('rival-hunter', { x: 9, y: 5 }, { x: 8, y: 5 }, 'left', [
      'FOUND YOU.',
      'There is nowhere left to run!',
    ]);

  it("drops the hunter's mark when it has come up from directly below", () => {
    const fromBelow = hunterCatchCutscene('rival-hunter', { x: 8, y: 6 }, { x: 8, y: 5 }, 'up', [
      'FOUND YOU.',
    ]);
    expect(fromBelow.actions.map((action) => action.kind)).not.toContain('emote');
    expect(caught().actions.map((action) => action.kind)).toContain('emote');
  });

  it('has both figures look at each other before a word is said', () => {
    const scene = caught();
    expect(scene.actions[0]).toMatchObject({ actor: 'rival-hunter', facing: 'left' });
    expect(scene.actions[1]).toMatchObject({ actor: PLAYER_ACTOR, facing: 'right' });
    expect(checkCutscene(scene)).toEqual([]);
  });

  it('is shorter than the approach, because the hunter has been walking all raid', () => {
    expect(cutsceneTimedMs(caught())).toBeLessThan(
      APPROACH_ALERT_MS + APPROACH_STEP_MS + APPROACH_SETTLE_MS,
    );
    expect(CATCH_ALERT_MS).toBeLessThan(APPROACH_ALERT_MS);
  });

  it('runs itself as far as the line, and waits there', () => {
    const player = new CutscenePlayer(caught());
    const opening = player.advance(0);
    // The player has turned to face the hunter on the very first instant, so
    // nobody is spoken to from behind.
    expect(opening.actors.get(PLAYER_ACTOR)?.facing).toBe('right');
    expect(opening.sounds).toEqual(['hunterContact']);
    expect(opening.waitingForPlayer).toBe(false);

    const spoken = player.advance(CUTSCENE_TIMED_CAP_MS);
    expect(spoken.speech?.lines[0]).toBe('FOUND YOU.');
    expect(spoken.waitingForPlayer).toBe(true);
    expect(spoken.done).toBe(false);

    player.dialogueClosed();
    expect(player.advance(0).done).toBe(true);
  });
});
