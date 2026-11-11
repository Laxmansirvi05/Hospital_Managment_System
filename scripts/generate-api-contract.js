import { readFileSync, writeFileSync } from 'node:fs';
import { TABLE } from '../server/router.js';

const docPath = new URL('../docs/05-api-spec.md', import.meta.url);
const collectionPath = new URL('../postman/ambulance-platform.postman_collection.json', import.meta.url);
const previousDoc = readFileSync(docPath, 'utf8');
const previousCollection = JSON.parse(readFileSync(collectionPath, 'utf8'));
const emergencyContracts = {
  'POST /emergencies': ['Body: emergencyType, forSelf, conscious, patientCount, ambulanceType, notes, location{lat,lng}, address; guestPhone required for guest', '201 {emergency{id,status,emergencyType,patientCount,ambulanceType,etaSeconds,etaIsEstimate,createdAt},trackingToken}'],
  'GET /emergencies/active': ['', '200 {emergency|null}'],
  'GET /emergencies': ['Query: limit? (1..100), offset? (0..10000)', '200 {emergencies:[emergency summary]}'],
  'GET /emergencies/:id': ['Path: id (UUID)', '200 {emergency summary,location,address,ambulance,timeline}'],
  'POST /emergencies/:id/cancel': ['Path: id (UUID)', '200 {emergency summary}'],
  'POST /emergencies/:id/feedback': ['Path: id (UUID); Body: rating (1..5), comment?', '201 {feedback{rating,comment,createdAt}}'],
  'GET /track/:token': ['Path: token (one-time tracking token)', '200 {status,ambulance{lat,lng,heading}|null,etaSeconds,etaIsEstimate,demo}'],
  'POST /track/:token/cancel': ['Path: token (one-time tracking token)', '200 {status}'],
  'GET /driver/me': ['', '200 {ambulance{id,type,registrationNumber,status,position}}'],
  'PUT /driver/me/status': ['Body: status (available|offline)', '200 {status}'],
  'PUT /driver/me/location': ['Body: lat, lng, heading?, speed?', '200 {status,position}'],
  'GET /driver/offers': ['', '200 {offer|null}; offer has emergencyId, emergencyType, conscious, patientCount, distanceKm, secondsRemaining only: no place, address, notes or medical ID before accepting'],
  'POST /driver/offers/:emergencyId/accept': ['Path: emergencyId (UUID)', '200 {emergency summary}'],
  'POST /driver/offers/:emergencyId/reject': ['Path: emergencyId (UUID)', '200 {status}. PROPOSED P-20; not an approved contract.'],
  'GET /driver/trips/active': ['', '200 {emergency|null}; adds location, address, conscious, notes and, only when shareWithCrew is true, medicalId'],
  'POST /driver/trips/:emergencyId/status': ['Path: emergencyId (UUID); Body: status (next legal status only)', '200 {emergency summary}'],
  'POST /driver/me/release': ['', '200 {status}'],
  'GET /admin/emergencies': ['Query: status? (emergency status)', '200 {emergencies:[operational summary]}'],
  'GET /admin/emergencies/:id': ['Path: id (UUID)', '200 {emergency{id,status,emergencyType,location,createdAt,timeline}}'],
  'GET /admin/ambulances': ['Query: type? (BLS|ALS|ICU), lat?, lng?, radiusKm? (1..100, default 10). With lat and lng: available crews only, nearest first', '200 {ambulances:[id,type,status,position,isDemo,distanceKm?]}'],
  'GET /admin/analytics': ['', '200 {timeZone,totalRequests,noMatch,averageAssignSeconds,averageArriveSeconds,byHour}'],
  'GET /admin/data-quality': ['', '200 {staleAfterDays,kinds:[{kind,active,stale,noPhone,noSource}],possibleDuplicates:{total,groups},stale:{total,rows}}'],
};
const adminContracts = {
  'GET /admin/overview': ['', '200 admin overview summary'],
  'GET /admin/users': ['Query: q?, role? (patient|driver|admin), status? (active|disabled), limit? (1..100), offset?', '200 {total,users:[user summary]}'],
  'POST /admin/users/:id/disable': ['Path: id (UUID)', '200 {user:user summary}'],
  'POST /admin/users/:id/enable': ['Path: id (UUID)', '200 {user:user summary}'],
  'GET /admin/listings': ['Query: kind?, q?, status? (active|hidden), area?, limit? (1..100), offset?', '200 {total,listings:[listing summary]}'],
  'GET /admin/hospital-choices': ['Query: q?, limit? (1..50)', '200 {hospitals:[{id,name,area,active}]}'],
  'GET /admin/listings/:kind/:id': ['Path: kind (hospital|doctor|pharmacy|diagnostic_centre), id (UUID)', '200 {listing}'],
  'POST /admin/listings/:kind': ['Path: kind (hospital|doctor|pharmacy|diagnostic_centre); JSON listing fields for that kind', '201 {listing}'],
  'PATCH /admin/listings/:kind/:id': ['Path: kind (hospital|doctor|pharmacy|diagnostic_centre), id (UUID); JSON object with one or more valid listing fields', '200 {listing}'],
  'POST /admin/listings/:kind/:id/hide': ['Path: kind (hospital|doctor|pharmacy|diagnostic_centre), id (UUID)', '200 {listing}'],
  'POST /admin/listings/:kind/:id/unhide': ['Path: kind (hospital|doctor|pharmacy|diagnostic_centre), id (UUID)', '200 {listing}'],
  'GET /admin/reviews': ['Query: status? (hidden|reported|all), limit? (1..100), offset?', '200 {total,reviews:[moderation summary]}'],
  'POST /admin/reviews/:id/restore': ['Path: id (UUID)', '204 empty'],
  'DELETE /admin/reviews/:id': ['Path: id (UUID)', '204 empty'],
  'GET /admin/audit': ['Query: action?, targetKind? (user|hospital|doctor|pharmacy|diagnostic_centre|review), limit? (1..100), offset?', '200 {total,entries:[audit entry]}'],
};

