/**
 * Dashboard widgets over GET admin/stats.
 * Titles come from the adminWidgets declaration; components render body only.
 */
import { Loader } from "@cloudflare/kumo";
import * as React from "react";

import { EnquiryStatusBadge, fmtDateTime, pluginGet, type EnquiryDTO } from "./lib.js";

interface BccStats {
	byStatus: Record<string, number>;
	recent: EnquiryDTO[];
}

export function RecentEnquiriesWidget() {
	const [stats, setStats] = React.useState<BccStats | null>(null);
	const [loading, setLoading] = React.useState(true);

	React.useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const data = await pluginGet<BccStats>("admin/stats");
				if (!cancelled) setStats(data);
			} catch {
				// widget stays empty on error
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	if (loading) {
		return (
			<div className="flex justify-center py-4">
				<Loader />
			</div>
		);
	}
	if (!stats || stats.recent.length === 0) {
		return <p className="text-kumo-subtle text-sm">No enquiries yet.</p>;
	}

	return (
		<ul className="divide-kumo-line divide-y text-sm">
			{stats.recent.map((e) => (
				<li key={e.id} className="flex items-center justify-between gap-3 py-2">
					<div className="min-w-0">
						<div className="truncate font-medium">{e.name}</div>
						<div className="text-kumo-subtle truncate text-xs">{e.subject ?? e.message}</div>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<EnquiryStatusBadge status={e.status} />
						<span className="text-kumo-subtle text-xs whitespace-nowrap">{fmtDateTime(e.createdAt)}</span>
					</div>
				</li>
			))}
		</ul>
	);
}
