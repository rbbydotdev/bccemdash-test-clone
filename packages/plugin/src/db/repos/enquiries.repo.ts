/**
 * Enquiries repository — contact-form submissions.
 * Status lifecycle: new → replied → closed (or spam).
 */
import { sql, type SqlBool } from "kysely";
import { ulid } from "ulidx";

import { escapeLike, listRows, type Filter, type ListResult } from "../crud.js";
import type { BccDb } from "../types.js";

export const ENQUIRY_STATUSES = ["new", "replied", "closed", "spam"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export interface EnquiryRow {
	id: string;
	name: string;
	email: string;
	message: string;
	subject: string | null;
	source: string | null;
	status: string;
	ip: string | null;
	user_agent: string | null;
	created_at: string;
	updated_at: string;
}

export interface EnquiryDTO {
	id: string;
	name: string;
	email: string;
	message: string;
	subject: string | null;
	source: string | null;
	status: string;
	createdAt: string;
	updatedAt: string;
}

export function toEnquiryDTO(row: EnquiryRow): EnquiryDTO {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		message: row.message,
		subject: row.subject,
		source: row.source,
		status: row.status,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export const ENQUIRY_SORTS = ["created_at", "status", "name"] as const;

export interface CreateEnquiryInput {
	name: string;
	email: string;
	message: string;
	subject?: string | null;
	source?: string | null;
	ip?: string | null;
	userAgent?: string | null;
}

export async function createEnquiry(db: BccDb, input: CreateEnquiryInput): Promise<EnquiryRow> {
	const id = ulid();
	await db
		.insertInto("enquiries")
		.values({
			id,
			name: input.name,
			email: input.email,
			message: input.message,
			subject: input.subject ?? null,
			source: input.source ?? null,
			ip: input.ip ?? null,
			user_agent: input.userAgent ?? null,
		})
		.execute();
	const row = await getEnquiryById(db, id);
	if (!row) throw new Error("enquiry insert failed");
	return row;
}

export async function getEnquiryById(db: BccDb, id: string): Promise<EnquiryRow | null> {
	const row = await db.selectFrom("enquiries").selectAll().where("id", "=", id).executeTakeFirst();
	return row ?? null;
}

export interface EnquiryListQuery {
	status?: string | undefined;
	search?: string | undefined;
	sort?: string | undefined;
	order?: string | undefined;
	limit?: number | undefined;
	offset?: number | undefined;
}

export async function listEnquiries(
	db: BccDb,
	query: EnquiryListQuery,
): Promise<ListResult<EnquiryDTO>> {
	const where: Filter[] = [];
	if (query.status) where.push(sql<SqlBool>`status = ${query.status}`);
	if (query.search) {
		const like = `%${escapeLike(query.search)}%`;
		where.push(
			sql<SqlBool>`(name LIKE ${like} ESCAPE '\\' OR email LIKE ${like} ESCAPE '\\' OR message LIKE ${like} ESCAPE '\\')`,
		);
	}
	return listRows<EnquiryRow, EnquiryDTO>(
		db,
		{ where, sort: query.sort, order: query.order, limit: query.limit, offset: query.offset },
		{
			table: "enquiries",
			allowedSorts: ENQUIRY_SORTS,
			defaultSort: "created_at",
			hydrate: toEnquiryDTO,
		},
	);
}

export async function updateEnquiryStatus(
	db: BccDb,
	id: string,
	status: EnquiryStatus,
): Promise<EnquiryRow | null> {
	await db
		.updateTable("enquiries")
		.set({ status, updated_at: new Date().toISOString() })
		.where("id", "=", id)
		.execute();
	return getEnquiryById(db, id);
}

/**
 * Permanently delete enquiries by id. Returns how many rows were removed.
 * Chunked so a large selection stays under SQLite/D1's bind-parameter limit.
 */
export async function deleteEnquiries(db: BccDb, ids: string[]): Promise<number> {
	if (ids.length === 0) return 0;
	const CHUNK = 100;
	let removed = 0;
	for (let i = 0; i < ids.length; i += CHUNK) {
		const batch = ids.slice(i, i + CHUNK);
		const res = await db.deleteFrom("enquiries").where("id", "in", batch).executeTakeFirst();
		removed += Number(res?.numDeletedRows ?? 0);
	}
	return removed;
}

/**
 * Delete every enquiry, optionally limited to one status so "delete all" can
 * respect the inbox's active filter. Returns how many rows were removed.
 */
export async function deleteAllEnquiries(db: BccDb, status?: EnquiryStatus): Promise<number> {
	let q = db.deleteFrom("enquiries");
	if (status) q = q.where("status", "=", status);
	const res = await q.executeTakeFirst();
	return Number(res?.numDeletedRows ?? 0);
}

/** Count enquiries by status (dashboard widget / stats). */
export async function countEnquiriesByStatus(db: BccDb): Promise<Record<string, number>> {
	const rows = await db
		.selectFrom("enquiries")
		.select(["status", sql<number>`count(*)`.as("n")])
		.groupBy("status")
		.execute();
	const out: Record<string, number> = {};
	for (const r of rows) out[r.status] = Number(r.n);
	return out;
}

/** Most recent enquiries (for the admin dashboard widget). */
export async function recentEnquiries(db: BccDb, limit = 5): Promise<EnquiryDTO[]> {
	const rows = await db
		.selectFrom("enquiries")
		.selectAll()
		.orderBy("created_at", "desc")
		.limit(Math.min(Math.max(limit, 1), 20))
		.execute();
	return rows.map(toEnquiryDTO);
}
