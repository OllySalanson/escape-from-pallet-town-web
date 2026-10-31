// Draws the Mere Punt onto `public/assets/punt.png`, 48x16.
//
//   node scripts/draw-punt.mjs
//
// FireRed has a ferry and a liner and no small boat, and the Seagallop on a pond
// four screens across is a joke the map does not want. So this is drawn, in the
// colours of FireRed's own plank decking (`frlg-boards.png`), three tiles long
// and seen from the same angle as the jetty it ties up at: a flat deck with the
// thwarts across it, square ends turned up, one row of hull under the deck, and
// the pole lying along it. Bow to the west, as the ferry's is.
import { writePng } from '../tools/tileset/tileSheet.mjs';

const WIDTH = 48;
const HEIGHT = 16;
const INK = [58, 44, 40];
const HULL = [120, 80, 48];
const HULL_LIT = [152, 104, 64];
const DECK = [200, 168, 104];
const DECK_LIT = [232, 208, 136];
const THWART = [144, 104, 64];
const POLE = [96, 64, 40];

const image = { width: WIDTH, height: HEIGHT, data: Buffer.alloc(WIDTH * HEIGHT * 4) };
const put = (x, y, [r, g, b]) => {
  const at = (y * WIDTH + x) * 4;
  image.data[at] = r;
  image.data[at + 1] = g;
  image.data[at + 2] = b;
  image.data[at + 3] = 255;
};

// How far each row of the boat is drawn in from its ends: the ends turn up.
const INSET = [5, 3, 2, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5];
const TOP = 1;
const DECK_ROWS = 9;
INSET.forEach((inset, row) => {
  const y = TOP + row;
  for (let x = inset; x < WIDTH - inset; x += 1) {
    const edge = x === inset || x === WIDTH - inset - 1;
    if (row === 0 || row === INSET.length - 1 || edge) put(x, y, INK);
    else if (row >= DECK_ROWS) put(x, y, row === DECK_ROWS ? HULL_LIT : HULL);
    else put(x, y, row <= 1 || (x + row * 3) % 11 < 2 ? DECK_LIT : DECK);
  }
});
// The thwarts, across the deck.
for (const x of [10, 24, 37]) {
  for (let y = TOP + 1; y < TOP + DECK_ROWS; y += 1) {
    put(x, y, THWART);
    put(x + 1, y, THWART);
  }
}
// The pole, along the deck.
for (let x = 7; x < 42; x += 1) put(x, TOP + 3 + (x > 24 ? 1 : 0), POLE);

writePng('public/assets/punt.png', image);
