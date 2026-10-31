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
import { planLimits, startDistrict } from '../../worldPlan';
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

  // -- The Moor Foot, the first of the moor a walk up from the village meets ---------
  // Where the drove road comes off the ledges: the waystones on the west, the
  // fold the drovers rest the herd in on the east, and somebody at each.
  p.meadow(20, 56, 10, 6).meadow(33, 56, 8, 6);
  p.wood(20, 60, 2, 2).wood(40, 60, 2, 2);
  p.building('strange-stone', 23, 58).building('strange-stone', 26, 59);
  p.building('stump', 22, 57).building('stump', 28, 57);
  p.flowers([25, 57], [28, 60]);
  p.yard(34, 57, 6, 5, { gates: [[34, 59]], inner: '.' });
  p.building('crate-pair', 37, 58);
  // A place to get your breath back halfway up.
  p.building('bench', 21, 46);
  p.building('log', 28, 46);
  p.building('stump', 27, 48);
  p.flowers([28, 44], [21, 49]);

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
    itemSpots: [{ x: 8, y: 19 }, { x: 55, y: 38 }, { x: 34, y: 27, hidden: true }, { x: 24, y: 60, hidden: true }],
    extra: {
      signs: [
        { x: 33, y: 56, lines: ['HIGH MOOR', 'The drove road climbs to Moor Top, then north over the moor.'] },
        { x: 32, y: 34, lines: ['East: GREYSTONE PEAKS', 'North: the Grey Stones and the Moor Gate.'] },
        { x: 30, y: 6, lines: ['THE MOOR GATE', 'The old toll road leaves the vale here.'] },
        { x: 30, y: 13, lines: ['THE GREY STONES', 'The tor the vale is named for. The drovers touch it for luck.'] },
        { x: 29, y: 58, lines: ['THE WAYSTONES', 'They walked down from the tor one night. So the drovers say. Do not count them.'] },
      ],
      // What grazes and hops about the foot of the moor. One of the Tauros has
      // had enough of walking and will say so.
      pokemon: [
        { x: 38, y: 60, species: 'tauros', level: 7 },
        { x: 22, y: 59, species: 'clefairy', beat: { everyMs: 2300, roam: [[0, 1]] } },
        { x: 22, y: 50, species: 'spearow', beat: { everyMs: 1700, roam: [[1, 0], [1, -1]] } },
      ],
      people: [
        { x: 35, y: 58, name: 'Drover Boy', look: 'youngster', facing: 'down', lines: ['Grandad says they know the way home.', 'They do. They go there. All the time. Without me.'], beat: { everyMs: 3100, glances: ['right', 'down'] }, calls: ['Come back! Please!'] },
        { x: 24, y: 57, name: 'Lina', look: 'lass', facing: 'down', lines: ['I count them every time and get a different number.', 'I got six once. There were never six.'], beat: { everyMs: 3700, glances: ['left', 'right'] }, calls: ['One, two, three... wait.'] },
        { x: 36, y: 49, name: 'Tarn Fisher', look: 'fisherman', facing: 'up', lines: ['Up on the moor the water has nothing in it but sky.', 'I come for the quiet. Well. I did.'] },
        { x: 37, y: 38, name: 'Peak Walker', look: 'hiker', facing: 'left', lines: ['East is the quarry, and the caves under it. Mind who you meet in there.', 'I have been meaning to go. I have been meaning to go for years.'], beat: { everyMs: 3500, glances: ['up', 'right'] }, calls: ['Lovely day for it.'] },
        { x: 27, y: 47, name: 'Walker', look: 'hiker', facing: 'left', lines: ['Going up? You will not get down the way you came, not by the ledges. They only go one way.', 'Quick, mind. Very quick.'], beat: { everyMs: 3300, glances: ['up', 'down'] }, calls: ['Mind the ledges!'] },
        { x: 15, y: 26, name: 'Shepherd', look: 'old-man', facing: 'right', lines: ['The tarn never freezes, whatever the winter.', 'There was a sheep track west, under it, to the old chapel.', 'By day the fog turns you back. Go after dark, if you go.'] },
      ],
      trainers: [
        { x: 28, y: 29, name: 'Drover Hale', team: 'drover', look: 'hiker', facing: 'left', sight: 0, lines: ['This road is for the herd!', 'Show me your Pokemon if you want to pass.'] },
      ],
      landmarks: [{ x: 50, y: 37, name: 'Moor Spring', kind: 'spring' }],
    },
  });
  return { file, notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}
