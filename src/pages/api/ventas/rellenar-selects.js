import { createClient } from "@libsql/client";
import {
    ensureTasasTable,
    METODOS_PAGO,
    METODOS_PAGO_POR_MONEDA,
    MONEDAS_PAGO,
    getTasas,
} from "../../../lib/ventas-schema.js";

export async function GET() {
    const db = createClient({
        url: import.meta.env.DATABASE_URL,
        authToken: import.meta.env.DATABASE_AUTH_TOKEN,
    });

    await ensureTasasTable(db);

    const empleados = await db.execute(
        "SELECT id, nombre, cargo FROM empleados WHERE estado = 'activo'"
    );
    const servicios = await db.execute(`
        SELECT
            MIN(id) AS id,
            porcentaje_spabella,
            porcentaje_empleado
        FROM servicios
        WHERE estado = 'activo'
        GROUP BY porcentaje_spabella, porcentaje_empleado
        ORDER BY porcentaje_spabella DESC, porcentaje_empleado ASC
    `);

    const tasas = await getTasas(db);
    const empleadosEnvios = empleados.rows;
    const serviciosEnvios = (servicios.rows || []).map((servicio) => ({
        ...servicio,
        reparto: `SPA ${servicio.porcentaje_spabella}% / EMPLEADA ${servicio.porcentaje_empleado}%`,
    }));

    return new Response(
        JSON.stringify({
            empleadosEnvios,
            serviciosEnvios,
            metodosPago: METODOS_PAGO,
            metodosPagoPorMoneda: METODOS_PAGO_POR_MONEDA,
            monedasPago: MONEDAS_PAGO,
            tasas,
            tasaBs: tasas.bs,
            tasaCop: tasas.cop,
        }),
        {
            headers: { "Content-Type": "application/json" },
        }
    );
}
