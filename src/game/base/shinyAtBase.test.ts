import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import type { GridPosition } from '../movement/gridMovement';
import type { Pokemon } from '../pokemon/Pokemon';
import type { StashedPokemon } from '../stash/Stash';
import { SHINY_SPARKLE_TEXTURE } from '../ui/shinySparkle';
import { pokemonSoleDrop } from '../world/pokemonFigures';
import { FIGURE_BAND, atRow } from '../world/depths';
import { TILE_SIZE } from '../worldMap';
import { FOLLOWER_ART } from './generated/followerArt';
import { HomeGardenFigures } from './homeGardenFigures';
import { PARTNER_GLINT_DROP, PARTNER_SPRITE_Y_OFFSET, PartnerFigure, type PartnerHost } from './partnerFigure';
import { GLINT_EVERY_MS, GLINT_FIRST_MS, GLINT_MOTES, GLINT_OUT_OF_STEP_MS, ICON_GLINT_RISE, glintAt } from './shinyGlint';

/**
 * A shiny Pokemon walking about (`shinyGlint.ts`): the partner at the
 * player's heel and the Pokemon out in THE BOLTHOLE's garden, on a stage that
 * remembers what it was asked to draw. An ordinary one draws no stars at all.
 */

class Drawn {
  public x = 0;
  public y = 0;
  public depth = 0;
  public alpha = 1;
  public visible = true;
  public frame: string | number = 0;
  public gone = false;
  public readonly texture: string;
  public constructor(texture = '') {
    this.texture = texture;
  }
  public setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  public setDepth(depth: number): this {
    this.depth = depth;
    return this;
  }
  public setAlpha(alpha = 1): this {
    this.alpha = alpha;
    return this;
  }
  public setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }
  public setFrame(frame: string | number): this {
    this.frame = frame;
    return this;
  }
  public setOrigin(): this {
    return this;
  }
  public setFlipX(): this {
    return this;
  }
  public play(): this {
    return this;
  }
  public destroy(): void {
    this.gone = true;
  }
}

function stage() {
  const frames = new Set<string>();
  const stars: Drawn[] = [];
  const sprites: Drawn[] = [];
  const scene = {
    textures: {
      exists: (key: string) => key === SHINY_SPARKLE_TEXTURE,
      get: () => ({ has: (name: string) => frames.has(name), add: (name: string) => void frames.add(name) }),
    },
    anims: { exists: () => true, create: () => undefined },
    tweens: { add: () => undefined },
    add: {
      sprite: (x: number, y: number, texture: string) => {
        const sprite = new Drawn(texture).setPosition(x, y);
        sprites.push(sprite);
        return sprite;
      },
      image: (_x: number, _y: number, texture: string) => {
        const star = new Drawn(texture);
        stars.push(star);
        return star;
      },
      graphics: () => new Drawn(),
    },
  } as unknown as Phaser.Scene;
  return { scene, stars, sprites, lit: () => stars.filter((star) => star.visible && !star.gone) };
}

const PLAYER: GridPosition = { x: 14, y: 12 };
const HEEL: GridPosition = { x: 14, y: 13 };
/** A moment with all three glints out at once. */
const ALL_OUT_MS = GLINT_FIRST_MS + GLINT_MOTES[GLINT_MOTES.length - 1].fromMs + 10;

function partnerAtHeel(shiny: boolean, place = { tile: HEEL, out: true, facing: 'up' as const }) {
  const { scene, sprites, stars, lit } = stage();
  const host: PartnerHost = {
    playerTile: () => PLAYER,
    playerStepping: () => false,
    stepProgress: () => 0,
    player: new Drawn().setPosition(PLAYER.x * TILE_SIZE, PLAYER.y * TILE_SIZE).setDepth(atRow(FIGURE_BAND, PLAYER.y)) as unknown as Phaser.GameObjects.Sprite,
    playerHeadMark: new Drawn() as unknown as Phaser.GameObjects.Graphics,
    reading: () => false,
    standingAbout: () => true,
    quiet: () => true,
  };
  const pokemon = { name: 'Charmander', shiny, isFainted: false, currentHp: 20, maxHp: 20 } as unknown as Pokemon;
  const figure = new PartnerFigure(scene, host, { pokemon, species: 'charmander' }, place, { fadeIn: false });
  return { figure, sprite: sprites[0], stars, lit };
}

