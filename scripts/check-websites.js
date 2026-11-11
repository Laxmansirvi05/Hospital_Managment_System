// Finds listing websites whose domain no longer exists, and (with --apply) clears them, so the app
// never offers a "Website" link that goes nowhere. Only a domain with no DNS record counts as dead
// (ENOTFOUND). A site that answers 403, times out or has a bad certificate may still work for people,
// so it is left alone and only reported. The websites come from OpenStreetMap, whose editors do not
// check them. Rows are matched by domain, so each domain is looked up once.
// Run: node --env-file=.env.local scripts/check-websites.js [--apply]     (DATABASE_URL, or --prod for the import role)
import postgres from 'postgres';
import { lookup } from 'node:dns/promises';
import { sessionPoolerUrl } from '../server/db/postgres.js';

const TABLES = ['hospitals', 'pharmacies', 'diagnostic_centres'];
const apply = process.argv.includes('--apply');
const prod = process.argv.includes('--prod');
const url = prod ? process.env.PROD_IMPORT_DATABASE_URL : process.env.DATABASE_URL;
if (!url) throw new Error(prod ? 'PROD_IMPORT_DATABASE_URL is not set' : 'DATABASE_URL is not set');
const sql = postgres(sessionPoolerUrl(url), { max: 1, prepare: false });

const hostOf = (u) => { try { return new URL(u).hostname; } catch { return null; } };
async function deadHosts(hosts) {
  const dead = new Set();
  let i = 0;
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (i < hosts.length) {
      const host = hosts[i++];
      try { await lookup(host); } catch (err) { if (err.code === 'ENOTFOUND') dead.add(host); }
    }
  }));
  return dead;
}

try {
  const rows = [];
  for (const table of TABLES) for (const r of await sql`select id, website from ${sql('public.' + table)} where website is not null`) rows.push({ table, id: r.id, host: hostOf(r.website), website: r.website });
  const hosts = [...new Set(rows.map((r) => r.host).filter(Boolean))];
  const unparseable = rows.filter((r) => !r.host);
  const dead = await deadHosts(hosts);
  const doomed = rows.filter((r) => !r.host || dead.has(r.host));
  console.log(`${rows.length} websites, ${hosts.length} domains, ${dead.size} domains with no DNS record, ${unparseable.length} not a web address`);
  for (const h of [...dead].slice(0, 15)) console.log('  dead:', h);
  if (!apply) console.log(`Dry run: ${doomed.length} links would be cleared. Add --apply to clear them.`);
  else {
    for (const r of doomed) await sql`update ${sql('public.' + r.table)} set website = null, updated_at = now() where id = ${r.id}`;
    console.log(`Cleared ${doomed.length} dead website links.`);
  }
} finally {
  await sql.end();
}
