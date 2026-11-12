import { it } from 'vitest';
import { beatSpots, BUILT_IN_MAP_FILE_LIMITS, buildPlayerMap, playerMapId, buildingDoorways } from '../../../../src/game/world/mapFile';
import { registerPlayerMap } from '../../../../src/game/world/playerMaps';
import { getWorldMap } from '../../../../src/game/worldMap';
import { gateKey, gatesForMap } from '../../../../src/game/world/gates';
import greystoneVale from './index';
import { GREYSTONE_VALE } from './plan';
import { bareDistrict, valeSolid, walkDistrict } from './walkedTwoAbreast.testkit';

it('scratch', () => {
  const id = process.env.D!;
  const d = GREYSTONE_VALE.districts.find((x) => x.id === id)!;
  const { file } = (greystoneVale().districts as any)[id];
  const ORIGIN = { x: (d.cell[0] + 1) * 64, y: (d.cell[1] + 1) * 64 };
  const opened = gatesForMap('greystone-vale').map(gateKey);
  const own = buildPlayerMap(file, BUILT_IN_MAP_FILE_LIMITS); registerPlayerMap(own);
  const coll = getWorldMap(playerMapId(file)).collision;
  const vs = valeSolid(ORIGIN, opened);
  const solid = process.env.STITCHED ? vs : (x: number, y: number) => coll[y][x];
  const vale = getWorldMap('greystone-vale', opened).collision;
  const starts: { x: number; y: number }[] = [];
  for (let i = 0; i < 64; i++) for (const [x, y, dx, dy] of [[i, 0, 0, -1], [i, 63, 0, 1], [0, i, -1, 0], [63, i, 1, 0]] as const)
    if (!vs(x, y) && vale[ORIGIN.y + y + dy]?.[ORIGIN.x + x + dx] === false) starts.push({ x, y });
  for (const l of file.landings ?? []) if (l.area === undefined) starts.push({ x: l.x, y: l.y });
  if (process.env.ONLY) { starts.length = 0; for (const e of process.env.ONLY.split(' ')) { const [x, y] = e.split(',').map(Number); starts.push({ x, y }); } }
  const walked = walkDistrict(file, solid, starts);
  const out: string[] = ['starts ' + starts.map((s) => `${s.x},${s.y}`).join(' ')];
  for (const p of walked.places()) if (p.steps < 0) out.push(`SNAG ${p.name} (${p.x},${p.y})`);
  if (process.env.BARE) { const bare = bareDistrict(file); for (const l of walked.longerTwoAbreast(walkDistrict(bare.file, bare.solid, starts))) out.push('LONGER ' + l); }
  out.push('blocked ' + walked.blockedOn(',d').join(' '));
  if (process.env.CULPRIT2) {
    const base = walked.longerTwoAbreast(walkDistrict(bareDistrict(file).file, bareDistrict(file).solid, starts)).length;
    for (const key of ['buildings', 'people', 'pokemon', 'trainers', 'signs', 'berryTrees', 'landmarks'] as const) {
      const list = (file as any)[key] ?? [];
      list.forEach((thing: any, i: number) => {
        if (thing.area !== undefined) return;
        const f2 = { ...file, id: `${file.id}-c${key}${i}`, [key]: list.filter((_: unknown, j: number) => j !== i) } as any;
        let c2: boolean[][];
        try { registerPlayerMap(buildPlayerMap(f2, BUILT_IN_MAP_FILE_LIMITS)); c2 = getWorldMap(playerMapId(f2)).collision; } catch { return; }
        const b2 = bareDistrict(f2);
        const n = walkDistrict(f2, (x, y) => c2[y][x], starts).longerTwoAbreast(walkDistrict(b2.file, b2.solid, starts)).length;
        if (n < base) out.push(`CULPRIT ${key} ${thing.kind ?? thing.name ?? thing.species ?? thing.lines?.[0]} ${thing.x},${thing.y}: ${base} -> ${n}`);
      });
    }
  }
  for (const b of file.buildings ?? []) if (b.area === undefined) for (const dd of buildingDoorways(b)) out.push(`door ${b.kind} ${b.x},${b.y} -> ${dd.x},${dd.y}`);
  for (const e of file.exits ?? []) out.push(`exit ${e.name} ${e.x},${e.y}`);
  for (const l of file.landings ?? []) out.push(`landing ${l.name} ${l.x},${l.y}`);
  const held = new Map<string, string>();
  const OUT = (s: { area?: string }) => s.area === undefined;
  for (const f of [...(file.people ?? []), ...(file.pokemon ?? [])].filter(OUT)) for (const s of [f, ...beatSpots(f)]) held.set(`${s.x},${s.y}`, '@');
  for (const t of (file.trainers ?? []).filter(OUT)) held.set(`${t.x},${t.y}`, '!');
  for (const t of (file.signs ?? []).filter(OUT)) held.set(`${t.x},${t.y}`, '$');
  for (const t of (file.berryTrees ?? []).filter(OUT)) held.set(`${t.x},${t.y}`, 'b');
  for (const t of (file.landmarks ?? []).filter(OUT)) held.set(`${t.x},${t.y}`, 'L');
  for (const t of (file.itemSpots ?? []).filter(OUT)) if (!held.has(`${t.x},${t.y}`)) held.set(`${t.x},${t.y}`, '*');
  out.push('    ' + Array.from({ length: 64 }, (_, x) => (x % 10).toString()).join(''));
  for (let y = 0; y < 64; y++) {
    let row = String(y).padStart(3) + ' ';
    for (let x = 0; x < 64; x++) {
      const h = held.get(`${x},${y}`); const g = file.ground[y][x];
      if (h && (h !== '*' || solid(x, y) === false)) row += h === '*' ? (walked.twoAbreast(x, y) >= 0 ? '*' : '%') : h;
      else if (solid(x, y)) row += g === 'W' ? '~' : g === 'T' ? 'T' : '#';
      else row += walked.twoAbreast(x, y) >= 0 ? (g === ',' || g === 'd' ? '=' : g === 'M' ? 'm' : g === '_' ? '_' : g === 'G' || g === 'g' ? '"' : '.') : 'x';
    }
    out.push(row);
  }
  process.stderr.write(out.join('\n') + '\n');
}, 900000);
