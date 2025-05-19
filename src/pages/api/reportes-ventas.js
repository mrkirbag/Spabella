import sqlite3 from "sqlite3";
import { open } from "sqlite";

export async function GET({ request }) {
    const url = new URL(request.url);
    const fechaDesde = url.searchParams.get("desde");
    const fechaHasta = url.searchParams.get("hasta");

    const db = await open({ filename: "./db/spabella.db", driver: sqlite3.Database });

    const datos = await db.all(`
                SELECT v.fecha, s.nombre AS servicio, s.porcentaje_empleado, s.porcentaje_spabella,
                v.descripcion, e.nombre AS empleada, v.monto
                FROM ventas v
                JOIN empleados e ON v.empleado_id = e.id
                JOIN servicios s ON v.servicio_id = s.id
                WHERE v.fecha BETWEEN ? AND ?
                ORDER BY e.nombre, v.fecha
            `, [fechaDesde, fechaHasta]);

    // Si no hay registros, mostrar mensaje de error
    if (datos.length === 0) {
        return new Response(JSON.stringify({ mensaje: "No hay registros en este rango de fechas." }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    // Agrupar los datos por empleada y calcular el total del spa
    const facturacion = {};
    datos.forEach(venta => {
        const montoEmpleado = ((venta.monto * venta.porcentaje_empleado) / 100);
        const montoSpa = venta.monto - montoEmpleado;

        if (!facturacion[venta.empleada]) {
            facturacion[venta.empleada] = { 
                nombre: venta.empleada, 
                totalEmpleado: 0, 
                totalSpa: 0, 
                servicios: [] 
            };
        }
        
        facturacion[venta.empleada].totalEmpleado += montoEmpleado;
        facturacion[venta.empleada].totalSpa += montoSpa;
        
        facturacion[venta.empleada].servicios.push({
            fecha: venta.fecha,
            servicio: venta.servicio,
            descripcion: venta.descripcion,
            montoTotal: venta.monto.toFixed(2),
            montoEmpleado: montoEmpleado.toFixed(2),
            montoSpa: montoSpa.toFixed(2)
        });
    });

    return new Response(JSON.stringify(Object.values(facturacion)), {
        headers: { "Content-Type": "application/json" }
    });
}

// RESET DE IDS
// DELETE FROM sqlite_sequence WHERE name='ventas';