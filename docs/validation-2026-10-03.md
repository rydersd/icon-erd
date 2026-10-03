# Library variants and output validation

Owner browser exported before changes: 584 icons, 584 reset originals, one shared component and library properties. Timestamped ZIP/current ZIP/JSON and manifest are retained in ignored `imports/eds/`. Current ZIP SHA-256: `f11266f685cc52699b0921530e70153929c38c6c700f964bb90c81e71dab703d`. Its checksum remained unchanged after the experiment.

Production static build passes. Unit suite: 64/64. Full local production browser suite: 79/79 (44.8s). New cases cover outer/inner boundaries, source immutability, holes despite high area overlap, one-time rounding/symmetry, unsupported line ends, stale geometry signatures, EDS naming/deduplication, per-group filters including zero results, family display, explicit approval, report attachment/Undo, library settings persistence and real menu bar/AppIcon PNG dimensions and catalog references. Existing private-library, selection, component, history, token and startup regressions pass.

The private source experiment reviewed 262 EDS pairs: 6 matched at ≥97% silhouette overlap with matching hole/component topology; 256 need review. Reset originals previously also matched 6. The ignored visual comparison sheet and experiment ZIP retain editable sources/reset originals/components; the experiment ZIP includes six matched generated solid SVGs. Source geometry was not changed in the owner browser.

Adversarial self-review: [review packet](reviews/2026-10-03-library-output.md). No independent reviewer or configured GitHub CI is claimed. Hosted validation and deployment identity are appended after shipping.
