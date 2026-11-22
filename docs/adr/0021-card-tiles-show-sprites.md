# Card tiles show sprites at every Card size, not artwork

With Card sizes (CONTEXT.md, "Card size"), a large tile is ~157px at a 390px pane, and a 96px sprite looks small in it. Official artwork (475×475) would fill it. It was benchmarked before deciding (2026-11-22, `pokedex-test-vault`, 390px Card view, the 81 rows with both images cached; "4×" is CPU throttling over CDP `Emulation.setCPUThrottlingRate`, a phone stand-in, not a phone):

| | Sprite (96×96) | Artwork (475×475) |
|---|---|---|
| File size, median | 0.8 KB | 124 KB |
| All 1,082 rows on disk (projected) | ~1 MB | ~130 MB |
| Decode per image, 1× / 4× | 1.0 / 1.8 ms | 2.5 / 3.7 ms |
| Alpha bounding box (`contentBounds`' work) per image, 1× / 4× | 0.8 / 0.9 ms | 2.2 / 9.8 ms |
| Memory for 150 decoded tiles (renderer + GPU process, 3 runs) | ≈ 0 (GC noise, −104 to +11 MB) | +106 to +175 MB |
| 40-step fling at 250px a frame, 4×: median / p90 frame (3 runs) | 23–24 / 28–32 ms | 33–36 / 38–43 ms |

Method: each tile got its own blob URL (so each decodes separately, as 1,082 different artworks would), cycling the 81 cached files; memory from `app.getAppMetrics()` before and after mounting 150 decoded images; scroll frames from `requestAnimationFrame` gaps, with a `MutationObserver` swapping every newly drawn tile's sprite for artwork.

**Decision:** the tile image is the sprite at every Card size. A large tile zooms it 2× (whole pixels stay crisp; `CARD_SIZE_SPECS`). The page stays consistent: no size mixes sprites and artwork.

**Why not artwork:** memory, mainly. Each artwork decodes to ~0.9 MB (475² × 4 bytes) whatever size it is drawn at. Also, the repository's `ImageMemory` budget (`IMAGE_MEMORY_BUDGET_BYTES`, 16 MB) is sized for detail screens: a Card window's worth of artwork bytes (~150 × 124 KB ≈ 18 MB) exceeds it, so tiles would evict the detail screen's images and could revoke a URL a tile still shows. And a user who never cached a generation offline would download ~124 KB per tile while scrolling.

**If artwork is tried later:** a Settings option for the whole page, never per size. It needs its own image memory for tiles (revoked as a tile leaves the Card window), not the shared budget. Artwork looks centred on its canvas, so it may skip the alpha bounding box, the step that grows most under throttling (unverified). Not measured: blank tiles while artwork decodes during a fast fling, and a real iPhone.
