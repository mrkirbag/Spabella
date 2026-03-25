import "dotenv/config";
import { createClient } from "@libsql/client";

const mode = process.argv[2] || "preview";

const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const listDuplicatesSql = `
  SELECT
    nombre,
    celular,
    COUNT(*) AS total,
    GROUP_CONCAT(id) AS ids
  FROM clientes
  GROUP BY nombre, celular
  HAVING COUNT(*) > 1
  ORDER BY total DESC, nombre ASC;
`;

const deleteDuplicatesSql = `
  DELETE FROM clientes
  WHERE id IN (
    SELECT id FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY nombre, celular
          ORDER BY id ASC
        ) AS rn
      FROM clientes
    ) t
    WHERE t.rn > 1
  );
`;

const duplicateMapCte = `
  WITH map AS (
    SELECT
      id AS dup_id,
      MIN(id) OVER (PARTITION BY nombre, celular) AS keep_id,
      ROW_NUMBER() OVER (PARTITION BY nombre, celular ORDER BY id ASC) AS rn
    FROM clientes
  )
`;

const quoteIdent = (identifier) => `"${String(identifier).replace(/"/g, '""')}"`;

const getForeignKeysToClientes = async () => {
  const tables = await db.execute(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%';
  `);

  const refs = [];

  for (const tableRow of tables.rows) {
    const tableName = tableRow.name;
    const fkRows = await db.execute(`PRAGMA foreign_key_list(${quoteIdent(tableName)});`);

    for (const fk of fkRows.rows) {
      if (String(fk.table).toLowerCase() === "clientes") {
        refs.push({ table: tableName, fromColumn: fk.from });
      }
    }
  }

  return refs;
};

const before = await db.execute(listDuplicatesSql);
console.log("Duplicados antes:", before.rows.length);
if (before.rows.length > 0) {
  console.log(JSON.stringify(before.rows, null, 2));
}

if (mode === "apply") {
  const foreignKeyRefs = await getForeignKeysToClientes();

  for (const ref of foreignKeyRefs) {
    const table = quoteIdent(ref.table);
    const column = quoteIdent(ref.fromColumn);

    const updateSql = `
      ${duplicateMapCte}
      UPDATE ${table}
      SET ${column} = (
        SELECT keep_id
        FROM map
        WHERE map.dup_id = ${table}.${column}
          AND map.rn > 1
      )
      WHERE ${column} IN (
        SELECT dup_id
        FROM map
        WHERE rn > 1
      );
    `;

    await db.execute(updateSql);
  }

  const result = await db.execute(deleteDuplicatesSql);
  console.log("Filas eliminadas:", result.rowsAffected ?? 0);

  const after = await db.execute(listDuplicatesSql);
  console.log("Duplicados despues:", after.rows.length);
  if (after.rows.length > 0) {
    console.log(JSON.stringify(after.rows, null, 2));
  }
}
