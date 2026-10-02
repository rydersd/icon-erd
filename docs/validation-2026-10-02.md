# Publication and stroke rounding — 2026-10-02

- Public MIT application repository: https://github.com/rydersd/icon-erd, default branch `main`.
- Application source commit: `8802eef4735a12a3ae1dfe977f214fb06599ca9b`.
- Cloudflare Workers static-assets deployment: https://icon-erd.ryder-2b2.workers.dev/.
- Cloudflare version: `835d0bdc-5d19-40dc-9ad2-dedd302fa796`.

Positive library corner rounding now applies round stroke joins and end caps to the canvas, isolated-object display, previews, thumbnails, runtime SVG and baked SVG (also used for PNG output). It overrides per-path caps and runtime cap/join selections while enabled. Disabling rounding restores those choices; source nodes are not rewritten. The radius still controls path-corner geometry; standard round caps have radius half the stroke width.

## Verification

- A new export regression failed against the previous behavior, then passed after the fix.
- `npm test`: 15 tests passed.
- `npm run build`: static export completed.
- `npm run test:browser`: seven Chromium tests passed locally, including private-pack import and rounding enable/disable checks.
- The targeted rounding browser test passed against the live Cloudflare site. This is one hosted test, not a full hosted-suite result.
- All ten referenced live HTML/JS/CSS resources matched the tested local build byte for byte.
- Live `/imports/illtool-icons.json`, `/imports/equinix-icons.json` and `/.DS_Store` returned 404.
- GitHub reported the repository as PUBLIC, and remote `main` matched the source commit. No local artwork packs, generated builds, browser artifacts, environment files or Wrangler credentials were staged. A staged credential-signature scan found no matches.

Deployment currently uses authenticated `npm run deploy` from a checkout. Automatic deployments on GitHub pushes are not configured. The earlier validation report remains a historical record of the first deployment.

## Layer interaction update

Application source commit: `279b0f3a444300abe81da9dcbfaaa9e2bdf55153`. Cloudflare version: `890fa80e-415c-4deb-aef6-848d28a81e11`.

- Library thumbnails have right-click icon-type menus and group type/symmetry controls for single-group icons. Layers rows have group type/symmetry, paint and path-conversion menus; Shift+F10 opens them from the keyboard.
- Show is an icon palette, alongside zoom below the canvas. Menu/palette placement stays inside the viewport, with Escape, outside-click dismissal and focus restoration. Desktop and mobile screenshots were inspected.
- Desktop tree dragging supports sibling ordering, nesting, moves between layers and layer-header ordering. Descendant/self drops are rejected. Moves retain editable nodes and metadata, support undo and persist after reload. Moving into a group applies its existing transforms, symmetry and boolean effects; world position is not compensated across transformed parents.
- Selected objects can become editable cutters of their siblings. Multiple subject siblings are grouped into one artwork subject. Lone root objects need another sibling before they can act as cutters.
- Missing layer/object names receive readable persistent fallbacks. Existing names survive; original arrow components are named Shaft and Arrowhead.
- `npm test`: 19 passed. Static build passed. Local Chromium suite: 11 passed. Private import validation: all 962 imported icons parsed, resolved and round-tripped.
- Five targeted Chromium tests passed against the live site: rounding, group menus/cutter geometry, physical dragging/undo/reload, Show palette/mobile bounds and thumbnail menus. All ten referenced deployed HTML/JS/CSS files matched the local build byte for byte.
- A first menu test exposed dismissal caused by programmatic focus scrolling; changing dismissal to outside wheel input repaired it. The final full local suite and targeted hosted tests passed after that repair.

## Independent rounding, anchor tags, grid spacing and cutter toggles

This update supersedes the combined corner/end-cap rounding behavior recorded above.

- Separate Corner radius and End radius controls each have an enable switch. Older JSON without `endRounding` retains its prior combined behavior until settings are edited.
- Stroke tips use explicit filled geometry: small radii round the two outer tip corners, saturating at half the stroke width. Canvas, isolation, previews, runtime SVG, baked SVG and PNG share this geometry. Runtime stroke-width overrides scale the cap geometry proportionally.
- Source-anchor rows support click and keyboard selection, highlight the selected point and select a corresponding editable pen anchor when available. Round checkboxes opt individual source anchors in/out; tags survive undo, browser reload and JSON. Tags follow node transforms and symmetry. Set rounding applies after open strokes are joined, including isolated geometry.
- View grid spacing is independent of Snap and persists locally.
- Use as cutter is a checked toggle in the context menu, Layers toolbar and inspector. Toggle off restores normal geometry; when other cutters remain, their subtraction stays grouped separately.
- `npm test`: 23 passed. Static build passed. Local Chromium suite: 17 passed, including private-pack round trips, independent radii, actual SVG raster-pixel checks, anchor tags/selection/undo/reload, grid spacing and cutter toggling. Desktop/mobile and dark-theme screenshots were inspected.

