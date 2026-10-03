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

Publication for the ZIP/appearance/group build: source `d9682b8`, Cloudflare version `fb9c29b9-e56a-44a3-8a68-8b7680b685a5`. Eight focused hosted Chromium tests pass. Live HTML and nine linked assets matched the local tested build byte for byte. The owner Chrome library was then grouped through the preview/apply UI into 13 name-based categories (including 321 Other icons); group preferences were collapsed with Arrows left expanded. The saved state now counts 584 edited icons because category metadata changed; this does not mean 584 artwork edits. The grouping snapshot preserves undo, and the original four artwork edits remain intact. Local proof screenshot: `artifacts/owner-grouped-library.jpg` (ignored).

## Library deletion and drawing-plane group review

- Multi-icon selection supports tile toggles, Cmd/Ctrl-click, Shift ranges and Select shown. Deletion and its trash snapshot are stored atomically across edits/snapshots stores. Tombstones prevent shipped icons returning on reload; restore keeps original baselines and renames collisions to protect newer imports. An empty library stays empty. Library Delete is distinct from canvas object Delete.
- Group review arrows sit after each count and take over the drawing plane. Reconstruction reports attach metadata/candidates only, check source geometry, and visibly flag unresolved icons. Use centerlines is an explicit edit; original baselines and normal icon Undo remain available.
- 29 unit tests and 29 full local Chromium tests pass. The new cases cover durable range deletion, restoration, empty libraries, matching-name imports, canvas/library keyboard scoping and reconstruction review/apply/undo.
- Owner browser export filtered against the EDS source names produced git-ignored `eds-icons-current.zip`: 580 current icons, 580 reset originals, 580 SVGs and an organization manifest. Starter arrows are excluded.
- Correction to the earlier conversational claim: the EDS pack already contains 164 entirely stroked icons, 37 mixed stroke/fill icons and 379 entirely filled icons. Its reconstruction pass preserves the existing centerlines. Of the 416 unresolved icons, 403 have inspectable approximation candidates; none met the combined high/low-resolution image, width-consistency and topology gates. These are review candidates, never automatically accepted replacements.
- Geometry and report candidates were independently parsed/resolved for every entry. Raster comparisons use sharp/libRSVG at 384px plus a 96px comparison, separate from skeleton thinning and path fitting. The private report and artwork are not published.

EDS collision correction: four EDS arrow names collide with starter arrows and are imported with `-2` suffixes. Reconstruction attachment is now bound to EDS source metadata and resolves these renamed copies; starter glyphs are excluded. A targeted browser regression verifies this distinction, alongside the review/apply/undo recheck. `scripts/prepare-eds-handoff.mjs` filters exported libraries by EDS metadata rather than source-name membership. The first name-only ZIP selection was superseded because its count alone could not prove the correct icons were included.

Final handoff and deployment: application source `e64a40f`, Cloudflare version `105cc7a6-5094-45d5-a914-6750ad689cc5`. Five hosted deletion/review/collision checks pass; live HTML and nine referenced assets match the tested local build byte for byte. The final owner-browser report attachment visibly showed 580 EDS results with no changed-source exceptions. The superseding ZIP uses EDS metadata, includes all four renamed EDS arrows, and contains 580 icons, 580 originals, 580 SVGs, 164 existing-centerline statuses and 416 review flags. Its size is 1,791,575 bytes and SHA-256 is `99533d582db95f4f499ae133853776467d11cc317dbad81cfb2d453f4be0374e`. The exact ZIP was successfully imported into a disposable hosted-browser session: 584 total with the four starter arrows, 580 EDS icons, 416 highlighted flags and zero starter flags. The owner app's Navigation/Arrows review visibly took over the drawing plane; local screenshot `artifacts/owner-eds-group-review.jpg` is ignored. No private artwork/archive was committed or deployed.

## Shared forms application logic

