// Draws THE RAID ARENA's great hall onto `public/assets/arena-hall.png`.
//
//   npx vite-node scripts/draw-arena-hall.mts
//
// A round hall on a square grid cannot be cut from FireRed, which has no curve
// in any room it draws, so it is painted here a pixel at a time in the
// conventions FireRed paints with: one ramp of 15-bit stone (`STONE_RAMP`), lit
// by moving along that ramp with an ordered dither, a hard one-pixel outline on
// anything that stands up, the light from the top left.
//
// The painting is two pictures the size of the hall - what figures stand on,
// and what they pass behind - which are then sliced into tiles and the repeats
// thrown away, so the hall is an ordinary room to the game: tile layers, drawn
// by the scene as every other room is. `src/game/base/arenaHall.ts` is where
// everything stands; this only says what it looks like. Writes the sheet and
// `src/game/base/generated/arenaHallTiles.ts`. The pit is not here: what is in
// it is painted when the player walks in (`src/game/base/arenaPit.ts`).
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { writePng } from '../tools/tileset/tileSheet.mjs';
import {
  ARENA_BANNERS,
  ARENA_CENTRE,
  ARENA_HALL_HEIGHT,
  ARENA_HALL_WIDTH,
  ARENA_MAT,
  ARENA_PILLARS,
  ARENA_STATIONS,
  ARENA_TILE,
  ARENA_TORCHES,
  KERB_WIDTH,
  PIT_RIM,
  STONE_RAMP,
  WALL_FACE_HEIGHT,
  WALL_FOOT,
  acrossOval,
  dithered,
  grownOval,
  ovalPoint,
  scatter,
  stoneAt,
  type ArenaTorch,
} from '../src/game/base/arenaHall';

const ROOT = new URL('../', import.meta.url);
const WIDTH = ARENA_HALL_WIDTH * ARENA_TILE;
const HEIGHT = ARENA_HALL_HEIGHT * ARENA_TILE;
const SHEET_COLUMNS = 40;

type Rgb = readonly [number, number, number];

const IRON: Rgb = [32, 32, 48];
const IRON_LIGHT: Rgb = [88, 88, 104];
const RED_DARK: Rgb = [120, 24, 32];
const RED: Rgb = [168, 32, 40];
const RED_LIGHT: Rgb = [200, 80, 72];
const GOLD: Rgb = [248, 200, 64];
const GOLD_DARK: Rgb = [176, 120, 40];
const WOOD: Rgb = [80, 48, 32];
const WOOD_LIGHT: Rgb = [120, 80, 48];
const CAP: Rgb = STONE_RAMP[1];

class Picture {
  public readonly data = new Uint8Array(WIDTH * HEIGHT * 4);

  public set(x: number, y: number, ink: Rgb): void {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) {
      return;
    }
    const at = (y * WIDTH + x) * 4;
    this.data[at] = ink[0];
    this.data[at + 1] = ink[1];
    this.data[at + 2] = ink[2];
    this.data[at + 3] = 255;
  }

  public fill(x: number, y: number, width: number, height: number, ink: Rgb): void {
    for (let py = y; py < y + height; py += 1) {
      for (let px = x; px < x + width; px += 1) {
        this.set(px, py, ink);
      }
    }
  }

  public has(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT && this.data[(y * WIDTH + x) * 4 + 3] > 0;
  }
}

const ground = new Picture();
const over = new Picture();

// --- light -------------------------------------------------------------------

/** How much torchlight reaches a point: the base of everything lit in the hall. */
function torchLight(x: number, y: number, torches: readonly ArenaTorch[]): number {
  let light = 0;
  for (const torch of torches) {
    const dx = x - torch.x;
    // The floor a torch lights is below it, so its pool is centred under it.
    const dy = (y - (torch.y + 30)) * 1.25;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 120) {
      const share = 1 - distance / 120;
      light += share * share;
    }
  }
  return Math.min(1, light);
}

// --- the floor ---------------------------------------------------------------

