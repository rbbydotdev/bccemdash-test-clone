# Reference shots — the visual target

Captured 2026-07-11 from the original hand-built design `../../../bcc/index.html`
(the "looked so good" source the WordPress theme was cloning). This is the
authoritative *visual* target; content/prices come from `../content-inventory.md`
(the WP prod dump — business tiers first, updated amounts, Zeffy links).

- `original-index.html` — verbatim copy of the original design (Tailwind CDN + one JS IIFE).
- `original-desktop-1440.png` — hero close-up at 1440w (starfield, milky-way bg, amber "Council", CTAs).
- `original-desktop-full.png` — full page at 1440w, all 8 scenes stacked (hero cap applied for capture):
  hero → story (stats) → mission (cycle) → devotions (tiers) → experiences → founder → trust → closing → footer.
- `original-mobile-390.png` — mobile hero at 390w.

Note: the original shows OLD individual prices ($250/$1,000/$5,000/$25,000+); the WP content is
authoritative ($500/$2,500/$5,000 individual draft, business $2,500/$10,000/$25K-$50K published).

To also render the actual WordPress theme locally (the *port*, which had documented regressions vs
this original — see `../../../bcc-wp/DESIGN_DIFF.md`): `cd ../../../bcc-wp && make docker` (needs Docker;
local images 404 due to dropped port — override img hosts to wordpress-bbkje.wasmer.app, or import a
prod dump). The original above is the cleaner target.