Application source commit: `ee002d3`. Cloudflare version: `4c04abb3-d3bc-4508-b671-7656100a8193`. Six targeted hosted Chromium tests passed: grid spacing, joined/isolated rounding, source-anchor selection/tags, runtime/baked raster pixels, independent corner/end radii and cutter toggles. Live HTML and all nine linked Next.js assets matched the tested local build byte for byte.

## Import baselines, direct selection and persistent preferences

- Imported originals are persisted with saved glyphs and included in editable JSON archives. Add collisions rename both the working icon and its original; overwrite establishes the incoming original. Pasted JSON archives and downloaded archives retain the reset baseline. Imported icons start unedited, rather than counting every import as an edit.
- Reset icon uses the original and ordinary undo. Reset library preserves membership and restores known originals; an IndexedDB snapshot is written before mutation. Undo library reset survives reload and keeps icons added after the reset. Older saved imports without originals need their source reimported to establish a baseline.
- V selects objects/groups, A uses a hollow-arrow Direct Selection tool, and P activates Pen. Direct Selection converts primitives in place when point editing begins. Shift-click selects multiple anchors, including across paths; selected markers fill, group dragging/nudging affects selected points, and point deletion retains valid minimum path sizes.
- Circles identify rounded/smooth points, squares sharp points and diamonds disconnected handle geometry. Selection state is separate from marker shape.
- Keyboard shortcuts are remappable and reject duplicate bindings. Tool keys default to V/A/P; remaining command bindings preserve the app defaults. Mod represents Cmd/Ctrl. Shortcuts stay in browser preferences and are excluded from artwork archives.
- Alt-click any Snap slot to define a numeric spacing. Slots and active selection persist independently of View grid density.
- Local EDS naming preparation covers all 580 icons and checks their evaluated geometry. Recognizable arrow components have Head of Arrow and Shaft of Arrow names; other rules name clock hands, faces, magnifying-glass components and document parts. 340 icons still contain details flagged for visual semantic review in the ignored report. Their structural names are useful starting labels, not claimed as fully reviewed semantic identification. Artwork, naming output and review report remain under ignored imports/.

Verification: 26 unit tests passed; the full local Chromium suite passed 22 tests, followed by one new targeted cross-path multi-selection test. Static export passed. The named EDS pack passed browser import (584 total with starter arrows), original/reset, full archive export and reload checks. The source naming script independently checked evaluated outlines for every one of its 580 icons.

## ZIP libraries, appearance and primary groups

- Library imports now show a review card before mutation, with Replace matching icons unchecked. Cancel is verified to leave the library untouched. Legacy JSON stays supported; ZIP archives contain editable originals, SVGs and organization metadata.
- The export accordion controls group folders, a root folder, and SVG inclusion. Primary group and multiple usage tags are editable/searchable. Library sections follow those groups, retain collapse preferences, and expand search results. Name-based bulk suggestions are explicitly labeled, previewed and reversibly applied with a persistent metadata backup.
- Appearance is a sun/moon segment with a dropdown card containing sectioned colors/opacity, grid line scale, ruler tick weight, ruler label size and control corner radius. Light and dark overrides persist independently. A regression verifies defaults serialized as eight-digit hex retain their alpha.
- `npm test`: 29 passing. Full local Chromium suite: 25 passing. After the final alpha/focus repair, the three focused import/appearance/group tests pass.
- Actual owner Chrome library import was visibly verified at 584 glyphs and Saved with four artwork edits. Original browser backup: `~/Downloads/glyph-library-all-20261002-1839.json`, also retained under ignored `imports/backups/`.
- Usage-driven LLM analysis and direct Figma publishing are design proposals in `docs/icon-organization.md`, not shipped integrations. The ZIP organization manifest is the implemented foundation.
