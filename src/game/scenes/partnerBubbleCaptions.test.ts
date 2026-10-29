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
import { DAY_CARE_KEEPER } from '../base/dayCarePen';
import { CHARACTER_FEET_PIXEL_Y, CHARACTER_HEAD_PIXEL_Y } from '../playerFrames';
import { TILE_SIZE } from '../worldMap';
import { WorldLabel } from '../ui/WorldLabel';
import type { Rect } from '../ui/labelPlacement';
import type { GridPosition } from '../movement/gridMovement';

/**
 * Talking to the partner at the Day-Care fence: the player two tiles west of
 * the Day-Care man, the partner between them, and the heart it
 * answers with seated where the real yard seated it at 800x512 (the stage is
 * 400x256 there). The DAY-CARE MAN caption is the width the real yard measured
 * it at in the game's own face. Before the bubble was ground a caption keeps
 * clear of, that caption sat across it on 46 frames of the one line - the
 * heart drawn through the word "one" - and the Bill's Cottage caption did the
 * same to its greeting on the quay.
 */
const KEEPER = DAY_CARE_KEEPER.position;
const PLAYER: GridPosition = { x: KEEPER.x - 2, y: KEEPER.y };
const PARTNER: GridPosition = { x: KEEPER.x - 1, y: KEEPER.y };
// Measured with the man at (34,11); everything here moves with him.
const SHIFT = (KEEPER.x - 34) * TILE_SIZE;
const BUBBLE = { x: 531 + SHIFT, y: 157 };
const CAPTION = { width: 133, height: 33 };
const VIEW: Rect = { x: 320 + SHIFT, y: 56, width: 400, height: 256 };

function standInScene(): Phaser.Scene {
  const chain: unknown = new Proxy(() => chain, { get: () => () => chain });
  const label = {
    x: 0,
    y: 0,
    width: CAPTION.width - 6,
    height: CAPTION.height - 4,
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
  return { add: { graphics: () => chain, text: () => label } } as unknown as Phaser.Scene;
}

const figureRect = (tile: GridPosition): Rect => ({
  x: tile.x * TILE_SIZE,
  y: tile.y * TILE_SIZE + TILE_SIZE - CHARACTER_FEET_PIXEL_Y + CHARACTER_HEAD_PIXEL_Y,
  width: TILE_SIZE,
  height: CHARACTER_FEET_PIXEL_Y - CHARACTER_HEAD_PIXEL_Y + 1,
});

function yardAtTheFence(saying: boolean) {
  const stage = standInScene();
  const caption = new WorldLabel(stage, {
    subject: figureRect(DAY_CARE_KEEPER.position),
    text: `${DAY_CARE_KEEPER.name}\nRaises one while you raid`,
    tone: { fill: 0, border: 0, ink: '#fff' },
    depth: 0,
    speech: { voice: 'name', tiles: [DAY_CARE_KEEPER.position] },
  });
  const partner = Object.create(PartnerFigure.prototype) as Record<string, unknown>;
  Object.assign(partner, {
    species: 'charmander',
    placeValue: { tile: PARTNER, out: true, facing: 'left' },
    bubble: saying ? { ...BUBBLE } : null,
  });
  const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
  Object.assign(scene, {
    worldLabels: [caption],
    decor: null,
    inspectLabel: null,
    lookMs: 0,
    controls: { look: { isDown: false } },
    currentTile: PLAYER,
    targetTile: null,
    cameras: { main: { worldView: { left: VIEW.x, top: VIEW.y, width: VIEW.width, height: VIEW.height } } },
    place: { room: null },
    hintShown: '',
    dialogBox: { visible: false },
    // Nobody about the harbour with a favour on their mind.
    harbourMarks: new Map(),
    penPokemon: null,
    partner,
    canopyInView: () => [],
  });
  (scene.containWorldLabels as () => void).call(scene);
  const seated = caption as unknown as { windowX: number; windowY: number; label: { visible: boolean } };
  return {
    shown: seated.label.visible,
    rect: { x: seated.windowX, y: seated.windowY, ...CAPTION },
    bubble: (partner.bubbleRect as () => Rect | null).call(partner),
  };
}

const crosses = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

describe("the partner's bubble and the harbour's captions", () => {
  it('seats the Day-Care caption where the bubble will be while the partner says nothing', () => {
    // The ground the fix has to win back: with no bubble up, the caption's
    // own first seat is the one the heart goes on.
    const quiet = yardAtTheFence(false);
    expect(quiet.shown).toBe(true);
    expect(crosses(quiet.rect, { ...BUBBLE, width: 11, height: 15 })).toBe(true);
  });

  it('moves the caption off the bubble while the partner is saying something', () => {
    const talking = yardAtTheFence(true);
    expect(talking.bubble).toEqual({ ...BUBBLE, width: 11, height: 15 });
    expect(talking.shown).toBe(true);
    expect(crosses(talking.rect, talking.bubble as Rect)).toBe(false);
  });
});
