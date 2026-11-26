# Every build goes through BROCK'S WORKSHOP

The owner, 26 Nov 2026: "I just went to Brock and he asked me if I wanted to
build something, so I clicked yes and it said the radio mast is now in ... that
screen didn't come up."

**Before.** Talking to Brock from his mat, or walking up to a chalked bay, ended
in a YES / NOT NOW question in the dialogue box, and YES built the thing on the
spot (`BaseScene.brockQuotes` called `SaveManager.buildWorkshopUpgrade`
directly). The workshop screen approved on 25 Nov - the builds along the bottom,
what each does in a raid, BUILD IT - only opened from the plans on his wall, so
most players never saw it.

- `before-1-yes-in-the-box.png`: Brock's question in the box.
- `before-2-built-with-no-screen.png`: YES, and it is built.

**After.** Nothing is built from a dialogue box. Brock says what is next and then
his workshop screen opens with the cursor on that build; a chalked bay (keys or
mouse) opens the same screen on its own build; the plans on the wall open it too.
BUILD IT asks once more on the card, starting on NOT NOW.

- `after-1-brock-opens-his-workshop.png`: from the mat, after his line.
- `after-2-a-bay-opens-it-on-its-build.png`: facing the LOCKER I bay.
- `after-3-build-it-asks-on-the-card.png`: the question on the card. It used to
  say "Spend 4 Parts crates on it for good?" over three lines, which made the
  card taller than the row and halved the room picture above the moment it was
  asked; it is one line now, and the parts are on the card on the right and in
  the help bar.
- `after-4-built-on-the-screen.png`: built. A build that stands no longer says
  ALL HERE beside its parts.

Made by `node tools/playtest/workshopBill.mjs http://localhost:<port>/ <dir>
--port=<cdp port> --window=1280x800` against `npm run dev`, in this machine's
headless Chromium (the before pictures from `main` at d4842b8f).
