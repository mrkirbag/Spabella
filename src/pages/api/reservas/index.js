import { createClient } from "@libsql/client";

const db = createClient({   url: import.meta.env.DATABASE_URL,
                            authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                        });

export async function GET({ request }) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");

        if (!id) {
            return new Response(JSON.stringify({ error: "El id de la reserva es obligatorio" }), { status: 400 });
        }

        const reserva = await db.execute(
            "SELECT id, fecha, descripcion, id_cliente FROM reservas WHERE id = ?",
            [id]
        );

        if (!reserva.rows || reserva.rows.length === 0) {
            return new Response(JSON.stringify({ error: "Reserva no encontrada" }), { status: 404 });
        }

        return new Response(JSON.stringify(reserva.rows[0]), { status: 200 });

    } catch (error) {
        console.error("Error obteniendo reserva:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}

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

export async function PUT({ request }) {
    try {

        const { id, fecha, descripcion, clienteId } = await request.json();

        if (!id || !fecha || !descripcion || !clienteId) {
            return new Response(JSON.stringify({ error: "Todos los campos son obligatorios" }), { status: 400 });
        }

        await db.execute(
            "UPDATE reservas SET fecha = ?, descripcion = ?, id_cliente = ? WHERE id = ?",
            [fecha, descripcion, clienteId, id]
        );

        return new Response(JSON.stringify({ message: "Reserva reprogramada exitosamente" }), { status: 200 });
    
    } catch (error) {
        console.error("Error reprogramando reserva:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}