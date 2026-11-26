# A fight is loud

The critic's review, problem 13: "In raid 11 I trained in one patch of tall grass for 2:20, about thirty fights, and no hunter came: ... the training spot is also the hiding spot." Want: "grass that stops hiding you once you have fought in it."

Now any fight that is not with a hunter (wild, guard or trainer) is heard. The keeper of the district it was in, if it is going about its own business, runs over to the tile to look. For a minute the tall grass within 5 tiles of the fight hides nobody, so whoever is still standing in it is seen. The chip says who heard. Fight, then move.

- `before.png` - standing in the grass by the river south of Mill Square, a second after the moment a fight would end, with nothing heard (what every fight did on main): no chip, and Blue stayed on patrol 29-52 tiles off for 20 seconds.
- `after.png` - the same tile and moment after a fight is heard: `BLUE HEARD THAT`. Blue walked about 50 steps over and caught the player 11 s later ("Whatever you found, loser, it's mine!").

Made with a stepped driver on `?testmode=pixels` at 800x512: `--insertion=greystone-vale --level=12`, walk to the nearest tall grass, wait for the hunters to come out, then call the scene's own after-fight path (`HunterPack.heardFight` through `WorldScene.onPackEvent`). The battle round trip that calls it in play is `WorldScene.settlePackAfterFight`.
