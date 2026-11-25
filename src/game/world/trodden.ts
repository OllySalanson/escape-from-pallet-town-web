import { SURVEY_RADIUS } from './minimap';
import { decodeSurvey, encodeSurvey, mergeSurvey, surveyedTiles, type SurveyRecord, type SurveyedMap } from './survey';

/**
 * The tiles the player has actually stood on, kept per map: what THE MAP on M
 * shows in colour (`world/chart.ts`, `ui/MapScreen.ts`).
 *
 * It is not the survey (`survey.ts`). The survey is a disc round every step,
 * which is right for the drop-in screen and the pit - a picture a pixel a tile
 * that should read as a journey - and wrong for this one: the captain asked for
 * the fog to lift on "just the tiles where Sam has walked" (25 Nov 2026), and
 * the whole of a place is what its local's tale is for. So it is kept beside
 * the survey, in the survey's own bitset, and written at the same moment: once,
 * when the raid ends (`SaveManager.recordRaidEnded`).
 */

/** Adds this raid's steps to what a save already held for that map. */
export function mergeTrodden(record: SurveyedMap | undefined, width: number, steps: Iterable<number>): SurveyedMap {
  return mergeSurvey(record, width, steps);
}

/** The tiles of one map that have been stood on, as row-major indices at `width`. */
export function troddenTiles(record: SurveyedMap | undefined, width: number): ReadonlySet<number> {
  return surveyedTiles(record, width);
}

/**
 * The steps a save from before this record was kept must have taken, read back
 * off its survey: every tile whose whole survey disc was surveyed. A disc was
 * written round every step, so every step is in here; what else is - the middle
 * of a square walked round, say - is ground the player all but stood on. A
 * player who had walked half the vale would otherwise open THE MAP on fog.
 */
export function troddenFromSurvey(survey: SurveyRecord): SurveyRecord {
  const record: Record<string, SurveyedMap> = {};
  for (const [mapId, held] of Object.entries(survey)) {
    const { width, tiles } = decodeSurvey(held);
    if (width === 0) {
      continue;
    }
    const steps = new Set<number>();
    for (const tile of tiles) {
      const x = tile % width;
      const y = (tile - x) / width;
      if (discSurveyed(tiles, width, x, y)) {
        steps.add(tile);
      }
    }
    record[mapId] = encodeSurvey(width, steps);
  }
  return record;
}

/** Whether every tile of the survey's disc round (x, y) on the map was surveyed. Off the map's top, left or right is not asked about. */
function discSurveyed(tiles: ReadonlySet<number>, width: number, x: number, y: number): boolean {
  const radius = SURVEY_RADIUS;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius + 1) {
        continue;
      }
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width) {
        continue;
      }
      if (!tiles.has(ny * width + nx)) {
        return false;
      }
    }
  }
  return true;
}
