// Creates a driver or admin account (D-21: privileged accounts never sign up themselves in production).
// The target is whatever DATABASE_URL says, and the script names the project before it writes.
//   node --env-file=.env.local scripts/create-privileged-account.js --role admin --name "Name" --email you@example.com [--require-change]
// --require-change makes the portal ask for a new password at the first sign-in (for a starting password).
// The password comes from CAREROUTE_NEW_PASSWORD or a hidden prompt, never from the command line,
// which would leave it in shell history. It is never printed.
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { hashPassword } from '../server/auth/crypto.js';

const input = z.object({
  role: z.enum(['driver', 'admin']),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  // The site's own minimum. A shorter starting password than 12 is allowed because the owner may choose one to
  // change at once; the script warns, and --require-change makes the portal demand the change.
  password: z.string().min(8, 'Use at least 8 characters').max(128),
  passwordChangeRequired: z.boolean().default(false),
});

/** Creates the account and records it. An existing email is refused, never promoted to a higher role. */
export async function createPrivilegedAccount(store, values) {
  const v = input.parse(values);
  const user = await store.users.create({ name: v.name, email: v.email, phone: null, role: v.role, passwordHash: await hashPassword(v.password), passwordChangeRequired: v.passwordChangeRequired });
  if (!user) throw new Error('An account with this email already exists. Nothing was changed.');
  await store.admin.recordAudit({ actorId: null, action: 'user.create', targetKind: 'user', targetId: user.id, summary: `Created a ${v.role} account with the account script` });
  return { id: user.id, role: v.role };
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) throw new Error(`Expected --name value pairs, got ${argv[i]}`);
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

async function askHidden(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // Replaces the echo of each typed character, so the password does not appear on screen.
  rl._writeToOutput = (text) => { if (text.includes(prompt)) process.stdout.write(prompt); };
  const answer = await rl.question(prompt);
  rl.close();
  process.stdout.write('\n');
  return answer;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set, so there is no database to write to.');
  const flags = process.argv.slice(2);
  const requireChange = flags.includes('--require-change');
  const { role, name, email } = args(flags.filter((f) => f !== '--require-change'));
  const password = process.env.CAREROUTE_NEW_PASSWORD || await askHidden('Password for the new account: ');
  const { createPostgresStore } = await import('../server/db/postgres.js');
  const store = createPostgresStore(url);
  try {
    console.log(`Writing to database host ${new URL(url).hostname} as user ${new URL(url).username.split('.').at(-1)}`);
    if (password.length < 12) console.log('Warning: this password is short. Change it from Account and privacy as soon as you can.');
    const made = await createPrivilegedAccount(store, { role, name, email, password, passwordChangeRequired: requireChange });
    console.log(`Created a ${made.role} account: ${made.id}`);
  } finally {
    await store.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err.errors?.map((e) => e.message).join('; ') || err.message); process.exitCode = 1; });
}
