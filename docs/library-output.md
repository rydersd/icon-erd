# Library output and solid experiments

Library properties stores output variants, family display, fill/stroke colors and target sizes alongside numeric drawing tokens. These settings persist in the browser, participate in Undo/Redo and travel in editable ZIP archives. Linking or disconnecting numeric tokens preserves output settings. `As drawn` and original layer colors are the defaults.

Each library group has a **⚠ count** button that isolates flagged reconstruction results and solid comparisons. The global Problems filter searches across groups. A zero-result group retains its toggle so the filter can be cleared. One icon per EDS family hides an existing filled counterpart when `name-outline` exists; it retains that counterpart, its reset original and history. Group review shows generated solids next to the filled references.

## Solid generation

Test solid variants evaluates selected EDS families, or all outline families when no library icons are selected. Closed centerlines can use their outside, center or inside boundary; hole handling can preserve or fill counters. Open paths expand their stroke without inserting invented closing edges. The test compares each recipe against an existing filled counterpart, using area intersection-over-union and matching hole/component counts. A candidate requires at least 97% overlap and matching topology. Missing references, collapsed offsets, unsupported procedural line ends and mismatches need review. The group review lets an owner change the recipe and explicitly approve the displayed result. Review metadata changes are undoable; source geometry changes invalidate approval.

Rendered exports deduplicate EDS families and retain `name-outline` for outlines and `name` for solids. Both produces two files. Filled with stroke applies separate fill and stroke paint to generated paths. An unreviewed or stale recipe blocks the rendered export with a named error; editable JSON/checkpoint exports remain available. Existing filled sources and reset originals are not deleted. Single-icon downloads use the first variant when Both is selected; ZIP exports include both.

This is an experiment, not a promise that every EDS solid is derivable automatically. The current private 584-icon snapshot contains 262 paired families: 6 passed the comparison and 256 need review. The reset-original comparison also passed 6. Some filled variants have different semantic holes or geometry. The test does not establish one universal recipe for them.

Private artifacts live in ignored `imports/eds/`: timestamped owner backup, current-library ZIP/JSON, solid-review JSON, comparison HTML, and an experiment ZIP retaining editable source/original/component metadata and SVGs for matched solids. `node scripts/review-solid-variants.mjs` computes the report; `node scripts/solid-experiment.mjs` builds the visual sheet and ZIP. Importing the report attaches metadata without replacing drawings.

## Targets

- Interface: 24px default.
- macOS menu bar: editable 18/36px preset, black template artwork on transparency, with an Xcode `.imageset` when both preset sizes are included.
- Mac app: 16–1024px raster sizes and a macOS `.appiconset` when the complete preset is included.
- PC app: 16–256px raster sizes.
- Custom: up to 16 sizes, each 8–4096px.

Enable PNG sizes / Apple assets in the Export accordion to include rasters and compatible Apple catalog metadata. Export folders continue to follow icon groups. SVG remains scalable. The drawing plane uses 24-unit geometry; this adds larger outputs, not larger editable artboards, gradient meshes, ICNS/ICO packaging or layered Icon Composer documents. A Mac app template is available for background and artwork layers. Menu bar size is a chosen editable preset, not a universal platform constraint.

Asset metadata follows Apple's [Image Set Type](https://developer.apple.com/library/archive/documentation/Xcode/Reference/xcode_ref-Asset_Catalog_Format/ImageSetType.html) and [App Icon Type](https://developer.apple.com/library/archive/documentation/Xcode/Reference/xcode_ref-Asset_Catalog_Format/AppIconType.html) specifications. Modern layered app icon workflows remain separate work.
