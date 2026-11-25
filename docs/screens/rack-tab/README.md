# Tab crosses the rack to the pack

The navigation audit (25 Nov 2026) found that on THE ARMOURY RACK the PACK side -
its squares, TIDY and the packs to wear - could only be reached by pressing Down
through every supply row to DONE and then Up: about 47 presses on a full base.
Left and Right change a row's number there, so they could not cross
(`before-rack.png`).

Now Tab hops between the areas of any screen and never leaves the panel: on the
rack, from the supplies to the pack, to the X in the panel's header, and round
to the supply row it left. Shift+Tab goes the other way. (When this was first
made the rack also had a DONE button on its bar and a HALL button in its header;
both have since gone, and only the X closes it.)
`after-tab-to-pack.png` is one Tab from the supplies: the cursor is on the first
piece in the pack, and the help line says the pack's own keys.

## How it was made

`node tools/playtest/rackTab.mjs <test-mode build url> <dir>` against a
`VITE_EPTW_TEST_MODE=pixels` build of this branch at 1200x768. It opens the rack on
a save with a long stash and checks each Tab and Shift+Tab with real key events.