- Added reusable form identities to editable nodes, translated geometry matching, explicit near-match review, instance detach, and commit publication across icons.
- Shared boundaries use a customizable purple long-dashed outline. Candidate previews highlight the proposed shared geometry.
- Object movement/root transforms, names, visibility, cutter edges and layer paint remain instance-local. Child geometry edits inside shared groups propagate.
- Undo/redo snapshots every affected peer; the synchronous component journal supplements IndexedDB autosave. Imports remap component IDs together to avoid accidentally binding unrelated libraries.
- EDS browser regression detects one cloud silhouette across nine icons as a near match; an actual anchor inspector edit updates all nine and Undo restores their geometry. Private artwork is absent from public source/build.
- Verified: 33 unit tests, 33 local production-browser tests, static build, and diff whitespace checks pass. Local screenshots: `artifacts/shared-cloud-review.png` and `artifacts/shared-cloud-linked.png` (ignored).
- Deliberate boundary: compatible tree/path structure matching with translation normalization, not semantic image similarity. Near matches require adopting a shared source; symmetry/deformer-bearing candidates are excluded from detection. Component-bearing trees cannot be nested by import or tree dragging.

### Hosted shared-form verification

- Published source commit `cc88131`; Cloudflare version `704bfc91-5336-442d-86be-05f40f3bc8cf`.
- Hosted shared-form tests: 3 passed, covering the actual EDS nine-cloud inspector edit, peer-aware undo/redo, instance movement/detach, reload and import ID isolation. Live HTML plus all nine linked assets byte-match the locally tested build.
- The owner's saved 584-icon browser library was refreshed without losing edits. The reviewed nine-cloud proposal was linked as `Cloud silhouette`; the live inspector reports nine instances in nine icons and browser storage reports Saved. Screenshot: `artifacts/owner-shared-cloud.jpg` (ignored).
- Refreshed ignored `eds-icons-current.zip` from owner export `glyph-library-all-20261002-2023.zip`: 580 EDS icons, 580 originals, 580 SVG files, nine linked cloud instances sharing one component ID. Existing reconstruction statuses remain 164 existing centerlines and 416 needing review.

## Icon controls, canvas menus and Undo redraws

- Selection/Direct Selection/Pen and Boolean actions are icon-only, with accessible names, hover/focus tooltips, hoverable tooltip surfaces and Escape dismissal. Group frames have rectangular individual buttons, two-pixel spacing and subtle shadows. Original Boolean diagrams distinguish Union, Subtract, Intersect and Exclude; Cutter remains scissors.
- Canvas context menus target anchors or object selections; Shift+F10 / Context Menu opens the same accessible menu. Anchor Snap to nearest uses the active Snap spacing in drawing-plane coordinates, including transformed objects and multi-anchor selections. Snap off disables it, and right-click does not draw in Pen mode.
- Fixed stale Undo/Redo runtime stroke weight, peer-aware undo for set-wide style edits, and cached shared-instance library thumbnails. The tests compare rendered SVG paths/styles as well as document data.
- Verified static build, 33 unit cases and 37 local browser cases. A prior full-run attempt hit ENOSPC and a separate test expectation incorrectly assumed starter weight 1.2 rather than the actual 1.6; the corrected regression and full rerun passed after generated Next output/cache cleanup. The tested out/ output was retained.
- This validation covers the changed controls' keyboard, labeling and tooltip behavior; it is not a whole-application accessibility certification.

Publication: application commits `4897a80` and `25242b9`; final Cloudflare version `f0200ae7-3384-45bf-bc0d-f9071a418290`. Six focused hosted browser cases pass (7.4s), including shortcut remapping, physical anchor context menus, transformed multi-anchor snapping, rendered Undo/Redo and peer thumbnails. The immediate post-deploy attempt had one startup timeout and an HTML mismatch; a fresh byte comparison and full six-case rerun passed. Live HTML and all nine linked assets match the tested local build. Owner-browser verification retained the saved 584-icon library and shows the anchor menu with active Snap spacing 0.1; proof is in ignored `artifacts/live-anchor-menu.png`. Tooltips and accessible shortcut hints follow remapped keys without duplicate native titles.

