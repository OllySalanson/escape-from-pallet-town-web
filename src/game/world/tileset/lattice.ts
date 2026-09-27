import type { LatticeTiles } from './catalogue';

/**
 * How FireRed stands a wood of its route conifers on a map.
 *
 * A tree is two tiles wide. Its *body* is one row and its *base* the row under
 * it, and both are wall; its *tip* hangs over the tile above the body, which is
 * ground. A wood is trees stacked on a two-row period, so the base of each tree
 * is the row the tip of the tree below is drawn in. That is why a wood has to
 * be drawn on the lattice: trees stand on even columns, bodies on even rows and
 * bases on odd ones, and a wood is whole trees - any tile of it that no whole
 * tree covers is a bush (`stray`), which reads as undergrowth rather than as
 * half a tree.
 *
 * Which of the fourteen cells a tile is depends only on which trees stand
 * round it, so it is read off the drawing rather than written into it:
 *
 * - a **body** takes the plain cell when the tree beside it and the trees above
 *   both stand, because then the shadow of the row above runs across between
 *   them; otherwise the edge cell, whose side is open;
 * - a **base** takes the overlap cell when a tree stands below (its tip is
 *   drawn into this row) and the plain cell when the tree beside it has its
 *   base in the same row, so the two shadows join.
 *
 * Everything here is Phaser-free and asked of the sketch alone. `isTree` answers
 * for any tile, off the map included - off the map counts as wood, so a wood run
 * to the map's edge does not grow a rim there.
 */
export type TreeAt = (x: number, y: number) => boolean;

/** Whether a whole tree stands with its body's west cell at `(2c, 2r)`. */
function treeStands(isTree: TreeAt, c: number, r: number): boolean {
  const x = 2 * c;
  const y = 2 * r;
  return isTree(x, y) && isTree(x + 1, y) && isTree(x, y + 1) && isTree(x + 1, y + 1);
}

/** The cell a tile of the wood is drawn with. */
export function latticeTile(tiles: LatticeTiles, isTree: TreeAt, x: number, y: number): number {
  const c = Math.floor(x / 2);
  const r = Math.floor(y / 2);
  if (!treeStands(isTree, c, r)) {
    return tiles.stray;
  }
  const side = x - 2 * c;
  const beside = side === 0 ? c - 1 : c + 1;
  if (y - 2 * r === 0) {
    const shaded =
      treeStands(isTree, beside, r) &&
      treeStands(isTree, c, r - 1) &&
      treeStands(isTree, beside, r - 1);
    return (shaded ? tiles.body : tiles.bodyEdge)[side];
  }
  const joined = treeStands(isTree, beside, r);
  if (treeStands(isTree, c, r + 1)) {
    return (joined ? tiles.overlap : tiles.overlapEdge)[side];
  }
  return (joined ? tiles.base : tiles.baseEdge)[side];
}

/**
 * The tip a tile of open ground carries, or -1: a tile does when it is the row
 * above a tree's body. Only a tile that is not itself wood is asked - inside a
 * wood the tip is part of the overlap cell.
 */
export function latticeTip(tiles: LatticeTiles, isTree: TreeAt, x: number, y: number): number {
  if (y % 2 === 0) {
    return -1;
  }
  const c = Math.floor(x / 2);
  const r = (y + 1) / 2;
  if (!treeStands(isTree, c, r)) {
    return -1;
  }
  return tiles.tip[x - 2 * c];
}
