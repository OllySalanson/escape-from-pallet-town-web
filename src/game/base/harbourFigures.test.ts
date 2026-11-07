import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import type { GridPosition } from '../movement/gridMovement';
import type { Pokemon } from '../pokemon/Pokemon';
import { CHARACTER_FEET_PIXEL_Y } from '../playerFrames';
import { FIGURE_BAND, atRow } from '../world/depths';
import { TILE_SIZE } from '../worldMap';
import { HEEL_BEHIND, HarbourFigures, OTHER_PLAYERS_BEHIND, clearOfHeel, clearOfSelf, heelOf, spreadPlates, stackPlates, withinPlace } from './harbourFigures';
import { PARTNER_FEET_PIXEL_Y, partnerFrame, partnerTextureKey } from './partner';
import { BUBBLE_HEIGHT, BUBBLE_WIDTH, PARTNER_SPRITE_Y_OFFSET, PartnerFigure, type PartnerHost } from './partnerFigure';

/**
 * Somebody else in the shared harbour standing on this player's partner, as
 * the browser played it (two tabs over `?harbour=local`): AMY walked onto the
 * tile OLLY's Charmander stood on at heel, and her figure was drawn over it, so
 * OLLY's partner vanished from his screen while it stood there. Everybody
 * arrives on the same spawn with a partner on the same heel tile, so in a busy
 * harbour this is the ordinary case, not a corner.
 */

/** A drawn thing that remembers where it was last put and how deep. */
class Drawn {
  public x = 0;
  public y = 0;
  public depth = 0;
  public visible = true;
  public text = '';
  public width = 12;
  public height = 12;
  public frame = { name: 0 };
  public setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  public setX(x: number): this {
    this.x = x;
    return this;
  }
  public setDepth(depth: number): this {
    this.depth = depth;
    return this;
  }
  public setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }
  public setText(text: string): this {
    this.text = text;
    return this;
  }
  public setOrigin(): this {
    return this;
  }
  public alpha = 1;
  public setAlpha(alpha: number = 1): this {
    this.alpha = alpha;
    return this;
  }
  public setFrame(frame: number = 0): this {
    this.frame = { name: frame };
    return this;
  }
  public play(): this {
    return this;
  }
  public stop(): this {
    return this;
  }
  public clear(): this {
    return this;
  }
  public fillStyle(): this {
    return this;
  }
  public fillRect(): this {
    return this;
  }
  public gone = false;
  public destroy(): void {
    this.gone = true;}
}

function stage() {
  const sprites: Drawn[] = [];
  const scene = {
    add: {
      sprite: () => {
        const sprite = new Drawn();
        sprites.push(sprite);
        return sprite;
      },
      graphics: () => new Drawn(),
      text: (_x: number, _y: number, text: string) => new Drawn().setText(text),
    },
  } as unknown as Phaser.Scene;
  return { scene, sprites };
}

const PLAYER: GridPosition = { x: 14, y: 12 };
const HEEL: GridPosition = { x: 14, y: 13 };

function ollyWithPartner() {
  const { scene, sprites } = stage();
  const player = new Drawn().setDepth(atRow(FIGURE_BAND, PLAYER.y));
  const host: PartnerHost = {
    playerTile: () => PLAYER,
    playerStepping: () => false,
    stepProgress: () => 0,
    player: player as unknown as Phaser.GameObjects.Sprite,
    playerHeadMark: new Drawn() as unknown as Phaser.GameObjects.Graphics,
    reading: () => false,
    standingAbout: () => true,
    quiet: () => true,
  };
  const pokemon = { name: 'Charmander', isFainted: false, currentHp: 20, maxHp: 20 } as unknown as Pokemon;
  new PartnerFigure(scene, host, { pokemon, species: 'charmander' }, { tile: HEEL, out: true, facing: 'up' }, { fadeIn: false });
  const partner = sprites[0];
  const others = new HarbourFigures(scene);
  const amyOn = (tile: GridPosition) => {
    others.update([{ id: 'amy', place: 'yard', tile, toward: null, progress: 0, behind: null, facing: 'down', name: 'AMY' }]);
    return sprites[sprites.length - 1];
  };
  return { partner, player, amyOn };
}

