# Shape actions and library exceptions

Right-click a shape on the canvas or in Layers, then open **Actions**, the first command below the selection heading. The same selection-aware commands appear in both places. Original diagrams show the starting geometry in gray and the result in the accent color; labels remain visible. Arrow Right opens Actions; Arrow Left or Escape closes it and returns focus. Undo, selection commands and layer library settings stay in the first menu. Anchor alignment uses the compact labels **Align X** and **Align Y**, automatically chosen from the selection. Snapping and alignment use gray-source/accent-result diagrams, with a fixed icon column and separate wrapping label.

**Create centerline** is available for one visible filled shape or group. Axis-aligned rectangular bars, including flatter rounded ends, recover open center strokes with source width and tip radius. This uses resolved boundaries rather than imported node types. A candidate previews live as you edit stroke width. Applying adds an independent named stroke layer, preserving source geometry/component links and baking placement/symmetry once. The new layer is selected, exposing local thickness and library exclusion. Adding it exits source isolation so the independent layer is visible and editable; hiding the original shape or layer leaves the recovered stroke visible. Unsupported forms cannot be applied: a closed boundary inset is no longer presented as a centerline. General curved/branched medial-axis recovery remains unfinished.

Excluded strokes expose **layer cap**, **layer join**, **layer corner rounding**, and **layer end rounding**. Cap choices are library/round/butt/square; join choices are library/round/miter/bevel. Choosing a native cap clears procedural end rounding; choosing a native join clears procedural corner rounding. Setting a positive rounding radius uses procedural rounded tips or joins. Explicit overrides remain independent of library changes and persist through Undo, reload, previews and SVG export. Setting cap/join back to library releases that override; rounding remains an independent setting. For excluded strokes, the path cap dropdown and preview cap/join buttons edit those same local settings, clear conflicting procedural rounding, and persist the result.

The **Library settings** context section controls the selected object's entire layer. Disable **Follow library thickness** or **Follow library rounding** to capture the current values locally. Re-enable to resume icon/library inheritance. Layer-local widths take priority over icon overrides; icon overrides take priority over library thickness. A diamond indicator marks customized layers and library icons containing overrides. Local width and corner/end rounding can be edited in the layer inspector. Local values apply in canvas, isolation, previews, SVG/raster output and generated solid geometry.

![Actions menu](images/actions-menu.png)

![Anchor actions](images/anchor-actions.png)

![Centerline review](images/centerline-review.png)

## Dogfood findings

Eight original editable action icons were imported into a disposable ICONERD library and survived reload. Prototype comparisons include light/dark appearance, two-column versus row layouts and keyboard/mobile interaction. Artifacts remain in the ignored `imports/action-language/dogfood-v1/` folder.

Half-width inset collapses a 1.2-unit bar and produces a closed contour for wider bars; that is why rounded-bar recovery is a separate method. Recognition is conservative: axis-aligned rectangular bars with matching boundary samples and area, uniform widths and tip radii when multiple contours occur. Rotated/irregular or branched forms remain unsupported by Create centerline.

**Fuse nearby strokes** is an explicit group recipe. Right-click a stroke union group on Canvas or in Layers → **Actions → Fuse nearby strokes**. Review the outline and derived solid, adjust **Merge distance**, then save. The default protects existing holes. Zero joins existing overlap; positive distances approximately close nearby gaps. The three-bar trial joins the close pair at .6 and all three at 2.4. Preview before applying; this is geometric gap closing, not a metaball field.

The group retains its original editable paths. Changing thickness regenerates its stroke area, and solid generation applies the same distance recipe to the original centerlines' chosen solid boundaries. Fusion stays inside each enabled group. Union ancestors are required; nested fusion is unavailable. Recipes follow shared components, including scaled instances, and remain dormant on fill/both-painted layers. Hide/disable/Undo and editable JSON/ZIP retain the sources. **Disable proximity fusion** provides recovery if a later Boolean change makes the group incompatible.

Fused SVG regions use the stroke color or token as their fill. Geometry is baked even in runtime SVG: CSS color tokens work, but CSS stroke-width cannot regenerate the shape outside ICONERD. Library/icon/layer thickness edits inside the app regenerate it. Derived solid exports retain the existing review requirements; previewing a recipe does not silently approve a solid variant.

![Fusion review](images/fusion-review.png)
