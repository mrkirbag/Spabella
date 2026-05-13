import { createClient } from "@libsql/client";

const ensureTasasTable = async (db) => {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS tasas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            value REAL NOT NULL DEFAULT 0
        )
    `);

    await db.execute("INSERT OR IGNORE INTO tasas (nombre, value) VALUES ('bs', 0)");
};

const ensureVentasColumns = async (db) => {
    const columns = await db.execute("PRAGMA table_info(ventas)");
    const columnNames = new Set((columns.rows || []).map((row) => String(row.name).toLowerCase()));

    if (!columnNames.has("monto_usd")) {
        await db.execute("ALTER TABLE ventas ADD COLUMN monto_usd REAL NOT NULL DEFAULT 0");
    }

    if (!columnNames.has("monto_bs")) {
        await db.execute("ALTER TABLE ventas ADD COLUMN monto_bs REAL NOT NULL DEFAULT 0");
    }

    await db.execute(`
        UPDATE ventas
        SET monto_usd = monto,
            monto_bs = 0
        WHERE COALESCE(monto_usd, 0) = 0
          AND COALESCE(monto_bs, 0) = 0
          AND COALESCE(monto, 0) > 0
    `);
};

export async function GET({ request }) {

    const url = new URL(request.url);
    const fecha = url.searchParams.get("fecha");

    const db = createClient({   url: import.meta.env.DATABASE_URL,
                                authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                            });

    await ensureTasasTable(db);
    await ensureVentasColumns(db);

    const tasaResponse = await db.execute("SELECT value FROM tasas WHERE LOWER(nombre) = 'bs' LIMIT 1");
    const tasaBs = Number(tasaResponse.rows?.[0]?.value ?? 0);

    const ventas = await db.execute(`
                                        SELECT
                                            v.id,
                                            v.fecha,
                                            s.porcentaje_spabella,
                                            s.porcentaje_empleado,
                                            v.descripcion,
                                            e.nombre AS empleado,
                                            v.monto,
                                            COALESCE(v.monto_usd, v.monto) AS monto_usd,
                                            COALESCE(v.monto_bs, 0) AS monto_bs_usd
                                        FROM ventas v
                                        JOIN empleados e ON v.empleado_id = e.id
                                        JOIN servicios s ON v.servicio_id = s.id
                                        WHERE v.fecha = ?
    
                                    `, [fecha]);

    // Si no hay registros, mostrar mensaje de error
    if (!ventas.rows || ventas.rows.length === 0) {
        return new Response(JSON.stringify({ mensaje: "No hay ventas para esa fecha." }), { status: 200 });
    }

    return new Response(JSON.stringify({ ventas: ventas.rows, tasaBs }), {
        headers: { "Content-Type": "application/json" }
    });
}

// RESET DE IDS
// DELETE FROM sqlite_sequence WHERE name='ventas';