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

import type Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { PartnerFigure } from '../base/partnerFigure';
import { BASE_DOORS, type BaseDoor } from '../base/doors';
import { BASE_TILESET } from '../base/baseTileset';
import { getBaseMap } from '../base/baseMap';
import { TILE_SIZE } from '../worldMap';
import { WorldLabel } from '../ui/WorldLabel';
import type { Rect } from '../ui/labelPlacement';
import type { GridPosition } from '../movement/gridMovement';

/**
 * Coming out of THE BOLTHOLE: the player on its step and the partner
 * tucked in behind them on the tile below, the camera where the real yard put it at
 * 1200x768 (the stage is 400x256 there), and every door's caption the width
 * the real yard measured it at - the house's own once it is named,
 * "OLLY's house · 1 of 11 badges". Over the roof is the wood's canopy and to
 * the west is BROCK'S WORKSHOP, so the one seat left is under the step, and
 * with the partner kept clear of outright the house went unnamed every time
 * anybody walked out of it (`tools/playtest/bolthole.mjs`, outside.png).
 */
const BOLTHOLE = BASE_DOORS.find((door) => door.id === 'bolthole')!;
const PARTNER: GridPosition = { x: BOLTHOLE.returnTo.x, y: BOLTHOLE.returnTo.y + 1 };
const VIEW: Rect = { x: 400, y: 56, width: 400, height: 256 };
const HEIGHT = 33;
const WIDTH: Record<string, number> = {
  'raid-arena': 118,
  'oaks-lab': 123,
  'pokemon-centre': 203,
  'brocks-workshop': 110,
  'bills-cottage': 124,
  bolthole: 146,
};

function standInScene(): Phaser.Scene {
  const chain: unknown = new Proxy(() => chain, { get: () => () => chain });
  const text = (width: number) => {
    const label = {
      x: 0,
      y: 0,
      width: width - 6,
      height: HEIGHT - 4,
      visible: true,
      setOrigin: () => label,
      setDepth: () => label,
      setColor: () => label,
      setVisible: (visible: boolean) => {
        label.visible = visible;
        return label;
      },
      setPosition: (x: number, y: number) => {
        label.x = x;
        label.y = y;
        return label;
      },
    };
    return label;
  };
  return {
    add: { graphics: () => chain, text: (_x: number, _y: number, words: string) => text(WIDTH[words.split('\n')[0]]) },
  } as unknown as Phaser.Scene;
}

function building(door: BaseDoor): Rect {
  const art = BASE_TILESET.props[door.building.prop];
  return {
    x: door.building.x * TILE_SIZE,
    y: door.building.y * TILE_SIZE,
    width: art.width * TILE_SIZE,
    height: art.height * TILE_SIZE,
  };
}

function walkingOutOfTheBolthole() {
  const stage = standInScene();
  const labels = BASE_DOORS.map(
    (door) =>
      new WorldLabel(stage, {
        subject: building(door),
        text: `${door.id}\nstatus`,
        tone: { fill: 0, border: 0, ink: '#fff' },
        depth: 0,
        speech: { voice: 'name', tiles: door.tiles },
      }),
  );
  const partner = Object.create(PartnerFigure.prototype) as Record<string, unknown>;
  Object.assign(partner, {
    species: 'bulbasaur',
    placeValue: { tile: PARTNER, out: true, facing: 'up' },
    bubble: null,
    veiled: false,
  });
  const yard = getBaseMap([]);
  const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
  Object.assign(scene, {
    worldLabels: labels,
    decor: null,
    inspectLabel: null,
    lookMs: 0,
    controls: { look: { isDown: false } },
    currentTile: BOLTHOLE.returnTo,
    targetTile: null,
    cameras: { main: { worldView: { left: VIEW.x, top: VIEW.y, width: VIEW.width, height: VIEW.height } } },
    place: { width: yard.width, height: yard.height, layers: yard.layers, room: null },
    hintShown: '',
    dialogBox: { visible: false },
    penPokemon: null,
    partner,
  });
  (scene.containWorldLabels as () => void).call(scene);
  const house = labels[BASE_DOORS.indexOf(BOLTHOLE)] as unknown as {
    windowX: number;
    windowY: number;
    label: { visible: boolean };
  };
  return {
    named: house.label.visible,
    caption: { x: house.windowX, y: house.windowY, width: WIDTH.bolthole, height: HEIGHT },
    figure: (partner.rect as () => Rect).call(partner),
    veiled: partner.veiled as boolean,
  };
}

const crosses = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

describe('THE BOLTHOLE named as you walk out of it', () => {
  it('names the house with the partner tucked in under the player on its step', () => {
    expect(walkingOutOfTheBolthole().named).toBe(true);
  });

  it('draws the partner faint exactly when the name is seated over it', () => {
    // In the old, tight yard the one seat left was over the partner; the
    // widened yard leaves the house a seat of its own, and a partner nobody
    // writes over is drawn whole.
    const out = walkingOutOfTheBolthole();
    expect(out.veiled).toBe(crosses(out.caption, out.figure));
  });
});
