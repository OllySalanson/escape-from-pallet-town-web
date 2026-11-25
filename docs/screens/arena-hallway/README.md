# THE RAID ARENA's tunnel in, and its great doors

The captain, 25 Nov 2026: "The brickwork that goes around the bench, the rack and the locker doesn't fit with the background of the raid arena. So instead of going straight into the raid arena oval, there's a pathway, a hallway, leading up to it. At the end of the hallway are the bench, rack and locker, much better spaced out, and where the hallway would have continued there's a big door you push open to enter the raid arena."

What changed:

- The old room inside the door (pale flags under a blue wall, cut into the oval's south end) is gone. The door now opens into a tunnel under the south stands, painted in the hall's own stone: dark wall tops lipped like the oval's wall, the face of the oval's north wall for the wall at the end, torchlit flags for the floor, and two torch pillars at its mouth.
- The corridor runs up from the mat to a room at its end. The bench, the armoury rack and the locker stand along that room's back wall with a standing torch between each, their name plates hung from a brass rail.
- In the middle of that wall stand the great doors: oak leaves bound in iron under a stone arch, the Arena's ball split across them and again on a red shield over them, with a crack of the hall's light between and under them. Walking into them or pressing SPACE at them pushes them. They swing back on a heavy creak, the hall's light fans out across the tunnel's floor, and as they come to rest the crowd greets whoever comes through as much as their record has filled the stands: hands for a newcomer, a cheer, then a roar. The held key that pushed them walks on through, under the wall, and up the runner to the rail.
- They stay open until the player walks out by the mat, so a raid, a bout or a panel coming back finds them open.

Pictures (1200x768 unless named phone, which is 412x915 portrait):

- `before-from-the-door.png`: main before this change, the first screen inside the door.
- `after-from-the-door.png`: the first screen now, from the mat: the corridor, the room at its end and the doors shut.
- `after-doors-swinging.png`: the doors a moment into the push.
- `after-doors-open.png`: open, with the hall's light through them.
- `after-through-the-doors.png`: walking through, under the wall.
- `after-from-the-oval.png`: inside the oval, the runner leading back to the doors.
- `after-room-at-the-tunnels-end.png`: back at the bench after its panel, the doors still open.
- `phone-from-the-door.png`, `phone-doors-open.png`: the same two at phone size.

Made with `node tools/playtest/arenaDoors.mjs <url> <out> [--window=412x915]` against a test-mode build (`tools/playtest/README.md`, 'Memory'); the before is `tools/playtest/arenaFlow.mjs --shots` on main's build. `node tools/playtest/arenaHall.mjs` plays the whole flow through the doors to a raid and home again.
