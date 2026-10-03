# Selective deleted-icon restore and anchor inspection

Restore previously recovered the entire trash. It now opens grouped previews on the drawing plane with no default selection and restores only explicitly selected entries. Unselected trash persists. Individual trash-entry identity allows two deleted versions with the same name to be chosen separately; restored names are suffixed to preserve live collisions.

Adversarial self-review (not independent approval):

- Restoring a later subset must map its original from the selected entry, rather than the original trash index. Browser coverage verifies this and reset after restoration.
- A failed storage transaction must leave trash and the live library unchanged. Injected failure plus reload and retry verifies this boundary.
- Closing review while a save is pending must not change which entries the restore transaction removes. Selected entries are captured before awaiting saves. Library replacement before transaction preparation is rejected.
- Switching between deleted review and group review must clear mode/selection state. Keyboard tests cover the switch, Escape, native Space checkbox selection, scoped Select All and explicit bulk recovery.
- Filtering source rows must not change canvas markers or rounding-tag initialization. The full source-point collection remains separate; tests verify hidden points retain rounding tags.
- Anchor label toggles must not hide anchor markers or alter library data. Numbers and coordinates are independent browser preferences; tests cover both toggles, combined labels and reload persistence.
- The source table uses a fixed 240px viewport. Tests verify its height remains equal after selecting the first anchor; clearing selection restores all rows.

No blocking findings remain after these checks. Residual limitation: restore previews share the existing group-review renderer; exceptionally complex artwork has the same rendering cost as other review previews. Font authoring remains planned in the ignored wiki product spec, without implementation claims.

Validation: production build passed; 64/64 unit tests and 83/83 production-browser tests passed (44.9s). Browser tests use disposable storage, including private fixtures when locally available. Owner artwork was not edited.
