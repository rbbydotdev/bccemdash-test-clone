# Bat City Council — design system ("Ritualistic Dusk")

Two sources: the ported WP theme tokens (`../bcc-wp/src/themes/bat-city-council/resources/css/app.css`,
authoritative for the token set) and the original hand-built site (`../bcc/index.html`, authoritative
for effects/JS). Aesthetic: dark, cinematic, moonlit; amber is candle, not neon; serif carries weight.

## Color tokens (Tailwind `@theme`)
```
--color-night:       #0A0E1A   /* primary background, near-black indigo */
--color-deep:        #111833   /* alternating section background */
--color-amber:       #D4A03C   /* accent / CTA warm gold */
--color-amber-light: #E8C060
--color-amber-dark:  #B8882A
--color-moon:        #C8D0E0   /* body text, soft silver-white */
--color-silver:      #8892A8   /* muted secondary */
```
Tier-accent ramp (per-card top bar): silver `#8892A8` → amber `#D4A03C` → light `#E8C060` → glow `#F0D890`.

## Typography
```
--font-display: "Cormorant Garamond", ui-serif, Georgia, serif;   /* headings */
--font-body:    "EB Garamond", ui-serif, Georgia, serif;          /* body, baseline 20px / 1.55 */
--font-accent:  "Josefin Sans", ui-sans-serif, system-ui, sans-serif; /* tracked uppercase labels */
```
Google Fonts: `Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500` +
`EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500` + `Josefin+Sans:wght@300;400;500;600;700`.
Configurable in CMS (Customizer offered 5 display / 4 body / 4 accent choices; see config/theme.php).

## Other tokens
- Easing signature: `--ease-cinematic: cubic-bezier(0.16, 1, 0.3, 1)` (everywhere).
- Spacing (fluid clamp): `--spacing-section-sm: clamp(3rem,6vw,4.5rem)`, `-md: clamp(4.5rem,8vw,7rem)`,
  `-lg: clamp(5.5rem,10vw,9rem)`, `--spacing-gutter: clamp(1.5rem,4vw,2.5rem)`.
- Radii: `--radius-card: 1rem`, `--radius-panel: 1.25rem`, `--radius-pill: 9999px`, `--radius-sm: 0.25rem`.
- Tracking: `--tracking-label: 0.25em`, `--tracking-eyebrow: 0.4em`, `--tracking-micro: 0.35em`.
- Widths: `--width-prose: 42rem`, `--width-shell: 80rem`.
- Shadows: `--shadow-amber-glow`, `-strong`, `--shadow-card-hover`, `--shadow-hero-overlay` (inset vignette), `--shadow-glint`.
- Blur: `--blur-glass: 24px` (header), `--blur-veil: 8px` (cards).
- Text gradient amber: `linear-gradient(135deg,#D4A03C,#E8C060,#D4A03C)` + `bg-clip-text` (used on
  "Council", "This Is Why.", "Conservation", "Night", "devotion.").
- Selection: `rgba(212,160,60,0.35)` bg / moon text. Scrollbar: 6px amber thumb.

## Sections (single-page home, anchors)
Order: Preloader → Header/nav → Hero → Story → Mission → Devotions → Experiences → Founder →
Trust(partners) → Closing CTA → Footer. Alternating `bg-night` / `bg-deep`. See `../bcc-wp/.../DESIGN.md`
for the full section-by-section brief (copy, layout, motion, a11y). Copy from content-inventory.md wins
where it differs.

Nav labels → anchors: Mission→#story (note: original quirk), Devotions→#devotions, Experiences→#experiences,
Founder→#founder, Contact→#footer, + amber "Devote Now" pill → devote URL (Zeffy). In the rebuild, wire
nav labels to their true sections (Story/Mission both real).

## Cinematic effects (port these; obey prefers-reduced-motion, which the original lacked)

**Starfield canvas** (`#starfield`, hero, z-1, pointer-events:none): 180 stars, r 0.2–2px, baseOpacity
0.2–0.7, twinkle `sin(time*0.001*speed+phase)*0.35+0.65`, color `rgba(200,208,224,opacity)`, redrawn via
rAF; regenerate on resize. Position static, only twinkles.

