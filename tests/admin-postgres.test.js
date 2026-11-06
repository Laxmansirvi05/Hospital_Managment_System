// Postgres admin store, checked against a recording fake of the `postgres` driver.
// No database is touched. This proves what SQL is built (identifiers, parameters, transactions,
// audit rows in the same transaction) and nothing about how a real Postgres runs it. The real run
// is on the owner's verification list for the dev project.
import { describe, expect, it } from 'vitest';
import { createPostgresAdmin } from '../server/db/admin-postgres.js';

class Ident { constructor(name) { this.name = name; } }
class Raw { constructor(text) { this.text = text; } }
class Frag { constructor(strings, values, run) { this.strings = strings; this.values = values; this.run = run; } then(resolve, reject) { return this.run(this).then(resolve, reject); } }

function fakeSql(respond = () => []) {
  const log = [];
  let txCounter = 0;
  const render = (frag, params) => {
    let text = frag.strings[0];
    frag.values.forEach((v, i) => {
      let part;
      if (v instanceof Frag) part = render(v, params);
      else if (v instanceof Ident) part = v.name.split('.').map((x) => `"${x}"`).join('.');
      else if (v instanceof Raw) part = v.text;
      else { params.push(v); part = `$${params.length}`; }
      text += part + frag.strings[i + 1];
    });
    return text.replace(/\s+/g, ' ').trim();
  };
  const make = (tx) => {
    const tag = (a, ...values) => {
      if (typeof a === 'string') return new Ident(a);
      return new Frag(a, values, async (frag) => {
        const params = [];
        const text = render(frag, params);
        log.push({ text, params, tx });
        return respond(text, params, log) ?? [];
      });
    };
    tag.unsafe = (text) => new Raw(text);
    return tag;
  };
  const sql = make(null);
  sql.begin = async (fn) => { txCounter += 1; return fn(make(txCounter)); };
  return { sql, log };
}
const point = (sqlTag) => (lat, lng) => sqlTag`point(${lng}, ${lat})`;
const store = (respond) => { const f = fakeSql(respond); return { ...f, admin: createPostgresAdmin(f.sql, { point: point(f.sql) }) }; };
const ADMIN_A = '00000000-0000-4000-8000-00000000000a';
const ADMIN_B = '00000000-0000-4000-8000-00000000000b';
const TARGET = '00000000-0000-4000-8000-0000000000c1';

describe('admin Postgres store: users', () => {
  it('disables an account, ends its sessions and writes the audit row in one transaction', async () => {
    const { admin, log } = store((text) => (text.includes('from public.users where id =') ? [{ id: TARGET, role: 'patient', disabled_at: null }] : []));
    expect(await admin.disableUser(TARGET, ADMIN_A)).toEqual({ ok: true });
    const writes = log.filter((l) => /^(update|insert)/.test(l.text));
    expect(writes.map((l) => l.text.split(' ').slice(0, 3).join(' '))).toEqual(['update public.users set', 'update public.sessions set', 'insert into public.admin_audit_log']);
    expect(new Set(log.map((l) => l.tx)).size).toBe(1);
    expect(log[0].tx).not.toBeNull();
    const audit = writes[2];
    expect(audit.params).toEqual([ADMIN_A, 'user.disable', 'user', TARGET, 'Disabled a patient account']);
    expect(writes[1].text).toContain("revoked_reason = 'disabled'");
  });

  it('refuses self-disable, repeats, and the last active admin before changing anything', async () => {
    const row = (role, disabled_at = null) => (text) => (text.includes('where id =') ? [{ id: TARGET, role, disabled_at }] : text.includes("role = 'admin'") ? [{ id: ADMIN_A }] : []);
    for (const [respond, id, actor, reason] of [
      [row('patient'), ADMIN_A, ADMIN_A, 'self'],
      [row('patient', new Date()), TARGET, ADMIN_A, 'already'],
      [row('admin'), TARGET, ADMIN_B, 'last_admin'],
      [() => [], TARGET, ADMIN_A, 'not_found'],
    ]) {
      const { admin, log } = store(respond);
      expect(await admin.disableUser(id, actor)).toEqual({ ok: false, reason });
      expect(log.filter((l) => /^(update|insert|delete)/.test(l.text))).toEqual([]);
    }
  });

  it('keeps search text in parameters, escaping LIKE wildcards', async () => {
    const { admin, log } = store();
    await admin.listUsers({ q: "100%_'; drop table users; --", role: 'patient', status: 'disabled', limit: 10, offset: 5 });
    const q = log[0];
    expect(q.text).not.toContain('drop table');
    expect(q.params).toContain("%100\\%\\_'; drop table users; --%");
    expect(q.params).toEqual(expect.arrayContaining(['patient', 'disabled', 10, 5]));
  });

  it('selects only safe columns for the user list result', async () => {
    const { admin } = store(() => [{ id: TARGET, name: 'A', email: 'a@x.test', role: 'patient', created_at: new Date(), disabled_at: null, password_hash: 'scrypt$secret', google_sub: null, phone: '+911234567890', total_count: 1 }]);
    const { rows } = await admin.listUsers({});
    expect(Object.keys(rows[0]).sort()).toEqual(['createdAt', 'disabledAt', 'email', 'id', 'name', 'role', 'signIn']);
    expect(JSON.stringify(rows)).not.toMatch(/scrypt|\+91/);
    expect(rows[0].signIn).toEqual({ password: true, google: false });
  });
});