function flatten(items, out = new Map()) {
  for (const item of items ?? []) {
    if (item.request) out.set(item.name, item);
    else flatten(item.item, out);
  }
  return out;
}
const existingItems = flatten(previousCollection.item);
const oldRows = new Map();
const tableStart = previousDoc.indexOf('| Method | Path | Role | Request fields | Success response fields |');
if (tableStart >= 0) {
  for (const line of previousDoc.slice(tableStart).split('\n').filter((x) => x.startsWith('| ') && !x.includes('---'))) {
    const cells = line.split('|').slice(1, -1).map((x) => x.trim());
    if (cells.length === 5) oldRows.set(`${cells[0]} ${cells[1]}`, { request: cells[3], response: cells[4] });
  }
}
const roleLabel = (roles) => roles === 'public' ? 'public' : roles.join('|');
const contractFor = (route) => {
  const key = `${route.method} ${route.path}`;
  const emergency = emergencyContracts[key];
  const adminContract = adminContracts[key];
  const oldItem = existingItems.get(key);
  const description = oldItem?.request?.description ?? '';
  const requestStart = description.indexOf('Request: '); const successStart = description.indexOf('. Success: ');
  const legacy = requestStart >= 0 && successStart > requestStart
    ? { request: description.slice(requestStart + 9, successStart), response: description.slice(successStart + 11) }
    : oldRows.get(key);
  return { role: route.roles === 'public' && key === 'POST /emergencies' ? 'public (optional patient or guest)' : roleLabel(route.roles),
    request: emergency?.[0] ?? adminContract?.[0] ?? legacy?.request ?? '',
    response: emergency?.[1] ?? adminContract?.[1] ?? legacy?.response ?? 'See the route response object.' };
};
const routeKey = (route) => `${route.method} ${route.path}`;
const oldShared = previousDoc.slice(previousDoc.indexOf('## Shared listing item fields'));
const shared = oldShared.split('## Planned, not implemented')[0].trim();
const rows = TABLE.map((route) => {
  const c = contractFor(route);
  return `| ${route.method} | \`${route.path}\` | ${c.role} | ${c.request} | ${c.response} |`;
});
const doc = `# API specification\n\nGenerated by \`node scripts/generate-api-contract.js\` from the route arrays registered in \`server/router.js\`. Base path: \`/api/v1\`. The handler implementation is authoritative. Every registered method/path appears once.\n\nRoles: \`public\` means no login; \`patient\`, \`driver\`, and \`admin\` are signed-in roles. Parameters shown with \`:\` are path parameters. Requests reject unknown body fields where schemas are strict. Validation errors use 422 \`invalid_input\`; missing auth is 401; role denial is 403; not found is 404; impossible transitions are 409.\n\n## Registered route inventory (${TABLE.length} entries)\n\nThe driver reject handler is registered but remains **PROPOSED under P-20 and is not an approved contract**. Its presence below and in Postman does not imply approval.\n\n| Method | Path | Role | Request fields | Success response fields |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n${shared}\n`;
writeFileSync(docPath, doc);

