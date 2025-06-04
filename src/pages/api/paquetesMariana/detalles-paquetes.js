import { createClient } from "@libsql/client";

export async function GET({ request }) {

    const url = new URL(request.url);
    const idPaquete = url.searchParams.get("id");

    const db = createClient({   url: import.meta.env.DATABASE_URL,
                            authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                        });

    const detallesPaquete = await db.execute(`
                                                SELECT p.id, p.fecha_compra, p.descripcion, p.numero_sesiones, p.monto_total, c.nombre AS cliente_nombre
                                                FROM paquetes p
                                                JOIN clientes c ON p.cliente_id = c.id
                                                WHERE p.id = ?
                                            `, [idPaquete]);

    // Si no hay registros, mostrar mensaje de error
    if (!detallesPaquete.rows || detallesPaquete.rows.length === 0) {
        return new Response(JSON.stringify({ mensaje: "No hay registros para ese paquete." }), { status: 200 });
    }

    return new Response(JSON.stringify(detallesPaquete.rows), {
        headers: { "Content-Type": "application/json" }
    });



}