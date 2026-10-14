import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: { Vector2: class { public x = 0; public y = 0; } },
    Geom: { Rectangle: class { public static Contains = () => true; } },
    Input: { Keyboard: { KeyCodes: {}, JustDown: () => false }, Events: {} },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Scale: { Events: { RESIZE: 'resize' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
    GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
  },
}));

import { BaseScene } from './BaseScene';
import { PartnerFigure } from '../base/partnerFigure';
import { baseGame } from '../base/baseGames.testkit';
import { buildRoom, roomNamed } from '../base/rooms';
import type { Placement } from '../home/arrangement';
import type { RestoredGame } from '../save/SaveManager';
import type { GridPosition } from '../movement/gridMovement';

/**
 * Decorating THE BOLTHOLE with the partner at heel, as the browser played it:
 * the player on (6,6) facing the table, the Charmander on the tile they came
 * from, (7,6), and a Small Desk carried there and put down. The room is drawn
 * again from the new layout (`BaseScene.redrawRoom`, through the real
 * `buildRoom`), and a partner left standing inside a piece has to step out of
 * it to open floor beside the player - never stay drawn under a desk.
 */
const JUNE = new Date(2026, 5, 15, 12);
const DOWNSTAIRS = roomNamed('bolthole')!;
const PLAYER: GridPosition = { x: 6, y: 6 };
const BEHIND: GridPosition = { x: 7, y: 6 };
const BESIDE: GridPosition = { x: 6, y: 7 };

const withDesk = (game: RestoredGame, at: GridPosition | null): RestoredGame => {
  const layout: Placement[] = [...(game.raidProgress.homeLayout ?? defaultLayout(game))];
  return {
    ...game,
    raidProgress: {
      ...game.raidProgress,
      homeLayout: at ? [...layout, { id: 'small-desk', room: 'bolthole', x: at.x, y: at.y, facing: 0 }] : layout,
    },
  };
};
const defaultLayout = (game: RestoredGame): Placement[] =>
  (buildRoom(DOWNSTAIRS, game, JUNE).home?.placed ?? []).map((piece) => ({
    id: piece.id,
    room: piece.room,
    x: piece.x,
    y: piece.y,
    facing: piece.facing,
  }));

function houseWithPartnerAt(tile: GridPosition) {
  const game = baseGame();
  const built = buildRoom(DOWNSTAIRS, game, JUNE);
  const partner = Object.create(PartnerFigure.prototype) as Record<string, unknown>;
  Object.assign(partner, {
    placeValue: { tile: { ...tile }, out: true, facing: 'left' },
    tuck: null,
    step: null,
    sprite: { setVisible: () => ({ setAlpha: () => undefined }) },
    draw: () => undefined,
  });
  const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
  Object.assign(scene, {
    place: { room: built, layers: built.layers, collision: built.collision, sources: built.sources },
    collision: built.collision.map((row) => [...row]),
    bounds: { width: built.collision[0].length, height: built.collision.length },
    currentTile: PLAYER,
    facing: 'left',
    worldLabels: [],
    partner,
    drawMap: () => undefined,
    drawFurniture: () => undefined,
    createRoomCaptions: () => undefined,
  });
  const redraw = (desk: GridPosition | null) =>
    (scene.redrawRoom as (game: RestoredGame) => void).call(scene, withDesk(game, desk));
  const standing = () => (partner.standingTile as () => GridPosition | null).call(partner);
  const blocked = (at: GridPosition) => (scene.isBlocked as (at: GridPosition) => boolean).call(scene, at);
  return { redraw, standing, blocked };
}

describe('the partner when the house is decorated round it', () => {
  it('steps out from under a piece put down on its tile, to open floor beside the player', () => {
    const house = houseWithPartnerAt(BEHIND);
    house.redraw(BEHIND);
    expect(house.blocked(BEHIND)).toBe(true);
    expect(house.standing()).toEqual(BESIDE);
    expect(house.blocked(BESIDE)).toBe(false);
  });

  it('steps out again when the piece follows it to its new tile, and back', () => {
    const house = houseWithPartnerAt(BEHIND);
    house.redraw(BEHIND);
    house.redraw(BESIDE);
    expect(house.standing()).toEqual(BEHIND);
    house.redraw(BEHIND);
    expect(house.standing()).toEqual(BESIDE);
  });

  it('stays where it stands when the piece goes down somewhere else', () => {
    const house = houseWithPartnerAt(BEHIND);
    house.redraw({ x: 9, y: 7 });
    expect(house.blocked({ x: 9, y: 7 })).toBe(true);
    expect(house.standing()).toEqual(BEHIND);
  });
});
