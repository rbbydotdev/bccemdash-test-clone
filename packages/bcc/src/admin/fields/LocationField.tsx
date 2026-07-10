/**
 * bcc:location — map point picker for `json` fields storing
 * `{ lat: number, lng: number, address?: string }`.
 *
 * The client searches an address (our /admin/geocode route → OpenStreetMap
 * Nominatim), clicks the map or drags the pin to fine-tune, and coordinates
 * fill themselves in. Manual lat/lng inputs remain as a fallback. Non-technical
 * clients never have to type raw coordinates.
 */
import { Button, Input, Label, Loader } from "@cloudflare/kumo";
import { MagnifyingGlass } from "@phosphor-icons/react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as React from "react";

import { pluginGet, type GeocodeResult } from "../lib.js";
import type { FieldWidgetProps } from "./types.js";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// Austin, TX default view when the field is empty.
const DEFAULT_CENTER: [number, number] = [-97.7431, 30.2672];
const DEFAULT_ZOOM = 11;

interface LocationValue {
	lat: number;
	lng: number;
	address?: string;
}

function toLocation(value: unknown): LocationValue | null {
	if (value == null || typeof value !== "object") return null;
	const v = value as Record<string, unknown>;
	if (typeof v.lat !== "number" || typeof v.lng !== "number") return null;
	return { lat: v.lat, lng: v.lng, address: typeof v.address === "string" ? v.address : undefined };
}

export function LocationField({ value, onChange, label, id }: FieldWidgetProps) {
	const loc = toLocation(value);
	const mapContainer = React.useRef<HTMLDivElement | null>(null);
	const mapRef = React.useRef<maplibregl.Map | null>(null);
	const markerRef = React.useRef<maplibregl.Marker | null>(null);

	const [query, setQuery] = React.useState("");
	const [searching, setSearching] = React.useState(false);
	const [hits, setHits] = React.useState<GeocodeResult[]>([]);
	const [error, setError] = React.useState<string | null>(null);

	// Keep the latest onChange without re-initialising the map.
	const onChangeRef = React.useRef(onChange);
	onChangeRef.current = onChange;

	const setPoint = React.useCallback((lat: number, lng: number, address?: string) => {
		onChangeRef.current({ lat, lng, ...(address ? { address } : {}) });
	}, []);

	// Init map once.
	React.useEffect(() => {
		if (!mapContainer.current || mapRef.current) return;
		const start = loc ? ([loc.lng, loc.lat] as [number, number]) : DEFAULT_CENTER;
		const map = new maplibregl.Map({
			container: mapContainer.current,
			style: STYLE_URL,
			center: start,
			zoom: loc ? 14 : DEFAULT_ZOOM,
		});
		map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
		const marker = new maplibregl.Marker({ color: "#D4A03C", draggable: true });
		if (loc) marker.setLngLat([loc.lng, loc.lat]).addTo(map);
		marker.on("dragend", () => {
			const { lat, lng } = marker.getLngLat();
			setPoint(lat, lng);
		});
		map.on("click", (e) => {
			marker.setLngLat(e.lngLat).addTo(map);
			setPoint(e.lngLat.lat, e.lngLat.lng);
		});
		mapRef.current = map;
		markerRef.current = marker;
		return () => {
			map.remove();
			mapRef.current = null;
			markerRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- init once
	}, []);

	// Reflect external value changes onto the marker/map.
	React.useEffect(() => {
		const map = mapRef.current;
		const marker = markerRef.current;
		if (!map || !marker || !loc) return;
		marker.setLngLat([loc.lng, loc.lat]).addTo(map);
	}, [loc?.lat, loc?.lng]);

	const runSearch = async () => {
		if (query.trim().length < 3) return;
		setSearching(true);
		setError(null);
		setHits([]);
		try {
			const { results } = await pluginGet<{ results: GeocodeResult[] }>(
				`admin/geocode?q=${encodeURIComponent(query.trim())}`,
			);
			setHits(results);
			if (results.length === 0) setError("No matches found.");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Search failed");
		} finally {
			setSearching(false);
		}
	};

	const pick = (hit: GeocodeResult) => {
		setPoint(hit.lat, hit.lng, hit.label);
		setHits([]);
		setQuery(hit.label);
		const map = mapRef.current;
		if (map) map.flyTo({ center: [hit.lng, hit.lat], zoom: 15 });
	};

	return (
		<div className="space-y-2" id={id}>
			<Label>{label}</Label>

			<div className="flex gap-2">
				<Input
					size="sm"
					placeholder="Search an address or place…"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							void runSearch();
						}
					}}
				/>
				<Button size="sm" variant="secondary" onClick={() => void runSearch()} disabled={searching}>
					{searching ? <Loader size="sm" /> : <MagnifyingGlass className="h-4 w-4" />}
				</Button>
			</div>

			{error && <p className="text-kumo-danger text-xs">{error}</p>}

			{hits.length > 0 && (
				<ul className="border-kumo-line divide-kumo-line max-h-40 divide-y overflow-y-auto rounded-lg border text-sm">
					{hits.map((hit, i) => (
						<li key={i}>
							<button
								type="button"
								className="hover:bg-kumo-muted w-full px-3 py-2 text-left"
								onClick={() => pick(hit)}
							>
								{hit.label}
							</button>
						</li>
					))}
				</ul>
			)}

			<div ref={mapContainer} className="border-kumo-line h-64 w-full overflow-hidden rounded-lg border" />

			<div className="flex gap-2">
				<Input
					size="sm"
					label="Latitude"
					value={loc ? String(loc.lat) : ""}
					onChange={(e) => {
						const lat = Number(e.target.value);
						if (Number.isFinite(lat)) setPoint(lat, loc?.lng ?? DEFAULT_CENTER[1], loc?.address);
					}}
				/>
				<Input
					size="sm"
					label="Longitude"
					value={loc ? String(loc.lng) : ""}
					onChange={(e) => {
						const lng = Number(e.target.value);
						if (Number.isFinite(lng)) setPoint(loc?.lat ?? DEFAULT_CENTER[0], lng, loc?.address);
					}}
				/>
			</div>
			<p className="text-kumo-subtle text-xs">
				Search for the business, or click the map to drop the pin. The map on the site uses these
				coordinates.
			</p>
		</div>
	);
}