/** The flags of the platform: laid in courses that follow the hall round. */
function floorLevel(x: number, y: number): number {
  const across = acrossOval(WALL_FOOT, x, y);
  const radius = across * 476;
  const course = Math.floor(radius / 20);
  const courseEdge = radius / 20 - course;
  const angle = Math.atan2((y - WALL_FOOT.y) / WALL_FOOT.ry, (x - WALL_FOOT.x) / WALL_FOOT.rx);
  // About one flag to every thirty pixels whatever the course's radius, the
  // courses staggered by half a flag.
  const flags = Math.max(12, Math.round((Math.PI * 2 * radius) / 30));
  const turned = ((angle + Math.PI) / (Math.PI * 2)) * flags + (course % 2) * 0.5;
  const flag = Math.floor(turned);
  const flagEdge = turned - flag;
  const pixelAcross = 1 / 20;
  const pixelRound = flags / (Math.PI * 2 * Math.max(radius, 1));
  let level = 0.6 * (scatter(course, flag % flags) - 0.5);
  if (courseEdge < pixelAcross || flagEdge < pixelRound) {
    // The joint.
    level -= 1.7;
  } else if (courseEdge < pixelAcross * 2 || flagEdge < pixelRound * 2) {
    // The lit edge of the flag beside it.
    level += 0.5;
  }
  // A few worn flecks in the stone, so a large floor is not a clean one.
  if (scatter(x, y) > 0.985) {
    level -= 0.7;
  }
  return level;
}

function paintFloor(): void {
  const rim = grownOval(PIT_RIM, KERB_WIDTH);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (acrossOval(WALL_FOOT, x + 0.5, y + 0.5) > 1 || acrossOval(rim, x + 0.5, y + 0.5) < 1) {
        continue;
      }
      const light = torchLight(x, y, ARENA_TORCHES);
      // The foot of the wall is the darkest of the floor, the middle of the
      // platform lit by every torch that can see it.
      const fromWall = (1 - acrossOval(WALL_FOOT, x + 0.5, y + 0.5)) * 476;
      const wallShade = fromWall < 14 ? (14 - fromWall) / 14 : 0;
      const level = 2.5 + light * 4.9 + floorLevel(x, y) - wallShade * 1.2;
      ground.set(x, y, stoneAt(level, x, y));
    }
  }
}

// --- the outer wall ----------------------------------------------------------

function wallLevel(x: number, y: number, faceTop: number, foot: number): number {
  const course = Math.floor((y - faceTop) / 12);
  const edge = (y - faceTop) % 12;
  const offset = course % 2 === 0 ? 0 : 12;
  const block = Math.floor((x + offset) / 24);
  const blockEdge = (x + offset) % 24;
  const light = torchLight(x, y, ARENA_TORCHES);
  let level = 1.2 + light * 4 + 0.5 * (scatter(course + 40, block) - 0.5);
  if (edge === 0 || blockEdge === 0) {
    level -= 1.6;
  } else if (edge === 1 || blockEdge === 1) {
    level += 0.5;
  }
  // The dark gathers at the top of the wall and in the angle with the floor.
  const shareUp = (y - faceTop) / Math.max(1, foot - faceTop);
  if (shareUp < 0.3) {
    level -= (0.3 - shareUp) * 7;
  }
  if (foot - y < 4) {
    level -= 1.2;
  }
  return level;
}

function paintWall(): void {
  const raised = { ...WALL_FOOT, y: WALL_FOOT.y - WALL_FACE_HEIGHT };
  const capWidth = 9;
  const capNorth = grownOval(raised, capWidth);
  const capSouth = grownOval(WALL_FOOT, capWidth);
  // From where the lifted cap is widest down to the hall's middle, its side runs
  // straight down to meet the south half, with no notch at the join.
  const acrossCapNorth = (px: number, py: number): number =>
    py > capNorth.y ? Math.abs(px - capNorth.x) / capNorth.rx : acrossOval(capNorth, px, py);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      if (acrossOval(WALL_FOOT, px, py) <= 1) {
        continue;
      }
      const north = y < WALL_FOOT.y;
      const inFace = north && acrossOval(raised, px, py) <= 1;
      if (inFace) {
        // Where this column's face starts and ends, for its shading.
        const dx = (px - WALL_FOOT.x) / WALL_FOOT.rx;
        const rise = Math.sqrt(Math.max(0, 1 - dx * dx)) * WALL_FOOT.ry;
        const foot = WALL_FOOT.y - rise;
        const faceTop = foot - WALL_FACE_HEIGHT;
        ground.set(x, y, stoneAt(wallLevel(x, y, faceTop, foot), x, y));
      } else if (north ? acrossCapNorth(px, py) <= 1 : acrossOval(capSouth, px, py) <= 1) {
        // The top of the wall, looked down on, with its outer edge lit.
        const outer = north ? acrossCapNorth(px, py) : acrossOval(capSouth, px, py);
        ground.set(x, y, outer > 0.992 ? STONE_RAMP[3] : CAP);
      }
    }
  }
}

