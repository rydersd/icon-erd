# Icon organization and usage evidence

## Implemented foundation

Each icon can have one `group` (a slash-separated path), multiple `tags`, a description, and aliases. Primary groups drive library sections and exported folders. Name-based suggestions are explicitly labeled and reversible. Existing EDS import records contain names, provenance and geometry-comparison scores; they do not carry component or product-usage taxonomy. This does not establish what taxonomy might exist elsewhere in the design system.

ZIP exports carry editable `library.json` and an `organization.json` map. The latter contains icon names, primary groups, tags, SVG paths and slash-separated Figma component names. Actual product usage may span several groups: keep a single canonical export location and use tags/evidence for other contexts, rather than duplicating the same icon in several folders.

## Proposed usage hooks

Do not send source code to a model just because an icon is imported. A user-selected project collector should emit a local usage report: project/revision, icon key, file and line, component, route or experience, prop/context, and whether the reference was directly resolved or inferred. Parse imports, JSX and explicit icon registries first; unresolved dynamic lookups remain unresolved. Optional Storybook/route screenshots can add visual context.

Export a small metadata bundle plus that report to an LLM. Ask it for proposals containing icon identity, proposed primary group, tags, rationale, supporting evidence references, confidence and unresolved questions. Keep visual layer naming (Head of Arrow, Shaft of Arrow) separate from library categories. Never treat a filename match as proof of component usage.

The app should offer a metadata-only proposal import with a review diff, counts, evidence links, manual adjustments and an apply/undo step. It must match identities, reject unknown/duplicate identities and update only group/tags/usage metadata; it must not replace geometry or reset originals. This review hook and source collector are future work, not current features. Stable icon IDs independent of rename should precede cross-project reports.

## Proposed Figma bridge

A small Figma Design plugin can read the ZIP manifest and SVGs, create a section/frame for each primary group and one component per icon, with names such as `Navigation/Arrows/arrow-right`. Use the Plugin API SVG import and component creation methods; preserve metadata in plugin data. Imported SVG layers will need their own fidelity check: the manifest preserves library organization, not a guarantee that every internal parametric/boolean layer survives SVG import with identical editability.

Preserve icon identity in plugin data for a later explicit update action. Never create a component set merely because icons share a category; component sets are appropriate for real variants such as style or size. Direct Figma publishing is not implemented. API references: https://developers.figma.com/docs/plugins/api/figma/ and https://developers.figma.com/docs/plugins/api/properties/figma-createcomponentfromnode/.
