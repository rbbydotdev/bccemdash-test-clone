/**
 * /enquiries — inbox with status chips (new/replied/closed/spam), a detail
 * panel with the full message, a mailto reply link, and status transitions.
 */
import { Button, Checkbox, LinkButton, Loader, Pagination, Select, Table } from "@cloudflare/kumo";
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
	const [checked, setChecked] = React.useState<Set<string>>(new Set());
	const [busy, setBusy] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const list = usePagedList<EnquiryDTO>("admin/enquiries", { status });

	// Drop selections for rows that are no longer on screen (filter/page change).
	const visibleIds = list.rows.map((r) => r.id);
	React.useEffect(() => {
		setChecked((prev) => {
			const next = new Set([...prev].filter((id) => visibleIds.includes(id)));
			return next.size === prev.size ? prev : next;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visibleIds.join(",")]);

	const allChecked = list.rows.length > 0 && checked.size === list.rows.length;
	const someChecked = checked.size > 0 && !allChecked;

	const toggleAll = () =>
		setChecked(allChecked ? new Set() : new Set(visibleIds));

	const toggleOne = (id: string) =>
		setChecked((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	const runDelete = async (body: unknown, confirmMsg: string) => {
		if (!window.confirm(confirmMsg)) return;
		setBusy(true);
		setError(null);
		try {
			const res = await pluginSend<{ deleted: number }>("admin/enquiries/delete", "POST", body);
			if (selected && (body as { all?: boolean }).all) setSelected(null);
			else if (selected && checked.has(selected.id)) setSelected(null);
			setChecked(new Set());
			list.reload();
			return res;
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete enquiries");
		} finally {
			setBusy(false);
		}
	};

	const deleteSelected = () =>
		void runDelete(
			{ ids: [...checked] },
			`Permanently delete ${checked.size} enquir${checked.size === 1 ? "y" : "ies"}? This cannot be undone.`,
		);

	const deleteAll = () =>
		void runDelete(
			status ? { all: true, status } : { all: true },
			status
				? `Permanently delete ALL enquiries with status "${status}"? This cannot be undone.`
				: "Permanently delete ALL enquiries? This cannot be undone.",
		);

	return (
		<div className="space-y-6">
			<PageHeader title="Enquiries" subtitle="Messages from the website contact form" />

			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="w-40">
					<Select
						label="Status"
						size="sm"
						value={status}
						onValueChange={(v) => setStatus(v ?? "")}
						items={statusItems}
					/>
				</div>

				<div className="flex items-center gap-2">
					{checked.size > 0 && (
						<Button size="sm" variant="secondary" disabled={busy} onClick={deleteSelected}>
							Delete selected ({checked.size})
						</Button>
					)}
					{list.total > 0 && (
						<Button size="sm" variant="ghost" disabled={busy} onClick={deleteAll}>
							{status ? `Delete all "${status}"` : "Delete all"}
						</Button>
					)}
				</div>
			</div>

			{error && <ErrorNotice message={error} />}
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
										<Table.Head className="w-10">
											<Checkbox
												aria-label={allChecked ? "Deselect all" : "Select all"}
												checked={allChecked}
												indeterminate={someChecked}
												onCheckedChange={toggleAll}
											/>
										</Table.Head>
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
											{/* stopPropagation so ticking a row doesn't also open the drawer */}
											<Table.Cell onClick={(ev) => ev.stopPropagation()}>
												<Checkbox
													aria-label={`Select enquiry from ${e.name}`}
													checked={checked.has(e.id)}
													onCheckedChange={() => toggleOne(e.id)}
												/>
											</Table.Cell>
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
