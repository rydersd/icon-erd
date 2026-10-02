# Validation — 2026-10-01

## Delivered application

- Next.js static export deployed at https://icon-erd.ryder-2b2.workers.dev/.
- Cloudflare version: `1022d8b5-0f82-412f-b974-b7efaab36e5b`.
- MIT application source, Base UI shell controls, Font Awesome controls, four original starter arrows. No Git commit, push, or public source repository publication was performed.
- Import/export with explicit add/overwrite, searchable metadata, multicolor layers, app-icon SVG/PNG output, source point coordinates, source overlap inspection, group/radial symmetry, pen insertion/removal, boolean cutting, collapsible library and expandable left set settings.

## Evidence

- `npm test`: 14 passing tests, including compound counters with open strokes, Bezier insertion, transformations/deformers, symmetry, subtraction, overlap discrimination and atomic library validation.
- `npm run build`: successful static build.
- `npm run test:browser`: six tests passed against the production static export; desktop, dark and mobile screenshots inspected. The earlier development run passed five functional browser tests.
- `npm run test:imports`: 144 IllTool, 31 Illmater, 207 Spurious and 580 original design-system icons parsed, evaluated to nonempty geometry and round-tripped. Sequential project imports produce 386 icons including the four arrows. This is geometry/data validation, not a pixel comparison with the native applications.
- Live Chrome visibly initialized the four-arrow library, canvas, previews and point table. Eleven deployed HTML/JS/CSS files matched the final local build byte for byte via HTTP.
- Live private artwork and Finder metadata endpoints returned 404. Application source and deployed output scans found no Equinix/EDS/QUIX application dependencies or bundled icon packs.
- The live headless browser suite could not complete navigation: four timeouts, one interrupted test, one not run. It is **not** a hosted-suite pass. A separate Python HTTP client received 403; curl and regular Chrome succeeded. The cause of the client-specific behavior remains unconfirmed.

## Local artwork handoff and limits

The ignored `imports/` files are local handoffs. IllTool has four unavailable SF Symbol names and Spurious has three, listed in adjacent reports. Illmater contains its existing Lucide geometry. The 580-icon design-system JSON was checked against the original draft without changing glyph data. Artwork retains its own source terms; the application MIT license does not relicense it.

Automated import into the owner's Chrome session was blocked by the extension's file-URL access setting; the library there remains the four arrows. Use Import file to load the local packs manually. Browser edits are local to that browser/origin; export JSON for transfer or backup.

Thickness adjusts strokes, not filled silhouette centerlines. Diagnostics detect coincident source curves and overlapping straight segments; they do not guarantee absence of near overlaps or final symmetry-generated intersections. App-icon mode provides a multicolor drawing document and sized SVG/PNG export, not a platform asset-catalog generator.

The adversarial review was a self-review after initial extraction started and before Next.js conversion. No independent review or owner acceptance is claimed.
