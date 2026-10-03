# Area selection target adversarial self-review

The owner reported no selected anchors after finishing Polygon lasso from the standalone split control. The previous completion regressions first entered Direct Select, masking the actual interaction: the area tool inherited object scope from the solid arrow. This silently changed the meaning of the same tool icon.

Two physical anchor regressions now enter from the solid arrow. Both fail against the preceding production build with an empty selected-anchor array after Return or double-click. Area tools now default to anchors, with explicit Select anchors / Select objects radio choices in the existing dropdown. The explicit choice persists across reload and does not change when switching arrow tools. Hover/focus description and status report the current target.

Attack coverage: fresh default, both completion methods, imported contours and transforms, intentional whole-object selection, remembered target and switching both arrow tools. Direct Select's implicit empty-space marquee remains an anchor gesture. Object selection still requires full enclosure. Preference changes cancel an unfinished polygon rather than reinterpreting its existing vertices.

This is adversarial self-review, not independent approval. No owner artwork was modified and no GitHub CI is configured. Exact validation receipts are in the PR and private wiki.