/** The red cloths hung down the wall between its torches, with the Arena's ball on them. */
function paintBanners(): void {
  for (const foot of ARENA_BANNERS) {
    const x = foot.x;
    const top = foot.y - WALL_FACE_HEIGHT + 4;
    const width = 15;
    const height = 36;
    const left = x - 7;
    ground.fill(left - 1, top - 2, width + 2, 2, IRON);
    for (let py = top; py < top + height; py += 1) {
      // Swallow-tailed at the foot.
      const tail = py - (top + height - 6);
      for (let px = left; px < left + width; px += 1) {
        const fromMiddle = Math.abs(px - x);
        if (tail > 0 && fromMiddle < tail) {
          continue;
        }
        const edge = px === left || px === left + width - 1;
        ground.set(px, py, edge ? RED_DARK : px < left + 3 ? RED_LIGHT : RED);
      }
    }
    // The ball: a gold ring with a line through it.
    const cx = x;
    const cy = top + 14;
    for (let py = -5; py <= 5; py += 1) {
      for (let px = -5; px <= 5; px += 1) {
        const distance = Math.hypot(px, py);
        if (distance <= 5.2 && distance >= 3.8) {
          ground.set(cx + px, cy + py, GOLD);
        } else if (distance < 3.8 && py === 0) {
          ground.set(cx + px, cy + py, GOLD_DARK);
        }
      }
    }
  }
}

// --- the runner --------------------------------------------------------------

/** A red runner from the door to the fence: the way a player was going to walk anyway. */
function paintRunner(): void {
  const halfWidth = 13;
  const rim = grownOval(PIT_RIM, KERB_WIDTH);
  const top = Math.ceil(rim.y + rim.ry);
  const bottom = (ARENA_MAT.y + 1) * ARENA_TILE;
  const midX = (ARENA_MAT.x + 0.5) * ARENA_TILE;
  for (let y = top; y < bottom; y += 1) {
    for (let px = -halfWidth; px < halfWidth; px += 1) {
      const x = Math.floor(midX + px);
      const light = torchLight(x, y, ARENA_TORCHES);
      const share = 0.45 + light * 0.75;
      const fromEdge = Math.min(px + halfWidth, halfWidth - 1 - px);
      if (fromEdge <= 0) {
        ground.set(x, y, dithered(share, x, y) ? GOLD_DARK : WOOD);
      } else if (fromEdge === 1) {
        ground.set(x, y, dithered(share, x, y) ? GOLD : GOLD_DARK);
      } else {
        const nap = (y >> 1) % 2 === 0 ? 0.08 : 0;
        ground.set(x, y, dithered(share + nap, x, y) ? RED : RED_DARK);
      }
    }
  }
}

// --- the fence ---------------------------------------------------------------

/**
 * The pit's edge: a pale kerb, the iron rail on stone posts standing on it, and
 * under the kerb's inner edge the shadow it throws on the first step. It is one
 * low run all the way round, low enough that going over it would be a hop.
 */