## ICONERD components, recovery and anchor editing

- Renamed the visible heading and browser title to ICONERD. Duplicate promotes an ordinary object to a separate component definition with two in-place instances. Editing either instance publishes its geometry to all peers; placement, uniform scale and root transforms remain local. Definitions are independently persisted and included in editable ZIP/JSON archives. Nested definitions remain unsupported.
- Shared-form detection now normalizes uniform scale and tolerates redundant imported closing anchors. Near matches require review at a 0.6% relative coordinate/parameter tolerance. The private EDS regression finds the plain cloud together with the previous nine cloud instances; it does not claim every cloud variation is compatible.
- Anchor/handle hover follows the same screen-space hit zone as dragging. Optional Proximity merge operates during Pen drawing and direct manipulation, averages adjacent anchors within eight screen pixels, retains the external relative handle vectors and broken-handle geometry, and participates in Undo. Its preference survives reload.
- Canvas and layer context menus can convert selected closed contours to regular circles/ellipses with four cubic anchors. Multiple selected eyes convert in one Undo step. Bounding-ellipse approximation preserves winding (including nonzero-fill holes), object placement and component identity; Undo recovers the exact original contours.
- Undo/Redo is persistent and chronological across icon switches, returning to the icon whose edit is restored and restoring component peers together. Named Library versions capture complete sets, originals, components and organization; restoring first retains a safety checkpoint and atomically replaces the working set. Initial startup, import and library reset create checkpoints. Browser-local history is not Git synchronization; downloadable version ZIPs are portable backups.
- Keyboard-focus tooltips now reposition after focus-induced scrolling instead of disappearing.
- An initial full browser run passed 42/43 with one keyboard-tooltip failure. Later runs exposed intermittent startup stalls. An independent instrumented browser probe captured `net::ERR_CONNECTION_RESET` on local JavaScript requests, before `window.__gw` existed. The macOS Python test server's five-connection listen backlog was increased to 128. An experimental browser-loader rewrite was reverted after this evidence; a direct static import also failed SSR build and was never published. Import verification now waits for the changed metadata rather than an unchanged library count.
- Owner recovery: preserved ignored `imports/backups/before-iconerd-components-20261002.zip` (584 icons) and `cloud-before-recovery-20261002.json`; restored only the displaced plain-cloud anchor from (8.4, 5.4) to its original (9.6, 3.6), retaining handles, metadata and reset baseline. The earlier textarea edit had not persisted; the import review/replacement route was then verified by reload and a fresh JSON export showing the restored coordinates.

Final local validation: static production build, 40 unit tests, all 43 Chromium browser tests (1.1m), and `git diff --check` pass. The final application uses the original browser-only editor loader; the verified connection-backlog repair is confined to the local test server.

Published application source `8397dc1`; Cloudflare version `3203b56d-cbe4-4f6d-ab98-47c59739c0ec`. Live HTML and all nine directly linked assets byte-match the tested build. Twelve focused hosted browser cases pass (20.6s). A further hosted conversion case physically selects the left eye and Shift-clicks the right in the layer tree, opens the canvas menu, converts both and verifies Undo/Redo; it passes (3.5s including startup). Its first proof attempt scrolled the canvas outside the viewport while selecting tree rows; the fixture now brings the canvas into view before using screen coordinates. Proofs: ignored `artifacts/regular-eyes-menu.png` and `regular-eyes-converted.png`.

Owner library migration verified in the live UI and after reload: 584 retained icons; `Cloud silhouette` has ten instances in ten icons. Named versions `Before cloud component migration` and `Cloud component migration — 10 instances` are stored. The downloaded post-migration whole-library checkpoint is preserved as ignored `imports/backups/after-iconerd-components-20261002.zip`. Refreshed ignored `eds-icons-current.zip` independently verifies 580 EDS icons, 580 reset originals, 580 SVGs, one separate component definition, ten linked instances sharing one ID and the restored plain-cloud anchor (9.6, 3.6). Existing reconstruction statuses remain 164 existing centerlines and 416 needing review. Owner proof: ignored `artifacts/owner-iconerd-components.png`.

