# Polygon completion adversarial self-review

The reported failure concerns finishing Polygon lasso with double-click or Return.

Two physical browser regressions failed against the prior production build:

- Three committed corners plus a fourth cursor-preview corner: Return removed the preview but selected no enclosed object because completion used the triangle of committed corners.
- Two nearby clicks across an SVG path boundary: native `dblclick` did not fire because event targets differed, leaving the polygon active.

Completion now retains the cursor corner shown in the preview. Nearby successive pointerdowns finish independently of SVG target identity. The existing native double-click listener remains a fallback and is harmless after completion clears the draft. Gesture timing is scoped to the draft and discarded on completion/cancellation/tool change.

Attack cases include object and raw-anchor selection, ordinary native double-click, Return after a committed final corner, partial paths/groups, imported compound counters/transforms, Shift/Option combination and Escape cancellation. Full enclosure still applies to objects; individual source points remain the anchor contract. A fully enclosed Paper CompoundPath was also checked directly and accepted; this was not the completion defect.

Review is self-review, not independent approval. Browser tests use disposable profiles and synthetic/private local fixtures; owner artwork was not changed. Validation receipt is recorded in the PR and private wiki after checks finish. No GitHub CI is configured.
