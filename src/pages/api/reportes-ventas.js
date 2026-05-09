import { createClient } from "@libsql/client";

const ensureTasasTable = async (db) => {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS tasas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            value REAL NOT NULL DEFAULT 0
        )
    `);

    await db.execute(
        "INSERT OR IGNORE INTO tasas (nombre, value) VALUES ('bs', 0)"
    );
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
    const fechaDesde = url.searchParams.get("desde");
    const fechaHasta = url.searchParams.get("hasta");

    const db = createClient({   
        url: import.meta.env.DATABASE_URL,
        authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
    });

    await ensureTasasTable(db);
    await ensureVentasColumns(db);

    const tasaResponse = await db.execute(
        "SELECT value FROM tasas WHERE LOWER(nombre) = 'bs' LIMIT 1"
    );
    const tasaBs = Number(tasaResponse.rows?.[0]?.value ?? 0);

    const datos = await db.execute(`
        SELECT v.fecha, s.nombre AS servicio, s.porcentaje_empleado, s.porcentaje_spabella,
        v.descripcion, e.nombre AS empleada, v.monto,
        COALESCE(v.monto_usd, v.monto) AS monto_usd,
        COALESCE(v.monto_bs, 0) AS monto_bs_usd
        FROM ventas v
        JOIN empleados e ON v.empleado_id = e.id
        JOIN servicios s ON v.servicio_id = s.id
        WHERE v.fecha BETWEEN ? AND ?
        ORDER BY e.nombre, v.fecha
    `, [fechaDesde, fechaHasta]);

    // Si no hay registros, mostrar mensaje de error
    if (!datos.rows || datos.rows.length === 0) {
        return new Response(JSON.stringify({ mensaje: "No hay registros en este rango de fechas." }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    // Agrupar los datos por empleada y calcular los totales en USD y BS
    const facturacion = {};
    datos.rows.forEach(venta => {
        const porcentajeEmpleado = Number(venta.porcentaje_empleado ?? 0);
        const porcentajeSpa = Number(venta.porcentaje_spabella ?? 0);

        const montoTotalUsd = Number(venta.monto ?? 0);
        const montoTotalBs = tasaBs > 0 ? (montoTotalUsd * tasaBs) : 0;
        const montoUsd = Number(venta.monto_usd ?? 0);
        const montoBsUsd = Number(venta.monto_bs_usd ?? 0);
        const pagoClienteUsd = montoUsd;
        const pagoClienteBs = tasaBs > 0 ? (montoBsUsd * tasaBs) : 0;

        const montoEmpleadoUsd = (montoUsd * porcentajeEmpleado) / 100;
        const montoEmpleadoBs = tasaBs > 0 ? ((montoBsUsd * porcentajeEmpleado) / 100) * tasaBs : 0;

        const montoSpaUsd = (montoUsd * porcentajeSpa) / 100;
        const montoSpaBs = tasaBs > 0 ? ((montoBsUsd * porcentajeSpa) / 100) * tasaBs : 0;

        if (!facturacion[venta.empleada]) {
            facturacion[venta.empleada] = { 
                nombre: venta.empleada, 
                tasaBs,
                totalEmpleadoUsd: 0,
                totalEmpleadoBs: 0,
                totalSpaUsd: 0,
                totalSpaBs: 0,
                servicios: [] 
            };
        }
        
        facturacion[venta.empleada].totalEmpleadoUsd += montoEmpleadoUsd;
        facturacion[venta.empleada].totalEmpleadoBs += montoEmpleadoBs;
        facturacion[venta.empleada].totalSpaUsd += montoSpaUsd;
        facturacion[venta.empleada].totalSpaBs += montoSpaBs;
        
        facturacion[venta.empleada].servicios.push({
            fecha: venta.fecha,
            servicio: venta.servicio,
            descripcion: venta.descripcion,
            porcentajeEmpleado,
            porcentajeSpa,
            montoTotalUsd: Number(montoTotalUsd.toFixed(2)),
            montoTotalBs: Number(montoTotalBs.toFixed(2)),
            pagoClienteUsd: Number(pagoClienteUsd.toFixed(2)),
            pagoClienteBs: Number(pagoClienteBs.toFixed(2)),
            montoEmpleadoUsd: Number(montoEmpleadoUsd.toFixed(2)),
            montoEmpleadoBs: Number(montoEmpleadoBs.toFixed(2)),
            montoSpaUsd: Number(montoSpaUsd.toFixed(2)),
            montoSpaBs: Number(montoSpaBs.toFixed(2))
        });
    });

    return new Response(JSON.stringify(Object.values(facturacion)), {
        headers: { "Content-Type": "application/json" }
    });
}

// RESET DE IDS
// DELETE FROM sqlite_sequence WHERE name='ventas';