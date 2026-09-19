import { describe, expect, it } from 'vitest';
import {
  checkCutscene,
  CutscenePlayer,
  cutsceneTimedMs,
  CUTSCENE_TIMED_CAP_MS,
  PLAYER_ACTOR,
  type Cutscene,
  type CutsceneAction,
} from './cutscene';

const scene = (actions: CutsceneAction[], id = 'test'): Cutscene => ({
  id,
  actors: {
    [PLAYER_ACTOR]: { x: 2, y: 2, facing: 'down' },
    npc: { x: 5, y: 2, facing: 'left' },
  },
  actions,
});

describe('playing a cutscene', () => {
  it('runs its beats in order, a tick at a time', () => {
    const player = new CutscenePlayer(
      scene([
        { kind: 'turn', actor: 'npc', facing: 'down' },
        { kind: 'wait', durationMs: 100 },
        { kind: 'sound', effect: 'bump' },
      ]),
    );
    expect(player.advance(0).actors.get('npc')?.facing).toBe('down');
    expect(player.advance(50).done).toBe(false);
    const last = player.advance(50);
    expect(last.sounds).toEqual(['bump']);
    expect(last.done).toBe(true);
  });

  it('interpolates a walk from where it began, not from where it has got to', () => {
    const player = new CutscenePlayer(
      scene([
        {
          kind: 'move',
          actor: 'npc',
          path: [
            { x: 4, y: 2 },
            { x: 3, y: 2 },
          ],
          stepMs: 100,
        },
      ]),
    );
    player.advance(25);
    player.advance(25);
    // Half a tile covered in two frames, not a quarter of the remaining gap.
    expect(player.advance(0).actors.get('npc')).toMatchObject({ x: 4.5, y: 2, facing: 'left' });
    expect(player.advance(200).actors.get('npc')).toMatchObject({ x: 3, y: 2 });
  });

  it('holds on a line until the player has read it, and bills them for it', () => {
    const player = new CutscenePlayer(
      scene([
        { kind: 'say', lines: ['ONE'] },
        { kind: 'wait', durationMs: 50 },
        { kind: 'say', lines: ['TWO'] },
      ]),
    );
    const first = player.advance(16);
    expect(first.speech?.lines).toEqual(['ONE']);
    expect(first.waitingForPlayer).toBe(true);
    // Time passing changes nothing while the box is up, and the line is raised
    // once rather than again on every frame it stays up.
    expect(player.advance(10_000)).toMatchObject({ speech: null, waitingForPlayer: true });

    player.dialogueClosed();
    expect(player.advance(20).waitingForPlayer).toBe(false);
    expect(player.advance(30).speech?.lines).toEqual(['TWO']);
  });

  it('runs a beat under the one that follows when it is told not to wait', () => {
    const player = new CutscenePlayer(
      scene([
        {
          kind: 'emote',
          actor: 'npc',
          emote: 'spotted',
          durationMs: 200,
          waitForCompletion: false,
        },
        { kind: 'wait', durationMs: 300 },
      ]),
    );
    // The mark is up over a beat that started after it, which is what
    // `waitForCompletion: false` is for - and it adds nothing to the run.
    expect(player.advance(100).actors.get('npc')?.emote).toMatchObject({ elapsedMs: 100 });
    expect(player.advance(150).actors.get('npc')?.emote).toBeNull();
    expect(player.advance(50).done).toBe(true);
  });

  it('plays the same however the frames fall', () => {
    const actions: CutsceneAction[] = [
      { kind: 'emote', actor: 'npc', emote: 'spotted', durationMs: 120 },
      { kind: 'move', actor: 'npc', path: [{ x: 4, y: 2 }], stepMs: 110 },
      { kind: 'wait', durationMs: 90 },
    ];
    const coarse = new CutscenePlayer(scene(actions));
    const fine = new CutscenePlayer(scene(actions));
    coarse.advance(100);
    coarse.advance(100);
    for (let frame = 0; frame < 25; frame += 1) {
      fine.advance(8);
    }
    expect(fine.advance(0).actors).toEqual(coarse.advance(0).actors);
  });
});

describe('what an authored cutscene may not do', () => {
  it('may not leave a beat waiting without a prompt', () => {
    // A `say` that does not wait would walk out from under its own box, which
    // is the dead end the defeat sequence's rule exists to forbid.
    expect(
      checkCutscene(scene([{ kind: 'say', lines: ['...'], waitForCompletion: false }])),
    ).toEqual(['test: action 0 (say) would walk out from under its own dialogue box']);
    expect(checkCutscene(scene([{ kind: 'say', lines: [] }]))[0]).toContain('has no lines');
  });

  it('may not move the player, because the raid owns their tile', () => {
    expect(
      checkCutscene(
        scene([{ kind: 'move', actor: PLAYER_ACTOR, path: [{ x: 2, y: 3 }], stepMs: 100 }]),
      ),
    ).toEqual(['test: action 0 (move) would move the player, and only a turn is safe']);
    expect(
      checkCutscene(scene([{ kind: 'teleport', actor: PLAYER_ACTOR, to: { x: 9, y: 9 } }]))[0],
    ).toContain('teleport the player');
    expect(
      checkCutscene(scene([{ kind: 'show', actor: PLAYER_ACTOR, visible: false }]))[0],
    ).toContain('show the player');
  });

  it('may not hold the world for longer than an event', () => {
    const tooLong = scene([{ kind: 'wait', durationMs: CUTSCENE_TIMED_CAP_MS + 1 }]);
    expect(checkCutscene(tooLong)[0]).toContain('past the');
    expect(() => new CutscenePlayer(tooLong)).toThrow();
  });

  it('may not name an actor it has not placed', () => {
    expect(checkCutscene(scene([{ kind: 'turn', actor: 'nobody', facing: 'up' }]))[0]).toContain(
      'no starting placement',
    );
  });

  it('counts only the time it spends on itself', () => {
    const counted = scene([
      { kind: 'wait', durationMs: 100 },
      { kind: 'emote', actor: 'npc', emote: 'spotted', durationMs: 900, waitForCompletion: false },
      { kind: 'say', lines: ['unbounded, and billed'] },
    ]);
    expect(cutsceneTimedMs(counted)).toBe(100);
    expect(checkCutscene(counted)).toEqual([]);
  });
});