describe('another player in the harbour and this player\'s partner', () => {
  it('draws somebody standing on the partner\'s tile behind the partner, so it is still seen', () => {
    const { partner, amyOn } = ollyWithPartner();
    const amy = amyOn(HEEL);
    expect(amy.depth).toBeLessThan(partner.depth);
  });

  it('draws somebody standing on the player\'s own tile behind the player', () => {
    const { player, amyOn } = ollyWithPartner();
    expect(amyOn(PLAYER).depth).toBeLessThan(player.depth);
  });

  it('still draws somebody a row lower in front of the partner, and a row higher behind it', () => {
    const { partner, amyOn } = ollyWithPartner();
    expect(amyOn({ x: HEEL.x, y: HEEL.y + 1 }).depth).toBeGreaterThan(partner.depth);
    expect(amyOn({ x: HEEL.x, y: HEEL.y - 1 }).depth).toBeLessThan(partner.depth);
  });
});

describe('another player arriving on this player\'s own tile', () => {
  /** Where the player's sprite is drawn standing on a tile, as the scenes draw it. */
  const drawnAt = (tile: GridPosition) => ({ x: tile.x * TILE_SIZE, y: tile.y * TILE_SIZE + TILE_SIZE - CHARACTER_FEET_PIXEL_Y });

  function amyAndHerPlate() {
    const plates: Drawn[] = [];
    const texts: Drawn[] = [];
    const scene = {
      add: {
        sprite: () => new Drawn(),
        graphics: () => {
          const plate = new Drawn();
          plates.push(plate);
          return plate;
        },
        text: (_x: number, _y: number, text: string) => {
          const name = new Drawn().setText(text);
          texts.push(name);
          return name;
        },
      },
    } as unknown as Phaser.Scene;
    const others = new HarbourFigures(scene);
    const amyOn = (tile: GridPosition, self: GridPosition) => {
      others.update([{ id: 'amy', place: 'yard', tile, toward: null, progress: 0, behind: null, facing: 'down', name: 'AMY' }], drawnAt(self));
      return { plate: plates[0], name: texts[0] };
    };
    return { amyOn };
  }

  it('does not put her name over the head they share', () => {
    const { amyOn } = amyAndHerPlate();
    const { plate, name } = amyOn(PLAYER, PLAYER);
    expect(plate.visible).toBe(false);
    expect(name.visible).toBe(false);
  });

  it('tells the scene where she and her name stand, so no caption sits across either', () => {
    const scene = {
      add: { sprite: () => new Drawn(), graphics: () => new Drawn(), text: (_x: number, _y: number, text: string) => new Drawn().setText(text) },
    } as unknown as Phaser.Scene;
    const others = new HarbourFigures(scene);
    const tile = { x: PLAYER.x + 3, y: PLAYER.y };
    others.update([{ id: 'amy', place: 'yard', tile, toward: null, progress: 0, behind: null, facing: 'down', name: 'AMY' }], drawnAt(PLAYER));
    const [rect] = others.rects();
    expect(rect.x).toBe(tile.x * TILE_SIZE);
    expect(rect.width).toBe(TILE_SIZE);
    // From the top of her name plate, above her head, down to her feet.
    expect(rect.y).toBeLessThan(tile.y * TILE_SIZE);
    expect(rect.y + rect.height).toBeGreaterThan(tile.y * TILE_SIZE + TILE_SIZE / 2);
  });

  it('names her again once either of them has walked off', () => {
    const { amyOn } = amyAndHerPlate();
    amyOn(PLAYER, PLAYER);
    const { plate, name } = amyOn({ x: PLAYER.x + 1, y: PLAYER.y }, PLAYER);
    expect(plate.visible).toBe(true);
    expect(name.visible).toBe(true);
  });
});

describe('a friend in a raid room saying something on this player\'s own tile', () => {
  it('keeps the plate that carries what they said, because it names its speaker', () => {
    const plates: Drawn[] = [];
    const texts: Drawn[] = [];
    const scene = {
      add: {
        sprite: () => new Drawn(),
        graphics: () => {
          const plate = new Drawn();
          plates.push(plate);
          return plate;
        },
        text: (_x: number, _y: number, text: string) => {
          const name = new Drawn().setText(text);
          texts.push(name);
          return name;
        },
      },
    } as unknown as Phaser.Scene;
    const others = new HarbourFigures(scene);
    const self = { x: PLAYER.x * TILE_SIZE, y: PLAYER.y * TILE_SIZE + TILE_SIZE - CHARACTER_FEET_PIXEL_Y };
    const amy = { id: 'amy', place: 'yard', tile: PLAYER, toward: null, progress: 0, behind: null, facing: 'down' as const };
    others.update([{ ...amy, name: 'AMY: OVER HERE!', speaking: true }], self);
    expect(plates[0].visible).toBe(true);
    expect(texts[0].visible).toBe(true);
    // Once she has finished saying it, her bare name goes back to being hidden.
    others.update([{ ...amy, name: 'AMY' }], self);
    expect(plates[0].visible).toBe(false);
  });
});