## Anchor Cleanup, sharp-corner reconstruction and area selection

- Direct Selection now supports empty-space rectangle selection, Shift to add and Option/Alt to subtract, including anchor deselection. Cmd/Ctrl+A selects anchors in selected editable paths (all visible editable pen paths when none are selected), while object mode retains object Select All.
- A single active area-tool icon plus chevron menu offers Marquee, freehand Lasso and Polygon lasso. Entering from Direct Selection keeps anchor scope; entering from object Selection uses object scope. Polygon finishes with Enter, double-click or clicking its first vertex; Escape cancels. The chosen mode persists. Switching icons cancels a pending region, and deleting/nudging an area-selected anchor subset operates on anchors rather than whole objects.
- Anchor-menu Cleanup refits redundant selected Bézier points, checks each accepted removal against the original full outline in both directions (33 samples per cubic, default 0.03 drawing-plane units), and preserves unselected controls, protected/tagged corners, winding and crossing count. This is a sampled error check, not a formal continuous Hausdorff bound. Explicit node deformers are skipped. No-op cleanup creates no history.
- Merge to corner separately collapses consecutive selected clusters to their outer tangent intersection, preserving outside control positions and unselected anchors; near-parallel tangents use an average and distant intersections are refused. Closed seams and rounding tags are remapped. Whole-path collapse, invalid minimum topology and open endpoints are refused. Replacing baked curvature with a sharp corner deliberately changes the local rounded portion; it does not claim exact silhouette preservation. The new point remains eligible for procedural rounding. All changed paths participate in one peer-aware Undo step.
- Created a local Git-ignored `wiki/` with 40 stable feature entries, machine-readable JSON, geometry/data/history contracts, verified native IllTool source seams, proposed Swift/bridge/engine ownership and a read-only review brief. Native sources were inspected at IllTool HEAD `85cdfb6fad83c37e9b01fcbd80d59450652fb603`; no native build, runtime or parity claim is made. Relative wiki links and unique IDs were checked; Git ignore was verified.
- Added owner backlog for Mac/Windows app targets, larger configurable authoring artboards, menu-bar/small-system icon variants, gradients and gradient meshes. Existing 24-unit app template/1024px output is distinguished from these planned workflows.
- Validation: 44 unit cases and 47 full local production-browser cases pass (44.9s). After adding pending-region cancellation on icon switches, rebuilt production output and reran all four focused selection/cleanup cases. They exercise physical marquee/lasso/polygon selection, combine/subtract modifiers, keyboard popup dismissal, corner rounding, unselected path preservation, anchor Delete, Undo/Redo and reload. Four focused cases pass. Earlier fitting tests caught invalid array-vs-point affine-vector inputs; corrected before build/publication. Floating-point seam assertions compare tolerances rather than exact zero.

Published application source `5b1c90d`; Cloudflare version `d74f465b-34df-457d-886f-df9cd0451863`. Live HTML and all nine directly linked assets byte-match the final tested build. All four focused hosted selection/cleanup cases pass (6.9s), including physical modifier/area selection, one-step corner reconstruction and rounding, anchor deletion, reload and pending polygon cancellation across icons. Proofs are ignored `artifacts/anchor-cleanup-menu.png`, `anchor-corner-merged.png` and `area-selection-tools.png`. No owner-browser artwork was mutated during this change. Wiki and imported artwork remain outside public source/build.

## Edited-badge history timeline

Edited/History badge opens an accessible range over the library-wide Undo/Redo stacks. Five focused local browser checks passed, including pointer/keyboard scrubbing, cross-icon restoration, returning to latest, redo-branch replacement, Escape/focus restoration and reload persistence. Scrubbing uses existing peer-aware restore behavior and creates no new entries.

