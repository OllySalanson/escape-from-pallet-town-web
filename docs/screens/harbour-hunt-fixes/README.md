# The harbour bug hunt's fixes (10 Nov 2026)

Two findings of the harbour bug hunt, before and after.

- `bot-check-before.png`, `bot-check-after.png`: a player with a name but no session walks into THE HARBOUR. Before, the bot check came up over the yard a moment in and held every key, so the player could not walk for up to two minutes; after, the harbour only watches until the player sends something, and they walk on. Both are the last picture of `tools/playtest/botCheck.mjs` (step 6), against the dev server at 1280x800 with the Supabase project and Turnstile both stood in for. The before picture was taken with `main`'s `src/game/harbour/harbour.ts` put back for one run.
- `prize-window-before.png`, `prize-window-after.png`: THE PRIZE WINDOW open with 700 tickets while another tab spends 600 of them. Before, it kept showing 700 and refused every prize with "The window could not take that"; after, the press catches the window up to the 100 the save holds and says why: "500 more tickets." The before picture is the bug hunt's own (800x512); the after was taken against a test-mode build at 1200x768, the other tab's purchase written into storage behind the window.
