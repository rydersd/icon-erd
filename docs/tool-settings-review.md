# Tool settings and folding panes adversarial self-review

Cleanup used a fixed 0.03-unit global outline-fit budget. The quick-access Contextual Tool Settings panel now exposes a number input and presets, passing the chosen value into the existing corner reconstruction and simplification evaluator. The budget remains drawing-plane units on the 24-unit canvas; changing it does not edit artwork until Cleanup is run. Selected-anchor cleanup remains one Undo action.

Merge distance uses screen pixels, preserving the previous eight-pixel default. Preview, drag release and Pen placement all consume the same configured distance. Anchor hit targets, hover detection and polygon closure retain their separate hit tolerances.

Shapes moved beside the canvas tools; More forms is a disclosure. Every right-side section is a native details disclosure with remembered state, as is Contextual Tool Settings. This retains mounted export, preview and point-list slots while folding them. Summary activation saves synchronously before an immediate reload, and native toggle confirms the final state.

Attack cases: a shallow bend that remains at 0.03 but simplifies at 0.1, Undo restoring the original, preference persistence, narrow/wide merge thresholds agreeing between highlight and release, all five right panels folding across reload, keyboard re-opening Measurements, viewport containment and mobile pane switching.

This is adversarial self-review, not independent approval. Owner artwork was not mutated. An unrelated existing change to scripts/collect-illmater-icons.mjs remains uncommitted and excluded. Validation and shipment receipts follow in the PR/private wiki.

A read-only experiment on disposable copies of the ignored phone-outline source retained 30 / 23 / 18 of 40 anchors at tolerances 0.03 / 0.1 / 0.25. Those counts do not prove that any particular owner-edited contour is equivalent. Dense reconstruction remains synchronous and can take several seconds; this change exposes its budget, not a background-worker implementation.

## Unbounded cleanup tolerance follow-up

Owner requested no upper cap. Removed it from the number input, setter and saved-preference restoration; finite values at least 0.001 remain valid. Added 1 and 5 presets. A physical regression sets 10, runs cleanup, checks the reported fit budget and resulting geometry, restores geometry through Undo, reloads the saved tolerance, and rejects a negative value. It failed against the preceding production build. Merge distance retains its independent interaction range. This remains adversarial self-review.

Primary toolbar follow-up: shapes now share the selection-tool row; Handles is aligned to its far right. Narrow rows scroll horizontally instead of adding a shape row or pushing the canvas away. More forms uses a positioned disclosure, closes after shape creation/outside click/Escape, and retains keyboard access. Physical coverage checks row alignment, right-edge placement, shape insertion and narrow-screen containment.
