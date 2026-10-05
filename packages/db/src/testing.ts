import pg from "pg";
import { createPool, migrate, resetSchema, seed, type Db } from "./index.js";

/**
 * Tests run against a dedicated `<db>_test` database so resetting the schema
 * can never touch development data. Created on demand.
 */
export async function createTestDb(): Promise<Db> {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set (copy .env.example to .env and run `npm run db:up`)");
  const url = new URL(base);
  const testName = `${url.pathname.slice(1)}_test`;

  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [testName]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${testName}"`);
  } finally {
    await admin.end();
  }

  url.pathname = `/${testName}`;
  return createPool(url.toString());
}

export async function freshSeededDb(): Promise<Db> {
  const db = await createTestDb();
  await resetSchema(db);
  await migrate(db);
  await seed(db);
  return db;
}