**Preloader** (`#preloader`, fixed z-9999 night bg, amber bat SVG floating + "Bat City Council" micro-label):
fade `.hidden` on window `load` + 800ms; opacity/visibility transition 1s. Bat float keyframe
`preload-float 2s`. Reduce-motion: no animation.

**Bat SVG path** (logo/preloader/footer): `M50 30 C45 15, 20 5, 2 20 C15 18, 25 22, 35 28 C38 20, 44 16,
50 14 C56 16, 62 20, 65 28 C75 22, 85 18, 98 20 C80 5, 55 15, 50 30Z` (fill amber). The WP theme also has a
"bat separator" block style drawing this silhouette between two amber taper lines.

**Scroll indicator**: a "mouse" outline SVG (rounded rect + inner circle) at hero bottom; wrapper floats
via `scroll-float 2.5s`, inner dot animates cy 10→22→10 + opacity via SMIL. Fades on scroll.

**Hero parallax**: bg pre-scaled `scale(1.1)`; on scroll (rAF-throttled, while `scrollY < innerHeight`)
`translateY(scrollY*0.35) scale(1.1)`. Hero gradient = downward night ramp 0.3→1.0.

**Reveal-on-scroll**: classes `.reveal/.reveal-left/.reveal-right/.reveal-scale` (opacity 0 + transform;
`translateY(50px)`, `translateX(±60px)`, `scale(0.88)`), `1s var(--ease-cinematic)`; IntersectionObserver
adds `.revealed` once (threshold 0.08, rootMargin `0px 0px -60px 0px`). Stagger via `.d1`–`.d8`
transition-delay 0.1–0.8s. Reduce-motion: show immediately.

**Count-up stats** (story: 1.5M bats, 140K+ tourists, 60M visitors): `data-target/-suffix/-decimals`;
IO threshold 0.5, 400ms delay, 2000ms ease-out-cubic `1-(1-p)^3`; integers `toLocaleString`, 1.5 keeps 1
decimal; append suffix. Text glow `text-shadow: 0 0 60px rgba(212,160,60,0.2)`.

**Trust marquee**: pure CSS `trust-scroll 25–30s linear infinite` translateX 0→-50%; content duplicated ×2;
pause on hover; partner names as low-contrast text (or logos when present), `•`/middot separators.

**Per-section noise**: `::before` fractalNoise SVG data-URI at 2.5% opacity, `mix-blend-mode: overlay`, on
story/mission/devotions/experiences/founder/closing. Plus a global grain overlay on `#app::before` (2.5%).

**Tier cards** (`.bcc-tier-card`): hover lift `-10px`, brighten border, amber glow shadow, reveal top
`--tier-accent` gradient bar. Individual tiers: click-to-expand perks (`max-height` / `<details>` grid-rows
accordion on mobile, always-open on desktop with `mt-auto` CTA alignment). Business tiers: always-visible.

**Experience cards** (`.bcc-exp-card`): full-bleed image, hover `scale(1.07–1.1)`, gradient deepens,
description slides up (opacity + translateY); signature badge top-right.

**Mission cycle**: 3 nodes (Commerce → Conservation → Culture) with pulsing arrows (`arrow-pulse 2s`),
Heroicons-style inline SVGs (building / globe / sparkles), "the cycle repeats" caption, Austin Bat Refuge
recipient callout.

**Header**: fixed, transparent over hero; `.scrolled` past 80px → `bg-night/92 blur(24px)` + shadow. Mobile
hamburger (3 amber bars → X) toggles full-screen `bg-night/98` overlay with staggered links; body scroll lock.
Smooth-scroll on `#` anchors offset by nav height.

**Buttons**: fill = amber bg / night text, radius 2px, Josefin 14px/600 tracked, hover lift + amber glow
`::before` blur(16px). Outline = transparent + moon/30 border, hover amber.

**Business-donor map**: MapLibre GL; amber markers (thumbnail/hybrid/ring styles), popups with night bg +
amber border + entry animation; a coordinate-resolver dialog for admin. Density/style pickers. One donor so
far (Torchy's Tacos, 30.2455,-97.7516).
