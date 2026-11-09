import type { LecternColour } from '../base/librarySheet';
import { PAGE_STACK, type BookLayout } from './bookLayout';

/**
 * The open book, its plinth and the reading room behind it, painted for this
 * game a rectangle at a time in the hand the library's sheet is drawn in
 * (`scripts/draw-great-library.mjs`): GBA colours, an outline round what
 * stands, light from the top left and dither where a shade turns. It is
 * painted at run time rather than cut from a sheet because it is as big as the
 * screen, and the screen is a different size in every window.
 *
 * Phaser-free: everything is said to a `Painter`, which the scene answers with
 * a Graphics object (`LibraryBookScene`) and a test answers with a list.
 */
export interface Painter {
  rect(x: number, y: number, width: number, height: number, colour: number, alpha?: number): void;
}

const INK = {
  outline: 0x404868,
  night: 0x181018,
  wall: 0x302018,
  wallLight: 0x402818,
  shelf: 0x583010,
  shelfLight: 0x804820,
  woodBlack: 0x382010,
  woodDeep: 0x583010,
  woodShade: 0x804820,
  wood: 0xb07038,
  woodLight: 0xd89858,
  woodShine: 0xe8b878,
  brass: 0xc89818,
  brassLight: 0xf8d040,
  paper: 0xf8f0d8,
  paperShade: 0xe8dcc0,
  paperDeep: 0xd0c0a0,
  edge: 0xe0d0b0,
  edgeLine: 0xa89880,
  shadow: 0x000000,
  lamp: 0xf8d878,
} as const;

/** A book's binding, light to dark, by its lectern's colour - the same three the sheet's lecterns are drawn in. */
export const BINDINGS: Readonly<Record<LecternColour, readonly [number, number, number]>> = {
  red: [0xe05848, 0xc03830, 0x802020],
  blue: [0x5888e0, 0x3860b8, 0x203878],
  green: [0x68b858, 0x408838, 0x285820],
  gold: [0xf8c848, 0xc89020, 0x886010],
  purple: [0xa878d8, 0x7850b0, 0x483078],
  teal: [0x58c0b8, 0x309088, 0x185850],
};

/** The words' colours on a page. */
export const PAGE_INK = { body: '#403020', heading: '#583010', faint: '#988870' } as const;

const SPINES = [0x802020, 0x203878, 0x285820, 0x886010, 0x483078, 0x185850, 0x583010, 0x887860];

/** A repeatable scatter, so the room behind is the same every time it is drawn. */
function noise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * The reading room behind the plinth, in lamplight: the dark wall of shelves a
 * library is, row on row of spines, lit warm at the middle and falling away to
 * near black at the edges.
 */
export function paintBackdrop(paint: Painter, width: number, height: number): void {
  paint.rect(0, 0, width, height, INK.wall);
  const shelfHeight = 22;
  for (let top = 2; top < height; top += shelfHeight) {
    paint.rect(0, top + shelfHeight - 4, width, 3, INK.shelf);
    paint.rect(0, top + shelfHeight - 4, width, 1, INK.shelfLight);
    let x = 0;
    while (x < width) {
      const thick = noise(x, top) > 0.6 ? 4 : 3;
      const tall = 12 + Math.floor(noise(x + 1, top) * 5);
      if (noise(x + 2, top) > 0.08) {
        paint.rect(x, top + shelfHeight - 4 - tall, thick, tall, SPINES[Math.floor(noise(x + 3, top) * SPINES.length)]);
        paint.rect(x, top + shelfHeight - 4 - tall, 1, tall, INK.woodBlack);
      }
      x += thick;
    }
  }
  // Uprights between the bays.
  for (let x = 40; x < width; x += 96) {
    paint.rect(x, 0, 6, height, INK.shelf);
    paint.rect(x, 0, 1, height, INK.shelfLight);
  }
  // The lamplight: darkest at the sides and the top, in steps, dithered where each one turns.
  const steps = 5;
  for (let step = 0; step < steps; step += 1) {
    const inset = Math.round(((steps - step) / steps) * (width / 2) * 0.55);
    const alpha = 0.12;
    paint.rect(0, 0, Math.max(0, width / 2 - inset), height, INK.night, alpha);
    paint.rect(width / 2 + inset, 0, Math.max(0, width / 2 - inset), height, INK.night, alpha);
  }
  paint.rect(0, 0, width, 3, INK.night, 0.5);
}