## Select All / Escape selection shortcuts

Cmd/Ctrl+A supports page focus and context-sensitive object/anchor selection. Text and content-editable fields retain native shortcuts. Escape cancels active region selection (pointer release does not apply it), clears current selection first, then exits isolation on a further press. Focused browser regression covers page focus, direct selection, gesture cancellation, isolation and text-input selection.

Polygon object enclosure now includes all contours and grouped paths; crossing/partially enclosed targets are excluded. Geometry checks cover curved excursions, concave regions, compound paths and boundary-aligned paths. Browser checks exercise Return and double-click completion while retaining selected objects.

## Icon-only timeline and proximity prehighlight

Supersedes the earlier library-wide Edited timeline: the badge now scrubs only the current icon’s persisted states. Restoration is a normal peer-aware edit, so shared geometry updates while unrelated icon edits/peer metadata remain intact. Keyboard Undo/Redo remains chronological. Local checks include legacy-history migration, unrelated edited icons, pointer/keyboard scrubbing, branch replacement, reload, and linked-peer geometry with retained peer description.

Merge preview rings and an averaged-point marker use the actual merge calculation on a private clone, respecting minimum topology and eight-screen-pixel adjacency. Newly inserted Pen-anchor drag release now uses proximity merge; previously it bypassed that branch. Preview clears when moving away or releasing. Unit checks cover preview/release parity and nonmutation; physical browser checks cover direct drag and inserted-point drag, retained broken handles, persistence and toggle-off behavior.

Validation receipts: 47/47 unit checks passed; 53/53 full production-browser checks passed. After the final legacy/identical-state playhead correction, the final rebuilt output passed 10/10 focused component/merge/history browser checks. The full run exposed page-focus arrow nudging from the previous shortcut expansion; constraining nudge to editor focus repaired it, and the final full run passed.

## Selection-aware circle conversion and rounded anchors

A lone/partial anchor selection no longer exposes whole-path circle/ellipse conversion. Whole objects and fully selected closed contours retain it. Single fillet-eligible pen corners expose Convert to rounded/Remove corner rounding; endpoints, straight/smooth and reversing joins do not. Actual curve tangents position the editable radius handle; original broken handles are retained, rounded markers are circles and the radius handle has an outer arc cue. Unit checks cover tangents, preserved geometry controls and excluded joins; physical browser checks cover contextual menus, radius drag, Undo and whole/partial contour selection.

Final rounding validation: 49/49 unit checks and 13/13 focused production-browser checks passed. Browser cases include radius drag and removing rounding with Undo, complete versus partial contours, endpoints, existing multi-eye conversion, cleanup and proximity-merge regressions. A temporary ENOSPC interruption was recovered by clearing this project’s rebuildable Next.js cache; final tests ran against the retained compiled output.

## Source-anchor selection and consistent area tools

Canvas clicks, source rows, area selection and Select All now share editable source-point coordinates, rather than selecting evaluated rounding segments. Imported SVG/primitive anchors materialize only their owning primitive as pen contours on actual selection, retaining counters and transforms; existing pen radii remain procedural. Rounded corners can be selected at the raw corner even outside the evaluated outline. Source-row compound conversion refreshes the form cache immediately. All three area tools require full object/group enclosure in object scope and contain individual source anchors in anchor scope. Area menu names exclude the decorative selected checkmark. Proximity toggle activation now explicitly states its eight-screen-pixel rule and preview behavior.

Validation: 49/49 unit checks; 64/64 full production-browser checks before the final source-row compound refresh/status correction. Final rebuilt output passed 20/20 focused source/area/rounding/component browser checks (12.8s). Physical checks include transformed imported compound paths and preserved counters, source-row movement/Undo, rounded-source corner selection with Shift/Alt modifiers, and the owner comment-outline coordinates with pre-release merge preview and retained broken handle. The owner browser was inspected read-only: Direct Select active, proximity merge disabled. No owner artwork or preferences were mutated.
