import { createClient } from "@libsql/client";

export async function GET({ request }) {

    const url = new URL(request.url);
    const fecha = url.searchParams.get("fecha");

    const db = createClient({   url: import.meta.env.DATABASE_URL,
                                authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                            });

    const ventas = await db.execute(`
                                        SELECT v.id, v.fecha, s.nombre AS servicio, v.descripcion, e.nombre AS empleado, v.monto
                                        FROM ventas v
                                        JOIN empleados e ON v.empleado_id = e.id
                                        JOIN servicios s ON v.servicio_id = s.id
                                        WHERE v.fecha = ?
    
                                    `, [fecha]);

    // Si no hay registros, mostrar mensaje de error
    if (!ventas.rows || ventas.rows.length === 0) {
        return new Response(JSON.stringify({ mensaje: "No hay ventas para esa fecha." }), { status: 200 });
    }

    return new Response(JSON.stringify(ventas.rows), {
        headers: { "Content-Type": "application/json" }
    });
}

// RESET DE IDS
// DELETE FROM sqlite_sequence WHERE name='ventas';