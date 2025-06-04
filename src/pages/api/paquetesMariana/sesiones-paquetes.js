import { createClient } from "@libsql/client";

export async function GET({ request }) {

    const url = new URL(request.url);
    const paqueteId = url.searchParams.get("id");

    const db = createClient({   
                                url: import.meta.env.DATABASE_URL,
                                authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                            });

    try {

        const sesiones = await db.execute(`SELECT id, fecha, numero_sesion, abono_pago FROM sesiones WHERE paquete_id = ?`, [paqueteId]);

        // Si no hay registros, mostrar mensaje de error
        if (!sesiones.rows || sesiones.rows.length === 0) {
            return new Response(JSON.stringify({ mensaje: "No hay sesiones para ese paquete." }), { status: 200 });
        }

        return new Response(JSON.stringify(sesiones.rows), { status: 200 });

    } catch (error) {
        console.error("Error obteniendo sesiones:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor"  }), { status: 500 });
    }
}