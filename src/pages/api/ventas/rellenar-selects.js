import { createClient } from "@libsql/client";

export async function GET() {

    const db = createClient({   url: import.meta.env.DATABASE_URL,
                                authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                            });

    await db.execute(`
        CREATE TABLE IF NOT EXISTS tasas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            value REAL NOT NULL DEFAULT 0
        )
    `);

    await db.execute("INSERT OR IGNORE INTO tasas (nombre, value) VALUES ('bs', 0)");

    const empleados = await db.execute("SELECT id, nombre, cargo FROM empleados WHERE estado = 'activo'");
    const servicios = await db.execute("SELECT id, nombre, porcentaje_spabella, porcentaje_empleado FROM servicios WHERE estado = 'activo'");
    const tasaBsResponse = await db.execute("SELECT value FROM tasas WHERE LOWER(nombre) = 'bs' LIMIT 1");

    let empleadosEnvios = empleados.rows;
    let serviciosEnvios = servicios.rows;
    const tasaBs = Number(tasaBsResponse.rows?.[0]?.value ?? 0);

    return new Response(JSON.stringify({empleadosEnvios, serviciosEnvios, tasaBs}), {
        headers: { "Content-Type": "application/json" }
    });
}