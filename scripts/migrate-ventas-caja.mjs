import "dotenv/config";
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const cols = await db.execute("PRAGMA table_info(ventas)");
const names = new Set((cols.rows ?? []).map((r) => String(r.name).toLowerCase()));

const addColumn = async (name, ddl) => {
  if (names.has(name)) {
    console.log(`Columna ${name} ya existe.`);
    return;
  }

  await db.execute(`ALTER TABLE ventas ADD COLUMN ${ddl}`);
  console.log(`Columna ${name} agregada.`);
};

await addColumn("cliente_id", "cliente_id INTEGER");
await addColumn("metodo_pago_usd", "metodo_pago_usd TEXT NOT NULL DEFAULT ''");
await addColumn("metodo_pago_bs", "metodo_pago_bs TEXT NOT NULL DEFAULT ''");
await addColumn("monto_bs_raw", "monto_bs_raw REAL NOT NULL DEFAULT 0");
await addColumn("tasa_bs", "tasa_bs REAL NOT NULL DEFAULT 0");

const tasaResponse = await db.execute(
  "SELECT value FROM tasas WHERE LOWER(nombre) = 'bs' LIMIT 1"
);
const tasaActual = Number(tasaResponse.rows?.[0]?.value ?? 0);

if (tasaActual > 0) {
  await db.execute(
    `
      UPDATE ventas
      SET monto_bs_raw = ROUND(COALESCE(monto_bs, 0) * ?, 2),
          tasa_bs = ?
      WHERE COALESCE(monto_bs, 0) > 0
        AND COALESCE(monto_bs_raw, 0) = 0
    `,
    [tasaActual, tasaActual]
  );
  console.log("montos BS historicos rellenados con la tasa actual.");
}

const after = await db.execute("PRAGMA table_info(ventas)");
console.log(JSON.stringify(after.rows ?? [], null, 2));
