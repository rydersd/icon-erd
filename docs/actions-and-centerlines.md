# Shape actions and library exceptions

Right-click a shape on the canvas or in Layers, then open **Actions**. The same selection-aware commands appear in both places. Original diagrams show the starting geometry in gray and the result in the accent color; labels remain visible. Arrow Right opens Actions; Arrow Left or Escape closes it and returns focus. Undo, selection commands and layer library settings stay in the first menu.

**Create centerline** is available for one visible filled shape or group. Review the source and candidate, then choose **Add centerline layer**. Rounded bars are recognized from their resolved capsule boundaries, even when imported as paths, and recover a single open axis with the original bar width. Other shapes use **Inset contour**, explicitly a boundary-offset candidate rather than an inferred medial axis. Inset and stroke can be adjusted; collapsed candidates cannot be applied. Cancel preserves the artwork. Applying adds an independent named stroke layer with symmetry/placement baked once and local width/rounding; source geometry and component links remain unchanged. Hide the original layer to inspect the new layer by itself. Undo removes the candidate; editable exports and reload retain it.

The **Library settings** context section controls the selected object's entire layer. Disable **Follow library thickness** or **Follow library rounding** to capture the current values locally. Re-enable to resume icon/library inheritance. Layer-local widths take priority over icon overrides; icon overrides take priority over library thickness. A diamond indicator marks customized layers and library icons containing overrides. Local width and corner/end rounding can be edited in the layer inspector. Local values apply in canvas, isolation, previews, SVG/raster output and generated solid geometry.

![Actions menu](images/actions-menu.png)

![Centerline review](images/centerline-review.png)

## Dogfood findings

Eight original editable action icons were imported into a disposable ICONERD library and survived reload. Prototype comparisons include light/dark appearance, two-column versus row layouts and keyboard/mobile interaction. Artifacts remain in the ignored `imports/action-language/dogfood-v1/` folder.

Half-width inset collapses a 1.2-unit bar and produces a closed contour for wider bars; that is why rounded-bar recovery is a separate method. Recognition is conservative: axis-aligned capsules with matching boundary samples and area, uniform widths when multiple contours occur. Rotated/irregular bars fall back to manual contour review.

An experimental proximity-fusion recipe expands strokes, closes gaps and unions their areas while preserving original axes. In the three-bar trial, a .6-unit threshold joins the close pair, while 2.4 joins all three. This remains an experiment, not an enabled application rule. Outline stroke appearance and solid stroke-area export coincide for these open bars; closed contours need hole/counter review before a shared outline/solid recipe can ship.
