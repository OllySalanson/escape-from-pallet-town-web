import { describe, expect, it } from 'vitest';
import { baseGame } from '../base/baseGames.testkit';
import { homeFloorPlans } from '../base/rooms';
import { DEFAULT_HOME_LAYOUT, ownedFurniture, type Placement } from './arrangement';
import {
  decorate,
  decorBox,
  decorRefusalLine,
  heldRefusal,
  startDecorating,
  type DecorAction,
  type DecorContext,
  type DecorResult,
  type DecorState,
} from './decorating';

/**
 * Decorating, played a key at a time: what a player holding a piece of
 * furniture can do, and what each press leaves in the save.
 */

const JUNE = new Date(2026, 5, 15, 12);
const game = baseGame({ progress: { pokedexOwned: [25] } });
const context: DecorContext = {
  plan: homeFloorPlans(game, JUNE).bolthole,
  owned: ownedFurniture(game),
  standing: [{ x: 7, y: 8 }],
};

/** Presses the keys in turn, keeping every result. */
function play(state: DecorState, ...actions: DecorAction[]): DecorResult[] {
  const results: DecorResult[] = [];
  let current = state;
  for (const action of actions) {
    const result = decorate(current, action, context);
    results.push(result);
    current = result.state;
  }
  return results;
}
const last = (results: DecorResult[]) => results[results.length - 1];
const at = (x: number, y: number): DecorAction => ({ kind: 'point', at: { x, y } });
const press: DecorAction = { kind: 'press' };
const start = (layout: readonly Placement[] = DEFAULT_HOME_LAYOUT) => startDecorating('bolthole', layout, { x: 7, y: 7 });

describe('decorating THE BOLTHOLE', () => {
  it('picks a pot plant up and puts it down somewhere else, and only the landing is written', () => {
    const results = play(start(), at(0, 7), press, at(3, 7), press);
    expect(results.map((result) => [result.outcome, result.changed])).toEqual([
      ['moved', false],
      ['picked-up', false],
      ['moved', false],
      ['put-down', true],
    ]);
    // Held by its pot, so it lands with its pot on the cursor.
    expect(last(results).state.layout).toContainEqual({ id: 'pot-plant', room: 'bolthole', x: 3, y: 6, facing: 0 });
    expect(last(results).state.layout).not.toContainEqual({ id: 'pot-plant', room: 'bolthole', x: 0, y: 6, facing: 0 });
  });

  it('keeps hold of a piece it cannot put down, and says why', () => {
    const results = play(start(), at(0, 7), press, at(7, 8), press);
    expect(last(results)).toMatchObject({ outcome: 'refused', changed: false, refusal: { kind: 'on-a-mat' } });
    expect(last(results).state.held?.id).toBe('pot-plant');
    expect(decorRefusalLine(last(results).refusal!)).toBe('KEEP THE MATS CLEAR');
  });

  it('puts a piece it was carrying back where it stood when decorating is called off', () => {
    const results = play(start(), at(14, 7), press, at(10, 4), { kind: 'cancel' });
    expect(last(results)).toMatchObject({ outcome: 'cancelled', changed: false });
    expect(last(results).state.held).toBeNull();
    expect(last(results).state.layout).toContainEqual({ id: 'pot-plant', room: 'bolthole', x: 14, y: 6, facing: 1 });
  });

  it('takes things out of the box with Q and E, one kind at a time, and back', () => {
    const state = start();
    const first = decorBox(state, context.owned)[0].definition.id;
    const second = decorBox(state, context.owned)[1].definition.id;
    const results = play(state, { kind: 'box', step: 1 }, { kind: 'box', step: 1 }, { kind: 'box', step: -1 });
    expect(results.map((result) => result.state.held?.id)).toEqual([first, second, first]);
    // What is in hand is not in the box.
    expect(decorBox(results[0].state, context.owned).map((entry) => entry.definition.id)).not.toContain(first);
    // And a press on empty floor takes out the one the box is on.
    expect(play(state, at(10, 6), press)[1]).toMatchObject({ outcome: 'took-out' });
  });

  it('puts a piece away in the box, which empties its place in the room', () => {
    const results = play(start(), at(0, 7), { kind: 'put-away' });
    expect(last(results)).toMatchObject({ outcome: 'boxed', changed: true });
    expect(last(results).state.layout.filter((each) => each.id === 'pot-plant')).toHaveLength(1);
    expect(decorBox(last(results).state, context.owned).map((entry) => entry.definition.id)).toContain('pot-plant');
  });

  it('turns what it is carrying, and turns a piece where it stands if it still fits', () => {
    const results = play(start(), at(0, 7), press, { kind: 'turn' });
    expect(last(results).state.held?.facing).toBe(1);
    const inPlace = play(start(), at(14, 6), { kind: 'turn' });
    expect(last(inPlace)).toMatchObject({ outcome: 'turned', changed: true });
    expect(last(inPlace).state.layout).toContainEqual({ id: 'pot-plant', room: 'bolthole', x: 14, y: 6, facing: 0 });
  });

  it('will not take the table out from under a doll', () => {
    const layout: Placement[] = [...DEFAULT_HOME_LAYOUT, { id: 'doll-25', room: 'bolthole', x: 6, y: 4, facing: 0 }];
    // The doll is on top, so a press on its tile picks up the doll.
    expect(play(start(layout), at(6, 4), press)[1].state.held?.id).toBe('doll-25');
    // Anywhere else on the table, the table is refused while the doll is on it.
    const refused = play(start(layout), at(7, 5), press)[1];
    expect(refused).toMatchObject({ outcome: 'refused', refusal: { kind: 'carrying', what: 'PIKACHU DOLL' } });
    expect(decorRefusalLine(refused.refusal!)).toBe('TAKE THE PIKACHU DOLL OFF IT FIRST');
  });

  it('puts a doll on a desk', () => {
    const layout: Placement[] = [{ id: 'small-desk', room: 'bolthole', x: 10, y: 6, facing: 0 }];
    let state = start(layout);
    // Take the Pikachu doll out of the box.
    for (let guard = 0; state.held?.id !== 'doll-25' && guard < 200; guard += 1) {
      state = decorate(state, { kind: 'box', step: 1 }, context).state;
    }
    expect(state.held?.id).toBe('doll-25');
    const placed = play(state, at(10, 6), press);
    expect(last(placed)).toMatchObject({ outcome: 'put-down', changed: true });
    // Written after the desk, so it reads back on top of it.
    expect(last(placed).state.layout.map((each) => each.id)).toEqual(['small-desk', 'doll-25']);
  });

  it('will not put a piece down on the player, and keeps the way out open', () => {
    const state = play(start(), at(0, 7), press)[1].state;
    const onPlayer = decorate({ ...state, cursor: { x: 7, y: 8 } }, press, { ...context, standing: [{ x: 10, y: 7 }] });
    expect(onPlayer.refusal).toEqual({ kind: 'on-a-mat' });
    expect(heldRefusal({ ...state, cursor: { x: 10, y: 7 } }, { ...context, standing: [{ x: 10, y: 6 }] })).toEqual({
      kind: 'under-you',
    });
  });

  it('keeps the cursor in the room', () => {
    const results = play(start(), at(40, -3));
    expect(results[0].state.cursor).toEqual({ x: 14, y: 0 });
  });
});
