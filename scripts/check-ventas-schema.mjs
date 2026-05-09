import "dotenv/config";
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const schema = await db.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'ventas'");
const cols = await db.execute("PRAGMA table_info(ventas)");

console.log(JSON.stringify({
  schema: schema.rows?.[0]?.sql ?? null,
  columns: cols.rows ?? []
}, null, 2));
