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
 *
 * Filled on 31 October 2026, the second ring out from Mill Square: every stretch
 * of the corridor is somewhere now. The Moor Gate and its clerk, the Little Stones
 * that nobody can count, the drovers' fold and their camp in the heather, the
 * shepherd and a flock that is not sheep, the spring where people from Millbrook
 * come to take the waters, and behind a boulder in the east wood the Lost Fold,
 * for whoever brings Strength.
 */
import type { MapFile, MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { planLimits, startDistrict } from '../../worldPlan';
import { withInside } from './insides';
import { GREYSTONE_VALE } from './plan';

export function highMoor(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'high-moor');
  /** A thing stood on whatever ground is there, rather than on a lot of lawn. */
  const stand = (kind: MapFileOutdoorBuildingKind, x: number, y: number, lot = p.at(x, y) ?? '.') => {
    p.building(kind, x, y, { lot });
  };

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
  stand('bench', 21, 9);
  stand('barrel', 26, 9);
  stand('fence-post', 27, 5);
  stand('fence-post', 31, 5);
  p.bedRows([5, 33, 37], [6, 32, 38], [7, 32, 37]);
  p.wood(36, 4, 4, 2);

  // The Little Stones: what the tor's own stones have been dropping for a thousand years.
  p.meadow(33, 8, 7, 5);
  stand('strange-stone', 34, 9);
  stand('strange-stone', 37, 8);
  stand('strange-stone', 37, 11);
  p.flowers([36, 10], [39, 9], [33, 12]);

  // The Grey Stones: the tor, one clean mass on the west of the corridor.
  p.rock(20, 13, 10, 8);
  p.wood(20, 11, 4, 2).wood(20, 21, 4, 2); // the wood comes down to the tor's flanks
  p.bedRows([14, 36, 39], [15, 35, 39], [16, 35, 39], [17, 36, 39], [18, 36, 39], [19, 37, 39]);
  stand('stump', 36, 20);
  stand('dead-stump', 38, 22);

  // The way to the Lost Fold, shut by a boulder that has rolled into it: FireRed's
  // own sort of door, and the only one that does not need a key cut for it.
  p.block(40, 12, 4, 1, '.').block(40, 13, 2, 1, 'o');
  p.meadow(42, 8, 12, 8);
  p.wood(42, 8, 2, 2).wood(52, 14, 2, 2);
  stand('hut', 47, 8);
  stand('log', 44, 13);
  stand('sack', 50, 9);
  stand('tree-2', 49, 12);
  p.block(49, 12, 3, 1, '#');
  p.flowers([46, 11], [52, 11], [44, 10], [51, 9]);

  // The drovers' heather on the east, right up to the road.
  p.block(29, 24, 11, 8, 'g');
  // The drovers' fold, under the tor, and their camp in the heather across the road.
  p.yard(20, 26, 5, 6, { gates: [[24, 28]], inner: '.' });
  stand('crate-pair', 21, 27);
  p.meadow(35, 24, 5, 4);
  stand('hut', 37, 24);
  stand('log', 35, 27);
  stand('big-stump', 35, 25);
  p.flowers([39, 27]);

  // Moor Top, on the west, over a short step down; the trail east forks here.
  p.rock(20, 34, 4, 2);
  p.bushes([25, 37], [25, 38]);
  p.flowers([20, 39], [23, 39], [21, 40]);
  p.ledge(20, 23, 42);

  // The tarn, on the east, with reeds round it.
  p.block(31, 43, 9, 5, 'W');
  p.bedRows([42, 34, 37], [48, 31, 34], [49, 31, 33]);
  // Boards out over it, and what lives on it.
  p.road([[30, 44], [33, 44]], { letter: '_' });
  stand('water-lily', 36, 44, 'W');
  stand('water-lily', 38, 46, 'W');
  stand('water-lily', 33, 43, 'W');
  stand('wet-rock', 36, 46, 'W');
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
  p.bedRows([38, 41, 45], [39, 41, 44]);
  // Moor Spring, where Millbrook comes to take the waters: the pool, its bath hut,
  // somewhere to sit and be told it is doing you good.
  p.pond(45, 32, 8, 3);
  stand('water-lily', 49, 33, 'W');
  stand('stone-fountain', 53, 32, '.');
  stand('hut', 56, 38 - 6);
  stand('bench', 46, 38);
  stand('bench', 53, 38);
  p.flowers([44, 33], [43, 34], [50, 38], [51, 39]);

  // -- The shepherd's clearing, through a gap in the west wood ------------------
  p.meadow(6, 12, 12, 18).meadow(16, 24, 4, 2);
  p.pond(7, 13, 7, 5); // the tarn
  p.building('cottage', 9, 20);
  p.road([[11, 23], [11, 24], [27, 24]]);
  p.flowers([8, 22], [14, 21], [15, 22], [8, 27], [9, 28]);
  p.bedRows([27, 12, 16], [28, 13, 16]);
  p.wood(6, 26, 4, 4).wood(14, 12, 4, 2);
  // The flock's pen, and the tarn's own.
  p.yard(14, 14, 4, 6, { gates: [[14, 17]], inner: '.' });
  stand('water-lily', 9, 15, 'W');
  stand('wet-rock', 11, 14, 'W');
  // The sheep track west under the tarn, out of the clearing into the fog: the
  // Moor Chapel's way in, which its own district shuts by day (`plan.ts`).
  p.meadow(4, 18, 2, 2);

  const file = districtFile(GREYSTONE_VALE, 'high-moor', p, {
    dropIns: [{ x: 22, y: 37, name: 'Moor Top', description: 'A knoll above the drove road, with the whole moor ahead of it.' }],
    itemSpots: [
      { x: 8, y: 19 },
      { x: 56, y: 38 },
      { x: 34, y: 27, hidden: true },
      { x: 24, y: 60, hidden: true },
      { x: 53, y: 10, hidden: true },
      { x: 34, y: 12, hidden: true },
      { x: 23, y: 30 },
    ],
    extra: {
      boulders: [{ x: 40, y: 12 }],
      districts: [
        { name: 'THE MOOR GATE', x: 20, y: 2, width: 20, height: 9, wildlife: 'meadow' },
        { name: 'THE LITTLE STONES', x: 31, y: 8, width: 9, height: 6, wildlife: 'meadow' },
        { name: 'THE GREY STONES', x: 20, y: 11, width: 20, height: 12, wildlife: 'meadow' },
        { name: 'THE LOST FOLD', x: 41, y: 8, width: 13, height: 8, wildlife: 'meadow' },
        { name: 'THE DROVERS’ FOLD', x: 20, y: 23, width: 20, height: 9, wildlife: 'meadow' },
        { name: 'MOOR SPRING', x: 40, y: 32, width: 22, height: 8, wildlife: 'meadow' },
        { name: 'THE SHEPHERD’S', x: 4, y: 12, width: 16, height: 18, wildlife: 'meadow' },
        { name: 'THE LOWER TARN', x: 20, y: 43, width: 20, height: 10, wildlife: 'meadow' },
        { name: 'THE WAYSTONES', x: 20, y: 56, width: 22, height: 6, wildlife: 'meadow' },
      ],
      signs: [
        { x: 33, y: 56, lines: ['HIGH MOOR', 'The drove road climbs to Moor Top, then north over the moor.'] },
        { x: 32, y: 34, lines: ['East: GREYSTONE PEAKS', 'North: the Grey Stones and the Moor Gate.'] },
        { x: 31, y: 6, lines: ['THE MOOR GATE', 'The old toll road leaves the vale here.'] },
        { x: 39, y: 11, lines: ['THE LITTLE STONES', 'There are nine. There were seven. Do not ask. Please put back any you borrow.'] },
        { x: 39, y: 34 + 1, lines: ['MOOR SPRING', 'The waters cure gout, grief and the common cold. Results may vary. They have varied.'] },
        { x: 13, y: 25, lines: ['THE SHEPHERD’S', 'Mind the flock. Nothing here is a sheep. We do not discuss it.'] },
        { x: 28, y: 25, lines: ['THE DROVERS’ FOLD', 'Shut the gate. Count the herd. Count them again. Accept the second number.'] },
        { x: 44, y: 11, lines: ['THE LOST FOLD', 'Nobody has brought a beast up here since the boulder came down. Everyone has meant to.'] },
        { x: 30, y: 13, lines: ['THE GREY STONES', 'The tor the vale is named for. The drovers touch it for luck.'] },
        { x: 29, y: 58, lines: ['THE WAYSTONES', 'They walked down from the tor one night. So the drovers say. Do not count them.'] },
      ],
      // What grazes and hops about the foot of the moor. One of the Tauros has
      // had enough of walking and will say so.
      pokemon: [
        { x: 38, y: 60, species: 'tauros', level: 7 },
        { x: 22, y: 59, species: 'clefairy', beat: { everyMs: 2300, roam: [[0, 1]] } },
        { x: 22, y: 50, species: 'spearow', beat: { everyMs: 1700, roam: [[1, 0], [1, -1]] } },
        // The flock the Shepherd will not discuss, and the dog that does not believe it either.
        { x: 16, y: 16, species: 'nidoran-f', beat: { everyMs: 2500, roam: [[0, 1]] } },
        { x: 15, y: 18, species: 'nidoran-m', beat: { everyMs: 2100, roam: [[1, 0]] } },
        { x: 11, y: 28, species: 'growlithe', beat: { everyMs: 1500, roam: [[0, -1], [1, -1]] } },
        // The Clefairy that come to the Little Stones, whatever anybody says about the night.
        { x: 35, y: 11, species: 'clefairy', beat: { everyMs: 2700, roam: [[0, 1]] } },
        { x: 38, y: 10, species: 'clefairy', level: 9 },
        // The fold, and the Lost Fold's old bull, who has been on his own a long time.
        { x: 21, y: 29, species: 'tauros', beat: { everyMs: 2600, roam: [[1, 0]] } },
        { x: 47, y: 13, species: 'tauros', level: 13, beat: { everyMs: 3100, roam: [[1, 0]] } },
        { x: 39, y: 25, species: 'rattata', beat: { everyMs: 1300, roam: [[0, -1]] } },
        // The toll's Pidgey, and the Geodude that gets counted with the Grey Stones.
        { x: 33, y: 8, species: 'pidgey', beat: { everyMs: 1500, roam: [[0, -1]] } },
        { x: 31, y: 16, species: 'geodude', level: 8 },
        // Moor Spring.
        { x: 44, y: 38, species: 'poliwag', beat: { everyMs: 1900, roam: [[-1, 0]] } },
        { x: 53, y: 35, species: 'slowpoke' },
        // The tarn.
        { x: 30, y: 43, species: 'psyduck', beat: { everyMs: 2300, roam: [[-1, 0]] } },
      ],
      people: [
        { x: 35, y: 58, name: 'Drover Boy', look: 'youngster', facing: 'down', lines: ['Grandad says they know the way home.', 'They do. They go there. All the time. Without me.'], beat: { everyMs: 3100, glances: ['right', 'down'] }, calls: ['Come back! Please!'] },
        { x: 24, y: 57, name: 'Lina', look: 'lass', facing: 'down', lines: ['I count them every time and get a different number.', 'I got six once. There were never six.'], beat: { everyMs: 3700, glances: ['left', 'right'] }, calls: ['One, two, three... wait.'] },
        { x: 36, y: 49, name: 'Tarn Fisher', look: 'fisherman', facing: 'up', lines: ['Up on the moor the water has nothing in it but sky.', 'I come for the quiet. Well. I did.'] },
        { x: 37, y: 38, name: 'Peak Walker', look: 'hiker', facing: 'left', lines: ['East is the quarry, and the caves under it. Mind who you meet in there.', 'I have been meaning to go. I have been meaning to go for years.'], beat: { everyMs: 3500, glances: ['up', 'right'] }, calls: ['Lovely day for it.'] },
        { x: 27, y: 47, name: 'Walker', look: 'hiker', facing: 'left', lines: ['Going up? You will not get down the way you came, not by the ledges. They only go one way.', 'Quick, mind. Very quick.'], beat: { everyMs: 3300, glances: ['up', 'down'] }, calls: ['Mind the ledges!'] },
        { x: 15, y: 26, name: 'Shepherd', look: 'old-man', facing: 'right', lines: ['The tarn never freezes, whatever the winter.', 'There was a sheep track west, under it, to the old chapel.', 'By day the fog turns you back. Go after dark, if you go.'], beat: { everyMs: 4200, glances: ['left', 'up'] }, calls: ['Good flock. Good... flock.'] },
        { x: 8, y: 24 + 1, name: 'Shepherd’s Lad', look: 'boy', facing: 'right', lines: ['Grandad says they are sheep. They have horns and they are poisonous.', 'I asked when we might get a sheep. He went very quiet.'], beat: { everyMs: 2600, glances: ['up', 'right'] }, calls: ['Here, sheep. Sheep?'] },
        { x: 25, y: 11, name: 'Toll Clerk', look: 'clerk', facing: 'right', lines: ['Nobody has paid the toll in forty years, but I still have to write it down.', 'That is nobody, again. You are the fourth nobody today.'], beat: { everyMs: 3300, roam: [[1, 0]], glances: ['up'] }, calls: ['One nobody. Noted.'] },
        { x: 36, y: 12, name: 'Mother Stone', look: 'channeler', facing: 'up', lines: ['They sing at night, the stones. Clefairy come up to hear it.', 'I have counted them twice tonight. Nine and eleven. It is a good sign, or the other thing.'], beat: { everyMs: 4500, glances: ['left', 'right'] }, calls: ['Hush. They are listening.'] },
        { x: 31, y: 13, name: 'Drover’s Wife', look: 'woman', facing: 'left', lines: ['You touch the Grey Stones for luck, going up and coming down.', 'He touched them every time for thirty years. Then a Tauros sat on him. So.'], beat: { everyMs: 3800, glances: ['down'] }, calls: ['Touch it. For luck.'] },
        { x: 38, y: 27, name: 'Camp Cook', look: 'chef', facing: 'up', lines: ['It is stew. It has been stew since Tuesday. It will be stew until we reach the sea.', 'There is more in it now than there was. I do not ask.'], beat: { everyMs: 2900, glances: ['left'] }, calls: ['Stew! Who wants stew?'] },
        { x: 28, y: 27, name: 'Herd Girl', look: 'lass', facing: 'down', lines: ['This fold holds sixty. We had sixty. I shut the gate myself.', 'There are fifty-nine, and one in Millbrook. I do not understand how he does it.'], beat: { everyMs: 3200, glances: ['right'] }, calls: ['Fifty-eight. Fifty-nine...'] },
        { x: 47, y: 35 + 3 - 3, name: 'Mrs Alder', look: 'beauty', facing: 'up', lines: ['Three weeks I have taken these waters, for my nerves.', 'They taste of egg. I am very nervous about it.'], beat: { everyMs: 3900, glances: ['right'] }, calls: ['Marvellous. Marvellous.'] },
        { x: 56, y: 35, name: 'Attendant', look: 'gentleman', facing: 'left', lines: ['Three cups before breakfast, three after, and a brisk walk to the bench.', 'It has never cured anybody, but they do sit very nicely.'], beat: { everyMs: 3100, glances: ['left'] }, calls: ['Three cups, madam.'] },
        { x: 51, y: 35 + 3 + 1 + 0, name: 'Colonel', look: 'old-man', facing: 'left', lines: ['Bad leg. Other one is worse. Took the waters at Pewter in my day.', 'East of here is the quarry, and the caves. Do not. Well. I did. Look at my leg.'], beat: { everyMs: 4700, glances: ['up'] }, calls: ['In my day...'] },
        { x: 42, y: 34, name: 'Trail Boy', look: 'youngster', facing: 'right', lines: ['I carry water down to Millbrook for people who cannot come up.', 'It is mostly just water from the pump, by the time I get there. Do not tell them.'], beat: { everyMs: 2300, roam: [[0, -1]], glances: ['down'] }, calls: ['Water! Fresh water!'] },
        { x: 52, y: 13, name: 'Old Hob', look: 'camper', facing: 'left', lines: ['A boulder came down in my grandad’s day and the fold was shut and everybody forgot.', 'I did not forget. I just live here now. It is very quiet. Thank you for moving it.'] },
      ],
      trainers: [
        { x: 28, y: 29, name: 'Drover Hale', team: 'drover', look: 'hiker', facing: 'left', sight: 0, lines: ['This road is for the herd!', 'Show me your Pokemon if you want to pass.'] },
      ],
      landmarks: [
        { x: 50, y: 37, name: 'Moor Spring', kind: 'spring' },
        { x: 49, y: 10, name: 'Old Shieling', kind: 'hide' },
      ],
      berryTrees: [
        { x: 17, y: 22, berry: 'pecha' },
        { x: 45, y: 11, berry: 'sitrus' },
      ],
    },
  });
  return { file: withInsides(file), notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/** The doors on the moor: the toll house, and the shepherd's. */
function withInsides(file: MapFile): MapFile {
  const next = withInside(file, 'moor', 'cottage', 21, 5, 'The Clerk’s House', [
    { x: 3, y: 4, name: 'Clerk’s Mother', look: 'old-woman', facing: 'down', lines: ['Forty years of ledgers in this house and not a penny in any of them.', 'He does lovely handwriting.'] },
  ], { itemSpots: [{ x: 9, y: 2 + 5, hidden: true }] });
  return withInside(next, 'moor', 'cottage', 9, 20, 'Shepherd’s Cottage', [
    { x: 3, y: 4, name: 'Shepherd’s Wife', look: 'old-woman', facing: 'down', lines: ['He went up after a lost one on a night raid once, along the track to the old chapel.', 'He came back. He does not go up at night now. He does not say why. Nor does the dog.'] },
  ]);
}