const makeItem = (route) => {
  const key = routeKey(route); const c = contractFor(route); const old = existingItems.get(key);
  if (old) return old;
  const replaced = route.path.split('/').filter(Boolean).map((segment) => segment.startsWith(':') ? `{{${route.path.startsWith('/track/') ? 'trackingToken' : segment.slice(1) === 'emergencyId' ? 'id' : segment.slice(1)}}}` : segment);
  const publicRoute = route.roles === 'public';
  const request = { method: route.method, header: route.method === 'POST' || route.method === 'PUT' ? [{ key: 'Content-Type', value: 'application/json' }] : [],
    url: { raw: `{{baseUrl}}/${replaced.join('/')}`, host: ['{{baseUrl}}'], path: replaced }, description: `Role: ${c.role}. Request: ${c.request || 'none'}. Success: ${c.response}`,
    auth: publicRoute ? { type: 'noauth' } : { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] } };
  if (key === 'POST /emergencies') request.body = { mode: 'raw', raw: JSON.stringify({ emergencyType: 'other', forSelf: true, conscious: true, patientCount: 1, ambulanceType: 'BLS', notes: '', location: { lat: 17.43, lng: 78.45 }, address: '', guestPhone: '+15555550123' }, null, 2), options: { raw: { language: 'json' } } };
  if (key === 'POST /emergencies/:id/feedback') request.body = { mode: 'raw', raw: JSON.stringify({ rating: 5, comment: '' }, null, 2), options: { raw: { language: 'json' } } };
  if (key === 'PUT /driver/me/status') request.body = { mode: 'raw', raw: JSON.stringify({ status: 'available' }, null, 2), options: { raw: { language: 'json' } } };
  if (key === 'PUT /driver/me/location') request.body = { mode: 'raw', raw: JSON.stringify({ lat: 17.43, lng: 78.45, heading: 0, speed: 0 }, null, 2), options: { raw: { language: 'json' } } };
  if (key === 'POST /driver/trips/:emergencyId/status') request.body = { mode: 'raw', raw: JSON.stringify({ status: 'en_route' }, null, 2), options: { raw: { language: 'json' } } };
  if (key === 'POST /track/:token/cancel') request.body = { mode: 'raw', raw: '{}', options: { raw: { language: 'json' } } };
  return { name: key, request, response: [] };
};

const groups = new Map();
for (const route of TABLE) {
  const key = routeKey(route); const existing = existingItems.get(key); if (existing) continue;
  const category = route.path.startsWith('/driver/') ? 'Driver' : route.path.startsWith('/admin/') ? 'Admin' : route.path.startsWith('/track/') ? 'Public tracking' : 'Emergencies';
  if (!groups.has(category)) groups.set(category, []);
  groups.get(category).push(makeItem(route));
}
for (const [name, items] of groups) previousCollection.item.push({ name, item: items });
if (!previousCollection.variable.some((item) => item.key === 'trackingToken')) previousCollection.variable.push({ key: 'trackingToken', value: 'replace-with-one-time-tracking-token' });
previousCollection.info.description = `Generated by node scripts/generate-api-contract.js from server/router.js. Includes all ${TABLE.length} registered method/path pairs, with route role, request fields, and success response fields. Base URL is {{baseUrl}}.`;
writeFileSync(collectionPath, `${JSON.stringify(previousCollection, null, 2)}\n`);
console.log(`Generated ${TABLE.length} routes; added ${[...groups.values()].reduce((n, items) => n + items.length, 0)} Postman requests.`);