describe('two names on one row', () => {
  const plate = (x: number, y: number, headX: number) => ({ x, y, width: 44, height: 13, headX });

  it('are slid apart so each can be read, each still over its own head', () => {
    const [a, b] = spreadPlates([plate(100, 50, 122), plate(132, 50, 154)]);
    expect(a + 44).toBeLessThanOrEqual(b);
    expect(a).toBeLessThanOrEqual(122);
    expect(a + 44).toBeGreaterThanOrEqual(122);
    expect(b).toBeLessThanOrEqual(154);
    expect(b + 44).toBeGreaterThanOrEqual(154);
  });

  it('are left alone on different rows, or with room between them', () => {
    expect(spreadPlates([plate(100, 50, 122), plate(120, 70, 142)])).toEqual([100, 120]);
    expect(spreadPlates([plate(100, 50, 122), plate(150, 50, 172)])).toEqual([100, 150]);
  });

  it('read apart with three in a row, two tiles between each', () => {
    const xs = spreadPlates([plate(100, 50, 122), plate(132, 50, 154), plate(164, 50, 186)]);
    expect(xs[0] + 44).toBeLessThanOrEqual(xs[1]);
    expect(xs[1] + 44).toBeLessThanOrEqual(xs[2]);
  });
});

describe('somebody in the harbour saying something', () => {
  const standing = (id: string, x: number) => ({ id, name: id.toUpperCase(), place: 'yard', tile: { x, y: 10 }, toward: null, progress: 0, behind: null, facing: 'down' as const });
  const figuresIn = (): { others: HarbourFigures; shown: () => string[]; bubbles: () => { x: number; y: number; width: number; height: number }[] } => {
    const names: Drawn[] = [];
    const scene = {
      add: {
        sprite: () => new Drawn(),
        graphics: () => new Drawn(),
        text: (_x: number, _y: number, text: string) => {
          const name = new Drawn().setText(text);
          names.push(name);
          return name;
        },
      },
    } as unknown as Phaser.Scene;
    const others = new HarbourFigures(scene);
    return { others, shown: () => names.filter((name) => name.visible && !name.gone).map((name) => name.text), bubbles: () => others.bubbleRects() };
  };

  it('has a bubble in place of their name, and the name back when it is said', () => {
    const { others, shown, bubbles } = figuresIn();
    others.update([{ ...standing('amy', 10), saying: 'HELLO!' }]);
    expect(shown()).toEqual(['HELLO!']);
    expect(bubbles()).toHaveLength(1);
    others.update([standing('amy', 10)]);
    expect(shown()).toEqual(['AMY']);
    expect(bubbles()).toHaveLength(0);
  });

  it('never has a bubble over somebody else\'s name: the name gives way, and comes back', () => {
    const { others, shown } = figuresIn();
    // Long enough words to reach over the head next door.
    others.update([{ ...standing('amy', 10), saying: 'WANT TO RAID?' }, standing('pip', 11)]);
    // `Drawn` is twelve pixels wide, which is under a tile: make it wider by name.
    expect(shown()).toContain('WANT TO RAID?');
    others.update([standing('amy', 10), standing('pip', 11)]);
    expect(shown()).toEqual(['AMY', 'PIP']);
  });

  it('reads a caption through whoever it is seated over, for that frame only', () => {
    const { others, shown } = figuresIn();
    const figure = standing('amy', 10);
    others.update([figure]);
    const [rect] = others.rects();
    others.veilUnder([{ x: rect.x, y: rect.y + rect.height - 4, width: 4, height: 4 }]);
    const drawn = (others as unknown as { drawn: Map<string, { sprite: Drawn }> }).drawn.get('amy')!;
    expect(drawn.sprite.alpha).toBeLessThan(1);
    others.update([figure]);
    expect(drawn.sprite.alpha).toBe(1);
    expect(shown()).toEqual(['AMY']);
    // A caption across their name alone leaves them whole, and takes the name.
    const plate = others.plateRects()[0];
    others.veilUnder([{ x: plate.x, y: plate.y, width: plate.width, height: 2 }]);
    expect(drawn.sprite.alpha).toBe(1);
    expect(shown()).toEqual([]);
  });

  it('clears a name from under this player\'s own bubble', () => {
    const { others, shown } = figuresIn();
    others.update([standing('amy', 10)]);
    expect(shown()).toEqual(['AMY']);
    const plate = others.plateRects()[0];
    others.clearNamesUnder({ x: plate.x - 4, y: plate.y - 2, width: 30, height: 10 });
    expect(shown()).toEqual([]);
  });
});