describe('admin Postgres store: listings', () => {
  it('creates a hospital with a geography point and audits it in the same transaction', async () => {
    const { admin, log } = store((text) => (text.startsWith('insert into "public"."hospitals"') || text.startsWith('insert into public') ? [{ id: TARGET }] : text.startsWith('select *') ? [{ id: TARGET, name: 'N', area: 'A', address: 'X', lat: 17.4, lng: 78.4, active: true, source_platform: 'CareRoute admin', checked_at: '2026-11-06', facility_type: 'hospital', description: '', emergency_available: false, specialities: [], departments: [] }] : []));
    const out = await admin.createListing('hospital', { name: 'N', area: 'A', address: 'X', lat: 17.4, lng: 78.4, phone: null, email: null, website: null, sourceUrl: null, facilityType: 'hospital', description: '', emergencyAvailable: false, specialities: [], departments: [] }, ADMIN_A);
    expect(out.ok).toBe(true);
    const insert = log.find((l) => l.text.startsWith('insert into "public"."hospitals"'));
    expect(insert.text).toMatch(/\("name", "area", "address".*"location"\) values \(\$1, \$2, \$3.*point\(\$\d+, \$\d+\)\)/);
    expect(insert.params).toEqual(expect.arrayContaining(['N', 78.4, 17.4]));
    const audit = log.find((l) => l.text.startsWith('insert into public.admin_audit_log'));
    expect(audit.tx).toBe(insert.tx);
    expect(audit.params.slice(0, 3)).toEqual([ADMIN_A, 'hospital.create', 'hospital']);
  });

  it('puts hostile text only in parameters on update, and records field names without values', async () => {
    const evil = "x'); delete from public.users; --";
    const { admin, log } = store((text) => (text.includes('for update') ? [{ name: 'Old name' }] : []));
    await admin.updateListing('pharmacy', TARGET, { name: evil, hours: '08:00 to 20:00' }, ADMIN_A, 'Edited "Old name": name, hours');
    const upd = log.find((l) => l.text.startsWith('update "public"."pharmacies" set'));
    expect(upd.text).not.toContain('delete from');
    expect(upd.params).toContain(evil);
    expect(upd.text).toContain('"name" = $1');
    expect(upd.text).toContain('updated_at = now()');
    const audit = log.find((l) => l.text.startsWith('insert into public.admin_audit_log'));
    expect(audit.params[4]).toBe('Edited "Old name": name, hours');
    expect(audit.params).not.toContain(evil);
  });

  it('only ever interpolates table names from its fixed map', async () => {
    const { admin, log } = store((text) => (text.includes('for update') ? [{ name: 'x', active: true }] : []));
    await admin.setListingActive('diagnostic_centre', TARGET, false, ADMIN_A);
    const tables = log.map((l) => l.text).join(' ');
    expect(tables).toContain('"public"."diagnostic_centres"');
    expect(await admin.getListing('hospital', TARGET)).toBeNull();
  });

  it('moving a doctor to a hospital clears the clinic columns; moving to a clinic clears the hospital', async () => {
    const { admin, log } = store((text) => (text.includes('for update') ? [{ name: 'Dr X' }] : []));
    await admin.updateListing('doctor', TARGET, { hospitalId: ADMIN_B }, ADMIN_A);
    const toHospital = log.find((l) => l.text.startsWith('update "public"."doctors" set')).text;
    for (const c of ['clinic_name', 'clinic_area', 'clinic_address', 'clinic_phone', 'clinic_location']) expect(toHospital).toContain(`"${c}" = null`);
    const second = store((text) => (text.includes('for update') ? [{ name: 'Dr X' }] : []));
    await second.admin.updateListing('doctor', TARGET, { clinic: { name: 'C', area: 'Ameerpet', address: 'A', phone: null, lat: 17.4, lng: 78.4 } }, ADMIN_A);
    const toClinic = second.log.find((l) => l.text.startsWith('update "public"."doctors" set')).text;
    expect(toClinic).toContain('hospital_id = null');
    expect(toClinic).toContain('clinic_location = point(');
  });

  it('writes nothing when the record does not exist', async () => {
    const { admin, log } = store();
    expect(await admin.updateListing('hospital', TARGET, { name: 'x' }, ADMIN_A)).toEqual({ ok: false, reason: 'not_found' });
    expect(await admin.setListingActive('hospital', TARGET, true, ADMIN_A)).toEqual({ ok: false, reason: 'not_found' });
    expect(log.filter((l) => /^(update|insert|delete)/.test(l.text))).toEqual([]);
  });
});

