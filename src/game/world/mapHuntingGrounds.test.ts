import { describe, expect, it } from 'vitest';
import { getWorldMap } from '../worldMap';
import { idleBeatTiles } from './npcIdle';
import { entitiesForMap } from './npcs';
import { inGround } from './hunterPack';
import { huntingGroundsOn } from './mapHuntingGrounds';
import { PLAYER_MAP_TILESET } from './tileset/playerMapTileset';

describe('where a hunter patrols a peopled map', () => {
  const map = getWorldMap('greystone-vale');
  const key = (tile: { readonly x: number; readonly y: number }) => tile.y * map.width + tile.x;
  const stoodOn = new Set(entitiesForMap(map.id).flatMap((entity) => idleBeatTiles(entity)).map(key));

  it.each(huntingGroundsOn(map).map((ground) => [ground.name, ground] as const))(
    'walks the whole loop of %s, past everybody standing in it',
    (_name, ground) => {
      const seen = new Set([key(ground.post)]);
      const queue = [ground.post];
      for (let head = 0; head < queue.length; head += 1) {
        const { x, y } = queue[head];
        for (const next of [
          { x: x + 1, y },
          { x: x - 1, y },
          { x, y: y + 1 },
          { x, y: y - 1 },
        ]) {
          if (seen.has(key(next)) || !inGround(ground, next)) continue;
          if (map.collision[next.y]?.[next.x] !== false || stoodOn.has(key(next))) continue;
          seen.add(key(next));
          queue.push(next);
        }
      }
      expect(ground.route.filter((corner) => stoodOn.has(key(corner)))).toEqual([]);
      expect(ground.route.filter((corner) => !seen.has(key(corner)))).toEqual([]);
    },
  );

  // Frostreef's ice is the sea frozen, so its sand keeps its waterline there too.
  it('draws surf where a beach meets the water and nowhere else', () => {
    const fill = PLAYER_MAP_TILESET.materials.beach.roles.fill;
    const wrong: string[] = [];
    for (let y = 1; y < map.height - 1; y += 1) {
      for (let x = 1; x < map.width - 1; x += 1) {
        if (map.terrain[y][x] !== 'beach') continue;
        const nearWater = [-1, 0, 1].some((dy) =>
          [-1, 0, 1].some((dx) => ['water', 'ice'].includes(map.terrain[y + dy][x + dx] ?? '')),
        );
        if (!nearWater && map.layers.ground.tiles[y][x] !== fill) wrong.push(`${x},${y}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});
