# Glyph Workbench

An MIT-licensed Next.js vector icon editor powered by Paper.js. Base UI supplies React controls; Font Awesome Free supplies editor icons. A fresh browser starts with four original arrows. Imported libraries and edits stay in that browser.

[Live workbench](https://icon-erd.ryder-2b2.workers.dev/) · [Public source](https://github.com/rydersd/icon-erd)

## Run and verify

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Open `http://localhost:3000`. Production output is `out/`, suitable for Cloudflare Workers static assets. `npm run deploy` builds and publishes using `wrangler.jsonc`; it requires Cloudflare authentication. `/editor.html/` remains an alias for the editor.

## Editing and exchange

- **Library** collapses and remembers its state. Search matches names, descriptions, and comma-separated search terms in **Icon metadata**.
- **Right-click** a library thumbnail to change its icon type; single-group icons also expose group type and symmetry. Right-click a Layers row to change group type, enable symmetry, change layer paint, convert a shape to an editable path, or use an object as a cutter. Shift+F10 opens the same menu from the keyboard.
- **Layers** supports dragging objects before/after siblings, into groups, and between layers; drag layer headers to reorder layers. Insertion lines indicate before/after; a highlighted group accepts a nested object. Destination transforms, symmetry and boolean effects apply to moved objects. Names are retained; unnamed layers and objects receive readable fallbacks. Double-click a name to rename it.
- **Use as cutter** subtracts the selected object from its siblings, combining multiple remaining siblings into one artwork subject. The cutter stays editable and the change supports undo.
- **View controls** sit below the canvas. The eye button opens a Show palette of icon tiles for overlays; zoom sits alongside it. Escape or clicking outside closes the palette.
- **Selection tools** use V for object selection, A for Direct Selection (hollow arrow) and P for Pen. Direct Selection converts primitives to editable points as needed, bypasses groups, and supports Shift-click point selection plus dragging/nudging multiple anchors. Filled markers show selected points; rounded points use circles, sharp points squares and disconnected handles diamonds. **Keyboard shortcuts** lets you remap keys and restore defaults; preferences stay in this browser.
- **Snap** buttons choose snapping independently of the display grid. Alt-click a button to define its spacing, including zero for off. Custom slots and the active setting survive reload.
- **Import ZIP** accepts an editable ZIP archive or legacy JSON; pasted JSON also remains supported. Every import opens a review card; the **Replace matching icons** checkbox is off by default. Add keeps both colliding names with a numeric suffix; Replace overwrites matching names and adds new names. Invalid batches are rejected before library mutation. Imports save original baselines, including under renamed collision names. Archives carry those originals alongside edited glyphs.
- **Export icon**, **Export edited**, and **Export all** download editable JSON. The export panel also provides runtime or baked SVG, downloadable baked SVG, and PNG at the chosen export size.
- **Pen** inserts a point on a source outline, converting primitives to editable vectors. Alt-click an anchor to remove it; Delete removes the selected anchor. Paths retain at least two anchors (three when closed). Undo/redo preserves edits.
- **Subtract** uses the first selected sibling as the subject and later siblings as cutters. Group inspection exposes clearance edges and fillets.
- **Symmetry** targets the whole icon or selected group. Mirror and radial copies remain editable; inspector copy counts support 1–32.
- **Set settings** expands on the left. Thickness overrides stroke weight across the library; Corner radius and End radius independently control path corners and stroke tips. Each has its own enable switch. End radius is clamped to half the stroke width; smaller radii round the tip corners instead of forcing a semicircle. Disable each override to restore the original join or cap choices. Click a Source anchors row to select its point; its Round checkbox includes or excludes that anchor from the enabled rounding controls. Settings and anchor tags survive JSON exports. View offers grid spacing independently of Snap. Use as cutter is a toggle in the Layers menu, toolbar and inspector; clicking again returns the object to normal geometry. Filled outlines retain their geometry; thickness does not infer a centerline from a filled silhouette.
- **Points & overlaps** is first on the right. It lists source anchors in canvas coordinates and flags coincident curves and partially overlapping straight segments. Selected objects narrow the point list. This is a source diagnostic: intentional area intersections, near overlaps, and final symmetry-generated intersections are not blanket failures. Nothing is deleted automatically.
- Give each layer a custom hex color for multicolor artwork, or retain semantic color roles. **App icon** templates include a colored rounded background and an artwork layer; app mode uses a 24-unit vector canvas and defaults to 1024px SVG/PNG export. It does not generate platform asset catalogs.

## Modules

`app/` contains Next.js routes. `components/` contains the React shell and Base UI library disclosure. `src/editor.js` owns the mounted interaction controller and tears down listeners, observers, storage and its Paper project. Geometry evaluation, JSON interchange, storage, original starters, UI artwork and geometry inspection live in separate `src/` modules. Styles are in `styles/editor.css`; regression tests are in `tests/`.

The initial `AGENTS.md` describes the original single-file draft; use these commands and module paths for the current implementation.

## Local project packs

`imports/` is ignored and never copied into the public build. Local handoffs include `illtool-icons.json`, `illmater-icons.json`, `spurious-ecosystem-icons.json`, and `equinix-icons.json`. Import the first three in that order to exercise real project data. Missing SF Symbol names are recorded in adjacent reports; they are not replaced with invented icons. Extracted artwork retains its own source terms and is outside the application's MIT license.

The collection scripts read other checkouts without modifying them. `node scripts/verify-private-imports.mjs` validates local packs. The optional browser import test skips when those private packs are absent.

## License

Application code and original starter arrows: [MIT](LICENSE). Font Awesome Free icons: CC BY 4.0; see [third-party notices](THIRD_PARTY_NOTICES.md). Imported artwork is independently licensed.

**Reset icon** returns to the shipped or imported original, with normal Undo. **Reset library** restores known originals while keeping library membership; it saves an IndexedDB backup before changing anything. **Undo library reset** restores edits even after reload. Old imports saved before baseline support cannot recover a missing original; reimport the source pack to establish one.

`node scripts/name-eds-layers.mjs` prepares the local 580-icon EDS pack as `imports/eds-icons-named.json`, with semantic rules for identifiable parts such as Head of Arrow, Shaft of Arrow, clock hands and magnifying-glass handles. Geometry is checked for every icon. The adjacent private review report identifies details whose precise semantic name still needs visual review; fused outlines remain fused. Neither artwork file nor review report is published.

## Organization, export and appearance

Primary group metadata drives collapsible library sections and ZIP folders. Multiple usage tags and aliases are searchable. The **Suggest groups** preview fills unassigned groups from icon names, explicitly marked `groupSource: name-based-suggestion`; these are not verified usage categories. Undo grouping persists after reload and restores grouping without overwriting artwork edits.

The **Export ZIP** accordion selects grouped or flat folders, an optional root folder and SVG inclusion. Every ZIP includes `library.json` (editable icons and reset originals) and `organization.json` (groups, tags, SVG paths and suggested Figma component names). SVG-only ZIP ingestion is not implemented.

The sun/moon segmented control selects a theme; its dropdown opens the appearance card. Sectioned color/opacity controls and grid/ruler weights are saved independently for light and dark themes. Reset this theme restores its defaults.

See [usage-based organization design](docs/icon-organization.md) for evidence-backed LLM proposals and a Figma import path. Those integrations are proposed; direct Figma sending and automated component-usage analysis are not implemented.

Library icons can be selected with a normal click, the tile checkmark, Cmd/Ctrl-click, or Shift-click ranges. **Select shown** selects icons in expanded sections matching the current search/filter. **Delete selected** (or Delete while focused in the library) removes whole icons; **Restore deleted** restores their edits and originals, including after reload. Deleted starter icons stay deleted. New icons with matching names are preserved when restoring, using suffixes for collisions. Canvas Delete continues to operate on drawing objects.

The arrow to the right of each library group count opens that group on the drawing plane for a quick visual review. Reconstruction reports (`glyph-workbench-reconstruction`, version 1) can be loaded with Import ZIP / JSON. They attach status, reasons and candidates without replacing current drawings; a changed source is flagged. The review shows current drawings beside approximations, highlights unresolved icons, and offers **Use centerlines** as an explicit reversible edit.

The local EDS handoff `eds-icons-current.zip` is git-ignored. It contains current browser artwork, reset originals, group/tag metadata and SVGs; imported artwork remains outside the application license. The private reconstruction report lives at `imports/reconstruction/eds-centerline-review.json`. To repeat its conservative raster/skeleton pass, run `node scripts/reconstruct-eds.mjs <python-executable>` with numpy, scipy, scikit-image and OpenCV installed (and Node sharp available). This pass does not establish original authoring paths.

## Shared forms

**Find shared forms** scans the current library in application code, including subgroups and individual objects. The inspector also offers **Find matching forms** for the selected object. Detection compares compatible form trees after removing translation, instance names and root transforms; closed pen paths may start at different anchors. It never links by icon name. Near matches (up to 0.03 local units per coordinate/parameter) are explicitly labeled and require **Adopt shared shape and link**; larger differences and incompatible path structures remain independent. Symmetry/deformer-bearing forms are excluded from automatic matching.

A linked instance stores `component: { id, name, origin: [x, y] }` alongside its editable geometry. The application publishes committed geometry changes across matching IDs, including instances in other icons, while retaining local placement, root transforms, names, visibility, cutter edge and layer styling. Edits inside linked groups publish the entire group's geometry. Purple long-dashed outlines identify linked geometry on the drawing plane; **Shared forms** in the appearance card customizes their color. **Detach instance** keeps the drawing and removes the link.

Undo/redo restores every affected icon, including linking itself. Autosave and a synchronous multi-icon journal protect shared edits across reload. ZIP/JSON archives retain complete editable projections and links, even when exporting only part of a library. Each import remaps component IDs together, preserving links within that import while isolating it from existing library components. There is no fuzzy auto-linking, master-only edit mode, nested component linking or native Figma component export.