function paintFence(): void {
  const outer = grownOval(PIT_RIM, KERB_WIDTH);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const across = acrossOval(PIT_RIM, px, py);
      if (across < 1 || acrossOval(outer, px, py) > 1) {
        continue;
      }
      const depth = (across - 1) * PIT_RIM.rx;
      const light = torchLight(x, y, ARENA_TORCHES);
      const edge = depth < 1.2 ? -1.6 : depth > KERB_WIDTH - 1.2 ? -1.2 : depth < 2.6 ? 1.2 : 0;
      ground.set(x, y, stoneAt(5 + light * 3.4 + edge, x, y));
    }
  }

  // Posts and rail, walked round the kerb a fixed distance at a time and drawn
  // back to front, so a nearer post stands over a further one.
  const kerb = grownOval(PIT_RIM, KERB_WIDTH / 2);
  const points: { x: number; y: number; angle: number }[] = [];
  let travelled = 0;
  let last = ovalPoint(kerb, 0);
  const spacing = 18;
  const steps = 4000;
  for (let step = 0; step < steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2;
    const point = ovalPoint(kerb, angle);
    travelled += Math.hypot(point.x - last.x, point.y - last.y);
    last = point;
    if (travelled >= spacing) {
      travelled -= spacing;
      points.push({ x: Math.round(point.x), y: Math.round(point.y), angle });
    }
  }
  const POST_HEIGHT = 11;
  const RAIL_RISE = 8;
  /** Every so many posts, a great one: taller and wider, with iron horns on its cap. */
  const GREAT_POST_EVERY = 5;
  const GREAT_POST_HEIGHT = 16;
  const pictureFor = (y: number): Picture => (y < ARENA_CENTRE.y ? over : ground);
  // The rails first, then the posts over them.
  for (let step = 0; step < steps; step += 1) {
    const point = ovalPoint(kerb, (step / steps) * Math.PI * 2);
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    const picture = pictureFor(y);
    // Two runs of heavy chain, a link at a time rather than a line.
    const link = Math.floor(step / 7) % 2 === 0;
    picture.set(x, y - RAIL_RISE, link ? IRON_LIGHT : IRON);
    picture.set(x, y - RAIL_RISE + 1, IRON);
    picture.set(x, y - RAIL_RISE + 4, link ? IRON : IRON_LIGHT);
    picture.set(x, y - RAIL_RISE + 5, IRON);
  }
  // Rails first, nearer posts last.
  const great = new Set(points.filter((_point, index) => index % GREAT_POST_EVERY === 0));
  for (const point of [...points].sort((a, b) => a.y - b.y)) {
    const picture = pictureFor(point.y);
    const light = torchLight(point.x, point.y, ARENA_TORCHES);
    const face = stoneAt(5.2 + light * 3, point.x, point.y);
    const lit = stoneAt(6.8 + light * 2.6, point.x, point.y);
    const dark = STONE_RAMP[2];
    if (great.has(point)) {
      for (let dy = 0; dy < GREAT_POST_HEIGHT; dy += 1) {
        const y = point.y - dy;
        for (let dx = -4; dx <= 4; dx += 1) {
          const edge = dx === -4 || dx === 4;
          picture.set(point.x + dx, y, edge ? STONE_RAMP[1] : dx < -1 ? lit : face);
        }
        // A band of iron round it, where the chain is made fast.
        if (dy === RAIL_RISE || dy === RAIL_RISE - 4) {
          for (let dx = -3; dx <= 3; dx += 1) {
            picture.set(point.x + dx, y, IRON);
          }
        }
      }
      const capY = point.y - GREAT_POST_HEIGHT;
      for (let dx = -5; dx <= 5; dx += 1) {
        picture.set(point.x + dx, capY, STONE_RAMP[2]);
        picture.set(point.x + dx, capY + 1, dx < -1 ? lit : face);
      }
      // Two iron horns on the cap, curling out, as a pit like this would have.
      for (const side of [-1, 1]) {
        picture.set(point.x + side * 4, capY - 1, IRON);
        picture.set(point.x + side * 4, capY - 2, IRON_LIGHT);
        picture.set(point.x + side * 5, capY - 3, IRON_LIGHT);
        picture.set(point.x + side * 6, capY - 4, IRON);
      }
      continue;
    }
    for (let dy = 0; dy < POST_HEIGHT; dy += 1) {
      const y = point.y - dy;
      picture.set(point.x - 2, y, dark);
      picture.set(point.x - 1, y, lit);
      picture.set(point.x, y, face);
      picture.set(point.x + 1, y, face);
      picture.set(point.x + 2, y, dark);
    }
    // The post's cap, one wider than it, lit from the top left.
    const capY = point.y - POST_HEIGHT;
    for (let dx = -3; dx <= 3; dx += 1) {
      picture.set(point.x + dx, capY, STONE_RAMP[2]);
      picture.set(point.x + dx, capY + 1, dx < 0 ? lit : face);
    }
    picture.set(point.x - 3, capY + 1, dark);
    picture.set(point.x + 3, capY + 1, dark);
    // Where it stands on the kerb, in shadow to the east.
    picture.set(point.x + 3, point.y, STONE_RAMP[3]);
  }
}

// --- pillars and torches -----------------------------------------------------

