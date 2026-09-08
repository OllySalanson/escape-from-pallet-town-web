import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { WORLD_MAPS } from '../worldMap';
import {
  CHARACTER_FEET_PIXEL_Y,
  CHARACTER_FRAME_WIDTH,
  CHARACTER_HEAD_PIXEL_Y,
} from '../playerFrames';
import {
  getWorldCharacterLook,
  NO_TINT,
  outlineRects,
  PLAYER_MARKER_COLOUR,
  PLAYER_MARKER_DEPTH,
  PLAYER_MARKER_GROUND_LAYERS,
  PLAYER_MARKER_HEAD_LAYERS,
  worldCharacterTint,
  WORLD_CHARACTER_ROLES,
  type MarkerRect,
  type WorldCharacterRole,
} from './characterPresentation';

const OTHER_ROLES = WORLD_CHARACTER_ROLES.filter(
  (role): role is Exclude<WorldCharacterRole, 'player'> => role !== 'player',
);

const ALL_LAYERS = [...PLAYER_MARKER_GROUND_LAYERS, ...PLAYER_MARKER_HEAD_LAYERS];

function pixels(rects: readonly MarkerRect[]): { x: number; y: number }[] {
  return rects.flatMap((rect) =>
    Array.from({ length: rect.height }, (_unusedRow, dy) =>
      Array.from({ length: rect.width }, (_unusedColumn, dx) => ({
        x: rect.x + dx,
        y: rect.y + dy,
      })),
    ).flat(),
  );
}

describe('telling the player apart from the figures sharing their sprite sheet', () => {
  it('leaves no role looking like the player, so an identical sheet cannot hide them', () => {
    const player = getWorldCharacterLook('player');

    for (const role of OTHER_ROLES) {
      const other = getWorldCharacterLook(role);
      expect(other.tint, `${role} shares the player's colouring`).not.toBe(player.tint);
      expect(other.marked, `${role} carries the player's marker`).toBe(false);
    }
  });

  it('marks the player and only the player', () => {
    const marked = WORLD_CHARACTER_ROLES.filter((role) => getWorldCharacterLook(role).marked);

    expect(marked).toEqual(['player']);
  });

  it('keeps the player in the sheet true colours and every other role tinted', () => {
    expect(worldCharacterTint('player')).toBe(NO_TINT);

    for (const role of OTHER_ROLES) {
      expect(worldCharacterTint(role), `${role} is untinted`).not.toBe(NO_TINT);
    }
  });

  it('gives every role a colouring of its own, so roles never read as each other', () => {
    const tints = WORLD_CHARACTER_ROLES.map(worldCharacterTint);

    expect(new Set(tints).size).toBe(WORLD_CHARACTER_ROLES.length);
  });

  it('shades townsfolk more gently than the trainer and hunter warnings', () => {
    const brightness = (tint: number) =>
      ((tint >> 16) & 0xff) + ((tint >> 8) & 0xff) + (tint & 0xff);

    expect(brightness(worldCharacterTint('npc'))).toBeGreaterThan(
      brightness(worldCharacterTint('trainer')),
    );
    expect(brightness(worldCharacterTint('npc'))).toBeGreaterThan(
      brightness(worldCharacterTint('hunter')),
    );
  });
});

