# A heal moves the HP bar

THE BATTLE ARENA's rentals, with KADABRA (which knows RECOVER) leading against BULBALUV's PSYDUCK.

- `before.png`: main at c1c14088. Kadabra RECOVERed twice and the engine had it at 64/64, but the plate still showed 9/64 in red. The next hit took the bar to 0 while it fought on.
- `after.png`: this change. On "Your KADABRA regained health!" the bar walks back up to 60/64, which is the engine's HP.

Made with the playtest harness on a test-mode build at 800x512. The plate's HP and the engine's were read side by side (`describeForTest().yours.hp` against `state.player.currentHp`) at each command, then the screenshot was taken.
