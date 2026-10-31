/**
 * The hall answering a jump from THE RAID ARENA's rail: a wave of fire running
 * round from the place they went over, both ways, each torch roaring up as it
 * reaches it and settling again, to meet at the far side. Only on the way out: a
 * triumph on every return would wear thin. Phaser-free; `arenaView.ts` draws it.
 */

/** How long the wave takes to reach the far side of the hall. */
export const WAVE_MS = 900;
/** How long a torch burns high once it has reached it. */
const FLARE_MS = 520;
/** Starts at once with the jump, so it is there while the player is on the rail looking at it. */
export const RING_OF_FIRE_MS = WAVE_MS + FLARE_MS;

const turnBetween = (a: number, b: number): number => {
  const turn = Math.abs(a - b) % (Math.PI * 2);
  return turn > Math.PI ? Math.PI * 2 - turn : turn;
};

/**
 * How high a torch at `torchAngle` is burning, in whole steps: 0 is as usual, 3 is
 * as high as it goes. It goes up at once and falls away in steps, as a flare does.
 */
export function flareAt(elapsedMs: number, torchAngle: number, jumpAngle: number): 0 | 1 | 2 | 3 {
  const since = elapsedMs - (turnBetween(torchAngle, jumpAngle) / Math.PI) * WAVE_MS;
  if (since < 0 || since >= FLARE_MS) {
    return 0;
  }
  const left = 1 - since / FLARE_MS;
  return left > 0.55 ? 3 : left > 0.25 ? 2 : 1;
}

export const FLARE_WIDTH = 15;
export const FLARE_HEIGHT = 25;

/** A torch burning high, in the same inks as its everyday flame (`FLAME_INKS`), a character to the pixel. */
export const FLARE_FRAMES: readonly (readonly string[])[] = [
  [
    '.......r.......',
    '.......r.......',
    '......ro.......',
    '......ror......',
    '.r....oor......',
    '.r...roor......',
    '..r..rooor..r..',
    '..r.rooooor.r..',
    '...rooooooror..',
    '...roooyooor...',
    '..rroooyyooor..',
    '..rooyyyyyoor..',
    '.rrooyyyyyooor.',
    '.roooyywyyyoor.',
    '.rooyyywwyyoor.',
    '.rooyywwwyyoor.',
    '.rooyywwwwyoor.',
    'rrooyywwwwyyorr',
    'rrooyywwwwyyorr',
    '.rooyyywwwyyor.',
    '.rooyyywwyyoor.',
    '..rooyyyyyoor..',
    '..rroooooorr...',
    '....rroorr.....',
    '......rr.......',
  ],
  [
    '........r......',
    '.......or......',
    '.......or......',
    '......roor.....',
    '.....rooor...r.',
    '.....roor...r..',
    '.r..roooor..r..',
    '..r.rooooor.r..',
    '..rroooyoorr...',
    '...rooyyooor...',
    '..rrooyyyooor..',
    '..roooyyyyoor..',
    '.rrooyyyyyyor..',
    '.roooyyywyyoor.',
    '.rooyyywwyyoor.',
    '.rooyywwwyyoor.',
    'rrooyywwwwyoorr',
    'rrooyywwwwyyorr',
    '.rooyywwwwyyor.',
    '.rooyyywwwyyor.',
    '.rrooyywwyyoor.',
    '..rooyyyyyoor..',
    '...rroooooor...',
    '....rroorr.....',
    '......rr.......',
  ],
];
