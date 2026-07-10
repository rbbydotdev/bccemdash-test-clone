/**
 * BCC plugin admin entrypoint (`@bcc/plugin/admin`).
 *
 * Statically imported into the admin SPA through the
 * `virtual:emdash/admin-registry` module generated from the descriptor's
 * `adminEntry`. Page keys must match `adminPages[].path`, widget keys
 * `adminWidgets[].id`, and field keys `fieldWidgets[].name` in src/index.ts.
 */
import type { PluginAdminExports } from "emdash";

import { EnquiriesPage } from "./EnquiriesPage.js";
import { LocationField } from "./fields/LocationField.js";
import { SettingsPage } from "./SettingsPage.js";
import { RecentEnquiriesWidget } from "./widgets.js";

export const pages: PluginAdminExports["pages"] = {
	"/settings": SettingsPage,
	"/enquiries": EnquiriesPage,
};

export const widgets: PluginAdminExports["widgets"] = {
	"recent-enquiries": RecentEnquiriesWidget,
};

// Field widgets: keys must match `fieldWidgets[].name`; fields opt in via
// `widget: "bcc:<name>"` in their seed definition.
export const fields: PluginAdminExports["fields"] = {
	location: LocationField,
};
