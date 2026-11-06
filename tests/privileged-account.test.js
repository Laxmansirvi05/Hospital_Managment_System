// The account script for driver and admin accounts (D-21), against the in-memory store.
import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '../server/db/memory.js';
import { verifyPassword } from '../server/auth/crypto.js';
import { createPrivilegedAccount } from '../scripts/create-privileged-account.js';

const good = { role: 'admin', name: 'Ops Person', email: 'Ops@Example.test', password: 'a long enough password' };

describe('createPrivilegedAccount', () => {
  it('creates the account with a hashed password and records it in the audit log', async () => {
    const store = createMemoryStore();
    const made = await createPrivilegedAccount(store, good);
    expect(made.role).toBe('admin');
    const user = await store.users.byEmail('ops@example.test');
    expect(user.role).toBe('admin');
    expect(user.passwordHash).not.toContain(good.password);
    expect(await verifyPassword(good.password, user.passwordHash)).toBe(true);
    const { rows } = await store.admin.listAudit({ action: 'user.create', limit: 5, offset: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ targetKind: 'user', targetId: made.id, actor: 'Removed account' });
    expect(rows[0].summary).not.toContain('ops@example.test');
  });

  it('refuses an email already in use and leaves that account as it was', async () => {
    const store = createMemoryStore();
    await store.users.create({ name: 'Patient', email: 'ops@example.test', phone: null, role: 'patient', passwordHash: null });
    await expect(createPrivilegedAccount(store, good)).rejects.toThrow(/already exists/);
    expect((await store.users.byEmail('ops@example.test')).role).toBe('patient');
  });

  it.each([
    ['patient role', { ...good, role: 'patient' }],
    ['short password', { ...good, password: 'short' }],
    ['bad email', { ...good, email: 'nope' }],
  ])('refuses a %s', async (_, values) => {
    await expect(createPrivilegedAccount(createMemoryStore(), values)).rejects.toThrow();
  });
});