const PILLAR_RISE = 54;

/** One column: its foot in the tile it stands on, its shaft and capital up over whatever is behind it. */
function paintPillar(tileX: number, tileY: number): void {
  const midX = tileX * ARENA_TILE + 8;
  const footY = (tileY + 1) * ARENA_TILE - 1;
  const put = (x: number, y: number, ink: Rgb): void => {
    (y >= tileY * ARENA_TILE ? ground : over).set(x, y, ink);
  };
  const light = torchLight(midX, footY - 8, ARENA_TORCHES);
  // Shaded across, as a round thing is: the light from the top left.
  const across = (offset: number, half: number): number => {
    const share = (offset + half) / (half * 2);
    return share < 0.18 ? 3.4 : share < 0.42 ? 6.1 : share < 0.68 ? 5 : share < 0.86 ? 3.8 : 2.6;
  };
  // Its shadow on the floor, thrown down and to the right.
  for (let dy = 0; dy < 7; dy += 1) {
    for (let dx = 0; dx < 16 - dy; dx += 1) {
      const x = midX - 5 + dx + dy;
      const y = footY - 3 + dy;
      if (ground.has(x, y) && dithered(0.75, x, y)) {
        ground.set(x, y, STONE_RAMP[2]);
      }
    }
  }
  // The foot: two steps of plinth.
  const shadeFoot = (half: number, top: number, height: number): void => {
    for (let dx = -half; dx <= half; dx += 1) {
      for (let y = top; y < top + height; y += 1) {
        const outline = dx === -half || dx === half || y === top + height - 1;
        put(midX + dx, y, outline ? STONE_RAMP[1] : stoneAt(across(dx, half) + light * 1.8 + (y === top ? 0.9 : 0), midX + dx, y));
      }
    }
  };
  // The shaft, with a line down it every few pixels, as fluting.
  const shaftHalf = 6;
  const shaftTop = footY - PILLAR_RISE + 6;
  for (let y = shaftTop; y <= footY - 7; y += 1) {
    const fade = (footY - y) / PILLAR_RISE;
    for (let dx = -shaftHalf; dx <= shaftHalf; dx += 1) {
      const outline = dx === -shaftHalf || dx === shaftHalf;
      const flute = (dx + shaftHalf) % 4 === 3 ? -0.8 : 0;
      put(midX + dx, y, outline ? STONE_RAMP[1] : stoneAt(across(dx, shaftHalf) + light * 1.8 + flute - fade * 0.6, midX + dx, y));
    }
  }
  shadeFoot(8, footY - 6, 3);
  shadeFoot(9, footY - 3, 4);
  // The capital.
  shadeFoot(8, footY - PILLAR_RISE + 3, 3);
  shadeFoot(10, footY - PILLAR_RISE, 3);
}

/** A torch's stick, and the bracket holding it; the flame is the scene's (`arenaView.ts`). */
function paintTorch(torch: ArenaTorch): void {
  const put = (x: number, y: number, ink: Rgb): void => {
    (torch.on === 'pillar' ? over : ground).set(x, y, ink);
  };
  // A stick you could pull off the wall: a wooden shaft three pixels wide with
  // pitch-black wrapping at its head, held out by an iron bracket.
  for (let dy = 0; dy < 16; dy += 1) {
    const y = torch.y + dy;
    const wrapped = dy < 5;
    put(torch.x - 2, y, IRON);
    put(torch.x - 1, y, wrapped ? IRON_LIGHT : WOOD_LIGHT);
    put(torch.x, y, wrapped ? IRON : WOOD);
    put(torch.x + 1, y, wrapped ? IRON : WOOD);
    put(torch.x + 2, y, IRON);
  }
  // Its head flares, and its foot is cut off square.
  put(torch.x - 3, torch.y, IRON);
  put(torch.x + 3, torch.y, IRON);
  put(torch.x - 3, torch.y + 1, IRON);
  put(torch.x + 3, torch.y + 1, IRON);
  for (let dx = -2; dx <= 2; dx += 1) {
    put(torch.x + dx, torch.y + 16, IRON);
  }
  // The bracket round it, and the plate fixing that to the stone behind.
  for (let dx = -3; dx <= 3; dx += 1) {
    put(torch.x + dx, torch.y + 9, IRON);
    put(torch.x + dx, torch.y + 10, IRON_LIGHT);
  }
}

