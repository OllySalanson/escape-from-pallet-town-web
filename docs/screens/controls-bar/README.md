# The controls bar

The game's keys as buttons in the page beside the game (the captain, 25 Nov 2026:
"I really like the six key tiles ... let's do the team front and center, and then that
gives us space to add the settings in as well"). `ui/controlsBar.ts`; where it stands is
`display/controlsBarLayout.ts`; HELP and SETTINGS are `scenes/ControlsScene.ts`.

- `before-yard-1280x800.png` - the harbour with nothing under it.
- `yard-1280x800.png` - under the game: the yard's keys either side of the team (P), SETTINGS and HELP.
- `help-1280x800.png` - HELP: every key, a card for each place it works.
- `raid-1280x800.png` - on a raid: OAK, LOOK, the party, PACK and MAP, the last two dimmed while Oak talks (they do nothing then).
- `yard-beside-1920x960.png`, `settings-beside-1920x960.png` - a window with no height to spare stands the bar in a column beside the game; it never costs the game a zoom step.

Made against a test-mode build with throwaway drivers built on `tools/playtest/browser.mjs`
and `deploy.mjs` (open the harbour, take Squirtle, photograph; deploy and photograph the raid).
- `under-a-menu-1280x800.png` - under a screen with no keys of its own (THE HARBOUR BOUTIQUE): no harbour keys, the team unpressed, SETTINGS and HELP (`menuOverTheGame`).
