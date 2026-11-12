# A visit lasts until you leave

Knocked in and let in, a visitor used to have ten minutes - the database let a
yes stand that long and no longer, and the library book said so. Now a visit
lasts until the visitor walks out or the owner sees them out, and it also ends
when the owner leaves the harbour. However it ends, the visitor is told why
and walked to their own step.

Before, there was no way for an owner to see a visitor out, and nothing a
visitor was told when the time ran out: these three screens are all new.

| Picture | What it shows |
| --- | --- |
| `see-them-out.png` | OLLY at home, facing AMY: *AMY is visiting. See them out?* The cursor starts on NOT NOW, so the key that asked never shows anybody out. Facing her, the hint line says `[SPACE] AMY`. |
| `seen-out.png` | AMY, once OLLY chose SEE THEM OUT: *OLLY sees you to the door. Time to head home.* Read, and she is on her own step. |
| `owner-left.png` | AMY, let in again, after OLLY closed his tab: *OLLY has left the harbour, so you let yourself out.* |

Taken by `node tools/playtest/knocking.mjs <url> docs/screens/visit-until-you-leave`
against `npm run dev`, two tabs of one browser over the local stand-in
(`?harbour=local`), so no knock reaches the live project. The script plays the
whole knock as before and then these three endings; the other pictures it takes
are the knocking screens already in `docs/screens/knocking/`.
