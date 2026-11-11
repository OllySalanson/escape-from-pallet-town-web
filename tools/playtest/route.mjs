// One search per walk, for a driver that walks the overworld a tile a press.
//
// Asking `WorldScene.isBlocked` for every tile of a breadth-first search, and
// searching again before every step, is what made the long ring drivers crawl:
// it reads every figure and trainer on the map for every tile it asks about,
// so on Greystone Vale (384x384) one step cost millions of reads, and
// `thirdRing.mjs` went four minutes without printing a line (the coast hunt of
// 11 Nov 2026). This reads what stands in the way once - the collision grid,
// every figure's held tiles, the trainers, the hunters and the barred exits -
// searches once, and hands back the whole route. A driver walks it and asks
// again only when a step does not land, because somebody on a beat or a hunter
// has moved into the lane.

/**
 * An expression for `page.evaluate`: the keys from where the player stands to
 * `goal`, `[]` when they are already there, or `null` when nothing reaches it.
 * The goal itself may be a figure or a wall: a walk ends facing into it.
 */
export const routeTo = (world, goal) => `(() => {
  const w = ${world};
  const c = w.collisionData, H = c.length, W = c[0].length;
  const goal = ${JSON.stringify(goal)};
  const s = w.currentTile;
  const id = (x, y) => y * W + x;
  if (s.x === goal.x && s.y === goal.y) return [];
  const blocked = new Uint8Array(W * H);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (c[y][x]) blocked[id(x, y)] = 1;
  const stand = (t) => { if (t && t.x >= 0 && t.y >= 0 && t.x < W && t.y < H) blocked[id(t.x, t.y)] = 1; };
  for (const entity of w.currentMap.entities) for (const t of w.entityHeldTiles(entity)) stand(t);
  for (const trainer of w.trainersForCurrentMap()) stand(trainer.position);
  for (const exit of w.barredExitsHere()) stand(exit.position);
  if (w.isHunterOnCurrentMap()) stand(w.hunterState.position);
  for (const hunter of w.hunterPackHere()?.hunters ?? []) stand(hunter.position);
  blocked[id(goal.x, goal.y)] = 0;
  const from = new Int32Array(W * H).fill(-1);
  const via = new Uint8Array(W * H);
  const start = id(s.x, s.y);
  from[start] = start;
  const steps = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const queue = new Int32Array(W * H);
  let head = 0, tail = 0;
  queue[tail++] = start;
  while (head < tail) {
    const here = queue[head++];
    const x = here % W, y = (here - x) / W;
    for (let d = 0; d < 4; d += 1) {
      const nx = x + steps[d][0], ny = y + steps[d][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const next = id(nx, ny);
      if (from[next] !== -1 || blocked[next]) continue;
      from[next] = here;
      via[next] = d;
      if (nx === goal.x && ny === goal.y) {
        const route = [];
        for (let at = next; at !== start; at = from[at]) route.push(keys[via[at]]);
        return route.reverse();
      }
      queue[tail++] = next;
    }
  }
  return null;
})()`;
