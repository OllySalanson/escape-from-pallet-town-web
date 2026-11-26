# M is only ever the raid's map

The captain, 26 Nov 2026: "I've just pressed M for map, but it's brought up the
map of the harbour. We don't want the map of the harbour, we just want the map
of the raid." So M in the harbour (yard or room) opens the map the next raid
lands on, as it does in a raid, and the harbour map M reached is gone.

Taken on 26 Nov 2026 by `tools/playtest/mapScreen.mjs` against a test-mode build
at `PIXEL_WINDOW` (1200x768): a new save's first raid, then home, a short walk
round the yard, and M. A new save has walked none of the vale yet, so it is fog.

| | |
|---|---|
| `before-harbour-m.png` | `main` before this: M at home opened THE HARBOUR (from `docs/screens/harbour-map/`) |
| `after-harbour.png` | the walk in the yard |
| `after-harbour-m.png` | M: GREYSTONE VALE, the raid's map, with nobody on it |

    node tools/playtest/mapScreen.mjs "http://localhost:$PORT/escape-from-pallet-town-web/" out
