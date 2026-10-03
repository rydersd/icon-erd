# Library variants and output: adversarial self-review

Scope: library problem filters, EDS family display, solid recipe comparison/approval, library output/color properties, scalable raster targets and ZIP asset metadata. This is a self-review using the adversarial-review skill, not an independent reviewer approval. No GitHub CI is configured; local/hosted checks are separate evidence.

Findings resolved before merge:

- **High — baked geometry was transformed twice.** Generated paths initially inherited source rounding and whole-icon symmetry. The generator now clears baked rounding and symmetry, disables layer symmetry, and retains thickness for an optional output stroke. A geometry regression exercises this boundary.
- **High — reviews could survive a geometry change.** The initial signature omitted stroke width, visibility, opacity and caps. It now includes resolved path geometry, paint/visibility/opacity, effective thickness/end radius and stroke style. Shared-component publication invalidates peer reviews as well as the edited source. Export independently compares signatures; imported report metadata cannot bypass a changed source.
- **High — overlap can hide lost holes.** A synthetic tiny-hole counter has greater than 99% area overlap with a filled circle but fails topology. Automatic candidates require both matching holes/components and ≥97% overlap. Existing EDS solids/reset originals are retained. Manual approval is explicit and undoable.
- **Medium — unsupported caps would be silently approximated.** Square and procedural rounded line ends fail explicitly rather than being substituted with round caps. Open paths retain stroke expansion without invented closure. These unsupported cases remain review problems.
- **Medium — point-in-time report attachment needed an undo boundary.** Validated reports now attach review metadata in one commit, preserve geometry and reset originals, mark changed source signatures stale and support Undo. Importing global output settings is explicitly opt-in along with library token properties.
- **Medium — empty filtered groups could trap the filter.** Group-level Problems mode keeps its header/toggle when no cards remain. Browser tests clear a zero-result filter successfully.
- **Medium — platform output must be actual files.** Browser exports assert real PNG headers at 18/36 and 1024px; unit checks verify every catalog filename exists and the macOS 1×/2× slot metadata references generated files. This is raster asset-catalog compatibility, not an Icon Composer document or an ICNS/ICO file.

Residual limits: only 6/262 real EDS paired families pass the prototype comparison; 256 need review. Reset originals also passed 6. No claim that every semantic filled variant can be inferred from its outline. Larger editable artboards, optical size-specific edits, gradients, meshes, layered Icon Composer, ICNS and ICO remain separate work. Menu bar 18/36px is an editable preset. The owner snapshot and artwork artifacts remain ignored/private.

Validation evidence is recorded on the PR and in the current validation document. Geometry unit tests, full production-browser regression checks and hosted focused checks distinguish source correctness, merge and deployment.