/** The two plinths' woods: oak with a brass lip, and gilt with a lip of light. */
const PLINTHS = {
  wood: {
    top: INK.wood,
    shine: INK.woodShine,
    grain: INK.woodShade,
    lip: INK.brass,
    lipLight: INK.brassLight,
    front: INK.woodShade,
    frontEdge: INK.woodDeep,
    panelEdge: INK.woodDeep,
    panel: INK.wood,
    panelLight: INK.woodLight,
  },
  golden: {
    top: 0xe0b028,
    shine: 0xfff8c8,
    grain: 0xc89018,
    lip: 0xf8f0d8,
    lipLight: 0xffffff,
    front: 0xc89018,
    frontEdge: 0x886010,
    panelEdge: 0x886010,
    panel: 0xe0b028,
    panelLight: 0xf8e078,
  },
} as const;

/**
 * The plinth: a broad reading desk across the foot of the screen, its top
 * tilted towards the reader with a lip along its edge to hold the book, and
 * carved panels down its front - oak for the lecterns' books, and gilt, with
 * glints in the air about it, for the golden plinth's.
 */
export function paintPlinth(paint: Painter, layout: BookLayout, kind: 'wood' | 'golden' = 'wood'): void {
  const wood = PLINTHS[kind];
  const { plinth } = layout;
  const lip = plinth.y + 10;
  // The slanted top the book lies on.
  paint.rect(plinth.x, plinth.y, plinth.width, lip - plinth.y, wood.top);
  paint.rect(plinth.x, plinth.y, plinth.width, 1, INK.outline);
  paint.rect(plinth.x, plinth.y + 1, plinth.width, 1, wood.shine);
  for (let x = 0; x < plinth.width; x += 1) {
    if (noise(x, 7) > 0.86) paint.rect(plinth.x + x, plinth.y + 3 + Math.floor(noise(x, 9) * 5), 3, 1, wood.grain);
  }
  // The brass lip.
  paint.rect(plinth.x, lip, plinth.width, 1, INK.outline);
  paint.rect(plinth.x, lip + 1, plinth.width, 2, wood.lip);
  paint.rect(plinth.x, lip + 1, plinth.width, 1, wood.lipLight);
  paint.rect(plinth.x, lip + 3, plinth.width, 1, INK.outline);
  // The front, panelled: one panel a label (`BookLayout.panels`).
  const front = lip + 4;
  paint.rect(plinth.x, front, plinth.width, plinth.y + plinth.height - front, wood.front);
  paint.rect(plinth.x, front, plinth.width, 1, wood.frontEdge);
  for (const panel of [layout.panels.turn, layout.panels.close]) {
    const { x, y, width: w, height: h } = panel;
    if (h < 4 || w < 4) continue;
    paint.rect(x, y, w, h, wood.panelEdge);
    paint.rect(x + 1, y + 1, w - 2, h - 2, wood.panel);
    paint.rect(x + 1, y + 1, w - 2, 1, wood.panelLight);
    paint.rect(x + 1, y + 1, 1, h - 2, wood.panelLight);
  }
  if (kind === 'golden') {
    // Glints in the lamplight along the gilt, and in the air over it.
    for (let x = 7; x < plinth.width; x += 23) {
      const y = plinth.y + 3 + Math.floor(noise(x, 3) * 5);
      paint.rect(plinth.x + x, y, 1, 3, wood.shine);
      paint.rect(plinth.x + x - 1, y + 1, 3, 1, wood.shine);
    }
  }
}

/**
 * The book itself, lying open: its shadow on the plinth, its covers showing
 * round the pages, the stacks of pages under the open ones at the foot and the
 * outer edges, the hollow of the spine and a ribbon hanging out of it.
 */
