import "dotenv/config";
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const cols = await db.execute("PRAGMA table_info(ventas)");
const names = new Set((cols.rows ?? []).map((r) => String(r.name).toLowerCase()));

if (!names.has("monto_usd")) {
  await db.execute("ALTER TABLE ventas ADD COLUMN monto_usd REAL NOT NULL DEFAULT 0");
  console.log("Columna monto_usd agregada.");
} else {
  console.log("Columna monto_usd ya existe.");
}

if (!names.has("monto_bs")) {
  await db.execute("ALTER TABLE ventas ADD COLUMN monto_bs REAL NOT NULL DEFAULT 0");
  console.log("Columna monto_bs agregada.");
} else {
  console.log("Columna monto_bs ya existe.");
}

await db.execute(`
  UPDATE ventas
  SET monto_usd = monto,
      monto_bs = 0
  WHERE COALESCE(monto_usd, 0) = 0
    AND COALESCE(monto_bs, 0) = 0
    AND COALESCE(monto, 0) > 0
`);

console.log("Datos historicos normalizados.");

const after = await db.execute("PRAGMA table_info(ventas)");
console.log(JSON.stringify(after.rows ?? [], null, 2));
