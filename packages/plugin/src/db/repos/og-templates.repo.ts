/** Saved social-card scenes (the OG editor's documents). */
import { ulid } from "ulidx";

import type { BccDb } from "../types.js";

export interface OgTemplateDTO {
	id: string;
	name: string;
	/** Parsed scene document. */
	scene: unknown;
	isActive: boolean;
	updatedAt: string;
}

interface Row {
	id: string;
	name: string;
	scene: string;
	is_active: number;
	updated_at: string;
}

function toDTO(row: Row): OgTemplateDTO {
	let scene: unknown = null;
	try {
		scene = JSON.parse(row.scene);
	} catch {
		// A corrupt row shouldn't break the list — surface it with an empty scene
		// so the client can still see and delete it.
		scene = { layers: [] };
	}
	return { id: row.id, name: row.name, scene, isActive: row.is_active === 1, updatedAt: row.updated_at };
}

export async function listOgTemplates(db: BccDb): Promise<OgTemplateDTO[]> {
	const rows = await db
		.selectFrom("og_templates")
		.select(["id", "name", "scene", "is_active", "updated_at"])
		.orderBy("updated_at", "desc")
		.execute();
	return rows.map((r) => toDTO(r as Row));
}

export async function getActiveOgTemplate(db: BccDb): Promise<OgTemplateDTO | null> {
	const row = await db
		.selectFrom("og_templates")
		.select(["id", "name", "scene", "is_active", "updated_at"])
		.where("is_active", "=", 1)
		.executeTakeFirst();
	return row ? toDTO(row as Row) : null;
}

export async function saveOgTemplate(
	db: BccDb,
	input: { id?: string; name: string; scene: unknown },
): Promise<OgTemplateDTO> {
	const now = new Date().toISOString();
	const scene = JSON.stringify(input.scene ?? { layers: [] });

	if (input.id) {
		await db
			.updateTable("og_templates")
			.set({ name: input.name, scene, updated_at: now })
			.where("id", "=", input.id)
			.execute();
		const row = await db
			.selectFrom("og_templates")
			.select(["id", "name", "scene", "is_active", "updated_at"])
			.where("id", "=", input.id)
			.executeTakeFirst();
		if (row) return toDTO(row as Row);
	}

	const id = input.id ?? ulid();
	await db
		.insertInto("og_templates")
		.values({ id, name: input.name, scene, is_active: 0, created_at: now, updated_at: now })
		.execute();
	return { id, name: input.name, scene: input.scene, isActive: false, updatedAt: now };
}

/** Make one template the site card. Clears the flag elsewhere (single active). */
export async function setActiveOgTemplate(db: BccDb, id: string): Promise<void> {
	await db.updateTable("og_templates").set({ is_active: 0 }).execute();
	await db.updateTable("og_templates").set({ is_active: 1 }).where("id", "=", id).execute();
}

export async function deleteOgTemplate(db: BccDb, id: string): Promise<void> {
	await db.deleteFrom("og_templates").where("id", "=", id).execute();
}
