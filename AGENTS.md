# Repository Guidelines

## Project Structure & Module Organization

`editor.html` is the entire Glyph Workbench application: inline CSS, HTML controls, a Paper.js-based glyph geometry core, embedded icon libraries and thumbnails, and editor logic. There are no separate source, test, or asset directories. Keep changes scoped to the relevant section; avoid rewriting the large embedded `LIBRARY`, `QUIX`, and `THUMBS` datasets incidentally.

## Build, Test, and Development Commands

- `python3 -m http.server 8000 --bind 127.0.0.1`: serve this directory locally; open `http://127.0.0.1:8000/editor.html`.
- `open editor.html`: launch the page directly on macOS for a quick check. Prefer the local server for repeatable browser-storage testing.

No compilation, package installation, build script, lint command, or automated test runner is configured. Paper.js 0.12.18 loads from a CDN, and fonts load from Google Fonts; network access is needed for those resources.

## Coding Style & Naming Conventions

Match surrounding code: two-space indentation for nested blocks, semicolons, `const` by default, and `let` for reassignment. Use camelCase for functions and variables, uppercase names for shared constants, and kebab-case CSS classes and custom properties. Reuse theme variables such as `--accent` instead of hardcoding interface colors. Preserve accessible labels, keyboard controls, and focus indicators. No formatter or linter configuration is present; keep formatting changes local.

## Testing Guidelines

Validation is currently manual; no coverage threshold or test naming convention is established. After relevant changes, check:

- Library search/filtering, glyph selection, shape editing, and layer operations.
- Undo/redo, symmetry, transforms, and SVG previews/export.
- JSON library export/import and saved edits after reload.
- Light/dark themes, keyboard navigation, and browser-console errors.

Use a disposable browser profile for persistence tests and export valuable edits first. Wait for `window.__gw.ready` before using the exposed debugging helpers.

## Commit & Pull Request Guidelines

This directory has no Git metadata, so historical commit conventions cannot be verified. If contributing through Git, use concise imperative subjects, for example `Fix mirrored glyph selection`. Keep changes focused. PR descriptions should explain the behavior changed, list manual checks and browser used, link relevant issues, and include before/after screenshots for visual changes. Preserve embedded library provenance and document intentional dataset or dependency updates.
