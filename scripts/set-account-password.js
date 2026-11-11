// Sets a new password for an existing account and signs it out everywhere (there is no password reset
// by email yet). Use it for an account that cannot sign in, for example one made earlier with Google,
// which has no password. The target is DATABASE_URL; the password comes from CAREROUTE_NEW_PASSWORD or
// a hidden prompt, never the command line.
//   node --env-file=.env.local scripts/set-account-password.js --email you@example.com
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { hashPassword } from '../server/auth/crypto.js';

const input = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12, 'Use at least 12 characters').max(128),
});

/** Changes the password and ends every session of that account. Refuses an email with no account. */
export async function setAccountPassword(store, values) {
  const v = input.parse(values);
  const user = await store.users.byEmail(v.email);
  if (!user) throw new Error('No account uses this email. Nothing was changed.');
  await store.users.setPassword(user.id, await hashPassword(v.password));
  // The nil id keeps no session: the store keeps the one whose id is given, and none has this id.
  await store.sessions.revokeOthers(user.id, '00000000-0000-0000-0000-000000000000');
  return { id: user.id, role: user.role };
}

async function askHidden(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (text) => { if (text.includes(prompt)) process.stdout.write(prompt); };
  const answer = await rl.question(prompt);
  rl.close();
  process.stdout.write('\n');
  return answer;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set, so there is no database to write to.');
  const i = process.argv.indexOf('--email');
  const email = i > -1 ? process.argv[i + 1] : '';
  const password = process.env.CAREROUTE_NEW_PASSWORD || await askHidden('New password: ');
  const { createPostgresStore } = await import('../server/db/postgres.js');
  const store = createPostgresStore(url);
  try {
    console.log(`Writing to database host ${new URL(url).hostname}`);
    const done = await setAccountPassword(store, { email, password });
    console.log(`Password set for the ${done.role} account ${done.id}. It is signed out everywhere.`);
  } finally {
    await store.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err.errors?.map((e) => e.message).join('; ') || err.message); process.exitCode = 1; });
}