// --- the door ------------------------------------------------

/** The way out: the wall stops either side of a dark porch, with the night's air in it. */
function paintPorch(): void {
  const left = (ARENA_MAT.x - 1) * ARENA_TILE;
  const right = (ARENA_MAT.x + 2) * ARENA_TILE;
  const top = (ARENA_MAT.y - 1) * ARENA_TILE;
  const bottom = (ARENA_MAT.y + 1) * ARENA_TILE;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left - 10; x < right + 10; x += 1) {
      // The wall's end either side, looked down on: its cap, its lit edge, and
      // a face turned to the runner.
      const out = x < left ? left - 1 - x : x >= right ? x - right : -1;
      if (out >= 0) {
        ground.set(x, y, out === 0 ? STONE_RAMP[4] : out === 9 ? STONE_RAMP[3] : CAP);
      }
    }
  }
  // The door mat: the runner's own foot, across the whole porch.
  for (let y = ARENA_MAT.y * ARENA_TILE + 1; y < bottom - 3; y += 1) {
    for (let x = left + 2; x < right - 2; x += 1) {
      const edge = y === ARENA_MAT.y * ARENA_TILE + 1 || y === bottom - 4 || x === left + 2 || x === right - 3;
      ground.set(x, y, edge ? GOLD_DARK : (x + y) % 2 === 0 ? RED : RED_DARK);
    }
  }
  // The step down out of the hall: the runner stops on a lit sill.
  ground.fill(left, bottom - 3, right - left, 1, STONE_RAMP[7]);
  ground.fill(left, bottom - 2, right - left, 2, STONE_RAMP[2]);
}

// --- where a player gets ready ------------------------------------------------

/** The tiles a station stands on, as pixels: left, one past its right, and its foot. */
function stationBox(id: string): { readonly left: number; readonly right: number; readonly top: number; readonly foot: number } {
  const { tiles } = ARENA_STATIONS.find((station) => station.id === id)!;
  return {
    left: tiles[0].x * ARENA_TILE,
    right: (tiles[tiles.length - 1].x + 1) * ARENA_TILE,
    top: tiles[0].y * ARENA_TILE,
    foot: (tiles[0].y + 1) * ARENA_TILE - 1,
  };
}

/** Anything that stands up: the part below its own row is what figures stand beside, the rest they pass behind. */
function stationPut(top: number): (x: number, y: number, ink: Rgb) => void {
  return (x, y, ink) => (y >= top ? ground : over).set(x, y, ink);
}

/** Its shadow on the floor, thrown down and to the right, as a pillar's is. */
function stationShadow(left: number, right: number, foot: number): void {
  for (let dy = 1; dy <= 5; dy += 1) {
    for (let x = left + dy; x < right + dy; x += 1) {
      if (ground.has(x, foot + dy) && dithered(0.75, x, foot + dy)) {
        ground.set(x, foot + dy, STONE_RAMP[2]);
      }
    }
  }
}

/**
 * The bench: one long slab on three plinths, the hall's own stone. Whoever is
 * in the raid party sits along it (`BaseScene.seatTheBench`), a Pokemon a tile.
 */
function paintBench(): void {
  const { left: tileLeft, right: tileRight, foot } = stationBox('bench');
  // Pulled in clear of the two pillars either end of it.
  const left = tileLeft + 4;
  const right = tileRight - 3;
  const light = torchLight((left + right) / 2, foot - 4, ARENA_TORCHES);
  const seatTop = foot - 11;
  const seatFront = foot - 6;
  stationShadow(left, right, foot);
  for (let y = seatTop; y <= foot; y += 1) {
    for (let x = left; x < right; x += 1) {
      const fromLeft = x - left;
      const fromRight = right - 1 - x;
      const rounded = y === seatTop && (fromLeft === 0 || fromRight === 0);
      if (rounded) {
        continue;
      }
      if (y <= seatFront) {
        const edge = y === seatTop || fromLeft === 0 || fromRight === 0 || y === seatFront;
        // The top of the slab catches the light; its front does not.
        const level = y < seatFront - 1 ? 6.6 : 4.2;
        ground.set(x, y, edge ? STONE_RAMP[1] : stoneAt(level + light * 1.6 + 0.4 * (scatter(Math.floor(x / 14), 3) - 0.5), x, y));
        continue;
      }
      // Three plinths under it.
      const plinth = [left + 6, Math.round((left + right) / 2), right - 7].find((mid) => Math.abs(x - mid) <= 5);
      if (plinth !== undefined) {
        const off = x - plinth;
        const outline = Math.abs(off) === 5 || y === foot;
        ground.set(x, y, outline ? STONE_RAMP[1] : stoneAt(off < 0 ? 4.4 + light : 3.2 + light, x, y));
      } else if (dithered(0.6, x, y)) {
        ground.set(x, y, STONE_RAMP[2]);
      }
    }
  }
}

