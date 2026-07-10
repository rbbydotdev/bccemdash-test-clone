/**
 * Public-site client effects — ported from the original hand-built site
 * (research/reference-shots/original-index.html), now gated on
 * prefers-reduced-motion. Each effect no-ops when its target is absent, so this
 * one module runs on every page.
 *
 * Effects: scroll reveal, starfield canvas, count-up stats, hero parallax,
 * sticky/transparent header, mobile menu overlay, smooth-scroll anchors.
 */
const reduceMotion =
	typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── Scroll reveal ──────────────────────────────────────────────── */
function initReveal(): void {
	const els = Array.from(document.querySelectorAll<HTMLElement>("[data-animate]"));
	if (els.length === 0) return;
	if (reduceMotion || !("IntersectionObserver" in window)) {
		for (const el of els) el.classList.add("is-visible");
		return;
	}
	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (e.isIntersecting) {
					e.target.classList.add("is-visible");
					io.unobserve(e.target);
				}
			}
		},
		{ threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
	);
	for (const el of els) io.observe(el);
}

/* ── Starfield canvas ───────────────────────────────────────────── */
function initStarfield(): void {
	const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-starfield]");
	if (!canvas) return;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	interface Star { x: number; y: number; r: number; baseOpacity: number; speed: number; phase: number }
	let stars: Star[] = [];
	const COUNT = 180;

	function resize(): void {
		canvas!.width = window.innerWidth;
		canvas!.height = Math.max(window.innerHeight, canvas!.offsetHeight || 0);
	}
	function create(): void {
		stars = [];
		for (let i = 0; i < COUNT; i++) {
			stars.push({
				x: Math.random() * canvas!.width,
				y: Math.random() * canvas!.height,
				r: Math.random() * 1.8 + 0.2,
				baseOpacity: Math.random() * 0.5 + 0.2,
				speed: Math.random() * 0.8 + 0.2,
				phase: Math.random() * Math.PI * 2,
			});
		}
	}
	function draw(time: number): void {
		ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
		for (const s of stars) {
			const twinkle = Math.sin(time * 0.001 * s.speed + s.phase) * 0.35 + 0.65;
			ctx!.beginPath();
			ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
			ctx!.fillStyle = `rgba(200, 208, 224, ${s.baseOpacity * twinkle})`;
			ctx!.fill();
		}
		if (!reduceMotion) requestAnimationFrame(draw);
	}
	resize();
	create();
	if (reduceMotion) {
		draw(0); // one static frame
	} else {
		requestAnimationFrame(draw);
		window.addEventListener("resize", () => {
			resize();
			create();
		});
	}
}

/* ── Count-up stats ─────────────────────────────────────────────── */
function initCounters(): void {
	const els = Array.from(document.querySelectorAll<HTMLElement>("[data-counter]"));
	if (els.length === 0) return;

	const run = (el: HTMLElement): void => {
		const target = Number.parseFloat(el.dataset.counter ?? "0");
		const suffix = el.dataset.counterSuffix ?? "";
		const decimals = Number.parseInt(el.dataset.counterDecimals ?? "0", 10);
		const fmt = (n: number): string =>
			decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString("en-US");
		if (reduceMotion) {
			el.textContent = fmt(target) + suffix;
			return;
		}
		const duration = 2000;
		const start = performance.now();
		const step = (now: number): void => {
			const p = Math.min((now - start) / duration, 1);
			const eased = 1 - Math.pow(1 - p, 3);
			el.textContent = fmt(target * eased) + suffix;
			if (p < 1) requestAnimationFrame(step);
			else el.textContent = fmt(target) + suffix;
		};
		requestAnimationFrame(step);
	};

	if (!("IntersectionObserver" in window)) {
		for (const el of els) run(el);
		return;
	}
	const seen = new Set<Element>();
	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (e.isIntersecting && !seen.has(e.target)) {
					seen.add(e.target);
					setTimeout(() => run(e.target as HTMLElement), 400);
					io.unobserve(e.target);
				}
			}
		},
		{ threshold: 0.5 },
	);
	for (const el of els) io.observe(el);
}

/* ── Hero parallax ──────────────────────────────────────────────── */
function initParallax(): void {
	if (reduceMotion) return;
	const bg = document.querySelector<HTMLElement>("[data-hero-bg]");
	if (!bg) return;
	let ticking = false;
	window.addEventListener("scroll", () => {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(() => {
			const y = window.pageYOffset;
			if (y < window.innerHeight) bg.style.transform = `translateY(${y * 0.35}px) scale(1.1)`;
			ticking = false;
		});
	});
}

/* ── Sticky header + mobile menu + smooth scroll ────────────────── */
function initHeader(): void {
	const header = document.querySelector<HTMLElement>("[data-header]");
	if (header) {
		const onScroll = (): void => {
			if (window.pageYOffset > 80) header.classList.add("is-scrolled");
			else header.classList.remove("is-scrolled");
		};
		window.addEventListener("scroll", onScroll);
		onScroll();
	}

	const toggle = document.querySelector<HTMLButtonElement>("[data-menu-toggle]");
	const overlay = document.querySelector<HTMLElement>("[data-mobile-menu]");
	if (toggle && overlay) {
		const setOpen = (open: boolean): void => {
			toggle.setAttribute("aria-expanded", String(open));
			overlay.classList.toggle("is-open", open);
			header?.classList.toggle("is-menu-open", open);
			document.body.style.overflow = open ? "hidden" : "";
		};
		toggle.addEventListener("click", () =>
			setOpen(toggle.getAttribute("aria-expanded") !== "true"),
		);
		for (const link of Array.from(overlay.querySelectorAll("a")))
			link.addEventListener("click", () => setOpen(false));
	}

	for (const anchor of Array.from(
		document.querySelectorAll<HTMLAnchorElement>('a[href^="#"], a[href*="/#"]'),
	)) {
		anchor.addEventListener("click", (e: Event) => {
			const href = anchor.getAttribute("href") ?? "";
			const hash = href.includes("#") ? `#${href.split("#")[1]}` : "";
			if (!hash || hash === "#") return;
			const target = document.querySelector(hash);
			if (!target) return; // let cross-page links navigate normally
			e.preventDefault();
			const navH = header?.offsetHeight ?? 0;
			const top = target.getBoundingClientRect().top + window.pageYOffset - navH;
			window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
		});
	}
}

function init(): void {
	initReveal();
	initStarfield();
	initCounters();
	initParallax();
	initHeader();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
