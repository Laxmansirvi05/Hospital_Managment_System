import postgres from 'postgres';
import { getConfig } from '../config.js';

let sql;

// One connection per function instance. prepare is off because Supabase's pooled
// connection string does not support prepared statements in transaction mode.
function client() {
  if (!sql) {
    const { DATABASE_URL } = getConfig('database');
    sql = postgres(DATABASE_URL, { max: 1, prepare: false, connect_timeout: 2, idle_timeout: 20 });
  }
  return sql;
}

export const db = {
  get sql() {
    return client();
  },
  async ping() {
    await client()`select 1`;
  },
};
