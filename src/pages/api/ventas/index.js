import { createClient } from "@libsql/client";

export async function POST({ request }) {
    try {

        const { fecha, descripcion, monto, empleadoId, servicioId } = await request.json();

        const db = createClient({   url: import.meta.env.DATABASE_URL,
                                    authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                                });

        await db.execute("INSERT INTO ventas (fecha, descripcion, monto, empleado_id, servicio_id) VALUES (?, ?, ?, ?, ?)", [fecha, descripcion, monto, empleadoId, servicioId]);

        return new Response(JSON.stringify({ message: "Venta agregado exitosamente" }), { status: 200 });
    
    } catch (error) {
        console.error("Error agregando venta:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

// RESET DE IDS
// DELETE FROM sqlite_sequence WHERE name='ventas';