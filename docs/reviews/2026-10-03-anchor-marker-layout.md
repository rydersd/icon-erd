# Anchor-marker selection layout correction

The owner reported selection/deselection lag. CPU profiling found that pointMarker measured canvas bounds after each SVG insertion. With 100 anchors, a real selection gesture performed 209 canvas bounds reads. Repeated reads mixed with DOM writes force repeated layout.

The source-point overlay and selected-handle renderer already measure current drawing scale once per batch. Pass that scale to pointMarker and use it for marker stroke width, removing per-anchor measurements. No rectangle is cached across events; each render still observes current zoom and canvas dimensions.

Adversarial self-review (not independent approval):

- A fixed rectangle cache would become incorrect after zoom/resize. This patch does not introduce one; browser tests verify 1.5px screen stroke width before and after zoom/resize and physically select the same anchor in the new viewport.
- Marker appearance must remain equivalent: 1.5 / pixels-per-unit equals 1.5 * units-per-pixel. All marker callers now pass the same scale already used for marker sizes.
- A green timing test can conceal variability or fail for unrelated load. The regression checks bounded canvas layout-read counts on actual selection and Escape, rather than asserting machine-specific milliseconds. The previous hosted build fails it with 209 reads. The corrected local production build passes.
- Selection, rounding, hover, imported contours, Undo/Redo and shared forms retain their existing model/render paths. Full browser regressions cover these behaviors; no new geometry or document cache was introduced.
- The measured improvement is narrower than all interaction latency. Core evaluation, previews, source table rebuilding and other layout/paint work remain. Do not claim the owner's exact saved-tab latency is resolved solely from headless handler measurements.

The private wiki records the diagnosis and running innovations. AGENTS.md now instructs future work to maintain that local record, distinguish proposals/experiments/implemented behavior and link evidence; it does not publish owner artwork or transcripts.

Validation: production build passed; 64/64 unit tests and 84/84 full production-browser tests passed (47.8s). The previous hosted release fails the new regression with 209 canvas bounds reads; the corrected build remains below 20 for both selection and Escape.

With the same private cloud-saas fixture and eight direct-select/Escape pairs, the final production build measured median selection 6.9ms and Escape 10.1ms, compared with normal-bounds baseline medians 7.7–8.0ms and 16.7–18.9ms. This narrow patch removes the per-marker reads; the fixed-rectangle diagnostic reached 5.9ms Escape by bypassing additional bounds reads as well, so its result is not claimed as the production result. These are local headless handler measurements, not end-to-end owner latency.
