import { createClient } from "@libsql/client";

export async function GET({ request }) {
    const url = new URL(request.url);
    const fechaDesde = url.searchParams.get("desde");
    const fechaHasta = url.searchParams.get("hasta");

    const db = createClient({   
        url: import.meta.env.DATABASE_URL,
        authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
    });

    const datos = await db.execute(`
        SELECT v.fecha, s.nombre AS servicio, s.porcentaje_empleado, s.porcentaje_spabella,
        v.descripcion, e.nombre AS empleada, v.monto
        FROM ventas v
        JOIN empleados e ON v.empleado_id = e.id
        JOIN servicios s ON v.servicio_id = s.id
        WHERE v.fecha BETWEEN ? AND ?
        ORDER BY e.nombre, v.fecha
    `, [fechaDesde, fechaHasta]);

    console.log("Resultado de la consulta:", datos.rows); // 🔍 Debug

    // Si no hay registros, mostrar mensaje de error
    if (!datos.rows || datos.rows.length === 0) {
        return new Response(JSON.stringify({ mensaje: "No hay registros en este rango de fechas." }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    // Agrupar los datos por empleada y calcular el total del spa
    const facturacion = {};
    datos.rows.forEach(venta => {
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