export function paintBook(paint: Painter, layout: BookLayout, colour: LecternColour): void {
  const [light, mid, deep] = BINDINGS[colour];
  const { cover, left, right, spineX } = layout;
  // Its shadow, cast down and to the right of the lamp.
  paint.rect(cover.x + 4, cover.y + cover.height - 2, cover.width, 5, INK.shadow, 0.35);
  paint.rect(cover.x + cover.width, cover.y + 6, 4, cover.height - 4, INK.shadow, 0.25);
  // The covers.
  paint.rect(cover.x, cover.y, cover.width, cover.height, INK.outline);
  paint.rect(cover.x + 1, cover.y + 1, cover.width - 2, cover.height - 2, deep);
  paint.rect(cover.x + 1, cover.y + 1, cover.width - 2, 2, mid);
  paint.rect(cover.x + 1, cover.y + 1, 1, cover.height - 2, light);
  paint.rect(cover.x + 2, cover.y + 1, cover.width - 4, 1, light);
  // Gilt corners.
  for (const [x, y] of [
    [cover.x + 2, cover.y + 2],
    [cover.x + cover.width - 5, cover.y + 2],
    [cover.x + 2, cover.y + cover.height - 5],
    [cover.x + cover.width - 5, cover.y + cover.height - 5],
  ]) {
    paint.rect(x, y, 3, 3, INK.brass);
    paint.rect(x, y, 2, 1, INK.brassLight);
  }
  // The stacked pages under the open ones: a ruled edge at the foot and at each outer side.
  const stackTop = left.y + 2;
  const stackFoot = left.y + left.height;
  for (let layer = 0; layer < PAGE_STACK; layer += 1) {
    const shade = layer % 2 === 0 ? INK.edge : INK.edgeLine;
    paint.rect(left.x - 1 - layer, stackTop + layer, 1, left.height - 1, shade);
    paint.rect(right.x + right.width + layer, stackTop + layer, 1, right.height - 1, shade);
    paint.rect(left.x - layer, stackFoot + layer, left.width + right.width + layer * 2, 1, shade);
  }
  paint.rect(left.x - PAGE_STACK, stackFoot + PAGE_STACK, left.width + right.width + PAGE_STACK * 2, 1, INK.outline);
  // The ribbon, out of the foot of the spine and over the brass lip.
  const ribbonTop = stackFoot + PAGE_STACK;
  const ribbonFoot = Math.min(layout.height - 2, layout.plinth.y + 18);
  paint.rect(spineX + 3, ribbonTop, 3, ribbonFoot - ribbonTop, mid);
  paint.rect(spineX + 3, ribbonTop, 1, ribbonFoot - ribbonTop, light);
  paint.rect(spineX + 3, ribbonFoot, 1, 2, mid);
  paint.rect(spineX + 5, ribbonFoot, 1, 2, mid);
}

/**
 * The hollow where the pages meet the spine, painted over both pages after
 * they are laid: a dark fold, and shade falling away from it either side.
 */
export function paintGutter(paint: Painter, layout: BookLayout): void {
  const { left, spineX } = layout;
  paint.rect(spineX - 4, left.y, 8, left.height, INK.shadow, 0.06);
  paint.rect(spineX - 2, left.y, 4, left.height, INK.shadow, 0.08);
  paint.rect(spineX - 1, left.y, 2, left.height, INK.shadow, 0.18);
}

/**
 * A page's paper, as its own picture: warm cream, shaded in steps towards the
 * spine where it curves down into the fold, and lit along its outer edge.
 * `side` is which side of the spine it lies on.
 */
export function paintPaper(paint: Painter, width: number, height: number, side: 'left' | 'right'): void {
  paint.rect(0, 0, width, height, INK.paper);
  const towardSpine = (offset: number, w: number) => (side === 'left' ? width - offset - w : offset);
  // Into the fold: two shades, each dithered into the next.
  paint.rect(towardSpine(0, 6), 0, 6, height, INK.paperDeep);
  paint.rect(towardSpine(6, 8), 0, 8, height, INK.paperShade);
  for (let y = 0; y < height; y += 2) {
    paint.rect(towardSpine(6, 1), y, 1, 1, INK.paperDeep);
    paint.rect(towardSpine(14, 1), y + 1, 1, 1, INK.paperShade);
  }
  // The outer edge, catching the light.
  paint.rect(side === 'left' ? 0 : width - 1, 0, 1, height, INK.edge);
}

/** The rule under a page's heading, and a small ornament at its middle. */
export function paintHeadingRule(paint: Painter, x: number, y: number, width: number, colour: LecternColour): void {
  const [, mid, deep] = BINDINGS[colour];
  paint.rect(x, y, width, 1, deep);
  const middle = x + Math.floor(width / 2);
  paint.rect(middle - 2, y - 1, 5, 3, mid);
  paint.rect(middle - 1, y - 2, 3, 5, mid);
}

/** The title page's ornament: the book's colour as a gilt-edged plate under its title. */
export function paintTitlePlate(paint: Painter, x: number, y: number, width: number, height: number, colour: LecternColour): void {
  const [light, mid, deep] = BINDINGS[colour];
  paint.rect(x, y, width, height, INK.brass);
  paint.rect(x + 1, y + 1, width - 2, height - 2, deep);
  paint.rect(x + 2, y + 2, width - 4, height - 4, mid);
  paint.rect(x + 2, y + 2, width - 4, 1, light);
}