/**
 * The armoury rack: a wooden frame with iron at its joints and one long shelf.
 * What this raid carries stands on the shelf (`BaseScene.dressTheRack`).
 */
function paintRack(): void {
  const { left: tileLeft, right: tileRight, top, foot } = stationBox('rack');
  const put = stationPut(top);
  // Pulled in clear of the pillar beside it.
  const left = tileLeft + 4;
  const right = tileRight;
  const head = foot - 33;
  const shelf = foot - 8;
  stationShadow(left, right, foot);
  // The dark behind the shelf: boards, seen through the frame.
  for (let y = head + 2; y < shelf; y += 1) {
    for (let x = left + 3; x < right - 3; x += 1) {
      put(x, y, Math.floor((x - left) / 7) % 2 === 0 ? STONE_RAMP[2] : STONE_RAMP[1]);
    }
  }
  const wood = (x: number, y: number, lit: boolean): void => put(x, y, lit ? WOOD_LIGHT : WOOD);
  // The head rail, and the shelf with its lit front edge.
  for (let x = left; x < right; x += 1) {
    for (let y = head; y < head + 3; y += 1) {
      wood(x, y, y === head);
    }
    put(x, head + 3, STONE_RAMP[1]);
    for (let y = shelf; y < shelf + 3; y += 1) {
      wood(x, y, y === shelf);
    }
    put(x, shelf + 3, STONE_RAMP[1]);
  }
  // The two posts, down to the floor.
  for (const post of [left, right - 3]) {
    for (let y = head; y <= foot; y += 1) {
      put(post, y, STONE_RAMP[1]);
      put(post + 1, y, WOOD_LIGHT);
      put(post + 2, y, y >= foot - 1 ? STONE_RAMP[1] : WOOD);
    }
    // Iron at the joints.
    for (const joint of [head + 1, shelf + 1]) {
      put(post + 1, joint, IRON_LIGHT);
      put(post + 2, joint, IRON);
    }
  }
  // Pegs along the head rail, for a coil of rope or a strap.
  for (let x = left + 8; x < right - 6; x += 9) {
    put(x, head + 3, IRON_LIGHT);
    put(x, head + 4, IRON);
  }
}

/**
 * The locker: an iron-bound box as tall as a person, with a brass lock. What is
 * in it comes home whatever happens, and it looks like it would.
 */
function paintLocker(): void {
  const { left: tileLeft, right: tileRight, top, foot } = stationBox('locker');
  const put = stationPut(top);
  const left = tileLeft + 2;
  const right = tileRight - 2;
  const head = foot - 31;
  const middle = Math.floor((left + right) / 2);
  stationShadow(left, right, foot);
  for (let y = head; y <= foot; y += 1) {
    for (let x = left; x < right; x += 1) {
      const outline = x === left || x === right - 1 || y === head || y === foot;
      if (outline) {
        put(x, y, IRON);
        continue;
      }
      // The two doors, the light from the top left, and a band of iron at each hinge.
      const banded = y === head + 6 || y === head + 7 || y === foot - 7 || y === foot - 6;
      const seam = x === middle;
      if (seam) {
        put(x, y, IRON);
      } else if (banded) {
        put(x, y, x % 5 === 2 ? STONE_RAMP[7] : IRON_LIGHT);
      } else {
        const level = 2.4 + (x - left < 3 ? 1.1 : 0) + (y - head < 3 ? 0.9 : 0) - (x === middle - 1 ? 0.6 : 0);
        put(x, y, stoneAt(level, x, y));
      }
    }
  }
  // The lock, in the seam at hand height.
  const lockTop = head + 14;
  for (let y = lockTop; y < lockTop + 6; y += 1) {
    for (let x = middle - 2; x <= middle + 2; x += 1) {
      const rim = y === lockTop || y === lockTop + 5 || x === middle - 2 || x === middle + 2;
      put(x, y, rim ? GOLD_DARK : y === lockTop + 2 && x === middle ? IRON : GOLD);
    }
  }
}

