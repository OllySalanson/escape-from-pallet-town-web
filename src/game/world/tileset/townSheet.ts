import { tileReader, type PropCell, type PropDefinition } from './catalogue';
import { TOWN_PIECES, TOWN_SHEET, type TownPieceName } from '../generated/townPieces';

/**
 * Kanto's town buildings, cut out of FireRed's own maps by
 * `scripts/cut-frlg-towns.mjs` from pret/pokefirered - the Museum, Silph Co.,
 * the Game Corner, every Gym, the houses each town is built of. Provenance:
 * `public/assets/ASSET_PROVENANCE.md`.
 */
export const TOWN_SHEET_SOURCE = tileReader(
  {
    textureKey: 'frlgTowns',
    imagePath: TOWN_SHEET.imagePath,
    columns: TOWN_SHEET.columns,
    rows: TOWN_SHEET.rows,
  },
  // Clear of every other sheet: classic from 0, Overworld from 1000, the
  // FireRed ground from 3000, the base from 5000, the Kanto pieces from 6000
  // and the player's house from 7000.
  8000,
);

/**
 * Cells a player walks on, by piece: the boards of Vermilion's pier between its
 * two lamps, the steps up to a north-south gatehouse's door and the floor of
 * the east-west one's porches. Everything else drawn is wall, and a cell the cut
 * left empty is nothing at all.
 */
const WALKED: Partial<Record<TownPieceName, readonly (readonly [number, number])[]>> = {
  pier: [2, 3, 4, 5, 6, 7].flatMap((y) => [2, 3, 4].map((x) => [x, y] as const)),
  route2Gate: [1, 2, 3, 4].map((x) => [x, 6] as const),
  saffronGate: [1, 2, 3, 4].map((x) => [x, 7] as const),
  saffronSideGate: [3, 4].flatMap((y) => [0, 7].map((x) => [x, y] as const)),
};

/**
 * Cells a player walks behind, which FireRed draws over them: the ridge of a
 * north-south gatehouse's roof, stood on to go in from the north, and the roof
 * of each porch of the east-west one. What decides whether they can be walked is
 * the ground a map lays under them.
 */
const WALKED_UNDER: Partial<Record<TownPieceName, readonly (readonly [number, number])[]>> = {
  route2Gate: [1, 2, 3, 4].map((x) => [x, 0] as const),
  saffronGate: [1, 2, 3, 4].map((x) => [x, 0] as const),
  saffronSideGate: [1, 2].flatMap((y) => [0, 7].map((x) => [x, y] as const)),
};

/**
 * The step in front of a building's front door - FireRed draws the Museum's
 * and the Mansion's into the building - which is walked onto to go in: the
 * cell below each cell of the bottom row of its doors.
 */
function frontSteps(name: TownPieceName): readonly (readonly [number, number])[] {
  const doors = (TOWN_PIECES[name].doors as readonly (readonly [number, number, string])[]).filter(
    ([, , way]) => way === 'door',
  );
  const bottom = doors[0]?.[1];
  return doors.filter(([, y]) => y === bottom).map(([x, y]) => [x, y + 1] as const);
}

/** A town piece as a landmark: wall where it is drawn, ground where it is walked, nothing where it is empty. */
function townProp(name: TownPieceName): PropDefinition {
  const piece = TOWN_PIECES[name];
  const walked = new Set(
    [...(WALKED[name] ?? []), ...frontSteps(name)].map(([x, y]) => `${x},${y}`),
  );
  const under = new Set((WALKED_UNDER[name] ?? []).map(([x, y]) => `${x},${y}`));
  const cells: PropCell[] = [];
  for (let y = 0; y < piece.height; y += 1) {
    for (let x = 0; x < piece.width; x += 1) {
      const tile = TOWN_SHEET_SOURCE.at(piece.column + x, piece.row + y);
      cells.push(
        piece.cells[y][x] !== '#'
          ? { tile: -1, solid: false }
          : under.has(`${x},${y}`)
            ? { tile, solid: false, canopy: true, walkedUnder: true }
            : { tile, solid: !walked.has(`${x},${y}`) },
      );
    }
  }
  return { label: name, width: piece.width, height: piece.height, cells };
}

export const TOWN_PROPS = Object.fromEntries(
  (Object.keys(TOWN_PIECES) as TownPieceName[]).map((name) => [name, townProp(name)]),
) as Record<TownPieceName, PropDefinition>;
