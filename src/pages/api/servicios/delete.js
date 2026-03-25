import { createClient } from "@libsql/client";

export async function DELETE({ request }) {
    try {
        const { id } = await request.json(); 

        const db = createClient({   
                                    url: import.meta.env.DATABASE_URL,
                                    authToken: import.meta.env.DATABASE_AUTH_TOKEN // Agregar token
                                });

        await db.execute("UPDATE servicios SET estado = 'inactivo' WHERE id = ?", [id]);

        return new Response(JSON.stringify({message: "Servicio inactivado correctamente" }), { status: 200 });

    } catch (error) {
        console.error("Error eliminando servicio:", error);
        return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
    }
}