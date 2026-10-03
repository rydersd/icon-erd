# Startup and selected anchor list

The owner reported slow loading. Fresh hosted Chromium reached editor-ready at 601 ms (TTFB 282 ms), with no long tasks; the owner's visible browser library contained 584 icons. A separate disposable browser with the local EDS pack, five token edits and 584 icons reached ready at 460 ms on reload. This did not reproduce the owner's delay by icon count alone.

Source inspection identified an avoidable full `snapshots.getAll()` at the end of startup: the app read every checkpoint document and a second copy of edit history merely to determine whether an initial checkpoint existed. Reproduced with 584 icons, 40 whole-library checkpoints and Chromium CPU throttled 6×: hosted reload reached ready at 4,123 ms, including a 2,911 ms long task. The correction uses `getAllKeys()` for this existence check; checkpoint contents are still loaded when the user explicitly opens Library versions. No stored checkpoint/history is removed.

The corrected local production build, using the same fixture/count and CPU throttle, reached ready at 984 ms without the multi-second task. These before/after runs used hosted versus local asset delivery (TTFB 37 versus 4 ms), so they are diagnostic measurements, not a same-network benchmark or a measurement of the owner's saved database. The much smaller network difference does not account for the removed checkpoint-deserialization stall.

Read-only console inspection of the owner's tab also found canvas-wheel events accessing `S.glyph.guides` before the glyph existed. Canvas scrolling now returns during that startup interval; a delayed-storage browser regression exercises it.

When two or more anchors are selected, the right-hand source point table now lists only selected anchors. Single-point and cleared selections retain the full relevant point list. Canvas markers and rounding-tag initialization still use all source points, so hiding rows does not change artwork or silently disable rounding on hidden points.

Validation: production static build; unit suite; source-selection/browser regressions; checkpoint startup regression checks the absence of full snapshot scans while initial checkpoint creation and version listing remain available. Full-suite and hosted results are recorded on the PR. Review found no unresolved issue in the small correction diff; the owner's exact delay remains unconfirmed without profiling that saved database. Large chronological undo history still has to be loaded once, and opening Library versions still reads whole checkpoints.
