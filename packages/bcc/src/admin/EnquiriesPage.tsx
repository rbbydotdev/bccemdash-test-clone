/**
 * /enquiries — inbox with status chips (new/replied/closed/spam), a detail
 * panel with the full message, a mailto reply link, and status transitions.
 */
import { Button, LinkButton, Loader, Pagination, Select, Table } from "@cloudflare/kumo";
import { X } from "@phosphor-icons/react";
import * as React from "react";

import {
	ENQUIRY_STATUSES,
	EnquiryStatusBadge,
	ErrorNotice,
	fmtDateTime,
	NoRows,
	PageHeader,
	pluginSend,
	usePagedList,
	type EnquiryDTO,
} from "./lib.js";

const statusItems = [
	{ label: "All statuses", value: "" },
	...ENQUIRY_STATUSES.map((s) => ({ label: s, value: s })),
];

export function EnquiriesPage() {
	const [status, setStatus] = React.useState("");
	const [selected, setSelected] = React.useState<EnquiryDTO | null>(null);

	const list = usePagedList<EnquiryDTO>("admin/enquiries", { status });

	return (
		<div className="space-y-6">
			<PageHeader title="Enquiries" subtitle="Messages from the website contact form" />

			<div className="w-40">
				<Select
					label="Status"
					size="sm"
					value={status}
					onValueChange={(v) => setStatus(v ?? "")}
					items={statusItems}
				/>
			</div>

			{list.error && <ErrorNotice message={list.error} />}

			<div className="flex items-start gap-6">
				<div className="min-w-0 flex-1 space-y-4">
					{list.loading ? (
						<div className="flex justify-center py-12">
							<Loader />
						</div>
					) : list.rows.length === 0 ? (
						<NoRows title="No enquiries" description="No enquiries match the current filter." />
					) : (
						<div className="overflow-x-auto">
							<Table>
								<Table.Header>
									<Table.Row>
										<Table.Head>From</Table.Head>
										<Table.Head>Message</Table.Head>
										<Table.Head>Subject</Table.Head>
										<Table.Head>Status</Table.Head>
										<Table.Head>Received</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{list.rows.map((e) => (
										<Table.Row
											key={e.id}
											variant={selected?.id === e.id ? "selected" : "default"}
											className="cursor-pointer"
											onClick={() => setSelected(e)}
										>
											<Table.Cell>
												<div className="font-medium">{e.name}</div>
												<div className="text-kumo-subtle text-xs">{e.email}</div>
											</Table.Cell>
											<Table.Cell className="max-w-xs truncate">{e.message}</Table.Cell>
											<Table.Cell className="max-w-xs truncate">{e.subject ?? ""}</Table.Cell>
											<Table.Cell>
												<EnquiryStatusBadge status={e.status} />
											</Table.Cell>
											<Table.Cell className="whitespace-nowrap">
												{fmtDateTime(e.createdAt)}
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table>
						</div>
					)}

					{list.total > list.perPage && (
						<Pagination
							page={list.page}
							perPage={list.perPage}
							totalCount={list.total}
							setPage={list.setPage}
						/>
					)}
				</div>

				{selected && (
					<EnquiryDrawer
						enquiry={selected}
						onClose={() => setSelected(null)}
						onChanged={(updated) => {
							setSelected(updated);
							list.reload();
						}}
					/>
				)}
			</div>
		</div>
	);
}

function EnquiryDrawer({
	enquiry,
	onClose,
	onChanged,
}: {
	enquiry: EnquiryDTO;
	onClose: () => void;
	onChanged: (updated: EnquiryDTO) => void;
}) {
	const [error, setError] = React.useState<string | null>(null);
	const [busy, setBusy] = React.useState(false);

	const setStatus = async (status: string) => {
		setBusy(true);
		setError(null);
		try {
			const updated = await pluginSend<EnquiryDTO>("admin/enquiries/item", "PATCH", {
				id: enquiry.id,
				status,
			});
			onChanged(updated);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to update enquiry");
		} finally {
			setBusy(false);
		}
	};

	const mailto = `mailto:${enquiry.email}?subject=${encodeURIComponent(
		`Re: ${enquiry.subject ?? "your message to Bat City Council"}`,
	)}`;

	return (
		<div className="border-kumo-line bg-kumo-base w-96 shrink-0 space-y-4 self-start rounded-lg border p-4">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold">Enquiry</h3>
				<Button variant="ghost" shape="square" size="sm" onClick={onClose} aria-label="Close detail">
					<X className="h-4 w-4" />
				</Button>
			</div>

			{error && <ErrorNotice message={error} />}

			<div className="space-y-1 text-sm">
				<div className="flex items-center justify-between gap-2">
					<span className="font-medium">{enquiry.name}</span>
					<EnquiryStatusBadge status={enquiry.status} />
				</div>
				<div className="text-kumo-subtle">{enquiry.email}</div>
				<div className="text-kumo-subtle text-xs">{fmtDateTime(enquiry.createdAt)}</div>
				{enquiry.subject && <div className="text-kumo-subtle text-xs">Subject: {enquiry.subject}</div>}
				{enquiry.source && <div className="text-kumo-subtle text-xs">Source: {enquiry.source}</div>}
			</div>

			<p className="border-kumo-line rounded-lg border p-3 text-sm leading-relaxed break-words">
				{enquiry.message}
			</p>

			<div className="flex flex-wrap items-center gap-2">
				<LinkButton size="sm" href={mailto} external>
					Reply by email
				</LinkButton>
				{enquiry.status !== "replied" && (
					<Button size="sm" variant="secondary" disabled={busy} onClick={() => void setStatus("replied")}>
						Mark replied
					</Button>
				)}
				{enquiry.status !== "closed" && (
					<Button size="sm" variant="secondary" disabled={busy} onClick={() => void setStatus("closed")}>
						Close
					</Button>
				)}
				{enquiry.status !== "spam" && (
					<Button size="sm" variant="ghost" disabled={busy} onClick={() => void setStatus("spam")}>
						Spam
					</Button>
				)}
				{enquiry.status !== "new" && (
					<Button size="sm" variant="ghost" disabled={busy} onClick={() => void setStatus("new")}>
						Reopen
					</Button>
				)}
			</div>
		</div>
	);
}
