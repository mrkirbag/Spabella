import { createClient } from "@libsql/client";

export async function DELETE({ request }) {
    try {
        const { id } = await request.json();

        if (!id) {
            return new Response(JSON.stringify({ error: "El id de la reserva es obligatorio" }), { status: 400 });
        }

        const db = createClient({
            url: import.meta.env.DATABASE_URL,
            authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
        });

        await db.execute("DELETE FROM reservas WHERE id = ?", [id]);

        return new Response(JSON.stringify({ message: "Reserva eliminada correctamente" }), { status: 200 });

    } catch (error) {
        console.error("Error eliminando reserva:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}
