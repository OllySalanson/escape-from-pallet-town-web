import type { RestoredGame } from '../save/SaveManager';
import { traderCounterFor } from '../save/SaveManager';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import type { PaintedPicture } from '../world/minimap';
import { badgeCasePoster } from './badgeCase';
import { sheetedColumns, shelfPoster } from './billGoods';
import { chalkBayPoster, ladderTallyPoster } from './chalk';
import { boardPoster } from './labBoard';
import { pennantsPoster } from './pennants';
import type { RoomPoster } from './rooms';
import { classBoardPoster } from '../arena/classBoard';
import { cupBoardPoster } from '../arena/cupBoard';
import { cabinetLampsPicture, highScoresPicture, tiersPaidToday } from '../minigames/arcade';
import { chartWallPicture } from '../treasure/chartWall';
import { chartTableFacts, chartTablePicture } from '../treasure/chartTable';

/**
 * The picture for one thing a room paints from the save: the same answer for the
 * scene that hangs it and the tool that draws a room without a browser
 * (`tools/base/renderBase.mts`).
 */
export function roomPosterPicture(game: RestoredGame, poster: RoomPoster, now: Date = new Date()): PaintedPicture {
  switch (poster.kind) {
    case 'badge-case':
      return badgeCasePoster(game, poster.area);
    case 'cork-board':
      return boardPoster(game, poster.area);
    case 'pennants':
      return pennantsPoster(game, poster.area);
    case 'chalk-bay':
      return chalkBayPoster(poster.area, poster.upgradeId);
    case 'ladder-tally':
      return ladderTallyPoster(
        poster.area,
        WORKSHOP_UPGRADES.map((upgrade) => game.raidProgress.workshopUpgrades.includes(upgrade.id)),
      );
    case 'class-board':
      return classBoardPoster(game.raidProgress.dojo, poster.area);
    case 'cup-board':
      return cupBoardPoster(game.raidProgress.dojo?.cup, poster.area, now);
    case 'high-scores':
      return highScoresPicture(game.raidProgress, now);
    case 'cabinet-lamps':
      return cabinetLampsPicture(tiersPaidToday(poster.game, game.raidProgress, now));
    case 'goods-shelf':
      return shelfPoster(poster.area, sheetedColumns(poster.area, traderCounterFor(game)));
    case 'chart-wall':
      return chartWallPicture(game.raidProgress.treasureHunt, poster.area);
    case 'chart-table':
      return chartTablePicture(chartTableFacts(game), poster.area);
  }
}
