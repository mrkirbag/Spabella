import { createClient } from "@libsql/client";

const db = createClient({   url: import.meta.env.DATABASE_URL,
                            authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                        });

export async function POST({ request }) {
    try {

        const { fecha, descripcion, clienteId } = await request.json();

        await db.execute("INSERT INTO reservas (fecha, descripcion, id_cliente) VALUES (?, ?, ?)", [fecha, descripcion, clienteId]);

        return new Response(JSON.stringify({ message: "Reserva agregado exitosamente" }), { status: 200 });
    
    } catch (error) {
        console.error("Error agregando reserva:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}