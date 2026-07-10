/**
 * DonorMap — a MapLibre map of devoting businesses. Amber DOM markers (so the
 * dark canvas filter never touches them) with hover/focus popups. Hydrated as
 * a client:visible island; data comes in as a prop resolved server-side.
 */
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as React from "react";

export interface Donor {
	title: string;
	lat: number;
	lng: number;
	url?: string;
	logo?: string | null;
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export default function DonorMap({ donors }: { donors: Donor[] }) {
	const ref = React.useRef<HTMLDivElement | null>(null);

	React.useEffect(() => {
		if (!ref.current || donors.length === 0) return;
		const map = new maplibregl.Map({
			container: ref.current,
			style: STYLE_URL,
			center: [donors[0]!.lng, donors[0]!.lat],
			zoom: 11,
			attributionControl: { compact: true },
		});
		map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

		const bounds = new maplibregl.LngLatBounds();
		for (const d of donors) {
			bounds.extend([d.lng, d.lat]);
			const el = document.createElement("button");
			el.type = "button";
			el.className = "bcc-donor-marker";
			el.setAttribute("aria-label", d.title);
			el.innerHTML = d.logo
				? `<span class="bcc-donor-thumb" style="background-image:url('${d.logo}')"></span>`
				: `<span class="bcc-donor-dot"></span>`;

			const popup = new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(
				`<div class="bcc-donor-popup"><strong>${d.title}</strong>${
					d.url ? `<a href="${d.url}" target="_blank" rel="noopener">Visit</a>` : ""
				}</div>`,
			);
			const marker = new maplibregl.Marker({ element: el }).setLngLat([d.lng, d.lat]).setPopup(popup).addTo(map);
			el.addEventListener("mouseenter", () => marker.togglePopup());
			el.addEventListener("mouseleave", () => marker.getPopup()?.remove());
			el.addEventListener("focus", () => marker.togglePopup());
		}
		if (donors.length > 1) map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 0 });

		return () => map.remove();
	}, [donors]);

	if (donors.length === 0) return null;

	return <div ref={ref} className="bcc-donor-map h-[420px] w-full" aria-label="Map of devoting businesses" />;
}
