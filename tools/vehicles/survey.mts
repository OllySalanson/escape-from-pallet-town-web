import { getWorldMap, worldMapIds } from '../../src/game/worldMap';
import { extractionPointsOn } from '../../src/game/world/extractionPoints';

for (const id of worldMapIds()) {
  const map = getWorldMap(id);
  for (const point of extractionPointsOn(id)) {
    const { x, y } = point.position;
    const area = map.areas?.find((a) => x >= a.rect.x && y >= a.rect.y && x < a.rect.x + a.rect.width && y < a.rect.y + a.rect.height);
    const rows: string[] = [];
    for (let dy = -2; dy <= 2; dy += 1) {
      const row: string[] = [];
      for (let dx = -2; dx <= 2; dx += 1) {
        const m = map.terrain[y + dy]?.[x + dx] ?? '-';
        row.push((dx === 0 && dy === 0 ? '*' : '') + m.slice(0, 5).padEnd(5));
      }
      rows.push(row.join(' '));
    }
    console.log(`${id} ${point.label} @${x},${y} ${area?.kind ?? 'outdoors'} ${area?.style ?? ''} req=${point.requirement?.kind ?? 'none'}`);
    console.log(rows.map((r) => '   ' + r).join('\n'));
  }
}
