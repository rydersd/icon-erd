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
