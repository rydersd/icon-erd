# App-icon paint foundation

Choose App icons in Drawing mode to reveal the App icon Fill and Bitmap reference panels on the left. This foundation shares the existing geometry, library history and export pipeline; it does not introduce a separate document.

## Gradient fills

Choose the paint layer and Solid, Linear gradient or Radial gradient. Gradients support 2–16 ordered stops with color, position and opacity. Coordinates are fractions of the resolved layer bounds; the SVG evaluator maps them into drawing coordinates, so zoom and isolated-object display retain the same placement. Paint remains local to a layer; linked components share geometry. Single-color/template output deliberately suppresses gradients. Existing library multicolor output controls solid colors; explicit gradient fills override that fill color.

Rendering uses the same paint evaluator for canvas, isolated geometry, previews, SVG exports and PNG rasterization. JSON/ZIP retain editable stops. Switching back to interface mode hides the studio while retaining its artwork.

## Bitmap reference

Import a PNG, JPEG or WebP up to 8 MB. The image is embedded in the icon and placed behind vector artwork, fitted to the 24-unit canvas with its aspect ratio retained. Default placement is locked and opacity is 0.4. Show/hide, lock, opacity, X/Y, aspect-preserving width/height, Fit and Remove controls are available. Hide opaque vector background layers while tracing if they cover the reference.

Placement uses panel controls in this pass. Reference pixels are not selectable anchors or geometry operands. References are excluded from artwork previews and exports by default; Include reference in export opts into SVG/PNG inclusion. Monochrome/menu-bar output excludes them. Undo and saved JSON/ZIP preserve the reference and settings.

## Scope and limits

The authoring plane remains 24 units; app-icon output can be 1024px or existing configured profiles/sizes. On-canvas gradient/image handles, gradient strokes, mesh topology and larger authoring artboards are later work. Embedded images increase history/storage payloads; asset deduplication is a follow-up, not an implemented asset service. The import validates embedded raster MIME/data bounds, and the UI decodes files before accepting them; JSON metadata validation alone cannot certify valid image pixels.

## Adversarial self-review

Physical tests edit stops, check rendered ramp pixels, export a real 1024px PNG with an opted-in bitmap, Undo, hide/show, remove/recover, switch studios and reload. Unit checks cover unsafe image URLs, malformed stops, radial/linear exports, mono exclusion and JSON/ZIP preservation. Gradient IDs include geometry/paint/name fingerprints to avoid sanitized-name collisions. Isolation reuses full-layer coordinates rather than restarting the gradient on a selected child. Studio render caching also checks document identity so Undo cannot leave controls editing an obsolete object.

This is self-review, not independent approval. No owner artwork is mutated by tests; screenshots use disposable synthetic artwork. No GitHub CI is configured. Native IllTool ownership/mapping remains a private source proposal rather than a validated port.