describe('the player marker', () => {
  it('marks the player from both ends, so covering one mark cannot hide them', () => {
    expect(PLAYER_MARKER_GROUND_LAYERS.length).toBeGreaterThan(0);
    expect(PLAYER_MARKER_HEAD_LAYERS.length).toBeGreaterThan(0);
  });

  it('reads while standing still: nothing about it depends on the player moving', () => {
    // Every layer is a fixed pixel table with no phase, duration or frame list,
    // so the marker is identical on a stationary player and a walking one.
    for (const layer of ALL_LAYERS) {
      expect(Object.keys(layer).sort()).toEqual(['alpha', 'colour', 'rects']);
    }
  });

  it('uses the interface accent for both marks', () => {
    const accents = ALL_LAYERS.filter((layer) => layer.alpha === 1).map((layer) => layer.colour);

    expect(accents).toEqual([PLAYER_MARKER_COLOUR, PLAYER_MARKER_COLOUR]);
  });

  it('takes the accent from --menu-accent in the stylesheet rather than inventing one', async () => {
    const stylesheet = await readFile(new URL('../../style.css', import.meta.url), 'utf8');
    const accent = `#${PLAYER_MARKER_COLOUR.toString(16).padStart(6, '0')}`;

    expect(stylesheet).toContain(`--menu-accent: ${accent};`);
  });

  it('rests the ground mark on the sole line and never up the legs', () => {
    const ground = pixels(PLAYER_MARKER_GROUND_LAYERS.flatMap((layer) => [...layer.rects]));
    const top = Math.min(...ground.map((pixel) => pixel.y));
    const bottom = Math.max(...ground.map((pixel) => pixel.y));

    expect(top).toBe(CHARACTER_FEET_PIXEL_Y - 2);
    expect(bottom).toBe(CHARACTER_FEET_PIXEL_Y + 1);
  });

  it('holds the head mark clear of the hair', () => {
    const head = pixels(PLAYER_MARKER_HEAD_LAYERS.flatMap((layer) => [...layer.rects]));

    expect(Math.max(...head.map((pixel) => pixel.y))).toBeLessThan(CHARACTER_HEAD_PIXEL_Y);
  });

  it('centres both marks on the figure and keeps them inside the frame width', () => {
    for (const layers of [PLAYER_MARKER_GROUND_LAYERS, PLAYER_MARKER_HEAD_LAYERS]) {
      const drawn = pixels(layers.flatMap((layer) => [...layer.rects]));
      const left = Math.min(...drawn.map((pixel) => pixel.x));
      const right = Math.max(...drawn.map((pixel) => pixel.x));

      expect(left + right).toBe(CHARACTER_FRAME_WIDTH - 1);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThan(CHARACTER_FRAME_WIDTH);
    }
  });

  it('lands on whole pixels, so neither mark blurs against the sprite art', () => {
    for (const layer of ALL_LAYERS) {
      for (const rect of layer.rects) {
        expect(Number.isInteger(rect.x)).toBe(true);
        expect(Number.isInteger(rect.y)).toBe(true);
        expect(Number.isInteger(rect.width)).toBe(true);
        expect(Number.isInteger(rect.height)).toBe(true);
      }
    }
  });

  it('backs every accent shape with a darker outline, so it holds on any ground', () => {
    for (const layers of [PLAYER_MARKER_GROUND_LAYERS, PLAYER_MARKER_HEAD_LAYERS]) {
      const shade = layers.filter((layer) => layer.colour !== PLAYER_MARKER_COLOUR);
      const accent = layers.filter((layer) => layer.colour === PLAYER_MARKER_COLOUR);

      expect(shade).toHaveLength(1);
      expect(accent).toHaveLength(1);
      expect(pixels(shade[0].rects).length).toBeGreaterThan(0);
    }
  });

  it('lifts the head mark over every figure any map can hold, and under the world markers', () => {
    // Figures sort at `2 + tile y / 1000` and world markers at `3 + tile y /
    // 1000`, so the head mark has to clear the deepest row of the tallest map
    // without reaching 3. Add a map taller than this and the world markers
    // collide with the figures too, which is the real thing to fix.
    const tallestMap = Math.max(...Object.values(WORLD_MAPS).map((map) => map.height));

    expect(PLAYER_MARKER_DEPTH).toBeGreaterThan(2 + (tallestMap - 1) / 1000);
    expect(PLAYER_MARKER_DEPTH).toBeLessThan(3);
  });
});

describe('outlineRects', () => {
  it('surrounds a shape with exactly the pixels that touch it', () => {
    expect(outlineRects([{ x: 0, y: 0, width: 1, height: 1 }])).toEqual([
      { x: 0, y: -1, width: 1, height: 1 },
      { x: -1, y: 0, width: 1, height: 1 },
      { x: 1, y: 0, width: 1, height: 1 },
      { x: 0, y: 1, width: 1, height: 1 },
    ]);
  });

  it('never overlaps the shape it outlines', () => {
    const shape = [{ x: 2, y: 3, width: 4, height: 2 }];
    const inside = new Set(pixels(shape).map((pixel) => `${pixel.x},${pixel.y}`));

    for (const pixel of pixels(outlineRects(shape))) {
      expect(inside.has(`${pixel.x},${pixel.y}`)).toBe(false);
    }
  });
});

describe('the world scene draws what this module describes', () => {
  it('tints every non-player figure from the role table and marks only the player', async () => {
    const scene = await readFile(new URL('../scenes/WorldScene.ts', import.meta.url), 'utf8');

    for (const role of OTHER_ROLES) {
      expect(scene).toContain(`worldCharacterTint('${role}')`);
    }
    // The player sprite is never tinted, and no figure but the player is marked.
    expect(scene).not.toContain("worldCharacterTint('player')");
    expect(scene.match(/paintPlayerMark\(/g)).toHaveLength(3);
  });

  it('moves both marks wherever the player sprite moves', async () => {
    const scene = await readFile(new URL('../scenes/WorldScene.ts', import.meta.url), 'utf8');
    const setter = scene.slice(scene.indexOf('private setPlayerPosition('));

    // `setPlayerPosition` is the only place the player sprite is repositioned,
    // so a mark can never be left behind on the tile the player walked off.
    expect(scene.match(/this\.player\.setPosition\(/g)).toHaveLength(1);
    expect(setter).toContain('this.playerGroundMark.setPosition(x, y)');
    expect(setter).toContain('this.playerHeadMark.setPosition(x, y)');
  });

  it('sorts the player into the same depth band as the figures around them', async () => {
    const scene = await readFile(new URL('../scenes/WorldScene.ts', import.meta.url), 'utf8');
    const setter = scene.slice(scene.indexOf('private setPlayerPosition('));

    expect(setter).toContain('const depth = 2 + (y - PLAYER_SPRITE_Y_OFFSET) / TILE_SIZE / 1000;');
    expect(setter).toContain('this.player.setDepth(depth);');
    expect(setter).toContain('this.playerGroundMark.setPosition(x, y).setDepth(depth);');
  });
});
