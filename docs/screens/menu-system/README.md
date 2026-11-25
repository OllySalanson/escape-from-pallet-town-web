# The menu system: one window, FireRed's

The captain, 25 Nov 2026, on every menu and pop-up: "shite colours, shite
design". This folder is the record of the redraw, one pull request at a time.

## 1. The pop-ups over the world

The dialogue box, every question asked in it (a favour, a knock at the door,
a trainer's challenge, a lift, a boat) and the phrase list. They were a dark
navy box with a cream line, white words, slate answers and a typed arrow,
under GBA art and beside cream windows everywhere else. Now they are one
window: cream paper (`UI.paper`) in a blue-rimmed frame (`drawFramedWindow`),
ink words and a drawn red cursor, the palette named by role in
`src/game/ui/uiPalette.ts`.

A question asks FireRed's way: the answers stand in a window of their own on
the right end of the question's box, one under another. They used to sit on
the box's last line, so a question that wrapped had YES printed over it.
And the harbour's box is the raid's width: at 232 it held 38 letters a row, so
Nurse Joy's hello was cut mid-sentence over ten presses.

| | Before | After |
|---|---|---|
| A favour | ![](before-favour-question.png) | ![](after-favour-question.png) |
| Somebody at the door | ![](before-knock-at-door.png) | ![](after-knock-at-door.png) |
| Dialogue | ![](before-dialogue.png) | ![](after-dialogue.png) |
| The phrase list | ![](before-phrases.png) | ![](after-phrases.png) |

In a raid, and at phone size (the whole game at the phone's own pixels):

![](after-raid-question.png) ![](after-knock-at-door-phone.png)

Made by `tools/playtest/popupShots.mjs <test-mode build url> <dir> --window=1280x800 --raid`
against a test-mode build (`tools/playtest/README.md`, 'Memory'). Judged by two
rounds of a fresh critic who did not write the change; what was taken and what
was not is in the pull request.

## 2. Every menu screen, in the same colours

The DOM screens - Bill's PC, the shops, the workshop, the bench, the raid's
pack and party, YOUR TEAM, the name screen and the rest - were olive-cream on
navy scan-line stripes under near-black bars, with a mint accent no Kanto screen
uses. Now they wear the pop-ups' palette (the Pixel UI tokens are
`uiPalette.ts`'s, and `uiPalette.test.ts` holds them so): the same paper and ink,
navy title and help bars, panel headings in the rim's blue, a checker of two
blues behind, a red cursor, a green confirm button - and each whole screen in
the pop-ups' blue-rimmed frame, painted over its own edge so a full column
stays full.

| | Before | After |
|---|---|---|
| Bill's PC | ![](before-stash.png) | ![](after-stash.png) |
| Bill's cottage | ![](before-bill.png) | ![](after-bill.png) |
| Brock's Workshop | ![](before-workshop.png) | ![](after-workshop.png) |
| The bench, beside the hall | ![](before-lobby.png) | ![](after-lobby.png) |
| YOUR TEAM, beside the yard | ![](before-your-team.png) | ![](after-your-team.png) |
| Your name | ![](before-name-screen.png) | ![](after-name-screen.png) |

Made by `tools/playtest/menuShots.mjs <build url> <dir> --window=1280x800 --raid`
and `popupShots.mjs`. How the screens sit in a big window is the next step.

## 3. A menu stands in the game's own box

The captain: menus "look stretched full screen on a big screen while the game
itself sits in a smaller window". They were laid out against the whole window
(up to 1120 game pixels across, at 2x-4x); now a menu stands in exactly the
canvas's box, drawn as fine as keeps the room it was laid out for
(`menuScaleFor` in `display/menuStage.ts`): 1280x800 the world 3x and the menu
2x, 1920x1080 4x and 2x, 2560x1440 6x and 3x. A touch screen keeps the pad's
layout.

| 2560x1440 | Before: across the glass | After: in the game's box |
|---|---|---|
| Bill's PC | ![](before-in-frame-stash-2560x1440.png) | ![](after-in-frame-stash-2560x1440.png) |

The bench at 2560x1440 and Bill's PC at 1920x1080:

![](after-in-frame-bench-2560x1440.png) ![](after-in-frame-stash-1920x1080.png)

## 4. YOUR THINGS's pockets are tabs

The captain could not tell why the top row of storage said "Medicine": the
pocket's name stood alone beside a row of grey icons. The pockets are tabs
now - the one the cursor is in raised, in paper, marked red along its top and
joined to the list under it, the others sunk - and the name says how many kinds
the pocket holds (`pocketStrip` in `ui/thingsView.ts`).

| Before | After |
|---|---|
| ![](before-things-pockets.png) | ![](after-things-pockets.png) |

## 5. The raid's prize chip is a picture of the find

The captain: "the big yellow square saying two parts crates". The chip that
names a find seen and not yet picked up was a slab of mustard with the find
spelled out in it. It is the HUD's cream now, like every chip beside it, with
the find's own icon, a gold edge down its left to keep it marked as an offer,
and NO ROOM in red on a line of its own (`RaidHud.placePrize`).

| Before | After |
|---|---|
| ![](before-prize-chip.png) | ![](after-prize-chip.png) |

## 6. A fight is the same game

The battle was the one screen still in the old flat cream boxes with a black
typed cursor. Its panel and HP plates are the pop-ups' framed window now, the
cursor and the prompt to read on are the pop-ups' red, the field's bezel is the
frame's navy, and the move rows and the two guidance lines stand inside the
deeper frame.

| | Before | After |
|---|---|---|
| Commands | ![](before-battle.png) | ![](after-battle.png) |
| Moves | ![](before-battle-moves.png) | ![](after-battle-moves.png) |

## 7. The title's buttons and the yard's door captions

The title's choices were cream with a mint one under the cursor and a khaki one
for CONTINUE with no game - two colours no other window used. They are the
pop-ups' framed window now: lit paper under the red cursor, sunk paper and soft
ink for a choice that would do nothing. And a door's caption on the yard was a
brown box with a gold line, the one window of another game beside the cream
questions it stands over; it is paper and the navy line.

| | Before | After |
|---|---|---|
| The title | ![](before-title.png) | ![](after-title.png) |
| A door's caption under a question | ![](before-door-caption.png) | ![](after-door-caption.png) |

## 8. Good news in green

A free treatment at the Center said FREE in red under the Pokémon, which read
as a fault; it is green now, and a priced one stays red. Oak's waiting reward on
the Pokédex was mustard and is green too. And what a party slot's Pokémon holds
sits on its icon's own corner, as FireRed's held-item mark does, rather than
two pixels into the level beside it.

| Before | After |
|---|---|
| ![](before-free-treatment.png) | ![](after-free-treatment.png) |

## 9. No screen is one small thing on an empty page

The knock screen held a list of a few doors - or one sentence, when nobody else
has a house yet - over a whole screen of checker; it is a side panel beside the
yard now, as the favours are. The name screen was one small window alone in a
screen of checker; the game it is asked over shows through behind it, dimmed,
as the yard does round a question.

| | Before | After |
|---|---|---|
| Knock on a door | ![](before-knock-panel.png) | ![](after-knock-panel.png) |
| Your name | ![](before-name-popup.png) | ![](after-name-popup.png) |

## 10. The jump-in card reads as a briefing, and a warning is red

The card at the rim was a wall of grey: its labels the soft ink of a note, and
its warning grey too - every warning set small was, because `.pixel-ui small`'s
soft ink outweighed `.px-warning`'s red. Warnings are red again everywhere, and
the card's labels are the headings' blue capitals, each row ruled off from the
next.

| Before | After |
|---|---|
| ![](before-rim.png) | ![](after-rim.png) |

## 11. The raid's chips are the menus' paper

The clock, the objective, the place and the prize were the older cream under a
near-black line - a third frame beside the dialogue's and the panels'. They are
the menus' paper and navy line now (`RaidHud.ts`), so the corner chips and the
question under them are one set.

| Before | After |
|---|---|
| ![](before-hud-chips.png) | ![](after-hud-chips.png) |

## 12. Two loose ends from the second sweep

Your HP plate's numbers ended on the plate's deeper frame since the battle
joined the family; they stand four pixels higher, clear of it. And YOUR TEAM
said 1 OF 6 twice, in its title bar and its first panel's heading; the heading
keeps it.

| Before | After |
|---|---|
| ![](before-hp-numbers.png) | ![](after-hp-numbers.png) |

## 13. Where, then what

A title bar's place and the screen's name stood a gap apart, so THE DOCKS THE
HARBOUR BOUTIQUE read as one name. A drawn chevron in the rim's blue stands
between them now (`.px-place::after`).

| Before | After |
|---|---|
| ![](before-breadcrumb.png) | ![](after-breadcrumb.png) |

## 14. A price is the things themselves

A boutique card's price was said in words, three centred lines of them
("₽400 and 10 Linen rolls, 6 Mooring ropes and 4 Radio valves"). It is the
money, then each material's icon and count, as the workshop's cards show
theirs; the words stay on the help bar and for a reader (`priceChips` in
`look/boutiqueView.ts`).

| Before | After |
|---|---|
| ![](before-boutique-prices.png) | ![](after-boutique-prices.png) |

## 15. A name is in capitals on every shelf

The rack and the locker set an item's name in mixed case (Potion, Super
Potion) where every other list sets it in capitals; they take the names' own
class now.

| Before | After |
|---|---|
| ![](before-rack-names.png) | ![](after-rack-names.png) |

## 16. The battle's type banners are tabs

WILD NORMAL and YOURS GRASS/POISON floated over the sky as outlined white
letters, a style nothing else used. Each is a tab of the frame's navy on its
plate's top edge now, as a panel's heading is a strip over its window.

| Before | After |
|---|---|
| ![](before-type-tabs.png) | ![](after-type-tabs.png) |
