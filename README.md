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
- **Import file** or **Import pasted JSON** accepts one glyph, an array, or a versioned library document. **Add** keeps both colliding names with a numeric suffix; **Overwrite** replaces matching names and adds new names. Invalid batches are rejected before library mutation.
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