describe('another player\'s partner, walking at their heel', () => {
  const still = { id: 'amy', place: 'yard', toward: null, progress: 0, facing: 'down' as const };

  it('stands on the tile they last walked off, facing them', () => {
    expect(heelOf({ ...still, tile: { x: 10, y: 10 }, behind: { x: 9, y: 10 } }, { x: 9, y: 10 })).toEqual({
      x: 9,
      y: 10,
      facing: 'right',
      moving: false,
    });
  });

  it('steps onto the tile they are leaving, as far along as they are', () => {
    const walking = { ...still, tile: { x: 10, y: 10 }, toward: { x: 11, y: 10 }, progress: 0.25, behind: { x: 9, y: 10 } };
    expect(heelOf(walking, { x: 9, y: 10 })).toEqual({ x: 9.25, y: 10, facing: 'right', moving: true });
  });

  it('is tucked away until they step, then comes out on the tile they left', () => {
    expect(heelOf({ ...still, tile: { x: 10, y: 10 }, behind: null }, null)).toBeNull();
    const off = { ...still, tile: { x: 10, y: 10 }, toward: { x: 10, y: 9 }, progress: 0.5, facing: 'up' as const, behind: null };
    expect(heelOf(off, null)).toEqual({ x: 10, y: 10, facing: 'up', moving: false });
  });

  function yard(canStand: ((tile: GridPosition) => boolean) | null = null) {
    const sprites: { key: string; drawn: Drawn }[] = [];
    const scene = {
      add: {
        sprite: (_x: number, _y: number, key: string) => {
          const drawn = new Drawn();
          sprites.push({ key, drawn });
          return drawn;
        },
        graphics: () => new Drawn(),
        text: (_x: number, _y: number, text: string) => new Drawn().setText(text),
      },
    } as unknown as Phaser.Scene;
    const others = new HarbourFigures(scene, undefined, canStand);
    const heel = () => sprites.find((sprite) => sprite.key.startsWith('partner-'));
    const amy = sprites;
    return { others, heel, amy };
  }

  it('draws her Bulbasaur behind her, a hair behind her on the same row', () => {
    const { others, heel, amy } = yard();
    const tile = { x: 10, y: 10 };
    others.update([{ ...still, tile, behind: { x: 10, y: 9 }, name: 'AMY', partner: 'bulbasaur' }]);
    const partner = heel()!;
    expect(partner.key).toBe(partnerTextureKey('bulbasaur'));
    expect(partner.drawn.visible).toBe(true);
    expect(partner.drawn.x).toBe(10 * TILE_SIZE - 8);
    expect(partner.drawn.frame.name).toBe(partnerFrame('down', 0));
    expect(partner.drawn.depth).toBeCloseTo(atRow(FIGURE_BAND, 9) - OTHER_PLAYERS_BEHIND - HEEL_BEHIND, 9);
    expect(partner.drawn.depth).toBeLessThan(amy[0].drawn.depth);
  });

  it('draws nobody at the heel of a player who walks alone', () => {
    const { others, heel } = yard();
    others.update([{ ...still, tile: { x: 10, y: 10 }, behind: { x: 10, y: 9 }, name: 'AMY' }]);
    expect(heel()).toBeUndefined();
    expect(others.heelRects()).toEqual([]);
  });

  it('arrives beside somebody who has just come into view, where the place says it may stand', () => {
    const open = (tile: GridPosition) => !(tile.x === 10 && tile.y === 9);
    const { others, heel } = yard(open);
    // Facing down, behind her is up - which is a wall here - so it comes in at her side.
    others.update([{ ...still, tile: { x: 10, y: 10 }, behind: null, name: 'AMY', partner: 'squirtle' }]);
    expect(heel()!.drawn.visible).toBe(true);
    expect(heel()!.drawn.x).toBe(11 * TILE_SIZE - 8);
    expect(heel()!.drawn.y).toBe(10 * TILE_SIZE + PARTNER_SPRITE_Y_OFFSET);
  });

  it('waits out of sight where nothing says where it may arrive', () => {
    const { others, heel } = yard();
    others.update([{ ...still, tile: { x: 10, y: 10 }, behind: null, name: 'AMY', partner: 'squirtle' }]);
    expect(heel()!.drawn.visible).toBe(false);
    expect(others.heelRects()).toEqual([]);
  });

  it('becomes the new kind when she comes out with another partner', () => {
    const { others, amy } = yard();
    const at = { ...still, tile: { x: 10, y: 10 }, behind: { x: 10, y: 9 }, name: 'AMY' };
    others.update([{ ...at, partner: 'charmander' }]);
    others.update([{ ...at, partner: 'charmeleon' }]);
    const partners = amy.filter((sprite) => sprite.key.startsWith('partner-'));
    expect(partners.map((sprite) => sprite.key)).toEqual([partnerTextureKey('charmander'), partnerTextureKey('charmeleon')]);
  });

  it('tells the scene where it stands, as company a caption may go over', () => {
    const { others } = yard();
    others.update([{ ...still, tile: { x: 10, y: 10 }, behind: { x: 10, y: 9 }, name: 'AMY', partner: 'bulbasaur' }]);
    const [rect] = others.heelRects();
    expect(rect.x).toBe(10 * TILE_SIZE);
    expect(rect.width).toBe(TILE_SIZE);
    // Its feet where this player's own partner's are, standing on that tile.
    expect(rect.y + rect.height).toBe(9 * TILE_SIZE + PARTNER_SPRITE_Y_OFFSET + PARTNER_FEET_PIXEL_Y + 1);
  });
});

