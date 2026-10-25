// Collects the Jan Aushadhi (PMBJP) product and MRP list into .cache/medicines-janaushadhi.json
// (D-53). The list is public on janaushadhi.gov.in ("Product & MRP List", with its own download
// button). The site gives every visitor a guest token; we ask for one the same way, then request
// the full list once. No sign-in, nothing bypassed (P-29). Run: node scripts/collect-medicines.js
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { USER_AGENT, today } from './lib/web.js';

const HOST = 'https://janaushadhi.gov.in:8443';
const API = `${HOST}/api/v1`;
export const LIST_PAGE = 'https://janaushadhi.gov.in/product-portfolio/product-mrp-list';

// Dosage form from the generic name, so the page can say "Tablet" or "Syrup".
const FORMS = [
  ['Injection', /injection|infusion|vial|ampoule/i], ['Syrup', /syrup|suspension|oral solution|elixir|drops? \(oral\)/i],
  ['Capsule', /capsule/i], ['Tablet', /tablet/i], ['Cream', /cream/i], ['Ointment', /ointment/i], ['Gel', /\bgel\b/i],
  ['Eye or ear drops', /eye|ear|ophthalmic|otic/i], ['Inhaler', /inhaler|respule|rotacap/i], ['Powder', /powder|sachet|granules/i],
  ['Lotion', /lotion|liniment/i], ['Spray', /spray/i], ['Soap or shampoo', /soap|shampoo/i], ['Device', /strip|syringe|bandage|glove|mask|pad|sanitary|test kit|lancet|thermometer/i],
];
export const formOf = (name) => FORMS.find(([, re]) => re.test(name))?.[0] ?? 'Other';

export function toMedicines(rows, checkedAt) {
  return rows
    .filter((r) => r.genericName && Number(r.mrp) > 0 && r.status === 1)
    .map((r) => ({
      sourceRef: `janaushadhi:${r.drugCode}`,
      name: String(r.genericName).replace(/\s+/g, ' ').trim().slice(0, 300),
      form: formOf(r.genericName),
      pack: String(r.unitSize || '').trim().slice(0, 60) || 'Not stated',
      category: String(r.groupName || '').trim() || null,
      priceInr: Math.round(Number(r.mrp) * 100) / 100,
      drugCode: r.drugCode,
      checkedAt,
    }));
}

async function main() {
  const headers = { 'user-agent': USER_AGENT, accept: 'application/json' };
  const token = (await (await fetch(`${HOST}/auth/generateGuestToken`, { headers, signal: AbortSignal.timeout(30000) })).json()).responseBody;
  if (!token) throw new Error('No guest token from janaushadhi.gov.in');
  const res = await fetch(`${API}/website/getAllProductForWeb`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ pageIndex: 0, pageSize: 100000, searchText: '', orderBy: 'asc', columnName: 'drug_code' }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Jan Aushadhi list answered ${res.status}`);
  const rows = (await res.json()).responseBody?.newProductResponsesList ?? [];
  const medicines = toMedicines(rows, today());
  await mkdir('.cache', { recursive: true });
  await writeFile('.cache/medicines-janaushadhi.json', JSON.stringify({ source: 'Jan Aushadhi (PMBJP)', page: LIST_PAGE, collectedAt: new Date().toISOString(), medicines }));
  console.log(`${rows.length} products listed, ${medicines.length} with a price`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
