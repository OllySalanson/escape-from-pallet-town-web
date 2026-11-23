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
  const stand = (t, into = blocked) => { if (t && t.x >= 0 && t.y >= 0 && t.x < W && t.y < H) into[id(t.x, t.y)] = 1; };
  for (const trainer of w.trainersForCurrentMap()) stand(trainer.position);
  for (const exit of w.barredExitsHere()) stand(exit.position);
  blocked[id(goal.x, goal.y)] = 0;
  // Whoever moves - a figure on its beat, a hunter - stands in the way only for
  // now. Read as walls, one in a one-tile gap made a walk say "no way" and give
  // up without a frame passing, so it never moved on: a beaten hunter beside the
  // X in SMUGGLERS' COVE, a roamer in FISHER'S ROW (scenario loop, 23 Nov 2026).
  // They are gone round where something else gets through, and walked through
  // where nothing does: a step that does not land is replanned by the driver.
  // A sign or a tree never moves on, so only people and Pokemon (both npc) count as movers.
  const moving = new Uint8Array(W * H);
  for (const entity of w.currentMap.entities) {
    const mover = entity.kind === 'npc';
    for (const t of w.entityHeldTiles(entity)) stand(t, mover ? moving : blocked);
  }
  if (w.isHunterOnCurrentMap()) stand(w.hunterState.position, moving);
  // As the scene's own isBlocked asks the pack: a hunter beaten, fled or not yet
  // out holds no tile, and one listed anyway walled the player into the X's
  // nook in SMUGGLERS' COVE.
  const pack = w.hunterPackHere();
  for (const hunter of pack?.hunters ?? []) if (pack.hunterAt(hunter.position)) stand(hunter.position, moving);
  moving[id(goal.x, goal.y)] = 0;
  // An open exit is ground, and the step that finishes on it ends the raid: a
  // walk to somewhere else goes round it, and crosses one only where nothing
  // else gets through. The AI playtester walked the Tanglewood road down the
  // edge of its lane onto DEER GAP twice and was sent home (the overnight
  // playtest of 20 Nov 2026).
  const exits = new Uint8Array(W * H);
  for (const exit of w.extractionPointsForCurrentMap?.() ?? []) {
    const at = exit.position;
    if (at && at.x >= 0 && at.y >= 0 && at.x < W && at.y < H && !(at.x === goal.x && at.y === goal.y)) exits[id(at.x, at.y)] = 1;
  }
  const steps = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  const start = id(s.x, s.y);
  const search = (avoidExits, avoidMoving = true) => {
    const from = new Int32Array(W * H).fill(-1);
    const via = new Uint8Array(W * H);
    from[start] = start;
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
        if (from[next] !== -1 || blocked[next] || (avoidMoving && moving[next]) || (avoidExits && exits[next])) continue;
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
  };
  return search(true) ?? search(false) ?? search(true, false) ?? search(false, false);
})()`;
