import { drizzle } from "drizzle-orm/node-postgres";
import { getConnectionString } from "@netlify/database";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || getConnectionString();

if (!connectionString) {
  throw new Error(
    "No database connection string available. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export * from "./schema";
