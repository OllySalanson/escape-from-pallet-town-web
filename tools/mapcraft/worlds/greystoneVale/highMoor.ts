/**
 * HIGH MOOR, the moor above Millbrook.
 *
 * The one idea: the old drove road crosses the moor past the Grey Stones, a
 * tor, and drops south to the village by stacked ledges. It is drawn as FireRed draws a
 * route - a corridor about two dozen tiles wide, framed by wood on one side and
 * the rock of the peaks on the other - because an open moor sixty tiles wide
 * read to blind judges as empty lawn with props dropped on it.
 *
 * - The drove road climbs from Millbrook through three rows of ledges, switching
 *   back through a gap in each; going down, the ledges are the quick way.
 * - Moor Top, a knoll beside the road above the ledges, is a landing.
 * - North of it the road runs past the drovers' fold and the Grey Stones to
 *   the Moor Gate and its old toll house, the way off the map.
 * - A rock-walled trail leaves east for Greystone Peaks, past a spring.
 * - A gap in the west wood opens on the shepherd's clearing and its tarn, and
 *   under the tarn a sheep track nobody signs goes on west into the fog, to the
 *   Moor Chapel - a way open only after dark.
 */
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

export function highMoor(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'high-moor');

  // -- The drove road's corridor, framed by the wood --------------------------
  // The land shapes the road: big things stand on one side of the corridor and
  // then the other - the toll house, the tor, the fold, Moor Top, the tarn - and
  // the road winds between them. (A straight road with things set beside it
  // read to blind judges as "a checklist of features".)
  p.meadow(20, 4, 20, 54);

  // The Moor Gate: the old toll house where the road leaves the vale.
  p.building('cottage', 21, 5);
  p.road([[23, 8], [23, 9], [27, 9]]);
  p.flowers([26, 6], [26, 7]);
  p.bedRows([5, 33, 37], [6, 32, 38], [7, 32, 39], [8, 33, 39], [9, 34, 39], [10, 35, 38]);
  p.wood(36, 4, 4, 2);

  // The Grey Stones: the tor, one clean mass on the west of the corridor.
  p.rock(20, 13, 10, 8);
  p.wood(20, 11, 4, 2).wood(20, 21, 4, 2); // the wood comes down to the tor's flanks
  p.bedRows([14, 36, 39], [15, 35, 39], [16, 35, 39], [17, 36, 39], [18, 36, 39], [19, 37, 39]);

  // The drovers' heather on the east, right up to the road.
  p.block(29, 24, 11, 8, 'g');
  p.bedRows([23, 20, 23], [24, 20, 23], [25, 20, 23], [26, 20, 23], [27, 20, 22], [28, 20, 22]);

  // Moor Top, on the west, over a short step down; the trail east forks here.
  p.rock(20, 34, 4, 2);
  p.bushes([25, 37], [25, 38]);
  p.flowers([20, 39], [23, 39], [21, 40]);
  p.ledge(20, 23, 42);

  // The tarn, on the east, with reeds round it.
  p.block(31, 43, 9, 5, 'W');
  p.bedRows([42, 34, 37], [48, 31, 34], [49, 31, 33]);
  p.wood(38, 48, 2, 2);

  // The last drop to the village: a row of ledges across the corridor's foot,
  // the road round its end.
  p.ledge(20, 29, 53).ledge(33, 39, 53);
  p.bedRows([54, 20, 28], [55, 20, 27], [54, 33, 39], [55, 34, 38], [44, 20, 23], [45, 20, 22]);
  p.flowers([36, 51], [37, 52], [22, 49]);

  // The road last, so nothing drawn round it cuts it.
  p.road(
    [[28, 2], [28, 10], [32, 10], [32, 22], [25, 22], [25, 32], [28, 32], [28, 40], [24, 40], [24, 50], [30, 50], [30, 62]],
    { width: 3 },
  );

  // -- The trail east to Greystone Peaks, between walls of rock ----------------
  p.meadow(40, 32, 18, 8);
  p.rock(42, 26, 16, 6).rock(42, 40, 16, 6);
  p.road([[30, 36], [62, 36]]);
  p.bedRows([32, 46, 51], [33, 45, 52], [38, 47, 54], [39, 48, 53]);

  // -- The shepherd's clearing, through a gap in the west wood ------------------
  p.meadow(6, 12, 12, 18).meadow(16, 24, 4, 2);
  p.pond(7, 13, 7, 5); // the tarn
  p.building('cottage', 9, 20);
  p.road([[11, 23], [11, 24], [27, 24]]);
  p.flowers([8, 22], [14, 21], [15, 22], [8, 27], [9, 28]);
  p.bedRows([26, 12, 16], [27, 12, 16], [28, 13, 16]);
  p.wood(6, 26, 4, 4).wood(14, 12, 4, 2);
  // The sheep track west under the tarn, out of the clearing into the fog: the
  // Moor Chapel's way in, which its own district shuts by day (`plan.ts`).
  p.meadow(4, 18, 2, 2);

  const file = districtFile(GREYSTONE_VALE, 'high-moor', p, {
    dropIns: [{ x: 22, y: 37, name: 'Moor Top', description: 'A knoll above the drove road, with the whole moor ahead of it.' }],
    itemSpots: [{ x: 8, y: 19 }, { x: 55, y: 38 }, { x: 34, y: 27, hidden: true }],
    extra: {
      signs: [
        { x: 33, y: 56, lines: ['HIGH MOOR', 'The drove road climbs to Moor Top, then north over the moor.'] },
        { x: 32, y: 34, lines: ['East: GREYSTONE PEAKS', 'North: the Grey Stones and the Moor Gate.'] },
        { x: 30, y: 6, lines: ['THE MOOR GATE', 'The old toll road leaves the vale here.'] },
        { x: 30, y: 13, lines: ['THE GREY STONES', 'The tor the vale is named for. The drovers touch it for luck.'] },
      ],
      people: [
        { x: 15, y: 26, name: 'Shepherd', look: 'old-man', facing: 'right', lines: ['The tarn never freezes, whatever the winter.', 'The drovers fight for the right of way on the road.'] },
      ],
      trainers: [
        { x: 28, y: 29, name: 'Drover Hale', team: 'drover', look: 'hiker', facing: 'left', sight: 0, lines: ['This road is for the herd!', 'Show me your Pokemon if you want to pass.'] },
      ],
      landmarks: [{ x: 50, y: 37, name: 'Moor Spring', kind: 'spring' }],
    },
  });
  return { file, notes: p.notes };
}
