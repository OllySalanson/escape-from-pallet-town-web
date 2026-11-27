import { describe, expect, it } from 'vitest';
import { advancePokemonJump, FRAME_MS, startPokemonJump, type PokemonJumpGame } from './pokemonJump';
import { advanceBerryPicking, startBerryPicking } from './berryPicking';
import {
  FIRST_MOVE_PACE,
  FIRST_PACE,
  jumpNowClears,
  learnt,
  PACE_EASE_MS,
  paceAfter,
  paceScale,
  READY_MS,
  readyBeat,
  readyKey,
  tickReady,
} from './readyBeat';

describe('the ready beat', () => {
  it('steps along the lineups with LEFT and RIGHT, round from the last to the first', () => {
    const beat = readyBeat(0, 3);
    expect(readyKey(beat, 'ArrowRight')).toEqual({ kind: 'choose', index: 1 });
    expect(readyKey(beat, 'ArrowLeft')).toEqual({ kind: 'choose', index: 2 });
    expect(readyKey(readyBeat(2, 3), 'd')).toEqual({ kind: 'choose', index: 0 });
    // W A S D are the arrows, Caps Lock or not.
    expect(readyKey(beat, 'A')).toEqual({ kind: 'choose', index: 2 });
  });

  it('has nothing to step to with one lineup, and starts on SPACE and leaves on ESC', () => {
    const beat = readyBeat(0, 1);
    expect(readyKey(beat, 'ArrowRight')).toBeNull();
    expect(readyKey(beat, ' ')).toEqual({ kind: 'go' });
    expect(readyKey(beat, 'Enter')).toEqual({ kind: 'go' });
    expect(readyKey(beat, 'Escape')).toEqual({ kind: 'leave' });
    expect(readyKey(beat, 'ArrowUp')).toEqual({ kind: 'level', step: -1 });
  });

  it('runs out by itself, a 100 ms frame spending 100 ms of it, with no press at all', () => {
    let beat = readyBeat(0, 2);
    let frames = 0;
    for (; frames < 100; frames += 1) {
      const ticked = tickReady(beat, 100);
      beat = ticked.beat;
      if (ticked.go) break;
    }
    expect((frames + 1) * 100).toBe(READY_MS);
  });
});

describe('the first move, slowed', () => {
  it('runs slowed until the first move, then comes up to full speed', () => {
    expect(paceScale(FIRST_PACE)).toBe(FIRST_MOVE_PACE);
    expect(paceScale(paceAfter(FIRST_PACE, 10_000))).toBe(FIRST_MOVE_PACE);
    const now = learnt(FIRST_PACE);
    expect(paceScale(now)).toBe(FIRST_MOVE_PACE);
    expect(paceScale(paceAfter(now, PACE_EASE_MS / 2))).toBeGreaterThan(FIRST_MOVE_PACE);
    expect(paceScale(paceAfter(now, PACE_EASE_MS))).toBe(1);
  });

  /**
   * A slowed game is the same game: POKéMON JUMP and BERRY PICKING are
   * FireRed frame counts, so handing them the player's time slowed plays the
   * very same frames, presses landing on the very same frames, and scores the
   * very same points. Nothing about the rules or the pay is touched.
   */
  it('plays POKéMON JUMP frame for frame the same, slowed or not', () => {
    // Pressed the moment the ghost says a press would clear the vine, every
    // swing, in sixteen-millisecond frames of the player's time.
    const play = (scale: number): PokemonJumpGame => {
      let game = startPokemonJump(['charmander', 'rattata'], 7);
      let pressedOn = -1;
      while (!game.over && game.frame < 60 * 30) {
        const press = game.frame !== pressedOn && jumpNowClears(game);
        if (press) pressedOn = game.frame;
        game = advancePokemonJump(game, 16 * scale, press);
      }
      return game;
    };
    const full = play(1);
    const slowed = play(FIRST_MOVE_PACE);
    expect(slowed.frame).toBe(full.frame);
    expect(slowed.score).toBe(full.score);
    expect(slowed.jumpsInRow).toBe(full.jumpsInRow);
    expect(full.jumpsInRow).toBeGreaterThan(3);
  });

  it('plays BERRY PICKING frame for frame the same, slowed or not', () => {
    const play = (scale: number) => {
      let game = startBerryPicking('dodrio');
      for (let ms = 0; ms < 20_000 && !game.over; ms += 16) game = advanceBerryPicking(game, 16 * scale, null);
      return game;
    };
    // Untouched, the same berries fall the same way: the slowed game is only further behind.
    let full = startBerryPicking('dodrio');
    const slowed = play(FIRST_MOVE_PACE);
    while (full.frame < slowed.frame) full = advanceBerryPicking(full, FRAME_MS, null);
    expect(full.columns).toEqual(slowed.columns);
    expect(full.missed).toBe(slowed.missed);
  });

  it("shows the jump's ghost only while a press now would clear the vine", () => {
    let game = startPokemonJump(['pikachu'], 3);
    let shown = 0;
    while (!game.over && game.frame < 60 * 20) {
      if (jumpNowClears(game)) {
        shown += 1;
        // Pressed in the ghost's moment, the vine is cleared and nobody is hit.
        let tried = advancePokemonJump(game, 0, true);
        let cleared = false;
        for (let frame = 0; frame < 400 && !tried.over; frame += 1) {
          tried = advancePokemonJump(tried, FRAME_MS, false);
          if (tried.events.some((event) => event.kind === 'cleared')) {
            cleared = true;
            break;
          }
        }
        expect(cleared).toBe(true);
        expect(tried.jumpers.some((jumper) => jumper.hit)).toBe(false);
        game = advancePokemonJump(game, 0, true);
      }
      game = advancePokemonJump(game, FRAME_MS, false);
    }
    expect(shown).toBeGreaterThan(0);
  });
});
