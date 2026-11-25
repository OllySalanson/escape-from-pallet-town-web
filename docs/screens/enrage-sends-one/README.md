# The enrage sends one hunter, the same walk off, wherever you stand

The critic's review, problem 14: "0:00 is an ambush if you have been walking and nothing at all if you stand still." At 0:00 only hunters within 40 tiles turned. Further off, nothing came, and the raid simply expired 15 seconds later.

Now every hunter already after you turns, and if none is, one is sent: the keeper of the district you stand in (beaten earlier or not), else the nearest. It comes from 80 steps off by walking, out of sight on the far side from the open exits, at twice your pace, knowing where you are. It reaches a player standing still in about 6 seconds, and one running straight away in about 12. The hunter chip counts it down from any distance.

- `before.png` - main, standing 6 tiles from WESTWARD ROAD, 3 seconds into the enrage: the red clock and nobody coming. Blue stayed on patrol 60 tiles off and the raid expired.
- `after.png` - the same tile and moment: `BLUE E 34`, coming from the east with the exit to the west. Blue was sent 74 steps off and had the standing player 5.9 s after 0:00.

Made with a stepped driver on `?testmode=pixels` at 800x512: `--insertion=greystone-vale --level=12`, walk to 7 tiles from WESTWARD ROAD (64,158) and stand until the raid ends.
