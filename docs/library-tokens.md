# Library tokens

Library properties own the shared thickness, corner radius and line-end radius. Values are in drawing-plane units. The Library tokens card defines local values or binds each property to a named token from a JSON file. Its overflow menu links/replaces a file, disconnects while retaining resolved values, or exports tokens. Linked fields are read-only; their selectors expose the token name.

Supported interchange is the numeric subset of the [DTCG 2025.10 format](https://www.designtokens.org/TR/2025.10/format/): named number tokens using `$value`, optional inherited `$type: number`, and curly-brace aliases. Dimension/color/composite tokens and JSON Pointer references are not implemented. Files may contain unrelated nonnumeric tokens. Example:

```json
{
  "icon": {
    "$type": "number",
    "thickness": {"$value": 1.6},
    "cornerRadius": {"$value": 0.5},
    "endRadius": {"$value": 0.5}
  }
}
```

A link stores the filename, embedded file contents and explicit bindings with the working library. Browser file selection does not continuously watch the disk: reselect the file to update. The embedded snapshot works after reload and transfer. Missing bound names, cyclic references and out-of-range drawing values reject before changing the library. Unbound properties remain locally defined.

JSON/ZIP libraries and named checkpoints retain `libraryProperties`. Import has an explicit Use imported library tokens checkbox, off by default; otherwise the destination library retains its token ownership. Tokens apply to all icons including subsequent imports, and geometry Reset preserves library tokens. Changes and disconnect participate in chronological Undo/Redo. Per-icon history restores geometry under the current library tokens.

An empty library can still define or link tokens. These edits have library-only Undo/Redo entries and never create placeholder icons. Empty checkpoints retain token values and file bindings when restored.