describe('admin Postgres store: reviews and audit', () => {
  it('restores a checked review by clearing its reports, all in one transaction', async () => {
    const { admin, log } = store((text) => (text.includes('from public.reviews where id') ? [{ id: TARGET, listing_kind: 'hospital', status: 'hidden' }] : text.includes('count(*)::int as n from public.review_reports') ? [{ n: 3 }] : []));
    expect(await admin.restoreReview(TARGET, ADMIN_A)).toEqual({ ok: true });
    const writes = log.filter((l) => /^(update|insert|delete)/.test(l.text));
    expect(writes.map((l) => l.text.split(' ').slice(0, 3).join(' '))).toEqual(['update public.reviews set', 'delete from public.review_reports', 'insert into public.admin_audit_log']);
    expect(new Set(log.map((l) => l.tx)).size).toBe(1);
    expect(writes[2].params[4]).toBe('Kept a hospital review after 3 reports');
  });

  it('deletes a review and audits without keeping its text', async () => {
    const { admin, log } = store((text) => (text.startsWith('delete from public.reviews') ? [{ listing_kind: 'doctor' }] : []));
    expect(await admin.deleteReview(TARGET, ADMIN_A)).toEqual({ ok: true });
    const audit = log.find((l) => l.text.startsWith('insert into public.admin_audit_log'));
    expect(audit.params).toEqual([ADMIN_A, 'review.delete', 'review', TARGET, 'Deleted a doctor review']);
  });

  it('lists reviews without any author column', async () => {
    const { admin, log } = store((text) => (text.includes('count(*)::int as n from (') ? [{ n: 1 }] : [{ id: TARGET, listing_kind: 'hospital', listing_id: ADMIN_B, rating: 1, body: 'b', status: 'hidden', created_at: new Date(), updated_at: new Date(), report_count: 3, listing_name: 'H', user_id: 'SECRET-AUTHOR' }]));
    const out = await admin.listReviews({ status: 'hidden' });
    expect(JSON.stringify(out)).not.toContain('SECRET-AUTHOR');
    expect(log.map((l) => l.text).join(' ')).not.toMatch(/r\.user_id|join public\.users/);
  });

  it('lists the audit log with the actor name and never selects other user columns', async () => {
    const { admin, log } = store(() => [{ id: TARGET, actor_name: null, action: 'user.disable', target_kind: 'user', target_id: TARGET, summary: 's', created_at: new Date(), total_count: 1 }]);
    const out = await admin.listAudit({});
    expect(out.rows[0].actor).toBe('Removed account');
    expect(log[0].text).toContain('u.name as actor_name');
    expect(log[0].text).not.toMatch(/u\.email|u\.phone|password/);
  });
});
