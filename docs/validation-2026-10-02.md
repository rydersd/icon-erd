# Publication and stroke rounding — 2026-10-02

- Public MIT application repository: https://github.com/rydersd/icon-erd, default branch `main`.
- Application source commit: `8802eef4735a12a3ae1dfe977f214fb06599ca9b`.
- Cloudflare Workers static-assets deployment: https://icon-erd.ryder-2b2.workers.dev/.
- Cloudflare version: `835d0bdc-5d19-40dc-9ad2-dedd302fa796`.

Positive library corner rounding now applies round stroke joins and end caps to the canvas, isolated-object display, previews, thumbnails, runtime SVG and baked SVG (also used for PNG output). It overrides per-path caps and runtime cap/join selections while enabled. Disabling rounding restores those choices; source nodes are not rewritten. The radius still controls path-corner geometry; standard round caps have radius half the stroke width.

## Verification

- A new export regression failed against the previous behavior, then passed after the fix.
- `npm test`: 15 tests passed.
- `npm run build`: static export completed.
- `npm run test:browser`: seven Chromium tests passed locally, including private-pack import and rounding enable/disable checks.
- The targeted rounding browser test passed against the live Cloudflare site. This is one hosted test, not a full hosted-suite result.
- All ten referenced live HTML/JS/CSS resources matched the tested local build byte for byte.
- Live `/imports/illtool-icons.json`, `/imports/equinix-icons.json` and `/.DS_Store` returned 404.
- GitHub reported the repository as PUBLIC, and remote `main` matched the source commit. No local artwork packs, generated builds, browser artifacts, environment files or Wrangler credentials were staged. A staged credential-signature scan found no matches.

Deployment currently uses authenticated `npm run deploy` from a checkout. Automatic deployments on GitHub pushes are not configured. The earlier validation report remains a historical record of the first deployment.
