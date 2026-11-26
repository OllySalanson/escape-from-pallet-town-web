# The last stand waits for a line still up

The night raid critic (26 Nov 2026) left Oak's "One minute left!" box open and stood still. At 0:15 nobody came and the raid ended on the timer screen: `makeLastStand` refused while a box was up, and the clock ended the raid instead.

Now a line still up, a beat or a fight on its way is finished first. The raid is held at 0:00, and the moment the box is read the enraged hunter's fight starts.

- `before.png` - main: Oak's box left open through 0:15, "THE CLOCK RAN OUT. Every exit shut with you still inside."
- `after.png` - with the change: the box dismissed at 0:00 and BLUE's last-stand lines start ("Time's up, loser!").

Made with `tools/playtest/ai-player/act` on a test-mode build (400x256, `?testmode=1`): a new save's first raid, standing on the landing, Oak's one-minute box left open, then one SPACE after the enrage's fifteen seconds.