describe('another player waving', () => {
  function yard() {
    const graphics: Drawn[] = [];
    const scene = {
      add: {
        sprite: () => new Drawn(),
        graphics: () => {
          const drawn = new Drawn();
          graphics.push(drawn);
          return drawn;
        },
        text: (_x: number, _y: number, text: string) => new Drawn().setText(text),
      },
    } as unknown as Phaser.Scene;
    return { others: new HarbourFigures(scene), graphics };
  }
  const amy = { id: 'amy', place: 'yard', tile: { x: 10, y: 10 }, toward: null, progress: 0, behind: null, facing: 'down' as const, name: 'AMY' };

  it('puts a hand up over her name while she waves, and takes it down after', () => {
    const { others, graphics } = yard();
    others.update([{ ...amy, waving: true }]);
    // The plate is the first drawing; the hand is the one after it.
    const [plate, hand] = graphics;
    expect(hand).toBeDefined();
    expect(hand.y + BUBBLE_HEIGHT).toBe(plate.y);
    // Centred over her head.
    expect(hand.x).toBe(Math.round(10 * TILE_SIZE + TILE_SIZE / 2 - BUBBLE_WIDTH / 2));
    others.update([amy]);
    others.update([{ ...amy, waving: true }]);
    expect(graphics).toHaveLength(3);
  });

  it('tells the scene where her name plate is, so a hand waved at her goes up over it rather than across it', () => {
    const { others, graphics } = yard();
    others.update([amy]);
    const [plate] = others.plateRects();
    expect(plate.x).toBe(graphics[0].x);
    expect(plate.y).toBe(graphics[0].y);
    expect(plate.width).toBeGreaterThan(TILE_SIZE);
  });

  it('tells the scene where the hand is, so no caption is seated across it', () => {
    const { others } = yard();
    others.update([amy]);
    const [still] = others.rects();
    others.update([{ ...amy, waving: true }]);
    const [waving] = others.rects();
    expect(waving.y).toBe(still.y - BUBBLE_HEIGHT);
    expect(waving.y + waving.height).toBe(still.y + still.height);
  });
});

