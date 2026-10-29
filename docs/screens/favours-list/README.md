# The favours list

The brief for the quest work asked that a favour's full detail be "reachable
somewhere quieter (for example the pack or a quest list) rather than on the
first screen". A favour is asked face to face, a box a line
(`../favours-face-to-face/`); this is where the rest of it is read, when the
player wants it.

O anywhere at base - the key the raid's field guide is on, because it is the
same question asked at home: what am I out for - opens every favour on one
screen over a harbour that stands still, and O or ESC puts it away. The yard's
hint line names `[O] FAVOURS` until it has been used once. It only reads:
nothing on it takes a favour on or hands one over.

It lists every favour that can be done from here, grouped by where it stands:

- **To hand over** - the thing is home: who to take it to, and where they are.
- **In hand** - where it lies, its squares, and below, what it pays and that it
  is lost with the pack.
- **Somebody wants a word** - who has a favour to ask and where to find them,
  marked with the "!" that stands over them in the harbour. What they want is
  never named here: they say it themselves.
- **Asked again after your next raid** - a favour answered NOT NOW.
- **Done** - and what it paid.

Shot at 3x (1200x768) against a test-mode build with the roster as shipped,
by `tools/playtest/favourList.mjs`, which fails on any beat that is not what it
promises.

- `1-new-save.png` - a new save: six people want a word, and where each is.
- `2-every-state.png` - a favour in every state, the cursor on one in hand and
  the whole of it in the pane below.
