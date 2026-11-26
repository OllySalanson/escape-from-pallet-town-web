# The harbour's lists are dimmed on the pad while a line waits to be read

While a line of dialogue, a YES/NO box, a knock, a line in the water or a
thing being looked at waits on an answer, the harbour opens none of its lists
(`BaseScene.updateWalking` returns before it reads them). The touch pad still
showed FAVOURS, THINGS, TEAM, DEX, MAP and SAY lit, and a finger pressed them
for nothing. They now stay in their places, dimmed, as the raid's PACK, TEAM
and MAP already were; LOOK is read before all of that and stays lit.

- `before-line-up.png` - main, "CHARMANDER is sniffing the sea air." up on
  the yard, every key lit.
- `after-line-up.png` - this change, "You received CHARMANDER from PROFESSOR
  OAK!" up in the lab: LOOK lit, the lists dimmed. Tapping THINGS there does
  nothing, and the keys light again the moment the line is read.

Made touch only on a test-mode build (`?testmode=pixels`) on the 412x915
phone of `tools/playtest/phone.mjs`.
