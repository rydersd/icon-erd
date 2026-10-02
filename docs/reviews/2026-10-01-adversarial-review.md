# Adversarial review — modularization and public application

Review performed after the first data/CSS/core extraction began, before the Next.js conversion. This is a self-review, not an independent reviewer verdict. The original draft is preserved outside this repository.

## Findings

### High — compound-path conversion loses geometry

Executed `toPen` on `M1 1L3 1L3 3ZM10 10L12 10L12 12Z`: `shapeItems` reports two paths before conversion and one afterward. The draft takes only `items[0]`. Conversion must preserve every subpath and its winding, bake deformers once, retain transforms, and direct point insertion into the hit subpath. Validate holes and transformed curves, not merely point counts.

### High — radial symmetry is limited to 1/2/4

Executed `symmetryMatrices({rotate:6})`; it returns one matrix. Toolbar expansion alone would advertise a feature the evaluator does not implement. Replace generator closure with a bounded, numerically stable group construction; test arbitrary 3/6/12/32 copies, combined reflections, group scope, and exported geometry.

### High — public packaging can accidentally include private artwork

The draft bundles 623 glyphs, including 580 with design-system metadata and 42 editor UI glyphs. Extract source data losslessly into ignored local import files; build from four original arrows and independently licensed Font Awesome controls. Verify output contents and metadata round trips. An MIT application license does not relicense extracted artwork.

### Medium — import collisions and incomplete validation

The draft overwrites names automatically and skips invalid items. Add and overwrite must be explicit, share one pipeline for pasted/file imports, reserve incoming names before suffixing, and validate the entire batch before mutation. Metadata and custom symmetry must survive export/import.

### Medium — duplicate-path detection must include Bezier handles

The draft's open-path deduplication keys only anchor positions. Two curves with identical endpoints but different handles are different paths. Compare complete curve geometry, allow reverse direction, and distinguish coincident segments from intentional boolean area intersections.

### Medium — a React wrapper needs a lifecycle contract

Moving an imperative canvas editor into Next.js without teardown can duplicate pointer/key handlers, observers, autosaves, and Paper projects under Strict Mode or remounting. Put the editor behind a scoped mount/dispose API and test remounts and development initialization. Keep browser-only Paper.js out of server execution. Use static export because current features require no server state.

## Decision

Proceed only with regression coverage for these boundaries. Do not claim the site or imports are validated from a successful build alone. Keep unresolved project icon sources explicit; do not substitute guessed artwork for real icon sets.

## Implementation follow-up

The listed data, geometry, collision and lifecycle boundaries were repaired. The final conversion additionally preserves a compound hole when the same source SVG contains an open stroke, with point insertion descending into the hit contour. Fourteen unit tests and six production-local browser tests passed. See [validation evidence and remaining limits](../validation-2026-10-01.md), including the unsuccessful hosted headless run and the regular-Chrome smoke check.