describe("a name plate beside this player's own head", () => {
  const me = { x: 10 * TILE_SIZE, y: 10 * TILE_SIZE };
  const width = 40;
  const centred = (tileX: number) => tileX * TILE_SIZE + TILE_SIZE / 2 - width / 2;

  it('slides clear of this player\'s column when its owner stands next door on the same row', () => {
    expect(clearOfSelf(centred(11), width, 11 * TILE_SIZE, me.y, me)).toBe(11 * TILE_SIZE);
    expect(clearOfSelf(centred(9), width, 9 * TILE_SIZE, me.y, me)).toBe(10 * TILE_SIZE - width);
  });

  it('stays centred over somebody further off, on another row, or on this very tile', () => {
    expect(clearOfSelf(centred(13), width, 13 * TILE_SIZE, me.y, me)).toBe(centred(13));
    expect(clearOfSelf(centred(11), width, 11 * TILE_SIZE, me.y + TILE_SIZE, me)).toBe(centred(11));
    expect(clearOfSelf(centred(10), width, 10 * TILE_SIZE, me.y, me)).toBe(centred(10));
    expect(clearOfSelf(centred(11), width, 11 * TILE_SIZE, me.y, null)).toBe(centred(11));
  });
});

/**
 * A room is framed on the dark (playtest 49): AMY on the upstairs stair mat
 * of a fourteen-tile room, against its east wall, had her name plate - wider
 * than her tile - hanging past the wall into the dark beside it.
 */
describe('a name plate against the edge of a room', () => {
  const ROOM_WIDTH = 14 * TILE_SIZE;

  it('slides along to stay over the room, and leaves a plate with room to spare where it is', () => {
    expect(withinPlace(ROOM_WIDTH - 20, 30, ROOM_WIDTH)).toBe(ROOM_WIDTH - 30);
    expect(withinPlace(-6, 30, ROOM_WIDTH)).toBe(0);
    expect(withinPlace(100, 30, ROOM_WIDTH)).toBe(100);
    // Nothing to keep it over, or a place narrower than the plate: as it was.
    expect(withinPlace(-6, 30, null)).toBe(-6);
    expect(withinPlace(-6, 30, 20)).toBe(-6);
  });

  it('draws a plate over the room for somebody standing against its east wall', () => {
    const plates: Drawn[] = [];
    const scene = {
      add: {
        sprite: () => new Drawn(),
        graphics: () => {
          const plate = new Drawn();
          plates.push(plate);
          return plate;
        },
        text: (_x: number, _y: number, text: string) => new Drawn().setText(text),
      },
    } as unknown as Phaser.Scene;
    const others = new HarbourFigures(scene, undefined, null, () => ROOM_WIDTH);
    const tile = { x: 13, y: 2 };
    others.update([{ id: 'amy', place: 'yard', tile, toward: null, progress: 0, behind: null, facing: 'down', name: 'AMY' }], null);
    const [plate] = others.plateRects();
    expect(plate.x + plate.width).toBeLessThanOrEqual(ROOM_WIDTH);
    expect(plates[0].x).toBe(plate.x);
  });
});

describe('a name plate and the partner behind its owner', () => {
  const plate = { x: 100, y: 40, width: 30, height: 14 };

  it('is lifted to sit on top of a tall partner standing where it would go', () => {
    // A Blastoise on the row above, walking behind its player down the yard.
    const heel = { x: 104, y: 30, width: 16, height: 26 };
    expect(clearOfHeel(plate, heel)).toBe(heel.y - plate.height);
  });

  it('stays over its owner\'s head when the partner is beside them or nowhere', () => {
    expect(clearOfHeel(plate, null)).toBe(plate.y);
    expect(clearOfHeel(plate, { x: 131, y: 30, width: 16, height: 26 })).toBe(plate.y);
    expect(clearOfHeel(plate, { x: 104, y: 54, width: 16, height: 20 })).toBe(plate.y);
  });
});

describe('names that still lie on each other', () => {
  it('lifts one clear, so a name is never printed on a name', () => {
    const box = (x: number, y: number) => ({ x, y, width: 40, height: 12 });
    expect(stackPlates([box(100, 50), box(120, 50)])).toEqual([50, 37]);
    expect(stackPlates([box(100, 50), box(120, 50), box(110, 37)])).toEqual([50, 37, 24]);
    expect(stackPlates([box(100, 50), box(150, 50)])).toEqual([50, 50]);
  });
});
