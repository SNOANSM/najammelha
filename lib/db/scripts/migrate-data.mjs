// One-off copy of the old Railway Postgres data into the new (Netlify) database.
//
//   SOURCE_DATABASE_URL=<railway url> TARGET_DATABASE_URL=<netlify url> \
//     node lib/db/scripts/migrate-data.mjs            # preview only, writes nothing
//   ... node lib/db/scripts/migrate-data.mjs --apply  # actually copy
//
// The source is only ever read. Rows that already exist in the target (same
// primary key) are skipped, so it is safe to run twice. Sessions are not
// copied: everyone just logs in again.
import pg from "pg";

const TABLES = [
  ["najammelha_users", "id"],
  ["najammelha_categories", "id"],
  ["najammelha_reports", "id"],
  ["najammelha_locations", "id"],
  ["najammelha_points", "id"],
  ["najammelha_notifications", "id"],
  ["najammelha_rewards", "id"],
  ["najammelha_redemptions", "id"],
  ["najammelha_uploads", "id"],
];

const apply = process.argv.includes("--apply");
const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
if (!sourceUrl || !targetUrl) {
  console.error("Set SOURCE_DATABASE_URL and TARGET_DATABASE_URL first.");
  process.exit(1);
}
if (sourceUrl === targetUrl) {
  console.error("Source and target are the same database. Refusing to run.");
  process.exit(1);
}

const ssl = (url) => (/localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false });
const source = new pg.Client({ connectionString: sourceUrl, ssl: ssl(sourceUrl) });
const target = new pg.Client({ connectionString: targetUrl, ssl: ssl(targetUrl) });
await source.connect();
await target.connect();

const columnsOf = async (client, table) =>
  (await client.query("select column_name from information_schema.columns where table_schema = 'public' and table_name = $1", [table])).rows.map((r) => r.column_name);

console.log(apply ? "APPLYING (writing to target)\n" : "PREVIEW ONLY (nothing is written; add --apply to copy)\n");
let failed = false;

for (const [table, key] of TABLES) {
  const sourceCols = await columnsOf(source, table);
  const targetCols = await columnsOf(target, table);
  if (!sourceCols.length) { console.log(`${table}: not in source, skipped`); continue; }
  if (!targetCols.length) { console.log(`${table}: MISSING in target (deploy first so migrations run)`); failed = true; continue; }
  const cols = sourceCols.filter((c) => targetCols.includes(c));
  const quoted = cols.map((c) => `"${c}"`).join(", ");
  const count = Number((await source.query(`select count(*) from ${table}`)).rows[0].count);
  let inserted = 0;

  if (apply) {
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `insert into ${table} (${quoted}) values (${placeholders}) on conflict do nothing`;
    // Page through in small chunks: the uploads table holds base64 photos.
    for (let offset = 0; offset < count; offset += 25) {
      const rows = (await source.query(`select ${quoted} from ${table} order by "${key}" limit 25 offset ${offset}`)).rows;
      for (const row of rows) inserted += (await target.query(sql, cols.map((c) => row[c]))).rowCount ?? 0;
    }
    if (targetCols.includes("id") && (await target.query("select pg_get_serial_sequence($1, 'id') as s", [table])).rows[0].s) {
      await target.query(`select setval(pg_get_serial_sequence('${table}', 'id'), greatest((select coalesce(max(id), 0) from ${table}), 1))`);
    }
  }
  const dropped = sourceCols.filter((c) => !targetCols.includes(c));
  console.log(`${table}: ${count} row(s) in source${apply ? `, ${inserted} copied (rest already existed)` : ""}${dropped.length ? `  [ignored columns: ${dropped.join(", ")}]` : ""}`);
}

await source.end();
await target.end();
if (failed) process.exit(1);
console.log(apply ? "\nDone." : "\nPreview finished. Re-run with --apply to copy.");