describe('a shiny partner at the player’s heel', () => {
  it('glints round its head, over its own picture and under whoever stands a row nearer', () => {
    const { figure, sprite, lit } = partnerAtHeel(true);

    figure.update(ALL_OUT_MS);

    expect(glintAt(ALL_OUT_MS)).toHaveLength(GLINT_MOTES.length);
    const head = {
      x: HEEL.x * TILE_SIZE + TILE_SIZE / 2,
      y: HEEL.y * TILE_SIZE + PARTNER_SPRITE_Y_OFFSET + FOLLOWER_ART.charmander.topPixelY + PARTNER_GLINT_DROP,
    };
    expect(lit().map((star) => [star.x, star.y, star.frame])).toEqual(
      glintAt(ALL_OUT_MS).map((mote) => [head.x + mote.dx, head.y + mote.dy, mote.frame]),
    );
    for (const star of lit()) {
      expect(star.texture).toBe(SHINY_SPARKLE_TEXTURE);
      expect(star.depth).toBeGreaterThan(sprite.depth);
      expect(star.depth).toBeLessThan(atRow(FIGURE_BAND, HEEL.y + 1));
    }
    // Every glint is on the partner's own picture's tile or the half-tile round it.
    for (const star of lit()) {
      expect(Math.abs(star.x - head.x)).toBeLessThanOrEqual(TILE_SIZE / 2);
      expect(star.y).toBeGreaterThanOrEqual(sprite.y);
    }
  });

  it('glints no more once it is tucked away, and takes its stars with it when it goes', () => {
    const { figure, stars, lit } = partnerAtHeel(true);
    figure.update(ALL_OUT_MS);
    expect(lit()).toHaveLength(GLINT_MOTES.length);

    figure.standAt({ tile: PLAYER, out: false, facing: 'up' });
    expect(lit()).toHaveLength(0);

    figure.destroy();
    expect(stars.every((star) => star.gone)).toBe(true);
  });

  it('is as faint as its figure while a caption reads through it', () => {
    const { figure, sprite, lit } = partnerAtHeel(true);
    figure.setVeiled(true);
    figure.update(ALL_OUT_MS);
    expect(lit().map((star) => star.alpha)).toEqual(GLINT_MOTES.map(() => sprite.alpha));
    expect(sprite.alpha).toBeLessThan(1);
  });

  it('draws no stars at all for a partner in its ordinary colours', () => {
    const { figure, stars } = partnerAtHeel(false);
    figure.update(ALL_OUT_MS);
    expect(stars).toHaveLength(0);
  });
});

describe('a shiny Pokemon out in THE BOLTHOLE’s garden', () => {
  const stored = (id: string, speciesId: string, shiny: boolean): StashedPokemon =>
    ({ id, pokemon: { shiny, base: { id: speciesId, dexId: 25 } } }) as unknown as StashedPokemon;

  it('glints over its own icon, and the ordinary one beside it does not', () => {
    const { scene, sprites, lit } = stage();
    const garden = new HomeGardenFigures(scene, [stored('a', 'pikachu', true), stored('b', 'eevee', false)], () => true);
    const pikachu = sprites[0];

    // The first of the garden is one beat out of step with the partner.
    garden.update(GLINT_EVERY_MS - GLINT_OUT_OF_STEP_MS + ALL_OUT_MS, true, () => false);

    const middle = { x: pikachu.x, y: pikachu.y - pokemonSoleDrop('pikachu') - ICON_GLINT_RISE };
    expect(lit().map((star) => [star.x, star.y])).toEqual(
      glintAt(ALL_OUT_MS).map((mote) => [middle.x + mote.dx, middle.y + mote.dy]),
    );
    for (const star of lit()) {
      expect(star.depth).toBeGreaterThan(pikachu.depth);
    }
  });

  it('never glints in time with the one beside it', () => {
    const { scene, stars, sprites } = stage();
    const garden = new HomeGardenFigures(scene, [stored('a', 'pikachu', true), stored('b', 'eevee', true)], () => true);
    const owner = (star: Drawn): number => sprites.findIndex((sprite) => Math.abs(star.x - sprite.x) <= TILE_SIZE / 2);
    const lit = [0, 0];
    let together = 0;
    for (let ms = 0; ms < GLINT_EVERY_MS * 3; ms += 50) {
      garden.update(50, true, () => false);
      const owners = new Set(stars.filter((star) => star.visible).map(owner));
      owners.forEach((index) => (lit[index] += 1));
      if (owners.size > 1) together += 1;
    }
    expect(together).toBe(0);
    expect(Math.min(...lit)).toBeGreaterThan(0);
  });

  it('takes the stars away with the Pokemon when it is taken onto the team', () => {
    const { scene, stars, lit } = stage();
    const shiny = stored('a', 'pikachu', true);
    const garden = new HomeGardenFigures(scene, [shiny], () => true);
    garden.update(GLINT_EVERY_MS - GLINT_OUT_OF_STEP_MS + ALL_OUT_MS, false, () => false);
    expect(lit()).toHaveLength(GLINT_MOTES.length);

    garden.settle([]);

    expect(stars.every((star) => star.gone)).toBe(true);
  });
});
