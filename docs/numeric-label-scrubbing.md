# Numeric label scrubbing

Drag a numeric field's label horizontally: four pixels changes one field step. Shift changes the next larger digit (10× that step), including when pressed midway through a drag. Clicking focuses the field for typing; native keyboard editing remains available. Bounds and disabled/read-only controls are respected. Cleanup keeps its unbounded upper range.

Inspector values preview geometry during the gesture and commit once on release. Other controls preview their numeric value and apply on release, avoiding repeated library-wide publication and stale dynamic studio callbacks. Escape or pointer cancellation restores the original value without adding history. Preference controls remain independent of document Undo. Color-row labels scrub their numeric opacity control.

Adversarial self-review: attacked click focus after pointer capture, Escape while live inspector geometry had changed, gesture-level Undo, persisted tolerance above five, bounded merge distance, and dynamic gradient controls which rebuild on change. Added physical browser coverage. Reviewed step-base rounding to respect native min/step constraints and rejected arithmetic overflow. No independent reviewer or configured GitHub CI is claimed. Residual limitation: studio gradients and library settings apply on release rather than repainting during every pointer move.
