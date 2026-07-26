#!/usr/bin/env bash
# Copy the site's local content into the OG worker's local storage.
#
# In production both read the same D1 + R2, so nothing is needed. Locally they
# diverge: the site runs the Node target (SQLite at apps/site/data/site.db plus
# apps/site/uploads/), while this Worker speaks D1 + R2 through Miniflare. This
# script copies the settings row and the hero image across so the local preview
# shows the real card instead of defaults.
#
#   ./scripts/sync-local.sh [persist-dir]
#
# Run it again after changing hero copy or the hero image. Stop `wrangler dev`
# first — Miniflare holds the SQLite files open.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
og_dir="$(dirname "$here")"
site_dir="$(cd "$og_dir/../site" && pwd)"
persist="${1:-$og_dir/.wrangler/state}"

site_db="$site_dir/data/site.db"
[ -f "$site_db" ] || { echo "No site database at $site_db — run the site once first." >&2; exit 1; }

echo "site db : $site_db"
echo "persist : $persist"

settings=$(sqlite3 "$site_db" "SELECT value FROM options WHERE name='bcc_site';")
[ -n "$settings" ] || { echo "No bcc_site settings row found." >&2; exit 1; }

hero_id=$(sqlite3 "$site_db" "SELECT json_extract(value,'\$.hero.image') FROM options WHERE name='bcc_site';")
hero_key=""
if [ -n "$hero_id" ] && [ "$hero_id" != "null" ]; then
	hero_key=$(sqlite3 "$site_db" "SELECT storage_key FROM media WHERE id='$hero_id';")
fi

# `wrangler d1 execute` needs the statements as one argument; quote the JSON safely.
escaped=${settings//\'/\'\'}

npx wrangler d1 execute bat-city-council --local --persist-to "$persist" --command "
CREATE TABLE IF NOT EXISTS options (name TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, storage_key TEXT);
INSERT OR REPLACE INTO options (name, value) VALUES ('bcc_site', '$escaped');
" >/dev/null
echo "settings synced"

if [ -n "$hero_key" ]; then
	npx wrangler d1 execute bat-city-council --local --persist-to "$persist" --command \
		"INSERT OR REPLACE INTO media (id, storage_key) VALUES ('$hero_id', '$hero_key');" >/dev/null
	upload="$site_dir/uploads/$hero_key"
	if [ -f "$upload" ]; then
		npx wrangler r2 object put "bat-city-council-media/$hero_key" \
			--file "$upload" --local --persist-to "$persist" >/dev/null
		echo "hero image synced ($hero_key)"
	else
		echo "warning: hero image file missing at $upload — card will use the gradient" >&2
	fi
else
	echo "no hero image set — card will use the gradient"
fi

echo "done. start the worker with: pnpm exec wrangler dev --local --persist-to \"$persist\""