paintFloor();
paintWall();
paintBanners();
paintRunner();
paintPorch();
paintFence();
// Back to front, because a nearer pillar's capital stands over a further one's foot.
for (const pillar of [...ARENA_PILLARS].sort((a, b) => a.y - b.y)) {
  paintPillar(pillar.x, pillar.y);
}
for (const torch of ARENA_TORCHES) {
  paintTorch(torch);
}
paintBench();
paintRack();
paintLocker();

// --- into tiles --------------------------------------------------------------

const sheetTiles: Uint8Array[] = [];
const seen = new Map<string, number>();

/** One layer's rows as tile numbers on the sheet, a repeat being the same number. */
function slice(picture: Picture): number[][] {
  const rows: number[][] = [];
  for (let tileY = 0; tileY < ARENA_HALL_HEIGHT; tileY += 1) {
    const row: number[] = [];
    for (let tileX = 0; tileX < ARENA_HALL_WIDTH; tileX += 1) {
      const pixels = new Uint8Array(ARENA_TILE * ARENA_TILE * 4);
      let any = false;
      for (let y = 0; y < ARENA_TILE; y += 1) {
        const from = ((tileY * ARENA_TILE + y) * WIDTH + tileX * ARENA_TILE) * 4;
        pixels.set(picture.data.subarray(from, from + ARENA_TILE * 4), y * ARENA_TILE * 4);
      }
      for (let at = 3; at < pixels.length; at += 4) {
        if (pixels[at] > 0) {
          any = true;
          break;
        }
      }
      if (!any) {
        row.push(-1);
        continue;
      }
      const key = createHash('sha1').update(pixels).digest('hex');
      let index = seen.get(key);
      if (index === undefined) {
        index = sheetTiles.length;
        sheetTiles.push(pixels);
        seen.set(key, index);
      }
      row.push(index);
    }
    rows.push(row);
  }
  return rows;
}

const groundRows = slice(ground);
const overRows = slice(over);

const rows = Math.ceil(sheetTiles.length / SHEET_COLUMNS);
const sheetWidth = SHEET_COLUMNS * ARENA_TILE;
const sheetHeight = rows * ARENA_TILE;
const sheet = Buffer.alloc(sheetWidth * sheetHeight * 4);
sheetTiles.forEach((tile, index) => {
  const column = index % SHEET_COLUMNS;
  const row = Math.floor(index / SHEET_COLUMNS);
  for (let y = 0; y < ARENA_TILE; y += 1) {
    const to = ((row * ARENA_TILE + y) * sheetWidth + column * ARENA_TILE) * 4;
    sheet.set(tile.subarray(y * ARENA_TILE * 4, (y + 1) * ARENA_TILE * 4), to);
  }
});
writePng(new URL('public/assets/arena-hall.png', ROOT).pathname, {
  width: sheetWidth,
  height: sheetHeight,
  data: sheet,
});

/** A layer as text: three base-36 digits a tile, `---` for none, a line a row. */
const encode = (layer: readonly (readonly number[])[]): string =>
  layer
    .map((row) => row.map((tile) => (tile < 0 ? '---' : tile.toString(36).padStart(3, '0'))).join(''))
    .join('\n');

const generated = `// Generated by scripts/draw-arena-hall.mts. Do not edit: edit the script and run it again.

export const ARENA_HALL_SHEET = {
  imagePath: 'assets/arena-hall.png',
  columns: ${SHEET_COLUMNS},
  rows: ${rows},
} as const;

/** What figures stand on: three base-36 digits a tile, \`---\` for none, a line a row. */
export const ARENA_HALL_GROUND = \`${encode(groundRows)}\`;

/** What figures pass behind, laid out as \`ARENA_HALL_GROUND\` is. */
export const ARENA_HALL_OVER = \`${encode(overRows)}\`;
`;
writeFileSync(new URL('src/game/base/generated/arenaHallTiles.ts', ROOT).pathname, generated);
console.log(`${sheetTiles.length} tiles on a ${sheetWidth}x${sheetHeight} sheet`);
