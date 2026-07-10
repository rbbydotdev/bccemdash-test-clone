# Research & source analysis

Backing for every decision in [../PLAN.md](../PLAN.md) and [../ARCHITECTURE.md](../ARCHITECTURE.md).
Generated 2026-07-11 from the Bat City Council WordPress source (`../../bcc-wp`), the original hand-built
design (`../../bcc/index.html`), and the prior `../../1foobar → ../../emdashtv` conversion.

- [`content-inventory.md`](content-inventory.md) — exact content records, media, and settings from the
  latest prod DB dump (`../../bcc-wp/backups/prod-20260710-183605Z-b39a09e.sql.gz`). **Migration source of
  truth.** Tiers, experiences, partners, business donors, programs, pages/posts, site options.
- [`design-system.md`](design-system.md) — "Ritualistic Dusk" tokens (colors, fonts, easing, spacing,
  shadows) and the cinematic effects spec (starfield, preloader, reveals, count-up, marquee, parallax,
  tier/experience hover, mission cycle, header, buttons, donor map) with verbatim implementations.
- [`emdash-reference.md`](emdash-reference.md) — condensed "how to build on emdash" from the emdashtv
  conversion: workspace/config, seed.json format, native-plugin contract, Kysely migrator/repo pattern,
  theme package, deploy, patches.
- [`user-directives.md`](user-directives.md) — standing client + process rules to honor (no em dashes,
  business-tiers-first, Zeffy, non-technical-client editability, deploy discipline, repo-pattern-over-ORM).

Deeper source docs (read-only, outside this repo): `../../bcc-wp/src/themes/bat-city-council/DESIGN.md`
(section-by-section brief), `.../resources/css/app.css` (full token set), `../../bcc/website-spec.md`
(client handoff spec), `../../emdashtv/{PLAN,ARCHITECTURE}.md` (reference conversion).
