import { describe, expect, it } from 'vitest';
import { advanceCalls, CALL_REACH_TILES, CALL_SHOWN_MS, NO_CALL, type Caller, type CallState } from './villageCalls';

const caller = (id: string, distance: number, calls: readonly string[] = [`${id} says hello`]): Caller => ({ id, distance, calls });
const due: CallState = { ...NO_CALL, untilNextMs: 1 };
const options = (callers: readonly Caller[], frozen = false, deltaMs = 16) => ({ deltaMs, frozen, callers, random: () => 0 });

describe('somebody calling out as a raid goes past', () => {
  it('the nearest in earshot speaks', () => {
    const next = advanceCalls(due, options([caller('far', 8), caller('near', 3)]));
    expect(next.saying?.id).toBe('near');
    expect(next.saying?.words).toBe('near says hello');
  });

  it('nobody out of earshot, or with nothing to say, is heard', () => {
    const next = advanceCalls(due, options([caller('far', CALL_REACH_TILES + 1), caller('mute', 1, [])]));
    expect(next.saying).toBeNull();
    expect(next.untilNextMs).toBeGreaterThan(0);
  });

  it('does not let one person hold the street while somebody else is there', () => {
    const next = advanceCalls({ ...due, lastId: 'near' }, options([caller('near', 2), caller('other', 7)]));
    expect(next.saying?.id).toBe('other');
    const alone = advanceCalls({ ...due, lastId: 'near' }, options([caller('near', 2)]));
    expect(alone.saying?.id).toBe('near');
  });

  it('stops dead while anything is being read', () => {
    const talking = advanceCalls(due, options([caller('near', 2)]));
    expect(talking.saying).not.toBeNull();
    expect(advanceCalls(talking, options([caller('near', 2)], true)).saying).toBeNull();
    expect(advanceCalls(due, options([caller('near', 2)], true)).saying).toBeNull();
  });

  it('ends after its time, and when the player has walked out of earshot', () => {
    const talking = advanceCalls(due, options([caller('near', 2)]));
    const finished = advanceCalls(talking, options([caller('near', 2)], false, CALL_SHOWN_MS + 1));
    expect(finished.saying).toBeNull();
    expect(finished.untilNextMs).toBeGreaterThan(0);
    expect(advanceCalls(talking, options([caller('near', CALL_REACH_TILES + 1)])).saying).toBeNull();
  });
});
