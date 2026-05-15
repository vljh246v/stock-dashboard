import "dotenv/config";

import path from "node:path";
import process from "node:process";

import { migrate } from "drizzle-orm/mysql2/migrator";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run database migrations");
  }

  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  const connection = await mysql.createConnection(databaseUrl);
  const db = drizzle(connection);

  try {
    await migrate(db, { migrationsFolder });
    console.log(`Database migrations applied from ${migrationsFolder}`);
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error("Database migration failed:", error);
  process.exit(1);
});
