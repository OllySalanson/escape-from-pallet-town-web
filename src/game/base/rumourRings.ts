import type { GridPosition } from '../movement/gridMovement';
import { districtsForMap } from '../world/districts';
import { RUMOURS, type Rumour } from '../world/rumours';
import { secretById, secretSpent, type SecretsKnown } from '../world/secrets';
import type { WorldMapId } from '../worldMap';

/**
 * The chalk rings on THE RAID ARENA's telescope (the harbour arenas plan,
 * section 4.4): a faint ring and a "?" over the district of every rumour this
 * save has heard, so the harbour's half-clues stay where a raid is planned.
 *
 * A ring is chalk **on the glass, never on the map**. It is drawn over the
 * cloud on a layer of its own and changes nothing under it - no ground is
 * lifted, no place named, no tile marked - and it is the same ring wherever in
 * its district the secret is: its middle and its size come from the district
 * alone (`rumourRings.test.ts`). What the card beside it says is only the
 * rumours' own words, which the player has already heard.
 *
 * Once every secret a ring is chalked for has given up what it holds, the "?"
 * is chalked over with a tick: the ring stays, a record of a rumour run to
 * ground. Nothing is stored for any of it: it is `raidProgress.rumoursHeard`
 * and what the save has found (`secrets.ts`). Phaser-free.
 */

export interface RingedRumour {
  readonly id: string;
  /** The rumour as it was heard. */
  readonly words: string;
  /** Its secret has nothing left to find. */
  readonly found: boolean;
}

export interface RumourRing {
  /** The district it is chalked over (`Rumour.ringsOver`). */
  readonly district: string;
  /** The district's middle, in the map's tiles. */
  readonly centre: GridPosition;
  /** How far out the chalk runs, in the map's tiles: a share of the district, so it sits inside it. */
  readonly radius: number;
  /** What was heard about it, in the order it was heard. */
  readonly rumours: readonly RingedRumour[];
  /** Every rumour in it has been run to ground: the "?" is ticked. */
  readonly allFound: boolean;
}

/** How far out a ring runs, as a share of its district's shorter side. */
const RING_SHARE = 0.34;

/** A rumour's words without the board's own heading: the card says it is a rumour. */
function wordsOf(rumour: Rumour): string {
  return rumour.line.replace(/^RUMOUR:\s*/, '');
}

/**
 * The rings a save has chalked on a map's telescope: one a district, holding
 * every rumour heard about it. A rumour that does not say where (none yet) is
 * never ringed, because a ring would say it for it.
 */
export function rumourRings(mapId: WorldMapId, heard: readonly string[], known: SecretsKnown): readonly RumourRing[] {
  if (mapId !== 'greystone-vale') {
    return [];
  }
  const districts = districtsForMap(mapId);
  const rings = new Map<string, { centre: GridPosition; radius: number; rumours: RingedRumour[] }>();
  for (const id of heard) {
    const rumour = RUMOURS.find((each) => each.id === id);
    if (!rumour || !rumour.gives.includes('where')) {
      continue;
    }
    const district = districts.find((each) => each.name === rumour.ringsOver);
    const area = district?.areas[0];
    const secret = secretById(rumour.secret);
    if (!area || !secret) {
      continue;
    }
    const ring = rings.get(rumour.ringsOver) ?? {
      centre: { x: Math.floor(area.x + area.width / 2), y: Math.floor(area.y + area.height / 2) },
      radius: Math.round(Math.min(area.width, area.height) * RING_SHARE),
      rumours: [],
    };
    ring.rumours.push({ id: rumour.id, words: wordsOf(rumour), found: secretSpent(secret, known) });
    rings.set(rumour.ringsOver, ring);
  }
  return [...rings.entries()].map(([district, ring]) => ({
    district,
    ...ring,
    allFound: ring.rumours.every((rumour) => rumour.found),
  }));
}

/** Where a ring's "?" (or tick) is chalked: on the top of the ring, in the map's tiles. */
export function ringMarkTile(ring: RumourRing): GridPosition {
  return { x: ring.centre.x, y: ring.centre.y - ring.radius };
}

/**
 * What the card beside the telescope's cursor says over a ring's mark: how
 * many rumours, then their words - the ones still out first - and never the
 * district's name, which a cave's rumour does not give.
 */
export function ringCard(ring: RumourRing): { readonly title: string; readonly lines: readonly string[] } {
  const out = ring.rumours.filter((rumour) => !rumour.found);
  const done = ring.rumours.filter((rumour) => rumour.found);
  const title = ring.allFound
    ? `RUN TO GROUND`
    : `${out.length === 1 ? 'A RUMOUR' : `${out.length} RUMOURS`} HEARD`;
  return {
    title,
    lines: [
      ...out.map((rumour) => rumour.words),
      ...(done.length === 0
        ? []
        : ring.allFound
          ? done.map((rumour) => rumour.words)
          : [`${done.length === 1 ? 'One more' : `${done.length} more`} here run to ground.`]),
    ],
  };
}

/**
 * The chalk itself, as squares to fill relative to the ring's middle, at the
 * given screen pixels to a tile: a dashed circle, a pixel of shade under each
 * dash so it reads on bright ground as on cloud, and the mark on its top.
 */
export function ringChalk(
  ring: RumourRing,
  pixelsToATile: number,
): readonly { readonly x: number; readonly y: number; readonly ink: 'chalk' | 'shade' | 'mark' | 'tick' }[] {
  const radius = Math.max(6, Math.round(ring.radius * pixelsToATile));
  const squares: { x: number; y: number; ink: 'chalk' | 'shade' | 'mark' | 'tick' }[] = [];
  const seen = new Set<string>();
  // A dash and a gap all the way round, as a hand chalks a ring: about four
  // pixels drawn to every three left, however big the ring is drawn.
  const steps = Math.max(24, Math.round(2 * Math.PI * radius));
  for (let step = 0; step < steps; step += 1) {
    if (step % 7 >= 4) {
      continue;
    }
    const angle = (step / steps) * Math.PI * 2;
    const x = Math.round(Math.cos(angle) * radius);
    const y = Math.round(Math.sin(angle) * radius);
    // Leave the top clear for the mark.
    if (y < 0 && Math.abs(x) <= 3) {
      continue;
    }
    const key = `${x},${y}`;
    if (!seen.has(key)) {
      seen.add(key);
      squares.push({ x, y: y + 1, ink: 'shade' }, { x, y, ink: 'chalk' });
    }
  }
  // The mark on the ring's top: a question mark, or a tick once it is run to ground.
  const glyph = ring.allFound
    ? ['....#', '...#.', '#.#..', '.#...']
    : ['.###.', '#...#', '...#.', '..#..', '.....', '..#..'];
  const top = -radius - Math.ceil(glyph.length / 2);
  glyph.forEach((row, dy) =>
    [...row].forEach((cell, dx) => {
      if (cell === '#') {
        squares.push({ x: dx - 2, y: top + dy + 1, ink: 'shade' }, { x: dx - 2, y: top + dy, ink: ring.allFound ? 'tick' : 'mark' });
      }
    }),
  );
  return squares;
}
