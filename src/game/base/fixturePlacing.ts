import type { GridPosition } from '../movement/gridMovement';
import { BASE_FIXTURES, fixtureAt, placeIndex, type BaseFixture, type FixturePlaces } from './fixtures';

/**
 * Choosing where one of Brock's builds stands, in the yard itself (the owner,
 * 26 Nov 2026: "you get to place it and pick what you're doing"). BROCK'S
 * WORKSHOP sends the player out to it with BUILD IT, or with MOVE IT for one
 * that stands already; the arrows step the build between its places
 * (`BaseFixture.places`), ENTER puts it there and ESC goes back to the
 * workshop. Building spends the parts when ENTER is pressed, never before;
 * moving is free.
 *
 * This is the choosing; `BaseScene` draws it - the build as a ghost in the
 * place, ringed in gold, with the camera on it - and writes the answer.
 */

/** What the workshop hands the yard. */
export interface PlacingAsk {
  readonly upgradeId: string;
  /** Building it spends its parts on ENTER; moving one that stands is free. */
  readonly mode: 'build' | 'move';
}

export interface Placing extends PlacingAsk {
  readonly fixture: BaseFixture;
  /** The place on show. */
  readonly index: number;
}

/** Placing begins where the build stands, or for a new one in its first place. */
export function startPlacing(ask: PlacingAsk, places: FixturePlaces = {}): Placing | null {
  const fixture = BASE_FIXTURES.find((each) => each.upgradeId === ask.upgradeId);
  if (!fixture) {
    return null;
  }
  return { ...ask, fixture, index: ask.mode === 'move' ? placeIndex(fixture, places) : 0 };
}

/** The next place along, either way round, wrapping at the ends. */
export function stepPlacing(placing: Placing, by: 1 | -1): Placing {
  const count = placing.fixture.places.length;
  return { ...placing, index: (placing.index + by + count) % count };
}

/** The build as it would stand in the place on show. */
export function placedAt(placing: Placing): BaseFixture {
  return fixtureAt(placing.fixture, placing.index);
}

/** The keys along the bottom while choosing: short enough for the hint line's one row. */
export function placingHint(placing: Placing): string {
  const keys = placing.fixture.places.length > 1 ? '[ARROWS] PLACE   ' : '';
  return `${keys}[ENTER] ${placing.mode === 'build' ? 'BUILD IT' : 'PUT IT'}   [ESC] BACK`;
}

/** The caption over the build on show: what it is, where, and which of how many. */
export function placingCaption(placing: Placing): string {
  const { fixture, index } = placing;
  return `${fixture.name}\n${fixture.places[index].name}  ${index + 1} OF ${fixture.places.length}`;
}

/** What is said once it stands there. */
export function placedLine(placing: Placing): string {
  const { fixture, index } = placing;
  return placing.mode === 'build'
    ? `${fixture.name} is in, ${fixture.places[index].name}. It's staying.`
    : `${fixture.name} stands ${fixture.places[index].name} now.`;
}

/** Where the player is put down to see it: in front of the tile it is read at. */
export function standToSee(fixture: BaseFixture, open: (tile: GridPosition) => boolean): GridPosition | undefined {
  const { at } = fixture;
  return [
    { x: at.x, y: at.y + 1 },
    { x: at.x - 1, y: at.y },
    { x: at.x + 1, y: at.y },
    { x: at.x, y: at.y - 1 },
  ].find(open);
}
