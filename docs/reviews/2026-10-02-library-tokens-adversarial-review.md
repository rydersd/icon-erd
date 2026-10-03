# Adversarial review: library tokens and corner cleanup

## Scope and provenance

This is a Codex self-review using the adversarial-review skill, not an independent reviewer approval. The original feature commits `dce7a93` and `6bbdb83` were already on public main when the owner requested a branch/PR/review/merge workflow. Main at review start was `48f3032`. The correction PR preserves those commits and reviews their behavior; it does not claim to introduce the original features.

Inspected the original feature diff, corner reconstruction and its geometry helpers/tests, token validation and archive ownership, the editor's history/checkpoint/storage paths, and the token panel's controls. Reviewed the correction diff separately after reproducing the failures.

## Findings

### Medium: token edits in an empty library invent an icon — resolved

`applyLibraryProperties` passed the blank working-plane placeholder through normal glyph `commit`/`storeCurrent`. After deleting every library icon, linking a tokens file produced one library item. The new empty-library browser regression failed on the existing production build with expected count 0, received 1.

The correction records library-only history entries when no glyph exists. Undo/Redo handles these before looking up an icon, and per-icon timeline reconstruction ignores entries without glyph snapshots. Tests cover reload, Undo/Redo, and creating a real icon after the library-only edit; tokens then apply without confusing that icon's timeline.

### Medium: empty checkpoint restore discards token ownership — resolved

`restoreLibraryVersion` bypassed archive parsing for zero-icon checkpoints and constructed a fallback without `libraryProperties`. Restoring a linked empty checkpoint changed the title from the linked filename to plain Library tokens. The second new browser regression reproduced that failure on the existing build.

The empty fallback now validates and restores checkpoint properties before the replacement transaction. The regression covers restoring the linked filename/value and reloading with zero icons.

### Medium: newly created icons can disappear on immediate reload — resolved

Extending the empty-library regression to create a real icon, Undo/Redo tokens, and immediately reload exposed a separate persistence gap: the new icon disappeared (expected count 1, received 0). Creation only queued the debounced IndexedDB write and did not journal the glyph. It now uses the existing `storeCurrent` path, which journals synchronously before queuing autosave. The test deliberately reloads without waiting for the debounce.

## Validation

- Both new regressions failed against the previously shipped build, with the failures described above.
- Production static build passed.
- All 56 unit tests passed, including corner reconstruction, sharp-junction preservation, noncircular rejection, aliases, invalid bindings, and archive round trips.
- Full local production browser suite: 72 passed, including real private-import fixtures, selection, proximity prehighlight, cleanup, retraction, shared components, history and import/export.
- The final full browser suite, including all four token tests, was rerun after extending the regression to cover adding a real icon after an empty-library token edit and repairing its immediate-reload persistence.
- Git diff whitespace check passed. No imported artwork or ignored wiki/build output is included in the PR.

## Remaining limits and conclusion

No unresolved high or medium findings in this bounded review. Corner cleanup uses a sampled outline tolerance, not an exact mathematical identity proof; unusually curved clusters may deliberately remain unchanged. Token support remains the documented numeric subset, and linked files are embedded snapshots updated by reselection rather than continuously watched disk files. Browser storage failure recovery is not established by these successful normal-storage tests.

These are local checks, not GitHub CI or independent owner acceptance. Main had no branch protection at review time. Hosted deployment validation is a separate post-merge step.
