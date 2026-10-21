import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

/**
 * Creates a throw-away database on the PostgreSQL server given by
 * DATABASE_URL_TEST, installs the Supabase shim, applies every migration and
 * runs the seed. Never point DATABASE_URL_TEST at a real project database.
 */
export const DATABASE_URL = process.env.DATABASE_URL_TEST;

const root = path.resolve(__dirname, "../../..");

export async function createTestDatabase(): Promise<{ url: string; drop: () => Promise<void> }> {
  if (!DATABASE_URL) throw new Error("DATABASE_URL_TEST is not set");
  const name = `celebrio_it_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6)}`;
  const admin = new Client({ connectionString: DATABASE_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = new URL(DATABASE_URL);
  url.pathname = `/${name}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  await client.query(fs.readFileSync(path.join(root, "tests/integration/support/supabase-shim.sql"), "utf8"));
  for (const file of fs.readdirSync(path.join(root, "supabase/migrations")).sort()) {
    await client.query(fs.readFileSync(path.join(root, "supabase/migrations", file), "utf8"));
  }
  await client.query(fs.readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
  await client.end();
  return {
    url: url.toString(),
    drop: async () => {
      const c = new Client({ connectionString: DATABASE_URL });
      await c.connect();
      await c.query(`drop database if exists ${name} with (force)`);
      await c.end();
    },
  };
}

/** Runs `fn` as a Supabase role with the given JWT subject, inside a rolled-back transaction. */
export async function asRole<T>(client: Client, role: "anon" | "authenticated" | "service_role", userId: string | null, fn: () => Promise<T>): Promise<T> {
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claims', $1, true)", [userId ? JSON.stringify({ sub: userId, role }) : ""]);
    return await fn();
  } finally {
    await client.query("rollback");
  }
}
