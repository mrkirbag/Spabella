import "dotenv/config";
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const hasColumn = async (tableName, columnName) => {
  const pragma = await db.execute(`PRAGMA table_info(${tableName});`);
  return pragma.rows.some((row) => String(row.name).toLowerCase() === columnName.toLowerCase());
};

const ensureEstadoColumn = async (tableName) => {
  const exists = await hasColumn(tableName, "estado");

  if (!exists) {
    await db.execute(`ALTER TABLE ${tableName} ADD COLUMN estado TEXT NOT NULL DEFAULT 'activo';`);
    console.log(`Columna estado agregada en ${tableName}`);
  } else {
    console.log(`Columna estado ya existe en ${tableName}`);
  }

  await db.execute(`UPDATE ${tableName} SET estado = 'activo' WHERE estado IS NULL OR TRIM(estado) = '';`);
  console.log(`Datos normalizados en ${tableName}`);
};

await ensureEstadoColumn("empleados");
await ensureEstadoColumn("servicios");

console.log("Migracion completada.");
