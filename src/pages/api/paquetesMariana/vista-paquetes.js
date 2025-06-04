import { createClient } from "@libsql/client";

export async function GET({ request }) {
    
    const url = new URL(request.url);
    const clienteId = url.searchParams.get("cliente");

    const db = createClient({   url: import.meta.env.DATABASE_URL,
                                authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                            });


    const paquetes = await db.execute("SELECT id, descripcion, numero_sesiones, monto_total, fecha_compra FROM paquetes WHERE cliente_id = ?", [clienteId]);

    // Si no hay registros, mostrar mensaje de error
    if (!paquetes.rows || paquetes.rows.length === 0) {
        return new Response(JSON.stringify({ mensaje: "No hay paquetes para ese cliente." }), { status: 200 });
    }

    return new Response(JSON.stringify(paquetes.rows), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });

}