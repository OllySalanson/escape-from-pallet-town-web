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

/**
 * The picture for one thing a room paints from the save: the same answer for the
 * scene that hangs it and the tool that draws a room without a browser
 * (`tools/base/renderBase.mts`).
 */
export function roomPosterPicture(game: RestoredGame, poster: RoomPoster): PaintedPicture {
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
    case 'goods-shelf':
      return shelfPoster(poster.area, sheetedColumns(poster.area, traderCounterFor(game)));
  }
}
