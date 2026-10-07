import sampleLane from '../../maps/sample/sample-lane.json';
import { buildPlayerMap, readMapFile, type PlayerMapId } from './mapFile';
import { registerPlayerMap } from './playerMaps';

/**
 * Every test file runs with one approved player map in the game, as the live
 * game does the moment the owner approves one (`vitest.config.ts` loads this
 * before each file).
 *
 * The publish workflow runs the suite with the newly approved map in
 * `src/maps/player/`, so a test that assumes the game holds only the shipped
 * maps - a list of the five front doors, a literal count of the board's rows -
 * is a test that stops every map from ever being published (playtest 16, bug
 * 3). With an approved map always present such a test fails here, on the day it
 * is written, rather than on the first map a player sends in.
 *
 * It is the sample lane under an id of its own, so it is a map the suite
 * already holds to every check (`mapFile.test.ts` asks each registered map),
 * and it is registered rather than bundled so it never reaches the real game.
 * It has two exits and two drop-ins, which is what lets the standing board deal
 * it every contract template, a dispatch through a named exit included.
 */
export const PUBLISHED_FIXTURE_MAP_ID: PlayerMapId = 'player-suite-fixture';

const reading = readMapFile({
  ...sampleLane,
  id: 'suite-fixture',
  name: 'Suite Fixture',
  maker: 'The test suite',
});
if (!reading.ok) {
  throw new Error(`The suite's fixture map does not load: ${reading.problems.join(' ')}`);
}
registerPlayerMap(buildPlayerMap(reading.file), { published: true });
